// Shared types for Day One MCP Server

export interface Journal {
  id: string;
  name: string;
  mcpAccessAllowed: boolean;
}

export interface Entry {
  id: string;
  text: string;
  date: string;
  journalId?: string;
  tags?: string[];
  starred?: boolean;
  allDay?: boolean;
  attachments?: string[];
}

export interface CreateEntryParams {
  text: string;
  journal_id?: string;
  journal_name?: string;
  date?: string;
  tags?: string;
  attachments?: string;
  starred?: boolean;
  all_day?: boolean;
}

export interface GetEntriesParams {
  query?: string;
  journal_ids?: string;
  journal_names?: string;
  start_date?: string;
  end_date?: string;
  on_this_day?: string;
  limit?: number;
  offset?: number;
}

export interface UpdateEntryParams {
  entry_id: string;
  journal_id?: string;
  text?: string;
  tags?: string;
  attachments?: string;
  starred?: boolean;
  all_day?: boolean;
}

export interface BridgeRequest {
  action: 'list_journals' | 'create_entry' | 'get_entries' | 'update_entry';
  params?: Record<string, any>;
}

export interface BridgeResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, any>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}
