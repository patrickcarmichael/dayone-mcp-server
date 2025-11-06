import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  Journal,
  Entry,
  CreateEntryParams,
  GetEntriesParams,
  UpdateEntryParams
} from '../../shared/types.js';

const execAsync = promisify(exec);

export class DayOneClient {
  private dayonePath: string;

  constructor(dayonePath: string = '/usr/local/bin/dayone') {
    this.dayonePath = dayonePath;
  }

  /**
   * List all journals with MCP access enabled
   */
  async listJournals(): Promise<Journal[]> {
    try {
      // The Day One CLI doesn't have a direct journals list command
      // We'll need to parse from entry operations or use a workaround
      // For now, we'll simulate with a test command
      const { stdout } = await execAsync(`${this.dayonePath} --version`);

      // In a real implementation, you would:
      // 1. Query Day One's database directly
      // 2. Use a custom command if available
      // 3. Parse from configuration files

      // Placeholder - this needs actual implementation based on Day One CLI capabilities
      return [
        {
          id: 'default',
          name: 'Journal',
          mcpAccessAllowed: true
        }
      ];
    } catch (error) {
      throw new Error(`Failed to list journals: ${error}`);
    }
  }

  /**
   * Create a new journal entry
   */
  async createEntry(params: CreateEntryParams): Promise<Entry> {
    try {
      const args: string[] = ['new'];

      // Add journal specification
      if (params.journal_name) {
        args.push('--journal', this.escapeArg(params.journal_name));
      } else if (params.journal_id) {
        args.push('--journal-id', this.escapeArg(params.journal_id));
      }

      // Add date if specified
      if (params.date) {
        args.push('--date', this.escapeArg(params.date));
      }

      // Add tags if specified
      if (params.tags) {
        const tagList = params.tags.split(',').map(t => t.trim());
        tagList.forEach(tag => {
          args.push('--tags', this.escapeArg(tag));
        });
      }

      // Add starred flag
      if (params.starred) {
        args.push('--starred');
      }

      // Add all-day flag
      if (params.all_day) {
        args.push('--all-day');
      }

      // Add attachments if specified
      if (params.attachments) {
        const attachmentList = params.attachments.split(',').map(a => a.trim());
        attachmentList.forEach(attachment => {
          args.push('--photo', this.escapeArg(attachment));
        });
      }

      // Add the entry text (use echo to pipe it)
      const command = `echo ${this.escapeArg(params.text)} | ${this.dayonePath} ${args.join(' ')}`;

      const { stdout } = await execAsync(command);

      // Parse the output to get entry ID
      // Day One CLI typically returns the entry UUID
      const entryId = stdout.trim();

      return {
        id: entryId,
        text: params.text,
        date: params.date || new Date().toISOString(),
        journalId: params.journal_id,
        tags: params.tags?.split(',').map(t => t.trim()),
        starred: params.starred,
        allDay: params.all_day,
        attachments: params.attachments?.split(',').map(a => a.trim())
      };
    } catch (error) {
      throw new Error(`Failed to create entry: ${error}`);
    }
  }

  /**
   * Get entries with optional filters
   */
  async getEntries(params: GetEntriesParams): Promise<Entry[]> {
    try {
      const args: string[] = ['export', '--type', 'json'];

      // Add journal filter
      if (params.journal_names) {
        const journals = params.journal_names.split(',').map(j => j.trim());
        journals.forEach(journal => {
          args.push('--journal', this.escapeArg(journal));
        });
      } else if (params.journal_ids) {
        const journalIds = params.journal_ids.split(',').map(j => j.trim());
        journalIds.forEach(journalId => {
          args.push('--journal-id', this.escapeArg(journalId));
        });
      }

      // Add date range filters
      if (params.start_date) {
        args.push('--after', this.escapeArg(params.start_date));
      }
      if (params.end_date) {
        args.push('--before', this.escapeArg(params.end_date));
      }

      // Add on-this-day filter
      if (params.on_this_day) {
        args.push('--on-this-day', this.escapeArg(params.on_this_day));
      }

      const command = `${this.dayonePath} ${args.join(' ')}`;
      const { stdout } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 }); // 10MB buffer

      // Parse JSON output
      let entries: Entry[] = [];
      if (stdout.trim()) {
        const data = JSON.parse(stdout);
        entries = this.parseEntries(data);
      }

      // Apply text search filter if specified
      if (params.query) {
        const query = params.query.toLowerCase();
        entries = entries.filter(entry =>
          entry.text.toLowerCase().includes(query)
        );
      }

      // Apply pagination
      const offset = params.offset || 0;
      const limit = Math.min(params.limit || 10, 50); // Max 50 entries

      return entries.slice(offset, offset + limit);
    } catch (error) {
      throw new Error(`Failed to get entries: ${error}`);
    }
  }

  /**
   * Update an existing entry
   */
  async updateEntry(params: UpdateEntryParams): Promise<Entry> {
    try {
      const args: string[] = ['edit', this.escapeArg(params.entry_id)];

      // Add journal ID if specified
      if (params.journal_id) {
        args.push('--journal-id', this.escapeArg(params.journal_id));
      }

      // Add tags if specified (replaces existing)
      if (params.tags) {
        const tagList = params.tags.split(',').map(t => t.trim());
        tagList.forEach(tag => {
          args.push('--tags', this.escapeArg(tag));
        });
      }

      // Add starred flag
      if (params.starred !== undefined) {
        if (params.starred) {
          args.push('--starred');
        } else {
          args.push('--unstarred');
        }
      }

      // Add attachments if specified
      if (params.attachments) {
        const attachmentList = params.attachments.split(',').map(a => a.trim());
        attachmentList.forEach(attachment => {
          args.push('--photo', this.escapeArg(attachment));
        });
      }

      let command: string;
      if (params.text) {
        // If updating text, pipe it
        command = `echo ${this.escapeArg(params.text)} | ${this.dayonePath} ${args.join(' ')}`;
      } else {
        // Otherwise just update metadata
        command = `${this.dayonePath} ${args.join(' ')}`;
      }

      await execAsync(command);

      return {
        id: params.entry_id,
        text: params.text || '',
        date: new Date().toISOString(),
        journalId: params.journal_id,
        tags: params.tags?.split(',').map(t => t.trim()),
        starred: params.starred,
        attachments: params.attachments?.split(',').map(a => a.trim())
      };
    } catch (error) {
      throw new Error(`Failed to update entry: ${error}`);
    }
  }

  /**
   * Parse entries from Day One JSON export format
   */
  private parseEntries(data: any): Entry[] {
    const entries: Entry[] = [];

    if (data.entries && Array.isArray(data.entries)) {
      for (const entry of data.entries) {
        entries.push({
          id: entry.uuid || entry.id,
          text: entry.text || '',
          date: entry.creationDate || entry.date,
          journalId: entry.journalName || entry.journalId,
          tags: entry.tags || [],
          starred: entry.starred || false,
          allDay: entry.isAllDay || false,
          attachments: entry.photos?.map((p: any) => p.identifier || p.path) || []
        });
      }
    }

    return entries;
  }

  /**
   * Escape shell arguments to prevent injection
   */
  private escapeArg(arg: string): string {
    // Replace single quotes with '\'' and wrap in single quotes
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Check if Day One CLI is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      await execAsync(`${this.dayonePath} --version`);
      return true;
    } catch {
      return false;
    }
  }
}
