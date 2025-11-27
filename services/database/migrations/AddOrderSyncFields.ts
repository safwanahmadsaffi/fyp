import { DatabaseService } from '../DatabaseService';

export async function addOrderSyncFields(): Promise<void> {
  const db = DatabaseService.getInstance().getDatabase();
  
  console.log('[Migration] Adding order sync fields...');
  
  try {
    // Drop old orders table if it exists
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
    
    console.log('[Migration] ✅ Orders table updated with sync support');
  } catch (error) {
    console.error('[Migration] ❌ Failed to update orders table:', error);
    throw error;
  }
}
