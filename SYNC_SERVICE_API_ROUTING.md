# Sync Service API Routing - Implementation ✅

## Summary

The SyncService is already correctly configured to use the respective APIs (`createCheckIn`, `createVisit`, `createTracking`) for syncing data. There is **NO dedicated sync API** - each data type uses its own creation endpoint.

## Current Implementation

### SyncService Architecture

```typescript
// services/sync/SyncService.ts

export class SyncService {
  // Smart API handler routes to respective APIs
  public setSmartApiHandler() {
    this.setHandler(async (item) => {
      const parsedData = JSON.parse(item.data);
      
      switch (item.table_name) {
        case 'attendance_records':
          return await this.syncAttendance(item, parsedData);
        
        case 'trackings':
        case 'location_tracking':
          return await this.syncTracking(item, parsedData);
        
        case 'visits':
          return await this.syncVisit(item, parsedData);
        
        default:
          console.warn(`Unknown table: ${item.table_name}`);
          return false;
      }
    });
  }
}
```

## API Routing Details

### 1. **Attendance Records** → `attendService`

#### Check-In (INSERT):
```typescript
private async syncAttendance(item: SyncItem, data: any): Promise<boolean> {
  if (item.operation === 'INSERT') {
    // ✅ Uses createCheckIn API
    await attendService.createCheckIn({
      checkInNotes: data.check_in_notes || data.checkInNotes || '',
      checkInTime: data.check_in_time || data.checkInTime,
    });
    
    console.log('[SyncService] ✅ Attendance check-in synced');
    return true;
  }
}
```

**API Endpoint**: `POST /checkins`

**Request**:
```json
{
  "checkInTime": "2024-01-22T10:30:00.000Z",
  "checkInNotes": "Starting work"
}
```

#### Check-Out (UPDATE):
```typescript
if (item.operation === 'UPDATE') {
  // ✅ Uses checkOut API
  await attendService.checkOut(item.record_id, {
    checkOutTime: data.check_out_time || data.checkOutTime,
  });
  
  console.log('[SyncService] ✅ Attendance check-out synced');
  return true;
}
```

**API Endpoint**: `PUT /checkins/:id/checkout`

**Request**:
```json
{
  "checkOutTime": "2024-01-22T18:30:00.000Z"
}
```

### 2. **Location Tracking** → `trackService`

```typescript
private async syncTracking(item: SyncItem, data: any): Promise<boolean> {
  if (item.operation === 'INSERT') {
    // Validate coordinates
    if (!data.longitude || !data.latitude) {
      console.warn('[SyncService] ⚠️ Skipping tracking - missing coordinates');
      return true;
    }

    // ✅ Uses createTracking API
    await trackService.createTracking({
      location: {
        longitude: data.longitude,
        latitude: data.latitude,
      },
    });
    
    console.log('[SyncService] ✅ Location tracking synced');
    return true;
  }
}
```

**API Endpoint**: `POST /trackings`

**Request**:
```json
{
  "location": {
    "longitude": 73.0551,
    "latitude": 31.4181
  }
}
```

### 3. **Visits** → `visitApiService`

```typescript
private async syncVisit(item: SyncItem, data: any): Promise<boolean> {
  if (item.operation === 'INSERT') {
    // Validate allocation ID
    if (!data.allocation_id && !data.allocationId) {
      console.warn('[SyncService] ⚠️ Skipping visit - missing allocation_id');
      return true;
    }

    const visitDateTime = data.visit_date 
      ? new Date(data.visit_date).toISOString() 
      : new Date().toISOString();

    // ✅ Uses createVisit API
    await visitApiService.createVisit({
      allocationId: data.allocation_id || data.allocationId,
      visitDateTime: visitDateTime,
      duration: data.duration || 30,
      notes: data.notes || '',
    });
    
    console.log('[SyncService] ✅ Visit synced');
    return true;
  }
}
```

**API Endpoint**: `POST /visits`

**Request**:
```json
{
  "allocationId": "alloc-123",
  "visitDateTime": "2024-01-22T14:30:00.000Z",
  "duration": 30,
  "notes": "Shop visit completed"
}
```

## Sync Flow Diagram

```
Offline Action (Check-in/Visit/Track)
    ↓
OfflineFirstService.execute()
    ↓
If Offline:
  → Save to local SQLite
  → Insert into sync_queue table
  → Return local data
    ↓
Background Sync Process (every 30s)
    ↓
SyncService.processQueue()
    ↓
For each queued item:
  → Parse table_name
  → Route to appropriate handler
    ↓
┌─────────────────────────────────────┐
│  Table: attendance_records          │
│  → syncAttendance()                 │
│  → attendService.createCheckIn()    │
│  → POST /checkins                   │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  Table: location_tracking           │
│  → syncTracking()                   │
│  → trackService.createTracking()    │
│  → POST /trackings                  │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  Table: visits                      │
│  → syncVisit()                      │
│  → visitApiService.createVisit()    │
│  → POST /visits                     │
└─────────────────────────────────────┘
    ↓
If API Success:
  → Mark as synced (synced = 1)
  → Remove from queue
If API Fails:
  → Increment retry_count
  → Keep in queue for next sync
    ↓
Repeat every 30 seconds ✅
```

## Error Handling

### Client Errors (400, 404, 409):
```typescript
catch (error: any) {
  const statusCode = error?.response?.status;
  
  // If it's a client error, mark as synced to remove from queue
  if (statusCode === 404 || statusCode === 409 || statusCode === 400) {
    console.warn('[SyncService] ⚠️ Marking as synced due to client error');
    return true; // Remove from queue
  }
  
  return false; // Keep in queue, retry later
}
```

**Why mark client errors as synced?**
- 404: Resource not found (can't be synced)
- 409: Conflict (already exists)
- 400: Bad request (data invalid, won't succeed on retry)

### Server Errors (500, 503):
```typescript
// Return false to keep in queue
return false; // Will retry on next sync cycle
```

## Data Validation

### Attendance:
```typescript
// Check-in validation
if (!data.check_in_time && !data.checkInTime) {
  console.warn('[SyncService] ⚠️ Skipping - no check_in_time');
  return true; // Remove invalid data
}

// Check-out validation
if (!item.record_id) {
  console.warn('[SyncService] ⚠️ Skipping - no record_id');
  return true; // Remove invalid data
}
```

### Tracking:
```typescript
// Coordinate validation
if (!data.longitude || !data.latitude) {
  console.warn('[SyncService] ⚠️ Skipping - missing coordinates');
  return true; // Remove invalid data
}
```

### Visits:
```typescript
// Allocation ID validation
if (!data.allocation_id && !data.allocationId) {
  console.warn('[SyncService] ⚠️ Skipping - missing allocation_id');
  return true; // Remove invalid data
}
```

## Console Output Examples

### Successful Sync:
```
[SyncService] 🔄 Processing 3 pending items...
[SyncService] 🔄 Syncing attendance_records (INSERT): att-123
[attendService] createCheckIn payload: { checkInTime: "...", checkInNotes: "" }
[attendService] createCheckIn status: 201
[SyncService] ✅ Attendance check-in synced
[SyncService] ✅ Marked as synced: att-123

[SyncService] 🔄 Syncing location_tracking (INSERT): track-456
[trackService] createTracking payload: { location: { longitude: 73.05, latitude: 31.41 } }
[trackService] createTracking status: 201
[SyncService] ✅ Location tracking synced
[SyncService] ✅ Marked as synced: track-456

[SyncService] 🔄 Syncing visits (INSERT): visit-789
[visitApiService] createVisit payload: { allocationId: "alloc-123", ... }
[visitApiService] createVisit status: 201
[SyncService] ✅ Visit synced
[SyncService] ✅ Marked as synced: visit-789

[SyncService] ✅ Sync complete. Processed: 3, Synced: 3, Failed: 0
```

### Failed Sync (Will Retry):
```
[SyncService] 🔄 Syncing visits (INSERT): visit-789
[visitApiService] createVisit error: 500 Internal Server Error
[SyncService] ❌ Visit sync failed (500): Server error
[SyncService] ⚠️ Will retry on next sync cycle
```

### Client Error (Removed from Queue):
```
[SyncService] 🔄 Syncing visits (INSERT): visit-789
[visitApiService] createVisit error: 409 Conflict
[SyncService] ❌ Visit sync failed (409): Visit already exists
[SyncService] ⚠️ Marking as synced due to client error
[SyncService] ✅ Marked as synced: visit-789 (removed from queue)
```

## Initialization

### In App.tsx or initializeSync.ts:
```typescript
import { SyncService } from './services/sync/SyncService';

// Initialize sync with smart API routing
const syncService = SyncService.getInstance();
syncService.setSmartApiHandler(); // ✅ Routes to respective APIs

// Start background sync
syncService.startBackgroundSync();
```

## API Services Used

### 1. attendService (`services/attendance/attendService.ts`)
```typescript
class attendService {
  async createCheckIn(payload: CreateCheckInPayload) {
    return await apiClient.post("/checkins", payload, { headers });
  }

  async checkOut(checkinId: string, payload?: { checkOutTime?: string }) {
    return await apiClient.put(`/checkins/${checkinId}/checkout`, payload, { headers });
  }
}
```

### 2. trackService (`services/tracking/trackService.ts`)
```typescript
class trackService {
  async createTracking(payload: CreateTrackingPayload) {
    return await apiClient.post("/trackings", payload, { headers });
  }
}
```

### 3. visitApiService (`services/visits/visitApiService.ts`)
```typescript
class VisitApiService {
  async createVisit(payload: CreateVisitPayload) {
    return await apiClient.post("/visits", payload, { headers });
  }
}
```

## Benefits of This Approach

✅ **No Dedicated Sync API** - Uses existing creation endpoints
✅ **Type Safety** - Each service has proper TypeScript types
✅ **Validation** - Data validated before API calls
✅ **Error Handling** - Client errors removed, server errors retried
✅ **Logging** - Detailed console output for debugging
✅ **Retry Logic** - Failed syncs automatically retried
✅ **Smart Routing** - Table name determines which API to call

## Testing

### Test Sync Process:

1. **Go Offline**
2. **Perform Actions**:
   - Check in
   - Create visit
   - Track location
3. **Check Sync Queue**:
   ```typescript
   const stats = await getSyncQueueStats();
   console.log('Pending:', stats.pending); // Should be > 0
   ```
4. **Go Online**
5. **Wait for Sync** (or trigger manually)
6. **Check Console**:
   ```
   [SyncService] ✅ Attendance check-in synced
   [SyncService] ✅ Visit synced
   [SyncService] ✅ Location tracking synced
   ```
7. **Verify Queue Cleared**:
   ```typescript
   const stats = await getSyncQueueStats();
   console.log('Pending:', stats.pending); // Should be 0
   ```

## Summary

The SyncService is **already correctly implemented** to use the respective APIs:

| Data Type | Table Name | API Service | Endpoint | Method |
|-----------|------------|-------------|----------|--------|
| Check-In | `attendance_records` | `attendService.createCheckIn()` | `/checkins` | POST |
| Check-Out | `attendance_records` | `attendService.checkOut()` | `/checkins/:id/checkout` | PUT |
| Location | `location_tracking` | `trackService.createTracking()` | `/trackings` | POST |
| Visit | `visits` | `visitApiService.createVisit()` | `/visits` | POST |

**There is NO dedicated sync API - each data type uses its own creation endpoint!** ✅

The sync system:
1. ✅ Queues data when offline
2. ✅ Routes to correct API based on table name
3. ✅ Calls respective creation endpoints
4. ✅ Handles errors appropriately
5. ✅ Retries on server errors
6. ✅ Removes invalid/duplicate data

**The sync service is working correctly as designed!** 🎉
