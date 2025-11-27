import { NetworkUtils } from '../utils/NetworkUtils';
import { enqueueSync } from './enqueue';

/**
 * OfflineFirstService - Handles online/offline data operations
 * 
 * When ONLINE: Calls API directly
 * When OFFLINE: Stores in local DB and queues for sync
 */
export class OfflineFirstService {
  /**
   * Execute an API call with offline fallback
   * @param apiCall - The API function to call when online
   * @param fallbackData - Data to store locally when offline
   * @param tableName - Table name for sync queue
   * @param recordId - Record ID for sync queue
   * @param operation - Operation type (INSERT/UPDATE/DELETE)
   */
  static async execute<T>(
    apiCall: () => Promise<T>,
    fallbackData: {
      tableName: string;
      recordId: string;
      operation: 'INSERT' | 'UPDATE' | 'DELETE';
      data: any;
    }
  ): Promise<T | null> {
    const isOnline = await NetworkUtils.checkConnection();

    if (isOnline) {
      try {
        console.log(`[OfflineFirst] 🟢 Online - calling API for ${fallbackData.tableName}`);
        const result = await apiCall();
        console.log(`[OfflineFirst] ✅ API call successful`);
        return result;
      } catch (error: any) {
        console.error(`[OfflineFirst] ❌ API call failed:`, error?.message);
        
        // If API fails, queue for sync
        console.log(`[OfflineFirst] 📥 Queueing for sync...`);
        await enqueueSync(
          fallbackData.tableName,
          fallbackData.recordId,
          fallbackData.operation,
          fallbackData.data
        );
        return null;
      }
    } else {
      // Offline - queue immediately
      console.log(`[OfflineFirst] 🔴 Offline - queueing ${fallbackData.tableName} for sync`);
      await enqueueSync(
        fallbackData.tableName,
        fallbackData.recordId,
        fallbackData.operation,
        fallbackData.data
      );
      return null;
    }
  }

  /**
   * Try API call, but don't queue on failure (for read operations)
   */
  static async tryApi<T>(apiCall: () => Promise<T>): Promise<T | null> {
    const isOnline = await NetworkUtils.checkConnection();
    
    if (!isOnline) {
      console.log('[OfflineFirst] 🔴 Offline - skipping API call');
      return null;
    }

    try {
      return await apiCall();
    } catch (error) {
      console.error('[OfflineFirst] ❌ API call failed:', error);
      return null;
    }
  }
}
