import { DatabaseService } from '../database/DatabaseService';
import visitApiService from './visitApiService';

/**
 * Service to sync visits from server to local database
 */
export class VisitSyncService {
  /**
   * Fetch visits from API and save to local database
   * Uses server's _id as primary key
   */
  public static async syncFromServer(options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<number> {
    try {
      console.log('[VisitSync] 📥 Fetching visits from server...');
      
      // 1. Build API params
      const params: any = { limit: options?.limit || 1000 };
      
      if (options?.startDate) {
        params.startDate = options.startDate.toISOString().split('T')[0];
      }
      
      if (options?.endDate) {
        params.endDate = options.endDate.toISOString().split('T')[0];
      }
      
      console.log('[VisitSync] Params:', params);
      
      // 2. Fetch from API
      const response = await visitApiService.getMyVisits(params);
      const visits = response?.data?.visits || [];
      
      console.log('[VisitSync] ✅ Fetched', visits.length, 'visits from API');
      
      if (visits.length === 0) {
        console.log('[VisitSync] No visits to sync');
        return 0;
      }
      
      const db = DatabaseService.getInstance().getDatabase();
      let syncedCount = 0;
      
      // 3. Insert/Update each visit using server's _id
      for (const visit of visits) {
        try {
          const visitDate = visit.visitDateTime 
            ? new Date(visit.visitDateTime).toISOString().split('T')[0] 
            : new Date().toISOString().split('T')[0];
          
          console.log('[VisitSync] Visit data for sync:', visit, JSON.stringify(visit.orders));
          await db.executeSql(
            `INSERT OR REPLACE INTO visits 
             (id, user_id, shop_id, allocation_id, visit_date, status, notes, synced, orders, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              visit._id, // Use server's _id
              (visit as any).userId || 'current-user',
              visit.allocation?.shop?._id || '',
              visit.allocation?._id || '',
              visitDate,
              (visit as any).status || 'completed',
              visit.notes || '',
              1, // Mark as synced (from server)
              JSON.stringify(visit.orders || []),
              (visit as any).createdAt || new Date().toISOString(),
              (visit as any).updatedAt || new Date().toISOString()
            ]
          );
          
          console.log('[VisitSync] 💾 Saved visit to DB:', visit._id, '-', visitDate);
          syncedCount++;
          
        } catch (error) {
          console.error('[VisitSync] ❌ Failed to save visit:', visit._id, error);
        }
      }
      
      console.log('[VisitSync] 🎉 Synced', syncedCount, 'visits to local database');
      return syncedCount;
      
    } catch (error) {
      console.error('[VisitSync] ❌ Failed to sync from server:', error);
      throw error;
    }
  }
  
  /**
   * Clear all local visits
   */
  public static async clearLocal(): Promise<void> {
    try {
      const db = DatabaseService.getInstance().getDatabase();
      await db.executeSql('DELETE FROM visits WHERE synced = 1'); // Only clear synced visits
      
      console.log('[VisitSync] 🗑️ Cleared synced local visits');
    } catch (error) {
      console.error('[VisitSync] ❌ Failed to clear local visits:', error);
      throw error;
    }
  }
  
  /**
   * Full sync: clear synced local data then sync from server
   */
  public static async fullSync(options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<number> {
    console.log('[VisitSync] 🔄 Starting full sync...');
    await this.clearLocal();
    return await this.syncFromServer(options);
  }
}
