# Offline Sync Testing Guide

## Setup Complete ✅

The offline-first sync system has been implemented with the following fixes:

### Fixed Issues:
1. ✅ **Database Schema** - Added `retry_count` and `timestamp` columns to `sync_queue` table
2. ✅ **Auto Migration** - Existing databases will be automatically migrated on app startup
3. ✅ **Sync Initialization** - Properly initialized in `App.tsx`
4. ✅ **API Routing** - Smart routing to correct APIs based on data type

## Testing Steps

### 1. Fresh Start
```bash
# Clear app data and reinstall
npm run android
```

### 2. Test Online Sync

1. **Ensure device is online** (WiFi/Mobile data ON)
2. **Check-in**:
   - Press "Check In" button
   - Should see: `✅ Checked In Successfully - Synced to server`
   - Console should show: `[OfflineFirst] 🟢 Online - calling API`

3. **Location Tracking**:
   - After check-in, location should be tracked automatically
   - Console should show: `[OfflineFirst] 🟢 Online - calling API for trackings`

4. **Check-out**:
   - Press "Check Out" button
   - Should see: `✅ Checked Out Successfully`
   - Console should show API call logs

### 3. Test Offline Mode

1. **Turn OFF WiFi and Mobile Data**
2. **Check-in while offline**:
   - Press "Check In" button
   - Should see: `✅ Checked In Successfully - Saved locally (will sync)`
   - Console should show: `[OfflineFirst] 🔴 Offline - queueing attendance_records for sync`

3. **Move around** (location tracking):
   - Location updates should be queued
   - Console should show: `[OfflineFirst] 🔴 Offline - queueing trackings for sync`

4. **Check sync pending count**:
   - Dashboard should show "Sync Pending: X" (where X > 0)

### 4. Test Sync on Network Restore

1. **Turn ON WiFi/Mobile Data**
2. **Watch console logs**:
   ```
   [NetworkUtils] 🟢 ONLINE
   [SyncService] 🟢 Network restored - triggering sync
   [SyncService] 🔄 Processing sync queue...
   [SyncService] 📦 Found X items to sync
   [SyncService] 🔄 Syncing attendance_records (INSERT): xxx
   [SyncService] ✅ Attendance check-in synced
   [SyncService] 🔄 Syncing trackings (INSERT): xxx
   [SyncService] ✅ Location tracking synced
   [SyncService] 📊 Sync complete: X success, 0 failed
   ```

3. **Check sync pending count**:
   - Should decrease to 0 after successful sync

### 5. Test Background Sync

1. **Keep app open with network ON**
2. **Background sync runs every 15 seconds**
3. **Watch for periodic logs**:
   ```
   [SyncService] 🔄 Processing sync queue...
   [SyncService] ✅ Queue is empty
   ```

## Expected Console Logs

### On App Startup:
```
[DatabaseService] 🔄 Adding retry_count column to sync_queue
[DatabaseService] 🔄 Adding timestamp column to sync_queue
[DatabaseService] ✅ sync_queue migration complete
[DatabaseService] ✅ Database initialized successfully
[InitSync] 🚀 Initializing sync system...
[InitSync] ✅ Sync system initialized
[SyncService] ⏳ Background sync started
```

### On Network Change:
```
[NetworkUtils] 🟢 ONLINE  (or 🔴 OFFLINE)
```

### On Check-in (Online):
```
[OfflineFirst] 🟢 Online - calling API for attendance_records
[OfflineFirst] ✅ API call successful
[Dashboard] createCheckIn response: {...}
```

### On Check-in (Offline):
```
[OfflineFirst] 🔴 Offline - queueing attendance_records for sync
[Dashboard] createCheckIn response: null
```

### On Sync:
```
[SyncService] 🔄 Processing sync queue...
[SyncService] 📦 Found 3 items to sync
[SyncService] 🔄 Syncing attendance_records (INSERT): xxx
[SyncService] ✅ Attendance check-in synced
[SyncService] ✅ Synced: attendance_records/xxx
[SyncService] 📊 Sync complete: 3 success, 0 failed
```

## Troubleshooting

### Migration Error?
```
[DatabaseService] ❌ sync_queue migration failed: ...
```
**Solution**: Clear app data or reinstall

### Sync Not Triggering?
**Check**:
1. Is network actually online? (Check device settings)
2. Is background sync running? (Look for `⏳ Background sync started`)
3. Are there items in queue? (Check sync pending count)

### API Errors?
```
[SyncService] ❌ Attendance sync failed: ...
```
**Check**:
1. Backend server is running
2. Auth tokens are valid
3. API endpoints are correct in `lib/axios.ts`

### Duplicate Syncs?
- Each item should only sync once
- Check `synced` column in database (should be 1 after sync)

## Database Inspection

To manually check the sync queue:

```typescript
const db = DatabaseService.getInstance().getDatabase();
const [result] = await db.executeSql('SELECT * FROM sync_queue');
console.log('Queue items:', result.rows.length);
for (let i = 0; i < result.rows.length; i++) {
  console.log(result.rows.item(i));
}
```

## Success Criteria

✅ Check-in works online and offline
✅ Location tracking works online and offline
✅ Check-out works online
✅ Sync pending count is accurate
✅ Network restoration triggers immediate sync
✅ Background sync runs every 15 seconds
✅ All queued items sync successfully when online
✅ No duplicate data in backend
✅ Console logs are clear and helpful

## Notes

- Sync runs every **15 seconds** by default
- Sync processes up to **25 items** per batch
- Failed syncs are retried automatically
- Items remain in queue until successfully synced
- Migration runs automatically on first launch after update
