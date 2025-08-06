# MoEngage Documentation MCP Server

A Model Context Protocol (MCP) server that provides access to comprehensive MoEngage documentation from multiple sources with automatic updates.

## 📚 Documentation Sources

This server indexes documentation from three primary MoEngage sources:

- **developers.moengage.com** - SDK documentation, API references, integration guides
- **help.moengage.com** - User guides, tutorials, troubleshooting, FAQs
- **partners.moengage.com** - Partner integrations, marketplace documentation

## 🚀 Quick Deploy to Replit

[![Run on Repl.it](https://replit.com/badge)](https://replit.com/@your-username/moengage-documentation-mcp-server)

For easy deployment on Replit, see [REPLIT_DEPLOYMENT.md](REPLIT_DEPLOYMENT.md).

## Features

- **Multi-Source Documentation**: Indexes from developers.moengage.com, help.moengage.com, and partners.moengage.com
- **Comprehensive Search**: Full-text search across all MoEngage documentation sources
- **Automatic Updates**: Weekly scheduled updates from multiple sitemap XMLs
- **Intelligent Processing**: Converts HTML documentation to structured markdown
- **Source-Aware Filtering**: Filter by documentation source, platform, category, and type
- **Platform-Specific Search**: Filter by Android, iOS, Web, React Native, Flutter, APIs, etc.
- **Category Organization**: Browse documentation by source and SDK categories
- **Recent Updates Tracking**: See what documentation has been recently added or modified
- **Manual Update Triggers**: Force immediate updates when needed
- **Robust Error Handling**: Comprehensive logging and error recovery
- **Rate Limiting**: Respectful crawling with configurable rate limits
- **SQLite Storage**: Fast local storage with full-text search capabilities
- **Replit Ready**: Pre-configured for easy Replit deployment

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd moengage-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your settings
```

4. Build the project:
```bash
npm run build
```

## Configuration

All configuration is done through environment variables. Copy `.env.example` to `.env` and modify as needed:

### Key Configuration Options

- **UPDATE_SCHEDULE**: Cron expression for automatic updates (default: `0 0 2 * * 0` - every Sunday at 2 AM)
- **DATABASE_PATH**: SQLite database file location
- **SITEMAP_URLS**: Comma-separated list of sitemap URLs (includes developers, help, and partners)
- **RATE_LIMIT_REQUESTS**: Maximum requests per window (default: 10)
- **MAX_CONCURRENT_UPDATES**: Concurrent document processing (default: 5)
- **FORCE_UPDATE_ON_START**: Perform full update on server start (default: false)

## Usage

### Starting the Server

For development:
```bash
npm run dev
```

For production:
```bash
npm start
```

### MCP Tools

The server provides several tools for accessing MoEngage documentation:

#### 1. `search_documentation`
Search across all documentation with optional filters.

**Parameters:**
- `query` (string): Search query
- `category` (optional): Filter by category (e.g., "Developers - Android SDK", "Help - Getting Started")
- `platform` (optional): Filter by platform (android, ios, web, etc.)
- `source` (optional): Filter by source (developers, help, partners)
- `limit` (optional): Maximum results (default: 10)

**Example:**
```json
{
  "query": "push notifications",
  "source": "developers",
  "platform": "android",
  "limit": 5
}
```

#### 2. `get_document`
Retrieve a specific document by ID with full content.

**Parameters:**
- `id` (string): Document ID

#### 3. `list_categories`
List all documentation categories with document counts.

**Parameters:**
- `platform` (optional): Filter categories by platform

#### 4. `get_recent_updates`
Get recently updated or added documentation.

**Parameters:**
- `since` (optional): ISO date string to get updates since
- `limit` (optional): Maximum results (default: 20)

#### 5. `get_update_status`
Get the status of the last documentation update.

#### 6. `trigger_update`
Manually trigger a documentation update.

**Parameters:**
- `force` (optional): Force update even if documents haven't changed

## Architecture

### Components

1. **MCP Server** (`src/index.ts`): Main MCP server implementation
2. **Database** (`src/database.ts`): SQLite database with full-text search
3. **Document Processor** (`src/document-processor.ts`): HTML to Markdown conversion
4. **Sitemap Updater** (`src/sitemap-updater.ts`): Processes sitemap and updates documents
5. **Scheduler** (`src/scheduler.ts`): Handles automatic updates
6. **Configuration** (`src/config.ts`): Environment-based configuration
7. **Logging** (`src/logger.ts`): Structured logging with Winston

### Database Schema

The server uses SQLite with the following main tables:

- **documents**: Stores processed documentation with metadata
- **documents_fts**: Full-text search virtual table
- **update_status**: Tracks update history and statistics

### Document Processing Pipeline

1. **Sitemap Parsing**: Fetch and parse the XML sitemap
2. **URL Filtering**: Filter to documentation pages only
3. **Content Extraction**: Extract title, content, and metadata from HTML
4. **Markdown Conversion**: Convert HTML to clean Markdown
5. **Categorization**: Automatically categorize by platform and type
6. **Storage**: Store in SQLite with full-text indexing
7. **Cleanup**: Remove documents no longer in sitemap

## Automatic Updates

The server automatically updates documentation based on:

- **Scheduled Updates**: Configurable cron schedule (default: weekly)
- **Incremental Updates**: Only processes changed documents
- **Sitemap Comparison**: Tracks document modification dates
- **Content Checksums**: Detects actual content changes
- **Error Recovery**: Handles failures gracefully with retry logic

### Update Process

1. Fetch current sitemap XML
2. Compare with last update timestamp
3. Process only new/modified documents
4. Update database atomically
5. Clean up deleted documents
6. Log statistics and errors

## Monitoring and Logging

### Log Levels
- **error**: Critical errors and failures
- **warn**: Warnings and recoverable issues
- **info**: General information and status
- **debug**: Detailed debugging information

### Log Files
- `mcp-server.log`: Combined log file
- `mcp-server-error.log`: Error-only log file

### Metrics Tracked
- Total documents processed
- New/updated/deleted document counts
- Processing duration and performance
- Error rates and types
- Search query patterns

## Development

### Scripts

- `npm run dev`: Start development server with auto-reload
- `npm run build`: Build TypeScript to JavaScript
- `npm run test`: Run test suite
- `npm run lint`: Run ESLint
- `npm run format`: Format code with Prettier

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Adding New Features

1. Update TypeScript types in `src/types.ts`
2. Add new MCP tools in `src/index.ts`
3. Extend database schema if needed in `src/database.ts`
4. Update documentation and tests

## Production Deployment

### System Requirements

- Node.js 18+ 
- 2GB+ RAM (for large documentation sets)
- 1GB+ disk space (for database and logs)
- Stable internet connection

### Deployment Steps

1. **Server Setup**:
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Create application user
sudo useradd -m -s /bin/bash moengage-mcp
sudo su - moengage-mcp
```

2. **Application Deployment**:
```bash
# Clone and build
git clone <repository-url> moengage-mcp-server
cd moengage-mcp-server
npm ci --production
npm run build

# Configure environment
cp .env.example .env
nano .env  # Edit configuration
```

3. **Service Setup** (using systemd):
```bash
# Create service file
sudo nano /etc/systemd/system/moengage-mcp.service
```

```ini
[Unit]
Description=MoEngage MCP Server
After=network.target

[Service]
Type=simple
User=moengage-mcp
WorkingDirectory=/home/moengage-mcp/moengage-mcp-server
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

4. **Start Service**:
```bash
sudo systemctl daemon-reload
sudo systemctl enable moengage-mcp
sudo systemctl start moengage-mcp
```

### Monitoring in Production

- **Logs**: `journalctl -u moengage-mcp -f`
- **Status**: `systemctl status moengage-mcp`
- **Database Size**: Monitor `data/` directory
- **Update Performance**: Check update_status table

### Backup and Recovery

**Database Backup**:
```bash
# Create backup
sqlite3 data/moengage-docs.db ".backup backup-$(date +%Y%m%d).db"

# Restore backup
cp backup-20241201.db data/moengage-docs.db
```

**Full System Backup**:
```bash
tar -czf moengage-mcp-backup-$(date +%Y%m%d).tar.gz \
  data/ logs/ .env dist/ package.json
```

## Troubleshooting

### Common Issues

#### 1. Update Failures
- Check internet connectivity to `developers.moengage.com`
- Verify sitemap URL is accessible
- Review rate limiting configuration
- Check disk space for database

#### 2. Search Not Working
- Verify database initialization
- Rebuild FTS index: `DELETE FROM documents_fts; INSERT INTO documents_fts(documents_fts) VALUES('rebuild');`
- Check for database corruption

#### 3. Memory Issues
- Reduce `MAX_CONCURRENT_UPDATES`
- Increase system swap space
- Monitor with `htop` during updates

#### 4. Permission Errors
- Check file permissions on database directory
- Verify log directory is writable
- Ensure user has required permissions

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

### Health Check

Test server health:
```bash
# Check if server responds
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/index.js

# Manual update trigger
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "trigger_update", "arguments": {"force": true}}}' | node dist/index.js
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Style

- Use TypeScript with strict typing
- Follow ESLint configuration
- Format with Prettier
- Write comprehensive tests
- Document new features

## License

MIT License - see LICENSE file for details.

## Support

- **Documentation**: This README and inline code comments
- **Issues**: GitHub Issues for bug reports and feature requests
- **Logs**: Check application logs for detailed error information
- **Database**: SQLite browser tools for direct database inspection