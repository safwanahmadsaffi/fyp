import { DatabaseService } from '../database/DatabaseService';
import allocService, { GetAllocationsParams } from './allocService';

/**
 * Service to sync allocations from server to local database
 */
export class AllocationSyncService {
  /**
   * Fetch allocations from API and save to local database
   * Uses server's _id as primary key
   * @param params Optional query parameters (page, limit, allocationDate, isActive)
   */
  public static async syncFromServer(params?: GetAllocationsParams): Promise<number> {
    try {
      console.log('[AllocationSync] 📥 Fetching allocations from server...');
      console.log('[AllocationSync] 📋 Query params:', JSON.stringify(params));
      
      // 1. Fetch from API with optional parameters
      const response = await allocService.getMyAllocations(params);
      const allocations = response?.data?.allocations || [];
      
      console.log('[AllocationSync] ✅ Fetched', allocations.length, 'allocations from API');
      console.log('[AllocationSync] 📊 Total records to sync:', allocations.length);
      
      if (allocations.length === 0) {
        console.log('[AllocationSync] ℹ️ No allocations found for the given criteria');
        return 0;
      }
      
      const db = DatabaseService.getInstance().getDatabase();
      let syncedCount = 0;
      
      // 2. Insert/Update each allocation and its shop
      for (const alloc of allocations) {
        const shop = alloc.shop;
        
        if (!shop) {
          console.warn('[AllocationSync] ⚠️ Skipping allocation without shop:', alloc._id);
          continue;
        }
        
        try {
          // Log allocation data for debugging
          console.log('[AllocationSync] 📋 Processing allocation:', {
            id: alloc._id,
            frequency: alloc.frequency,
            days: alloc.days,
            daysType: typeof alloc.days,
            assignedDays: alloc.assignedDays,
            assignedDaysType: typeof alloc.assignedDays
          });
          
          // Insert/Update Shop using server's _id
          await db.executeSql(
            `INSERT OR REPLACE INTO shops 
             (id, name, address, owner_name, owner_phone, latitude, longitude, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              shop._id || shop.id,
              shop.name || '',
              shop.address || '',
              shop.owner || '',
              shop.phone || '',
              shop.location?.latitude || null,
              shop.location?.longitude || null,
              shop.createdAt || new Date().toISOString(),
              shop.updatedAt || new Date().toISOString()
            ]
          );
          
          console.log('[AllocationSync] 💾 Saved shop to DB:', shop._id, '-', shop.name);
          
          // Insert/Update Allocation using server's _id
          // API uses 'days' field, not 'assignedDays'
          const daysData = alloc.days || alloc.assignedDays;
          const daysJson = typeof daysData === 'string' 
            ? daysData 
            : JSON.stringify(daysData || []);
          
          await db.executeSql(
            `INSERT OR REPLACE INTO allocations 
             (id, user_id, shop_id, frequency, assigned_days, start_date, end_date, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              alloc._id || alloc.id,
              alloc.userId || 'current-user',
              shop._id || shop.id,
              alloc.frequency || 'single',
              daysJson,
              alloc.startDate || new Date().toISOString(),
              alloc.endDate || null,
              alloc.isActive !== undefined ? (alloc.isActive ? 'active' : 'inactive') : 'active',
              alloc.createdAt || new Date().toISOString(),
              alloc.updatedAt || new Date().toISOString()
            ]
          );
          
          console.log('[AllocationSync] 💾 Saved allocation to DB:', alloc._id);
          syncedCount++;
          
        } catch (error) {
          console.error('[AllocationSync] ❌ Failed to save allocation:', alloc._id, error);
        }
      }
      
      console.log('[AllocationSync] 🎉 Synced', syncedCount, 'allocations to local database');
      return syncedCount;
      
    } catch (error) {
      console.error('[AllocationSync] ❌ Failed to sync from server:', error);
      throw error;
    }
  }
  
  /**
   * Clear all local allocations and shops (use before full re-sync)
   */
  public static async clearLocal(): Promise<void> {
    try {
      const db = DatabaseService.getInstance().getDatabase();
      
      await db.executeSql('DELETE FROM allocations');
      await db.executeSql('DELETE FROM shops');
      
      console.log('[AllocationSync] 🗑️ Cleared local allocations and shops');
    } catch (error) {
      console.error('[AllocationSync] ❌ Failed to clear local data:', error);
      throw error;
    }
  }
  
  /**
   * Full sync: clear local data then sync from server
   */
  public static async fullSync(): Promise<number> {
    console.log('[AllocationSync] 🔄 Starting full sync...');
    await this.clearLocal();
    return await this.syncFromServer();
  }
}
