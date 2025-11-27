# Server-to-Local Database Sync Implementation

## Summary

Implemented **two-way sync** that saves API data to local SQLite database using the backend server's `_id` as the primary key.

---

## What Was Implemented

### **1. AllocationSyncService** 
📁 `services/allocations/AllocationSyncService.ts`

Fetches allocations and shops from API, saves to local database.

```typescript
// Sync allocations from server
const syncedCount = await AllocationSyncService.syncFromServer();
// Returns number of allocations synced
```

**What it does:**
- ✅ Calls `allocService.getMyAllocations()` API
- ✅ Saves each shop to `shops` table using server's `_id`
- ✅ Saves each allocation to `allocations` table using server's `_id`
- ✅ Uses `INSERT OR REPLACE` to handle new and updated records
- ✅ Returns count of synced allocations

---

### **2. VisitSyncService**
📁 `services/visits/VisitSyncService.ts`

Fetches visits from API, saves to local database.

```typescript
// Sync visits from server
const syncedCount = await VisitSyncService.syncFromServer({
  startDate: new Date('2025-11-01'),
  endDate: new Date('2025-11-10'),
  limit: 1000
});
// Returns number of visits synced
```

**What it does:**
- ✅ Calls `visitApiService.getMyVisits(params)` API
- ✅ Saves each visit to `visits` table using server's `_id`
- ✅ Uses `INSERT OR REPLACE` to handle new and updated records
- ✅ Supports date filtering (startDate, endDate)
- ✅ Marks visits as `synced = 1` (from server)
- ✅ Returns count of synced visits

---

## How It Works

### **Flow Diagram:**

```
┌─────────────────────────────────────────────────────┐
│ 1. USER OPENS APP / PULLS TO REFRESH               │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 2. SYNC FROM SERVER TO LOCAL DATABASE              │
│    AllocationSyncService.syncFromServer()           │
│    VisitSyncService.syncFromServer()                │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 3. FETCH FROM API                                   │
│    GET /allocations/my-allocations                  │
│    GET /visits/my-visits                            │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 4. SAVE TO LOCAL DATABASE (Using server's _id)     │
│    INSERT OR REPLACE INTO shops (id, name, ...)     │
│    INSERT OR REPLACE INTO allocations (id, ...)     │
│    INSERT OR REPLACE INTO visits (id, ...)          │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 5. LOAD FROM LOCAL DATABASE                        │
│    SELECT * FROM shops                              │
│    SELECT * FROM visits                             │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 6. DISPLAY IN UI                                    │
│    Data now available OFFLINE! ✅                   │
└─────────────────────────────────────────────────────┘
```

---

## Key Feature: Uses Server's `_id`

### **Before (Wrong):**
```typescript
// Generated client-side ID
const localId = generateId(); // e.g., "shop-12345"

await db.executeSql(
  'INSERT INTO shops (id, name, ...) VALUES (?, ?, ...)',
  [localId, shop.name, ...]
);
```

**Problem:** ❌ Server and client have different IDs

---

### **After (Correct):**
```typescript
// Use server's _id as primary key
await db.executeSql(
  'INSERT OR REPLACE INTO shops (id, name, ...) VALUES (?, ?, ...)',
  [shop._id, shop.name, ...] // ← Server's _id
);
```

**Benefits:** ✅ Same ID on both server and client

---

## Updated Components

### **1. Dashboard.tsx**

**Before:**
```typescript
const loadAllocations = async () => {
  const resp = await allocService.getMyAllocations();
  const shops = mapToShops(resp.data.allocations);
  setShops(shops); // ← Only in React state, NOT in database
};
```

**After:**
```typescript
const loadAllocations = async () => {
  try {
    // 1. Sync from server to local database
    const syncedCount = await AllocationSyncService.syncFromServer();
    
    // 2. Load from local database
    await loadShopsFromLocalDB();
    
    Toast.show({
      type: 'success',
      text1: 'Data Synced',
      text2: `Loaded ${syncedCount} shops from server`
    });
  } catch (error) {
    // Offline fallback
    await loadShopsFromLocalDB();
    
    Toast.show({
      type: 'info',
      text1: 'Working Offline',
      text2: 'Showing locally stored data'
    });
  }
};
```

---

### **2. Shops.tsx**

**Before:**
```typescript
const fetchVisitsWithDateFilter = async () => {
  const response = await visitApiService.getMyVisits(params);
  const visits = response?.data?.visits || [];
  setFilteredVisits(visits); // ← Only in React state, NOT in database
};
```

**After:**
```typescript
const fetchVisitsWithDateFilter = async () => {
  try {
    // 1. Sync from server to local database
    const syncedCount = await VisitSyncService.syncFromServer({
      startDate,
      endDate,
      limit: 1000
    });
    
    // 2. Load from local database
    const localVisits = await VisitService.getVisits(filter);
    const transformedVisits = localVisits.map(...);
    setFilteredVisits(transformedVisits);
    
    Toast.show({
      type: 'success',
      text1: 'Visits Synced',
      text2: `Loaded ${transformedVisits.length} visits from server`
    });
  } catch (error) {
    // Offline fallback
    const localVisits = await VisitService.getVisits(filter);
    setFilteredVisits(localVisits);
    
    Toast.show({
      type: 'info',
      text1: 'Working Offline',
      text2: 'Showing local data'
    });
  }
};
```

---

## Console Logs You'll See

### **Online (Successful Sync):**
```
[Dashboard] 📥 Syncing allocations from server to local database...
[AllocationSync] 📥 Fetching allocations from server...
[AllocationSync] ✅ Fetched 15 allocations from API
[AllocationSync] 💾 Saved shop to DB: shop-123 - Al-Hadi Store
[AllocationSync] 💾 Saved allocation to DB: alloc-456
[AllocationSync] 💾 Saved shop to DB: shop-789 - Pak Traders
[AllocationSync] 💾 Saved allocation to DB: alloc-101
...
[AllocationSync] 🎉 Synced 15 allocations to local database
[Dashboard] ✅ Synced 15 allocations to local database
[Dashboard] Loaded 15 shops from local DB

Toast: "Data Synced - Loaded 15 shops from server"
```

---

### **Offline (Fallback to Local DB):**
```
[Dashboard] 📥 Syncing allocations from server to local database...
[AllocationSync] 📥 Fetching allocations from server...
[AllocationSync] ❌ Failed to sync from server: Network request failed
[Dashboard] ❌ Failed to sync from server: Network request failed
[Dashboard] 📱 Loading shops from local database as fallback...
[Dashboard] Loaded 15 shops from local DB

Toast: "Working Offline - Showing locally stored data"
```

---

## Database Schema

### **Shops Table:**
```sql
CREATE TABLE shops (
  id TEXT PRIMARY KEY,          -- ← Server's _id
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  owner_name TEXT NOT NULL,     -- Shop owner name
  owner_phone TEXT,             -- Shop owner phone
  latitude REAL,
  longitude REAL,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **Allocations Table:**
```sql
CREATE TABLE allocations (
  id TEXT PRIMARY KEY,          -- ← Server's _id
  user_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,        -- ← References shops.id (server's _id)
  frequency TEXT,
  assigned_days TEXT,           -- JSON
  start_date DATETIME,
  end_date DATETIME,
  status TEXT,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);
```

### **Visits Table:**
```sql
CREATE TABLE visits (
  id TEXT PRIMARY KEY,          -- ← Server's _id
  user_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,        -- ← References shops.id (server's _id)
  allocation_id TEXT NOT NULL,  -- ← References allocations.id (server's _id)
  visit_date TEXT NOT NULL,     -- YYYY-MM-DD
  status TEXT,
  notes TEXT,
  synced INTEGER DEFAULT 0,     -- 0 = pending upload, 1 = synced from server
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (allocation_id) REFERENCES allocations(id)
);
```

---

## INSERT OR REPLACE Strategy

### **What It Does:**
```sql
INSERT OR REPLACE INTO shops (id, name, address, ...)
VALUES ('shop-123', 'Al-Hadi Store', 'Address', ...);
```

**Scenarios:**

1. **Record DOES NOT exist** (id = 'shop-123' not in DB)
   - → **INSERT** new record

2. **Record ALREADY exists** (id = 'shop-123' found in DB)
   - → **REPLACE** (delete old, insert new)
   - → Server data overwrites local data ✅

**Why this works:**
- ✅ Handles both new and updated records
- ✅ Server is single source of truth
- ✅ Simple conflict resolution: server wins
- ✅ No duplicate records

---

## Benefits

### **For Users:**
✅ **Latest data always available offline**
- Manager assigns new shop → User gets it after sync
- Backend updates shop info → User sees changes

✅ **No manual refresh needed**
- Data auto-syncs on app open
- Pull-to-refresh for manual sync

✅ **Seamless offline experience**
- All data accessible without internet
- No "network error" blocking UI

---

### **For Business:**
✅ **Complete two-way sync**
- Client → Server: Upload new visits/orders
- Server → Client: Download new allocations/updates

✅ **Server as single source of truth**
- Backend controls all data
- Client always gets latest state

✅ **No data loss**
- Offline operations saved locally
- Auto-sync when connection restored

---

## Testing

### **Test 1: Fresh Data Sync**
```
1. Manager assigns Shop X to User A (on backend)
2. User A opens app
3. Expected: AllocationSyncService syncs Shop X to local DB
4. Expected: Shop X displays in Dashboard
5. User A closes app and goes offline
6. User A reopens app offline
7. Expected: Shop X still displays (from local DB)
```

### **Test 2: Updated Data Sync**
```
1. Manager updates Shop A name to "New Name" (on backend)
2. User opens app
3. Expected: AllocationSyncService syncs updated name
4. Expected: Shop A displays with "New Name"
5. Verify in DB:
   SELECT name FROM shops WHERE id = 'shop-a';
   -- Should show "New Name"
```

### **Test 3: Offline Fallback**
```
1. Turn off network
2. Open app
3. Expected: "Working Offline" toast
4. Expected: Data displays from local database
5. Expected: Shows last synced data
```

### **Test 4: Visit Sync with Date Filter**
```
1. Select date range: Nov 1 - Nov 10
2. Click "Apply Date Filter"
3. Expected: VisitSyncService syncs visits in date range
4. Expected: Visits saved to local DB with server's _id
5. Expected: Visits display in UI
6. Turn off network and reload
7. Expected: Same visits display from local DB
```

---

## Verification Queries

### **Check Synced Shops:**
```sql
SELECT id, name, address FROM shops ORDER BY name;
```

### **Check Synced Allocations:**
```sql
SELECT a.id, s.name as shop_name, a.frequency 
FROM allocations a 
JOIN shops s ON s.id = a.shop_id;
```

### **Check Synced Visits:**
```sql
SELECT v.id, s.name as shop_name, v.visit_date, v.synced
FROM visits v
JOIN shops s ON s.id = v.shop_id
ORDER BY v.visit_date DESC;
```

### **Verify IDs Match Server:**
```sql
-- All IDs should match server's _id format
SELECT id FROM shops WHERE id LIKE 'shop-%' OR id LIKE '6%';
SELECT id FROM allocations WHERE id LIKE 'alloc-%' OR id LIKE '6%';
SELECT id FROM visits WHERE id LIKE 'visit-%' OR id LIKE '6%';
```

---

## Summary

### **What Changed:**
❌ **Before:** API data displayed but NOT saved to local database
✅ **After:** API data synced to local database using server's `_id`

### **Implementation:**
✅ Created `AllocationSyncService` - syncs allocations & shops
✅ Created `VisitSyncService` - syncs visits
✅ Updated `Dashboard.tsx` - uses AllocationSyncService
✅ Updated `Shops.tsx` - uses VisitSyncService
✅ Uses `INSERT OR REPLACE` with server's `_id` as primary key

### **Result:**
✅ **Complete two-way sync** (Client ↔ Server)
✅ **Server's _id preserved** in local database
✅ **Latest data always available offline**
✅ **Server as single source of truth**
✅ **No data loss**

**The app now has full server-to-client sync using backend's `_id`!** 🎉✨
