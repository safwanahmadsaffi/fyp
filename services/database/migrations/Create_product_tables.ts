import { DatabaseService } from '../DatabaseService';

export async function createProductTables(): Promise<void> {
  const db = DatabaseService.getInstance().getDatabase();
  
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

  // Create shop_products table (products available in each shop)
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
}