# MoEngage Documentation MCP Server 🔍

A Model Context Protocol (MCP) server that provides access to MoEngage documentation through AI assistants like Claude, Cursor, and Claude Code.

## 🚀 Quick Installation

### Option 1: NPX Installation (Recommended)

```bash
# Install and run directly with npx
npx @moengage/documentation-mcp-server

# Enable specific tools only
npx @moengage/documentation-mcp-server --tools=search_documentation,get_document

# List all available tools
npx @moengage/documentation-mcp-server --list-tools
```

### Option 2: Clone and Install

```bash
# Clone the repository
git clone https://github.com/poojitha-rachuri/moengage-documentation-mcp-server.git
cd moengage-documentation-mcp-server

# Run the installation script
./install.sh
```

## 📋 MCP Server Configuration

### For Claude Desktop:

1. **Install Claude Desktop**
2. **Enable Developer Mode** from the top-left menu bar
3. **Open Settings** → **Developer Option** → **Edit Config**
4. **Add the MoEngage server configuration:**

```json
{
  "mcpServers": {
    "moengage-docs": {
      "command": "npx",
      "args": ["-y", "@moengage/documentation-mcp-server"],
      "env": {}
    }
  }
}
```

**Enable specific tools:**
```json
{
  "mcpServers": {
    "moengage-docs": {
      "command": "npx",
      "args": [
        "-y", 
        "@moengage/documentation-mcp-server",
        "--tools=search_documentation,get_document,list_categories"
      ],
      "env": {}
    }
  }
}
```

### For Cursor:

1. **Open Settings** → **Extensions** → **MCP**
2. **Add configuration:**

```json
{
  "mcpServers": {
    "moengage-docs": {
      "command": "npx",
      "args": ["-y", "@moengage/documentation-mcp-server"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### For Claude Code:

1. **Open VS Code settings**
2. **Add to `settings.json`:**

```json
{
  "claude.mcpServers": {
    "moengage-docs": {
      "command": "npx",
      "args": ["-y", "@moengage/documentation-mcp-server"]
    }
  }
}
```

## 🔧 Available Tools

The MoEngage MCP server includes the following tools:

- **`search_documentation`** - Search MoEngage docs with filters and ranking
- **`get_document`** - Get specific document by ID with full content
- **`list_categories`** - List all documentation categories and platforms
- **`get_recent_updates`** - Get recently updated documentation
- **`get_update_status`** - Check last update status and statistics
- **`trigger_update`** - Manually trigger documentation update

### Tool Selection

You can choose which tools to enable by adding the `--tools` parameter:

```bash
# Enable only search and get document
npx @moengage/documentation-mcp-server --tools=search_documentation,get_document

# Enable all tools (default)
npx @moengage/documentation-mcp-server --tools=search_documentation,get_document,list_categories,get_recent_updates,get_update_status,trigger_update
```

## 📚 Documentation Sources

This server automatically indexes documentation from three primary MoEngage sources:

- **developers.moengage.com** - SDK documentation, API references, integration guides
- **help.moengage.com** - User guides, tutorials, troubleshooting, FAQs
- **partners.moengage.com** - Partner integrations, marketplace documentation

## 🚀 Features

- **Multi-Source Documentation**: Indexes from all MoEngage documentation sources
- **Comprehensive Search**: Full-text search across all documentation with relevance scoring
- **Automatic Updates**: Weekly scheduled updates from sitemap XMLs
- **Intelligent Processing**: Converts HTML documentation to structured markdown
- **Source-Aware Filtering**: Filter by documentation source, platform, category
- **Platform-Specific Search**: Filter by Android, iOS, Web, React Native, Flutter, APIs
- **Recent Updates Tracking**: See what documentation has been recently modified
- **Manual Update Triggers**: Force immediate updates when needed
- **Easy Installation**: One-command installation via npx

## 🔄 Automatic Updates

The MCP server automatically:

1. **Fetches sitemaps** from all MoEngage documentation sources
2. **Crawls all articles** and extracts content
3. **Processes and indexes** documentation in SQLite database
4. **Runs weekly updates** to keep documentation current
5. **Tracks changes** and provides update status

## 🛠️ Development

```bash
# Clone and setup
git clone https://github.com/poojitha-rachuri/moengage-documentation-mcp-server.git
cd moengage-documentation-mcp-server

# Install dependencies
npm install

# Build project
npm run build

# Start MCP server for development
npm start

# Start HTTP server for testing
npm run start:http
```

## 📦 Deployment

### For Local MCP Usage:
No deployment needed! Just run with npx:
```bash
npx @moengage/documentation-mcp-server
```

### For Web API Usage:
The HTTP server can be deployed to Replit or other platforms:
```bash
npm run start:http
```

## 🔧 Troubleshooting

### Common Issues:

1. **Server Not Found**
   - Verify npx is working: `npx --version`
   - Check Claude Desktop configuration syntax
   - Restart Claude Desktop completely

2. **No Results Found**
   - Run manual update: Use `trigger_update` tool
   - Check update status: Use `get_update_status` tool

3. **Connection Issues**
   - Restart your IDE completely
   - Check that the MCP server is running
   - Verify configuration syntax

## 📝 Important Notes

**MCP servers are designed for local IDE integration, not web hosting.** The HTTP server is provided for Replit compatibility but the primary use case is running the MCP server locally with your IDE.

## 🎯 Usage Examples

Once configured, you can ask your AI assistant:

- "Search for Android SDK integration guides"
- "Get the latest documentation on iOS push notifications"
- "Show me recent updates to the Web SDK"
- "List all API documentation categories"
- "Check when the documentation was last updated"
