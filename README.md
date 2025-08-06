# MoEngage Documentation MCP Server

A Model Context Protocol (MCP) server that provides access to MoEngage documentation through AI assistants like Claude, Cursor, and Claude Code.

## 🚀 Quick Start

### For Local Development (IDE Integration)

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the MCP server
npm run start:mcp
```

### For Replit Deployment (HTTP API)

```bash
# Start the HTTP server for web deployment
npm run start:http
```

## 📋 MCP Server Configuration

### For Claude Desktop:
1. Install Claude Desktop
2. Go to Settings → Model Context Protocol
3. Add Server:
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
         "cwd": "/path/to/your/project"
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
         "cwd": "/path/to/your/project"
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

**MCP servers are designed for local IDE integration, not web hosting.** The HTTP server is provided for Replit compatibility but the primary use case is running the MCP server locally with your IDE.

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
