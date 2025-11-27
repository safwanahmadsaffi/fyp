# Check-In/Check-Out API Integration - Complete ✅

## Summary

Updated Dashboard to properly call the attendance APIs (`createCheckIn`, `checkOut`, `getActiveCheckIn`) from `attendService` for check-in/check-out operations and restore active sessions on app reload.

## Changes Made

### 1. **Updated handleCheckIn** (`Components/Dashboard.tsx`)

#### Before:
```typescript
const created = await OfflineFirstService.execute(
  () => attendService.createCheckIn({}), // ❌ Empty payload
  // ...
);
```

#### After:
```typescript
const created = await OfflineFirstService.execute(
  () => attendService.createCheckIn({
    checkInTime: now.toISOString(),  // ✅ Proper timestamp
    checkInNotes: '',                // ✅ Optional notes
  }),
  {
    tableName: 'attendance_records',
    recordId: attendanceId,
    operation: 'INSERT',
    data: { 
      id: attendanceId, 
      user_id: 'current-user', 
      check_in_time: now.toISOString(),
      checkInTime: now.toISOString(),
    },
  }
);

// Extract check-in from response
const createdItem = created?.data?.checkIn || created?.data || created;
const newId = createdItem?._id || createdItem?.id || attendanceId;

// Update UI and start location tracking
setIsCheckedIn(true);
setActiveCheckInId(newId);
setCheckInTime(new Date(createdItem?.checkInTime || now));
await LocationTracker.start(newId);
```

### 2. **Updated handleCheckOut** (`Components/Dashboard.tsx`)

#### Before:
```typescript
// Always fetched active check-in from server
const activeResp = await attendService.getActiveCheckIn();
const id = activeResp?.data?.checkIn?._id;
await attendService.checkOut(id);
```

#### After:
```typescript
// Use stored ID first, fallback to API
let checkInId = activeCheckInId;

if (!checkInId) {
  const activeResp = await attendService.getActiveCheckIn();
  checkInId = activeResp?.data?.checkIn?._id;
}

// ✅ Call checkOut API with proper payload
await attendService.checkOut(checkInId, {
  checkOutTime: when.toISOString(),
});

// Update UI and stop location tracking
setIsCheckedIn(false);
setActiveCheckInId(null);
setCheckInTime(null);
await AsyncStorage.removeItem('active_attendance_id');
LocationTracker.stop();
```

### 3. **Updated App Load Logic** (`Components/Dashboard.tsx`)

#### Before:
```typescript
// Used getMyCheckIns and sorted to find latest
const resp = await attendService.getMyCheckIns();
const sorted = [...list].sort((a, b) => ...);
const latest = sorted[0];
```

#### After:
```typescript
// ✅ Use getActiveCheckIn API directly
const resp = await attendService.getActiveCheckIn();
const activeCheckIn = resp?.data?.checkIn || resp?.checkIn;

if (activeCheckIn && !activeCheckIn.checkOutTime) {
  // Active check-in found - restore session
  const checkInId = activeCheckIn._id || activeCheckIn.id;
  
  setIsCheckedIn(true);
  setCheckInTime(new Date(activeCheckIn.checkInTime));
  setActiveCheckInId(checkInId);
  
  // Save to AsyncStorage
  await AsyncStorage.setItem('active_attendance_id', checkInId);
  await AsyncStorage.setItem('latest_checkin', JSON.stringify(activeCheckIn));
  
  // Start location tracking
  await LocationTracker.start(checkInId);
  
  console.log('[Dashboard] ✅ Restored active check-in session');
} else {
  // No active check-in
  setIsCheckedIn(false);
  setActiveCheckInId(null);
}
```

## API Endpoints Used

### 1. **POST /checkins** - Create Check-In

**Request:**
```http
POST https://sp-loc-track-backend.vercel.app/api/checkins
Content-Type: application/json
Authorization: Bearer {{token}}

{
  "checkInTime": "2024-01-22T10:30:00.000Z",
  "checkInNotes": "Starting work day"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Check-in created successfully",
  "data": {
    "checkIn": {
      "_id": "checkin-123",
      "user": "user-456",
      "checkInTime": "2024-01-22T10:30:00.000Z",
      "checkInNotes": "Starting work day",
      "checkOutTime": null
    }
  }
}
```

### 2. **PUT /checkins/:id/checkout** - Check Out

**Request:**
```http
PUT https://sp-loc-track-backend.vercel.app/api/checkins/checkin-123/checkout
Content-Type: application/json
Authorization: Bearer {{token}}

{
  "checkOutTime": "2024-01-22T18:30:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Checked out successfully",
  "data": {
    "checkIn": {
      "_id": "checkin-123",
      "user": "user-456",
      "checkInTime": "2024-01-22T10:30:00.000Z",
      "checkOutTime": "2024-01-22T18:30:00.000Z",
      "durationMs": 28800000
    }
  }
}
```

### 3. **GET /checkins/active** - Get Active Check-In

**Request:**
```http
GET https://sp-loc-track-backend.vercel.app/api/checkins/active
Authorization: Bearer {{token}}
```

**Response (Active Check-In):**
```json
{
  "success": true,
  "message": "Active check-in retrieved",
  "data": {
    "checkIn": {
      "_id": "checkin-123",
      "user": "user-456",
      "checkInTime": "2024-01-22T10:30:00.000Z",
      "checkOutTime": null
    }
  }
}
```

**Response (No Active Check-In):**
```json
{
  "success": true,
  "message": "No active check-in found",
  "data": {
    "checkIn": null
  }
}
```

## Flow Diagrams

### Check-In Flow:

```
User Clicks "Check In"
    ↓
handleCheckIn()
    ↓
Call attendService.createCheckIn({
  checkInTime: ISO timestamp,
  checkInNotes: ""
})
    ↓
OfflineFirstService.execute()
    ↓
If Online:
  → POST /checkins
  → Response: { data: { checkIn: { _id, checkInTime } } }
If Offline:
  → Save to local DB
  → Queue for sync
    ↓
Extract check-in ID from response
    ↓
Update UI State:
  - setIsCheckedIn(true)
  - setActiveCheckInId(id)
  - setCheckInTime(timestamp)
    ↓
Save to AsyncStorage:
  - active_attendance_id
  - latest_checkin
    ↓
Start Location Tracking
    ↓
Show Success Toast ✅
```

### Check-Out Flow:

```
User Clicks "Check Out"
    ↓
handleCheckOut()
    ↓
Get check-in ID:
  - From state (activeCheckInId)
  - Or fetch from API (getActiveCheckIn)
    ↓
Call attendService.checkOut(id, {
  checkOutTime: ISO timestamp
})
    ↓
PUT /checkins/:id/checkout
    ↓
Response: { data: { checkIn: { checkOutTime } } }
    ↓
Update UI State:
  - setIsCheckedIn(false)
  - setActiveCheckInId(null)
  - setCheckInTime(null)
    ↓
Clear AsyncStorage:
  - active_attendance_id
  - latest_checkin
    ↓
Stop Location Tracking
    ↓
Show Success Toast ✅
```

### App Reload Flow:

```
App Starts
    ↓
Dashboard useEffect()
    ↓
Call attendService.getActiveCheckIn()
    ↓
GET /checkins/active
    ↓
Response: { data: { checkIn: {...} } }
    ↓
If checkIn exists && checkOutTime is null:
  ✅ Active session found
  → Restore UI state
  → Save to AsyncStorage
  → Start location tracking
  → Show timer
Else:
  ❌ No active session
  → Clear UI state
  → Clear AsyncStorage
  → Show "Check In" button
    ↓
User sees correct state ✅
```

## Console Output Examples

### Successful Check-In:
```
[Dashboard] Creating check-in...
[attendService] createCheckIn payload: { checkInTime: "2024-01-22T10:30:00.000Z", checkInNotes: "" }
[attendService] createCheckIn status: 201
[attendService] createCheckIn data: { success: true, data: { checkIn: { _id: "...", ... } } }
[Dashboard] createCheckIn response: { data: { checkIn: {...} } }
[Dashboard] ✅ Check-in successful, ID: checkin-123
```

### Successful Check-Out:
```
[Dashboard] handleCheckOut called
[Dashboard] Check-in ID for checkout: checkin-123
[Dashboard] Calling attendService.checkOut with id: checkin-123
[attendService] checkOut id: checkin-123
[attendService] checkOut payload: { checkOutTime: "2024-01-22T18:30:00.000Z" }
[attendService] checkOut status: 200
[attendService] checkOut data: { success: true, data: { checkIn: {...} } }
[Dashboard] ✅ Check-out successful
```

### App Reload with Active Check-In:
```
[Dashboard] Checking for active check-in on app load...
[attendService] getActiveCheckIn headers: { Authorization: "Bearer ..." }
[attendService] getActiveCheckIn status: 200
[attendService] getActiveCheckIn data: { success: true, data: { checkIn: {...} } }
[Dashboard] Active check-in found: checkin-123
[Dashboard] ✅ Restored active check-in session
```

### App Reload without Active Check-In:
```
[Dashboard] Checking for active check-in on app load...
[attendService] getActiveCheckIn status: 200
[attendService] getActiveCheckIn data: { success: true, data: { checkIn: null } }
[Dashboard] No active check-in found
```

## Error Handling

### Check-In Errors:
```typescript
try {
  await attendService.createCheckIn({...});
} catch (error) {
  console.error('[Dashboard] Check-in error:', error);
  Toast.show({
    type: 'error',
    text1: 'Check-in failed',
    text2: 'Please try again',
  });
}
```

### Check-Out Errors:
```typescript
try {
  await attendService.checkOut(id, {...});
} catch (err) {
  console.error('[Dashboard] Checkout failed:', err);
  Toast.show({
    type: 'error',
    text1: 'Checkout failed',
    text2: 'Please try again',
  });
}
```

### App Load Errors:
```typescript
try {
  const resp = await attendService.getActiveCheckIn();
  // ... restore session
} catch (error) {
  console.error('[Dashboard] Failed to check active check-in:', error);
  // Fallback to AsyncStorage
  const active = await AsyncStorage.getItem('active_attendance_id');
  if (active) {
    setActiveCheckInId(active);
    setIsCheckedIn(true);
  }
}
```

## Offline Support

### Check-In Offline:
```typescript
// OfflineFirstService handles offline scenario
const created = await OfflineFirstService.execute(
  () => attendService.createCheckIn({...}),  // Try API first
  {
    tableName: 'attendance_records',          // Fallback to local DB
    recordId: attendanceId,
    operation: 'INSERT',
    data: { ... }
  }
);

// If offline:
// 1. Saves to local SQLite
// 2. Queues for sync
// 3. Returns local data
// 4. UI updates normally
// 5. Syncs when online
```

### Check-Out Offline:
```typescript
// Check-out currently requires online connection
// Future enhancement: Add offline support with OfflineFirstService
```

## Testing

### Test Check-In:

1. **Open Dashboard**
2. **Click "Check In" button**
3. **Expected**:
   - API call to POST /checkins
   - Toast: "Checked In Successfully"
   - Button changes to "Check Out"
   - Timer starts
   - Location tracking starts

4. **Console Output**:
   ```
   [Dashboard] Creating check-in...
   [attendService] createCheckIn status: 201
   [Dashboard] ✅ Check-in successful, ID: checkin-123
   ```

### Test Check-Out:

1. **With Active Check-In**
2. **Click "Check Out" button**
3. **Expected**:
   - API call to PUT /checkins/:id/checkout
   - Toast: "Checked Out Successfully"
   - Button changes to "Check In"
   - Timer stops
   - Location tracking stops

4. **Console Output**:
   ```
   [Dashboard] handleCheckOut called
   [attendService] checkOut status: 200
   [Dashboard] ✅ Check-out successful
   ```

### Test App Reload:

1. **Check in first**
2. **Close app completely**
3. **Reopen app**
4. **Expected**:
   - API call to GET /checkins/active
   - Session restored automatically
   - Timer shows correct elapsed time
   - "Check Out" button visible
   - Location tracking resumes

5. **Console Output**:
   ```
   [Dashboard] Checking for active check-in on app load...
   [Dashboard] Active check-in found: checkin-123
   [Dashboard] ✅ Restored active check-in session
   ```

### Test No Active Check-In on Reload:

1. **Open app without checking in**
2. **Expected**:
   - API call to GET /checkins/active
   - No session found
   - "Check In" button visible
   - No timer

3. **Console Output**:
   ```
   [Dashboard] No active check-in found
   ```

## Benefits

### Before:
- ❌ Empty payload to createCheckIn
- ❌ Always fetched from server on checkout
- ❌ Used getMyCheckIns + sorting for active check-in
- ❌ Inefficient API usage

### After:
- ✅ Proper payload with timestamp and notes
- ✅ Uses stored ID first, API as fallback
- ✅ Uses dedicated getActiveCheckIn endpoint
- ✅ Efficient and optimized
- ✅ Proper error handling
- ✅ Session restoration on app reload
- ✅ Location tracking integration

## Files Modified

1. ✅ `Components/Dashboard.tsx` - Updated check-in, check-out, and app load logic

## Integration with Other Features

### Location Tracking:
```typescript
// On check-in
await LocationTracker.start(checkInId);

// On check-out
LocationTracker.stop();
```

### Sync Queue:
```typescript
// If offline, check-in is queued
OfflineFirstService.execute(
  () => attendService.createCheckIn({...}),
  { tableName: 'attendance_records', ... }
);

// Syncs automatically when online
```

### AsyncStorage:
```typescript
// Save active session
await AsyncStorage.setItem('active_attendance_id', checkInId);
await AsyncStorage.setItem('latest_checkin', JSON.stringify(checkIn));

// Clear on check-out
await AsyncStorage.removeItem('active_attendance_id');
await AsyncStorage.removeItem('latest_checkin');
```

## Summary

The Dashboard now properly integrates with the attendance APIs:

1. ✅ **Check-In** - Calls `POST /checkins` with proper payload
2. ✅ **Check-Out** - Calls `PUT /checkins/:id/checkout` with timestamp
3. ✅ **App Reload** - Calls `GET /checkins/active` to restore session
4. ✅ **Location Tracking** - Starts on check-in, stops on check-out
5. ✅ **Offline Support** - Queues check-in if offline
6. ✅ **Error Handling** - Graceful fallbacks and user feedback
7. ✅ **State Management** - Proper UI updates and AsyncStorage sync

**Check-in/Check-out now works correctly with the backend API!** 🎉
