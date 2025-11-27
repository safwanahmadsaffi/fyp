# SyncService - Offline Shop Visit to Online Sync Flow

## Complete Scenario Explanation

**Your Question:** *"What can SyncService do when I visit any allocated shop while offline and become online in a while?"*

---

## 📖 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│            SCENARIO: Visit Shop While OFFLINE                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: User Clicks "Visit Shop" Button                        │
├─────────────────────────────────────────────────────────────────┤
│  Dashboard.tsx or Shops.tsx:                                    │
│    VisitService.createVisit({                                   │
│      userId: 'current-user',                                    │
│      shopId: '12345',                                           │
│      allocationId: 'alloc-abc',                                 │
│      date: new Date()                                           │
│    })                                                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: OfflineFirstService Checks Network                     │
├─────────────────────────────────────────────────────────────────┤
│  NetworkUtils.checkConnection()                                 │
│    → Returns: false (OFFLINE)                                   │
│                                                                 │
│  Console: "[OfflineFirst] 🔴 Offline - queueing visits"        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Data Stored in TWO Places                              │
├─────────────────────────────────────────────────────────────────┤
│  A) LOCAL DATABASE (visits table):                              │
│     INSERT INTO visits (                                        │
│       id, user_id, shop_id, allocation_id,                      │
│       visit_date, status, notes, synced                         │
│     ) VALUES (                                                  │
│       'visit-123', 'user-2', '12345', 'alloc-abc',              │
│       '2025-11-10', 'completed', 'Good visit', 0 ← NOT SYNCED   │
│     )                                                           │
│                                                                 │
│  B) SYNC QUEUE (sync_queue table):                              │
│     INSERT INTO sync_queue (                                    │
│       id, table_name, record_id, operation, data,               │
│       synced, retry_count, timestamp                            │
│     ) VALUES (                                                  │
│       'queue-456', 'visits', 'visit-123', 'INSERT',             │
│       '{"allocation_id":"alloc-abc","shop_id":"12345",...}',    │
│       0, 0, '2025-11-10T10:30:00Z'                              │
│     )                                                           │
│                                                                 │
│  Console: "✅ Visit created locally: visit-123"                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: User Can Continue Working Offline                      │
├─────────────────────────────────────────────────────────────────┤
│  ✅ Visit shows as "Visited" in Dashboard                        │
│  ✅ User can create orders for this visit (also queued)         │
│  ✅ All data stored locally in SQLite                           │
│  ✅ App works normally - no errors!                             │
│                                                                 │
│  Console: "[SyncService] 🔴 Offline - skipping sync"           │
│  (Background sync checks every 15 seconds but skips if offline) │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│            USER COMES BACK ONLINE                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: Background Sync Detects Online Status                  │
├─────────────────────────────────────────────────────────────────┤
│  SyncService runs every 15 seconds (background job)             │
│                                                                 │
│  NetworkUtils.checkConnection()                                 │
│    → Returns: true (ONLINE! 🟢)                                 │
│                                                                 │
│  Console: "[SyncService] 🔄 Processing sync queue..."          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: Fetch Pending Items from Queue                         │
├─────────────────────────────────────────────────────────────────┤
│  SELECT * FROM sync_queue                                       │
│  WHERE synced = 0                                               │
│  ORDER BY timestamp ASC                                         │
│  LIMIT 50                                                       │
│                                                                 │
│  Found Items:                                                   │
│  - visit-123 (visits table, INSERT operation)                   │
│  - order-789 (orders table, INSERT operation)                   │
│                                                                 │
│  Console: "[SyncService] 📦 Found 2 items to sync"             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 7: Process Each Item with Smart Handler                   │
├─────────────────────────────────────────────────────────────────┤
│  For item 1 (visit):                                            │
│    Console: "[SyncService] 🔍 Processing item:"                │
│    {                                                            │
│      table: "visits",                                           │
│      operation: "INSERT",                                       │
│      record_id: "visit-123"                                     │
│    }                                                            │
│                                                                 │
│  setSmartApiHandler() routes based on table_name:               │
│    table_name === 'visits'                                      │
│      → Route to: syncVisit(item, parsedData)                    │
│                                                                 │
│  Console: "[SyncService] 📍 Routing to syncVisit"              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 8: syncVisit() Calls Backend API                          │
├─────────────────────────────────────────────────────────────────┤
│  syncVisit(item, data) {                                        │
│    if (operation === 'INSERT') {                                │
│      visitApiService.createVisit({                              │
│        allocationId: 'alloc-abc',                               │
│        visitDateTime: '2025-11-10T10:30:00Z',                   │
│        duration: 30,                                            │
│        notes: 'Good visit'                                      │
│      })                                                         │
│    }                                                            │
│  }                                                              │
│                                                                 │
│  HTTP Request:                                                  │
│    POST /visits/create                                          │
│    Headers: { Authorization: 'Bearer <token>' }                 │
│    Body: {                                                      │
│      allocationId: 'alloc-abc',                                 │
│      visitDateTime: '2025-11-10T10:30:00Z',                     │
│      duration: 30,                                              │
│      notes: 'Good visit'                                        │
│    }                                                            │
│                                                                 │
│  Console: "[SyncService] 🔄 Syncing visit:"                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 9: Backend Response & Queue Update                        │
├─────────────────────────────────────────────────────────────────┤
│  Backend Response:                                              │
│    Status: 200 OK                                               │
│    Body: { success: true, visit: { _id: 'server-visit-id' } }  │
│                                                                 │
│  syncVisit() returns: true ✅                                   │
│                                                                 │
│  Console: "[SyncService] ✅ Visit synced"                       │
│  Console: "[Handler] Result for visits/INSERT: true"           │
│                                                                 │
│  Update sync queue:                                             │
│    UPDATE sync_queue                                            │
│    SET synced = 1                                               │
│    WHERE id = 'queue-456'                                       │
│                                                                 │
│  Console: "[SyncService] ✅ Synced: visits/visit-123"          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 10: Process Orders (If Any)                               │
├─────────────────────────────────────────────────────────────────┤
│  For item 2 (order):                                            │
│    Route to: syncOrder(item, parsedData)                        │
│    Call: orderApiService.createOrder({ ... })                   │
│    Mark as synced if successful                                 │
│                                                                 │
│  Console: "[SyncService] ✅ Order synced"                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 11: Final Summary                                         │
├─────────────────────────────────────────────────────────────────┤
│  Console: "[SyncService] 📊 Summary:"                           │
│    - ✅ Success: 2                                              │
│    - ⚠️ Failed: 0                                               │
│    - 🗑️ Skipped: 0                                              │
│                                                                 │
│  User sees Toast (if implemented):                              │
│    "✅ All data synced successfully"                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 What SyncService Does - Summary

### When OFFLINE (Creating Visit):
1. ✅ **Stores visit locally** in SQLite `visits` table
2. ✅ **Queues for sync** in `sync_queue` table
3. ✅ **User sees visit** as "Visited" immediately
4. ✅ **No errors** - app works normally

### When ONLINE (Auto-Sync):
1. 🔍 **Detects network** is back online
2. 📦 **Fetches pending items** from sync queue
3. 🔄 **Routes to correct API** based on table name
4. 📤 **Sends to backend** (POST /visits/create)
5. ✅ **Marks as synced** if successful
6. 🔁 **Retries if failed** (up to 10 times)

---

## 📋 Supported Operations

SyncService can sync these operations when you go online:

| **Table Name** | **Operation** | **API Endpoint** | **What It Does** |
|---|---|---|---|
| `visits` | INSERT | POST /visits/create | Creates visit record on server |
| `orders` | INSERT | POST /orders/create | Creates order with items |
| `attendance_records` | INSERT | POST /attendance/check-in | Records check-in time |
| `attendance_records` | UPDATE | PUT /attendance/:id/check-out | Records check-out time |
| `trackings` | INSERT | POST /tracking/bulk | Sends GPS location history |

---

## 🔥 Real Example with Console Logs

### While OFFLINE:
```
[Dashboard] User clicked visit for shop: Al-Hadi Store
[VisitService] Creating visit...
[OfflineFirst] 🔴 Offline - queueing visits for sync
[enqueueSync] Queued: visits/visit-123 (INSERT)
✅ Visit created locally: visit-123

[Dashboard] Shop status updated: Pending → Visited
```

### When ONLINE (15 seconds later):
```
[SyncService] 🔄 Processing sync queue...
[SyncService] 📦 Found 1 items to sync

[SyncService] 🔍 Processing item: {
  id: "queue-456",
  table: "visits",
  operation: "INSERT",
  record_id: "visit-123",
  retry_count: 0
}

[SyncService] 📍 Routing to syncVisit

[SyncService] 🔄 Syncing visit: {
  allocationId: "alloc-abc",
  visitDateTime: "2025-11-10T10:30:00Z",
  duration: 30
}

[visitApiService] POST /visits/create
[visitApiService] Response: 200 OK

[SyncService] ✅ Visit synced
[Handler] Result for visits/INSERT: true
[SyncService] ✅ Synced: visits/visit-123

[SyncService] 📊 Summary:
  - ✅ Success: 1
  - ⚠️ Failed: 0
  - 🗑️ Skipped: 0
```

---

## 🛡️ Error Handling

### What if API Fails?

#### 1. **Network Error (Cannot reach server)**
```
[SyncService] ❌ Visit sync failed: Network Error
[Handler] Result for visits/INSERT: false
UPDATE sync_queue SET retry_count = retry_count + 1
[SyncService] ⚠️ Failed: visits/visit-123 (retry: 1)
```
- Will retry on next sync cycle (15 seconds)

#### 2. **400/404/409 Error (Client Error)**
```
[SyncService] ❌ Visit sync failed (400): Allocation not found
[SyncService] ⚠️ Marking as synced due to client error
UPDATE sync_queue SET synced = 1
```
- Marks as synced to remove from queue (won't keep retrying invalid data)

#### 3. **500 Error (Server Error)**
```
[SyncService] ❌ Visit sync failed (500): Internal Server Error
[Handler] Result for visits/INSERT: false
UPDATE sync_queue SET retry_count = retry_count + 1
```
- Retries up to 5 times
- After 5 retries: Marks as synced to prevent infinite loop

#### 4. **Too Many Retries (>10)**
```
[SyncService] 🗑️ Removing item with 10 retries: visits/visit-123
UPDATE sync_queue SET synced = 1
```
- Auto-removes stuck items from queue

---

## ⏱️ Sync Timing

### Background Sync Runs Every **15 Seconds**

```typescript
// In initializeSync.ts:
syncService.startBackground(15000); // 15 seconds
```

**Timeline:**
```
00:00 - User visits shop offline → Queued
00:15 - Sync check #1 → Still offline, skip
00:30 - Sync check #2 → Still offline, skip
00:45 - User comes online
01:00 - Sync check #3 → Online! Process queue → Visit synced ✅
```

**Maximum delay:** 15 seconds after coming online

---

## 🧪 Testing the Flow

### Test 1: Basic Offline Visit
1. **Turn off WiFi/Mobile Data**
2. **Open Dashboard → Visit any shop**
3. **Expected:**
   ```
   ✅ Shop shows as "Visited"
   Console: "🔴 Offline - queueing visits for sync"
   ```
4. **Check sync_queue table:**
   ```sql
   SELECT * FROM sync_queue WHERE synced = 0;
   -- Should show 1 row for the visit
   ```

### Test 2: Auto-Sync When Online
1. **Keep app open**
2. **Turn WiFi back on**
3. **Wait ~15 seconds**
4. **Expected:**
   ```
   Console: "[SyncService] 🔄 Processing sync queue..."
   Console: "[SyncService] ✅ Visit synced"
   ```
5. **Check sync_queue table:**
   ```sql
   SELECT * FROM sync_queue WHERE synced = 1;
   -- Row should now have synced = 1
   ```

### Test 3: Multiple Operations
1. **Offline: Visit shop A**
2. **Offline: Create order for shop A**
3. **Offline: Visit shop B**
4. **Go online → Wait 15 seconds**
5. **Expected:**
   ```
   Console: "📦 Found 3 items to sync"
   Console: "✅ Synced: visits/visit-1"
   Console: "✅ Synced: orders/order-1"
   Console: "✅ Synced: visits/visit-2"
   ```

---

## 💡 Key Features

### ✅ **Smart Routing**
- Visits → `/visits/create`
- Orders → `/orders/create`
- Attendance → `/attendance/check-in` or `/check-out`
- Tracking → `/tracking/bulk`

### ✅ **Automatic Retry**
- Retries failed items up to 10 times
- Exponential backoff (every 15 seconds)

### ✅ **Error Recovery**
- Client errors (400/404/409) → Skip (mark as synced)
- Server errors (500) → Retry 5 times then skip
- Network errors → Keep retrying

### ✅ **Data Integrity**
- Items synced in chronological order (by timestamp)
- No data loss - everything stored locally first

### ✅ **Queue Management**
- Auto-removes stuck items (>10 retries)
- Cleans up completed items
- Shows sync stats

---

## 🎓 Summary

**When you visit a shop offline:**
1. Visit recorded **locally** in SQLite
2. Visit **queued** for sync
3. App works **normally** - no errors

**When you come back online:**
1. SyncService **detects** connection
2. **Fetches** pending visits from queue
3. **Sends** to backend API
4. **Marks** as synced if successful
5. **Retries** if failed

**Result:** Your offline visit data automatically syncs to the backend within ~15 seconds of coming online! 🎉

---

## 📚 Related Files

- `services/sync/SyncService.ts` - Main sync logic
- `services/sync/OfflineFirstService.ts` - Offline detection
- `services/sync/enqueue.ts` - Queue management
- `services/visits/VisitService.ts` - Visit creation
- `services/visits/visitApiService.ts` - Visit API calls

---

**The SyncService ensures you never lose data, even when working completely offline!** 📱✨
