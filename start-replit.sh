#!/bin/bash

# MoEngage Documentation MCP Server - Replit Startup Script
set -e

echo "🚀 Starting MoEngage Documentation MCP Server on Replit..."

# Create necessary directories
mkdir -p data logs

# Set default environment variables for Replit
export DATABASE_PATH="./data/moengage-docs.db"
export LOG_LEVEL="info"
export LOG_FILE="./logs/mcp-server.log"
export SITEMAP_URLS="https://developers.moengage.com/hc/sitemap.xml,https://help.moengage.com/hc/sitemap.xml,https://partners.moengage.com/hc/sitemap.xml"
export UPDATE_SCHEDULE="0 0 2 * * 0"  # Every Sunday at 2 AM
export RATE_LIMIT_REQUESTS=5
export MAX_CONCURRENT_UPDATES=3
export FORCE_UPDATE_ON_START=false

# Copy environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📄 Creating .env file from template..."
    cp .env.example .env
fi

# Clean install dependencies for compatibility
echo "📦 Installing/updating dependencies..."
rm -rf node_modules package-lock.json
npm install

# Build if dist directory doesn't exist
if [ ! -d "dist" ]; then
    echo "🏗️  Building TypeScript..."
    npm run build
fi

# Display configuration
echo ""
echo "⚙️  Configuration:"
echo "  Database: ${DATABASE_PATH}"
echo "  Log Level: ${LOG_LEVEL}"
echo "  Sources: developers.moengage.com, help.moengage.com, partners.moengage.com"
echo "  Update Schedule: ${UPDATE_SCHEDULE}"
echo ""

# Start the server
echo "🔥 Starting MCP server..."
node dist/index.js