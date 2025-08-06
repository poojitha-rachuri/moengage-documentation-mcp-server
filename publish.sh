#!/bin/bash

echo "🚀 Publishing MoEngage Documentation MCP Server to npm..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're logged into npm
if ! npm whoami &> /dev/null; then
    echo -e "${RED}❌ Not logged into npm. Please run 'npm login' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Logged into npm as $(npm whoami)${NC}"

# Build the project
echo -e "${BLUE}🔨 Building project...${NC}"
npm run build

# Check if build was successful
if [ ! -f "dist/index.js" ]; then
    echo -e "${RED}❌ Build failed. dist/index.js not found.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build completed successfully${NC}"

# Test the MCP server
echo -e "${BLUE}🧪 Testing MCP server...${NC}"
timeout 5s node dist/index.js &
SERVER_PID=$!
sleep 2

# Test with a simple MCP request
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/index.js > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ MCP server test passed${NC}"
else
    echo -e "${YELLOW}⚠ MCP server test failed, but continuing...${NC}"
fi

# Kill test server
kill $SERVER_PID 2>/dev/null || true

# Check current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}📦 Current version: ${CURRENT_VERSION}${NC}"

# Ask for new version
echo -e "${BLUE}📝 Enter new version (or press Enter to keep current):${NC}"
read -r NEW_VERSION

if [ -z "$NEW_VERSION" ]; then
    NEW_VERSION=$CURRENT_VERSION
fi

# Update version in package.json
npm version $NEW_VERSION --no-git-tag-version

echo -e "${BLUE}📤 Publishing to npm...${NC}"
npm publish

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 Successfully published @moengage/documentation-mcp-server@${NEW_VERSION}${NC}"
    echo ""
    echo -e "${BLUE}📋 Installation instructions:${NC}"
    echo ""
    echo "Users can now install your MCP server with:"
    echo ""
    echo "1. Clone the repository:"
    echo "   git clone https://github.com/poojitha-rachuri/moengage-documentation-mcp-server.git"
    echo ""
    echo "2. Run the installation script:"
    echo "   ./install.sh"
    echo ""
    echo "3. Configure their IDE to use the MCP server"
    echo ""
    echo -e "${GREEN}✨ Your MCP server is now available for easy installation!${NC}"
else
    echo -e "${RED}❌ Failed to publish to npm${NC}"
    exit 1
fi 