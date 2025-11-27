import { DatabaseService } from '../database/DatabaseService';
import { generateId } from '../utils/uid';
import orderApiService, { CreateOrderPayload, OrderItem } from './orderApiService';
import { OfflineFirstService } from '../sync/OfflineFirstService';
import { enqueueSync } from '../sync/enqueue';

export interface LocalOrder {
  id: string;
  shop_id: string;
  shop_name: string;
  items: string; // JSON stringified OrderItem[]
  total_amount: number;
  notes: string | null;
  order_date: string;
  synced: number; // 0 = not synced, 1 = synced
  created_at: string;
  updated_at: string | null;
}

export class OrderService {
  /**
   * Create a new order with offline-first approach
   */
  public static async createOrder(params: {
    shopId: string;
    shopName: string;
    items: OrderItem[];
    notes?: string;
  }): Promise<string> {
    const id = generateId();
    const orderDate = new Date().toISOString();
    const totalAmount = params.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

    // Validate items
    if (!params.items || params.items.length === 0) {
      throw new Error('At least one product must be selected');
    }

    const payload: CreateOrderPayload = {
      shopId: params.shopId,
      shopName: params.shopName,
      items: params.items,
      totalAmount,
      notes: params.notes || '',
      orderDate,
    };

    try {
      // Try API first with offline fallback
      const result = await OfflineFirstService.execute(
        () => orderApiService.createOrder(payload),
        {
          tableName: 'orders',
          recordId: id,
          operation: 'INSERT',
          data: {
            id,
            shop_id: params.shopId,
            shop_name: params.shopName,
            items: JSON.stringify(params.items),
            total_amount: totalAmount,
            notes: params.notes || null,
            order_date: orderDate,
          },
        }
      );

      // If API succeeded, return server-generated ID
      if (result && result.data?.order?._id) {
        console.log('✅ Order created via API:', result.data.order._id);
        
        // Store locally with synced flag
        await this.storeLocalOrder({
          id: result.data.order._id,
          shopId: params.shopId,
          shopName: params.shopName,
          items: params.items,
          totalAmount,
          notes: params.notes,
          orderDate,
          synced: true,
        });
        
        return result.data.order._id;
      }

      // If offline, store locally
      await this.storeLocalOrder({
        id,
        shopId: params.shopId,
        shopName: params.shopName,
        items: params.items,
        totalAmount,
        notes: params.notes,
        orderDate,
        synced: false,
      });

      console.log('✅ Order created locally (will sync when online):', id);
      return id;
    } catch (error: any) {
      console.error('❌ OrderService.createOrder error:', error?.message);
      throw error;
    }
  }

  /**
   * Store order in local database
   */
  private static async storeLocalOrder(params: {
    id: string;
    shopId: string;
    shopName: string;
    items: OrderItem[];
    totalAmount: number;
    notes?: string;
    orderDate: string;
    synced: boolean;
  }): Promise<void> {
    const db = DatabaseService.getInstance().getDatabase();
    if (!db) return;

    const now = new Date().toISOString();

    await db.executeSql(
      `INSERT OR REPLACE INTO orders (
        id, shop_id, shop_name, items, total_amount, notes, order_date, synced, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.id,
        params.shopId,
        params.shopName,
        JSON.stringify(params.items),
        params.totalAmount,
        params.notes || null,
        params.orderDate,
        params.synced ? 1 : 0,
        now,
        now,
      ]
    );
  }

  /**
   * Get orders by shop ID
   */
  public static async getOrdersByShop(shopId: string): Promise<LocalOrder[]> {
    const db = DatabaseService.getInstance().getDatabase();
    if (!db) return [];

    try {
      const [result] = await db.executeSql(
        `SELECT * FROM orders WHERE shop_id = ? ORDER BY order_date DESC`,
        [shopId]
      );

      const orders: LocalOrder[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        orders.push(result.rows.item(i));
      }

      return orders;
    } catch (error) {
      console.error('OrderService.getOrdersByShop error:', error);
      return [];
    }
  }

  /**
   * Get all local orders
   */
  public static async getAllOrders(): Promise<LocalOrder[]> {
    const db = DatabaseService.getInstance().getDatabase();
    if (!db) return [];

    try {
      const [result] = await db.executeSql(
        `SELECT * FROM orders ORDER BY order_date DESC`
      );

      const orders: LocalOrder[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        orders.push(result.rows.item(i));
      }

      return orders;
    } catch (error) {
      console.error('OrderService.getAllOrders error:', error);
      return [];
    }
  }

  /**
   * Get pending (unsynced) orders count
   */
  public static async getPendingOrdersCount(): Promise<number> {
    const db = DatabaseService.getInstance().getDatabase();
    if (!db) return 0;

    try {
      const [result] = await db.executeSql(
        `SELECT COUNT(*) as count FROM orders WHERE synced = 0`
      );

      return result.rows.item(0)?.count || 0;
    } catch (error) {
      console.error('OrderService.getPendingOrdersCount error:', error);
      return 0;
    }
  }

  /**
   * Check if a shop has orders for today
   */
  public static async hasOrdersForToday(shopId: string): Promise<boolean> {
    const db = DatabaseService.getInstance().getDatabase();
    if (!db) return false;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      const [result] = await db.executeSql(
        `SELECT COUNT(*) as count FROM orders 
         WHERE shop_id = ? AND DATE(order_date) = DATE(?)`,
        [shopId, todayStr]
      );

      const count = result.rows.item(0)?.count || 0;
      return count > 0;
    } catch (error) {
      console.error('OrderService.hasOrdersForToday error:', error);
      return false;
    }
  }
}
