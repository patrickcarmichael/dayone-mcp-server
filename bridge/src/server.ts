import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { DayOneClient } from './dayone.js';
import type { BridgeRequest, BridgeResponse } from '../../shared/types.js';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const DAYONE_CLI_PATH = process.env.DAYONE_CLI_PATH || '/usr/local/bin/dayone';

// Initialize Day One client
const dayoneClient = new DayOneClient(DAYONE_CLI_PATH);

// Middleware
app.use(express.json());

// CORS configuration - only allow requests from Cloudflare Worker
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow Cloudflare Worker origins
    if (origin.includes('.workers.dev') || origin.includes('cloudflare.com')) {
      return callback(null, true);
    }

    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Authentication middleware
const authenticate = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;

  if (!AUTH_TOKEN) {
    console.warn('WARNING: No AUTH_TOKEN configured - all requests will be accepted!');
    return next();
  }

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Missing Authorization header'
    });
  }

  const token = authHeader.replace('Bearer ', '');
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token'
    });
  }

  next();
};

// Health check endpoint (no auth required)
app.get('/health', async (req: Request, res: Response) => {
  const isAvailable = await dayoneClient.checkAvailability();
  res.json({
    status: 'ok',
    dayoneAvailable: isAvailable,
    version: '1.0.0'
  });
});

// Main bridge endpoint
app.post('/bridge', authenticate, async (req: Request, res: Response) => {
  const request: BridgeRequest = req.body;

  try {
    let data: any;

    switch (request.action) {
      case 'list_journals':
        data = await dayoneClient.listJournals();
        break;

      case 'create_entry':
        if (!request.params?.text) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameter: text'
          });
        }
        data = await dayoneClient.createEntry(request.params);
        break;

      case 'get_entries':
        data = await dayoneClient.getEntries(request.params || {});
        break;

      case 'update_entry':
        if (!request.params?.entry_id) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameter: entry_id'
          });
        }
        data = await dayoneClient.updateEntry(request.params);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown action: ${request.action}`
        });
    }

    const response: BridgeResponse = {
      success: true,
      data
    };

    res.json(response);
  } catch (error) {
    console.error('Bridge error:', error);

    const response: BridgeResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };

    res.status(500).json(response);
  }
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Day One Bridge Service running on port ${PORT}`);
  console.log(`Day One CLI path: ${DAYONE_CLI_PATH}`);
  console.log(`Auth token configured: ${AUTH_TOKEN ? 'Yes' : 'No (WARNING: Insecure!)'}`);

  // Check Day One CLI availability
  dayoneClient.checkAvailability().then(available => {
    if (available) {
      console.log('✓ Day One CLI is available');
    } else {
      console.error('✗ Day One CLI not found - please install it first');
      console.error('Run: sudo bash /Applications/Day\\ One.app/Contents/Resources/install_cli.sh');
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
