import { DatabaseService } from '../database/DatabaseService';
import { enqueueSync } from '../sync/enqueue';
import { LocationTracker } from '../tracking/LocationTracker';

export class AttendanceService {
  public static async checkIn(params: {
    id: string;
    userId: string;
    shopId?: string;
    latitude?: number;
    longitude?: number;
    when?: Date;
  }): Promise<void> {
    const db = DatabaseService.getInstance().getDatabase();
    const whenIso = (params.when ?? new Date()).toISOString();
    await db.executeSql(
      `INSERT OR REPLACE INTO attendance_records (
        id, user_id, shop_id, check_in_time, check_in_latitude, check_in_longitude, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [
        params.id,
        params.userId,
        params.shopId ?? null,
        whenIso,
        params.latitude ?? null,
        params.longitude ?? null,
      ],
    );
    await enqueueSync('attendance_records', params.id, 'INSERT', {
      id: params.id,
      user_id: params.userId,
      shop_id: params.shopId ?? null,
      check_in_time: whenIso,
      check_in_latitude: params.latitude ?? null,
      check_in_longitude: params.longitude ?? null,
      status: 'active',
    });
    await LocationTracker.start(params.id);
  }

  public static async checkOut(params: {
    id: string;
    latitude?: number;
    longitude?: number;
    when?: Date;
  }): Promise<void> {
    const db = DatabaseService.getInstance().getDatabase();
    const whenIso = (params.when ?? new Date()).toISOString();
    await db.executeSql(
      `UPDATE attendance_records
       SET check_out_time = ?, check_out_latitude = ?, check_out_longitude = ?, status = 'completed'
       WHERE id = ?`,
      [whenIso, params.latitude ?? null, params.longitude ?? null, params.id],
    );
    await enqueueSync('attendance_records', params.id, 'UPDATE', {
      id: params.id,
      check_out_time: whenIso,
      check_out_latitude: params.latitude ?? null,
      check_out_longitude: params.longitude ?? null,
      status: 'completed',
    });
    LocationTracker.stop();
  }

  // Close any open records by setting checkout to midnight of the next day after check-in
  public static async closeStaleOpenRecords(): Promise<void> {
    const db = DatabaseService.getInstance().getDatabase();
    const [res] = await db.executeSql(
      `SELECT id, check_in_time FROM attendance_records WHERE status = 'active' AND check_out_time IS NULL`,
    );
    const now = new Date();
    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows.item(i);
      const checkIn = new Date(row.check_in_time);
      // compute next midnight after check-in
      const midnight = new Date(checkIn);
      midnight.setHours(24, 0, 0, 0); // next midnight
      const checkoutAt = midnight < now ? midnight : now;
      await db.executeSql(
        `UPDATE attendance_records
         SET check_out_time = ?, status = 'completed'
         WHERE id = ?`,
        [checkoutAt.toISOString(), row.id],
      );
    }
  }
}


