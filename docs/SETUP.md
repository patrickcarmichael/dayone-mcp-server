# Setup Guide

Quick start guide for setting up the Day One Remote MCP Server.

## Overview

This project provides a **remote MCP server** for Day One using Cloudflare Workers. Unlike the local stdio-based server bundled with Day One, this allows you to access your Day One journals from anywhere through a secure remote connection.

## Quick Start (5 Steps)

### 1. Install Prerequisites

```bash
# Install Node.js (if not already installed)
brew install node

# Install Cloudflare Tunnel
brew install cloudflare/cloudflare/cloudflared

# Install Wrangler CLI
npm install -g wrangler

# Verify Day One CLI is installed
/usr/local/bin/dayone --version
# If not, install it:
# sudo bash /Applications/Day\ One.app/Contents/Resources/install_cli.sh
```

### 2. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-username/dayone-mcp-server.git
cd dayone-mcp-server

# Install dependencies
npm install
```

### 3. Configure Bridge Service

```bash
cd bridge

# Create environment file
cp .env.example .env

# Generate a secure token
openssl rand -base64 32

# Edit .env and set AUTH_TOKEN to the generated token
nano .env
```

Example `.env`:
```env
PORT=3000
AUTH_TOKEN=abc123...  # Your generated token
DAYONE_CLI_PATH=/usr/local/bin/dayone
```

### 4. Set Up Cloudflare Tunnel

```bash
# Authenticate with Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create dayone-bridge

# Note the tunnel ID that's displayed!

# Create config file
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Add to `config.yml`:
```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /Users/YOUR_USERNAME/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: YOUR_TUNNEL_ID.cfargotunnel.com
    service: http://localhost:3000
  - service: http_status:404
```

```bash
# Create DNS record
cloudflared tunnel route dns dayone-bridge YOUR_TUNNEL_ID.cfargotunnel.com

# Install as service
sudo cloudflared service install
```

### 5. Deploy Cloudflare Worker

```bash
cd ../worker

# Login to Cloudflare
wrangler login

# Set secrets
wrangler secret put MCP_API_KEYS
# Enter: (generate with: openssl rand -base64 32)

wrangler secret put BRIDGE_URL
# Enter: https://YOUR_TUNNEL_ID.cfargotunnel.com

wrangler secret put BRIDGE_AUTH_TOKEN
# Enter: (same as bridge AUTH_TOKEN)

# Deploy
npm run deploy
```

## Configuration

### Day One Journal Access

1. Open **Day One** on your Mac
2. **Preferences → Labs**
3. Enable **"Mac CLI MCP Server"**
4. Click **"MCP Access Control"**
5. Enable access for desired journals

### MCP Client Setup

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dayone": {
      "url": "https://dayone-mcp-server.YOUR_ACCOUNT.workers.dev",
      "transport": {
        "type": "http"
      },
      "headers": {
        "Authorization": "Bearer YOUR_MCP_API_KEY"
      }
    }
  }
}
```

#### Claude Code CLI

```bash
claude mcp add \
  --scope user \
  --transport http \
  --header "Authorization: Bearer YOUR_MCP_API_KEY" \
  dayone \
  https://dayone-mcp-server.YOUR_ACCOUNT.workers.dev
```

## Starting Services

### Bridge Service

Development:
```bash
cd bridge
npm run dev
```

Production (build first):
```bash
npm run build
npm start
```

Or use Launch Agent (see DEPLOYMENT.md for setup).

### Cloudflare Tunnel

```bash
# Start manually
cloudflared tunnel run dayone-bridge

# Or if installed as service
sudo launchctl start com.cloudflare.cloudflared
```

## Testing

### 1. Test Bridge Service

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "dayoneAvailable": true,
  "version": "1.0.0"
}
```

### 2. Test Tunnel

```bash
curl https://YOUR_TUNNEL_ID.cfargotunnel.com/health
```

Should return the same response as above.

### 3. Test Worker

```bash
curl -X POST https://dayone-mcp-server.YOUR_ACCOUNT.workers.dev \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_MCP_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {}
  }'
```

### 4. Test MCP Tools

Using your MCP client:
```
"List my Day One journals"
"Create a test journal entry"
"Search for entries about vacation"
```

## Common Issues

### Port already in use

```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 PID
```

### Day One CLI not found

```bash
# Install CLI
sudo bash /Applications/Day\ One.app/Contents/Resources/install_cli.sh

# Verify
which dayone
/usr/local/bin/dayone --version
```

### Tunnel not connecting

```bash
# Check status
cloudflared tunnel info dayone-bridge

# View logs
sudo tail -f /Library/Logs/com.cloudflare.cloudflared.err.log

# Restart service
sudo launchctl stop com.cloudflare.cloudflared
sudo launchctl start com.cloudflare.cloudflared
```

### Worker deployment fails

```bash
# Check authentication
wrangler whoami

# Verify secrets are set
wrangler secret list

# Check wrangler.toml configuration
```

## Security Best Practices

1. **Use strong tokens**: Generate with `openssl rand -base64 32`
2. **Keep secrets secure**: Never commit `.env` or secrets to git
3. **Limit journal access**: Only enable MCP access for necessary journals
4. **Monitor logs**: Regularly check for unusual activity
5. **Update regularly**: Keep dependencies and services updated

## File Structure

```
dayone-mcp-server/
├── bridge/           # Local bridge service
│   ├── src/
│   ├── .env         # Configuration (not in git)
│   └── package.json
├── worker/          # Cloudflare Worker
│   ├── src/
│   ├── wrangler.toml
│   └── package.json
├── shared/          # Shared types
│   └── types.ts
└── docs/           # Documentation
    ├── SETUP.md
    ├── DEPLOYMENT.md
    └── CLOUDFLARE_TUNNEL_SETUP.md
```

## Next Steps

- Review [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- Read [CLOUDFLARE_TUNNEL_SETUP.md](CLOUDFLARE_TUNNEL_SETUP.md) for advanced tunnel configuration
- Configure monitoring and alerting
- Set up automatic backups

## Getting Help

- Check the [Troubleshooting](#common-issues) section
- Review component logs
- Open an issue on GitHub
- Check Day One documentation

## Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Day One](https://dayoneapp.com/)
