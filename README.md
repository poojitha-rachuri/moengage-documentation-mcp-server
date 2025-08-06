# MoEngage Documentation MCP Server

A Model Context Protocol (MCP) server that provides access to MoEngage documentation through AI assistants like Claude, Cursor, and Claude Code.

## 🚀 Quick Installation

### Option 1: Easy Install (Recommended)

```bash
# Clone the repository
git clone https://github.com/poojitha-rachuri/moengage-documentation-mcp-server.git
cd moengage-documentation-mcp-server

# Run the installation script
./install.sh
```

### Option 2: Manual Install

```bash
# Clone the repository
git clone https://github.com/poojitha-rachuri/moengage-documentation-mcp-server.git
cd moengage-documentation-mcp-server

# Install dependencies
npm install

# Build the project
npm run build

# Start the MCP server
npm run start:mcp
```

## 📋 MCP Server Configuration

### For Claude Desktop:
1. Install Claude Desktop
2. Go to Settings → Model Context Protocol
3. Click "Add Server"
4. Configure:
   - **Name**: MoEngage Documentation
   - **Command**: `node dist/index.js`
   - **Directory**: Path to your project folder

### For Cursor:
1. Open Settings → Extensions → MCP
2. Add configuration:
   ```json
   {
     "mcpServers": {
       "moengage-docs": {
         "command": "node",
         "args": ["dist/index.js"],
         "cwd": "/path/to/your/moengage-mcp-server"
       }
     }
   }
   ```

### For Claude Code:
1. Open VS Code settings
2. Add to `settings.json`:
   ```json
   {
     "claude.mcpServers": {
       "moengage-docs": {
         "command": "node",
         "args": ["dist/index.js"],
         "cwd": "/path/to/your/moengage-mcp-server"
       }
     }
   }
   ```

## 🔧 Available Scripts

- `npm run start:mcp` - Start MCP server for IDE integration
- `npm run start:http` - Start HTTP server for web deployment
- `npm run deploy` - Full deployment with testing
- `npm run build` - Build TypeScript to JavaScript

## 🌐 HTTP API Endpoints (for Replit)

- `GET /` - Root endpoint (health check)
- `GET /health` - Health status
- `GET /status` - Server status and stats
- `GET /search?q=query` - Search documentation
- `POST /update` - Manual update trigger

## 📝 Important Notes

**MCP servers are designed for local IDE integration, not web hosting.** The HTTP server is provided for Replit compatibility but the primary use case is running the MCP server locally.

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build project
npm run build

# Start MCP server for development
npm run start:mcp

# Start HTTP server for testing
npm run start:http
```

## 📦 Deployment

For local MCP server usage, no deployment is needed. Just run the MCP server locally and configure your IDE to use it.

For web API usage, the HTTP server can be deployed to Replit or other platforms.

## 🔧 Available MCP Tools

Once configured, you'll have access to:

1. **`search_documentation`** - Search MoEngage docs with filters
2. **`get_document`** - Get specific document by ID
3. **`list_categories`** - List all documentation categories
4. **`get_recent_updates`** - Get recently updated docs
5. **`get_update_status`** - Check last update status
6. **`trigger_update`** - Manually trigger update

## 📚 Documentation Sources

This server indexes documentation from three primary MoEngage sources:

- **developers.moengage.com** - SDK documentation, API references, integration guides
- **help.moengage.com** - User guides, tutorials, troubleshooting, FAQs
- **partners.moengage.com** - Partner integrations, marketplace documentation

## 🚀 Features

- **Multi-Source Documentation**: Indexes from all MoEngage documentation sources
- **Comprehensive Search**: Full-text search across all documentation
- **Automatic Updates**: Weekly scheduled updates from sitemap XMLs
- **Intelligent Processing**: Converts HTML documentation to structured markdown
- **Source-Aware Filtering**: Filter by documentation source, platform, category
- **Platform-Specific Search**: Filter by Android, iOS, Web, React Native, Flutter, APIs
- **Recent Updates Tracking**: See what documentation has been recently modified
- **Manual Update Triggers**: Force immediate updates when needed
