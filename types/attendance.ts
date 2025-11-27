export interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
}

export interface AttendanceRecord {
  id: string;
  checkInTime: string;
  checkInLocation: LocationData;
  checkOutTime?: string;
  checkOutLocation?: LocationData;
  locationHistory: LocationData[];
  synced: boolean;
}

export interface AttendanceState {
  isCheckedIn: boolean;
  currentRecord?: AttendanceRecord;
  pendingRecords: AttendanceRecord[];
}
