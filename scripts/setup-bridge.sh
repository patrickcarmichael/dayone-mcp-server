#!/bin/bash

# Setup script for Day One Bridge Service

set -e

echo "🌉 Day One Bridge Service - Setup"
echo "=================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi
echo "✅ Node.js found: $(node --version)"

# Check Day One CLI
if ! command -v dayone &> /dev/null; then
    echo "❌ Day One CLI not found."
    echo "Please install it by running:"
    echo "sudo bash /Applications/Day\\ One.app/Contents/Resources/install_cli.sh"
    exit 1
fi
echo "✅ Day One CLI found: $(dayone --version 2>&1 | head -n 1)"

# Install dependencies
echo ""
echo "Installing dependencies..."
cd "$(dirname "$0")/../bridge"
npm install
echo "✅ Dependencies installed"

# Setup .env file
echo ""
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env

    # Generate token
    TOKEN=$(openssl rand -base64 32)

    # Update .env with generated token
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/your-secure-token-here/$TOKEN/" .env
    else
        sed -i "s/your-secure-token-here/$TOKEN/" .env
    fi

    echo "✅ .env file created with generated token"
    echo ""
    echo "📝 Your AUTH_TOKEN:"
    echo "$TOKEN"
    echo ""
    echo "⚠️  Save this token! You'll need it for the Worker configuration."
else
    echo "⚠️  .env file already exists, skipping..."
fi

# Build the project
echo ""
echo "Building project..."
npm run build
echo "✅ Build complete"

# Test the service
echo ""
echo "Testing bridge service..."
npm start &
PID=$!
sleep 3

# Test health endpoint
HEALTH=$(curl -s http://localhost:3000/health || echo "failed")
kill $PID 2>/dev/null || true

if [[ $HEALTH == *"ok"* ]]; then
    echo "✅ Bridge service is working!"
else
    echo "❌ Bridge service test failed"
    exit 1
fi

echo ""
echo "🎉 Bridge service setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure Day One journal access (see SETUP.md)"
echo "2. Set up Cloudflare Tunnel (see CLOUDFLARE_TUNNEL_SETUP.md)"
echo "3. Deploy Cloudflare Worker (see DEPLOYMENT.md)"
echo ""
echo "To start the bridge service:"
echo "  cd bridge && npm start"
echo ""
