import { DatabaseService } from '../database/DatabaseService';

/**
 * Utility functions to manage the sync queue
 */

/**
 * Clear all items from sync queue
 */
export async function clearAllSyncQueue(): Promise<number> {
  const db = DatabaseService.getInstance().getDatabase();
  const [result] = await db.executeSql('DELETE FROM sync_queue');
  console.log('[ClearSync] 🗑️ Cleared all sync queue items');
  return result.rowsAffected;
}

/**
 * Clear only synced items from queue
 */
export async function clearSyncedItems(): Promise<number> {
  const db = DatabaseService.getInstance().getDatabase();
  const [result] = await db.executeSql('DELETE FROM sync_queue WHERE synced = 1');
  console.log(`[ClearSync] 🗑️ Cleared ${result.rowsAffected} synced items`);
  return result.rowsAffected;
}

/**
 * Clear items that have failed too many times
 */
export async function clearFailedItems(maxRetries: number = 30): Promise<number> {
  const db = DatabaseService.getInstance().getDatabase();
  const [result] = await db.executeSql(
    'DELETE FROM sync_queue WHERE retry_count > ?',
    [maxRetries]
  );
  console.log(`[ClearSync] 🗑️ Cleared ${result.rowsAffected} failed items (retry > ${maxRetries})`);
  return result.rowsAffected;
}

/**
 * Get sync queue statistics
 */
export async function getSyncQueueStats(): Promise<{
  total: number;
  pending: number;
  synced: number;
  failed: number;
}> {
  const db = DatabaseService.getInstance().getDatabase();
  
  const [totalResult] = await db.executeSql('SELECT COUNT(*) as count FROM sync_queue');
  const [pendingResult] = await db.executeSql('SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0');
  const [syncedResult] = await db.executeSql('SELECT COUNT(*) as count FROM sync_queue WHERE synced = 1');
  const [failedResult] = await db.executeSql('SELECT COUNT(*) as count FROM sync_queue WHERE retry_count > 10');
  
  return {
    total: totalResult.rows.item(0).count,
    pending: pendingResult.rows.item(0).count,
    synced: syncedResult.rows.item(0).count,
    failed: failedResult.rows.item(0).count,
  };
}

/**
 * View sync queue items (for debugging)
 */
export async function viewSyncQueue(limit: number = 10): Promise<any[]> {
  const db = DatabaseService.getInstance().getDatabase();
  const [result] = await db.executeSql(
    'SELECT * FROM sync_queue ORDER BY timestamp DESC LIMIT ?',
    [limit]
  );
  
  const items = [];
  for (let i = 0; i < result.rows.length; i++) {
    items.push(result.rows.item(i));
  }
  
  return items;
}
