#!/bin/bash

echo "🚀 Starting MoEngage MCP Server deployment..."

# Exit on any error
set -e

# Clean up any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "node.*http-server" || true
pkill -f "npm.*start" || true

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

# Create data directory if it doesn't exist
echo "📁 Setting up data directory..."
mkdir -p data

# Start the HTTP server
echo "🔥 Starting HTTP server..."
echo "🌐 Server will be available at:"
echo "   - Root: http://localhost:3000/"
echo "   - Health: http://localhost:3000/health"
echo "   - Status: http://localhost:3000/status"
echo "   - Search: http://localhost:3000/search?q=android"

# Start the server in the background and capture PID
node dist/http-server.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 5

# Test the server
echo "🧪 Testing server..."
if curl -s http://localhost:3000/ > /dev/null; then
    echo "✅ Server is running successfully!"
    echo "🎉 Deployment completed!"
    
    # Keep the server running
    echo "🔄 Server is running in background (PID: $SERVER_PID)"
    echo "📝 To stop the server, run: kill $SERVER_PID"
    
    # Wait for the server process
    wait $SERVER_PID
else
    echo "❌ Server test failed"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi