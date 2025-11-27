import { DatabaseService } from '../database/DatabaseService';
import { ShopAllocationService } from '../ShopAllocationService';
import { VisitService } from '../visits/VisitService';
import { Shop } from '../../types/shop';
import { ShopWithAllocation } from '../../types/database';

export class ProximityTracker {
  private static readonly PROXIMITY_THRESHOLD = 100; // meters - increased for better detection

  public static async checkShopProximity(
    latitude: number,
    longitude: number,
    userId: string
  ): Promise<void> {
    try {
      // Get allocated shops that haven't been visited today
      const allocationService = ShopAllocationService.getInstance();
      const pendingShops = await allocationService.getPendingVisits();

      for (const shop of pendingShops) {
        // Check if shop has location and a valid allocation
        if (shop.latitude && shop.longitude && shop.allocation?.id) {
          const distance = this.calculateDistance(
            latitude,
            longitude,
            shop.latitude,
            shop.longitude
          );

          if (distance <= this.PROXIMITY_THRESHOLD) {
            // Create an automatic visit
            const visitId = await VisitService.createPlanned({
              userId,
              shopId: shop.id,
              allocationId: shop.allocation.id,
              date: new Date(),
              notes: 'Automatically marked as visited based on proximity',
            });

            await VisitService.completeVisit({
              visitId,
              notes: `Automatically completed - Distance from shop: ${Math.round(distance)}m`,
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to check shop proximity:', error);
    }
  }

  // Haversine formula to calculate distance between two points
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // distance in meters
  }
}