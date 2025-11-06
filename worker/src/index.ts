/**
 * Day One MCP Server - Cloudflare Worker
 *
 * This worker provides a remote MCP endpoint that proxies requests to a local
 * bridge service connected via Cloudflare Tunnel.
 */

import { MCPHandler } from './mcp-handler';
import { AuthHandler, RateLimiter } from './auth';
import type { MCPRequest } from '../../shared/types';

export interface Env {
  // API keys for MCP client authentication (comma-separated)
  MCP_API_KEYS: string;

  // Bridge service URL (via Cloudflare Tunnel)
  BRIDGE_URL: string;

  // Bridge service authentication token
  BRIDGE_AUTH_TOKEN: string;

  // Optional: Rate limiting config
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_WINDOW_MS?: string;
}

// Initialize rate limiter (shared across requests)
const rateLimiter = new RateLimiter();

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS(request);
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Validate environment variables
      if (!env.MCP_API_KEYS || !env.BRIDGE_URL || !env.BRIDGE_AUTH_TOKEN) {
        console.error('Missing required environment variables');
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32603,
              message: 'Server configuration error'
            }
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Initialize handlers
      const apiKeys = env.MCP_API_KEYS.split(',').map(k => k.trim()).filter(k => k);
      const authHandler = new AuthHandler(apiKeys);
      const mcpHandler = new MCPHandler(env.BRIDGE_URL, env.BRIDGE_AUTH_TOKEN);

      // Authenticate request
      const authResult = authHandler.verifyRequest(request);
      if (!authResult.authorized) {
        return authHandler.createUnauthorizedResponse(authResult.error!);
      }

      // Rate limiting
      const clientId = request.headers.get('CF-Connecting-IP') || 'unknown';
      const rateLimitResult = rateLimiter.checkLimit(clientId);
      if (rateLimitResult.limited) {
        return rateLimiter.createRateLimitResponse();
      }

      // Parse MCP request
      const mcpRequest: MCPRequest = await request.json();

      // Validate JSON-RPC format
      if (mcpRequest.jsonrpc !== '2.0') {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: mcpRequest.id || null,
            error: {
              code: -32600,
              message: 'Invalid JSON-RPC version'
            }
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Handle MCP request
      const mcpResponse = await mcpHandler.handleRequest(mcpRequest);

      // Return response with CORS headers
      return new Response(JSON.stringify(mcpResponse), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'X-Rate-Limit-Remaining': rateLimitResult.remaining.toString()
        }
      });
    } catch (error) {
      console.error('Worker error:', error);

      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Internal error'
          }
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  },

  // Optional: Scheduled cleanup for rate limiter
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    rateLimiter.cleanup();
  }
};

/**
 * Handle CORS preflight requests
 */
function handleCORS(request: Request): Response {
  const origin = request.headers.get('Origin');

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

/**
 * Health check endpoint (optional)
 */
export async function handleHealthCheck(env: Env): Promise<Response> {
  try {
    // Optionally ping bridge service
    const response = await fetch(`${env.BRIDGE_URL}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.BRIDGE_AUTH_TOKEN}`
      }
    });

    const bridgeHealth = await response.json();

    return new Response(
      JSON.stringify({
        status: 'ok',
        worker: 'healthy',
        bridge: bridgeHealth
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'error',
        worker: 'healthy',
        bridge: 'unreachable'
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
