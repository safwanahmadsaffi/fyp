# Clear Sync Queue - Quick Fix

## Problem
You're seeing many failed sync attempts with high retry counts (30+):
```
[SyncService] ⚠️ Failed: attendance_records/xxx (retry: 33)
[SyncService] ⚠️ Failed: visits/xxx (retry: 32)
```

## Why This Happens
- Old data in queue from before the sync system was properly configured
- Invalid data that can't be synced (missing required fields)
- Items that were already synced to server but not marked as synced locally

## Quick Fix - Clear Failed Items

### Option 1: Clear Items with High Retry Count (Recommended)

Add this code temporarily to your `Dashboard.tsx` or `App.tsx`:

```typescript
import { clearFailedItems, getSyncQueueStats } from './services/sync/clearSyncQueue';

// In a useEffect or button handler:
useEffect(() => {
  const cleanupQueue = async () => {
    const stats = await getSyncQueueStats();
    console.log('📊 Sync Queue Stats:', stats);
    
    if (stats.failed > 0) {
      const cleared = await clearFailedItems(30); // Clear items with retry > 30
      console.log(`🗑️ Cleared ${cleared} failed items`);
    }
  };
  
  cleanupQueue();
}, []);
```

### Option 2: Clear All Sync Queue (Nuclear Option)

⚠️ **Warning**: This will delete ALL pending sync items, including valid ones!

```typescript
import { clearAllSyncQueue } from './services/sync/clearSyncQueue';

const cleared = await clearAllSyncQueue();
console.log(`🗑️ Cleared ${cleared} items from sync queue`);
```

### Option 3: Clear Only Synced Items

Safe - only removes items already marked as synced:

```typescript
import { clearSyncedItems } from './services/sync/clearSyncQueue';

const cleared = await clearSyncedItems();
console.log(`🗑️ Cleared ${cleared} synced items`);
```

## View Queue Contents

To see what's in the queue:

```typescript
import { viewSyncQueue } from './services/sync/clearSyncQueue';

const items = await viewSyncQueue(20); // Get last 20 items
console.log('Queue items:', items);
```

## Permanent Fix Applied

The sync system has been updated to:

✅ **Validate data** before syncing (skip invalid items)
✅ **Better error handling** with detailed logs
✅ **Auto-skip client errors** (400, 404, 409) - marks them as synced
✅ **Detailed error messages** showing what failed and why

### What Changed:

1. **Attendance Sync**:
   - Validates `check_in_time` exists before syncing
   - Validates `record_id` exists for check-out
   - Skips items with 400/404/409 errors

2. **Tracking Sync**:
   - Validates `longitude` and `latitude` exist
   - Skips items with missing coordinates

3. **Visit Sync**:
   - Validates `user_id` and `shop_id` exist
   - Provides default values for missing fields

## After Cleanup

1. **Restart the app**
2. **Watch console logs**:
   ```
   [SyncService] ⚠️ Skipping attendance INSERT - no check_in_time
   [SyncService] ⚠️ Marking as synced due to client error
   ```

3. **Sync pending count should decrease**

## Prevention

Going forward, the new sync system will:
- Only queue valid data
- Auto-remove invalid items
- Provide clear error messages
- Not retry client errors indefinitely

## Manual Database Cleanup (Advanced)

If you want to manually inspect/clean the database:

```typescript
import { DatabaseService } from './services/database/DatabaseService';

const db = DatabaseService.getInstance().getDatabase();

// View all pending items
const [result] = await db.executeSql(
  'SELECT * FROM sync_queue WHERE synced = 0 ORDER BY retry_count DESC'
);

// Delete specific item
await db.executeSql('DELETE FROM sync_queue WHERE id = ?', ['item-id']);

// Delete all items for a specific table
await db.executeSql('DELETE FROM sync_queue WHERE table_name = ?', ['attendance_records']);
```

## Summary

**Immediate Action**: Run `clearFailedItems(30)` to remove stuck items

**Long-term**: The updated sync system will prevent this from happening again
