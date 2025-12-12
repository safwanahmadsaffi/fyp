# Copilot Instructions for SP Location Tracker App

## Project Overview
React Native mobile app for salesperson location tracking with **offline-first architecture**. Salespeople can check-in/check-out, visit allocated shops, place orders, and track location—all working offline with automatic sync.

## Architecture

### Core Data Flow Pattern
```
User Action → OfflineFirstService → [Online: API call | Offline: enqueueSync] → Local SQLite → Background SyncService (15s interval) → API
```

- **Always write to local SQLite first**, queue sync operations, update UI immediately
- Use `OfflineFirstService.execute()` for write operations, `OfflineFirstService.tryApi()` for reads
- `SyncService.setSmartApiHandler()` routes queued items to correct API by `table_name`

### Service Layer Structure (`services/`)
| Directory | Purpose |
|-----------|---------|
| `sync/` | Offline-first sync engine (`SyncService`, `OfflineFirstService`, `enqueueSync`) |
| `database/` | SQLite via `DatabaseService` singleton, migrations in `DatabaseMigrations` |
| `auth/` | JWT token storage, refresh logic, `withAuthGuard` HOC |
| `attendance/` | Check-in/check-out with location tracking |
| `tracking/` | `LocationTracker` for GPS updates during check-in |
| `allocations/` | Shop-to-salesperson assignments with date/frequency logic |
| `visits/` | Shop visit recording and status management |
| `orders/` | Order creation linked to visits |

### Database Tables (see `services/database/DatabaseService.ts`)
- `attendance_records` - check-in/out with status
- `sync_queue` - pending offline operations with retry_count
- `allocations` - shop assignments with frequency (daily/weekly/monthly)
- `visits` - shop visit records
- `orders` - order data linked to visits

## Key Patterns

### 1. Offline-First Operations
```typescript
// Pattern for any create/update operation
const result = await OfflineFirstService.execute(
  () => apiService.create(data),           // API call
  { tableName: 'table_name', recordId: id, operation: 'INSERT', data }
);
// Returns API response if online+success, null if queued for sync
```

### 2. Protected Screens
Wrap authenticated screens with `withAuthGuard` HOC:
```typescript
export default withAuthGuard(MyScreen);
```

### 3. ID Generation
Always use `generateId()` from `services/utils/uid` for new records—ensures consistency across offline/online.

### 4. Sync Queue Table Names
`SyncService.setSmartApiHandler()` routes by table_name:
- `attendance_records` → `attendService`
- `trackings` / `location_tracking` → `trackService`
- `visits` → `visitApiService`
- `orders` → `orderApiService`

### 5. Navigation Types
Define all routes in `types/navigation.ts` (`RootStackParamList`). Pass callbacks via route params for data refresh.

## UI Conventions

### Styling
- Import from `Theme.tsx`: `Colors.primaryblue`, `FontSize.Body`, etc.
- Use `Abstracts/` components: `Button`, `Container`, `HeaderBar`, `ValidText`, `TextInputs`
- Responsive sizing via `react-native-responsive-dimensions`

### Toast Notifications
```typescript
import Toast from 'react-native-toast-message';
Toast.show({ type: 'success' | 'error' | 'info', text1: 'Title', text2: 'Message' });
```

### Console Logging Convention
Use emoji prefixes for visibility:
- `🟡` Starting operation
- `✅` Success
- `❌` Error
- `⚠️` Warning
- `🔄` Syncing/retrying
- `📍` Location-related

## Development Commands
```bash
npm start          # Metro bundler
npm run android    # Run on Android
npm run ios        # Run on iOS (requires pod install first)
npm test           # Jest tests
```

## Backend API
Base URL configured in `lib/axios.ts`. Uses JWT Bearer tokens with automatic refresh on 401. See `apiClient` interceptors for auth flow.

## Common Gotchas
- Allocation filtering uses `frequency` + `assigned_days` (JSON array) for weekly schedules—day 0 = Sunday
- `LocationTracker.start(attendanceId)` binds GPS to check-in session; call `stop()` on checkout
- Database must initialize before any service calls—handled in `App.tsx` `init()`
- Sync queue items with high `retry_count` get auto-cleared (see `clearFailedItems`)
