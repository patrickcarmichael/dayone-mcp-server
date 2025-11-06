# Day One Remote MCP Server

A **remote** Model Context Protocol (MCP) server that provides AI assistants with programmatic access to Day One journals from anywhere using Cloudflare Workers.

## What is this?

This is a **custom remote MCP server** for Day One that allows you to access your journals from any MCP client, anywhere in the world. Unlike the official Day One MCP server (which runs locally via stdio), this implementation uses:

- **Cloudflare Workers** - Global edge deployment for fast, reliable access
- **Cloudflare Tunnel** - Secure connection to your local Day One data
- **HTTP Transport** - Remote access via HTTPS endpoints
- **Token Authentication** - Secure API key-based access control

**This repository provides:**
- 🌐 Remote MCP server implementation
- 🔐 Secure authentication and rate limiting
- 🚀 One-command deployment scripts
- 📖 Complete setup and deployment documentation

**Capabilities:**
- 📝 Programmatic journal entry creation and updates
- 🔍 Full-text search across journal entries
- 🏷️ Tag and metadata management
- 📅 Date-based entry retrieval and filtering
- 🌍 Access from anywhere with internet connection

## Architecture

```
┌─────────────────┐
│  MCP Client     │ (Claude Desktop, anywhere)
└────────┬────────┘
         │ HTTPS + API Key
         ▼
┌──────────────────────────┐
│  Cloudflare Worker       │ (Global Edge)
│  - MCP Protocol Handler  │
│  - Authentication        │
│  - Rate Limiting         │
└────────┬─────────────────┘
         │ Cloudflare Tunnel (HTTPS)
         ▼
┌──────────────────────────┐
│  Bridge Service          │ (Your Mac)
│  - Day One CLI Wrapper   │
│  - Local HTTP Server     │
└────────┬─────────────────┘
         │ CLI Commands
         ▼
┌──────────────────────────┐
│  Day One App + CLI       │ (Your Mac)
└──────────────────────────┘
```

## Why Remote MCP?

The official Day One MCP server uses stdio transport, which only works locally. This remote implementation provides:

- ✅ **Access from anywhere** - Not limited to your local machine
- ✅ **Multiple devices** - Use from any MCP client with the API key
- ✅ **Cloud integration** - Works with cloud-hosted AI assistants
- ✅ **Better security** - Token-based auth and rate limiting
- ✅ **Zero cost** - Runs on Cloudflare's free tier
- ✅ **No port forwarding** - Uses Cloudflare Tunnel

## Requirements

### On Your Mac
- **macOS** - For running Day One
- **Day One for Mac** - [Mac App Store](https://apps.apple.com/us/app/day-one/id1055511498?mt=12)
- **Day One CLI** - Installed from Day One app
- **Node.js 18+** - For running the bridge service
- **Homebrew** - For installing cloudflared

### Cloudflare
- Free Cloudflare account
- `wrangler` CLI (installed automatically)

## Quick Start

### 1. Install Prerequisites

```bash
# Install Node.js
brew install node

# Install Cloudflare Tunnel
brew install cloudflare/cloudflare/cloudflared

# Install Wrangler
npm install -g wrangler

# Install Day One CLI
sudo bash /Applications/Day\ One.app/Contents/Resources/install_cli.sh
```

### 2. Clone and Setup

```bash
# Clone repository
git clone https://github.com/your-username/dayone-mcp-server.git
cd dayone-mcp-server

# Run automated setup
./scripts/setup-bridge.sh
```

### 3. Configure Cloudflare Tunnel

```bash
# Authenticate with Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create dayone-bridge

# Configure tunnel (follow prompts)
# See docs/CLOUDFLARE_TUNNEL_SETUP.md for details
```

### 4. Deploy Worker

```bash
# Set secrets and deploy
./scripts/deploy-worker.sh
```

### 5. Configure Day One Access

1. Open **Day One** → **Preferences** → **Labs**
2. Enable **"Mac CLI MCP Server"**
3. Click **"MCP Access Control"**
4. Toggle on journals you want accessible

### 6. Configure Your MCP Client

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

#### Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "dayone": {
      "url": "https://dayone-mcp-server.YOUR_ACCOUNT.workers.dev",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_API_KEY"
      }
    }
  }
}
```

### 7. Test It!

Ask your AI assistant:
```
"List my Day One journals"
"Create a journal entry about today"
"Search for entries about vacation"
```

## Detailed Documentation

- **[Setup Guide](docs/SETUP.md)** - Detailed installation steps
- **[Cloudflare Tunnel Setup](docs/CLOUDFLARE_TUNNEL_SETUP.md)** - Tunnel configuration
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Complete deployment process

## Project Structure

```
dayone-mcp-server/
├── bridge/              # Local bridge service (Node.js)
│   ├── src/
│   │   ├── server.ts   # HTTP server
│   │   └── dayone.ts   # Day One CLI wrapper
│   └── package.json
├── worker/              # Cloudflare Worker (Edge)
│   ├── src/
│   │   ├── index.ts    # Worker entry point
│   │   ├── mcp-handler.ts  # MCP protocol
│   │   └── auth.ts     # Authentication
│   └── wrangler.toml
├── shared/              # Shared TypeScript types
│   └── types.ts
├── scripts/             # Deployment scripts
│   ├── setup-bridge.sh
│   ├── deploy-worker.sh
│   └── generate-tokens.sh
└── docs/               # Documentation
    ├── SETUP.md
    ├── DEPLOYMENT.md
    └── CLOUDFLARE_TUNNEL_SETUP.md
```

## MCP Tools

The server exposes the following MCP tools via the `tools/list` and `tools/call` methods:

### `list_journals`

Returns all journals with MCP access enabled.

**Example:**
```
"Show me all my journals"
```

---

### `create_entry`

Creates a new journal entry with markdown content and optional metadata.

**Parameters:**
- `text` (required) - Entry content in markdown format
- `journal_id` or `journal_name` (optional) - Target journal
- `date` (optional) - ISO8601 timestamp (e.g., `2025-08-20T15:30:00Z`)
- `tags` (optional) - Comma-separated tag list
- `attachments` (optional) - Comma-separated file paths
- `starred`, `all_day` (optional) - Boolean flags

**Example:**
```
"Create a journal entry about today's meeting with tags 'work' and 'meeting'"
```

---

### `get_entries`

Retrieves entries via full-text search, date filters, or journal constraints.

**Parameters:**
- `query` (optional) - Full-text search query (triggers search index)
- `journal_ids` or `journal_names` (optional) - Filter by journals
- `start_date`, `end_date` (optional) - Date range in YYYY-MM-DD format
- `on_this_day` (optional) - MM-DD format for anniversary queries
- `limit` (optional) - Max results (default: 10, max: 50)
- `offset` (optional) - Pagination offset (ignored for search queries)

**Examples:**
```
"Find entries about vacation from last summer"
"What did I write on this day in previous years?"
"Show recent entries from my Travel Journal"
```

---

### `update_entry`

Updates an existing entry's content or metadata.

**Parameters:**
- `entry_id` (required) - Entry UUID
- `journal_id` (optional) - Journal sync ID for disambiguation
- `text` (optional) - New markdown content
- `tags` (optional) - Comma-separated tags (replaces existing)
- `attachments` (optional) - File paths to add
- `starred`, `all_day` (optional) - Boolean flags

**Example:**
```
"Add the tag 'important' to my last entry"
```

## Security Model

This implementation includes multiple layers of security:

### 1. Token-Based Authentication
- **MCP API Keys** - Clients must provide valid API key
- **Bridge Authentication** - Worker authenticates to bridge service
- **Secure Token Generation** - Use `./scripts/generate-tokens.sh`

### 2. Cloudflare Tunnel
- **Zero Trust Network** - No port forwarding required
- **Encrypted Connection** - TLS 1.3 end-to-end
- **No IP Exposure** - Your Mac's IP stays private

### 3. Rate Limiting
- **Request Limits** - 100 requests per minute per IP
- **DDoS Protection** - Cloudflare edge protection
- **Resource Management** - Prevents abuse

### 4. Journal-Level Access Control
- **Opt-In Model** - Only enabled journals are accessible
- **Day One Preferences** - Control access per journal
- **Validation** - All operations check journal permissions

### 5. Password Lock Protection
The bridge service respects Day One's password lock. If enabled, Day One CLI operations will fail gracefully.

### Best Practices
- 🔐 Use strong, unique API keys (32+ bytes)
- 🔄 Rotate tokens regularly
- 📊 Monitor access logs
- 🚫 Only enable necessary journal access
- 🔒 Keep `.env` and secrets secure

## Cost

Running this setup costs **$0/month** using free tiers:

- ✅ Cloudflare Workers - 100,000 requests/day free
- ✅ Cloudflare Tunnel - Unlimited, free
- ✅ Day One - Existing subscription
- ✅ Infrastructure - Your Mac (no cloud VMs needed)

Paid options (optional):
- Cloudflare Workers Pro ($5/mo) - 10M requests/day, lower latency
- Custom domain - Free with Cloudflare

## Troubleshooting

### Bridge service won't start
```bash
# Check Day One CLI
/usr/local/bin/dayone --version

# Check logs
tail -f /tmp/dayone-bridge.log
```

### Tunnel connection issues
```bash
# Check tunnel status
cloudflared tunnel info dayone-bridge

# View logs
sudo tail -f /Library/Logs/com.cloudflare.cloudflared.err.log
```

### Worker not responding
```bash
# View logs
cd worker && wrangler tail

# Verify secrets
wrangler secret list
```

### MCP client can't connect
1. Verify worker URL is correct
2. Check API key in client config
3. Test worker with curl
4. Check client logs

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed troubleshooting.

## Development

### Local Testing

```bash
# Terminal 1: Start bridge
cd bridge && npm run dev

# Terminal 2: Start worker locally
cd worker && npm run dev

# Terminal 3: Test
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

### Running Tests

```bash
# Run all tests
npm test

# Test bridge only
cd bridge && npm test

# Test worker only
cd worker && npm test
```

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- Day One team for the excellent journaling app
- Cloudflare for Workers and Tunnel
- Model Context Protocol community

## Disclaimer

This is a **custom, unofficial** implementation. It is not affiliated with, endorsed by, or supported by Automattic, Inc. or Day One.

For the official Day One MCP server (local stdio-based), see the [Day One Help Center](https://dayoneapp.com/guides/).

## Support

For issues with this remote implementation:
- 📖 Check [documentation](docs/)
- 🐛 [Report an Issue](https://github.com/your-username/dayone-mcp-server/issues)
- 💬 [Discussions](https://github.com/your-username/dayone-mcp-server/discussions)

For Day One app support:
- 📖 [Day One Help Center](https://dayoneapp.com/guides/)

---

**Note**: This project enables remote access to your Day One journals. Please ensure you understand the security implications and use strong authentication tokens.
