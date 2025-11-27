# Database Migration Notes

## sync_queue Table Update

### Changes Made

Added two new columns to the `sync_queue` table:
1. **`retry_count`** - Tracks how many times a sync operation has been retried
2. **`timestamp`** - Used for ordering sync operations (replaces reliance on `created_at`)

### Migration Strategy

The migration runs automatically on app startup via `DatabaseService.migrateSyncQueue()`:

1. Checks if columns exist using `PRAGMA table_info(sync_queue)`
2. Adds missing columns using `ALTER TABLE` (without DEFAULT for timestamp due to SQLite limitation)
3. Copies `created_at` values to `timestamp` for existing rows

**Note**: SQLite doesn't allow non-constant defaults (like `CURRENT_TIMESTAMP`) in `ALTER TABLE ADD COLUMN`, so the `timestamp` column is added without a default value, then populated from `created_at`.

### Table Schema (Updated)

```sql
CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  data TEXT,
  synced INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,        -- NEW
  timestamp DATETIME,                   -- NEW (set by enqueueSync)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### If Migration Fails

If you encounter issues, you can manually reset the database:

#### Option 1: Clear App Data (Android)
```
Settings → Apps → [Your App] → Storage → Clear Data
```

#### Option 2: Uninstall and Reinstall
```bash
npm run android
```

#### Option 3: Manual SQL (Advanced)
```sql
-- Add columns manually
ALTER TABLE sync_queue ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE sync_queue ADD COLUMN timestamp DATETIME;
UPDATE sync_queue SET timestamp = created_at WHERE timestamp IS NULL;
```

### Verification

Check console logs on app startup:
- ✅ `[DatabaseService] ✅ sync_queue migration complete` - Success
- ❌ `[DatabaseService] ❌ sync_queue migration failed:` - Error (check details)

### Backward Compatibility

- Old data is preserved
- Existing `created_at` values are copied to `timestamp`
- Default values ensure new rows work correctly
