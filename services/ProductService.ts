import { DatabaseService } from './database/DatabaseService';
import { Product, Order, OrderItem } from '../types/product';
import { generateId } from './utils/uid';

export class ProductService {
  private static instance: ProductService;
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): ProductService {
    if (!ProductService.instance) {
      ProductService.instance = new ProductService();
    }
    return ProductService.instance;
  }

  // Get all products available for a shop
  public async getShopProducts(shopId: string): Promise<Product[]> {
    try {
      const db = this.db.getDatabase();
      const [results] = await db.executeSql(
        `SELECT p.*, sp.in_stock
         FROM products p
         INNER JOIN shop_products sp ON p.id = sp.product_id
         WHERE sp.shop_id = ?
         ORDER BY p.name`,
        [shopId]
      );

      const products: Product[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        const row = results.rows.item(i);
        products.push({
          id: row.id,
          name: row.name,
          price: row.price,
          description: row.description,
          category: row.category,
          unit: row.unit,
          inStock: row.in_stock === 1
        });
      }

      return products;
    } catch (error) {
      console.error('Failed to get shop products:', error);
      throw error;
    }
  }

  // Create a new order for a shop visit
  public async createOrder(params: {
    shopId: string;
    visitId: string;
    userId: string;
    items: Omit<OrderItem, 'id'>[];
  }): Promise<Order> {
    try {
      const db = this.db.getDatabase();
      const orderId = generateId();
      const now = new Date().toISOString();

      // Calculate total amount
      const totalAmount = params.items.reduce((sum: number, item: Omit<OrderItem, 'id'>) => 
        sum + (item.price * item.quantity), 0);

      // Create order
      await db.executeSql(
        `INSERT INTO orders (
          id, shop_id, visit_id, user_id, total_amount, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [orderId, params.shopId, params.visitId, params.userId, totalAmount, now, now]
      );

      // Create order items
      for (const item of params.items) {
        const itemId = generateId();
        await db.executeSql(
          `INSERT INTO order_items (
            id, order_id, product_id, quantity, price, notes
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [itemId, orderId, item.productId, item.quantity, item.price, item.notes ?? null]
        );
      }

      // Return created order
      return {
        id: orderId,
        shopId: params.shopId,
        visitId: params.visitId,
        userId: params.userId,
        items: params.items.map(item => ({ ...item, id: generateId() })),
        totalAmount,
        status: 'pending',
        createdAt: now,
        updatedAt: now
      };
    } catch (error) {
      console.error('Failed to create order:', error);
      throw error;
    }
  }

  // Update an existing order
  public async updateOrder(orderId: string, updates: Partial<Order>): Promise<void> {
    try {
      const db = this.db.getDatabase();
      const now = new Date().toISOString();

      if (updates.items) {
        // Delete existing items
        await db.executeSql('DELETE FROM order_items WHERE order_id = ?', [orderId]);

        // Insert new items
        for (const item of updates.items) {
          await db.executeSql(
            `INSERT INTO order_items (id, order_id, product_id, quantity, price, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [item.id, orderId, item.productId, item.quantity, item.price, item.notes ?? null]
          );
        }

        // Update total amount
        updates.totalAmount = updates.items.reduce((sum: number, item: OrderItem) => 
          sum + (item.price * item.quantity), 0);
      }

      // Update order
      const updateFields = Object.entries(updates)
        .filter(([key]) => key !== 'items')
        .map(([key]) => `${key} = ?`)
        .join(', ');

      if (updateFields) {
        const values = Object.entries(updates)
          .filter(([key]) => key !== 'items')
          .map(([, value]) => value);

        await db.executeSql(
          `UPDATE orders SET ${updateFields}, updated_at = ? WHERE id = ?`,
          [...values, now, orderId]
        );
      }
    } catch (error) {
      console.error('Failed to update order:', error);
      throw error;
    }
  }
}