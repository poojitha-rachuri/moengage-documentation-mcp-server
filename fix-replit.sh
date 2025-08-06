#!/bin/bash

echo "🔧 Fixing Replit recovery mode issues..."

# Clean up any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "node.*http-server" || true
pkill -f "npm.*start" || true

# Clear npm cache
echo "🗑️  Clearing npm cache..."
npm cache clean --force

# Remove node_modules and reinstall
echo "📦 Reinstalling dependencies..."
rm -rf node_modules package-lock.json
npm install

# Build the project
echo "🔨 Building project..."
npm run build

# Test the HTTP server
echo "🧪 Testing HTTP server..."
timeout 10s node dist/http-server.js &
SERVER_PID=$!

sleep 5

# Test the root endpoint
if curl -s http://localhost:3000/ > /dev/null; then
    echo "✅ HTTP server is working correctly!"
    echo "🌐 Root endpoint: http://localhost:3000/"
    echo "🏥 Health check: http://localhost:3000/health"
    echo "📊 Status: http://localhost:3000/status"
    echo "🔍 Search: http://localhost:3000/search?q=android"
else
    echo "❌ HTTP server test failed"
fi

# Kill the test server
kill $SERVER_PID 2>/dev/null || true

echo "🎉 Replit fix script completed!"
echo ""
echo "Next steps:"
echo "1. Sync your Replit with the updated repository"
echo "2. The deployment should now work without nix errors"
echo "3. Once deployed successfully, we can upgrade back to Node.js 20" 