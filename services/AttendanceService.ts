import { DatabaseService } from './database/DatabaseService';
import { AuthStorageService } from './auth/AuthStorageService';
import { AttendanceRecord, LocationData, LocationTracking } from '../types/database';
import Geolocation from 'react-native-geolocation-service';

export class AttendanceService {
  private static instance: AttendanceService;
  private db: DatabaseService;
  private currentRecord: AttendanceRecord | null = null;
  private locationWatchId: number | null = null;
  private isTracking: boolean = false;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): AttendanceService {
    if (!AttendanceService.instance) {
      AttendanceService.instance = new AttendanceService();
    }
    return AttendanceService.instance;
  }

  // Check in to work/location
  public async checkIn(shopId?: string): Promise<AttendanceRecord> {
    try {
      // Get current location
      const location = await this.getCurrentLocation();

      const user = await this.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Check if already checked in
      if (this.currentRecord) {
        throw new Error('Already checked in');
      }

      // Create attendance record
      const recordId = `attendance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const attendanceRecord: Omit<AttendanceRecord, 'id' | 'created_at' | 'updated_at'> = {
        user_id: user.id,
        shop_id: shopId,
        check_in_time: new Date().toISOString(),
        check_in_latitude: location.latitude,
        check_in_longitude: location.longitude,
        location_history: JSON.stringify([location]),
        status: 'active',
        synced: false,
      };

      const db = this.db.getDatabase();

      // Insert record into database
      await db.executeSql(
        `INSERT INTO attendance_records
         (id, user_id, shop_id, check_in_time, check_in_latitude, check_in_longitude, location_history, status, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId,
          attendanceRecord.user_id,
          attendanceRecord.shop_id,
          attendanceRecord.check_in_time,
          attendanceRecord.check_in_latitude,
          attendanceRecord.check_in_longitude,
          attendanceRecord.location_history,
          attendanceRecord.status,
          attendanceRecord.synced ? 1 : 0,
        ]
      );

      // Set as current record
      this.currentRecord = {
        id: recordId,
        ...attendanceRecord,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Start location tracking
      await this.startLocationTracking();

      console.log('Check-in successful');
      return this.currentRecord;
    } catch (error) {
      console.error('Check-in failed:', error);
      throw error;
    }
  }

  // Check out from work/location
  public async checkOut(): Promise<AttendanceRecord | null> {
    try {
      if (!this.currentRecord) {
        throw new Error('Not checked in');
      }

      const location = await this.getCurrentLocation();
      const db = this.db.getDatabase();

      // Stop location tracking first
      await this.stopLocationTracking();

      // Update record with check-out data
      await db.executeSql(
        `UPDATE attendance_records
         SET check_out_time = ?, check_out_latitude = ?, check_out_longitude = ?,
             status = 'completed', updated_at = ?
         WHERE id = ?`,
        [
          new Date().toISOString(),
          location.latitude,
          location.longitude,
          new Date().toISOString(),
          this.currentRecord.id,
        ]
      );

      // Update location history with final location
      const updatedHistory = [
        ...(this.currentRecord.location_history ?
          JSON.parse(this.currentRecord.location_history) : []),
        location,
      ];

      await db.executeSql(
        `UPDATE attendance_records
         SET location_history = ?, updated_at = ?
         WHERE id = ?`,
        [
          JSON.stringify(updatedHistory),
          new Date().toISOString(),
          this.currentRecord.id,
        ]
      );

      // Get final record
      const [results] = await db.executeSql(
        'SELECT * FROM attendance_records WHERE id = ?',
        [this.currentRecord.id]
      );

      if (results.rows.length > 0) {
        const record = results.rows.item(0);
        this.currentRecord = null;

        console.log('Check-out successful');
        return this.mapDatabaseRecordToAttendanceRecord(record);
      }

      return null;
    } catch (error) {
      console.error('Check-out failed:', error);
      throw error;
    }
  }

  // Auto check-out at 12 AM if still checked in
  public async autoCheckOutAtMidnight(): Promise<void> {
    try {
      if (!this.currentRecord) {
        return; // Not checked in
      }

      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);

      const timeUntilMidnight = midnight.getTime() - now.getTime();

      if (timeUntilMidnight > 0) {
        // Schedule auto check-out
        setTimeout(async () => {
          try {
            await this.checkOut();
            console.log('Auto check-out at midnight completed');
          } catch (error) {
            console.error('Auto check-out failed:', error);
          }
        }, timeUntilMidnight);
      } else {
        // It's already past midnight, check out immediately
        await this.checkOut();
      }
    } catch (error) {
      console.error('Auto check-out scheduling failed:', error);
    }
  }

  // Get current attendance record
  public getCurrentRecord(): AttendanceRecord | null {
    return this.currentRecord;
  }

  // Check if currently checked in
  public isCheckedIn(): boolean {
    return this.currentRecord !== null;
  }

  // Get attendance records for a specific date range
  public async getAttendanceRecords(
    startDate?: string,
    endDate?: string
  ): Promise<AttendanceRecord[]> {
    try {
      const db = this.db.getDatabase();
      const user = await this.getCurrentUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      let query = `
        SELECT ar.*, s.name as shop_name, s.address as shop_address
        FROM attendance_records ar
        LEFT JOIN shops s ON ar.shop_id = s.id
        WHERE ar.user_id = ?
      `;

      const params: any[] = [user.id];

      if (startDate && endDate) {
        query += ' AND ar.check_in_time BETWEEN ? AND ?';
        params.push(startDate, endDate);
      }

      query += ' ORDER BY ar.check_in_time DESC';

      const [results] = await db.executeSql(query, params);

      const records: AttendanceRecord[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        records.push(this.mapDatabaseRecordToAttendanceRecord(results.rows.item(i)));
      }

      return records;
    } catch (error) {
      console.error('Failed to get attendance records:', error);
      throw error;
    }
  }

  // Get today's attendance summary
  public async getTodayAttendance(): Promise<{
    isCheckedIn: boolean;
    currentRecord?: AttendanceRecord;
    totalHours?: number;
    shopName?: string;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const records = await this.getAttendanceRecords(today, today);

      if (records.length === 0) {
        return { isCheckedIn: false };
      }

      // Find active record (no check-out time)
      const activeRecord = records.find(r => !r.check_out_time);

      if (activeRecord) {
        const checkInTime = new Date(activeRecord.check_in_time);
        const now = new Date();
        const totalHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

        return {
          isCheckedIn: true,
          currentRecord: activeRecord,
          totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
          shopName: activeRecord.shop_id ? 'Shop Visit' : 'Office',
        };
      }

      // Return last completed record of the day
      const lastRecord = records[records.length - 1];
      return {
        isCheckedIn: false,
        currentRecord: lastRecord,
        shopName: lastRecord.shop_id ? 'Shop Visit' : 'Office',
      };
    } catch (error) {
      console.error('Failed to get today attendance:', error);
      return { isCheckedIn: false };
    }
  }

  // Start location tracking for current attendance record
  private async startLocationTracking(): Promise<void> {
    if (this.isTracking || !this.currentRecord) return;

    try {
      this.isTracking = true;

      // Request location permission and start watching position
      this.locationWatchId = Geolocation.watchPosition(
        async (position) => {
          if (!this.currentRecord) return;

          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString(),
          };

          try {
            // Update location history in current record
            const currentHistory = this.currentRecord.location_history ?
              JSON.parse(this.currentRecord.location_history) : [];
            currentHistory.push(locationData);

            // Update in-memory record
            this.currentRecord.location_history = JSON.stringify(currentHistory);

            // Update in database (throttled to avoid too many writes)
            await this.updateLocationHistory(this.currentRecord.id, currentHistory);

            // Store location point in tracking table
            await this.storeLocationPoint(locationData);
          } catch (error) {
            console.error('Location tracking update failed:', error);
          }
        },
        (error) => {
          console.error('Location tracking error:', error);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10, // Update every 10 meters
          interval: 30000, // Update every 30 seconds
          fastestInterval: 10000, // Fastest update every 10 seconds
          forceRequestLocation: true,
          forceLocationManager: false,
          showLocationDialog: true,
          useSignificantChanges: false,
        }
      );

      console.log('Location tracking started');
    } catch (error) {
      console.error('Failed to start location tracking:', error);
      this.isTracking = false;
    }
  }

  // Stop location tracking
  private async stopLocationTracking(): Promise<void> {
    if (!this.isTracking || this.locationWatchId === null) return;

    try {
      Geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
      this.isTracking = false;
      console.log('Location tracking stopped');
    } catch (error) {
      console.error('Failed to stop location tracking:', error);
    }
  }

  // Store individual location point
  private async storeLocationPoint(locationData: LocationData): Promise<void> {
    if (!this.currentRecord) return;

    const db = this.db.getDatabase();

    await db.executeSql(
      `INSERT INTO location_tracking
       (id, attendance_record_id, latitude, longitude, accuracy, timestamp, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        `tracking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        this.currentRecord.id,
        locationData.latitude,
        locationData.longitude,
        locationData.accuracy,
        locationData.timestamp,
        0, // not synced yet
      ]
    );
  }

  // Update location history in attendance record
  private async updateLocationHistory(recordId: string, history: LocationData[]): Promise<void> {
    const db = this.db.getDatabase();

    await db.executeSql(
      `UPDATE attendance_records
       SET location_history = ?, updated_at = ?
       WHERE id = ?`,
      [JSON.stringify(history), new Date().toISOString(), recordId]
    );
  }

  // Get current location
  private async getCurrentLocation(): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString(),
          });
        },
        (error) => {
          console.error('Location error:', error);
          reject(new Error('Unable to get current location'));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  }

  private async getCurrentUser(): Promise<{ id: string } | null> {
    const user = await AuthStorageService.getInstance().getCurrentUser();
    return user ? { id: user.id } : null;
  }

  // Map database record to AttendanceRecord type
  private mapDatabaseRecordToAttendanceRecord(dbRecord: any): AttendanceRecord {
    return {
      id: dbRecord.id,
      user_id: dbRecord.user_id,
      shop_id: dbRecord.shop_id,
      check_in_time: dbRecord.check_in_time,
      check_out_time: dbRecord.check_out_time,
      check_in_latitude: dbRecord.check_in_latitude,
      check_in_longitude: dbRecord.check_in_longitude,
      check_out_latitude: dbRecord.check_out_latitude,
      check_out_longitude: dbRecord.check_out_longitude,
      location_history: dbRecord.location_history,
      total_distance: dbRecord.total_distance,
      status: dbRecord.status,
      synced: Boolean(dbRecord.synced),
      created_at: dbRecord.created_at,
      updated_at: dbRecord.updated_at,
    };
  }

  // Clean up resources
  public async cleanup(): Promise<void> {
    await this.stopLocationTracking();
    this.currentRecord = null;
  }
}
