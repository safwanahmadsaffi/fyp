# Sync Handler Failure Debugging Guide

## Why Handler Returns False

The sync handler in `SyncService.ts` returns `false` for these specific reasons:

### 1. **Unsupported Operations** (Most Common)

Each table has **strict operation support**:

| Table | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|
| `attendance_records` | ✅ | ✅ | ❌ |
| `trackings` / `location_tracking` | ✅ | ❌ | ❌ |
| `visits` | ✅ | ❌ | ❌ |
| `orders` | ✅ | ❌ | ❌ |

**If you queue an unsupported operation, it will always return false.**

### 2. **Unknown Table Names**

Table names must match **exactly**:
- ✅ `attendance_records`
- ✅ `trackings` or `location_tracking`
- ✅ `visits`
- ✅ `orders`
- ❌ `attendance` (wrong)
- ❌ `tracking` (wrong - missing 's')
- ❌ `visit` (wrong - missing 's')

### 3. **API Call Failures**

API errors are handled as follows:
- **400, 404, 409**: Marked as synced (return true) - removes from queue
- **500** (after 5 retries): Marked as synced (return true)
- **401, 403** (Auth errors): Return false - will retry
- **502, 503** (Gateway errors): Return false - will retry
- **Network errors**: Return false - will retry

### 4. **JSON Parse Errors**

If the `data` field in sync_queue contains invalid JSON, the handler will:
- Log: `[SyncService] ⚠️ JSON parse error - invalid data format`
- Return: `false`

---

## How to Debug

### Step 1: Check Console Logs

With the enhanced logging, you'll now see:

```
[SyncService] 🔍 Processing item: {
  id: "...",
  table: "trackings",
  operation: "UPDATE",    // ⚠️ Look for this!
  record_id: "...",
  retry_count: 3,
  data_preview: "..."
}
[SyncService] 📍 Routing to syncTracking
[SyncService] ⚠️ Unsupported operation for tracking: UPDATE
[SyncService] ℹ️ Tracking only supports: INSERT
[Handler] Result for trackings/UPDATE: false
```

### Step 2: Inspect Sync Queue

Run this query to see what's in your queue:

```sql
SELECT id, table_name, operation, retry_count, 
       substr(data, 1, 100) as data_preview
FROM sync_queue 
WHERE synced = 0 
ORDER BY retry_count DESC, timestamp ASC;
```

### Step 3: Check for Common Issues

#### Issue A: UPDATE/DELETE on Tracking
```typescript
// ❌ WRONG - Will fail
enqueueSync('trackings', recordId, 'UPDATE', data);
enqueueSync('trackings', recordId, 'DELETE', data);

// ✅ CORRECT - Only INSERT supported
enqueueSync('trackings', recordId, 'INSERT', data);
```

#### Issue B: Wrong Table Name
```typescript
// ❌ WRONG - Table name mismatch
enqueueSync('attendance', recordId, 'INSERT', data);
enqueueSync('tracking', recordId, 'INSERT', data);

// ✅ CORRECT
enqueueSync('attendance_records', recordId, 'INSERT', data);
enqueueSync('trackings', recordId, 'INSERT', data);
```

#### Issue C: API Authentication
```typescript
// Check if your API tokens are valid
// Look for 401/403 errors in logs:
// [SyncService] ❌ Attendance sync failed (401): Unauthorized
```

---

## Quick Fixes

### Fix 1: Remove Unsupported Operations

If you're queuing UPDATE/DELETE for tables that don't support them:

```typescript
// Option A: Don't queue them at all
if (table === 'trackings' && operation !== 'INSERT') {
  console.warn('Tracking only supports INSERT');
  return;
}
enqueueSync(table, recordId, operation, data);

// Option B: Convert to INSERT
if (table === 'trackings' && operation === 'UPDATE') {
  operation = 'INSERT'; // Just insert a new tracking point
}
```

### Fix 2: Clean Up Invalid Items

Remove stuck items from queue:

```typescript
// Remove items with wrong operations
await db.executeSql(
  `UPDATE sync_queue 
   SET synced = 1 
   WHERE table_name IN ('trackings', 'visits', 'orders') 
   AND operation != 'INSERT'`
);

// Remove items with unknown tables
await db.executeSql(
  `UPDATE sync_queue 
   SET synced = 1 
   WHERE table_name NOT IN (
     'attendance_records', 'trackings', 'location_tracking', 'visits', 'orders'
   )`
);
```

### Fix 3: Add Support for Missing Operations

If you need UPDATE/DELETE support, add it to the sync methods:

```typescript
private async syncTracking(item: SyncItem, data: any): Promise<boolean> {
  try {
    if (item.operation === 'INSERT') {
      // ... existing code
    } else if (item.operation === 'UPDATE') {
      // Add your UPDATE logic here
      await trackService.updateTracking(item.record_id, data);
      return true;
    } else if (item.operation === 'DELETE') {
      // Add your DELETE logic here
      await trackService.deleteTracking(item.record_id);
      return true;
    }
    return false;
  } catch (error) {
    // ... error handling
  }
}
```

---

## Monitoring

Check sync status with:

```typescript
const syncService = SyncService.getInstance();
const pendingCount = await syncService.getSyncPendingCount();
console.log(`Pending sync items: ${pendingCount}`);
```

Watch for these warning signs:
- ⚠️ Retry count > 3: Likely unsupported operation or wrong table name
- ⚠️ Same item failing repeatedly: Check operation type and table name
- ⚠️ All items failing: Check network/authentication

---

## Next Steps

1. **Run the app and check console logs** - The enhanced logging will show exactly why each item fails
2. **Identify the pattern** - Is it all UPDATE operations? A specific table? Authentication?
3. **Apply the appropriate fix** above
4. **Monitor retry counts** - Should decrease after fix

If issues persist, share the console logs showing:
- `[SyncService] 🔍 Processing item:`
- `[SyncService] 📍 Routing to...`
- `[SyncService] ⚠️ Unsupported operation...` or `[SyncService] ❌ ... sync failed`
