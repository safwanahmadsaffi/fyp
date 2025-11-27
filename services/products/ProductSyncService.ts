import { DatabaseService } from '../database/DatabaseService';
import orderApiService from '../orders/orderApiService';

/**
 * Service to sync products from server to local database
 */
export class ProductSyncService {
  /**
   * Fetch products from API and save to local database
   * Uses server's _id as primary key
   * Smart sync: Only updates products if they're new or changed
   */
  public static async syncFromServer(options?: {
    page?: number;
    limit?: number;
    search?: string;
    forceSync?: boolean; // Force sync all products regardless of existence
  }): Promise<number> {
    try {
      console.log('[ProductSync] 📥 Fetching products from server...');
      
      // 1. Fetch from API
      const response = await orderApiService.getProducts({
        page: options?.page || 1,
        limit: options?.limit || 1000,
        search: options?.search || ''
      });
      
      const products = response?.data?.products || [];
      
      console.log('[ProductSync] ✅ Fetched', products.length, 'products from API');
      
      if (products.length === 0) {
        console.log('[ProductSync] No products to sync');
        return 0;
      }
      
      const db = DatabaseService.getInstance().getDatabase();
      let syncedCount = 0;
      let skippedCount = 0;
      let updatedCount = 0;
      
      // 2. Get existing product IDs from local database for comparison
      let existingProductIds: Set<string> = new Set();
      
      if (!options?.forceSync) {
        try {
          const productIds = products.map(p => p._id);
          const placeholders = productIds.map(() => '?').join(',');
          const [existingResult] = await db.executeSql(
            `SELECT id FROM products WHERE id IN (${placeholders})`,
            productIds
          );
          
          for (let i = 0; i < existingResult.rows.length; i++) {
            existingProductIds.add(existingResult.rows.item(i).id);
          }
          
          console.log('[ProductSync] 📊 Found', existingProductIds.size, 'existing products in local DB');
        } catch (error) {
          console.warn('[ProductSync] ⚠️ Failed to check existing products, will sync all:', error);
        }
      }
      
      // 3. Insert/Update each product using server's _id
      for (const product of products) {
        try {
          const productExists = existingProductIds.has(product._id);
          
          // Skip if product already exists (unless force sync)
          if (productExists && !options?.forceSync) {
            skippedCount++;
            if (skippedCount <= 5) {
              console.log('[ProductSync] ⏭️ Skipping existing product:', product._id, '-', product.name);
            }
            continue;
          }
          
          await db.executeSql(
            `INSERT OR REPLACE INTO products 
             (id, name, price, description, category, unit, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              product._id,
              product.name || '',
              product.price || product.currentPrice || product.newPrice || 0,
              product.description || '',
              product.category || '',
              'piece', // Default unit
              (product as any).createdAt || new Date().toISOString(),
              new Date().toISOString() // Always update timestamp
            ]
          );
          
          if (productExists) {
            updatedCount++;
            if (updatedCount <= 3) {
              console.log('[ProductSync] 🔄 Updated product:', product._id, '-', product.name);
            }
          } else {
            if (syncedCount < 5) {
              console.log('[ProductSync] 💾 Saved new product to DB:', product._id, '-', product.name);
            }
          }
          
          syncedCount++;
          
        } catch (error) {
          console.error('[ProductSync] ❌ Failed to save product:', product._id, error);
        }
      }
      
      console.log('[ProductSync] 🎉 Sync complete:', {
        fetched: products.length,
        newProducts: syncedCount - updatedCount,
        updated: updatedCount,
        skipped: skippedCount,
        total: syncedCount
      });
      
      return syncedCount;
      
    } catch (error) {
      console.error('[ProductSync] ❌ Failed to sync from server:', error);
      throw error;
    }
  }
  
  /**
   * Store products from API into local database
   * Only stores if product doesn't already exist (based on _id)
   */
  public static async storeProducts(products: any[]): Promise<number> {
    try {
      if (!products || products.length === 0) {
        console.log('[ProductSync] No products to store');
        return 0;
      }

      const db = DatabaseService.getInstance().getDatabase();
      let storedCount = 0;

      for (const product of products) {
        try {
          // Check if product already exists
          const [existingResult] = await db.executeSql(
            'SELECT id FROM products WHERE id = ?',
            [product._id]
          );

          if (existingResult.rows.length === 0) {
            // Product doesn't exist, insert it
            await db.executeSql(
              `INSERT INTO products (id, name, price, description, category, unit, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
              [
                product._id,
                product.name || 'Unknown Product',
                product.price || 0,
                product.description || '',
                product.category || '',
                product.unit || 'pcs'
              ]
            );
            storedCount++;
          }
        } catch (productError) {
          console.error('[ProductSync] ❌ Failed to store product:', product._id, productError);
        }
      }

      console.log('[ProductSync] ✅ Stored', storedCount, 'new products');
      console.log('[ProductSync] ℹ️ Skipped', products.length - storedCount, 'existing products');
      
      return storedCount;
    } catch (error) {
      console.error('[ProductSync] ❌ Failed to store products:', error);
      return 0;
    }
  }

  /**
   * Get all products from local database
   */
  public static async getLocalProducts(options?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      const db = DatabaseService.getInstance().getDatabase();
      
      let query = 'SELECT * FROM products';
      const params: any[] = [];
      
      if (options?.search) {
        query += ' WHERE name LIKE ? OR description LIKE ? OR category LIKE ?';
        const searchTerm = `%${options.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }
      
      query += ' ORDER BY name ASC';
      
      if (options?.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
        
        if (options?.offset) {
          query += ' OFFSET ?';
          params.push(options.offset);
        }
      }
      
      console.log('[ProductSync] 📖 Loading from local DB:', { query, params });
      
      const [results] = await db.executeSql(query, params);
      
      const products: any[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        const row = results.rows.item(i);
        products.push({
          _id: row.id,
          name: row.name,
          price: row.price,
          currentPrice: row.price,
          newPrice: row.price,
          description: row.description,
          category: row.category,
          unit: row.unit,
          stock: 100 // Default stock
        });
      }
      
      console.log('[ProductSync] ✅ Loaded', products.length, 'products from local DB');
      
      if (products.length === 0 && options?.search) {
        console.warn('[ProductSync] ⚠️ No products found for search term:', options.search);
        console.log('[ProductSync] 💡 Tip: Make sure to open order form online at least once to sync products');
      }
      
      if (products.length === 0 && !options?.search) {
        // Check total count
        const [countResult] = await db.executeSql('SELECT COUNT(*) as count FROM products');
        const totalCount = countResult.rows.item(0).count;
        
        if (totalCount === 0) {
          console.warn('[ProductSync] ⚠️ No products in local database!');
          console.log('[ProductSync] 💡 Please open order form while online to sync products first');
        }
      }
      
      return products;
      
    } catch (error) {
      console.error('[ProductSync] ❌ Failed to load from local DB:', error);
      console.error('[ProductSync] ℹ️ Returning empty array to prevent crash');
      return []; // Return empty array instead of throwing to prevent undefined errors
    }
  }
  
  /**
   * Clear all local products
   */
  public static async clearLocal(): Promise<void> {
    try {
      const db = DatabaseService.getInstance().getDatabase();
      await db.executeSql('DELETE FROM products');
      
      console.log('[ProductSync] 🗑️ Cleared local products');
    } catch (error) {
      console.error('[ProductSync] ❌ Failed to clear local products:', error);
      throw error;
    }
  }
  
  /**
   * Full sync: clear local data then sync from server
   */
  public static async fullSync(options?: {
    limit?: number;
    search?: string;
  }): Promise<number> {
    console.log('[ProductSync] 🔄 Starting full sync...');
    await this.clearLocal();
    return await this.syncFromServer(options);
  }
  
  /**
   * Get product count from local database
   */
  public static async getLocalProductCount(): Promise<number> {
    try {
      const db = DatabaseService.getInstance().getDatabase();
      const [result] = await db.executeSql('SELECT COUNT(*) as count FROM products');
      
      const count = result.rows.item(0).count;
      console.log('[ProductSync] 📊 Local product count:', count);
      return count;
      
    } catch (error) {
      console.error('[ProductSync] ❌ Failed to get product count:', error);
      return 0;
    }
  }
}

// Export class as default for static method access
export default ProductSyncService;
