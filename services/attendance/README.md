# Check-in/Check-out Offline Sync Documentation

## Overview

The check-in/check-out system now supports **bidirectional offline sync**, allowing users to:
- ✅ Check-in and check-out while offline
- ✅ View check-in history offline
- ✅ Automatic sync when connection is restored
- ✅ No data loss during offline operations

## Architecture

### Components

1. **CheckinStorageService** (`CheckinStorageService.ts`)
   - Manages local SQLite database storage for check-ins
   - Provides CRUD operations for offline data
   - Handles sync from server to local DB

2. **attendService** (`attendService.ts`)
   - Updated to use offline-first approach
   - Automatically saves to local DB after successful API calls
   - Falls back to local DB when offline

3. **OfflineFirstService** (`services/sync/OfflineFirstService.ts`)
   - Handles online/offline detection
   - Queues operations when offline
   - Executes API calls when online

4. **SyncService** (`services/sync/SyncService.ts`)
   - Background sync service
   - Processes queued operations
   - Retries failed syncs

## Data Flow

### Online Mode (Check-in)
```
User clicks Check-in
    ↓
Dashboard → OfflineFirstService → attendService.createCheckIn()
    ↓
API Call Success
    ↓
Save to Local DB (CheckinStorageService)
    ↓
Update UI
```

### Offline Mode (Check-in)
```
User clicks Check-in
    ↓
Dashboard → OfflineFirstService (detects offline)
    ↓
Queue operation in sync_queue table
    ↓
Save to Local DB (attendance_records)
    ↓
Update UI with local data
    ↓
[When online] SyncService processes queue → API Call → Update local DB
```

### Viewing History
```
User opens CheckinHistory
    ↓
attendService.getMyCheckIns()
    ↓
If Online: Fetch from server → Sync to local DB → Display
If Offline: Load from local DB → Display with "Offline Mode" indicator
```

## Database Schema

### attendance_records Table
```sql
CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  check_in_time DATETIME NOT NULL,
  check_out_time DATETIME,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### sync_queue Table
```sql
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  data TEXT,
  synced INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  timestamp DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## API Methods

### CheckinStorageService

#### `saveCheckIn(checkIn: CheckInRecord): Promise<void>`
Saves or updates a check-in record in local database.

#### `updateCheckOut(checkInId: string, checkOutTime: string): Promise<void>`
Updates the check-out time for an existing check-in.

#### `getAllCheckIns(userId?: string): Promise<CheckInRecord[]>`
Retrieves all check-ins from local database, optionally filtered by user.

#### `getActiveCheckIn(userId?: string): Promise<CheckInRecord | null>`
Gets the currently active (not checked out) check-in.

#### `syncFromServer(serverCheckIns: CheckInRecord[]): Promise<void>`
Syncs check-ins from server response to local database.

### attendService (Updated Methods)

#### `getMyCheckIns(): Promise<any>`
- **Online**: Fetches from server, syncs to local DB, returns server data
- **Offline**: Returns data from local DB with `source: 'local'` flag

#### `getActiveCheckIn(): Promise<any>`
- **Online**: Fetches from server, syncs to local DB
- **Offline**: Returns active check-in from local DB

#### `createCheckIn(payload): Promise<any>`
- Calls API
- On success: Saves to local DB
- On failure: Throws error (OfflineFirstService handles queueing)

#### `checkOut(checkinId, payload): Promise<any>`
- Calls API
- On success: Updates local DB with check-out time
- On failure: Throws error (OfflineFirstService handles queueing)

## Usage Examples

### Check-in (Dashboard)
```typescript
const handleCheckIn = async () => {
  const now = new Date();
  const attendanceId = generateId();

  const created = await OfflineFirstService.execute(
    () => attendService.createCheckIn({
      checkInTime: now.toISOString(),
      checkInNotes: '',
    }),
    {
      tableName: 'attendance_records',
      recordId: attendanceId,
      operation: 'INSERT',
      data: { 
        id: attendanceId, 
        user_id: 'current-user', 
        check_in_time: now.toISOString(),
      },
    }
  );
  
  // created will be null if offline (queued for sync)
  // created will have data if online (synced immediately)
};
```

### Check-out (Dashboard)
```typescript
const handleCheckOut = async () => {
  await OfflineFirstService.execute(
    () => attendService.checkOut(checkInId, {
      checkOutTime: new Date().toISOString(),
    }),
    {
      tableName: 'attendance_records',
      recordId: checkInId,
      operation: 'UPDATE',
      data: {
        check_out_time: new Date().toISOString(),
      },
    }
  );
};
```

### View History (CheckinHistory)
```typescript
const fetchCheckins = async () => {
  const response = await attendService.getMyCheckIns();
  
  // Handle both online and offline responses
  if (response?.checkIns) {
    setCheckins(response.checkIns);
  }
  
  // Show offline indicator
  if (response?.source === 'local') {
    Toast.show({
      type: 'info',
      text1: 'Offline Mode',
      text2: 'Showing locally stored check-ins',
    });
  }
};
```

## Sync Process

### Automatic Background Sync

The SyncService automatically processes queued operations:

1. **Initialization** (App.tsx)
   ```typescript
   SyncService.getInstance().setSmartApiHandler();
   SyncService.getInstance().startAutoSync(30000); // Every 30 seconds
   ```

2. **Sync Handler** (SyncService.ts)
   - Checks network connectivity
   - Processes items from sync_queue table
   - Routes to appropriate API based on table_name
   - Marks as synced on success
   - Increments retry_count on failure

3. **Retry Logic**
   - Failed syncs are retried automatically
   - Max retries: 5 (configurable)
   - Exponential backoff between retries

### Manual Sync Trigger

Users can manually trigger sync by:
- Pull-to-refresh in CheckinHistory
- App coming back online (automatic)
- Opening the app after being offline

## Conflict Resolution

### Server Wins Strategy
- When syncing from server, server data overwrites local data
- Local changes are queued and synced to server
- Server response becomes the source of truth

### Handling Conflicts
1. User makes changes offline → Queued in sync_queue
2. App comes online → Sync queue processed
3. Server processes changes → Returns updated data
4. Updated data synced back to local DB

## Testing Offline Functionality

### Test Scenarios

1. **Check-in Offline**
   - Turn off network
   - Click Check-in
   - Verify: Toast shows "Saved locally (will sync)"
   - Verify: Record appears in attendance_records table
   - Verify: Record appears in sync_queue table
   - Turn on network
   - Verify: Record syncs to server
   - Verify: sync_queue record marked as synced

2. **Check-out Offline**
   - Check-in while online
   - Turn off network
   - Click Check-out
   - Verify: Local DB updated with check_out_time
   - Verify: Operation queued in sync_queue
   - Turn on network
   - Verify: Check-out syncs to server

3. **View History Offline**
   - View history while online (data cached)
   - Turn off network
   - Close and reopen app
   - Navigate to CheckinHistory
   - Verify: Shows cached data
   - Verify: Toast shows "Offline Mode"

4. **Sync on Reconnect**
   - Perform multiple operations offline
   - Turn on network
   - Verify: All operations sync automatically
   - Verify: sync_queue cleared
   - Verify: History shows updated data

## Troubleshooting

### Check-ins not syncing
1. Check sync_queue table: `SELECT * FROM sync_queue WHERE synced = 0`
2. Check network connectivity
3. Check console logs for sync errors
4. Verify API endpoints are accessible

### Duplicate check-ins
- Ensure unique IDs are generated (using `generateId()`)
- Check for race conditions in check-in logic
- Verify sync_queue doesn't have duplicate entries

### Data not appearing offline
1. Verify database initialization: `DatabaseService.getInstance().initialize()`
2. Check if data was saved: `SELECT * FROM attendance_records`
3. Verify CheckinStorageService methods are being called

## Performance Considerations

### Database Optimization
- Indexes on `user_id` and `check_in_time` for fast queries
- Limit history to last 90 days (configurable)
- Periodic cleanup of old records

### Sync Optimization
- Batch sync operations (process multiple items per cycle)
- Exponential backoff for failed syncs
- Prioritize recent operations

### Memory Management
- Lazy load check-in history (pagination)
- Clear old data from memory after sync
- Use database cursors for large datasets

## Future Enhancements

1. **Conflict Resolution UI**
   - Show conflicts to user
   - Allow manual resolution

2. **Selective Sync**
   - Sync only changed fields
   - Delta sync for large datasets

3. **Compression**
   - Compress sync queue data
   - Reduce storage footprint

4. **Analytics**
   - Track sync success rate
   - Monitor offline usage patterns
   - Alert on sync failures

## Security Considerations

- Local database encrypted (SQLite encryption)
- Sensitive data (tokens) stored securely
- Sync queue data validated before sending to server
- Authentication tokens refreshed before sync
