#!/bin/bash

echo "🚀 Installing MoEngage Documentation MCP Server..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js is not installed. Please install Node.js 18+ first.${NC}"
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}Node.js version 18+ is required. Current version: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}"

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

# Build the project
echo -e "${BLUE}🔨 Building project...${NC}"
npm run build

# Create data directory
echo -e "${BLUE}📁 Setting up data directory...${NC}"
mkdir -p data

# Test the MCP server
echo -e "${BLUE}🧪 Testing MCP server...${NC}"
timeout 5s node dist/index.js &
SERVER_PID=$!
sleep 2

# Test with a simple MCP request
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/index.js > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ MCP server is working correctly!${NC}"
else
    echo -e "${YELLOW}⚠ MCP server test failed, but installation completed${NC}"
fi

# Kill test server
kill $SERVER_PID 2>/dev/null || true

echo ""
echo -e "${GREEN}🎉 Installation completed!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo ""
echo "1. Configure your IDE:"
echo ""
echo "   For Claude Desktop:"
echo "   - Go to Settings → Model Context Protocol"
echo "   - Add Server:"
echo "     Name: MoEngage Documentation"
echo "     Command: npx @moengage/documentation-mcp-server"
echo ""
echo "   For Cursor:"
echo "   - Open Settings → Extensions → MCP"
echo "   - Add configuration:"
echo "     {"
echo "       \"mcpServers\": {"
echo "         \"moengage-docs\": {"
echo "           \"command\": \"npx\","
echo "           \"args\": [\"-y\", \"@moengage/documentation-mcp-server\"]"
echo "         }"
echo "       }"
echo "     }"
echo ""
echo "2. Available tools:"
echo "   - search_documentation"
echo "   - get_document"
echo "   - list_categories"
echo "   - get_recent_updates"
echo "   - get_update_status"
echo "   - trigger_update"
echo ""
echo -e "${GREEN}✨ Your MoEngage Documentation MCP Server is ready!${NC}" 