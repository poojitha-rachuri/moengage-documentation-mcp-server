#!/bin/bash

echo "🚀 Starting MoEngage MCP Server..."

# Exit on any error
set -e

# Clean up any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "node.*index.js" || true

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the project
echo "🔨 Building project..."
npm run build

# Create data directory if it doesn't exist
echo "📁 Setting up data directory..."
mkdir -p data

# Start the MCP server
echo "🔥 Starting MCP server..."
echo "📡 MCP server will be available via stdin/stdout"
echo "🔗 For IDE integration, use: node dist/index.js"

# Start the MCP server (this will run in foreground)
node dist/index.js 