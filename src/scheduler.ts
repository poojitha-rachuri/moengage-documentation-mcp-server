import * as cron from 'node-cron';
import { config } from './config.js';
import { createLogger } from './logger.js';
import { Database } from './database.js';
import { SitemapUpdater } from './sitemap-updater.js';

const logger = createLogger('scheduler');

export class UpdateScheduler {
  private database: Database;
  private sitemapUpdater: SitemapUpdater;
  private scheduledTask?: cron.ScheduledTask;
  private isRunning: boolean = false;

  constructor() {
    this.database = new Database();
    this.sitemapUpdater = new SitemapUpdater(this.database);
  }

  async initialize(): Promise<void> {
    await this.database.initialize();
    
    // Perform initial update if configured
    if (config.forceUpdateOnStart) {
      logger.info('Performing initial update on startup');
      await this.performUpdate(true);
    }
  }

  startScheduler(): void {
    if (this.scheduledTask) {
      logger.warn('Scheduler is already running');
      return;
    }

    // Validate cron expression
    if (!cron.validate(config.updateSchedule)) {
      throw new Error(`Invalid cron expression: ${config.updateSchedule}`);
    }

    logger.info('Starting update scheduler', { 
      schedule: config.updateSchedule,
      sources: config.sitemapUrls.length,
      sitemapUrls: config.sitemapUrls
    });

    this.scheduledTask = cron.schedule(config.updateSchedule, async () => {
      if (this.isRunning) {
        logger.warn('Update is already in progress, skipping scheduled update');
        return;
      }

      logger.info('Scheduled update triggered');
      await this.performUpdate();
    }, {
      scheduled: true,
      timezone: 'UTC',
    });

    logger.info('Update scheduler started successfully');
  }

  stopScheduler(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = undefined;
      logger.info('Update scheduler stopped');
    }
  }

  async performUpdate(forceUpdate: boolean = false): Promise<void> {
    if (this.isRunning) {
      logger.warn('Update is already in progress');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting scheduled documentation update', { forceUpdate });
      
      const status = await this.sitemapUpdater.performUpdate(forceUpdate);
      
      const duration = Date.now() - startTime;
      logger.info('Scheduled update completed successfully', {
        totalDocuments: status.totalDocuments,
        newDocuments: status.newDocuments,
        updatedDocuments: status.updatedDocuments,
        deletedDocuments: status.deletedDocuments,
        errors: status.errors.length,
        duration,
      });

      // Log any errors that occurred during the update
      if (status.errors.length > 0) {
        logger.warn('Update completed with errors', { 
          errorCount: status.errors.length,
          errors: status.errors.slice(0, 5), // Log first 5 errors
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Scheduled update failed', { 
        error: error instanceof Error ? error.message : String(error),
        duration,
      });
    } finally {
      this.isRunning = false;
    }
  }

  async getNextScheduledRun(): Promise<Date | null> {
    if (!this.scheduledTask) {
      return null;
    }

    try {
      // Parse the cron expression to get the next run time
      const cronExpression = config.updateSchedule;
      const cronParts = cronExpression.split(' ');
      
      if (cronParts.length !== 6) {
        logger.warn('Invalid cron expression format', { expression: cronExpression });
        return null;
      }

      // This is a simplified calculation - for production use a proper cron parser
      // For now, we'll estimate based on the schedule format
      const now = new Date();
      
      // If it's a weekly schedule (default: every Sunday at 2 AM)
      if (cronExpression === '0 0 2 * * 0') {
        const nextSunday = new Date(now);
        nextSunday.setDate(now.getDate() + (7 - now.getDay()) % 7);
        nextSunday.setHours(2, 0, 0, 0);
        
        // If we've passed this week's Sunday 2 AM, go to next Sunday
        if (nextSunday <= now) {
          nextSunday.setDate(nextSunday.getDate() + 7);
        }
        
        return nextSunday;
      }
      
      // For other schedules, estimate 24 hours from now
      const nextRun = new Date(now);
      nextRun.setDate(nextRun.getDate() + 1);
      return nextRun;
    } catch (error) {
      logger.error('Failed to calculate next scheduled run', { error });
      return null;
    }
  }

  isUpdateRunning(): boolean {
    return this.isRunning;
  }

  async getLastUpdateStatus() {
    return await this.sitemapUpdater.getUpdateStatus();
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down scheduler');
    
    this.stopScheduler();
    
    // Wait for any running update to complete
    let waitCount = 0;
    while (this.isRunning && waitCount < 30) { // Wait up to 30 seconds
      logger.info('Waiting for running update to complete...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      waitCount++;
    }

    if (this.isRunning) {
      logger.warn('Update is still running after shutdown timeout');
    }

    await this.database.close();
    logger.info('Scheduler shutdown complete');
  }
}

// Export a singleton instance for use in the MCP server
export let updateScheduler: UpdateScheduler | null = null;

export async function initializeScheduler(): Promise<UpdateScheduler> {
  if (updateScheduler) {
    return updateScheduler;
  }

  updateScheduler = new UpdateScheduler();
  await updateScheduler.initialize();
  updateScheduler.startScheduler();
  
  return updateScheduler;
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  if (updateScheduler) {
    await updateScheduler.shutdown();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  if (updateScheduler) {
    await updateScheduler.shutdown();
  }
  process.exit(0);
});