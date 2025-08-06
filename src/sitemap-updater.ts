import axios from 'axios';
import xml2js from 'xml2js';
import { config } from './config.js';
import { createLogger } from './logger.js';
import { Database } from './database.js';
import { DocumentProcessor } from './document-processor.js';
import type { SitemapEntry, Document, UpdateStatus } from './types.js';

const logger = createLogger('sitemap-updater');

export class SitemapUpdater {
  private database: Database;
  private documentProcessor: DocumentProcessor;
  private xmlParser: xml2js.Parser;

  constructor(database: Database) {
    this.database = database;
    this.documentProcessor = new DocumentProcessor();
    this.xmlParser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      normalize: true,
      normalizeTags: true,
      trim: true,
    });
  }

  async performUpdate(forceUpdate: boolean = false): Promise<UpdateStatus> {
    const startTime = Date.now();
    logger.info('Starting documentation update', { forceUpdate });

    const status: Omit<UpdateStatus, 'lastUpdate'> = {
      totalDocuments: 0,
      newDocuments: 0,
      updatedDocuments: 0,
      deletedDocuments: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Fetch and parse all sitemaps
      const allSitemapEntries: Array<SitemapEntry & { source: string }> = [];
      
      for (const sitemapUrl of config.sitemapUrls) {
        try {
          const entries = await this.fetchSitemap(sitemapUrl);
          const source = this.extractSourceFromUrl(sitemapUrl);
          const entriesWithSource = entries.map(entry => ({ ...entry, source }));
          allSitemapEntries.push(...entriesWithSource);
          logger.info(`Found ${entries.length} entries in ${source} sitemap`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to fetch sitemap: ${sitemapUrl}`, { error: errorMessage });
          status.errors.push(`Failed to fetch sitemap ${sitemapUrl}: ${errorMessage}`);
        }
      }
      
      logger.info(`Total entries from all sitemaps: ${allSitemapEntries.length}`);

      // Filter entries to only include documentation pages
      const docEntries = this.filterDocumentationEntries(allSitemapEntries);
      logger.info(`Filtered to ${docEntries.length} documentation entries`);

      // Get last update time for incremental updates
      const lastUpdate = forceUpdate ? null : await this.database.getLastUpdateStatus();
      const lastUpdateTime = lastUpdate?.lastUpdate;

      // Process entries in batches
      const batchSize = config.maxConcurrentUpdates;
      const batches = this.createBatches(docEntries, batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logger.debug(`Processing batch ${i + 1}/${batches.length}`, { batchSize: batch.length });

        const promises = batch.map(entry => this.processEntry(entry, lastUpdateTime));
        const results = await Promise.allSettled(promises);

        // Process results
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const { action, document, error } = result.value;
            
            if (error) {
              status.errors.push(error);
            } else if (document) {
              switch (action) {
                case 'created':
                  status.newDocuments++;
                  break;
                case 'updated':
                  status.updatedDocuments++;
                  break;
                case 'skipped':
                  // No action needed
                  break;
              }
            }
          } else {
            status.errors.push(`Batch processing error: ${result.reason}`);
            logger.error('Batch processing failed', { error: result.reason });
          }
        }

        // Add a small delay between batches to be respectful
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Clean up deleted documents
      const deletedCount = await this.cleanupDeletedDocuments(docEntries);
      status.deletedDocuments = deletedCount;

      status.totalDocuments = await this.database.getTotalDocumentCount();
      status.duration = Date.now() - startTime;

      // Save update status
      await this.database.saveUpdateStatus(status);

      logger.info('Documentation update completed', {
        totalDocuments: status.totalDocuments,
        newDocuments: status.newDocuments,
        updatedDocuments: status.updatedDocuments,
        deletedDocuments: status.deletedDocuments,
        errors: status.errors.length,
        duration: status.duration,
      });

      return { ...status, lastUpdate: new Date() };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Documentation update failed', { error: errorMessage, duration });
      
      const failedStatus: UpdateStatus = {
        ...status,
        errors: [...status.errors, `Update failed: ${errorMessage}`],
        duration,
        lastUpdate: new Date(),
      };

      await this.database.saveUpdateStatus(failedStatus);
      return failedStatus;
    }
  }

  private async fetchSitemap(sitemapUrl: string): Promise<SitemapEntry[]> {
    try {
      logger.debug('Fetching sitemap', { url: sitemapUrl });
      
      const response = await axios.get(sitemapUrl, {
        timeout: config.updateTimeout,
        headers: {
          'User-Agent': 'MoEngage-Documentation-MCP-Server/1.0.0',
        },
      });

      if (response.status !== 200) {
        throw new Error(`Failed to fetch sitemap: HTTP ${response.status}`);
      }

      const parsed = await this.xmlParser.parseStringPromise(response.data);
      
      if (!parsed.urlset || !parsed.urlset.url) {
        throw new Error('Invalid sitemap format: missing urlset or url elements');
      }

      // Normalize the data structure
      const urls = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
      
      return urls.map((url: any) => ({
        loc: url.loc,
        lastmod: url.lastmod,
        changefreq: url.changefreq,
        priority: url.priority,
      }));
    } catch (error) {
      logger.error('Failed to fetch sitemap', { error });
      throw error;
    }
  }

  private filterDocumentationEntries(entries: Array<SitemapEntry & { source: string }>): Array<SitemapEntry & { source: string }> {
    return entries.filter(entry => {
      const url = entry.loc;
      
      // Include MoEngage documentation pages from all sources
      const validDomains = [
        'developers.moengage.com/hc/',
        'help.moengage.com/hc/',
        'partners.moengage.com/hc/'
      ];
      
      if (!validDomains.some(domain => url.includes(domain))) {
        return false;
      }

      // Exclude non-article pages
      const excludePatterns = [
        '/categories/',
        '/sections/',
        '/search',
        '/requests',
        '/subscriptions',
        '/signin',
        '/signup',
        '/community',
      ];

      return !excludePatterns.some(pattern => url.includes(pattern));
    });
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async processEntry(
    entry: SitemapEntry & { source: string },
    lastUpdateTime?: Date
  ): Promise<{
    action: 'created' | 'updated' | 'skipped';
    document?: Document;
    error?: string;
  }> {
    try {
      const url = entry.loc;
      const lastModified = entry.lastmod ? new Date(entry.lastmod) : new Date();

      // Check if we should skip this entry based on last modification time
      if (lastUpdateTime && lastModified <= lastUpdateTime) {
        return { action: 'skipped' };
      }

      // Check if document already exists
      const documentId = this.generateDocumentId(url);
      const existingDocument = await this.database.getDocument(documentId);

      // Process the document with source information
      const newDocument = await this.documentProcessor.processDocument(url, lastModified, entry.source as any);
      
      if (!newDocument) {
        return { error: `Failed to process document: ${url}` };
      }

      // Check if content has actually changed
      if (existingDocument && existingDocument.checksum === newDocument.checksum) {
        return { action: 'skipped' };
      }

      // Save the document
      await this.database.upsertDocument(newDocument);

      const action = existingDocument ? 'updated' : 'created';
      logger.debug(`Document ${action}`, { 
        id: newDocument.id, 
        title: newDocument.title,
        url: newDocument.url,
      });

      return { action, document: newDocument };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to process entry', { url: entry.loc, error: errorMessage });
      return { error: `Failed to process ${entry.loc}: ${errorMessage}` };
    }
  }

  private async cleanupDeletedDocuments(currentEntries: Array<SitemapEntry & { source: string }>): Promise<number> {
    try {
      // Get all current document URLs from the database
      const existingDocuments = await this.database.getRecentUpdates(undefined, 10000); // Get all documents
      const currentUrls = new Set(currentEntries.map(entry => entry.loc));
      
      let deletedCount = 0;
      
      for (const doc of existingDocuments) {
        if (!currentUrls.has(doc.url)) {
          await this.database.deleteDocument(doc.id);
          deletedCount++;
          logger.debug('Document deleted (no longer in sitemap)', { 
            id: doc.id, 
            title: doc.title, 
            url: doc.url 
          });
        }
      }

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} deleted documents`);
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup deleted documents', { error });
      return 0;
    }
  }

  private generateDocumentId(url: string): string {
    // Create a consistent ID based on the URL
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
    
    // For MoEngage docs, the article ID is typically in the URL
    const articleMatch = url.match(/articles\/(\d+)/);
    if (articleMatch) {
      return `article-${articleMatch[1]}`;
    }

    // Use the last meaningful segment
    const lastSegment = pathSegments[pathSegments.length - 1];
    if (lastSegment && lastSegment !== 'index.html') {
      return lastSegment.replace(/\.[^/.]+$/, ''); // Remove extension
    }

    // Fallback to hash of URL
    const crypto = require('crypto');
    return crypto.createHash('md5').update(url).digest('hex').substring(0, 12);
  }

  private extractSourceFromUrl(sitemapUrl: string): 'developers' | 'help' | 'partners' {
    if (sitemapUrl.includes('developers.moengage.com')) {
      return 'developers';
    } else if (sitemapUrl.includes('help.moengage.com')) {
      return 'help';
    } else if (sitemapUrl.includes('partners.moengage.com')) {
      return 'partners';
    }
    return 'developers'; // fallback
  }

  async getUpdateStatus(): Promise<UpdateStatus | null> {
    return await this.database.getLastUpdateStatus();
  }
}