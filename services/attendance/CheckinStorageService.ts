import { DatabaseService } from '../database/DatabaseService';

export interface CheckInRecord {
  _id: string;
  userId: string;
  checkInTime: string;
  checkOutTime?: string;
  checkInNotes?: string;
  durationMs?: number;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
}

/**
 * CheckinStorageService - Manages local storage of check-in records
 * Provides offline-first storage for check-ins and check-outs
 */
export class CheckinStorageService {
  private static instance: CheckinStorageService;
  
  private constructor() {}
  
  public static getInstance(): CheckinStorageService {
    if (!CheckinStorageService.instance) {
      CheckinStorageService.instance = new CheckinStorageService();
    }
    return CheckinStorageService.instance;
  }

  /**
   * Save check-in to local database
   */
  async saveCheckIn(checkIn: CheckInRecord): Promise<void> {
    const db = DatabaseService.getInstance().getDatabase();
    
    try {
      await db.executeSql(
        `INSERT OR REPLACE INTO attendance_records 
        (id, user_id, check_in_time, check_out_time, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          checkIn._id,
          checkIn.userId,
          checkIn.checkInTime,
          checkIn.checkOutTime || null,
          checkIn.checkOutTime ? 'completed' : 'active',
          checkIn.createdAt,
          checkIn.updatedAt,
        ]
      );
      
      console.log('[CheckinStorage] ✅ Saved check-in to local DB:', checkIn._id);
    } catch (error) {
      console.error('[CheckinStorage] ❌ Failed to save check-in:', error);
      throw error;
    }
  }

  /**
   * Update check-out time for existing check-in
   */
  async updateCheckOut(checkInId: string, checkOutTime: string): Promise<void> {
    const db = DatabaseService.getInstance().getDatabase();
    
    try {
      await db.executeSql(
        `UPDATE attendance_records 
        SET check_out_time = ?, status = 'completed', updated_at = ?
        WHERE id = ?`,
        [checkOutTime, new Date().toISOString(), checkInId]
      );
      
      console.log('[CheckinStorage] ✅ Updated check-out in local DB:', checkInId);
    } catch (error) {
      console.error('[CheckinStorage] ❌ Failed to update check-out:', error);
      throw error;
    }
  }

  /**
   * Get all check-ins from local database
   */
  async getAllCheckIns(userId?: string): Promise<CheckInRecord[]> {
    try {
      const db = DatabaseService.getInstance().getDatabase();
      
      if (!db) {
        console.warn('[CheckinStorage] ⚠️ Database not initialized');
        return [];
      }
      
      const query = userId
        ? `SELECT * FROM attendance_records WHERE user_id = ? ORDER BY check_in_time DESC`
        : `SELECT * FROM attendance_records ORDER BY check_in_time DESC`;
      
      const params = userId ? [userId] : [];
      const [result] = await db.executeSql(query, params);
      
      const checkIns: CheckInRecord[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        checkIns.push({
          _id: row.id,
          userId: row.user_id,
          checkInTime: row.check_in_time,
          checkOutTime: row.check_out_time || undefined,
          checkInNotes: '',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          synced: true, // Assume synced if in DB
        });
      }
      
      console.log('[CheckinStorage] 📥 Loaded', checkIns.length, 'check-ins from local DB');
      return checkIns;
    } catch (error) {
      console.error('[CheckinStorage] ❌ Failed to get check-ins:', error);
      return [];
    }
  }

  /**
   * Get active (not checked out) check-in
   */
  async getActiveCheckIn(userId?: string): Promise<CheckInRecord | null> {
    try {
      const db = DatabaseService.getInstance().getDatabase();
      
      if (!db) {
        console.warn('[CheckinStorage] ⚠️ Database not initialized');
        return null;
      }
      
      const query = userId
        ? `SELECT * FROM attendance_records WHERE user_id = ? AND check_out_time IS NULL ORDER BY check_in_time DESC LIMIT 1`
        : `SELECT * FROM attendance_records WHERE check_out_time IS NULL ORDER BY check_in_time DESC LIMIT 1`;
      
      const params = userId ? [userId] : [];
      const [result] = await db.executeSql(query, params);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows.item(0);
      return {
        _id: row.id,
        userId: row.user_id,
        checkInTime: row.check_in_time,
        checkOutTime: row.check_out_time || undefined,
        checkInNotes: '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        synced: true,
      };
    } catch (error) {
      console.error('[CheckinStorage] ❌ Failed to get active check-in:', error);
      return null;
    }
  }

  /**
   * Delete check-in from local database
   */
  async deleteCheckIn(checkInId: string): Promise<void> {
    const db = DatabaseService.getInstance().getDatabase();
    
    try {
      await db.executeSql(
        `DELETE FROM attendance_records WHERE id = ?`,
        [checkInId]
      );
      
      console.log('[CheckinStorage] 🗑️ Deleted check-in from local DB:', checkInId);
    } catch (error) {
      console.error('[CheckinStorage] ❌ Failed to delete check-in:', error);
      throw error;
    }
  }

  /**
   * Sync check-ins from server to local database
   * Maps server response format to local DB format
   */
  async syncFromServer(serverCheckIns: any[]): Promise<void> {
    console.log('[CheckinStorage] 🔄 Syncing', serverCheckIns.length, 'check-ins from server...');
    
    for (const checkIn of serverCheckIns) {
      try {
        // Map server format to local format
        // Server uses 'user' field, local DB uses 'userId'
        const mappedCheckIn: CheckInRecord = {
          _id: checkIn._id,
          userId: checkIn.user || checkIn.userId, // Handle both formats
          checkInTime: checkIn.checkInTime,
          checkOutTime: checkIn.checkOutTime,
          checkInNotes: checkIn.checkInNotes || '',
          durationMs: checkIn.durationMs,
          createdAt: checkIn.createdAt,
          updatedAt: checkIn.updatedAt,
          synced: true,
        };
        
        await this.saveCheckIn(mappedCheckIn);
      } catch (error) {
        console.error('[CheckinStorage] ⚠️ Failed to sync check-in:', checkIn._id, error);
      }
    }
    
    console.log('[CheckinStorage] ✅ Sync complete');
  }

  /**
   * Clear all check-ins (for testing/reset)
   */
  async clearAll(): Promise<void> {
    const db = DatabaseService.getInstance().getDatabase();
    
    try {
      await db.executeSql(`DELETE FROM attendance_records`);
      console.log('[CheckinStorage] 🗑️ Cleared all check-ins from local DB');
    } catch (error) {
      console.error('[CheckinStorage] ❌ Failed to clear check-ins:', error);
      throw error;
    }
  }
}
