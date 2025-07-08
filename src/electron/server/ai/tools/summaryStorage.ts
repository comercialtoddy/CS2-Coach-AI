import { ConversationSummary } from '../interfaces/ConversationTypes.js';
import { Database, RunResult } from 'sqlite3';
import path from 'path';
import { app } from 'electron';

interface TopicRow {
  topic: string;
  type: 'main_topic' | 'key_decision' | 'action_item';
}

interface SummaryRow {
  id: number;
  timestamp: number;
  context: string;
}

/**
 * Summary storage manager
 */
export class SummaryStorage {
  private static instance: SummaryStorage;
  private db: Database;

  private constructor() {
    const dbPath = path.join(app.getPath('userData'), 'summaries.db');
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SummaryStorage {
    if (!SummaryStorage.instance) {
      SummaryStorage.instance = new SummaryStorage();
    }
    return SummaryStorage.instance;
  }

  /**
   * Initialize database tables
   */
  private initializeDatabase(): void {
    this.db.serialize(() => {
      // Create summaries table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS summaries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          context TEXT NOT NULL,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `);

      // Create topics table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS topics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          summary_id INTEGER NOT NULL,
          topic TEXT NOT NULL,
          type TEXT NOT NULL,
          FOREIGN KEY (summary_id) REFERENCES summaries (id) ON DELETE CASCADE
        )
      `);

      // Create indices
      this.db.run('CREATE INDEX IF NOT EXISTS idx_summaries_timestamp ON summaries (timestamp)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_topics_summary_id ON topics (summary_id)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_topics_type ON topics (type)');
    });
  }

  /**
   * Store a conversation summary
   */
  public async storeSummary(summary: ConversationSummary): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        try {
          // Insert summary
          const self = this;
          this.db.run(
            'INSERT INTO summaries (timestamp, context) VALUES (?, ?)',
            [summary.timestamp, summary.context],
            function (err) {
              if (err) {
                self.db.run('ROLLBACK');
                reject(err);
                return;
              }

              const summaryId = this.lastID;

              // Insert main topics
              const mainTopicsStmt = self.db.prepare(
                'INSERT INTO topics (summary_id, topic, type) VALUES (?, ?, ?)'
              );

              for (const topic of summary.mainTopics) {
                mainTopicsStmt.run(summaryId, topic, 'main_topic');
              }
              mainTopicsStmt.finalize();

              // Insert key decisions
              const decisionsStmt = self.db.prepare(
                'INSERT INTO topics (summary_id, topic, type) VALUES (?, ?, ?)'
              );

              for (const decision of summary.keyDecisions) {
                decisionsStmt.run(summaryId, decision, 'key_decision');
              }
              decisionsStmt.finalize();

              // Insert action items
              const actionsStmt = self.db.prepare(
                'INSERT INTO topics (summary_id, topic, type) VALUES (?, ?, ?)'
              );

              for (const action of summary.actionItems) {
                actionsStmt.run(summaryId, action, 'action_item');
              }
              actionsStmt.finalize();

              self.db.run('COMMIT');
              resolve(summaryId);
            }
          );
        } catch (error) {
          this.db.run('ROLLBACK');
          reject(error);
        }
      });
    });
  }

  /**
   * Retrieve a conversation summary by ID
   */
  public async getSummary(id: number): Promise<ConversationSummary | null> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Get summary base info
        this.db.get(
          'SELECT * FROM summaries WHERE id = ?',
          [id],
          (err, row: { timestamp: number; context: string } | undefined) => {
            if (err) {
              reject(err);
              return;
            }

            if (!row) {
              resolve(null);
              return;
            }

            // Get topics
            this.db.all<TopicRow>(
              'SELECT topic, type FROM topics WHERE summary_id = ?',
              [id],
              (err, topics) => {
                if (err) {
                  reject(err);
                  return;
                }

                const summary: ConversationSummary = {
                  mainTopics: topics
                    .filter(t => t.type === 'main_topic')
                    .map(t => t.topic),
                  keyDecisions: topics
                    .filter(t => t.type === 'key_decision')
                    .map(t => t.topic),
                  actionItems: topics
                    .filter(t => t.type === 'action_item')
                    .map(t => t.topic),
                  context: row.context,
                  timestamp: row.timestamp
                };

                resolve(summary);
              }
            );
          }
        );
      });
    });
  }

  /**
   * List summaries within a time range
   */
  public async listSummaries(
    startTime?: number,
    endTime?: number
  ): Promise<SummaryRow[]> {
    return new Promise((resolve, reject) => {
      let query = 'SELECT id, timestamp, context FROM summaries';
      const params: number[] = [];

      if (startTime !== undefined || endTime !== undefined) {
        query += ' WHERE';
        if (startTime !== undefined) {
          query += ' timestamp >= ?';
          params.push(startTime);
        }
        if (endTime !== undefined) {
          if (startTime !== undefined) {
            query += ' AND';
          }
          query += ' timestamp <= ?';
          params.push(endTime);
        }
      }

      query += ' ORDER BY timestamp DESC';

      this.db.all<SummaryRow>(query, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  /**
   * Delete a summary and its associated topics
   */
  public async deleteSummary(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        try {
          // Delete topics first (due to foreign key constraint)
          this.db.run('DELETE FROM topics WHERE summary_id = ?', [id]);

          // Delete summary
          this.db.run('DELETE FROM summaries WHERE id = ?', [id], (err) => {
            if (err) {
              this.db.run('ROLLBACK');
              reject(err);
              return;
            }

            this.db.run('COMMIT');
            resolve();
          });
        } catch (error) {
          this.db.run('ROLLBACK');
          reject(error);
        }
      });
    });
  }

  /**
   * Close the database connection
   */
  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
} 