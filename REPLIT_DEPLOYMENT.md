# MoEngage Documentation MCP Server - Replit Deployment

Deploy the MoEngage Documentation MCP Server on Replit for easy access and management.

## 🚀 Quick Deploy to Replit

[![Run on Repl.it](https://replit.com/badge/github/your-username/moengage-documentation-mcp-server)](https://replit.com/@your-username/moengage-documentation-mcp-server)

## 📋 Pre-requisites

- Replit account (free tier works fine)
- Basic understanding of MCP (Model Context Protocol)

## 🔧 Setup Instructions

### 1. Fork or Import Repository

1. **Option A: Import from GitHub**
   - Go to [Replit](https://replit.com)
   - Click "Create Repl"
   - Choose "Import from GitHub"
   - Enter repository URL: `https://github.com/your-username/moengage-documentation-mcp-server`

2. **Option B: Upload Files**
   - Create a new Node.js Repl
   - Upload all project files to the Repl

### 2. Environment Configuration

The server is pre-configured for Replit with sensible defaults:

- **Database**: SQLite stored in `./data/moengage-docs.db`
- **Sources**: All three MoEngage documentation sites
- **Updates**: Weekly on Sundays at 2 AM UTC
- **Rate Limiting**: Reduced for Replit (5 requests/second)

### 3. Run the Server

Simply click the **Run** button in Replit, or execute:

```bash
npm start
```

The startup script will:
1. ✅ Create necessary directories (`data`, `logs`)
2. ✅ Install dependencies if needed
3. ✅ Build TypeScript if needed
4. ✅ Configure environment variables
5. ✅ Start the MCP server

## 📊 Documentation Sources

The server automatically indexes documentation from:

- **developers.moengage.com** - SDK documentation, API references
- **help.moengage.com** - User guides, tutorials, FAQs  
- **partners.moengage.com** - Partner integrations, marketplace docs

## 🛠 Available MCP Tools

Once running, the server provides these tools for AI assistants:

### 1. `search_documentation`
Search across all documentation sources with filters:
```json
{
  "query": "push notifications",
  "source": "developers",
  "platform": "android",
  "limit": 5
}
```

### 2. `get_document`
Retrieve specific document by ID:
```json
{
  "id": "article-12345"
}
```

### 3. `list_categories`
List documentation categories:
```json
{
  "platform": "ios"
}
```

### 4. `get_recent_updates`
Get recently updated documents:
```json
{
  "since": "2024-01-01T00:00:00Z",
  "limit": 10
}
```

### 5. `get_update_status`
Check last documentation update status

### 6. `trigger_update`
Manually trigger documentation refresh:
```json
{
  "force": true
}
```

## 🔍 Usage with AI Assistants

### Claude Desktop Configuration

Add to your Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "moengage-docs": {
      "command": "stdio",
      "args": ["node", "/path/to/replit/project/dist/index.js"]
    }
  }
}
```

### VS Code Configuration

For VS Code extensions that support MCP:

1. Install MCP-compatible extension
2. Configure server endpoint to your Replit URL
3. Start using the documentation tools

## 📈 Monitoring & Maintenance

### Check Server Status

```bash
# View recent logs
tail -f logs/mcp-server.log

# Check database size
ls -lah data/

# Monitor update status
sqlite3 data/moengage-docs.db "SELECT * FROM update_status ORDER BY lastUpdate DESC LIMIT 5;"
```

### Manual Operations

```bash
# Force documentation update
npm run update-docs

# Rebuild search index
npm run build && npm start

# View server statistics
sqlite3 data/moengage-docs.db "SELECT COUNT(*) as total_docs, source FROM documents GROUP BY source;"
```

## ⚙️ Configuration Options

Environment variables (automatically set by startup script):

| Variable | Default | Description |
|----------|---------|-------------|
| `SITEMAP_URLS` | All 3 sources | Comma-separated sitemap URLs |
| `UPDATE_SCHEDULE` | `0 0 2 * * 0` | Weekly update schedule |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `RATE_LIMIT_REQUESTS` | `5` | Max requests per second |
| `MAX_CONCURRENT_UPDATES` | `3` | Concurrent document processing |
| `DATABASE_PATH` | `./data/moengage-docs.db` | SQLite database location |

## 🔒 Security & Performance

### Replit-Specific Optimizations

- **Rate Limiting**: Reduced to be respectful of Replit resources
- **Concurrent Processing**: Limited to 3 simultaneous document fetches
- **Database**: SQLite for zero-configuration persistence
- **Logging**: Minimal file-based logging to preserve disk space

### Resource Usage

- **Memory**: ~100-200MB during normal operation
- **Storage**: ~50-100MB for database and logs
- **CPU**: Low usage, spikes during weekly updates
- **Network**: Respectful crawling with rate limits

## 🐛 Troubleshooting

### Common Issues

**Server won't start:**
```bash
# Check dependencies
npm ci

# Rebuild project
npm run build

# Check permissions
chmod +x start-replit.sh
```

**Database issues:**
```bash
# Reset database
rm -rf data/
mkdir data
npm start
```

**Update failures:**
- Check Replit's internet connectivity
- Verify sitemap URLs are accessible
- Review logs in `logs/mcp-server.log`

**Memory issues:**
- Reduce `MAX_CONCURRENT_UPDATES` to 1-2
- Check for memory leaks in logs
- Restart the Repl if needed

### Getting Help

1. **Logs**: Check `logs/mcp-server.log` for errors
2. **Console**: Review Replit console output
3. **Database**: Query SQLite directly for diagnostics
4. **GitHub**: Open issues on the project repository

## 🔄 Updates & Maintenance

### Automatic Updates

- Documentation is automatically refreshed weekly
- No manual intervention required for normal operation
- Updates are incremental (only changed content)

### Manual Updates

```bash
# Update documentation immediately
# (This can be done through the MCP trigger_update tool or directly)
npm run update-docs

# Update server code (if you made changes)
npm run build
npm start
```

## 📞 Support

- **Documentation**: See main README.md
- **Issues**: GitHub Issues
- **Performance**: Monitor through Replit dashboard
- **Logs**: Built-in logging with rotation

---

**🎉 Your MoEngage Documentation MCP Server is now running on Replit!**

The server will automatically index documentation from all three MoEngage sources and provide powerful search capabilities for AI assistants.