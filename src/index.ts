#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from './logger.js';
import { Database } from './database.js';
import { SitemapUpdater } from './sitemap-updater.js';
import { DocumentProcessor } from './document-processor.js';
import { UpdateScheduler } from './scheduler.js';
import { config } from './config.js';
import {
  SearchToolInputSchema, GetDocumentToolInputSchema, ListCategoriesToolInputSchema, GetUpdatesToolInputSchema,
  SearchToolInputZodSchema, GetDocumentToolInputZodSchema, ListCategoriesToolInputZodSchema, GetUpdatesToolInputZodSchema,
} from './types.js';

const logger = createLogger('mcp-server');

// Parse command line arguments
const args = process.argv.slice(2);
const availableTools = [
  'search_documentation',
  'get_document', 
  'list_categories',
  'get_recent_updates',
  'get_update_status',
  'trigger_update'
];

let enabledTools = availableTools;

// Check for --tools argument
const toolsIndex = args.indexOf('--tools');
if (toolsIndex !== -1 && toolsIndex + 1 < args.length) {
  const toolsArg = args[toolsIndex + 1];
  if (toolsArg) {
    enabledTools = toolsArg.split(',').filter(tool => availableTools.includes(tool));
  }
}

// Check for --list-tools argument
if (args.includes('--list-tools')) {
  console.log('Available tools:');
  availableTools.forEach(tool => console.log(`  - ${tool}`));
  process.exit(0);
}

// Check for --help argument
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
MoEngage Documentation MCP Server

Usage:
  npx @moengage/documentation-mcp-server [options]

Options:
  --tools <tool1,tool2,...>  Enable specific tools (comma-separated)
  --list-tools               List all available tools
  --help, -h                 Show this help message

Examples:
  npx @moengage/documentation-mcp-server
  npx @moengage/documentation-mcp-server --tools=search_documentation,get_document
  npx @moengage/documentation-mcp-server --list-tools

Available tools:
  - search_documentation     Search MoEngage documentation
  - get_document            Get specific document by ID
  - list_categories         List all documentation categories
  - get_recent_updates      Get recently updated documents
  - get_update_status       Check last update status
  - trigger_update          Manually trigger update
`);
  process.exit(0);
}

logger.info('Starting MoEngage MCP Server', {
  enabledTools,
  totalTools: enabledTools.length,
  service: 'moengage-mcp-server'
});

const server = new Server(
  {
    name: 'moengage-documentation-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize components
const database = new Database();
const documentProcessor = new DocumentProcessor();
const sitemapUpdater = new SitemapUpdater(database);
const scheduler = new UpdateScheduler();

// Setup handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [];

  if (enabledTools.includes('search_documentation')) {
    tools.push({
      name: 'search_documentation',
      description: 'Search MoEngage documentation (developers, help, partners) with filters and ranking',
      inputSchema: SearchToolInputSchema,
    });
  }

  if (enabledTools.includes('get_document')) {
    tools.push({
      name: 'get_document',
      description: 'Get a specific document by its ID',
      inputSchema: GetDocumentToolInputSchema,
    });
  }

  if (enabledTools.includes('list_categories')) {
    tools.push({
      name: 'list_categories',
      description: 'List all available documentation categories and platforms',
      inputSchema: ListCategoriesToolInputSchema,
    });
  }

  if (enabledTools.includes('get_recent_updates')) {
    tools.push({
      name: 'get_recent_updates',
      description: 'Get recently updated documentation',
      inputSchema: GetUpdatesToolInputSchema,
    });
  }

  if (enabledTools.includes('get_update_status')) {
    tools.push({
      name: 'get_update_status',
      description: 'Check the status of the last documentation update',
      inputSchema: {
        type: 'object' as const,
        properties: {},
        required: []
      },
    });
  }

  if (enabledTools.includes('trigger_update')) {
    tools.push({
      name: 'trigger_update',
      description: 'Manually trigger a documentation update',
      inputSchema: {
        type: 'object' as const,
        properties: {},
        required: []
      },
    });
  }

  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_documentation':
        return await handleSearchDocumentation(args);
      case 'get_document':
        return await handleGetDocument(args);
      case 'list_categories':
        return await handleListCategories(args);
      case 'get_recent_updates':
        return await handleGetRecentUpdates(args);
      case 'get_update_status':
        return await handleGetUpdateStatus(args);
      case 'trigger_update':
        return await handleTriggerUpdate(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    logger.error('Tool execution failed', { tool: name, error });
    throw error;
  }
});

// Tool handlers
async function handleSearchDocumentation(args: any) {
  const { query, category, platform, source, limit = 10 } = SearchToolInputZodSchema.parse(args);
  
  logger.info('Searching documentation', { query, category, platform, source, limit });
  
  const results = await database.searchDocuments(query, {
    category,
    platform,
    source,
    limit
  });

  return {
    content: [
      {
        type: 'text',
        text: `Found ${results.length} results for "${query}":\n\n${results.map((doc, index) => 
          `${index + 1}. **${doc.title}**\n   - URL: ${doc.url}\n   - Category: ${doc.category}\n   - Platform: ${doc.platform}\n   - Source: ${doc.source}\n   - Relevance: ${doc.relevanceScore.toFixed(2)}\n   - Snippet: ${doc.snippet}\n`
        ).join('\n')}`
      }
    ]
  };
}

async function handleGetDocument(args: any) {
  const { id } = GetDocumentToolInputZodSchema.parse(args);
  
  logger.info('Getting document', { id });
  
  const document = await database.getDocument(id);
  if (!document) {
    throw new Error(`Document with ID ${id} not found`);
  }

  return {
    content: [
      {
        type: 'text',
        text: `**${document.title}**\n\n**URL:** ${document.url}\n**Category:** ${document.category}\n**Platform:** ${document.platform}\n**Source:** ${document.source}\n**Last Modified:** ${document.lastModified}\n\n${document.content}`
      }
    ]
  };
}

async function handleListCategories(args: any) {
  const { platform } = ListCategoriesToolInputZodSchema.parse(args);
  
  logger.info('Listing categories', { platform });
  
  const categories = await database.getCategories(platform);
  
  return {
    content: [
      {
        type: 'text',
        text: `Available categories${platform ? ` for ${platform}` : ''}:\n\n${categories.map(cat => 
          `- **${cat.name}** (${cat.documentCount} documents)`
        ).join('\n')}`
      }
    ]
  };
}

async function handleGetRecentUpdates(args: any) {
  const { since, limit = 10 } = GetUpdatesToolInputZodSchema.parse(args);
  
  logger.info('Getting recent updates', { since, limit });
  
  const sinceDate = since ? new Date(since) : undefined;
  const updates = await database.getRecentUpdates(sinceDate, limit);
  
  return {
    content: [
      {
        type: 'text',
        text: `Recent updates${since ? ` since ${since}` : ''}:\n\n${updates.map(update => 
          `- **${update.title}** (${update.url})\n  Updated: ${update.updatedAt}\n  Category: ${update.category}\n  Platform: ${update.platform}`
        ).join('\n\n')}`
      }
    ]
  };
}

async function handleGetUpdateStatus(args: any) {
  logger.info('Getting update status');
  
  const status = await database.getLastUpdateStatus();
  
  return {
    content: [
      {
        type: 'text',
        text: `**Update Status:**\n\n**Last Update:** ${status?.lastUpdate || 'Never'}\n**Total Documents:** ${status?.totalDocuments || 0}\n**Documents Count:** ${await database.getTotalDocumentCount()}\n**Next Scheduled Update:** ${await scheduler.getNextScheduledRun()}`
      }
    ]
  };
}

async function handleTriggerUpdate(args: any) {
  logger.info('Triggering manual update');
  
  const result = await sitemapUpdater.performUpdate(true);
  
  return {
    content: [
      {
        type: 'text',
        text: `**Manual Update Triggered:**\n\n**Last Update:** ${result.lastUpdate}\n**Total Documents:** ${result.totalDocuments}\n**New Documents:** ${result.newDocuments}\n**Updated Documents:** ${result.updatedDocuments}\n**Errors:** ${result.errors.length}`
      }
    ]
  };
}

// Initialize and start server
async function startServer() {
  try {
    // Initialize database
    await database.initialize();
    logger.info('Database initialized');

    // Initialize scheduler
    await scheduler.initialize();
    logger.info('Scheduler initialized');

    // Start MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info('MoEngage Documentation MCP Server started successfully', {
      databasePath: config.databasePath,
      sitemapUrls: config.sitemapUrls,
      sources: config.sitemapUrls.length,
      updateSchedule: config.updateSchedule,
      enabledTools
    });

  } catch (error) {
    logger.error('Failed to start MCP server', { error });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  await scheduler.shutdown();
  await database.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  await scheduler.shutdown();
  await database.close();
  process.exit(0);
});

startServer();