import Geolocation, { GeoPosition } from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform } from 'react-native';
import { DatabaseService } from '../database/DatabaseService';
import { enqueueSync } from '../sync/enqueue';
import { generateId } from '../utils/uid';
import trackService from './trackService';
import { OfflineFirstService } from '../sync/OfflineFirstService';

export class LocationTracker {
  private static watchId: number | null = null;
  private static attendanceId: string | null = null;

  private static async ensurePermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const fine = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      if (fine !== PermissionsAndroid.RESULTS.GRANTED) return false;

      // Android 10+ requires explicit background location permission
      try {
        if (Platform.Version >= 29 && PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION) {
          const bg = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
          );
          if (bg !== PermissionsAndroid.RESULTS.GRANTED) {
            // We can still proceed but background updates may be throttled
            console.warn('[LocationTracker] ACCESS_BACKGROUND_LOCATION not granted');
          }
        }
      } catch {}
      return true;
    } else {
      // iOS: request 'always' for background updates (requires plist setup)
      try {
        const auth = await Geolocation.requestAuthorization('always');
        return auth === 'granted';
      } catch {
        return false;
      }
    }
  }

  public static async start(attendanceId: string): Promise<void> {
    const ok = await this.ensurePermission();
    console.log('[LocationTracker] permission ok:', ok);
    if (!ok) return;
    this.attendanceId = attendanceId;
    if (this.watchId !== null) return;
    console.log('[LocationTracker] starting watch with attendanceId:', attendanceId);
    const options: any = {
      enableHighAccuracy: true,
      distanceFilter: 10,
      interval: 6000, // 60s to reduce battery; adjust as needed
      fastestInterval: 3000,
      timeout: 6000,
      maximumAge: 0,
      // iOS indicator when tracking in background
      showsBackgroundLocationIndicator: true,
      // Android: run as a foreground service so OS keeps delivering updates
      foregroundService: Platform.OS === 'android' ? {
        notificationTitle: 'Location tracking enabled',
        notificationText: 'Your location is being recorded during check-in.',
        notificationChannelName: 'Location Tracking',
        notificationColor: 0x2196F3,
      } : undefined,
    };
    // Fire an immediate single read to verify GPS works
    Geolocation.getCurrentPosition(
      pos => {
        console.log('[LocationTracker] getCurrentPosition:', pos?.coords);
        this.onLocation(pos).catch(() => undefined);
      },
      err => {
        console.warn('[LocationTracker] getCurrentPosition error:', err);
      },
      options,
    );
    this.watchId = Geolocation.watchPosition(
      pos => this.onLocation(pos).catch(() => undefined),
      err => {
        console.warn('[LocationTracker] watchPosition error:', err);
      },
      options,
      // { enableHighAccuracy: true, distanceFilter: 25, interval: 15000, fastestInterval: 8000 },
    );
    console.log('[LocationTracker] watch started, id:', this.watchId);
  }

  public static stop(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.attendanceId = null;
  }

  private static async onLocation(position: GeoPosition): Promise<void> {
    if (!this.attendanceId) return;
    const { latitude, longitude, accuracy } = position.coords;
    const timestamp = new Date(position.timestamp).toISOString();
    console.log('[LocationTracker] onLocation:', { latitude, longitude, accuracy, timestamp });
    const db = DatabaseService.getInstance().getDatabase();
    const id = generateId();
    
    // Store location tracking data
    await db.executeSql(
      `INSERT INTO location_tracking (id, attendance_record_id, latitude, longitude, accuracy, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, this.attendanceId, latitude, longitude, accuracy ?? null, timestamp]
    );

    // Get the user ID from the attendance record
    const [userResult] = await db.executeSql(
      'SELECT user_id FROM attendance_records WHERE id = ?',
      [this.attendanceId]
    );
    
    if (userResult.rows.length > 0) {
      const userId = userResult.rows.item(0).user_id;
      // Check for nearby shops and mark visits automatically
      const { ProximityTracker } = require('./ProximityTracker');
      await ProximityTracker.checkShopProximity(latitude, longitude, userId);
    }

    // Use OfflineFirstService to try API first, fallback to queue
    await OfflineFirstService.execute(
      () => trackService.createTracking({
        location: { longitude, latitude },
      }),
      {
        tableName: 'trackings',
        recordId: id,
        operation: 'INSERT',
        data: {
          id,
          attendance_record_id: this.attendanceId,
          latitude,
          longitude,
          accuracy: accuracy ?? null,
          timestamp,
        },
      }
    );
  }
}
