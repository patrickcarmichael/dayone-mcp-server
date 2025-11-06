#!/bin/bash

# Generate secure tokens for Day One MCP Server

echo "🔐 Day One MCP Server - Token Generator"
echo "========================================"
echo ""

echo "Generating secure tokens..."
echo ""

echo "📝 BRIDGE_AUTH_TOKEN (for bridge service and worker):"
BRIDGE_TOKEN=$(openssl rand -base64 32)
echo "$BRIDGE_TOKEN"
echo ""

echo "🔑 MCP_API_KEY (for MCP clients):"
MCP_KEY=$(openssl rand -base64 32)
echo "$MCP_KEY"
echo ""

echo "✅ Tokens generated successfully!"
echo ""
echo "Next steps:"
echo "1. Add BRIDGE_AUTH_TOKEN to bridge/.env as AUTH_TOKEN"
echo "2. Set BRIDGE_AUTH_TOKEN as Worker secret:"
echo "   cd worker && wrangler secret put BRIDGE_AUTH_TOKEN"
echo ""
echo "3. Set MCP_API_KEY as Worker secret:"
echo "   cd worker && wrangler secret put MCP_API_KEYS"
echo ""
echo "4. Use MCP_API_KEY in your MCP client configuration"
echo ""
