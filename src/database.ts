import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { config } from './config.js';
import { createLogger } from './logger.js';
import type { Document, SearchResult, UpdateStatus, Category } from './types.js';

const logger = createLogger('database');

// Type definitions for promisified sqlite3 methods
type PromisifiedRun = (sql: string, params?: any) => Promise<sqlite3.RunResult>;
type PromisifiedGet = <T = any>(sql: string, params?: any) => Promise<T | undefined>;
type PromisifiedAll = <T = any>(sql: string, params?: any) => Promise<T[]>;

export class Database {
  private db: sqlite3.Database;
  private initialized: boolean = false;
  private run: PromisifiedRun;
  private get: PromisifiedGet;
  private all: PromisifiedAll;

  constructor() {
    // Ensure database directory exists
    const dbDir = path.dirname(config.databasePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new sqlite3.Database(config.databasePath, (err) => {
      if (err) {
        logger.error('Failed to open database', { error: err.message });
        throw err;
      }
      logger.info('Connected to SQLite database', { path: config.databasePath });
    });

    // Promisify database methods
    this.run = promisify(this.db.run.bind(this.db)) as PromisifiedRun;
    this.get = promisify(this.db.get.bind(this.db)) as PromisifiedGet;
    this.all = promisify(this.db.all.bind(this.db)) as PromisifiedAll;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create documents table
      await this.run(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          url TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          lastModified DATETIME NOT NULL,
          category TEXT NOT NULL,
          tags TEXT NOT NULL DEFAULT '[]',
          type TEXT NOT NULL DEFAULT 'guide',
          platform TEXT NOT NULL DEFAULT 'general',
          source TEXT NOT NULL DEFAULT 'developers',
          checksum TEXT NOT NULL,
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Add source column if it doesn't exist (for existing databases)
      try {
        await this.run('ALTER TABLE documents ADD COLUMN source TEXT NOT NULL DEFAULT "developers"');
        logger.info('Added source column to existing database');
      } catch (error) {
        // Column might already exist, ignore error
      }

      // Create full-text search table
      await this.run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
          id UNINDEXED,
          title,
          content,
          category,
          tags,
          source,
          content=documents,
          content_rowid=rowid
        )
      `);

      // Create indexes
      await this.run('CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category)');
      await this.run('CREATE INDEX IF NOT EXISTS idx_documents_platform ON documents(platform)');
      await this.run('CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type)');
      await this.run('CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source)');
      await this.run('CREATE INDEX IF NOT EXISTS idx_documents_lastModified ON documents(lastModified)');
      await this.run('CREATE INDEX IF NOT EXISTS idx_documents_checksum ON documents(checksum)');

      // Create update status table
      await this.run(`
        CREATE TABLE IF NOT EXISTS update_status (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lastUpdate DATETIME NOT NULL,
          totalDocuments INTEGER NOT NULL,
          newDocuments INTEGER NOT NULL,
          updatedDocuments INTEGER NOT NULL,
          deletedDocuments INTEGER NOT NULL,
          errors TEXT NOT NULL DEFAULT '[]',
          duration INTEGER NOT NULL,
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create triggers to update FTS index
      await this.run(`
        CREATE TRIGGER IF NOT EXISTS documents_fts_insert AFTER INSERT ON documents BEGIN
          INSERT INTO documents_fts(id, title, content, category, tags, source) 
          VALUES (NEW.id, NEW.title, NEW.content, NEW.category, NEW.tags, NEW.source);
        END
      `);

      await this.run(`
        CREATE TRIGGER IF NOT EXISTS documents_fts_update AFTER UPDATE ON documents BEGIN
          UPDATE documents_fts SET 
            title = NEW.title,
            content = NEW.content,
            category = NEW.category,
            tags = NEW.tags,
            source = NEW.source
          WHERE id = NEW.id;
        END
      `);

      await this.run(`
        CREATE TRIGGER IF NOT EXISTS documents_fts_delete AFTER DELETE ON documents BEGIN
          DELETE FROM documents_fts WHERE id = OLD.id;
        END
      `);

      this.initialized = true;
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database', { error });
      throw error;
    }
  }

  async upsertDocument(document: Omit<Document, 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date();
    const tags = JSON.stringify(document.tags);

    try {
      await this.run(`
        INSERT OR REPLACE INTO documents 
        (id, url, title, content, lastModified, category, tags, type, platform, source, checksum, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM documents WHERE id = ?), ?), ?)
      `, [
        document.id,
        document.url,
        document.title,
        document.content,
        document.lastModified.toISOString(),
        document.category,
        tags,
        document.type,
        document.platform,
        document.source,
        document.checksum,
        document.id, // For the COALESCE subquery
        now.toISOString(), // createdAt for new documents
        now.toISOString(), // updatedAt
      ]);

      logger.debug('Document upserted', { id: document.id, title: document.title });
    } catch (error) {
      logger.error('Failed to upsert document', { 
        id: document.id, 
        title: document.title, 
        error 
      });
      throw error;
    }
  }

  async getDocument(id: string): Promise<Document | null> {
    try {
      const row = await this.get('SELECT * FROM documents WHERE id = ?', [id]) as any;
      
      if (!row) return null;

      return {
        id: row.id,
        url: row.url,
        title: row.title,
        content: row.content,
        lastModified: new Date(row.lastModified),
        category: row.category,
        tags: JSON.parse(row.tags || '[]'),
        type: row.type as any,
        platform: row.platform as any,
        source: row.source as any || 'developers',
        checksum: row.checksum,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      };
    } catch (error) {
      logger.error('Failed to get document', { id, error });
      throw error;
    }
  }

  async searchDocuments(
    query: string,
    filters: {
      category?: string;
      platform?: string;
      type?: string;
      source?: string;
      limit?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const { category, platform, type, source, limit = 10 } = filters;

    try {
      let sql = `
        SELECT 
          d.id,
          d.title,
          d.url,
          d.category,
          d.platform,
          d.type,
          d.source,
          d.lastModified,
          snippet(documents_fts, 1, '<mark>', '</mark>', '...', 20) as snippet,
          bm25(documents_fts) as relevanceScore
        FROM documents_fts 
        JOIN documents d ON documents_fts.id = d.id
        WHERE documents_fts MATCH ?
      `;

      const params: any[] = [query];

      if (category) {
        sql += ' AND d.category = ?';
        params.push(category);
      }

      if (platform) {
        sql += ' AND d.platform = ?';
        params.push(platform);
      }

      if (type) {
        sql += ' AND d.type = ?';
        params.push(type);
      }

      if (source) {
        sql += ' AND d.source = ?';
        params.push(source);
      }

      sql += ' ORDER BY relevanceScore ASC LIMIT ?';
      params.push(limit);

      const rows = await this.all(sql, params) as any[];

      return rows.map(row => ({
        id: row.id,
        title: row.title,
        url: row.url,
        category: row.category,
        platform: row.platform,
        type: row.type,
        source: row.source || 'developers',
        snippet: row.snippet || '',
        relevanceScore: row.relevanceScore || 0,
        lastModified: new Date(row.lastModified),
      }));
    } catch (error) {
      logger.error('Failed to search documents', { query, filters, error });
      throw error;
    }
  }

  async getCategories(platform?: string): Promise<Category[]> {
    try {
      let sql = `
        SELECT 
          category as name,
          platform,
          COUNT(*) as documentCount,
          MAX(lastModified) as lastUpdated
        FROM documents
      `;

      const params: any[] = [];

      if (platform) {
        sql += ' WHERE platform = ?';
        params.push(platform);
      }

      sql += ' GROUP BY category, platform ORDER BY category';

      const rows = await this.all(sql, params) as any[];

      return rows.map(row => ({
        name: row.name,
        platform: row.platform,
        documentCount: row.documentCount,
        lastUpdated: new Date(row.lastUpdated),
      }));
    } catch (error) {
      logger.error('Failed to get categories', { platform, error });
      throw error;
    }
  }

  async getRecentUpdates(since?: Date, limit: number = 20): Promise<Document[]> {
    try {
      let sql = 'SELECT * FROM documents';
      const params: any[] = [];

      if (since) {
        sql += ' WHERE updatedAt > ?';
        params.push(since.toISOString());
      }

      sql += ' ORDER BY updatedAt DESC LIMIT ?';
      params.push(limit);

      const rows = await this.all(sql, params) as any[];

      return rows.map(row => ({
        id: row.id,
        url: row.url,
        title: row.title,
        content: row.content,
        lastModified: new Date(row.lastModified),
        category: row.category,
        tags: JSON.parse(row.tags || '[]'),
        type: row.type as any,
        platform: row.platform as any,
        source: row.source as any || 'developers',
        checksum: row.checksum,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }));
    } catch (error) {
      logger.error('Failed to get recent updates', { since, limit, error });
      throw error;
    }
  }

  async saveUpdateStatus(status: Omit<UpdateStatus, 'lastUpdate'>): Promise<void> {
    try {
      const errors = JSON.stringify(status.errors);
      
      await this.run(`
        INSERT INTO update_status 
        (lastUpdate, totalDocuments, newDocuments, updatedDocuments, deletedDocuments, errors, duration)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        new Date().toISOString(),
        status.totalDocuments,
        status.newDocuments,
        status.updatedDocuments,
        status.deletedDocuments,
        errors,
        status.duration,
      ]);

      logger.info('Update status saved', { status });
    } catch (error) {
      logger.error('Failed to save update status', { status, error });
      throw error;
    }
  }

  async getLastUpdateStatus(): Promise<UpdateStatus | null> {
    try {
      const row = await this.get(
        'SELECT * FROM update_status ORDER BY lastUpdate DESC LIMIT 1'
      ) as any;

      if (!row) return null;

      return {
        lastUpdate: new Date(row.lastUpdate),
        totalDocuments: row.totalDocuments,
        newDocuments: row.newDocuments,
        updatedDocuments: row.updatedDocuments,
        deletedDocuments: row.deletedDocuments,
        errors: JSON.parse(row.errors || '[]'),
        duration: row.duration,
      };
    } catch (error) {
      logger.error('Failed to get last update status', { error });
      throw error;
    }
  }

  async deleteDocument(id: string): Promise<void> {
    try {
      await this.run('DELETE FROM documents WHERE id = ?', [id]);
      logger.debug('Document deleted', { id });
    } catch (error) {
      logger.error('Failed to delete document', { id, error });
      throw error;
    }
  }

  async getTotalDocumentCount(): Promise<number> {
    try {
      const row = await this.get('SELECT COUNT(*) as count FROM documents') as any;
      return row.count || 0;
    } catch (error) {
      logger.error('Failed to get total document count', { error });
      throw error;
    }
  }

  async getDocumentByChecksum(checksum: string): Promise<Document | null> {
    try {
      const row = await this.get('SELECT * FROM documents WHERE checksum = ?', [checksum]) as any;
      
      if (!row) return null;

      return {
        id: row.id,
        url: row.url,
        title: row.title,
        content: row.content,
        lastModified: new Date(row.lastModified),
        category: row.category,
        tags: JSON.parse(row.tags || '[]'),
        type: row.type as any,
        platform: row.platform as any,
        source: row.source as any || 'developers',
        checksum: row.checksum,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      };
    } catch (error) {
      logger.error('Failed to get document by checksum', { checksum, error });
      throw error;
    }
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          logger.error('Failed to close database', { error: err.message });
          reject(err);
        } else {
          logger.info('Database connection closed');
          resolve();
        }
      });
    });
  }
}