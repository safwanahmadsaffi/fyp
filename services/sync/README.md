# Offline-First Sync System

## Overview

This sync system provides offline-first functionality for the app. When online, data is sent directly to the backend APIs. When offline, data is stored locally in SQLite and automatically synced when connection is restored.

## Architecture

### Components

1. **NetworkUtils** - Monitors network connectivity
2. **OfflineFirstService** - Handles online/offline logic for API calls
3. **SyncService** - Manages the sync queue and background sync
4. **enqueueSync** - Adds items to the sync queue

### Flow

#### When ONLINE:
```
User Action → API Call → Success → Update UI
                      ↓ Failure
                      → Queue for Sync → Update UI
```

#### When OFFLINE:
```
User Action → Queue for Sync → Update UI
```

#### Background Sync:
```
Every 15s → Check Network → If Online → Process Queue → Call APIs
```

## Usage

### 1. Initialize (in App.tsx or main component)

```typescript
import { initializeSync } from './services/sync/initializeSync';

useEffect(() => {
  initializeSync();
  
  return () => {
    cleanupSync();
  };
}, []);
```

### 2. Use OfflineFirstService for API calls

```typescript
import { OfflineFirstService } from './services/sync/OfflineFirstService';

// Check-in example
const handleCheckIn = async () => {
  const result = await OfflineFirstService.execute(
    () => attendService.createCheckIn({}),
    {
      tableName: 'attendance_records',
      recordId: checkInId,
      operation: 'INSERT',
      data: { id: checkInId, user_id: userId, check_in_time: now },
    }
  );
  
  if (result) {
    // Online - API succeeded
    Toast.show({ text1: 'Synced to server' });
  } else {
    // Offline or API failed - queued for sync
    Toast.show({ text1: 'Saved locally (will sync)' });
  }
};
```

### 3. Supported Operations

The sync system automatically routes to the correct API based on table name:

- **attendance_records** → `attendService.createCheckIn()` / `attendService.checkOut()`
- **trackings** / **location_tracking** → `trackService.createTracking()`
- **visits** → `VisitService.createVisit()`

## Database Schema

### sync_queue Table

```sql
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE'
  data TEXT,                 -- JSON string
  synced INTEGER DEFAULT 0,  -- 0 = pending, 1 = synced
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Features

✅ **Automatic Network Detection** - Monitors connection status in real-time
✅ **Smart Retry Logic** - Retries failed syncs automatically
✅ **API-Specific Routing** - Routes to correct backend API based on data type
✅ **Background Sync** - Syncs every 15 seconds when online
✅ **Connection Restoration** - Triggers immediate sync when network comes back
✅ **Sync Pending Counter** - Shows number of items waiting to sync

## Monitoring

### Console Logs

- 🟢 `[NetworkUtils] ONLINE` - Network connected
- 🔴 `[NetworkUtils] OFFLINE` - Network disconnected
- 🔄 `[SyncService] Processing sync queue...` - Sync started
- ✅ `[SyncService] Synced: table/id` - Item synced successfully
- ❌ `[SyncService] Failed: table/id` - Sync failed, will retry
- 📊 `[SyncService] Sync complete: X success, Y failed` - Sync summary

### Sync Pending Count

```typescript
const syncService = SyncService.getInstance();
const pendingCount = await syncService.getSyncPendingCount();
console.log(`${pendingCount} items pending sync`);
```

## Error Handling

- Network errors → Item stays in queue, retries later
- API errors → Item stays in queue, retries later
- Parse errors → Logged, item marked as failed
- Max retries → Items remain in queue indefinitely (no auto-delete)

## Configuration

### Sync Interval

Default: 15 seconds

```typescript
syncService.startBackground(30000); // 30 seconds
```

### Batch Size

Default: 25 items per sync

```typescript
await syncService.processQueue(50); // Process 50 items
```

## Testing

### Simulate Offline Mode

1. Turn off WiFi/Mobile data
2. Perform actions (check-in, location tracking, visits)
3. Check console for "Saved locally (will sync)" messages
4. Turn on network
5. Watch console for sync logs

### Check Sync Queue

```typescript
const db = DatabaseService.getInstance().getDatabase();
const [result] = await db.executeSql('SELECT * FROM sync_queue WHERE synced = 0');
console.log('Pending items:', result.rows.length);
```

## Troubleshooting

### Items not syncing?

1. Check network connection
2. Check console for error logs
3. Verify API endpoints are correct
4. Check auth tokens are valid

### Duplicate data?

- Ensure `record_id` is unique
- Check API for idempotency support

### Sync too slow?

- Reduce sync interval
- Increase batch size
- Check network speed
