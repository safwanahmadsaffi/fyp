import { DatabaseService } from '../database/DatabaseService';

export interface ShopAllocationView {
  id: string; // allocation id
  shop_id: string;
  shop_name: string;
  address: string;
  frequency: 'single' | 'daily' | 'weekly' | 'monthly';
  assigned_days?: string; // JSON
  start_date: string;
  end_date?: string;
}

export class AllocationService {
  public static async getUserAllocations(userId: string): Promise<ShopAllocationView[]> {
    const db = DatabaseService.getInstance().getDatabase();
    const [res] = await db.executeSql(
      `SELECT a.id, a.shop_id, s.name AS shop_name, s.address, a.frequency, a.assigned_days, a.start_date, a.end_date
       FROM allocations a
       JOIN shops s ON s.id = a.shop_id
       WHERE a.user_id = ? AND a.status = 'active'`,
      [userId],
    );
    const rows: ShopAllocationView[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      rows.push(res.rows.item(i));
    }
    return rows;
  }

  public static getAssignedDaysLabel(assignedDays?: string): string {
    if (!assignedDays) return '';
    try {
      const parsed = JSON.parse(assignedDays) as Record<string, boolean>;
      const order = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
      const labels = order.filter(k => parsed[k]).map(k => k.slice(0,3).toUpperCase());
      return labels.join(', ');
    } catch {
      return '';
    }
  }

  public static groupByFrequency(items: ShopAllocationView[]): Record<string, ShopAllocationView[]> {
    return items.reduce((acc, it) => {
      (acc[it.frequency] = acc[it.frequency] || []).push(it);
      return acc;
    }, {} as Record<string, ShopAllocationView[]>);
  }
}


