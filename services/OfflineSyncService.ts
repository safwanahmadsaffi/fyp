import { DatabaseService } from './database/DatabaseService';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
// If you don't have types installed, you can type NetInfoState as any
// eslint-disable-next-line @typescript-eslint/no-var-requires


export interface SyncResult {
  success: boolean;
  synced_records: number;
  failed_records: number;
  errors: string[];
}

export class OfflineSyncService {
  private static instance: OfflineSyncService;
  private db: DatabaseService;
  private isOnline: boolean = false;
  private syncInProgress: boolean = false;
  private unsubscribeNetInfo: (() => void) | null = null;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): OfflineSyncService {
    if (!OfflineSyncService.instance) {
      OfflineSyncService.instance = new OfflineSyncService();
    }
    return OfflineSyncService.instance;
  }

  // Initialize the sync service
  public async initialize(): Promise<void> {
    try {
      // Monitor network connectivity
      this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
        this.handleConnectivityChange(state);
      });

      // Check initial connectivity
      const netInfo = await NetInfo.fetch();
      this.handleConnectivityChange(netInfo);

      console.log('Offline sync service initialized');
    } catch (error) {
      console.error('Failed to initialize sync service:', error);
      throw error;
    }
  }

  // Handle network connectivity changes
  private handleConnectivityChange(state: NetInfoState): void {
    const wasOnline = this.isOnline;
    this.isOnline = !!state.isConnected && !!state.isInternetReachable;

    console.log('Network connectivity changed:', {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      isOnline: this.isOnline,
    });

    // If we just came online and sync is not in progress, start sync
    if (!wasOnline && this.isOnline && !this.syncInProgress) {
      this.performSync();
    }
  }

  // Queue a record for sync
  public async queueForSync(
    tableName: string,
    recordId: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    data: any
  ): Promise<void> {
    try {
      const db = this.db.getDatabase();
      const syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await db.executeSql(
        `INSERT INTO sync_queue (id, table_name, record_id, operation, data, synced)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [syncId, tableName, recordId, operation, JSON.stringify(data), 0]
      );

      console.log(`Queued ${operation} operation for ${tableName}:${recordId}`);

      // If online, attempt immediate sync
      if (this.isOnline && !this.syncInProgress) {
        this.performSync();
      }
    } catch (error) {
      console.error('Failed to queue record for sync:', error);
      throw error;
    }
  }

  // Perform sync operation
  public async performSync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      console.log('Sync already in progress, skipping');
      return { success: false, synced_records: 0, failed_records: 0, errors: ['Sync already in progress'] };
    }

    if (!this.isOnline) {
      console.log('No internet connection, sync skipped');
      return { success: false, synced_records: 0, failed_records: 0, errors: ['No internet connection'] };
    }

    this.syncInProgress = true;
    const result: SyncResult = {
      success: true,
      synced_records: 0,
      failed_records: 0,
      errors: [],
    };

    try {
      console.log('Starting sync operation...');

      // Get pending sync records
      const pendingRecords = await this.getPendingSyncRecords();

      if (pendingRecords.length === 0) {
        console.log('No pending records to sync');
        return result;
      }

      console.log(`Found ${pendingRecords.length} records to sync`);

      // Process records in batches
      const batchSize = 10;
      for (let i = 0; i < pendingRecords.length; i += batchSize) {
        const batch = pendingRecords.slice(i, i + batchSize);
        await this.processSyncBatch(batch, result);
      }

      console.log(`Sync completed: ${result.synced_records} synced, ${result.failed_records} failed`);
      return result;
    } catch (error) {
      console.error('Sync operation failed:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
      return result;
    } finally {
      this.syncInProgress = false;
    }
  }

  // Get pending sync records
  private async getPendingSyncRecords(): Promise<any[]> {
    const db = this.db.getDatabase();

    const query = `
      SELECT * FROM sync_queue
      WHERE synced = 0
      ORDER BY timestamp ASC
      LIMIT 100
    `;

    const [results] = await db.executeSql(query);

    const records = [];
    for (let i = 0; i < results.rows.length; i++) {
      records.push(results.rows.item(i));
    }

    return records;
  }

  // Process a batch of sync records
  private async processSyncBatch(batch: any[], result: SyncResult): Promise<void> {
    for (const record of batch) {
      try {
        await this.syncRecord(record);
        await this.markRecordAsSynced(record.id);
        result.synced_records++;
      } catch (error) {
        console.error(`Failed to sync record ${record.id}:`, error);
        result.failed_records++;
        result.errors.push(`Failed to sync ${record.table_name}:${record.record_id} - ${error}`);

        // Increment retry count
        await this.incrementRetryCount(record.id);
      }
    }
  }

  // Sync a single record
  private async syncRecord(record: any): Promise<void> {
    const authToken = await this.getAuthToken();
    if (!authToken) {
      throw new Error('No authentication token available');
    }

    const data = JSON.parse(record.data);

    // TODO: Replace with actual API calls
    // For now, simulate API calls based on operation type
    switch (record.operation) {
      case 'INSERT':
        await this.syncInsert(record.table_name, data, authToken);
        break;
      case 'UPDATE':
        await this.syncUpdate(record.table_name, record.record_id, data, authToken);
        break;
      case 'DELETE':
        await this.syncDelete(record.table_name, record.record_id, authToken);
        break;
      default:
        throw new Error(`Unknown operation: ${record.operation}`);
    }
  }

  // Sync insert operation
  private async syncInsert(tableName: string, data: any, authToken: string): Promise<void> {
    // TODO: Make actual API call to server
    console.log(`[MOCK] Syncing INSERT to ${tableName}:`, data);

    // Simulate API delay
    await new Promise<void>((resolve: () => void) => setTimeout(resolve, 100));

    // Simulate occasional failures for testing
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Simulated API failure');
    }
  }

  // Sync update operation
  private async syncUpdate(tableName: string, recordId: string, data: any, authToken: string): Promise<void> {
    // TODO: Make actual API call to server
    console.log(`[MOCK] Syncing UPDATE to ${tableName}:${recordId}:`, data);

    // Simulate API delay
    await new Promise<void>(resolve => setTimeout(resolve, 100));

    // Simulate occasional failures for testing
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Simulated API failure');
    }
  }

  // Sync delete operation
  private async syncDelete(tableName: string, recordId: string, authToken: string): Promise<void> {
    // TODO: Make actual API call to server
    console.log(`[MOCK] Syncing DELETE to ${tableName}:${recordId}`);

    // Simulate API delay
    await new Promise<void>((resolve: () => void) => setTimeout(resolve, 100));

    // Simulate occasional failures for testing
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Simulated API failure');
    }
  }

  // Mark a record as synced
  private async markRecordAsSynced(syncId: string): Promise<void> {
    const db = this.db.getDatabase();

    await db.executeSql(
      'UPDATE sync_queue SET synced = 1 WHERE id = ?',
      [syncId]
    );
  }

  // Increment retry count for failed records
  private async incrementRetryCount(syncId: string): Promise<void> {
    const db = this.db.getDatabase();

    await db.executeSql(
      'UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?',
      [syncId]
    );
  }

  // Get auth token for API calls
  private async getAuthToken(): Promise<string | null> {
    // TODO: Integrate with AuthService
    // For now, return mock token
    return 'mock_auth_token';
  }

  // Get sync statistics
  public async getSyncStats(): Promise<{
    pending_records: number;
    failed_records: number;
    last_sync_time?: string;
    is_online: boolean;
    sync_in_progress: boolean;
  }> {
    const db = this.db.getDatabase();

    const [pendingResults] = await db.executeSql(
      'SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0',
    );

    const [failedResults] = await db.executeSql(
      'SELECT COUNT(*) as count FROM sync_queue WHERE retry_count > 0',
    );

    const [lastSyncResults] = await db.executeSql(
      'SELECT timestamp FROM sync_queue WHERE synced = 1 ORDER BY timestamp DESC LIMIT 1',
    );

    return {
      pending_records: pendingResults.rows.item(0).count,
      failed_records: failedResults.rows.item(0).count,
      last_sync_time: lastSyncResults.rows.length > 0 ? lastSyncResults.rows.item(0).timestamp : undefined,
      is_online: this.isOnline,
      sync_in_progress: this.syncInProgress,
    };
  }

  // Clean up old synced records (older than 7 days)
  public async cleanupOldRecords(): Promise<void> {
    try {
      const db = this.db.getDatabase();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      await db.executeSql(
        'DELETE FROM sync_queue WHERE synced = 1 AND timestamp < ?',
        [sevenDaysAgo]
      );

      console.log('Old synced records cleaned up');
    } catch (error) {
      console.error('Failed to cleanup old records:', error);
    }
  }

  // Force sync (manual trigger)
  public async forceSync(): Promise<SyncResult> {
    console.log('Manual sync triggered');
    return await this.performSync();
  }

  // Get failed records for retry
  public async getFailedRecords(): Promise<any[]> {
    const db = this.db.getDatabase();

    const query = `
      SELECT * FROM sync_queue
      WHERE synced = 0 AND retry_count > 0
      ORDER BY retry_count ASC, timestamp ASC
      LIMIT 50
    `;

    const [results] = await db.executeSql(query);

    const records = [];
    for (let i = 0; i < results.rows.length; i++) {
      records.push(results.rows.item(i));
    }

    return records;
  }

  // Reset failed record retry count (for manual retry)
  public async resetFailedRecord(syncId: string): Promise<void> {
    const db = this.db.getDatabase();

    await db.executeSql(
      'UPDATE sync_queue SET retry_count = 0 WHERE id = ?',
      [syncId]
    );
  }

  // Clean up resources
  public cleanup(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
  }

  // Check if sync is needed
  public async isSyncNeeded(): Promise<boolean> {
    const stats = await this.getSyncStats();
    return stats.pending_records > 0;
  }

  // Get network status
  public getNetworkStatus(): {
    isOnline: boolean;
    syncInProgress: boolean;
  } {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
    };
  }
}
