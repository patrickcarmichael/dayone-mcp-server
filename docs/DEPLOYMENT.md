# Deployment Guide

Complete guide to deploying the Day One MCP Server with Cloudflare Workers.

## Architecture Overview

```
┌─────────────────┐
│  MCP Client     │ (Claude Desktop, anywhere)
└────────┬────────┘
         │ HTTPS + API Key
         ▼
┌──────────────────────────┐
│  Cloudflare Worker       │ (Global Edge)
│  - MCP Protocol          │
│  - Authentication        │
│  - Rate Limiting         │
└────────┬─────────────────┘
         │ HTTPS via Tunnel
         ▼
┌──────────────────────────┐
│  Bridge Service          │ (Your Mac)
│  - Day One CLI Wrapper   │
│  - HTTP API              │
└────────┬─────────────────┘
         │ CLI Commands
         ▼
┌──────────────────────────┐
│  Day One App + CLI       │ (Your Mac)
└──────────────────────────┘
```

## Prerequisites

### On Your Mac

- **macOS** (Day One requirement)
- **Day One for Mac** - Install from [Mac App Store](https://apps.apple.com/us/app/day-one/id1055511498)
- **Day One CLI** - Install via:
  ```bash
  sudo bash /Applications/Day\ One.app/Contents/Resources/install_cli.sh
  ```
- **Node.js 18+** - For running the bridge service
- **Homebrew** - For installing cloudflared

### Cloudflare Account

- Free Cloudflare account
- `wrangler` CLI installed globally:
  ```bash
  npm install -g wrangler
  ```

## Step-by-Step Deployment

### Part 1: Local Bridge Service

#### 1. Install Dependencies

```bash
cd bridge
npm install
```

#### 2. Configure Environment

Create `.env` from the example:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000
AUTH_TOKEN=<generate-secure-token>
DAYONE_CLI_PATH=/usr/local/bin/dayone
```

Generate a secure auth token:

```bash
openssl rand -base64 32
```

#### 3. Test the Bridge Service

Start in development mode:

```bash
npm run dev
```

Test health endpoint:

```bash
curl http://localhost:3000/health
```

You should see:
```json
{
  "status": "ok",
  "dayoneAvailable": true,
  "version": "1.0.0"
}
```

#### 4. Configure Day One Access

1. Open **Day One** on your Mac
2. Go to **Preferences → Labs**
3. Enable **"Mac CLI MCP Server"**
4. Click **"MCP Access Control"**
5. Toggle on journals you want to make accessible

#### 5. Test Day One Integration

```bash
curl -X POST http://localhost:3000/bridge \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "action": "list_journals",
    "params": {}
  }'
```

You should see your journals listed.

### Part 2: Cloudflare Tunnel

Follow the detailed setup in [CLOUDFLARE_TUNNEL_SETUP.md](CLOUDFLARE_TUNNEL_SETUP.md).

Quick summary:

```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create dayone-bridge

# Configure tunnel (edit ~/.cloudflared/config.yml)

# Create DNS record
cloudflared tunnel route dns dayone-bridge <tunnel-id>.cfargotunnel.com

# Test tunnel
cloudflared tunnel run dayone-bridge

# Install as service
sudo cloudflared service install
```

### Part 3: Cloudflare Worker

#### 1. Install Dependencies

```bash
cd worker
npm install
```

#### 2. Authenticate with Cloudflare

```bash
wrangler login
```

#### 3. Configure Worker

Edit `wrangler.toml` and add your account ID:

```toml
account_id = "your-cloudflare-account-id"
```

Find your account ID in the Cloudflare dashboard URL or by running:
```bash
wrangler whoami
```

#### 4. Set Secrets

Set the required environment variables:

```bash
# MCP API keys (comma-separated if multiple)
wrangler secret put MCP_API_KEYS
# Enter: <your-api-key-for-mcp-clients>

# Bridge URL (your tunnel URL)
wrangler secret put BRIDGE_URL
# Enter: https://<tunnel-id>.cfargotunnel.com

# Bridge auth token (same as bridge .env)
wrangler secret put BRIDGE_AUTH_TOKEN
# Enter: <same-token-as-bridge-env>
```

Generate MCP API keys:
```bash
openssl rand -base64 32
```

#### 5. Test Locally

```bash
npm run dev
```

Test the worker:

```bash
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_MCP_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {}
  }'
```

#### 6. Deploy to Production

```bash
npm run deploy
```

Note your worker URL (e.g., `https://dayone-mcp-server.your-account.workers.dev`)

### Part 4: MCP Client Configuration

#### For Claude Desktop

Create or edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dayone-remote": {
      "url": "https://dayone-mcp-server.your-account.workers.dev",
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

Restart Claude Desktop.

#### For Claude Code CLI

```bash
claude mcp add \
  --scope user \
  --transport http \
  --header "Authorization: Bearer YOUR_MCP_API_KEY" \
  dayone-remote \
  https://dayone-mcp-server.your-account.workers.dev
```

#### For Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "dayone-remote": {
      "url": "https://dayone-mcp-server.your-account.workers.dev",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_API_KEY"
      }
    }
  }
}
```

## Verification

### 1. Check All Components

```bash
# Bridge service
curl http://localhost:3000/health

# Tunnel
curl https://<tunnel-id>.cfargotunnel.com/health

# Worker
curl https://dayone-mcp-server.your-account.workers.dev/health \
  -H "Authorization: Bearer YOUR_MCP_API_KEY"
```

### 2. Test MCP Flow

Use your MCP client to test:

```
"Show me all my Day One journals"
"Create a journal entry about testing the MCP server"
"What did I write last week?"
```

## Production Considerations

### 1. Keep Services Running

#### Bridge Service (systemd on macOS alternative)

Create a Launch Agent at `~/Library/LaunchAgents/com.dayone.bridge.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.dayone.bridge</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/dayone-mcp-server/bridge/dist/server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/dayone-mcp-server/bridge</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/dayone-bridge.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/dayone-bridge-error.log</string>
</dict>
</plist>
```

Load the agent:
```bash
launchctl load ~/Library/LaunchAgents/com.dayone.bridge.plist
```

#### Cloudflare Tunnel

Already configured as a service in the tunnel setup.

### 2. Monitoring

#### Bridge Service Logs

```bash
tail -f /tmp/dayone-bridge.log
```

#### Tunnel Logs

```bash
sudo tail -f /Library/Logs/com.cloudflare.cloudflared.err.log
```

#### Worker Logs

View in Cloudflare dashboard or use:
```bash
wrangler tail
```

### 3. Security Checklist

- [ ] Strong AUTH_TOKEN set for bridge
- [ ] Strong MCP_API_KEYS set for worker
- [ ] BRIDGE_AUTH_TOKEN matches between bridge and worker
- [ ] Day One password lock disabled (or plan to start services manually)
- [ ] Journal MCP access control configured
- [ ] Tunnel credentials file secured (chmod 600)
- [ ] Rate limiting enabled in worker
- [ ] CORS configured appropriately

### 4. Backup

Regularly backup:
- Bridge service `.env` configuration
- Worker secrets (document them securely)
- Tunnel configuration (`~/.cloudflared/config.yml`)
- Tunnel credentials file

## Troubleshooting

### Bridge service not starting

```bash
# Check logs
tail -f /tmp/dayone-bridge.log

# Check Day One CLI
/usr/local/bin/dayone --version

# Check port availability
lsof -i :3000
```

### Tunnel connection issues

```bash
# Check tunnel status
cloudflared tunnel info dayone-bridge

# Test bridge locally
curl http://localhost:3000/health

# Restart tunnel
sudo launchctl stop com.cloudflare.cloudflared
sudo launchctl start com.cloudflare.cloudflared
```

### Worker not responding

```bash
# View worker logs
wrangler tail

# Check secrets are set
wrangler secret list

# Test locally
npm run dev
```

### MCP client can't connect

1. Verify worker URL is correct
2. Check API key is correct
3. Test worker directly with curl
4. Check MCP client logs

## Updating

### Update Bridge Service

```bash
cd bridge
git pull
npm install
npm run build
# Restart the service
launchctl unload ~/Library/LaunchAgents/com.dayone.bridge.plist
launchctl load ~/Library/LaunchAgents/com.dayone.bridge.plist
```

### Update Worker

```bash
cd worker
git pull
npm install
npm run deploy
```

## Cost Estimate

- **Cloudflare Workers**: Free tier (100,000 requests/day)
- **Cloudflare Tunnel**: Free
- **Day One**: Existing subscription
- **Infrastructure**: None (runs on your Mac)

**Total cost**: $0/month (within free tiers)

## Next Steps

- Set up monitoring/alerting
- Configure custom domain for worker
- Set up Cloudflare Access for additional security
- Configure automatic backups
- Set up log aggregation

## Support

For issues:
- Check troubleshooting section above
- Review component logs
- Open an issue in the GitHub repository
