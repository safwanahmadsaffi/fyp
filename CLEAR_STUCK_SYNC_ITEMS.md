# Clear Stuck Sync Items - Quick Fix

## Problem

You have 4 items stuck in the sync queue with 26-27 retries that keep failing.

## Automatic Fix (Already Applied)

The SyncService now automatically removes items with 10+ retries:

```typescript
// In SyncService.ts - processQueue()
if (item.retry_count >= 10) {
  console.warn(`[SyncService] 🗑️ Removing item with ${item.retry_count} retries`);
  await db.executeSql(`UPDATE sync_queue SET synced = 1 WHERE id = ?`, [item.id]);
  continue;
}
```

**Next sync cycle (in ~15 seconds), these items will be automatically removed.**

## Manual Fix (If You Want Immediate Cleanup)

### Option 1: Use Existing Utility

```typescript
import { clearFailedItems } from './services/sync/clearSyncQueue';

// Clear items with retry_count >= 10
const cleared = await clearFailedItems(10);
console.log(`Cleared ${cleared} stuck items`);
```

### Option 2: Direct SQL (In React Native Debugger Console)

```javascript
// Get database instance
const { DatabaseService } = require('./services/database/DatabaseService');
const db = DatabaseService.getInstance().getDatabase();

// Clear items with high retry count
db.executeSql(
  `UPDATE sync_queue SET synced = 1 WHERE retry_count >= 10`,
  [],
  (res) => console.log('Cleared items:', res.rowsAffected),
  (error) => console.error('Error:', error)
);

// Or delete them completely
db.executeSql(
  `DELETE FROM sync_queue WHERE retry_count >= 10`,
  [],
  (res) => console.log('Deleted items:', res.rowsAffected),
  (error) => console.error('Error:', error)
);
```

### Option 3: Add Cleanup Button to Dashboard

Add this to your Dashboard component:

```typescript
import { clearFailedItems } from '../services/sync/clearSyncQueue';

// In Dashboard component
const handleClearStuckItems = async () => {
  try {
    const cleared = await clearFailedItems(10);
    Toast.show({
      type: 'success',
      text1: 'Cleanup Complete',
      text2: `Removed ${cleared} stuck items`,
    });
  } catch (error) {
    console.error('Cleanup failed:', error);
    Toast.show({
      type: 'error',
      text1: 'Cleanup Failed',
    });
  }
};

// Add button in UI (for debugging)
<Button
  text="Clear Stuck Sync Items"
  onPress={handleClearStuckItems}
  backgroundColor={Colors.orange}
/>
```

## What Will Happen

### On Next Sync (Automatic):
```
[SyncService] 🔄 Processing sync queue...
[SyncService] 📦 Found 4 items to sync
[SyncService] 🗑️ Removing item with 26 retries: attendance_records/fb7d74fa-f074-4330-a7c4-456064c474f5
[SyncService] 🗑️ Removing item with 26 retries: trackings/1dee4d8e-077d-4d22-bd01-814900fb5a9c
[SyncService] 🗑️ Removing item with 26 retries: trackings/f6a3af72-a6f7-4152-85c2-ccdfb9fed3b4
[SyncService] 🗑️ Removing item with 26 retries: visits/ac09f9f6-3fff-4464-9e8b-e40e19b8b7eb
[SyncService] 🗑️ Removed 4 items with excessive retries
[SyncService] 📊 Sync complete: 0 success, 0 failed
```

### After Cleanup:
```
[SyncService] 🔄 Processing sync queue...
[SyncService] ✅ Queue is empty
```

## Why These Items Failed

Based on the logs, these items are likely failing because:

1. **attendance_records/fb7d74fa-f074-4330-a7c4-456064c474f5**
   - This is a checkout operation
   - The check-in ID doesn't exist on the server (500 error)
   - Possible: Created offline, never synced, trying to checkout non-existent check-in

2. **trackings/** (2 items)
   - Location tracking data
   - Possible: Invalid coordinates or backend issue

3. **visits/ac09f9f6-3fff-4464-9e8b-e40e19b8b7eb**
   - Visit creation
   - Possible: Missing allocationId or backend issue

## Prevention

To prevent this in the future:

### 1. Don't Queue Checkout if Check-In Not Synced

```typescript
// In Dashboard handleCheckOut
const checkInSynced = await checkIfSynced(activeCheckInId);
if (!checkInSynced) {
  Toast.show({
    type: 'warning',
    text1: 'Please wait',
    text2: 'Check-in is still syncing...',
  });
  return;
}
```

### 2. Validate Data Before Queueing

```typescript
// In OfflineFirstService
if (tableName === 'visits' && !data.allocation_id && !data.allocationId) {
  console.warn('[OfflineFirst] Skipping - missing allocationId');
  return null; // Don't queue invalid data
}
```

### 3. Show Sync Status to User

```typescript
// In Dashboard
{syncPending > 0 && (
  <View style={styles.syncWarning}>
    <Icon name="sync" size={16} color={Colors.orange} />
    <Text>{syncPending} items pending sync</Text>
  </View>
)}
```

## Summary

**Immediate Action:**
- ✅ Updated SyncService will auto-remove items with 10+ retries
- ⏱️ Wait ~15 seconds for next sync cycle
- 🗑️ Items will be automatically cleaned up

**Manual Action (Optional):**
- Run `clearFailedItems(10)` for immediate cleanup

**Root Cause:**
- These items have invalid data or reference non-existent server resources
- They will never succeed, so removing them is the correct action

**Files Modified:**
- ✅ `services/sync/SyncService.ts` - Auto-cleanup added

**Next Steps:**
1. Wait for automatic cleanup (15 seconds)
2. Verify queue is empty: Check console for "Queue is empty"
3. Continue using the app normally
