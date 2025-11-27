// User types
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'manager' | 'user';
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

// Shop types
export interface Shop {
  id: string;
  name: string;
  address: string;
  owner_name: string;
  owner_phone?: string;
  latitude?: number;
  longitude?: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

// Location data interface
export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
}

// Allocation frequency types
export type AllocationFrequency = 'single' | 'daily' | 'weekly' | 'monthly';

// Day assignment for weekly/monthly allocations
export interface DayAssignment {
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
}

// Allocation types
export interface Allocation {
  id: string;
  user_id: string;
  shop_id: string;
  frequency: AllocationFrequency;
  assigned_days?: string; // JSON string of DayAssignment
  start_date: string;
  end_date?: string;
  status: 'active' | 'inactive' | 'completed';
  created_at: string;
  updated_at: string;
}

// Visit types
export interface Visit {
  id: string;
  user_id: string;
  shop_id: string;
  allocation_id?: string;
  visit_date: string;
  status: 'planned' | 'completed' | 'missed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

// Attendance record types
export interface AttendanceRecord {
  id: string;
  user_id: string;
  shop_id?: string;
  check_in_time: string;
  check_out_time?: string;
  check_in_latitude?: number;
  check_in_longitude?: number;
  check_out_latitude?: number;
  check_out_longitude?: number;
  location_history?: string; // JSON array of LocationData
  total_distance?: number;
  status: 'active' | 'completed' | 'cancelled';
  synced: boolean;
  created_at: string;
  updated_at: string;
}

// Location tracking types
export interface LocationTracking {
  id: string;
  attendance_record_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  synced: boolean;
  created_at: string;
}

// Recurring location types
export interface RecurringLocation {
  id: string;
  allocation_id: string;
  location_type: 'weekly' | 'monthly';
  schedule_data: string; // JSON with schedule details
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

// Sync queue types
export interface SyncQueue {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: string; // JSON data
  timestamp: string;
  retry_count: number;
  synced: boolean;
}

// Authentication token types
export interface AuthToken {
  id: number;
  user_id: string;
  access_token: string;
  refresh_token?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// Extended shop type with allocation info
export interface ShopWithAllocation extends Shop {
  allocation?: Allocation;
  visit_count?: number;
  last_visit?: string;
  next_visit?: string;
}

// Dashboard stats types
export interface DashboardStats {
  total_shops: number;
  visited_today: number;
  pending_visits: number;
  total_distance: number;
  check_in_status: boolean;
  current_shop?: ShopWithAllocation;
}

// Visit schedule types
export interface VisitSchedule {
  date: string;
  shops: ShopWithAllocation[];
  total_shops: number;
  completed_visits: number;
}
