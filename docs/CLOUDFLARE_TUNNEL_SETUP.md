# Cloudflare Tunnel Setup Guide

This guide explains how to set up Cloudflare Tunnel to securely connect your local bridge service to the Cloudflare Worker.

## What is Cloudflare Tunnel?

Cloudflare Tunnel creates a secure, encrypted connection from your local machine to Cloudflare's edge network without requiring port forwarding or exposing your IP address. It's perfect for making your local bridge service accessible to the Cloudflare Worker.

## Prerequisites

- A Cloudflare account (free tier works)
- The bridge service running on your Mac
- Terminal access on your Mac

## Installation

### 1. Install cloudflared

On macOS, install using Homebrew:

```bash
brew install cloudflare/cloudflare/cloudflared
```

Verify installation:

```bash
cloudflared --version
```

### 2. Authenticate with Cloudflare

Run the following command to authenticate:

```bash
cloudflared tunnel login
```

This will open a browser window. Log in to your Cloudflare account and select the domain you want to use (or you can use the default `.cfargotunnel.com` subdomain).

### 3. Create a Tunnel

Create a new tunnel for your bridge service:

```bash
cloudflared tunnel create dayone-bridge
```

This will:
- Generate a unique tunnel ID
- Create a credentials file at `~/.cloudflared/<tunnel-id>.json`
- Display the tunnel ID (save this for later)

**Important**: Save the tunnel ID that's displayed. You'll need it later.

### 4. Configure the Tunnel

Create a configuration file at `~/.cloudflared/config.yml`:

```yaml
# Cloudflare Tunnel Configuration for Day One Bridge

tunnel: <your-tunnel-id>
credentials-file: /Users/<your-username>/.cloudflared/<your-tunnel-id>.json

ingress:
  # Route all traffic to the local bridge service
  - hostname: <your-tunnel-id>.cfargotunnel.com
    service: http://localhost:3000

  # Catch-all rule (required)
  - service: http_status:404
```

Replace:
- `<your-tunnel-id>` with the tunnel ID from step 3
- `<your-username>` with your Mac username
- `3000` with your bridge service port (if different)

### 5. Create DNS Record

Route traffic through the tunnel by creating a DNS record:

```bash
cloudflared tunnel route dns dayone-bridge <your-tunnel-id>.cfargotunnel.com
```

This creates a CNAME record pointing to your tunnel.

### 6. Test the Tunnel

Start the tunnel:

```bash
cloudflared tunnel run dayone-bridge
```

You should see output indicating the tunnel is connected. Keep this running.

In another terminal, test the connection:

```bash
curl https://<your-tunnel-id>.cfargotunnel.com/health
```

You should receive a response from your bridge service.

### 7. Run as a Service (Recommended)

To keep the tunnel running automatically:

#### On macOS (using launchd):

Install the service:

```bash
sudo cloudflared service install
```

Start the service:

```bash
sudo launchctl start com.cloudflare.cloudflared
```

Check status:

```bash
sudo launchctl list | grep cloudflared
```

## Configuration for Worker

Once your tunnel is set up, you'll need to configure the Cloudflare Worker with your tunnel URL.

### Get Your Tunnel URL

Your tunnel URL will be:
```
https://<your-tunnel-id>.cfargotunnel.com
```

### Set Worker Environment Variable

Set the `BRIDGE_URL` secret in your Cloudflare Worker:

```bash
cd worker
wrangler secret put BRIDGE_URL
# When prompted, enter: https://<your-tunnel-id>.cfargotunnel.com
```

## Security Considerations

### 1. Tunnel Authentication

The tunnel itself is authenticated via the credentials file. Keep this file secure:

```bash
chmod 600 ~/.cloudflared/<tunnel-id>.json
```

### 2. Bridge Authentication

The bridge service uses token authentication. Make sure your `BRIDGE_AUTH_TOKEN` is strong:

```bash
# Generate a secure token
openssl rand -base64 32
```

Set this in both:
- Bridge service (`.env` file)
- Worker (`BRIDGE_AUTH_TOKEN` secret)

### 3. Network Access

By default, the tunnel is accessible from anywhere. For additional security:

1. **Use Cloudflare Access** (Zero Trust):
   - Set up application policies
   - Require authentication before reaching the tunnel
   - Free for up to 50 users

2. **Configure IP allowlisting** in the bridge service CORS settings

## Troubleshooting

### Tunnel won't connect

```bash
# Check tunnel status
cloudflared tunnel info dayone-bridge

# Check configuration
cloudflared tunnel validate ~/.cloudflared/config.yml

# View logs
sudo tail -f /var/log/cloudflared.log
```

### Bridge service unreachable

```bash
# Check if bridge is running
curl http://localhost:3000/health

# Check tunnel ingress
cloudflared tunnel info dayone-bridge
```

### DNS not resolving

```bash
# Verify DNS record
dig <your-tunnel-id>.cfargotunnel.com

# Re-create DNS record if needed
cloudflared tunnel route dns dayone-bridge <your-tunnel-id>.cfargotunnel.com
```

## Custom Domain (Optional)

To use a custom domain instead of `.cfargotunnel.com`:

### 1. Add domain to Cloudflare

Ensure your domain is managed by Cloudflare.

### 2. Update tunnel configuration

Edit `~/.cloudflared/config.yml`:

```yaml
tunnel: <your-tunnel-id>
credentials-file: /Users/<your-username>/.cloudflared/<your-tunnel-id>.json

ingress:
  - hostname: dayone.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

### 3. Create DNS record

```bash
cloudflared tunnel route dns dayone-bridge dayone.yourdomain.com
```

### 4. Update Worker configuration

Update the `BRIDGE_URL` secret to use your custom domain.

## Monitoring

### Check tunnel status

```bash
cloudflared tunnel info dayone-bridge
```

### View tunnel logs

```bash
# If running as service (macOS)
sudo tail -f /Library/Logs/com.cloudflare.cloudflared.err.log

# If running manually
# Logs will appear in the terminal
```

### Cloudflare Dashboard

View tunnel metrics in the Cloudflare dashboard:
1. Go to **Zero Trust** → **Access** → **Tunnels**
2. Click on your tunnel
3. View metrics and connection status

## Next Steps

Once your tunnel is set up and working:
1. ✅ Verify bridge service is accessible via tunnel URL
2. ✅ Set up Worker environment variables
3. ✅ Deploy the Worker
4. ✅ Test the complete MCP flow

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment instructions.
