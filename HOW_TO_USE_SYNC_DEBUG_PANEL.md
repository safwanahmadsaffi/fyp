# How to Use Sync Debug Panel

## Quick Fix for Stuck Sync Items

### Option 1: Automatic (Wait 15 Seconds)

The updated SyncService will automatically remove items with 10+ retries on the next sync cycle.

**Just wait ~15 seconds and check the console:**
```
[SyncService] 🗑️ Removing item with 26 retries: attendance_records/...
[SyncService] 🗑️ Removed 4 items with excessive retries
[SyncService] ✅ Queue is empty
```

### Option 2: Add Debug Panel to Dashboard (Recommended for Development)

Add the SyncDebugPanel component to your Dashboard to manually clear stuck items:

#### Step 1: Import the Component

```typescript
// In Components/Dashboard.tsx
import SyncDebugPanel from './SyncDebugPanel';
```

#### Step 2: Add to Dashboard UI

Add it after the check-in/check-out button:

```typescript
{/* Check-in/Check-out Button */}
<View style={styles.attendanceContainer}>
  <Button
    text={isCheckedIn ? 'Check Out' : 'Check In'}
    onPress={isCheckedIn ? handleCheckOut : handleCheckIn}
    // ... other props
  />
</View>

{/* ✅ Add Sync Debug Panel */}
<SyncDebugPanel />

{/* Scrollable Content */}
<FlatList
  data={sortedShops}
  // ... other props
/>
```

#### Step 3: Use the Panel

The panel will:
- ✅ Show only when there are failed items
- ✅ Display pending and failed counts
- ✅ Provide a "Clear Failed Items" button
- ✅ Auto-refresh stats every 5 seconds

**When you see failed items:**
1. Click "Clear Failed Items"
2. Toast notification confirms cleanup
3. Panel disappears when queue is clean

### Option 3: Manual Cleanup via Code

If you don't want to add the UI panel, run this in your code:

```typescript
import { clearFailedItems } from './services/sync/clearSyncQueue';

// Clear items with 10+ retries
const cleared = await clearFailedItems(10);
console.log(`Cleared ${cleared} stuck items`);
```

## What the Debug Panel Looks Like

```
┌─────────────────────────────────────┐
│ ⚠️  Sync Issues Detected            │
│                                     │
│    Pending: 0      Failed: 4        │
│                                     │
│  [🗑️ Clear Failed Items]            │
│                                     │
│ Items with 10+ retries will be     │
│ removed                             │
└─────────────────────────────────────┘
```

## When to Use

### Use Debug Panel When:
- ✅ Developing and testing sync functionality
- ✅ Debugging sync issues
- ✅ Need immediate cleanup of stuck items
- ✅ Want visibility into sync queue status

### Remove Debug Panel When:
- ❌ Releasing to production
- ❌ App is stable and sync is working
- ❌ Don't want users to see debug info

## Production Alternative

For production, use the automatic cleanup (already implemented):

```typescript
// In SyncService.ts - processQueue()
if (item.retry_count >= 10) {
  // Automatically remove stuck items
  await db.executeSql(`UPDATE sync_queue SET synced = 1 WHERE id = ?`, [item.id]);
  continue;
}
```

This runs automatically every 15 seconds, so stuck items are cleaned up without user intervention.

## Summary

**Immediate Fix (No Code Changes):**
- ⏱️ Wait 15 seconds for automatic cleanup

**Development Fix (Add Debug Panel):**
- 📱 Add `<SyncDebugPanel />` to Dashboard
- 🔘 Click "Clear Failed Items" button
- ✅ Instant cleanup

**Production Fix (Already Implemented):**
- 🤖 Automatic cleanup every 15 seconds
- 🗑️ Items with 10+ retries removed automatically
- 📊 No user intervention needed

**Your Current Issue:**
- 4 items with 26-27 retries
- Will be auto-removed in ~15 seconds
- Or use debug panel for instant cleanup
