import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import * as crypto from 'crypto';
import { URL } from 'url';
import { config } from './config.js';
import { createLogger } from './logger.js';
import type { Document } from './types.js';

const logger = createLogger('document-processor');

export class DocumentProcessor {
  private turndownService: TurndownService;
  private rateLimiter: Map<string, number[]> = new Map();

  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      bulletListMarker: '-',
    });

    // Configure turndown rules
    this.turndownService.addRule('removeComments', {
      filter: (node) => node.nodeType === 8, // Comment node
      replacement: () => '',
    });

    this.turndownService.addRule('cleanLinks', {
      filter: 'a',
      replacement: (content, node) => {
        const href = (node as HTMLAnchorElement).href;
        if (!href || href.startsWith('javascript:') || href === '#') {
          return content;
        }
        return `[${content}](${href})`;
      },
    });

    this.turndownService.addRule('codeBlocks', {
      filter: ['pre'],
      replacement: (content, node) => {
        const codeElement = node.querySelector('code');
        if (codeElement) {
          const language = this.extractLanguage(codeElement);
          return `\n\`\`\`${language}\n${codeElement.textContent || ''}\n\`\`\`\n`;
        }
        return `\n\`\`\`\n${content}\n\`\`\`\n`;
      },
    });
  }

  async processDocument(url: string, lastModified?: Date, source: 'developers' | 'help' | 'partners' = 'developers'): Promise<Document | null> {
    try {
      // Rate limiting
      await this.checkRateLimit();

      logger.debug('Processing document', { url });

      // Fetch the document
      const response = await axios.get(url, {
        timeout: config.updateTimeout,
        headers: {
          'User-Agent': 'MoEngage-MCP-Server/1.0.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (response.status !== 200) {
        logger.warn('Non-200 status code', { url, status: response.status });
        return null;
      }

      const $ = cheerio.load(response.data);

      // Extract title
      const title = this.extractTitle($);
      if (!title) {
        logger.warn('No title found', { url });
        return null;
      }

      // Extract main content
      const content = this.extractContent($);
      if (!content || content.trim().length < 100) {
        logger.warn('No substantial content found', { url, contentLength: content?.length });
        return null;
      }

      // Extract metadata
      const category = this.extractCategory(url, $);
      const platform = this.extractPlatform(url, category);
      const type = this.extractType(url, category);
      const tags = this.extractTags($, category, platform);

      // Generate document ID and checksum
      const id = this.generateDocumentId(url);
      const checksum = this.generateChecksum(content);

      // Convert to markdown
      const markdownContent = this.turndownService.turndown(content);

      const document: Document = {
        id,
        url,
        title,
        content: markdownContent,
        lastModified: lastModified || new Date(),
        category,
        tags,
        type,
        platform,
        source,
        checksum,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      logger.debug('Document processed successfully', { 
        id, 
        title, 
        category, 
        platform, 
        contentLength: markdownContent.length 
      });

      return document;
    } catch (error) {
      logger.error('Failed to process document', { url, error });
      return null;
    }
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const key = 'global';
    const requests = this.rateLimiter.get(key) || [];
    
    // Remove requests older than the window
    const validRequests = requests.filter(
      time => now - time < config.rateLimitWindow
    );

    if (validRequests.length >= config.rateLimitRequests) {
      const oldestRequest = Math.min(...validRequests);
      const waitTime = config.rateLimitWindow - (now - oldestRequest);
      
      logger.debug('Rate limit reached, waiting', { waitTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    validRequests.push(now);
    this.rateLimiter.set(key, validRequests);
  }

  private extractTitle($: cheerio.CheerioAPI): string {
    // Try different title selectors in order of preference
    const titleSelectors = [
      'h1.article-title',
      'h1[data-test-id="article-title"]',
      '.article-header h1',
      'article h1',
      'h1',
      'title',
      '.page-title',
      '.post-title',
    ];

    for (const selector of titleSelectors) {
      const title = $(selector).first().text().trim();
      if (title) {
        return title;
      }
    }

    return '';
  }

  private extractContent($: cheerio.CheerioAPI): string {
    // Remove unwanted elements
    $('script, style, nav, .navigation, .breadcrumb, .sidebar, .footer, .header, .comment').remove();
    $('.article-votes, .article-actions, .article-meta').remove();

    // Try different content selectors
    const contentSelectors = [
      '.article-body',
      '[data-test-id="article-body"]',
      'article .content',
      '.post-content',
      '.entry-content',
      'main article',
      'main .content',
      'main',
    ];

    for (const selector of contentSelectors) {
      const content = $(selector).first();
      if (content.length > 0 && content.text().trim().length > 100) {
        return content.html() || '';
      }
    }

    // Fallback: try to extract from body, excluding header/footer/nav
    $('header, footer, nav, aside, .header, .footer, .nav, .sidebar').remove();
    const bodyContent = $('body').html();
    
    return bodyContent || '';
  }

  private extractCategory(url: string, $: cheerio.CheerioAPI): string {
    // Determine source from URL
    let sourcePrefix = '';
    if (url.includes('help.moengage.com')) {
      sourcePrefix = 'Help - ';
    } else if (url.includes('partners.moengage.com')) {
      sourcePrefix = 'Partners - ';
    } else {
      sourcePrefix = 'Developers - ';
    }

    // Try to extract from URL path
    const urlPath = new URL(url).pathname;
    const pathSegments = urlPath.split('/').filter(segment => segment.length > 0);

    // Look for SDK categories in URL
    const sdkPatterns = [
      { pattern: /android/i, category: 'Android SDK' },
      { pattern: /ios/i, category: 'iOS SDK' },
      { pattern: /web/i, category: 'Web SDK' },
      { pattern: /react-native/i, category: 'React Native SDK' },
      { pattern: /flutter/i, category: 'Flutter SDK' },
      { pattern: /cordova/i, category: 'Cordova SDK' },
      { pattern: /capacitor/i, category: 'Capacitor SDK' },
      { pattern: /unity/i, category: 'Unity SDK' },
      { pattern: /ionic/i, category: 'Ionic SDK' },
      { pattern: /api/i, category: 'API Reference' },
      { pattern: /shopify/i, category: 'Shopify Integration' },
      { pattern: /getting-started/i, category: 'Getting Started' },
      { pattern: /integration/i, category: 'Integration Guide' },
      { pattern: /troubleshooting/i, category: 'Troubleshooting' },
      { pattern: /faq/i, category: 'FAQ' },
    ];

    for (const { pattern, category } of sdkPatterns) {
      if (pathSegments.some(segment => pattern.test(segment))) {
        return sourcePrefix + category;
      }
    }

    // Try to extract from breadcrumbs or navigation
    const breadcrumbText = $('.breadcrumb, .breadcrumbs, nav').text();
    for (const { pattern, category } of sdkPatterns) {
      if (pattern.test(breadcrumbText)) {
        return sourcePrefix + category;
      }
    }

    // Try to extract from page title or headings
    const titleText = this.extractTitle($) + ' ' + $('h1, h2').text();
    for (const { pattern, category } of sdkPatterns) {
      if (pattern.test(titleText)) {
        return sourcePrefix + category;
      }
    }

    return sourcePrefix + 'General';
  }

  private extractPlatform(url: string, category: string): Document['platform'] {
    const urlLower = url.toLowerCase();
    const categoryLower = category.toLowerCase();

    if (urlLower.includes('android') || categoryLower.includes('android')) {
      return 'android';
    }
    if (urlLower.includes('ios') || categoryLower.includes('ios')) {
      return 'ios';
    }
    if (urlLower.includes('web') || categoryLower.includes('web')) {
      return 'web';
    }
    if (urlLower.includes('react-native') || categoryLower.includes('react-native')) {
      return 'react-native';
    }
    if (urlLower.includes('flutter') || categoryLower.includes('flutter')) {
      return 'flutter';
    }
    if (urlLower.includes('api') || categoryLower.includes('api')) {
      return 'api';
    }

    return 'general';
  }

  private extractType(url: string, category: string): Document['type'] {
    const urlLower = url.toLowerCase();
    const categoryLower = category.toLowerCase();

    if (urlLower.includes('tutorial') || categoryLower.includes('tutorial')) {
      return 'tutorial';
    }
    if (urlLower.includes('reference') || categoryLower.includes('reference')) {
      return 'reference';
    }
    if (urlLower.includes('api') || categoryLower.includes('api')) {
      return 'api';
    }
    if (urlLower.includes('sdk') || categoryLower.includes('sdk')) {
      return 'sdk';
    }

    return 'guide';
  }

  private extractTags($: cheerio.CheerioAPI, category: string, platform: string): string[] {
    const tags = new Set<string>();

    // Add category and platform as tags
    tags.add(category.toLowerCase().replace(/\s+/g, '-'));
    if (platform !== 'general') {
      tags.add(platform);
    }

    // Extract from meta keywords
    const metaKeywords = $('meta[name="keywords"]').attr('content');
    if (metaKeywords) {
      metaKeywords.split(',').forEach(keyword => {
        const cleaned = keyword.trim().toLowerCase();
        if (cleaned.length > 2) {
          tags.add(cleaned);
        }
      });
    }

    // Extract from content headings
    $('h2, h3').each((_, element) => {
      const headingText = $(element).text().toLowerCase();
      const words = headingText.split(/\s+/).filter(word => word.length > 3);
      words.slice(0, 2).forEach(word => tags.add(word)); // Limit to first 2 words
    });

    return Array.from(tags).slice(0, 10); // Limit to 10 tags
  }

  private extractLanguage(codeElement: Element): string {
    const className = codeElement.className;
    const classMatch = className.match(/language-(\w+)/);
    if (classMatch) {
      return classMatch[1];
    }

    // Try to detect language from content
    const content = codeElement.textContent || '';
    if (content.includes('import ') && content.includes('from ')) {
      return 'javascript';
    }
    if (content.includes('package ') || content.includes('import ')) {
      return 'java';
    }
    if (content.includes('#import') || content.includes('@interface')) {
      return 'objc';
    }
    if (content.includes('func ') || content.includes('var ')) {
      return 'swift';
    }
    if (content.includes('<!DOCTYPE') || content.includes('<html')) {
      return 'html';
    }
    if (content.includes('curl ') || content.includes('wget ')) {
      return 'bash';
    }

    return '';
  }

  private generateDocumentId(url: string): string {
    // Create a consistent ID based on the URL
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
    
    // Use the last meaningful segment or create from hash
    const lastSegment = pathSegments[pathSegments.length - 1];
    if (lastSegment && lastSegment !== 'index.html') {
      return lastSegment.replace(/\.[^/.]+$/, ''); // Remove extension
    }

    // Fallback to hash of URL
    return crypto.createHash('md5').update(url).digest('hex').substring(0, 12);
  }

  private generateChecksum(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }
}