// import SQLite from 'react-native-sqlite-storage';
// import { DatabaseBackupService } from './DatabaseBackupService';

// SQLite.DEBUG(true);
// SQLite.enablePromise(true);

// export class DatabaseService {
//   private static instance: DatabaseService;
//   private database: SQLite.SQLiteDatabase | null = null;
//   private readonly databaseName = 'sp_loc_track_app.db';
//   private readonly databaseVersion = '1.0';

//   private constructor() {}

//   public static getInstance(): DatabaseService {
//     if (!DatabaseService.instance) {
//       DatabaseService.instance = new DatabaseService();
//     }
//     return DatabaseService.instance;
//   }

//   public async initialize(): Promise<void> {
//     try {
//       this.database = await SQLite.openDatabase({
//         name: this.databaseName,
//         location: 'default',
//       });

//       await this.createTables();

//       // Initialize backup service
//       const backupService = DatabaseBackupService.getInstance();
//       await backupService.initialize();
      
//       console.log('Database initialized successfully');
//     } catch (error) {
//       console.error('Database initialization failed:', error);
//       throw error;
//     }
//   }

//   private async createTables(): Promise<void> {
//     if (!this.database) {
//       throw new Error('Database not initialized');
//     }

//     const tables = [
//       // Users table
//       `CREATE TABLE IF NOT EXISTS users (
//         id TEXT PRIMARY KEY,
//         name TEXT NOT NULL,
//         email TEXT UNIQUE NOT NULL,
//         password_hash TEXT NOT NULL,
//         phone TEXT,
//         role TEXT DEFAULT 'user',
//         status TEXT DEFAULT 'active',
//         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//         updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
//       )`,

//       // Shops table
//       `CREATE TABLE IF NOT EXISTS shops (
//         id TEXT PRIMARY KEY,
//         name TEXT NOT NULL,
//         address TEXT NOT NULL,
//         owner_name TEXT NOT NULL,
//         owner_phone TEXT,
//         latitude REAL,
//         longitude REAL,
//         status TEXT DEFAULT 'active',
//         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//         updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
//       )`,

//       // Allocations table (User-Shop assignments with frequency)
//       `CREATE TABLE IF NOT EXISTS allocations (
//         id TEXT PRIMARY KEY,
//         user_id TEXT NOT NULL,
//         shop_id TEXT NOT NULL,
//         frequency TEXT NOT NULL CHECK(frequency IN ('single', 'daily', 'weekly', 'monthly')),
//         assigned_days TEXT, -- JSON string for weekly/monthly assignments
//         start_date DATE NOT NULL,
//         end_date DATE,
//         status TEXT DEFAULT 'active',
//         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//         updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
//         FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
//         UNIQUE(user_id, shop_id, start_date)
//       )`,

//       // Visits table (Shop visits by users)
//       `CREATE TABLE IF NOT EXISTS visits (
//         id TEXT PRIMARY KEY,
//         user_id TEXT NOT NULL,
//         shop_id TEXT NOT NULL,
//         allocation_id TEXT,
//         visit_date DATE NOT NULL,
//         status TEXT DEFAULT 'planned',
//         notes TEXT,
//         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//         updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
//         FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
//         FOREIGN KEY (allocation_id) REFERENCES allocations(id) ON DELETE SET NULL
//       )`,

//       // Check-in/Check-out records
//       `CREATE TABLE IF NOT EXISTS attendance_records (
//         id TEXT PRIMARY KEY,
//         user_id TEXT NOT NULL,
//         shop_id TEXT,
//         check_in_time DATETIME NOT NULL,
//         check_out_time DATETIME,
//         check_in_latitude REAL,
//         check_in_longitude REAL,
//         check_out_latitude REAL,
//         check_out_longitude REAL,
//         location_history TEXT, -- JSON array of location updates
//         total_distance REAL DEFAULT 0,
//         status TEXT DEFAULT 'active',
//         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//         updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
//         FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL
//       )`,

//       // Location tracking points
//       `CREATE TABLE IF NOT EXISTS location_tracking (
//         id TEXT PRIMARY KEY,
//         attendance_record_id TEXT NOT NULL,
//         latitude REAL NOT NULL,
//         longitude REAL NOT NULL,
//         accuracy REAL,
//         timestamp DATETIME NOT NULL,
//         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//         FOREIGN KEY (attendance_record_id) REFERENCES attendance_records(id) ON DELETE CASCADE
//       )`,

//       // Recurring locations (for weekly/monthly assignments)
//       `CREATE TABLE IF NOT EXISTS recurring_locations (
//         id TEXT PRIMARY KEY,
//         allocation_id TEXT NOT NULL,
//         location_type TEXT NOT NULL CHECK(location_type IN ('weekly', 'monthly')),
//         schedule_data TEXT NOT NULL, -- JSON with day/week details
//         status TEXT DEFAULT 'active',
//         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//         updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//         FOREIGN KEY (allocation_id) REFERENCES allocations(id) ON DELETE CASCADE
//       )`,



//       // Authentication tokens (local storage replacement)
//       `CREATE TABLE IF NOT EXISTS auth_tokens (
//         id INTEGER PRIMARY KEY AUTOINCREMENT,
//         user_id TEXT NOT NULL,
//         access_token TEXT NOT NULL,
//         refresh_token TEXT,
//         expires_at DATETIME NOT NULL,
//         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//         updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//         UNIQUE(user_id)
//       )`
//     ];

//     for (const tableSQL of tables) {
//       await this.database.executeSql(tableSQL);
//     }

//     // Create indexes for better performance
//     const indexes = [
//       'CREATE INDEX IF NOT EXISTS idx_allocations_user_id ON allocations(user_id)',
//       'CREATE INDEX IF NOT EXISTS idx_allocations_shop_id ON allocations(shop_id)',
//       'CREATE INDEX IF NOT EXISTS idx_visits_user_id ON visits(user_id)',
//       'CREATE INDEX IF NOT EXISTS idx_visits_shop_id ON visits(shop_id)',
//       'CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date)',
//       'CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance_records(user_id)',
//       'CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(check_in_time)',
//       'CREATE INDEX IF NOT EXISTS idx_location_tracking_record_id ON location_tracking(attendance_record_id)',
//       'CREATE INDEX IF NOT EXISTS idx_location_tracking_timestamp ON location_tracking(timestamp)',
//       'CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id)'
//     ];

//     for (const indexSQL of indexes) {
//       await this.database.executeSql(indexSQL);
//     }

//     await this.createUpdatedAtTriggers();
//     console.log('All tables created successfully');
//   }
//   private async createUpdatedAtTriggers(): Promise<void> {
//     if (!this.database) {
//       throw new Error('Database not initialized');
//     }

//     // List of tables that need updated_at triggers
//     const tables = [
//       'users',
//       'shops',
//       'allocations',
//       'visits',
//       'attendance_records',
//       'recurring_locations',
//       'auth_tokens'
//     ];

//     for (const table of tables) {
//       const triggerSQL = `
//         CREATE TRIGGER IF NOT EXISTS update_${table}_timestamp 
//         AFTER UPDATE ON ${table}
//         BEGIN
//           UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
//         END;
//       `;
//       await this.database.executeSql(triggerSQL);
//     }
//   }

//   public getDatabase(): SQLite.SQLiteDatabase {
//     if (!this.database) {
//       throw new Error('Database not initialized. Call initialize() first.');
//     }
//     return this.database;
//   }

//   public async close(): Promise<void> {
//     if (this.database) {
//       // Stop backup service
//       const backupService = DatabaseBackupService.getInstance();
//       backupService.stopAutoBackup();

//       // Create final backup before closing
//       try {
//         await backupService.createBackup();
//       } catch (error) {
//         console.error('Final backup failed:', error);
//       }

//       await this.database.close();
//       this.database = null;
//     }
//   }

//   // Generic query method with retries and error handling
//   public async executeSql(sql: string, params: any[] = [], retries = 3): Promise<SQLite.ResultSet> {
//     let lastError: Error | null = null;
    
//     for (let attempt = 1; attempt <= retries; attempt++) {
//       try {
//         const db = this.getDatabase();
//         const result = await db.executeSql(sql, params);
//         // db.executeSql returns [ResultSet], so return the first element
//         return result[0];
//       } catch (error: any) {
//         lastError = error;
//         console.warn(`Database operation failed (attempt ${attempt}/${retries}):`, error);
        
//         // Handle specific error cases
//         if (error.code === 'SQLITE_BUSY' || error.code === 'SQLITE_LOCKED') {
//           // Wait before retrying if database is locked
//           await new Promise<void>((resolve) => setTimeout(resolve, 1000 * attempt));
//           continue;
//         }
        
//         if (error.code === 'SQLITE_CORRUPT' || error.code === 'SQLITE_NOTADB') {
//           // Database corruption detected - try to recover
//           await this.handleDatabaseCorruption();
//           continue;
//         }

//         // For other errors, retry immediately
//         continue;
//       }
//     }

//     // If we get here, all retries failed
//     throw new Error(`Database operation failed after ${retries} attempts. Last error: ${lastError?.message}`);
//   }

//   private async handleDatabaseCorruption(): Promise<void> {
//     console.error('Database corruption detected. Attempting recovery...');
    
//     try {
//       // Close current connection
//       await this.close();
      
//       // Delete corrupted database file
//       await SQLite.deleteDatabase({
//         name: this.databaseName,
//         location: 'default'
//       });
      
//       // Reinitialize database
//       await this.initialize();
      
//       console.log('Database recovery successful');
//     } catch (error) {
//       console.error('Database recovery failed:', error);
//       throw error;
//     }
//   }

//   // Helper methods to view table data
//   public async getTableData(tableName: string): Promise<any[]> {
//     try {
//       const result = await this.executeSql(`SELECT * FROM ${tableName}`);
//       const items: any[] = [];
//       for (let i = 0; i < result.rows.length; i++) {
//         items.push(result.rows.item(i));
//       }
//       return items;
//     } catch (error) {
//       console.error(`Error fetching data from ${tableName}:`, error);
//       throw error;
//     }
//   }

//   public async getAllTableNames(): Promise<string[]> {
//     try {
//       const result = await this.executeSql(
//         "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
//       );
//       const tables: string[] = [];
//       for (let i = 0; i < result.rows.length; i++) {
//         tables.push(result.rows.item(i).name);
//       }
//       return tables;
//     } catch (error) {
//       console.error('Error fetching table names:', error);
//       throw error;
//     }
//   }
// }
import SQLite from 'react-native-sqlite-storage';
import { DatabaseBackupService } from './DatabaseBackupService';

SQLite.DEBUG(false);
SQLite.enablePromise(true);

export class DatabaseService {
  private static instance: DatabaseService;
  private database: SQLite.SQLiteDatabase | null = null;
  private readonly databaseName = 'sp_loc_track_app.db';
  private readonly databaseVersion = '1.0';

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      this.database = await SQLite.openDatabase({
        name: this.databaseName,
        location: 'default',
      });

      await this.createTables();
      await this.migrateSyncQueue();

      const backupService = DatabaseBackupService.getInstance();
      await backupService.initialize();

      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  // ---------- Migration for sync_queue table ----------
  private async migrateSyncQueue(): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    try {
      // Check if retry_count and timestamp columns exist
      const [result] = await this.database.executeSql(
        `PRAGMA table_info(sync_queue)`
      );

      const columns = [];
      for (let i = 0; i < result.rows.length; i++) {
        columns.push(result.rows.item(i).name);
      }

      const hasRetryCount = columns.includes('retry_count');
      const hasTimestamp = columns.includes('timestamp');

      // Add missing columns
      if (!hasRetryCount) {
        console.log('[DatabaseService] 🔄 Adding retry_count column to sync_queue');
        await this.database.executeSql(
          `ALTER TABLE sync_queue ADD COLUMN retry_count INTEGER DEFAULT 0`
        );
      }

      if (!hasTimestamp) {
        console.log('[DatabaseService] 🔄 Adding timestamp column to sync_queue');
        // SQLite doesn't allow non-constant defaults in ALTER TABLE, so add without default
        await this.database.executeSql(
          `ALTER TABLE sync_queue ADD COLUMN timestamp DATETIME`
        );
        // Set timestamp = created_at for all existing rows
        await this.database.executeSql(
          `UPDATE sync_queue SET timestamp = created_at WHERE timestamp IS NULL`
        );
      }

      console.log('[DatabaseService] ✅ sync_queue migration complete');
    } catch (error) {
      console.error('[DatabaseService] ❌ sync_queue migration failed:', error);
      // Don't throw - allow app to continue even if migration fails
    }
  }

  // ---------- Create Tables ----------
  private async createTables(): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        phone TEXT,
        role TEXT DEFAULT 'user',
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS shops (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        owner_phone TEXT,
        latitude REAL,
        longitude REAL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS allocations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        shop_id TEXT NOT NULL,
        frequency TEXT NOT NULL CHECK(frequency IN ('single','daily','weekly','monthly')),
        assigned_days TEXT,
        start_date DATE NOT NULL,
        end_date DATE,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
        UNIQUE(user_id, shop_id, start_date)
      )`,

      `CREATE TABLE IF NOT EXISTS visits (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        shop_id TEXT NOT NULL,
        allocation_id TEXT,
        visit_date DATE NOT NULL,
        status TEXT DEFAULT 'planned',
        orders JSON DEFAULT '[]',
        notes TEXT,
        synced INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
        FOREIGN KEY (allocation_id) REFERENCES allocations(id) ON DELETE SET NULL
      )`,

      `CREATE TABLE IF NOT EXISTS attendance_records (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        shop_id TEXT,
        check_in_time DATETIME NOT NULL,
        check_out_time DATETIME,
        check_in_latitude REAL,
        check_in_longitude REAL,
        check_out_latitude REAL,
        check_out_longitude REAL,
        location_history TEXT,
        total_distance REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL
      )`,

      `CREATE TABLE IF NOT EXISTS location_tracking (
        id TEXT PRIMARY KEY,
        attendance_record_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy REAL,
        timestamp DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (attendance_record_id) REFERENCES attendance_records(id) ON DELETE CASCADE
      )`,

      // Queue for offline sync operations
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        data TEXT,
        synced INTEGER DEFAULT 0,
        retry_count INTEGER DEFAULT 0,
        timestamp DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS recurring_locations (
        id TEXT PRIMARY KEY,
        allocation_id TEXT NOT NULL,
        location_type TEXT NOT NULL CHECK(location_type IN ('weekly','monthly')),
        schedule_data TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (allocation_id) REFERENCES allocations(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS auth_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )`
    ];

    for (const tableSQL of tables) {
      await this.database.executeSql(tableSQL);
    }

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_allocations_user_id ON allocations(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_allocations_shop_id ON allocations(shop_id)',
      'CREATE INDEX IF NOT EXISTS idx_visits_user_id ON visits(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_visits_shop_id ON visits(shop_id)',
      'CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance_records(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(check_in_time)',
      'CREATE INDEX IF NOT EXISTS idx_location_tracking_record_id ON location_tracking(attendance_record_id)',
      'CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced)',
    ];

    for (const indexSQL of indexes) {
      await this.database.executeSql(indexSQL);
    }

    await this.createUpdatedAtTriggers();
    console.log('✅ Tables and indexes created successfully');
  }

  // ---------- Update Timestamp Trigger ----------
  private async createUpdatedAtTriggers(): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    const tables = [
      'users',
      'shops',
      'allocations',
      'visits',
      'attendance_records',
      'recurring_locations',
      'auth_tokens'
    ];

    for (const table of tables) {
      const triggerSQL = `
        CREATE TRIGGER IF NOT EXISTS update_${table}_timestamp 
        AFTER UPDATE ON ${table}
        BEGIN
          UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
      `;
      await this.database.executeSql(triggerSQL);
    }
  }

  // ---------- Utilities ----------
  public getDatabase(): SQLite.SQLiteDatabase {
    if (!this.database) throw new Error('Database not initialized');
    return this.database;
  }

  public async close(): Promise<void> {
    if (this.database) {
      const backupService = DatabaseBackupService.getInstance();
      backupService.stopAutoBackup();

      try {
        await backupService.createBackup();
      } catch (error) {
        console.error('⚠️ Final backup failed:', error);
      }

      await this.database.close();
      this.database = null;
      console.log('📁 Database closed');
    }
  }

  public async executeSql(sql: string, params: any[] = [], retries = 3): Promise<SQLite.ResultSet> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const db = this.getDatabase();
        const result = await db.executeSql(sql, params);
        return result[0];
      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️ SQL attempt ${attempt} failed:`, error);

        if (error.code === 'SQLITE_BUSY' || error.code === 'SQLITE_LOCKED') {
          await new Promise<void>((res) => setTimeout(res, 1000 * attempt));
          continue;
        }

        if (error.code === 'SQLITE_CORRUPT' || error.code === 'SQLITE_NOTADB') {
          await this.handleDatabaseCorruption();
          continue;
        }
      }
    }

    throw new Error(`Database operation failed after ${retries} attempts: ${lastError?.message}`);
  }

  private async handleDatabaseCorruption(): Promise<void> {
    console.error('🚨 Database corruption detected, attempting recovery...');
    try {
      await this.close();
      await SQLite.deleteDatabase({ name: this.databaseName, location: 'default' });
      await this.initialize();
      console.log('✅ Database recovery successful');
    } catch (error) {
      console.error('❌ Database recovery failed:', error);
      throw error;
    }
  }

  public async getTableData(tableName: string): Promise<any[]> {
    const result = await this.executeSql(`SELECT * FROM ${tableName}`);
    const rows: any[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      rows.push(result.rows.item(i));
    }
    return rows;
  }

  public async getAllTableNames(): Promise<string[]> {
    const result = await this.executeSql(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    const tables: string[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      tables.push(result.rows.item(i).name);
    }
    return tables;
  }
}
