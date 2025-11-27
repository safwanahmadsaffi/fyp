import { DatabaseService } from '../database/DatabaseService';
import { generateId } from '../utils/uid';

export async function enqueueSync(
  table: string,
  recordId: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  data: unknown,
): Promise<void> {
  const db = DatabaseService.getInstance().getDatabase();
  const id = generateId();
  const timestamp = new Date().toISOString();
  
  await db.executeSql(
    `INSERT INTO sync_queue (id, table_name, record_id, operation, data, synced, retry_count, timestamp)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
    [id, table, recordId, operation, JSON.stringify(data), timestamp],
  );
}


