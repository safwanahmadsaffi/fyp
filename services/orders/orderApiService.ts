import axios from 'axios';
import { AuthStorageService } from '../auth/AuthStorageService';

const PRODUCT_API_BASE = 'https://app.aeenium.com/soft/alfalah_trader';

export interface Product {
  _id: string;
  name: string;
  price?: number; // Current price
  newPrice?: number; // New price
  currentPrice?: number; // Alternative field name for current price
  description?: string;
  category?: string;
  stock?: number;
  image?: string;
}

export interface ProductListResponse {
  success: boolean;
  message: string;
  data: {
    products: Product[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price?: number;
}

export interface CreateOrderPayload {
  shopId: string;
  shopName: string;
  items: OrderItem[];
  totalAmount?: number;
  notes?: string;
  orderDate?: string;
}

export interface OrderResponse {
  success: boolean;
  message: string;
  data: {
    order: {
      _id: string;
      shopId: string;
      shopName: string;
      items: OrderItem[];
      totalAmount: number;
      status: string;
      createdAt: string;
    };
  };
}

class OrderApiService {
  private authStorage = AuthStorageService.getInstance();

  private async getAuthHeader() {
    const h = await this.authStorage.getAuthHeader();
    return h || {};
  }

  /**
   * GET /items/list - Fetch products with pagination and search
   */
  async getProducts(params: { page?: number; limit?: number; search?: string } = {}): Promise<ProductListResponse> {
    const { page = 1, limit = 10, search = '' } = params;
    
    try {
      console.log('[OrderApiService] Fetching products:', { page, limit, search });
      console.log('[OrderApiService] API URL:', `${PRODUCT_API_BASE}/items/list`);
      
      const queryParams: any = { page, limit };
      if (search) {
        queryParams.search = search;
      }
      
      const response = await axios.get(`${PRODUCT_API_BASE}/items/list`, {
        params: queryParams,
        timeout: 15000,
      });

      console.log('[OrderApiService] Full API Response:', response);
      console.log('[OrderApiService] Response structure:', {
        hasData: !!response.data,
        hasItems: !!response.data?.items,
        hasDataProperty: !!response.data?.data,
        hasProducts: !!response.data?.data?.products,
        itemsLength: response.data?.items?.length || 0,
        topLevelKeys: Object.keys(response.data || {}),
      });

      // Handle different response structures
      let products: Product[] = [];
      let pagination = { page: 1, limit: 50, total: 0, pages: 0 };

      // Check if response has "items" array (Alfalah Trader API format)
      if (response.data?.items && Array.isArray(response.data.items)) {
        console.log('[OrderApiService] Found items array, mapping to Product format...');
        products = response.data.items.map((item: any) => ({
          _id: String(item.item_id || item.id || Math.random()),
          name: item.full_item_name || item.name || 'Unknown Product',
          price: item.item_rate || item.price || 0,
          currentPrice: item.item_rate || item.price || 0,
          newPrice: item.new_rate || item.item_rate || item.price || 0,
          description: item.description || '',
          category: item.category || '',
          stock: item.stock || 0,
        }));
        
        // Calculate pagination from items length
        const totalItems = response.data.items.length;
        pagination = {
          page: page,
          limit: limit,
          total: totalItems,
          pages: Math.ceil(totalItems / limit),
        };
      }
      // Check if response has nested data.products
      else if (response.data?.data?.products) {
        products = response.data.data.products;
        pagination = response.data.data.pagination || pagination;
      }
      // Check if products are at top level
      else if (response.data?.products) {
        products = response.data.products;
        pagination = response.data.pagination || pagination;
      }
      // Check if response.data is an array
      else if (Array.isArray(response.data)) {
        products = response.data;
      }
      // Check if response.data.data is an array
      else if (Array.isArray(response.data?.data)) {
        products = response.data.data;
      }

      console.log('[OrderApiService] Parsed products count:', products.length);
      console.log('[OrderApiService] First product:', products[0]);
      console.log('[OrderApiService] Sample products:', products.slice(0, 3));

      // Success message
      if (products.length > 0) {
        console.log('✅ [OrderApiService] SUCCESS: Products fetched successfully!');
        console.log(`✅ [OrderApiService] Total products loaded: ${products.length}`);
      } else {
        console.warn('⚠️ [OrderApiService] WARNING: No products found in response');
      }

      return {
        success: true,
        message: 'Products fetched',
        data: {
          products,
          pagination,
        },
      };
    } catch (error: any) {
      console.error('❌ [OrderApiService] FAILED: Could not fetch products');
      console.error('❌ [OrderApiService] Error:', error?.response?.data || error?.message);
      console.error('❌ [OrderApiService] Error details:', {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        url: error?.config?.url,
        message: error?.message,
      });
      throw error;
    }
  }

  /**
   * POST /orders - Create a new order
   */
  async createOrder(payload: CreateOrderPayload): Promise<OrderResponse> {
    const headers = await this.getAuthHeader();
    
    try {
      console.log('📤 [OrderApiService] ========================================');
      console.log('📤 [OrderApiService] CREATING ORDER...');
      console.log('📤 [OrderApiService] ========================================');
      console.log('[OrderApiService] Order payload:', JSON.stringify(payload, null, 2));
      console.log('[OrderApiService] API URL:', `${PRODUCT_API_BASE}/orders`);
      console.log('[OrderApiService] Headers:', headers);
      
      // Using your backend API
      const response = await axios.post(
        `${PRODUCT_API_BASE}/orders`,
        payload,
        { headers, timeout: 10000 }
      );

      console.log('✅ [OrderApiService] ========================================');
      console.log('✅ [OrderApiService] ORDER CREATED SUCCESSFULLY!');
      console.log('✅ [OrderApiService] ========================================');
      console.log('✅ [OrderApiService] Response status:', response.status);
      console.log('✅ [OrderApiService] Response data:', JSON.stringify(response.data, null, 2));
      console.log('✅ [OrderApiService] Order ID:', response.data?.data?.order?._id || 'N/A');
      console.log('✅ [OrderApiService] Total Amount:', response.data?.data?.order?.totalAmount || 'N/A');
      console.log('✅ [OrderApiService] Items Count:', response.data?.data?.order?.items?.length || 0);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ [OrderApiService] ========================================');
      console.error('❌ [OrderApiService] ORDER CREATION FAILED!');
      console.error('❌ [OrderApiService] ========================================');
      console.error('❌ [OrderApiService] Error message:', error?.message);
      console.error('❌ [OrderApiService] Error response:', JSON.stringify(error?.response?.data, null, 2));
      console.error('❌ [OrderApiService] Error details:', {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        url: error?.config?.url,
        data: error?.response?.data,
      });
      throw error;
    }
  }

  /**
   * GET /orders/my - Get my orders
   */
  async getMyOrders(params: { page?: number; limit?: number } = {}) {
    const headers = await this.getAuthHeader();
    const { page = 1, limit = 10 } = params;
    
    try {
      console.log('[OrderApiService] Fetching my orders:', { page, limit });
      
      const response = await axios.get(`${PRODUCT_API_BASE}/orders/my`, {
        headers,
        params: { page, limit },
        timeout: 10000,
      });

      console.log('[OrderApiService] Orders fetched:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[OrderApiService] getMyOrders error:', error?.response?.data || error?.message);
      throw error;
    }
  }

  /**
   * Check if a shop has orders by checking visit data
   * Returns true if the shop has any orders placed
   */
  async hasShopOrders(shopId: string): Promise<boolean> {
    try {
      console.log('[OrderApiService] Checking if shop has orders:', shopId);
      
      // This would need to be implemented based on your API
      // For now, return false as a placeholder
      // You might need to call getMyOrders and filter by shopId
      return false;
    } catch (error: any) {
      console.error('[OrderApiService] hasShopOrders error:', error?.message);
      return false;
    }
  }
}

export default new OrderApiService();
