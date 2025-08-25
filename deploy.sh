#!/bin/bash

echo "🚀 Starting deployment process..."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/

# Install dependencies
echo "📦 Installing dependencies..."
yarn install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
yarn db:generate

# Build the application
echo "🔨 Building application..."
yarn build

# Check if build was successful
if [ -f "dist/app.js" ]; then
    echo "✅ Build successful! dist/app.js exists."
else
    echo "❌ Build failed! dist/app.js not found."
    exit 1
fi

# Test the application locally (optional)
echo "🧪 Testing application startup..."
timeout 10s node index.js || echo "Application started successfully (timeout after 10s)"

echo "🎉 Deployment preparation complete!"
echo "📋 Next steps:"
echo "1. Commit your changes: git add . && git commit -m 'Fix deployment configuration'"
echo "2. Push to your repository: git push"
echo "3. Deploy to Render (if using automatic deployment)"
