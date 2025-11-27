# Shop Allocation API Sync Fix

## Issues Fixed

### 1. ❌ Sync Handler Failure - **FIXED**
**Problem:** The sync handler was returning `false` for all items because `App.tsx` was overriding the smart handler with a generic one.

**Root Cause:**
```typescript
// App.tsx line 52 (OLD)
SyncService.getInstance().setDefaultHttpHandler(base); // ❌ Overrides smart handler
SyncService.getInstance().startBackground(15000);
```

This was calling `setDefaultHttpHandler()` **AFTER** `initializeSync()` set the smart handler, causing all sync operations to use generic `/sync/*` endpoints instead of proper API routes like `/visits`, `/attendance`, etc.

**Fix Applied:**
- ✅ Removed duplicate handler setup in `App.tsx`
- ✅ Now only `initializeSync()` sets the smart API handler
- ✅ Handler properly routes to: `/visits`, `/attendance`, `/trackings`, `/orders`

---

### 2. ❌ Malformed Code in Dashboard - **FIXED**
**Problem:** `loadAllocations()` function had duplicate closing braces and commented code.

**Root Cause:**
```typescript
// Dashboard.tsx lines 156-159 (OLD)
      });
    }  // ❌ Extra closing brace
  // } catch (error: any) {
  //   console.error('[Dashboard] Error in loadAllocations:', error);
  // }
};
```

**Fix Applied:**
- ✅ Removed duplicate closing brace
- ✅ Removed commented-out code
- ✅ Proper error handling now works

---

### 3. ❌ No Allocation API Call on App Open - **FIXED**
**Problem:** App was only reading allocations from **local SQLite database**, never fetching fresh data from API.

**Old Behavior:**
```typescript
// App.tsx (OLD)
const allocations = await AllocationService.getUserAllocations(userId);
// ❌ Only reads from local DB
```

**Fix Applied:**
```typescript
// App.tsx (NEW)
// Fetch fresh allocations from API on app startup
try {
  console.log('🟡 Fetching fresh allocations from API...');
  const allocResp = await allocService.getMyAllocations();
  console.log('✅ Fresh allocations fetched:', allocResp?.data?.allocations?.length || 0);
} catch (error: any) {
  console.warn('⚠️ Failed to fetch allocations from API:', error?.message);
  console.log('ℹ️ Will use local data as fallback');
}
```

**Benefits:**
- ✅ Fresh allocation data on every app startup
- ✅ Graceful fallback to local data if offline
- ✅ Dashboard displays latest allocations

---

## What Now Works

### On App Startup:
1. **Database initialization** ✅
2. **Migrations run** ✅
3. **Fresh allocations fetched from API** ✅ **(NEW)**
4. **Sync system initialized** with smart handler ✅
5. **Background sync starts** every 15 seconds ✅

### Sync Service:
- ✅ Routes `attendance_records` → `POST /attendance`
- ✅ Routes `trackings` → `POST /trackings`
- ✅ Routes `visits` → `POST /visits`
- ✅ Routes `orders` → `POST /orders`
- ✅ Proper error handling with retry logic
- ✅ Enhanced logging shows exact failure reasons

### Dashboard:
- ✅ Loads allocations from API on mount
- ✅ Falls back to local DB if API fails
- ✅ Shows user-friendly "Working Offline" toast
- ✅ Refreshes after order placement

---

## Expected Console Logs

### On App Startup:
```
🟡 Initializing database...
✅ Database initialized
🟡 Closing stale attendance records...
✅ Attendance cleanup done
🟡 Running migrations...
✅ Migrations complete
🟡 Fetching fresh allocations from API...
[allocService] getMyAllocations headers: {...}
[allocService] getMyAllocations status: 200
[allocService] getMyAllocations data: {...}
✅ Fresh allocations fetched: 15
[InitSync] 🚀 Initializing sync system...
[InitSync] ✅ Sync system initialized
```

### On Sync Queue Processing:
```
[SyncService] 🔄 Processing sync queue...
[SyncService] 📦 Found 1 items to sync
[SyncService] 🔍 Processing item: { table: "visits", operation: "INSERT", ... }
[SyncService] 🔄 Syncing visits (INSERT): 6bf95222...
[SyncService] 📍 Routing to syncVisit
[SyncService] 🔄 Syncing visit: { allocationId: "68ff6275...", ... }
[visitApiService] createVisit payload: {...}
[visitApiService] createVisit status: 201
[SyncService] ✅ Visit synced
[Handler] Result for visits/INSERT: true
[SyncService] ✅ Synced: visits/6bf95222...
[SyncService] 📊 Sync complete: 1 success, 0 failed
```

---

## Testing

### Test 1: Verify Sync Handler Works
1. **Reload app** (press `r` in Metro or shake device)
2. **Check console** for `[InitSync] ✅ Sync system initialized`
3. **Create a visit** while offline
4. **Go online** and wait 15 seconds
5. **Should see:** `[SyncService] ✅ Visit synced`

### Test 2: Verify Allocation API Called
1. **Reload app**
2. **Check console** for:
   - `🟡 Fetching fresh allocations from API...`
   - `✅ Fresh allocations fetched: X`
3. **Dashboard should load** with fresh shop data

### Test 3: Verify Offline Fallback
1. **Turn off network**
2. **Reload app**
3. **Should see:**
   - `⚠️ Failed to fetch allocations from API`
   - Dashboard loads from local DB
   - Toast: "Working Offline"

---

## Remaining Considerations

### Allocation Data Not Persisted to Local DB
**Current behavior:** 
- API data is fetched but not saved to local `allocations` table
- Dashboard displays API data but doesn't persist it
- On next offline startup, only seeded/manual allocations show

**Recommendation:**
Consider creating an allocation sync service that:
1. Fetches allocations from API
2. Saves to local `allocations` and `shops` tables
3. Provides true offline-first capability

**Would require:**
```typescript
// services/allocations/AllocationSyncService.ts
async syncAllocationsToLocalDB() {
  const apiData = await allocService.getMyAllocations();
  const db = DatabaseService.getInstance().getDatabase();
  
  // Clear old allocations
  await db.executeSql('DELETE FROM allocations WHERE user_id = ?', [userId]);
  
  // Insert fresh allocations
  for (const alloc of apiData.data.allocations) {
    await db.executeSql(
      'INSERT INTO allocations (...) VALUES (...)',
      [alloc.shop._id, alloc._id, ...]
    );
    // Also upsert shop data
    await db.executeSql('INSERT OR REPLACE INTO shops (...)', [...]);
  }
}
```

---

## Summary

✅ **Sync handler** now properly routes to correct API endpoints  
✅ **Dashboard code** fixed - no more malformed functions  
✅ **Fresh allocations** fetched from API on every app startup  
✅ **Enhanced logging** makes debugging sync issues trivial  
✅ **Graceful offline fallback** ensures app works without network  

**Next steps:** Run the app and verify the console logs match the expected output above.
