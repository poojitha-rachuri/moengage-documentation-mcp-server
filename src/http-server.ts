import express, { Request, Response } from 'express';
import { createLogger } from './logger.js';
import { Database } from './database.js';
import { SitemapUpdater } from './sitemap-updater.js';
import { DocumentProcessor } from './document-processor.js';
import { UpdateScheduler } from './scheduler.js';
import { config } from './config.js';

const logger = createLogger('http-server');
const app = express();
const port = process.env.PORT || 3000;

// Initialize components
const database = new Database();
const documentProcessor = new DocumentProcessor();
const sitemapUpdater = new SitemapUpdater(database);
const scheduler = new UpdateScheduler();

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'moengage-mcp-server',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Status endpoint
app.get('/status', async (req: Request, res: Response) => {
  try {
    const updateStatus = await database.getLastUpdateStatus();
    const totalDocuments = await database.getTotalDocumentCount();
    
    res.json({
      status: 'running',
      totalDocuments,
      lastUpdate: updateStatus?.lastUpdate || null,
      nextUpdate: await scheduler.getNextScheduledRun(),
      sources: config.sitemapUrls
    });
  } catch (error) {
    logger.error('Status check failed', { error });
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Manual update trigger
app.post('/update', async (req: Request, res: Response) => {
  try {
    logger.info('Manual update triggered via HTTP');
    const result = await sitemapUpdater.performUpdate(true);
    res.json(result);
  } catch (error) {
    logger.error('Manual update failed', { error });
    res.status(500).json({ error: 'Update failed' });
  }
});

// Search endpoint (for testing)
app.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, limit = 10 } = req.query;
    if (!q) {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    const results = await database.searchDocuments(q as string, {
      limit: parseInt(limit as string) || 10
    });

    res.json({
      query: q,
      results: results.map(r => ({
        id: r.id,
        title: r.title,
        url: r.url,
        category: r.category,
        platform: r.platform,
        snippet: r.snippet,
        relevanceScore: r.relevanceScore
      }))
    });
  } catch (error) {
    logger.error('Search failed', { error });
    res.status(500).json({ error: 'Search failed' });
  }
});

// Start the server
async function startServer() {
  try {
    // Initialize database
    await database.initialize();
    logger.info('Database initialized');

    // Initialize scheduler
    await scheduler.initialize();
    logger.info('Scheduler initialized');

    // Start HTTP server
    app.listen(port, () => {
      logger.info(`HTTP server started on port ${port}`);
      logger.info(`Health check: http://localhost:${port}/health`);
      logger.info(`Status: http://localhost:${port}/status`);
      logger.info(`Search: http://localhost:${port}/search?q=android`);
    });

  } catch (error) {
    logger.error('Failed to start HTTP server', { error });
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