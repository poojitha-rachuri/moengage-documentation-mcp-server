#!/usr/bin/env node

// Node.js polyfills for compatibility
if (typeof globalThis.File === 'undefined') {
  // @ts-ignore
  globalThis.File = class File extends Blob {
    constructor(chunks: any, filename: string, options: any = {}) {
      super(chunks, options);
      // @ts-ignore
      this.name = filename;
      // @ts-ignore
      this.lastModified = Date.now();
    }
  };
}

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { config } from './config.js';
import { createLogger, logger } from './logger.js';
import { Database } from './database.js';
import { initializeScheduler } from './scheduler.js';
import {
  SearchToolInputSchema,
  GetDocumentToolInputSchema,
  ListCategoriesToolInputSchema,
  GetUpdatesToolInputSchema,
  SearchToolInputZodSchema,
  GetDocumentToolInputZodSchema,
  ListCategoriesToolInputZodSchema,
  GetUpdatesToolInputZodSchema,
} from './types.js';

const mcpLogger = createLogger('mcp-server');

class MoEngageMCPServer {
  private server: Server;
  private database: Database;

  constructor() {
    this.server = new Server(
      {
        name: 'moengage-documentation',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.database = new Database();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: 'search_documentation',
          description: 'Search MoEngage documentation (developers, help, partners) with filters and ranking',
          inputSchema: SearchToolInputSchema,
        },
        {
          name: 'get_document',
          description: 'Retrieve a specific document by ID with full content',
          inputSchema: GetDocumentToolInputSchema,
        },
        {
          name: 'list_categories',
          description: 'List all documentation categories with document counts',
          inputSchema: ListCategoriesToolInputSchema,
        },
        {
          name: 'get_recent_updates',
          description: 'Get recently updated or added documentation',
          inputSchema: GetUpdatesToolInputSchema,
        },
        {
          name: 'get_update_status',
          description: 'Get the status of the last documentation update',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'trigger_update',
          description: 'Manually trigger a documentation update (admin only)',
          inputSchema: {
            type: 'object',
            properties: {
              force: {
                type: 'boolean',
                description: 'Force update even if documents haven\'t changed',
                default: false,
              },
            },
          },
        },
      ];

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_documentation':
            return await this.handleSearchDocumentation(args);

          case 'get_document':
            return await this.handleGetDocument(args);

          case 'list_categories':
            return await this.handleListCategories(args);

          case 'get_recent_updates':
            return await this.handleGetRecentUpdates(args);

          case 'get_update_status':
            return await this.handleGetUpdateStatus();

          case 'trigger_update':
            return await this.handleTriggerUpdate(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        mcpLogger.error(`Tool execution failed: ${name}`, { error: errorMessage, args });
        
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${errorMessage}`,
            },
          ],
        };
      }
    });
  }

  private async handleSearchDocumentation(args: any) {
    const { query, category, platform, source, limit = 10 } = SearchToolInputZodSchema.parse(args);

    mcpLogger.debug('Searching documentation', { query, category, platform, source, limit });

    const results = await this.database.searchDocuments(query, {
      category,
      platform,
      source,
      limit,
    });

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No documentation found matching query: "${query}"`,
          },
        ],
      };
    }

    const searchSummary = `Found ${results.length} document(s) matching "${query}"`;
    const resultsList = results.map((result, index) => {
      return [
        `## ${index + 1}. ${result.title}`,
        `**Source:** ${result.source.charAt(0).toUpperCase() + result.source.slice(1)}`,
        `**Category:** ${result.category}`,
        `**Platform:** ${result.platform}`,
        `**Type:** ${result.type}`,
        `**URL:** ${result.url}`,
        `**Last Modified:** ${result.lastModified.toISOString()}`,
        `**Relevance Score:** ${result.relevanceScore.toFixed(2)}`,
        '',
        `**Preview:**`,
        result.snippet,
        '',
        '---',
        '',
      ].join('\n');
    }).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `${searchSummary}\n\n${resultsList}`,
        },
      ],
    };
  }

  private async handleGetDocument(args: any) {
    const { id } = GetDocumentToolInputZodSchema.parse(args);

    mcpLogger.debug('Getting document', { id });

    const document = await this.database.getDocument(id);

    if (!document) {
      return {
        content: [
          {
            type: 'text',
            text: `Document not found: ${id}`,
          },
        ],
      };
    }

    const documentInfo = [
      `# ${document.title}`,
      '',
      `**URL:** ${document.url}`,
      `**Source:** ${document.source.charAt(0).toUpperCase() + document.source.slice(1)}`,
      `**Category:** ${document.category}`,
      `**Platform:** ${document.platform}`,
      `**Type:** ${document.type}`,
      `**Tags:** ${document.tags.join(', ')}`,
      `**Last Modified:** ${document.lastModified.toISOString()}`,
      `**Created:** ${document.createdAt.toISOString()}`,
      `**Updated:** ${document.updatedAt.toISOString()}`,
      '',
      '---',
      '',
      document.content,
    ].join('\n');

    return {
      content: [
        {
          type: 'text',
          text: documentInfo,
        },
      ],
    };
  }

  private async handleListCategories(args: any) {
    const { platform } = ListCategoriesToolInputZodSchema.parse(args);

    mcpLogger.debug('Listing categories', { platform });

    const categories = await this.database.getCategories(platform);

    if (categories.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: platform 
              ? `No categories found for platform: ${platform}` 
              : 'No categories found',
          },
        ],
      };
    }

    const categoryList = categories.map((category, index) => {
      return [
        `## ${index + 1}. ${category.name}`,
        `**Platform:** ${category.platform}`,
        `**Document Count:** ${category.documentCount}`,
        `**Last Updated:** ${category.lastUpdated.toISOString()}`,
        '',
      ].join('\n');
    }).join('\n');

    const summary = platform
      ? `Categories for platform "${platform}" (${categories.length} total):`
      : `All documentation categories (${categories.length} total):`;

    return {
      content: [
        {
          type: 'text',
          text: `${summary}\n\n${categoryList}`,
        },
      ],
    };
  }

  private async handleGetRecentUpdates(args: any) {
    const { since, limit = 20 } = GetUpdatesToolInputZodSchema.parse(args);

    mcpLogger.debug('Getting recent updates', { since, limit });

    const sinceDate = since ? new Date(since) : undefined;
    const updates = await this.database.getRecentUpdates(sinceDate, limit);

    if (updates.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: since 
              ? `No updates found since ${since}` 
              : 'No recent updates found',
          },
        ],
      };
    }

    const updatesList = updates.map((doc, index) => {
      return [
        `## ${index + 1}. ${doc.title}`,
        `**Category:** ${doc.category}`,
        `**Platform:** ${doc.platform}`,
        `**URL:** ${doc.url}`,
        `**Last Modified:** ${doc.lastModified.toISOString()}`,
        `**Updated:** ${doc.updatedAt.toISOString()}`,
        '',
      ].join('\n');
    }).join('\n');

    const summary = since
      ? `Updates since ${since} (${updates.length} documents):`
      : `Recent updates (${updates.length} documents):`;

    return {
      content: [
        {
          type: 'text',
          text: `${summary}\n\n${updatesList}`,
        },
      ],
    };
  }

  private async handleGetUpdateStatus() {
    mcpLogger.debug('Getting update status');

    const updateScheduler = await import('./scheduler.js').then(m => m.updateScheduler);
    
    if (!updateScheduler) {
      return {
        content: [
          {
            type: 'text',
            text: 'Update scheduler not initialized',
          },
        ],
      };
    }

    const status = await updateScheduler.getLastUpdateStatus();
    const nextRun = await updateScheduler.getNextScheduledRun();
    const isRunning = updateScheduler.isUpdateRunning();

    if (!status) {
      return {
        content: [
          {
            type: 'text',
            text: 'No update status available. Run an update first.',
          },
        ],
      };
    }

    const statusInfo = [
      '# Documentation Update Status',
      '',
      `**Last Update:** ${status.lastUpdate.toISOString()}`,
      `**Currently Running:** ${isRunning ? 'Yes' : 'No'}`,
      `**Next Scheduled Run:** ${nextRun ? nextRun.toISOString() : 'Unknown'}`,
      '',
      '## Statistics',
      `**Total Documents:** ${status.totalDocuments}`,
      `**New Documents:** ${status.newDocuments}`,
      `**Updated Documents:** ${status.updatedDocuments}`,
      `**Deleted Documents:** ${status.deletedDocuments}`,
      `**Duration:** ${status.duration}ms`,
      '',
      '## Errors',
      status.errors.length > 0 
        ? `**Error Count:** ${status.errors.length}\n\n${status.errors.slice(0, 5).map(err => `- ${err}`).join('\n')}`
        : '**No errors**',
    ].join('\n');

    return {
      content: [
        {
          type: 'text',
          text: statusInfo,
        },
      ],
    };
  }

  private async handleTriggerUpdate(args: any) {
    const { force = false } = args;

    mcpLogger.info('Manual update triggered', { force });

    const updateScheduler = await import('./scheduler.js').then(m => m.updateScheduler);
    
    if (!updateScheduler) {
      return {
        content: [
          {
            type: 'text',
            text: 'Update scheduler not initialized',
          },
        ],
      };
    }

    if (updateScheduler.isUpdateRunning()) {
      return {
        content: [
          {
            type: 'text',
            text: 'Update is already in progress. Please wait for it to complete.',
          },
        ],
      };
    }

    // Start the update in the background
    updateScheduler.performUpdate(force).catch(error => {
      mcpLogger.error('Manual update failed', { error });
    });

    return {
      content: [
        {
          type: 'text',
          text: `Documentation update started ${force ? '(forced)' : ''}. Use get_update_status to check progress.`,
        },
      ],
    };
  }

  async start(): Promise<void> {
    mcpLogger.info('Starting MoEngage MCP Server');

    try {
      // Initialize database
      await this.database.initialize();
      mcpLogger.info('Database initialized');

      // Initialize and start scheduler
      await initializeScheduler();
      mcpLogger.info('Update scheduler initialized');

      // Start MCP server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      mcpLogger.info('MoEngage Documentation MCP Server started successfully', {
        databasePath: config.databasePath,
        updateSchedule: config.updateSchedule,
        sources: config.sitemapUrls.length,
        sitemapUrls: config.sitemapUrls,
      });

    } catch (error) {
      mcpLogger.error('Failed to start MCP server', { error });
      process.exit(1);
    }
  }
}

// Start the server
const server = new MoEngageMCPServer();
server.start().catch((error) => {
  logger.error('Server startup failed', { error });
  process.exit(1);
});