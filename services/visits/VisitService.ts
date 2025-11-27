// import { DatabaseService } from '../database/DatabaseService';
// import { generateId } from '../utils/uid';

// export class VisitService {
//   public static async createPlanned(params: {
//     userId: string;
//     shopId: string;
//     allocationId?: string;
//     date: Date;
//     notes?: string;
//   }): Promise<string> {
//     const id = generateId();
//     const db = DatabaseService.getInstance().getDatabase();
//     await db.executeSql(
//       `INSERT INTO visits (id, user_id, shop_id, allocation_id, visit_date, status, notes, synced)
//        VALUES (?, ?, ?, ?, ?, 'planned', ?, 0)`,
//       [id, params.userId, params.shopId, params.allocationId ?? null, params.date.toISOString().slice(0,10), params.notes ?? null],
//     );
//     return id;
//   }

//   public static async completeVisit(params: {
//     visitId: string;
//     notes?: string;
//   }): Promise<void> {
//     const db = DatabaseService.getInstance().getDatabase();
//     await db.executeSql(
//       `UPDATE visits SET status = 'completed', notes = COALESCE(?, notes), synced = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
//       [params.notes ?? null, params.visitId],
//     );
//   }
// }

// ************************************************************************************************

// import { DatabaseService } from '../database/DatabaseService';
// import { generateId } from '../utils/uid';

// type VisitStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

// export interface Visit {
//   id: string;
//   user_id: string;
//   shop_id: string;
//   allocation_id: string | null;
//   visit_date: string; // Format: YYYY-MM-DD
//   status: VisitStatus;
//   notes: string | null;
//   synced: number; // 0 = not synced, 1 = synced
//   created_at: string; // ISO date string
//   updated_at: string | null; // ISO date string
// }

// interface CreateVisitParams {
//   userId: string;
//   shopId: string;
//   allocationId?: string;
//   date: Date;
//   notes?: string;
//   status?: VisitStatus;
// }

// interface UpdateVisitParams extends Partial<Omit<Visit, 'id' | 'created_at'>> {
//   notes?: string | null;
//   status?: VisitStatus;
// }

// interface VisitFilter {
//   userId?: string;
//   shopId?: string;
//   status?: VisitStatus;
//   startDate?: Date;
//   endDate?: Date;
//   limit?: number;
//   offset?: number;
// }

// // Helper function to safely access SQLite result rows
// const getResultRows = <T = any>(result: any): T[] => {
//   if (!result || !result.rows) return [];
  
//   // Handle different SQLite result formats
//   if (result.rows._array) {
//     return result.rows._array as T[];
//   }
  
//   if (typeof result.rows.item === 'function') {
//     const items: T[] = [];
//     for (let i = 0; i < result.rows.length; i++) {
//       items.push(result.rows.item(i) as T);
//     }
//     return items;
//   }
  
//   return [];
// };

// export class VisitService {
//   /**
//    * Creates a new visit record
//    */
//   public static async createVisit(params: CreateVisitParams): Promise<string> {
//     const db = DatabaseService.getInstance().getDatabase();
//     if (!db) {
//       throw new Error('Database connection not initialized');
//     }

//     const id = generateId();
//     const visitDate = params.date.toISOString().split('T')[0]; // YYYY-MM-DD format
//     const status = params.status || 'planned';
//     const now = new Date().toISOString();

//     try {
//       await db.transaction(async (tx) => {
//         await tx.executeSql(
//           `INSERT INTO visits (
//             id, user_id, shop_id, allocation_id, 
//             visit_date, status, notes, synced, created_at, updated_at
//           ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
//           [
//             id,
//             params.userId,
//             params.shopId,
//             params.allocationId || null,
//             visitDate,
//             status,
//             params.notes || null,
//             now,
//             now
//           ]
//         );
//       });
      
//       return id;
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//       console.error('VisitService.createVisit error:', errorMessage, { params });
//       throw new Error(`Failed to create visit: ${errorMessage}`);
//     }
//   }

//   /**
//    * Creates a new planned visit (for backward compatibility)
//    */
//   public static async createPlanned(params: Omit<CreateVisitParams, 'status'>): Promise<string> {
//     return this.createVisit({ ...params, status: 'planned' });
//   }

//   /**
//    * Updates an existing visit
//    */
//   public static async updateVisit(
//     visitId: string, 
//     updates: Partial<Omit<Visit, 'id' | 'created_at'>>
//   ): Promise<boolean> {
//     const db = DatabaseService.getInstance().getDatabase();
//     if (!db) {
//       throw new Error('Database connection not initialized');
//     }

//     try {
//       const fields = Object.entries(updates)
//         .filter(([_, value]) => value !== undefined)
//         .map(([key]) => `${key} = ?`)
//         .join(', ');
      
//       const values = Object.entries(updates)
//         .filter(([_, value]) => value !== undefined)
//         .map(([_, value]) => value);

//       if (fields.length === 0) {
//         return true; // Nothing to update
//       }

//       const [result] = await db.executeSql(
//         `UPDATE visits 
//          SET ${fields}, updated_at = datetime('now')
//          WHERE id = ?`,
//         [...values, visitId]
//       );

//       return result.rowsAffected > 0;
//     } catch (error) {
//       console.error('VisitService.updateVisit error:', error);
//       throw new Error(`Failed to update visit: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }

//   /**
//    * Marks a visit as completed
//    */
//   public static async completeVisit(params: {
//     visitId: string;
//     notes?: string;
//   }): Promise<boolean> {
//     return this.updateVisit(params.visitId, {
//       status: 'completed',
//       notes: params.notes,
//       synced: 0
//     });
//   }

//   /**
//    * Gets visit details by ID
//    */
//   public static async getVisit(visitId: string): Promise<Visit | null> {
//     const db = DatabaseService.getInstance().getDatabase();
//     if (!db) {
//       throw new Error('Database connection not initialized');
//     }

//     try {
//       const [result] = await db.executeSql(
//         `SELECT 
//           id, user_id, shop_id, allocation_id, 
//           visit_date, status, notes, synced, 
//           created_at, updated_at 
//         FROM visits 
//         WHERE id = ?`,
//         [visitId]
//       );

//       const visits = getResultRows<Visit>(result);
//       return visits[0] || null;
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//       console.error('VisitService.getVisit error:', errorMessage, { visitId });
//       throw new Error(`Failed to get visit: ${errorMessage}`);
//     }
//   }

//   /**
//    * Gets visits with optional filtering
//    */
//   public static async getVisits(filter: VisitFilter = {}): Promise<Visit[]> {
//     const db = DatabaseService.getInstance().getDatabase();
//     if (!db) {
//       throw new Error('Database connection not initialized');
//     }

//     try {
//       const whereClauses: string[] = [];
//       const params: any[] = [];

//       if (filter.userId) {
//         whereClauses.push('user_id = ?');
//         params.push(filter.userId);
//       }

//       if (filter.shopId) {
//         whereClauses.push('shop_id = ?');
//         params.push(filter.shopId);
//       }

//       if (filter.status) {
//         whereClauses.push('status = ?');
//         params.push(filter.status);
//       }

//       if (filter.startDate) {
//         whereClauses.push('visit_date >= ?');
//         params.push(filter.startDate.toISOString().split('T')[0]);
//       }

//       if (filter.endDate) {
//         whereClauses.push('visit_date <= ?');
//         params.push(filter.endDate.toISOString().split('T')[0]);
//       }

//       let query = `
//         SELECT 
//           id, user_id, shop_id, allocation_id, 
//           visit_date, status, notes, synced, 
//           created_at, updated_at 
//         FROM visits
//       `;

//       if (whereClauses.length > 0) {
//         query += ` WHERE ${whereClauses.join(' AND ')}`;
//       }

//       query += ' ORDER BY visit_date DESC';

//       if (filter.limit !== undefined) {
//         query += ' LIMIT ?';
//         params.push(filter.limit);

//         if (filter.offset !== undefined) {
//           query += ' OFFSET ?';
//           params.push(filter.offset);
//         }
//       }

//       const [result] = await db.executeSql(query, params);
//       return getResultRows<Visit>(result);
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//       console.error('VisitService.getVisits error:', errorMessage, { filter });
//       throw new Error(`Failed to get visits: ${errorMessage}`);
//     }
//   }

//   /**
//    * Gets all visits for a user
//    */
//   public static async getUserVisits(
//     userId: string, 
//     options: Omit<VisitFilter, 'userId'> = {}
//   ): Promise<Visit[]> {
//     return this.getVisits({ ...options, userId });
//   }

//   /**
//    * Gets all visits for a shop
//    */
//   public static async getShopVisits(
//     shopId: string,
//     options: Omit<VisitFilter, 'shopId'> = {}
//   ): Promise<Visit[]> {
//     return this.getVisits({ ...options, shopId });
//   }
// }


import { DatabaseService } from '../database/DatabaseService';
import { generateId } from '../utils/uid';
import visitApiService from './visitApiService';
import { OfflineFirstService } from '../sync/OfflineFirstService';

type VisitStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface Visit {
  id: string;
  user_id: string;
  shop_id: string;
  allocation_id: string | null;
  visit_date: string; // Format: YYYY-MM-DD
  status: VisitStatus;
  notes: string | null;
  synced: number; // 0 = not synced, 1 = synced
  created_at: string; // ISO date string
  updated_at: string | null; // ISO date string
}

interface CreateVisitParams {
  userId: string;
  shopId: string;
  allocationId: string; // Required for API
  date: Date;
  notes?: string;
  status?: VisitStatus;
}

interface UpdateVisitParams extends Partial<Omit<Visit, 'id' | 'created_at'>> {
  notes?: string | null;
  status?: VisitStatus;
}

interface VisitFilter {
  userId?: string;
  shopId?: string;
  status?: VisitStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// Helper to extract result rows safely
const getResultRows = <T = any>(result: any): T[] => {
  if (!result || !result.rows) return [];
  if (result.rows._array) return result.rows._array as T[];

  if (typeof result.rows.item === 'function') {
    const items: T[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      items.push(result.rows.item(i) as T);
    }
    return items;
  }

  return [];
};

export class VisitService {
  /**
   * ✅ Create new visit - calls API with offline fallback
   */
  public static async createVisit(params: CreateVisitParams): Promise<string> {
    const id = generateId();
    const visitDateTime = params.date.toISOString();
    const status = params.status || 'completed';
    const hasAllocation = !!params.allocationId;

    try {
      // If we have an allocationId, try API first with offline fallback
      let result: any = null;
      if (hasAllocation) {
        result = await OfflineFirstService.execute(
          () => visitApiService.createVisit({
            allocationId: params.allocationId!,
            visitDateTime: visitDateTime,
            duration: 30, // Default duration
            notes: params.notes || '',
          }),
          {
            tableName: 'visits',
            recordId: id,
            operation: 'INSERT',
            data: {
              id,
              user_id: params.userId,
              shop_id: params.shopId,
              allocation_id: params.allocationId,
              visit_date: params.date.toISOString().split('T')[0],
              status,
              notes: params.notes || null,
            },
          }
        );
      }

      // If API succeeded, return the server-generated ID
      if (result && result.data?.visit?._id) {
        console.log('✅ Visit created via API:', result.data.visit._id);
        return result.data.visit._id;
      }

      // If offline or API failed, store locally and return local ID
      const db = DatabaseService.getInstance().getDatabase();
      if (db) {
        const visitDate = params.date.toISOString().split('T')[0];
        const now = new Date().toISOString();

        await db.executeSql(
          `INSERT INTO visits (
            id, user_id, shop_id, allocation_id,
            visit_date, status, notes, synced, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [
            id,
            params.userId,
            params.shopId,
            hasAllocation ? params.allocationId : null,
            visitDate,
            status,
            params.notes || null,
            now,
            now,
          ]
        );
      }

      console.log('✅ Visit created locally:', id);
      return id;
    } catch (error: any) {
      console.error('❌ VisitService.createVisit error:', error?.message);
      throw error;
    }
  }

  /**
   * Create planned visit (shortcut)
   */
  public static async createPlanned(params: Omit<CreateVisitParams, 'status'>): Promise<string> {
    return this.createVisit({ ...params, status: 'planned' });
  }

  /**
   * Get my visits from API
   */
  public static async getMyVisits(params: { page?: number; limit?: number } = {}) {
    try {
      const result = await visitApiService.getMyVisits(params);
      console.log('✅ Fetched my visits:', result.data?.visits?.length || 0);
      return result;
    } catch (error: any) {
      console.error('❌ VisitService.getMyVisits error:', error?.message);
      throw error;
    }
  }

  /**
   * Get visit by ID from API
   */
  public static async getVisitById(visitId: string) {
    try {
      const result = await visitApiService.getVisitById(visitId);
      console.log('✅ Fetched visit by ID:', visitId);
      return result;
    } catch (error: any) {
      console.error('❌ VisitService.getVisitById error:', error?.message);
      throw error;
    }
  }

  /**
   * Update existing visit
   */
  public static async updateVisit(
    visitId: string,
    updates: Partial<Omit<Visit, 'id' | 'created_at'>>
  ): Promise<boolean> {
    const db = DatabaseService.getInstance().getDatabase();
    if (!db) throw new Error('Database connection not initialized');

    try {
      const fields = Object.entries(updates)
        .filter(([_, value]) => value !== undefined)
        .map(([key]) => `${key} = ?`)
        .join(', ');

      const values = Object.entries(updates)
        .filter(([_, value]) => value !== undefined)
        .map(([_, value]) => value);

      if (fields.length === 0) return true;

      const [result] = await db.executeSql(
        `UPDATE visits 
         SET ${fields}, updated_at = datetime('now')
         WHERE id = ?`,
        [...values, visitId]
      );

      return result.rowsAffected > 0;
    } catch (error) {
      console.error('VisitService.updateVisit error:', error);
      throw new Error(`Failed to update visit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mark visit as completed
   */
  public static async completeVisit(params: {
    visitId: string;
    notes?: string;
  }): Promise<boolean> {
    return this.updateVisit(params.visitId, {
      status: 'completed',
      notes: params.notes,
      synced: 0,
    });
  }

  /**
   * Get visit by ID
   */
  public static async getVisit(visitId: string): Promise<Visit | null> {
    const db = DatabaseService.getInstance().getDatabase();
    if (!db) throw new Error('Database connection not initialized');

    try {
      const [result] = await db.executeSql(
        `SELECT 
          id, user_id, shop_id, allocation_id, 
          visit_date, status, notes, synced, 
          created_at, updated_at 
        FROM visits 
        WHERE id = ?`,
        [visitId]
      );

      const visits = getResultRows<Visit>(result);
      return visits[0] || null;
    } catch (error) {
      console.error('VisitService.getVisit error:', error);
      throw new Error(`Failed to get visit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get multiple visits with filters
   */
  public static async getVisits(filter: VisitFilter = {}): Promise<Visit[]> {
    const db = DatabaseService.getInstance().getDatabase();
    if (!db) throw new Error('Database connection not initialized');

    try {
      const whereClauses: string[] = [];
      const params: any[] = [];

      if (filter.userId) {
        whereClauses.push('user_id = ?');
        params.push(filter.userId);
      }

      if (filter.shopId) {
        whereClauses.push('shop_id = ?');
        params.push(filter.shopId);
      }

      if (filter.status) {
        whereClauses.push('status = ?');
        params.push(filter.status);
      }

      if (filter.startDate) {
        whereClauses.push('visit_date >= ?');
        params.push(filter.startDate.toISOString().split('T')[0]);
      }

      if (filter.endDate) {
        whereClauses.push('visit_date <= ?');
        params.push(filter.endDate.toISOString().split('T')[0]);
      }

      let query = `
        SELECT 
          id, user_id, shop_id, allocation_id, 
          visit_date, status, notes, synced, 
          orders, created_at, updated_at 
        FROM visits
      `;

      if (whereClauses.length > 0) {
        query += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      query += ' ORDER BY visit_date DESC';

      if (filter.limit !== undefined) {
        query += ' LIMIT ?';
        params.push(filter.limit);
        if (filter.offset !== undefined) {
          query += ' OFFSET ?';
          params.push(filter.offset);
        }
      }

      const [result] = await db.executeSql(query, params);
      return getResultRows<Visit>(result);
    } catch (error) {
      console.error('VisitService.getVisits error:', error);
      throw new Error(`Failed to get visits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all visits for a specific user
   */
  public static async getUserVisits(
    userId: string,
    options: Omit<VisitFilter, 'userId'> = {}
  ): Promise<Visit[]> {
    return this.getVisits({ ...options, userId });
  }

  /**
   * Get all visits for a specific shop
   */
  public static async getShopVisits(
    shopId: string,
    options: Omit<VisitFilter, 'shopId'> = {}
  ): Promise<Visit[]> {
    return this.getVisits({ ...options, shopId });
  }
}
