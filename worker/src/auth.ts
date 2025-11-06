/**
 * Authentication handler for MCP requests
 */
export class AuthHandler {
  private apiKeys: Set<string>;

  constructor(apiKeys: string[]) {
    this.apiKeys = new Set(apiKeys);
  }

  /**
   * Verify the API key from request headers
   */
  verifyRequest(request: Request): { authorized: boolean; error?: string } {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return {
        authorized: false,
        error: 'Missing Authorization header'
      };
    }

    // Support both "Bearer TOKEN" and "API_KEY TOKEN" formats
    const token = authHeader.replace(/^(Bearer|API_KEY)\s+/i, '').trim();

    if (!token) {
      return {
        authorized: false,
        error: 'Invalid Authorization header format'
      };
    }

    if (!this.apiKeys.has(token)) {
      return {
        authorized: false,
        error: 'Invalid API key'
      };
    }

    return { authorized: true };
  }

  /**
   * Create an unauthorized response
   */
  createUnauthorizedResponse(error: string): Response {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32001,
          message: error
        }
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer realm="MCP Server"'
        }
      }
    );
  }
}

/**
 * Rate limiting using Cloudflare Durable Objects or simple in-memory tracking
 */
export class RateLimiter {
  private requests: Map<string, number[]>;
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.requests = new Map();
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if request should be rate limited
   */
  checkLimit(identifier: string): { limited: boolean; remaining: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this identifier
    let timestamps = this.requests.get(identifier) || [];

    // Remove old requests outside the window
    timestamps = timestamps.filter(ts => ts > windowStart);

    // Check if limit exceeded
    if (timestamps.length >= this.maxRequests) {
      return {
        limited: true,
        remaining: 0
      };
    }

    // Add current request
    timestamps.push(now);
    this.requests.set(identifier, timestamps);

    return {
      limited: false,
      remaining: this.maxRequests - timestamps.length
    };
  }

  /**
   * Create a rate limit exceeded response
   */
  createRateLimitResponse(): Response {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32002,
          message: 'Rate limit exceeded'
        }
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60'
        }
      }
    );
  }

  /**
   * Clean up old entries periodically
   */
  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [identifier, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter(ts => ts > windowStart);
      if (filtered.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, filtered);
      }
    }
  }
}
