import dotenv from 'dotenv';
import { ConfigSchema, type Config } from './types.js';

// Load environment variables
dotenv.config();

function loadConfig(): Config {
  const config = {
    databasePath: process.env.DATABASE_PATH,
    updateSchedule: process.env.UPDATE_SCHEDULE,
    logLevel: process.env.LOG_LEVEL,
    logFile: process.env.LOG_FILE,
    sitemapUrls: process.env.SITEMAP_URLS ? process.env.SITEMAP_URLS.split(',').map(url => url.trim()) : undefined,
    rateLimitRequests: process.env.RATE_LIMIT_REQUESTS ? parseInt(process.env.RATE_LIMIT_REQUESTS) : undefined,
    rateLimitWindow: process.env.RATE_LIMIT_WINDOW ? parseInt(process.env.RATE_LIMIT_WINDOW) : undefined,
    cacheTtl: process.env.CACHE_TTL ? parseInt(process.env.CACHE_TTL) : undefined,
    enableCache: process.env.ENABLE_CACHE === 'true',
    port: process.env.PORT ? parseInt(process.env.PORT) : undefined,
    host: process.env.HOST,
    forceUpdateOnStart: process.env.FORCE_UPDATE_ON_START === 'true',
    maxConcurrentUpdates: process.env.MAX_CONCURRENT_UPDATES ? parseInt(process.env.MAX_CONCURRENT_UPDATES) : undefined,
    updateTimeout: process.env.UPDATE_TIMEOUT ? parseInt(process.env.UPDATE_TIMEOUT) : undefined,
  };

  // Remove undefined values
  const cleanConfig = Object.fromEntries(
    Object.entries(config).filter(([_, value]) => value !== undefined)
  );

  return ConfigSchema.parse(cleanConfig);
}

export const config = loadConfig();