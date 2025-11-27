# First-Time User Data Loading Flow

## Overview

This document explains how a first-time user gets data from the backend when starting the app.

---

## Complete User Journey

### 1. **App Launch (First Time)**

```
User opens app for the first time
        ↓
App.tsx initialization runs:
  ✅ Database initialized
  ✅ Migrations complete (no mock data)
  ✅ Check authentication → NOT AUTHENTICATED
  ℹ️  Skipping allocation fetch (will load after login)
  ✅ All initial setup complete
        ↓
User sees Login Screen
```

**Console logs:**
```
🟡 Initializing database...
✅ Database initialized
🟡 Running migrations...
✅ Migrations complete
ℹ️ User not authenticated - Skipping allocation fetch (will load after login)
✅ All initial setup complete
```

---

### 2. **User Logs In**

```
User enters credentials and clicks Login
        ↓
Login.tsx calls unAuthService.login()
        ↓
POST /auth/login
  - Sends username & password
  - Receives: { access_token, refresh_token, user, expires_in }
        ↓
Auth data stored locally:
  - Access token → SQLite auth_tokens table
  - User info → AsyncStorage
  - Token expiry time calculated
        ↓
Navigation: Login → Dashboard
```

**Console logs:**
```
[Login] attempting login (username) { username: 'salesperson@company.com' }
[unAuthService] login request body: { username, password }
[unAuthService] login response status: 200
[unAuthService] auth stored successfully
[Login] login (username) success
```

---

### 3. **Dashboard Loads - Data Fetched from Backend**

```
Dashboard component mounts
        ↓
useEffect(() => { loadAllocations() }, [])
        ↓
loadAllocations() executes:
        ↓
allocService.getMyAllocations()
  → GET /allocations/my
  → Headers: { Authorization: 'Bearer <token>' }
        ↓
Backend returns allocations with shop data:
{
  data: {
    allocations: [
      {
        _id: '...',
        shop: {
          _id: '...',
          name: 'Shop Name',
          address: '...',
          location: { latitude, longitude }
        },
        visits: [...]
      },
      ...
    ]
  }
}
        ↓
Data mapped to Shop[] format
        ↓
setShops(mapped) → UI updates
        ↓
User sees their allocated shops!
```

**Console logs:**
```
[Dashboard] Loading allocations from API...
[allocService] getMyAllocations headers: { Authorization: 'Bearer eyJ...' }
[allocService] getMyAllocations status: 200
[allocService] getMyAllocations data: { data: { allocations: [...] } }
[Dashboard] Shop Name: visited today=false, orders=0, visitId=undefined
[Dashboard] Loaded 15 shops from API
```

---

### 4. **Offline Fallback (If API Fails)**

```
If GET /allocations/my fails (network error, server down, etc.):
        ↓
catch (error) {
  console.warn('Failed to load allocations from API')
  loadShopsFromLocalDB()  ← Falls back to local SQLite
}
        ↓
Loads shops from local 'shops' table
        ↓
Shows Toast: "Working Offline - Showing locally stored data"
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    APP STARTUP                              │
├─────────────────────────────────────────────────────────────┤
│  1. Initialize Database                                     │
│  2. Run Migrations (no mock data)                           │
│  3. Check Auth → isAuthenticated()?                         │
│     ├─ YES → Fetch allocations from API                     │
│     └─ NO  → Skip (will fetch after login)                  │
│  4. Setup sync service                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    LOGIN SCREEN                             │
├─────────────────────────────────────────────────────────────┤
│  User enters credentials                                    │
│  POST /auth/login                                           │
│  ↓                                                           │
│  Store: access_token, refresh_token, user                   │
│  ↓                                                           │
│  Navigate to Dashboard                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    DASHBOARD                                │
├─────────────────────────────────────────────────────────────┤
│  useEffect on mount:                                        │
│  ↓                                                           │
│  loadAllocations()                                          │
│  ↓                                                           │
│  GET /allocations/my (with Bearer token)                    │
│  ↓                                                           │
│  Backend returns:                                           │
│    - Allocations                                            │
│    - Shop details                                           │
│    - Visit history                                          │
│  ↓                                                           │
│  Map to UI format → setShops(mapped)                        │
│  ↓                                                           │
│  Display shops on Dashboard ✅                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Changes Made

### ✅ **App.tsx - Smart Authentication Check**

```typescript
// Before: Always tried to fetch (would fail for unauthenticated users)
const allocResp = await allocService.getMyAllocations();

// After: Only fetch if authenticated
const authService = AuthStorageService.getInstance();
const isAuthenticated = await authService.isAuthenticated();

if (isAuthenticated) {
  console.log('🟡 User authenticated - Fetching fresh allocations...');
  const allocResp = await allocService.getMyAllocations();
  console.log('✅ Fresh allocations fetched:', allocResp?.data?.allocations?.length);
} else {
  console.log('ℹ️ User not authenticated - Skipping allocation fetch');
}
```

**Benefits:**
- No failed API calls on first launch
- Clean console logs
- Data fetches at the right time

---

### ✅ **Dashboard.tsx - Always Fetches on Mount**

```typescript
// Runs every time Dashboard loads
useEffect(() => {
  loadAllocations();
}, []);

// loadAllocations fetches from API with authentication
const loadAllocations = async () => {
  try {
    const resp = await allocService.getMyAllocations();
    // Map and display data
  } catch (error) {
    // Fallback to local DB
    await loadShopsFromLocalDB();
  }
};
```

**Benefits:**
- Fresh data after login
- Automatic retry if offline initially
- Graceful fallback to local data

---

### ✅ **Login.tsx - Auto-Check Existing Auth**

```typescript
useEffect(() => {
  const checkAuth = async () => {
    const expired = await authService.isExpired();
    if (!expired) {
      navigation.replace('Dashboard'); // Skip login if already authenticated
    }
  };
  checkAuth();
}, []);
```

**Benefits:**
- Returning users skip login screen
- Jump straight to Dashboard with data

---

## Testing First-Time User Flow

### Test 1: Fresh Install (No Authentication)
1. **Uninstall app completely**
2. **Reinstall and launch**
3. **Expected:**
   - Login screen appears
   - Console: `ℹ️ User not authenticated - Skipping allocation fetch`
   - No API errors

### Test 2: Successful Login
1. **Enter valid credentials**
2. **Click Login**
3. **Expected:**
   ```
   [Login] attempting login...
   [Login] login success
   [Dashboard] Loading allocations from API...
   [Dashboard] Loaded X shops from API
   ```
4. **Dashboard shows shops** from backend

### Test 3: Offline Login Attempt
1. **Turn off network**
2. **Enter credentials**
3. **Expected:**
   - Login fails with network error
   - User can't proceed (backend authentication required)

### Test 4: Returning User (Token Valid)
1. **Close app** (after successful login)
2. **Reopen app**
3. **Expected:**
   - Auto-navigate to Dashboard (skip login)
   - Fetch fresh allocations from API
   - Data appears immediately

### Test 5: Expired Token
1. **Wait for token expiry** (or manually expire in DB)
2. **Reopen app**
3. **Expected:**
   - Shows login screen
   - User re-authenticates
   - Dashboard loads fresh data

---

## API Requirements

For first-time users to get data, your backend must provide:

### 1. **Authentication Endpoint**
```
POST /auth/login
Request: { username, password }
Response: {
  access_token: string,
  refresh_token: string,
  expires_in: number,
  user: {
    id: string,
    name: string,
    email: string,
    role: string
  }
}
```

### 2. **Allocations Endpoint**
```
GET /allocations/my
Headers: { Authorization: 'Bearer <token>' }
Response: {
  success: true,
  data: {
    allocations: [
      {
        _id: string,
        shop: {
          _id: string,
          name: string,
          address: string,
          location: { latitude: number, longitude: number }
        },
        visits: [ /* visit history */ ],
        frequency: 'daily' | 'weekly' | 'monthly'
      }
    ]
  }
}
```

---

## Summary

✅ **First launch:** App initializes without fetching data (user not authenticated)  
✅ **Login:** User authenticates via backend API  
✅ **Dashboard load:** Automatically fetches fresh allocations from backend  
✅ **Offline fallback:** Falls back to local DB if API unavailable  
✅ **Returning users:** Auto-login if token valid, fresh data loaded  

**The app now properly handles first-time users and fetches all data from the backend after authentication!** 🎉
