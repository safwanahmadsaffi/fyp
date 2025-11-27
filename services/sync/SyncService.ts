import { DatabaseService } from '../database/DatabaseService';
import { NetworkUtils } from '../utils/NetworkUtils';
import attendService from '../attendance/attendService';
import trackService from '../tracking/trackService';
import visitApiService from '../visits/visitApiService';
import orderApiService from '../orders/orderApiService';

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface SyncItem {
  id: string;
  table_name: string;
  record_id: string;
  operation: SyncOperation;
  data: string;
  timestamp: string;
  retry_count: number;
}

type SyncHandler = (item: SyncItem) => Promise<boolean>;

export class SyncService {
  private static instance: SyncService;
  private handler: SyncHandler | null = null;
  private processing = false;
  private intervalId: any = null;

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  public setHandler(handler: SyncHandler) {
    this.handler = handler;
  }

  // Enhanced handler that routes to respective APIs
  public setSmartApiHandler() {
    this.setHandler(async (item) => {
      try {
        const parsedData = JSON.parse(item.data);
        console.log(`[SyncService] 🔄 Syncing ${item.table_name} (${item.operation}):`, item.record_id);

        switch (item.table_name) {
          case 'attendance_records':
            console.log('[SyncService] 📍 Routing to syncAttendance');
            return await this.syncAttendance(item, parsedData);
          
          case 'trackings':
          case 'location_tracking':
            console.log('[SyncService] 📍 Routing to syncTracking');
            return await this.syncTracking(item, parsedData);
          
          case 'visits':
            console.log('[SyncService] 📍 Routing to syncVisit');
            return await this.syncVisit(item, parsedData);
          
          case 'orders':
            console.log('[SyncService] 📍 Routing to syncOrder');
            return await this.syncOrder(item, parsedData);
          
          default:
            console.warn(`[SyncService] ⚠️ Unknown table: ${item.table_name}`);
            console.warn(`[SyncService] ℹ️ Supported tables: attendance_records, trackings, location_tracking, visits, orders`);
            return false;
        }
      } catch (error) {
        console.error(`[SyncService] ❌ Sync failed for ${item.table_name}:`, error);
        if (error instanceof SyntaxError) {
          console.error(`[SyncService] ⚠️ JSON parse error - invalid data format`);
        }
        return false;
      }
    });
  }

  private async syncAttendance(item: SyncItem, data: any): Promise<boolean> {
    try {
      console.log('[SyncService] 🔄 Syncing attendance:', data);
      if (item.operation === 'INSERT') {
        // Check-in - only sync if we have valid data
        if (!data.check_in_time && !data.checkInTime) {
          console.warn('[SyncService] ⚠️ Skipping attendance INSERT - no check_in_time');
          return true; // Mark as synced to remove from queue
        }

        console.log('[SyncService] 🔄 Syncing check-in:', {
          checkInTime: data.check_in_time || data.checkInTime,
          checkInNotes: data.check_in_notes || data.checkInNotes || '',
        });

        const checkIn = await attendService.createCheckIn({
          checkInNotes: data.check_in_notes || data.checkInNotes || '',
          checkInTime: data.check_in_time || data.checkInTime,
        });
        console.log('[SyncService] ✅ Attendance check-in synced', checkIn);
        return true;
      } else if (item.operation === 'UPDATE') {
        // Check-out - only sync if we have the record_id
        if (!item.record_id) {
          console.warn('[SyncService] ⚠️ Skipping attendance UPDATE - no record_id');
          return true; // Mark as synced to remove from queue
        }

        console.log('[SyncService] 🔄 Syncing check-out:', {
          id: item.record_id,
          checkOutTime: data.check_out_time || data.checkOutTime,
        });

        const checkOut = await attendService.checkOut(item.record_id, {
          checkOutTime: data.check_out_time || data.checkOutTime,
        });
        console.log('[SyncService] ✅ Attendance check-out synced', checkOut);
        return true;
      }
      console.warn(`[SyncService] ⚠️ Unsupported operation for attendance: ${item.operation}`);
      console.warn('[SyncService] ℹ️ Attendance only supports: INSERT (check-in), UPDATE (check-out)');
      return false;
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
      const statusCode = error?.response?.status;
      const errorData = error?.response?.data;
      
      console.error(`[SyncService] ❌ Attendance sync failed (${statusCode}):`, errorMsg);
      console.error('[SyncService] Error details:', errorData);
      console.error('[SyncService] Failed data:', { operation: item.operation, record_id: item.record_id, data });
      
      // If it's a 404 or 409 (already exists), mark as synced to remove from queue
      if (statusCode === 404 || statusCode === 409 || statusCode === 400) {
        console.warn('[SyncService] ⚠️ Marking as synced due to client error');
        return true;
      }
      
      // If it's a 500 error and retry count is high, mark as synced to prevent infinite retries
      if (statusCode === 500 && item.retry_count >= 5) {
        console.warn('[SyncService] ⚠️ Marking as synced after 5 retries (500 error)');
        return true;
      }
      
      return false;
    }
  }

  private async syncTracking(item: SyncItem, data: any): Promise<boolean> {
    try {
      console.log('[SyncService] 🔄 Syncing tracking:', data);
      if (item.operation === 'INSERT') {
        // Validate location data
        if (!data.longitude || !data.latitude) {
          console.warn('[SyncService] ⚠️ Skipping tracking INSERT - missing coordinates');
          return true; // Mark as synced to remove from queue
        }

        console.log('[SyncService] 🔄 Syncing tracking:', {
          longitude: data.longitude,
          latitude: data.latitude,
        });

        const tracking = await trackService.createTracking({
          location: {
            longitude: data.longitude,
            latitude: data.latitude,
          },
        });
        console.log('[SyncService] ✅ Location tracking synced', tracking);
        return true;
      }
      console.warn(`[SyncService] ⚠️ Unsupported operation for tracking: ${item.operation}`);
      console.warn('[SyncService] ℹ️ Tracking only supports: INSERT');
      return false;
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
      const statusCode = error?.response?.status;
      const errorData = error?.response?.data;
      
      console.error(`[SyncService] ❌ Tracking sync failed (${statusCode}):`, errorMsg);
      console.error('[SyncService] Error details:', errorData);
      
      // If it's a client error, mark as synced to remove from queue
      if (statusCode === 404 || statusCode === 409 || statusCode === 400) {
        console.warn('[SyncService] ⚠️ Marking as synced due to client error');
        return true;
      }
      
      // If it's a 500 error and retry count is high, mark as synced to prevent infinite retries
      if (statusCode === 500 && item.retry_count >= 5) {
        console.warn('[SyncService] ⚠️ Marking as synced after 5 retries (500 error)');
        return true;
      }
      
      return false;
    }
  }

  private async syncVisit(item: SyncItem, data: any): Promise<boolean> {
    try {
      console.log('[SyncService] 🔄 Syncing visit:', data);
      
      if (item.operation === 'INSERT') {
        // Validate visit data
        if (!data.allocation_id && !data.allocationId) {
          console.warn('[SyncService] ⚠️ Skipping visit INSERT - missing allocation_id');
          return true; // Mark as synced to remove from queue
        }

        const visitDateTime = data.visit_date 
          ? new Date(data.visit_date).toISOString() 
          : new Date().toISOString();

        console.log('[SyncService] 🔄 Creating visit:', {
          allocationId: data.allocation_id || data.allocationId,
          visitDateTime: visitDateTime,
          duration: data.duration || 30,
          hasOrders: !!data.orders,
          ordersCount: data.orders?.length || 0,
        });

        // Create visit with orders if present
        const payload: any = {
          allocationId: data.allocation_id || data.allocationId,
          visitDateTime: visitDateTime,
          duration: data.duration || 30,
          notes: data.notes || '',
        };

        // If this is an offline visit with orders, create then update
        if (data.orders && data.orders.length > 0) {
          const createResponse = await visitApiService.createVisit(payload);
          const visitId = createResponse?.data?.visit?._id || 
                         createResponse?.data?._id || 
                         createResponse?.visit?._id ||
                         createResponse?._id;
          
          if (visitId) {
            console.log('[SyncService] ✅ Visit created, now updating with orders...');
            await visitApiService.updateVisit(visitId, {
              duration: data.duration || 30,
              notes: data.notes || '',
              orders: data.orders,
            });
            console.log('[SyncService] ✅ Visit updated with orders');
          }
        } else {
          await visitApiService.createVisit(payload);
        }
        
        console.log('[SyncService] ✅ Visit synced successfully');
        return true;
      }
      
      if (item.operation === 'UPDATE') {
        // Handle visit updates (e.g., adding orders to existing visit)
        const visitId = data.visit_id || item.record_id;
        
        if (!visitId) {
          console.warn('[SyncService] ⚠️ Skipping visit UPDATE - missing visit_id');
          return true;
        }

        // Skip offline visits (they'll be created via INSERT)
        if (visitId.startsWith('offline_')) {
          console.warn('[SyncService] ⚠️ Skipping offline visit UPDATE - will be created instead');
          return true;
        }

        console.log('[SyncService] 🔄 Updating visit:', {
          visitId: visitId,
          hasOrders: !!data.orders,
          ordersCount: data.orders?.length || 0,
        });

        const updatePayload: any = {
          duration: data.duration || 30,
          notes: data.notes || '',
        };

        if (data.orders) {
          updatePayload.orders = data.orders;
        }

        await visitApiService.updateVisit(visitId, updatePayload);
        console.log('[SyncService] ✅ Visit updated successfully');
        return true;
      }
      
      console.warn(`[SyncService] ⚠️ Unsupported operation for visits: ${item.operation}`);
      console.warn('[SyncService] ℹ️ Visits supports: INSERT, UPDATE');
      return false;
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
      const statusCode = error?.response?.status;
      const errorData = error?.response?.data;
      
      console.error(`[SyncService] ❌ Visit sync failed (${statusCode}):`, errorMsg);
      console.error('[SyncService] Error details:', errorData);
      
      // If it's a client error, mark as synced to remove from queue
      if (statusCode === 404 || statusCode === 409 || statusCode === 400) {
        console.warn('[SyncService] ⚠️ Marking as synced due to client error');
        return true;
      }
      
      // If it's a 500 error and retry count is high, mark as synced to prevent infinite retries
      if (statusCode === 500 && item.retry_count >= 5) {
        console.warn('[SyncService] ⚠️ Marking as synced after 5 retries (500 error)');
        return true;
      }
      
      return false;
    }
  }

  private async syncOrder(item: SyncItem, data: any): Promise<boolean> {
    try {
      console.log('[SyncService] 🔄 Syncing order:', data);
      if (item.operation === 'INSERT') {
        // Validate order data
        if (!data.shop_id || !data.items) {
          console.warn('[SyncService] ⚠️ Skipping order INSERT - missing required fields');
          return true; // Mark as synced to remove from queue
        }

        const items = typeof data.items === 'string' ? JSON.parse(data.items) : data.items;

        if (!items || items.length === 0) {
          console.warn('[SyncService] ⚠️ Skipping order INSERT - no items');
          return true;
        }

        console.log('[SyncService] 🔄 Syncing order:', {
          shopId: data.shop_id,
          shopName: data.shop_name,
          itemCount: items.length,
        });

        const order = await orderApiService.createOrder({
          shopId: data.shop_id,
          shopName: data.shop_name,
          items: items,
          totalAmount: data.total_amount,
          notes: data.notes || '',
          orderDate: data.order_date || new Date().toISOString(),
        });

        console.log('[SyncService] ✅ Order synced', order);
        return true;
      }
      console.warn(`[SyncService] ⚠️ Unsupported operation for orders: ${item.operation}`);
      console.warn('[SyncService] ℹ️ Orders only supports: INSERT');
      return false;
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
      const statusCode = error?.response?.status;
      const errorData = error?.response?.data;
      
      console.error(`[SyncService] ❌ Order sync failed (${statusCode}):`, errorMsg);
      console.error('[SyncService] Error details:', errorData);
      
      // If it's a client error, mark as synced to remove from queue
      if (statusCode === 404 || statusCode === 409 || statusCode === 400) {
        console.warn('[SyncService] ⚠️ Marking as synced due to client error');
        return true;
      }
      
      // If it's a 500 error and retry count is high, mark as synced to prevent infinite retries
      if (statusCode === 500 && item.retry_count >= 5) {
        console.warn('[SyncService] ⚠️ Marking as synced after 5 retries (500 error)');
        return true;
      }
      
      return false;
    }
  }

  public setDefaultHttpHandler(baseUrl: string) {
    this.setHandler(async (item) => {
      try {
        const path = `/sync/${encodeURIComponent(item.table_name)}`;
        const res = await fetch(`${baseUrl}${path}`, {
          method: item.operation === 'DELETE' ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: item.operation === 'DELETE' ? JSON.stringify({ id: item.record_id }) : item.data,
        });
        return res.ok;
      } catch (_e) {
        return false;
      }
    });
  }

  public async processQueue(limit: number = 25): Promise<void> {
    if (this.processing) return;
    
    // Check network status
    const isOnline = await NetworkUtils.checkConnection();
    if (!isOnline) {
      console.log('[SyncService] 🔴 Offline - skipping sync');
      return;
    }

    this.processing = true;
    console.log('[SyncService] 🔄 Processing sync queue...');

    try {
      const db = DatabaseService.getInstance().getDatabase();
      const [res] = await db.executeSql(
        `SELECT id, table_name, record_id, operation, data, timestamp, retry_count
         FROM sync_queue WHERE synced = 0 ORDER BY timestamp ASC LIMIT ?`,
        [limit],
      );
      
      const rows: SyncItem[] = [];
      for (let i = 0; i < res.rows.length; i++) {
        rows.push(res.rows.item(i));
      }
      
      if (rows.length === 0) {
        console.log('[SyncService] ✅ Queue is empty');
        return;
      }

      console.log(rows);
      console.log(`[SyncService] 📦 Found ${rows.length} items to sync`);
      let successCount = 0;
      let failCount = 0;
      let skippedCount = 0;

      for (const item of rows) {
        // Auto-remove items with excessive retries (>10)
        if (item.retry_count >= 10) {
          console.warn(`[SyncService] 🗑️ Removing item with ${item.retry_count} retries: ${item.table_name}/${item.record_id}`);
          await db.executeSql(
            `UPDATE sync_queue SET synced = 1 WHERE id = ?`,
            [item.id]
          );
          skippedCount++;
          continue;
        }

        // Enhanced logging before handler execution
        console.log(`[SyncService] 🔍 Processing item:`, {
          id: item.id,
          table: item.table_name,
          operation: item.operation,
          record_id: item.record_id,
          retry_count: item.retry_count,
          data_preview: item.data.substring(0, 100)
        });

        let ok = false;
        try {
          ok = this.handler ? await this.handler(item) : true;
          console.log(`[Handler] Result for ${item.table_name}/${item.operation}: ${ok}`);
        } catch (error) {
          console.error(`[SyncService] ❌ Handler error for ${item.id}:`, error);
          ok = false;
        }

        if (ok) {
          await db.executeSql(
            `UPDATE sync_queue SET synced = 1 WHERE id = ?`,
            [item.id]
          );
          successCount++;
          console.log(`[SyncService] ✅ Synced: ${item.table_name}/${item.record_id}`);
        } else {
          await db.executeSql(
            `UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?`,
            [item.id]
          );
          failCount++;
          console.warn(`[SyncService] ⚠️ Failed: ${item.table_name}/${item.record_id} (retry: ${item.retry_count + 1})`);
        }
      }

      if (skippedCount > 0) {
        console.log(`[SyncService] 🗑️ Removed ${skippedCount} items with excessive retries`);
      }

      console.log(`[SyncService] 📊 Sync complete: ${successCount} success, ${failCount} failed`);
    } catch (error) {
      console.error('[SyncService] ❌ Queue processing error:', error);
    } finally {
      this.processing = false;
    }
  }

  public startBackground(intervalMs: number = 15000) {
    if (this.intervalId) return;
    console.log('[SyncService] ⏳ Background sync started');
    
    this.intervalId = setInterval(() => {
      this.processQueue().catch(() => undefined);
    }, intervalMs);

    // Listen for network changes
    NetworkUtils.subscribe((isOnline) => {
      if (isOnline) {
        console.log('[SyncService] 🟢 Network restored - triggering sync');
        this.processQueue().catch(() => undefined);
      }
    });
  }

  public stopBackground() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[SyncService] ⛔ Background sync stopped');
    }
  }

  public async getSyncPendingCount(): Promise<number> {
    try {
      const db = DatabaseService.getInstance().getDatabase();
      const [res] = await db.executeSql(
        `SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0`,
        []
      );
      return res.rows.item(0)?.count || 0;
    } catch (error) {
      console.error('[SyncService] Error getting pending count:', error);
      return 0;
    }
  }
}


