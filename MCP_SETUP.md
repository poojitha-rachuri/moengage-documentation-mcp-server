# MCP Server Setup Guide

## 🎯 The Right Way to Use MCP Servers

**MCP servers are designed for local IDE integration, NOT web hosting.** They communicate via stdin/stdout, not HTTP ports.

## 🚀 Quick Setup

### 1. Local Development (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd moengage-mcp-server

# Install dependencies
npm install

# Build the project
npm run build

# Start the MCP server
npm run start:mcp
```

### 2. IDE Configuration

#### For Claude Desktop:
1. Install Claude Desktop
2. Go to Settings → Model Context Protocol
3. Click "Add Server"
4. Configure:
   - **Name**: MoEngage Documentation
   - **Command**: `node dist/index.js`
   - **Directory**: `/path/to/your/moengage-mcp-server`

#### For Cursor:
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

#### For Claude Code:
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

## 🔧 Available MCP Tools

Once configured, you'll have access to:

1. **`search_documentation`** - Search MoEngage docs with filters
2. **`get_document`** - Get specific document by ID
3. **`list_categories`** - List all documentation categories
4. **`get_recent_updates`** - Get recently updated docs
5. **`get_update_status`** - Check last update status
6. **`trigger_update`** - Manually trigger update

## ❌ What NOT to Do

- ❌ Don't try to deploy MCP servers as web applications
- ❌ Don't expect MCP servers to work with HTTP endpoints
- ❌ Don't use Replit for MCP server hosting (it's designed for web apps)

## ✅ What TO Do

- ✅ Run MCP servers locally on your machine
- ✅ Configure your IDE to connect to the local MCP server
- ✅ Use the MCP server for IDE integration and AI assistance
- ✅ Use the HTTP server only for web API needs (separate use case)

## 🆘 Troubleshooting

### MCP Server Not Starting
```bash
# Check if Node.js is installed
node --version

# Check if dependencies are installed
npm install

# Check if build is successful
npm run build

# Check if the server starts
node dist/index.js
```

### IDE Not Connecting
1. Make sure the MCP server is running
2. Verify the path in your IDE configuration
3. Check that the `dist/index.js` file exists
4. Ensure you have the correct Node.js version (18+)

### Testing MCP Server
```bash
# Test the server manually
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/index.js
```

## 📝 Summary

- **MCP servers = Local IDE integration**
- **HTTP servers = Web deployment**
- **Use the right tool for the right job**

The MCP server is designed to enhance your AI assistant experience with MoEngage documentation, not to be deployed as a web service. 