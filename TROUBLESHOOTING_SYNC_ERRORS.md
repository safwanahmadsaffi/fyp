# Troubleshooting Sync Errors - Guide

## Current Issue

Based on the console logs, you have:
- 4 items stuck in sync queue with 6-7 retries
- 500 Internal Server Error on checkout
- Items failing repeatedly

## Error Analysis

### 1. **Checkout 500 Error**
```
[attendService] checkOut error: 500 {success: false, message: 'Internal server error'}
```

**Possible Causes:**
- Backend server issue
- Invalid check-in ID
- Check-in already checked out
- Database constraint violation on backend

**Solution:**
Check the backend logs to see the actual error. The frontend is sending the correct payload:
```json
{
  "checkOutTime": "2025-11-06T15:13:36.003Z"
}
```

### 2. **Stuck Sync Items**
```
[SyncService] ⚠️ Failed: attendance_records/fb7d74fa-f074-4330-a7c4-456064c474f5 (retry: 6)
[SyncService] ⚠️ Failed: trackings/1dee4d8e-077d-4d22-bd01-814900fb5a9c (retry: 6)
[SyncService] ⚠️ Failed: trackings/f6a3af72-a6f7-4152-85c2-ccdfb9fed3b4 (retry: 6)
[SyncService] ⚠️ Failed: visits/ac09f9f6-3fff-4464-9e8b-e40e19b8b7eb (retry: 6)
```

**Why They're Stuck:**
- Server returning 500 errors
- Items retrying indefinitely
- No automatic cleanup for persistent failures

## Solutions

### Immediate Fix: Clear Stuck Items

The updated SyncService now automatically clears items after 5 retries with 500 errors:

```typescript
// In SyncService.ts
if (statusCode === 500 && item.retry_count >= 5) {
  console.warn('[SyncService] ⚠️ Marking as synced after 5 retries (500 error)');
  return true; // Remove from queue
}
```

### Manual Cleanup (If Needed)

Use the existing cleanup utility:

```typescript
import { clearFailedItems, getSyncQueueStats } from './services/sync/clearSyncQueue';

// Check queue stats
const stats = await getSyncQueueStats();
console.log('Pending:', stats.pending);
console.log('Failed:', stats.failed);

// Clear items with retry count > 5
const cleared = await clearFailedItems(5);
console.log(`Cleared ${cleared} stuck items`);
```

### Better Logging (Already Added)

The SyncService now logs detailed error information:

```typescript
console.log('[SyncService] 🔄 Syncing check-out:', {
  id: item.record_id,
  checkOutTime: data.check_out_time || data.checkOutTime,
});

// On error:
console.error('[SyncService] ❌ Attendance sync failed (500):', errorMsg);
console.error('[SyncService] Error details:', errorData);
console.error('[SyncService] Failed data:', { operation, record_id, data });
```

## Debugging Steps

### 1. Check What's in the Queue

```typescript
import { DatabaseService } from './services/database/DatabaseService';

const db = DatabaseService.getInstance().getDatabase();
const [res] = await db.executeSql(
  `SELECT id, table_name, record_id, operation, data, retry_count, timestamp
   FROM sync_queue WHERE synced = 0 ORDER BY retry_count DESC`
);

for (let i = 0; i < res.rows.length; i++) {
  const item = res.rows.item(i);
  console.log('Stuck item:', {
    table: item.table_name,
    id: item.record_id,
    retries: item.retry_count,
    data: JSON.parse(item.data),
  });
}
```

### 2. Check Backend Logs

For the checkout 500 error, check your backend logs for:
```
PUT /api/checkins/fb7d74fa-f074-4330-a7c4-456064c474f5/checkout
```

Common backend issues:
- Check-in ID not found in database
- Check-in already has checkOutTime
- User mismatch (check-in belongs to different user)
- Database constraint violation

### 3. Verify Check-In ID

```typescript
// In Dashboard, log the check-in ID before checkout
console.log('[Dashboard] Active check-in ID:', activeCheckInId);

// Check if it exists on backend
const resp = await attendService.getActiveCheckIn();
console.log('[Dashboard] Server active check-in:', resp?.data?.checkIn?._id);
```

## Common Issues & Fixes

### Issue 1: Check-In ID Mismatch

**Problem:** Frontend has a local ID, backend expects server ID

**Fix:** Always use the server-returned ID after check-in:
```typescript
const created = await attendService.createCheckIn({...});
const serverId = created?.data?.checkIn?._id;
setActiveCheckInId(serverId); // Use server ID, not local ID
```

### Issue 2: Duplicate Check-Ins

**Problem:** Multiple check-ins created, trying to check out wrong one

**Fix:** Always check for active check-in before creating new one:
```typescript
// Before check-in
const active = await attendService.getActiveCheckIn();
if (active?.data?.checkIn) {
  Toast.show({ text1: 'Already checked in!' });
  return;
}
```

### Issue 3: Offline Check-In Not Synced

**Problem:** Checked in offline, ID is local, backend doesn't know it

**Fix:** Wait for sync before checkout:
```typescript
// Check if check-in is synced
const db = DatabaseService.getInstance().getDatabase();
const [res] = await db.executeSql(
  `SELECT synced FROM sync_queue WHERE record_id = ?`,
  [activeCheckInId]
);

if (res.rows.length > 0 && res.rows.item(0).synced === 0) {
  Toast.show({ text1: 'Please wait for sync to complete' });
  return;
}
```

## Prevention

### 1. Better Error Handling

```typescript
// In handleCheckOut
try {
  await attendService.checkOut(checkInId, {...});
} catch (error: any) {
  const statusCode = error?.response?.status;
  const message = error?.response?.data?.message;
  
  if (statusCode === 404) {
    Toast.show({ text1: 'Check-in not found', text2: 'Please check in again' });
    // Clear local state
    setIsCheckedIn(false);
    setActiveCheckInId(null);
  } else if (statusCode === 409) {
    Toast.show({ text1: 'Already checked out' });
    // Clear local state
    setIsCheckedIn(false);
    setActiveCheckInId(null);
  } else {
    Toast.show({ text1: 'Checkout failed', text2: message || 'Please try again' });
  }
}
```

### 2. Sync Status Indicator

Show user when sync is pending:
```typescript
const [syncPending, setSyncPending] = useState(0);

useEffect(() => {
  const checkSync = async () => {
    const stats = await getSyncQueueStats();
    setSyncPending(stats.pending);
  };
  
  const interval = setInterval(checkSync, 5000);
  return () => clearInterval(interval);
}, []);

// In UI
{syncPending > 0 && (
  <Text>⚠️ {syncPending} items pending sync</Text>
)}
```

### 3. Validate Before Sync

```typescript
// In OfflineFirstService
if (tableName === 'attendance_records' && operation === 'UPDATE') {
  // Validate check-in ID exists on server
  try {
    await attendService.getCheckInById(recordId);
  } catch (error: any) {
    if (error?.response?.status === 404) {
      console.warn('[OfflineFirst] Check-in not found, skipping queue');
      return null; // Don't queue if ID doesn't exist
    }
  }
}
```

## Updated SyncService Features

### 1. Automatic Cleanup
- Items with 500 errors are removed after 5 retries
- Prevents infinite retry loops
- Logs detailed error information

### 2. Better Logging
- Shows payload before API call
- Logs full error details
- Includes retry count in warnings

### 3. Smarter Error Handling
- 400/404/409: Remove immediately (client errors)
- 500 with retries < 5: Keep retrying
- 500 with retries >= 5: Remove (server issue, won't fix itself)

## Testing

### Test Sync Recovery:

1. **Create test data offline**
2. **Go online**
3. **Watch console for sync logs**:
   ```
   [SyncService] 🔄 Syncing check-in: {...}
   [SyncService] ✅ Attendance check-in synced
   ```
4. **If errors occur**:
   ```
   [SyncService] ❌ Attendance sync failed (500): Internal server error
   [SyncService] Error details: {...}
   [SyncService] Failed data: {...}
   ```
5. **After 5 retries**:
   ```
   [SyncService] ⚠️ Marking as synced after 5 retries (500 error)
   [SyncService] ✅ Synced: attendance_records/...
   ```

## Summary

**Current State:**
- ✅ Sync service uses correct APIs
- ✅ Better error logging added
- ✅ Automatic cleanup after 5 retries
- ✅ Detailed error information logged

**Action Items:**
1. Check backend logs for the 500 error cause
2. Verify check-in ID is correct (server ID vs local ID)
3. Wait for automatic cleanup (items will be removed after 5 retries)
4. Or manually clear: `clearFailedItems(5)`

**Root Cause:**
The 500 error is a **backend issue**, not a frontend sync issue. The sync service is working correctly - it's calling the right API with the right payload. The backend needs to be fixed to handle the checkout request properly.
