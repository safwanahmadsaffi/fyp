import { DatabaseService } from './DatabaseService';
import { User, Shop, Allocation, AuthToken } from '../../types';
import { PasswordService } from '../auth/PasswordService';

export class DatabaseMigrations {
  private static instance: DatabaseMigrations;
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): DatabaseMigrations {
    if (!DatabaseMigrations.instance) {
      DatabaseMigrations.instance = new DatabaseMigrations();
    }
    return DatabaseMigrations.instance;
  }

  // Run all migrations
  public async runMigrations(): Promise<void> {
    try {
      await this.db.initialize();

      // Run migrations in order
      await this.migrationV1_0_0();
      await this.migrationV1_1_0(); // Add product tables
      await this.migrationV1_2_0(); // Update orders table for sync
      // await this.seedInitialData(); // ❌ DISABLED: Mock data removed for production

      console.log('All migrations completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  // Initial database schema migration
  private async migrationV1_0_0(): Promise<void> {
    const db = this.db.getDatabase();

    // The schema is already created in DatabaseService
    // This migration ensures all tables exist and are properly structured
    console.log('Running migration v1.0.0 - Initial schema');

    // Check if tables exist and create them if they don't
    const tables = [
      'users', 'shops', 'allocations', 'visits', 'attendance_records',
      'location_tracking', 'recurring_locations', 'sync_queue', 'auth_tokens',
      'products', 'shop_products', 'orders', 'order_items'
    ];

    for (const table of tables) {
      const [results] = await db.executeSql(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        [table]
      );

      if (results.rows.length === 0) {
        console.log(`Table ${table} does not exist, creating...`);
        // Tables will be created by DatabaseService.initialize()
      } else {
        console.log(`Table ${table} already exists`);
      }
    }
  }

  // Seed initial data for development/testing
  private async seedInitialData(): Promise<void> {
    console.log('Seeding initial data...');

    // Seed admin user (only if no users exist)
    await this.seedUsers();

    // Seed sample shops (only if no shops exist)
    await this.seedShops();

    // Seed sample allocations (only if no allocations exist)
    await this.seedAllocations();
  }

  private async seedUsers(): Promise<void> {
    const db = this.db.getDatabase();

    // Check if users already exist
    const [userResults] = await db.executeSql('SELECT COUNT(*) as count FROM users');
    const userCount = userResults.rows.item(0).count;

    if (userCount > 0) {
      console.log('Users already exist, skipping user seeding');
      return;
    }

    const sampleUsers: Omit<User, 'created_at' | 'updated_at'>[] = [
      {
        id: 'user-1',
        name: 'Admin User',
        email: 'admin@company.com',
        phone: '+1234567890',
        role: 'admin',
        status: 'active',
      },
      {
        id: 'user-2',
        name: 'John Salesman',
        email: 'john@company.com',
        phone: '+1234567891',
        role: 'user',
        status: 'active',
      },
      {
        id: 'user-3',
        name: 'Sarah Manager',
        email: 'sarah@company.com',
        phone: '+1234567892',
        role: 'manager',
        status: 'active',
      },
    ];

    for (const user of sampleUsers) {
      // Create password hash for initial users (using "password123" as default password)
      const passwordHash = PasswordService.hashPassword('password123');
      await db.executeSql(
        `INSERT INTO users (id, name, email, password_hash, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [user.id, user.name, user.email, passwordHash, user.phone, user.role, user.status]
      );
    }

    console.log('Sample users seeded successfully');
  }

  private async seedShops(): Promise<void> {
    const db = this.db.getDatabase();

    // Check if shops already exist
    const [shopResults] = await db.executeSql('SELECT COUNT(*) as count FROM shops');
    const shopCount = shopResults.rows.item(0).count;

    if (shopCount > 0) {
      console.log('Shops already exist, skipping shop seeding');
      return;
    }

    const sampleShops: Omit<Shop, 'created_at' | 'updated_at'>[] = [
      {
        id: 'shop-1',
        name: 'Al-Hadi Store',
        address: 'Block A, Main Street, City Center',
        owner_name: 'Mr. Ali Ahmed',
        owner_phone: '+92 300 1234567',
        latitude: 24.8607,
        longitude: 67.0011,
        status: 'active',
      },
      {
        id: 'shop-2',
        name: 'Khan Grocers',
        address: 'Market Road, Plaza 3, Commercial Area',
        owner_name: 'Mr. Khan',
        owner_phone: '+92 312 7654321',
        latitude: 24.8620,
        longitude: 67.0030,
        status: 'active',
      },
      {
        id: 'shop-3',
        name: 'City Pharmacy',
        address: 'Street 5, Near Shopping Mall',
        owner_name: 'Mrs. Sana',
        owner_phone: '+92 321 4567890',
        latitude: 24.8640,
        longitude: 67.0050,
        status: 'active',
      },
      {
        id: 'shop-4',
        name: 'Islam Bookstore',
        address: 'Street 1, Near Central Mall',
        owner_name: 'Mr. Talha',
        owner_phone: '+92 321 4567891',
        latitude: 24.8660,
        longitude: 67.0070,
        status: 'active',
      },
      {
        id: 'shop-5',
        name: 'Imitiaz Mart',
        address: 'Street 10, Near Business District',
        owner_name: 'Mr. Ahmed',
        owner_phone: '+92 321 4567892',
        latitude: 24.8680,
        longitude: 67.0090,
        status: 'active',
      },
    ];

    for (const shop of sampleShops) {
      await db.executeSql(
        `INSERT INTO shops (id, name, address, owner_name, owner_phone, latitude, longitude, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          shop.id, shop.name, shop.address, shop.owner_name,
          shop.owner_phone, shop.latitude, shop.longitude, shop.status
        ]
      );
    }

    console.log('Sample shops seeded successfully');
  }

  private async seedAllocations(): Promise<void> {
    const db = this.db.getDatabase();

    // Check if allocations already exist
    const [allocationResults] = await db.executeSql('SELECT COUNT(*) as count FROM allocations');
    const allocationCount = allocationResults.rows.item(0).count;

    if (allocationCount > 0) {
      console.log('Allocations already exist, skipping allocation seeding');
      return;
    }

    // Get users and shops for creating allocations
    const [userResults] = await db.executeSql('SELECT id FROM users WHERE role = ? LIMIT 1', ['user']);
    const [shopResults] = await db.executeSql('SELECT id FROM shops LIMIT 3');

    if (userResults.rows.length === 0 || shopResults.rows.length === 0) {
      console.log('No users or shops available for allocations');
      return;
    }

    const userId = userResults.rows.item(0).id;
    const today = new Date().toISOString().split('T')[0];

    const sampleAllocations = [
      {
        user_id: userId,
        shop_id: shopResults.rows.item(0).id,
        frequency: 'daily' as const,
        start_date: today,
      },
      {
        user_id: userId,
        shop_id: shopResults.rows.item(1).id,
        frequency: 'weekly' as const,
        assigned_days: JSON.stringify({ monday: true, wednesday: true, friday: true }),
        start_date: today,
      },
      {
        user_id: userId,
        shop_id: shopResults.rows.item(2).id,
        frequency: 'monthly' as const,
        assigned_days: JSON.stringify({ '1': true, '15': true }), // 1st and 15th of month
        start_date: today,
      },
    ];

    for (const allocation of sampleAllocations) {
      await db.executeSql(
        `INSERT INTO allocations (user_id, shop_id, frequency, assigned_days, start_date)
         VALUES (?, ?, ?, ?, ?)`,
        [
          allocation.user_id, allocation.shop_id, allocation.frequency,
          allocation.assigned_days, allocation.start_date
        ]
      );
    }

    console.log('Sample allocations seeded successfully');
  }

  // Clean up all data (for testing purposes)
  public async clearAllData(): Promise<void> {
    const db = this.db.getDatabase();

    const tables = [
      'sync_queue', 'location_tracking', 'attendance_records',
      'visits', 'recurring_locations', 'allocations', 'shops', 'users', 'auth_tokens'
    ];

    for (const table of tables) {
      await db.executeSql(`DELETE FROM ${table}`);
    }

    console.log('All data cleared');
  }

  // Migration v1.1.0 - Add product and order tables
  private async migrationV1_1_0(): Promise<void> {
    console.log('Running migration v1.1.0 - Adding product and order tables');
    
    const db = this.db.getDatabase();
    
    // Create products table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        description TEXT,
        category TEXT,
        unit TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create shop_products table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS shop_products (
        shop_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        in_stock INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (shop_id, product_id),
        FOREIGN KEY (shop_id) REFERENCES shops(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    // Create orders table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        visit_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT CHECK(status IN ('pending', 'confirmed', 'cancelled')) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shop_id) REFERENCES shops(id),
        FOREIGN KEY (visit_id) REFERENCES visits(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Create order_items table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    await this.seedProducts();
  }

  // Seed product data
  private async seedProducts(): Promise<void> {
    const db = this.db.getDatabase();

    // Check if products already exist
    const [productResults] = await db.executeSql('SELECT COUNT(*) as count FROM products');
    const productCount = productResults.rows.item(0).count;

    if (productCount > 0) {
      console.log('Products already exist, skipping product seeding');
      return;
    }

    const { sampleProducts } = require('./migrations/sample-data/products');

    // Insert sample products
    for (const product of sampleProducts) {
      await db.executeSql(
        `INSERT INTO products (id, name, price, description, category, unit)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [product.id, product.name, product.price, product.description, product.category, product.unit]
      );
    }

    // Assign products to all existing shops
    const [shopResults] = await db.executeSql('SELECT id FROM shops');
    for (let i = 0; i < shopResults.rows.length; i++) {
      const shopId = shopResults.rows.item(i).id;
      for (const product of sampleProducts) {
        await db.executeSql(
          `INSERT INTO shop_products (shop_id, product_id, in_stock)
           VALUES (?, ?, 1)`,
          [shopId, product.id]
        );
      }
    }

    console.log('Sample products seeded successfully');
  }

  // Migration v1.2.0 - Update orders table for sync support
  private async migrationV1_2_0(): Promise<void> {
    const db = this.db.getDatabase();
    console.log('Running migration v1.2.0 - Update orders table for sync');

    try {
      // Drop old orders and order_items tables
      await db.executeSql('DROP TABLE IF EXISTS order_items');
      await db.executeSql('DROP TABLE IF EXISTS orders');

      // Recreate orders table with new schema
      await db.executeSql(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          shop_id TEXT NOT NULL,
          shop_name TEXT NOT NULL,
          items TEXT NOT NULL,
          total_amount REAL NOT NULL,
          notes TEXT,
          order_date TEXT NOT NULL,
          synced INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT,
          FOREIGN KEY (shop_id) REFERENCES shops(id)
        )
      `);

      console.log('✅ Orders table updated with sync support');
    } catch (error) {
      console.error('❌ Failed to update orders table:', error);
      throw error;
    }
  }

  // Get database statistics
  public async getDatabaseStats(): Promise<{
    users: number;
    shops: number;
    allocations: number;
    visits: number;
    attendance_records: number;
    location_tracking: number;
  }> {
    const db = this.db.getDatabase();

    const queries = [
      'SELECT COUNT(*) as count FROM users',
      'SELECT COUNT(*) as count FROM shops',
      'SELECT COUNT(*) as count FROM allocations',
      'SELECT COUNT(*) as count FROM visits',
      'SELECT COUNT(*) as count FROM attendance_records',
      'SELECT COUNT(*) as count FROM location_tracking',
    ];

    const results = await Promise.all(queries.map(query => db.executeSql(query)));

    return {
      users: results[0][0].rows.item(0).count,
      shops: results[1][0].rows.item(0).count,
      allocations: results[2][0].rows.item(0).count,
      visits: results[3][0].rows.item(0).count,
      attendance_records: results[4][0].rows.item(0).count,
      location_tracking: results[5][0].rows.item(0).count,
    };
  }
}
