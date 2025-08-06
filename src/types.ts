import { z } from 'zod';

// Configuration schema
export const ConfigSchema = z.object({
  databasePath: z.string().default('./data/moengage-docs.db'),
  updateSchedule: z.string().default('0 0 2 * * 0'),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  logFile: z.string().default('./logs/mcp-server.log'),
  sitemapUrls: z.array(z.string()).default([
    'https://developers.moengage.com/hc/sitemap.xml',
    'https://help.moengage.com/hc/sitemap.xml',
    'https://partners.moengage.com/hc/sitemap.xml'
  ]),
  rateLimitRequests: z.number().default(10),
  rateLimitWindow: z.number().default(1000),
  cacheTtl: z.number().default(3600),
  enableCache: z.boolean().default(true),
  port: z.number().default(3000),
  host: z.string().default('localhost'),
  forceUpdateOnStart: z.boolean().default(false),
  maxConcurrentUpdates: z.number().default(5),
  updateTimeout: z.number().default(30000),
});

export type Config = z.infer<typeof ConfigSchema>;

// Document schemas
export const DocumentSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  content: z.string(),
  lastModified: z.date(),
  category: z.string(),
  tags: z.array(z.string()).default([]),
  type: z.enum(['sdk', 'api', 'guide', 'tutorial', 'reference']).default('guide'),
  platform: z.enum(['android', 'ios', 'web', 'react-native', 'flutter', 'api', 'general']).default('general'),
  source: z.enum(['developers', 'help', 'partners']).default('developers'),
  checksum: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Document = z.infer<typeof DocumentSchema>;

export const SitemapEntrySchema = z.object({
  loc: z.string(),
  lastmod: z.string().optional(),
  changefreq: z.enum(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']).optional(),
  priority: z.string().optional(),
});

export type SitemapEntry = z.infer<typeof SitemapEntrySchema>;

export const SitemapSchema = z.object({
  urlset: z.object({
    url: z.array(SitemapEntrySchema),
  }),
});

export type Sitemap = z.infer<typeof SitemapSchema>;

// MCP Tool schemas
export const SearchToolInputSchema = z.object({
  query: z.string().describe('Search query for MoEngage documentation'),
  category: z.string().optional().describe('Filter by category (e.g., "Android SDK", "iOS SDK", "Web SDK", "API")'),
  platform: z.enum(['android', 'ios', 'web', 'react-native', 'flutter', 'api', 'general']).optional().describe('Filter by platform'),
  source: z.enum(['developers', 'help', 'partners']).optional().describe('Filter by documentation source'),
  limit: z.number().min(1).max(50).default(10).describe('Maximum number of results to return'),
});

export const GetDocumentToolInputSchema = z.object({
  id: z.string().describe('Document ID to retrieve'),
});

export const ListCategoriesToolInputSchema = z.object({
  platform: z.enum(['android', 'ios', 'web', 'react-native', 'flutter', 'api', 'general']).optional().describe('Filter categories by platform'),
});

export const GetUpdatesToolInputSchema = z.object({
  since: z.string().optional().describe('ISO date string to get updates since this date'),
  limit: z.number().min(1).max(100).default(20).describe('Maximum number of updates to return'),
});

// Search result schema
export const SearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  category: z.string(),
  platform: z.string(),
  type: z.string(),
  source: z.string(),
  snippet: z.string(),
  relevanceScore: z.number(),
  lastModified: z.date(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

// Update status schema
export const UpdateStatusSchema = z.object({
  lastUpdate: z.date(),
  totalDocuments: z.number(),
  newDocuments: z.number(),
  updatedDocuments: z.number(),
  deletedDocuments: z.number(),
  errors: z.array(z.string()),
  duration: z.number(),
});

export type UpdateStatus = z.infer<typeof UpdateStatusSchema>;

// Category schema
export const CategorySchema = z.object({
  name: z.string(),
  platform: z.string(),
  documentCount: z.number(),
  lastUpdated: z.date(),
});

export type Category = z.infer<typeof CategorySchema>;