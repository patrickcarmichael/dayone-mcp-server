#!/bin/bash

# Deploy script for Cloudflare Worker

set -e

echo "🚀 Day One MCP Server - Worker Deployment"
echo "=========================================="
echo ""

cd "$(dirname "$0")/../worker"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler not found. Installing..."
    npm install -g wrangler
fi

echo "✅ Wrangler found"

# Check authentication
echo ""
echo "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "Not authenticated. Please login:"
    wrangler login
else
    echo "✅ Authenticated as: $(wrangler whoami 2>&1 | grep 'You are logged in')"
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install
echo "✅ Dependencies installed"

# Check if secrets are set
echo ""
echo "Checking required secrets..."

SECRETS_SET=true

if ! wrangler secret list 2>&1 | grep -q "MCP_API_KEYS"; then
    echo "⚠️  MCP_API_KEYS not set"
    SECRETS_SET=false
fi

if ! wrangler secret list 2>&1 | grep -q "BRIDGE_URL"; then
    echo "⚠️  BRIDGE_URL not set"
    SECRETS_SET=false
fi

if ! wrangler secret list 2>&1 | grep -q "BRIDGE_AUTH_TOKEN"; then
    echo "⚠️  BRIDGE_AUTH_TOKEN not set"
    SECRETS_SET=false
fi

if [ "$SECRETS_SET" = false ]; then
    echo ""
    echo "❌ Required secrets are missing. Please set them:"
    echo ""
    echo "wrangler secret put MCP_API_KEYS"
    echo "wrangler secret put BRIDGE_URL"
    echo "wrangler secret put BRIDGE_AUTH_TOKEN"
    echo ""
    exit 1
fi

echo "✅ All required secrets are set"

# Deploy
echo ""
echo "Deploying to Cloudflare Workers..."
npm run deploy

echo ""
echo "🎉 Worker deployed successfully!"
echo ""
echo "Your worker URL:"
wrangler deployments list 2>&1 | grep "https://" | head -n 1 || echo "Check Cloudflare dashboard for URL"
echo ""
echo "Next steps:"
echo "1. Test the worker with curl (see DEPLOYMENT.md)"
echo "2. Configure your MCP client (see SETUP.md)"
echo "3. Start using Day One with your AI assistant!"
echo ""
