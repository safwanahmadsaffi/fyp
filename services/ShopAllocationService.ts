import { DatabaseService } from './database/DatabaseService';
import { AuthStorageService } from './auth/AuthStorageService';
import {
  Allocation,
  Shop,
  User,
  ShopWithAllocation,
  AllocationFrequency,
  DayAssignment,
  VisitSchedule
} from '../types/database';

export class ShopAllocationService {
  private static instance: ShopAllocationService;
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): ShopAllocationService {
    if (!ShopAllocationService.instance) {
      ShopAllocationService.instance = new ShopAllocationService();
    }
    return ShopAllocationService.instance;
  }

  private async getCurrentUserId(): Promise<string> {
    const authService = AuthStorageService.getInstance();
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('No authenticated user');
    return user.id;
  }

  // Get all shops allocated to current user
  public async getAllocatedShops(): Promise<ShopWithAllocation[]> {
    try {
      const userId = await this.getCurrentUserId();
      const db = this.db.getDatabase();

      const query = `
        SELECT s.*, a.frequency, a.assigned_days, a.start_date, a.end_date,
               COUNT(v.id) as visit_count,
               MAX(v.visit_date) as last_visit,
               MIN(CASE WHEN v.visit_date >= date('now') AND v.status = 'planned' THEN v.visit_date END) as next_visit
        FROM shops s
        INNER JOIN allocations a ON s.id = a.shop_id
        LEFT JOIN visits v ON s.id = v.shop_id AND v.user_id = a.user_id
        WHERE a.user_id = ? AND a.status = 'active'
        GROUP BY s.id, a.frequency, a.assigned_days, a.start_date, a.end_date
        ORDER BY s.name
      `;

      const [results] = await db.executeSql(query, [userId]);

      const shops: ShopWithAllocation[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        const row = results.rows.item(i);
        shops.push(this.mapShopWithAllocation(row));
      }

      return shops;
    } catch (error) {
      console.error('Failed to get allocated shops:', error);
      throw error;
    }
  }

  // Get shops that need to be visited today
  public async getTodayVisits(): Promise<ShopWithAllocation[]> {
    try {
      const userId = await this.getCurrentUserId();
      const today = new Date().toISOString().split('T')[0];
      const dayOfWeek = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.

      const db = this.db.getDatabase();

      // Get daily shops
      const dailyQuery = `
        SELECT s.*, a.frequency, a.assigned_days, a.start_date, a.end_date,
               COUNT(v.id) as visit_count,
               MAX(v.visit_date) as last_visit
        FROM shops s
        INNER JOIN allocations a ON s.id = a.shop_id
        LEFT JOIN visits v ON s.id = v.shop_id AND v.user_id = a.user_id
        WHERE a.user_id = ? AND a.status = 'active' AND a.frequency = 'daily'
          AND a.start_date <= date('now')
          AND (a.end_date IS NULL OR a.end_date >= date('now'))
        GROUP BY s.id
      `;

      // Get weekly shops for today
      const weeklyQuery = `
        SELECT s.*, a.frequency, a.assigned_days, a.start_date, a.end_date,
               COUNT(v.id) as visit_count,
               MAX(v.visit_date) as last_visit
        FROM shops s
        INNER JOIN allocations a ON s.id = a.shop_id
        LEFT JOIN visits v ON s.id = v.shop_id AND v.user_id = a.user_id
        WHERE a.user_id = ? AND a.status = 'active' AND a.frequency = 'weekly'
          AND a.start_date <= date('now')
          AND (a.end_date IS NULL OR a.end_date >= date('now'))
          AND a.assigned_days LIKE ?
        GROUP BY s.id
      `;

      // Get monthly shops for today (1st, 15th, or last day of month)
      const dayOfMonth = new Date().getDate();
      const isFirstOrFifteenth = dayOfMonth === 1 || dayOfMonth === 15;

      const monthlyQuery = `
        SELECT s.*, a.frequency, a.assigned_days, a.start_date, a.end_date,
               COUNT(v.id) as visit_count,
               MAX(v.visit_date) as last_visit
        FROM shops s
        INNER JOIN allocations a ON s.id = a.shop_id
        LEFT JOIN visits v ON s.id = v.shop_id AND v.user_id = a.user_id
        WHERE a.user_id = ? AND a.status = 'active' AND a.frequency = 'monthly'
          AND a.start_date <= date('now')
          AND (a.end_date IS NULL OR a.end_date >= date('now'))
          AND (a.assigned_days LIKE ? OR a.assigned_days LIKE ?)
        GROUP BY s.id
      `;

      const [dailyResults, weeklyResults, monthlyResults] = await Promise.all([
        db.executeSql(dailyQuery, [userId]),
        db.executeSql(weeklyQuery, [userId, `%${this.getDayName(dayOfWeek)}%`]),
        db.executeSql(monthlyQuery, [userId, `%"${dayOfMonth}"%`, '%"last"%']),
      ]);

      const todayShops: ShopWithAllocation[] = [];

      // Process daily shops
      for (let i = 0; i < dailyResults[0].rows.length; i++) {
        todayShops.push(this.mapShopWithAllocation(dailyResults[0].rows.item(i)));
      }

      // Process weekly shops
      for (let i = 0; i < weeklyResults[0].rows.length; i++) {
        todayShops.push(this.mapShopWithAllocation(weeklyResults[0].rows.item(i)));
      }

      // Process monthly shops
      for (let i = 0; i < monthlyResults[0].rows.length; i++) {
        todayShops.push(this.mapShopWithAllocation(monthlyResults[0].rows.item(i)));
      }

      return todayShops;
    } catch (error) {
      console.error('Failed to get today visits:', error);
      throw error;
    }
  }

  // Get visit schedule for a specific date range
  public async getVisitSchedule(startDate: string, endDate: string): Promise<VisitSchedule[]> {
    try {
      const userId = await this.getCurrentUserId();

      // This would be a complex query to generate visit schedules based on allocations
      // For now, return a simplified version
      const schedule: VisitSchedule[] = [];

      for (let date = new Date(startDate); date <= new Date(endDate); date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0];
        const shopsForDate = await this.getShopsForDate(dateStr);

        schedule.push({
          date: dateStr,
          shops: shopsForDate,
          total_shops: shopsForDate.length,
          completed_visits: 0, // Would need to query actual visits
        });
      }

      return schedule;
    } catch (error) {
      console.error('Failed to get visit schedule:', error);
      throw error;
    }
  }

  // Get shops for a specific date based on allocation frequency
  private async getShopsForDate(date: string): Promise<ShopWithAllocation[]> {
    const userId = await this.getCurrentUserId();
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();
    const dayOfMonth = targetDate.getDate();

    const db = this.db.getDatabase();

    // Build complex query for shops based on frequency and date
    const query = `
      SELECT DISTINCT s.*, a.frequency, a.assigned_days, a.start_date, a.end_date
      FROM shops s
      INNER JOIN allocations a ON s.id = a.shop_id
      WHERE a.user_id = ? AND a.status = 'active'
        AND a.start_date <= ?
        AND (a.end_date IS NULL OR a.end_date >= ?)
        AND (
          (a.frequency = 'daily') OR
          (a.frequency = 'weekly' AND a.assigned_days LIKE ?) OR
          (a.frequency = 'monthly' AND (
            a.assigned_days LIKE ? OR
            (a.assigned_days LIKE '%last%' AND ? = (SELECT MAX(day) FROM (
              SELECT day FROM (
                SELECT substr('00' || day, -2, 2) as day
                FROM (SELECT date(?, 'start of month', '+1 month', '-1 day') as last_day)
              )
            )))
          ))
        )
    `;

    const [results] = await db.executeSql(query, [
      userId, date, date, `%${this.getDayName(dayOfWeek)}%`,
      `%"${dayOfMonth}"%`, date,
    ]);

    const shops: ShopWithAllocation[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      shops.push(this.mapShopWithAllocation(results.rows.item(i)));
    }

    return shops;
  }

  // Create a new shop allocation
  public async createAllocation(allocation: Omit<Allocation, 'id' | 'created_at' | 'updated_at'>): Promise<Allocation> {
    try {
      const db = this.db.getDatabase();
      const allocationId = `allocation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await db.executeSql(
        `INSERT INTO allocations
         (id, user_id, shop_id, frequency, assigned_days, start_date, end_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          allocationId,
          allocation.user_id,
          allocation.shop_id,
          allocation.frequency,
          allocation.assigned_days,
          allocation.start_date,
          allocation.end_date,
          allocation.status,
        ]
      );

      console.log('Allocation created successfully');
      return {
        id: allocationId,
        ...allocation,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to create allocation:', error);
      throw error;
    }
  }

  // Update an existing allocation
  public async updateAllocation(allocationId: string, updates: Partial<Allocation>): Promise<void> {
    try {
      const db = this.db.getDatabase();

      const updateFields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);

      await db.executeSql(
        `UPDATE allocations SET ${updateFields}, updated_at = ? WHERE id = ?`,
        [...values, new Date().toISOString(), allocationId]
      );

      console.log('Allocation updated successfully');
    } catch (error) {
      console.error('Failed to update allocation:', error);
      throw error;
    }
  }

  // Delete an allocation
  public async deleteAllocation(allocationId: string): Promise<void> {
    try {
      const db = this.db.getDatabase();

      await db.executeSql('DELETE FROM allocations WHERE id = ?', [allocationId]);

      console.log('Allocation deleted successfully');
    } catch (error) {
      console.error('Failed to delete allocation:', error);
      throw error;
    }
  }

  // Get allocation statistics for current user
  public async getAllocationStats(): Promise<{
    total_allocations: number;
    daily_shops: number;
    weekly_shops: number;
    monthly_shops: number;
    single_visits: number;
  }> {
    try {
      const userId = await this.getCurrentUserId();
      const db = this.db.getDatabase();

      const query = `
        SELECT frequency, COUNT(*) as count
        FROM allocations
        WHERE user_id = ? AND status = 'active'
        GROUP BY frequency
      `;

      const [results] = await db.executeSql(query, [userId]);

      const stats = {
        total_allocations: 0,
        daily_shops: 0,
        weekly_shops: 0,
        monthly_shops: 0,
        single_visits: 0,
      };

      for (let i = 0; i < results.rows.length; i++) {
        const row = results.rows.item(i);
        stats.total_allocations += row.count;

        switch (row.frequency) {
          case 'daily':
            stats.daily_shops = row.count;
            break;
          case 'weekly':
            stats.weekly_shops = row.count;
            break;
          case 'monthly':
            stats.monthly_shops = row.count;
            break;
          case 'single':
            stats.single_visits = row.count;
            break;
        }
      }

      return stats;
    } catch (error) {
      console.error('Failed to get allocation stats:', error);
      throw error;
    }
  }

  // Helper method to get day name from day number
  private getDayName(dayNumber: number): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[dayNumber];
  }

  // Helper method to map database row to ShopWithAllocation
  private mapShopWithAllocation(row: any): ShopWithAllocation {
    return {
      id: row.id,
      name: row.name,
      address: row.address,
      owner_name: row.owner_name,
      owner_phone: row.owner_phone,
      latitude: row.latitude,
      longitude: row.longitude,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      allocation: {
        id: row.allocation_id || '',
        user_id: row.user_id || '',
        shop_id: row.id,
        frequency: row.frequency,
        assigned_days: row.assigned_days,
        start_date: row.start_date,
        end_date: row.end_date,
        status: row.allocation_status || 'active',
        created_at: row.allocation_created_at || new Date().toISOString(),
        updated_at: row.allocation_updated_at || new Date().toISOString(),
      },
      visit_count: row.visit_count || 0,
      last_visit: row.last_visit,
      next_visit: row.next_visit,
    };
  }

  // Mark a shop visit as completed
  public async completeShopVisit(shopId: string, notes?: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      const db = this.db.getDatabase();

      // Insert or update visit record
      const visitId = `visit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await db.executeSql(
        `INSERT INTO visits (id, user_id, shop_id, visit_date, status, notes)
         VALUES (?, ?, ?, date('now'), 'completed', ?)`,
        [visitId, userId, shopId, notes || '']
      );

      console.log('Shop visit completed');
    } catch (error) {
      console.error('Failed to complete shop visit:', error);
      throw error;
    }
  }

  // Get pending visits for today
  public async getPendingVisits(): Promise<ShopWithAllocation[]> {
    try {
      const todayVisits = await this.getTodayVisits();

      // Filter out already visited shops today
      const userId = await this.getCurrentUserId();
      const db = this.db.getDatabase();

      const visitedShopIdsQuery = `
        SELECT DISTINCT shop_id
        FROM visits
        WHERE user_id = ? AND visit_date = date('now') AND status = 'completed'
      `;

      const [visitedResults] = await db.executeSql(visitedShopIdsQuery, [userId]);
      const visitedShopIds = new Set();

      for (let i = 0; i < visitedResults.rows.length; i++) {
        visitedShopIds.add(visitedResults.rows.item(i).shop_id);
      }

      return todayVisits.filter(shop => !visitedShopIds.has(shop.id));
    } catch (error) {
      console.error('Failed to get pending visits:', error);
      throw error;
    }
  }
}
