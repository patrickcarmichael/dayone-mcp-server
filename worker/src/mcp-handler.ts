import type { MCPRequest, MCPResponse, MCPTool, BridgeRequest } from '../../shared/types';

export class MCPHandler {
  private bridgeUrl: string;
  private bridgeAuthToken: string;

  constructor(bridgeUrl: string, bridgeAuthToken: string) {
    this.bridgeUrl = bridgeUrl;
    this.bridgeAuthToken = bridgeAuthToken;
  }

  /**
   * Handle MCP protocol requests
   */
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(request);

        case 'tools/list':
          return this.handleToolsList(request);

        case 'tools/call':
          return await this.handleToolsCall(request);

        default:
          return this.errorResponse(
            request.id,
            -32601,
            `Method not found: ${request.method}`
          );
      }
    } catch (error) {
      console.error('MCP Handler error:', error);
      return this.errorResponse(
        request.id,
        -32603,
        error instanceof Error ? error.message : 'Internal error'
      );
    }
  }

  /**
   * Handle initialize request
   */
  private handleInitialize(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: 'dayone-mcp-server',
          version: '1.0.0'
        },
        capabilities: {
          tools: {}
        }
      }
    };
  }

  /**
   * Handle tools/list request
   */
  private handleToolsList(request: MCPRequest): MCPResponse {
    const tools: MCPTool[] = [
      {
        name: 'list_journals',
        description: 'Returns all journals with MCP access enabled',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'create_entry',
        description: 'Creates a new journal entry with markdown content and optional metadata',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Entry content in markdown format'
            },
            journal_id: {
              type: 'string',
              description: 'Target journal ID (optional)'
            },
            journal_name: {
              type: 'string',
              description: 'Target journal name (optional)'
            },
            date: {
              type: 'string',
              description: 'ISO8601 timestamp (e.g., 2025-08-20T15:30:00Z)'
            },
            tags: {
              type: 'string',
              description: 'Comma-separated tag list'
            },
            attachments: {
              type: 'string',
              description: 'Comma-separated file paths'
            },
            starred: {
              type: 'boolean',
              description: 'Star this entry'
            },
            all_day: {
              type: 'boolean',
              description: 'Mark as all-day entry'
            }
          },
          required: ['text']
        }
      },
      {
        name: 'get_entries',
        description: 'Retrieves entries via full-text search, date filters, or journal constraints',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Full-text search query'
            },
            journal_ids: {
              type: 'string',
              description: 'Comma-separated journal IDs to filter by'
            },
            journal_names: {
              type: 'string',
              description: 'Comma-separated journal names to filter by'
            },
            start_date: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format'
            },
            end_date: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format'
            },
            on_this_day: {
              type: 'string',
              description: 'MM-DD format for anniversary queries'
            },
            limit: {
              type: 'number',
              description: 'Max results (default: 10, max: 50)'
            },
            offset: {
              type: 'number',
              description: 'Pagination offset'
            }
          }
        }
      },
      {
        name: 'update_entry',
        description: 'Updates an existing entry\'s content or metadata',
        inputSchema: {
          type: 'object',
          properties: {
            entry_id: {
              type: 'string',
              description: 'Entry UUID'
            },
            journal_id: {
              type: 'string',
              description: 'Journal ID for disambiguation'
            },
            text: {
              type: 'string',
              description: 'New markdown content'
            },
            tags: {
              type: 'string',
              description: 'Comma-separated tags (replaces existing)'
            },
            attachments: {
              type: 'string',
              description: 'File paths to add'
            },
            starred: {
              type: 'boolean',
              description: 'Star flag'
            },
            all_day: {
              type: 'boolean',
              description: 'All-day flag'
            }
          },
          required: ['entry_id']
        }
      }
    ];

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools
      }
    };
  }

  /**
   * Handle tools/call request
   */
  private async handleToolsCall(request: MCPRequest): Promise<MCPResponse> {
    const toolName = request.params?.name;
    const toolArgs = request.params?.arguments || {};

    if (!toolName) {
      return this.errorResponse(request.id, -32602, 'Missing tool name');
    }

    // Map MCP tool names to bridge actions
    const actionMap: Record<string, string> = {
      'list_journals': 'list_journals',
      'create_entry': 'create_entry',
      'get_entries': 'get_entries',
      'update_entry': 'update_entry'
    };

    const action = actionMap[toolName];
    if (!action) {
      return this.errorResponse(request.id, -32602, `Unknown tool: ${toolName}`);
    }

    // Call the bridge service
    try {
      const bridgeRequest: BridgeRequest = {
        action: action as any,
        params: toolArgs
      };

      const response = await fetch(`${this.bridgeUrl}/bridge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.bridgeAuthToken}`
        },
        body: JSON.stringify(bridgeRequest)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Bridge request failed: ${response.status}`);
      }

      const bridgeResponse = await response.json();

      if (!bridgeResponse.success) {
        throw new Error(bridgeResponse.error || 'Bridge request failed');
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(bridgeResponse.data, null, 2)
            }
          ]
        }
      };
    } catch (error) {
      console.error('Bridge call error:', error);
      return this.errorResponse(
        request.id,
        -32603,
        error instanceof Error ? error.message : 'Failed to call bridge service'
      );
    }
  }

  /**
   * Create an error response
   */
  private errorResponse(id: number | string, code: number, message: string): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message
      }
    };
  }
}
