import apiClient from "../../lib/axios";
import { AuthStorageService } from "../auth/AuthStorageService";

export type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  newPrice: number;
};

export type CreateVisitPayload = {
  allocationId: string;
  visitDateTime: string; // ISO date string
  duration?: number;
  notes?: string;
  orders?: OrderItem[]; // Orders data for visit
};

export type VisitResponse = {
  _id: string;
  visitDateTime: string;
  duration?: number;
  notes?: string;
  orders?: OrderItem[];
  allocation?: {
    _id: string;
    shop?: {
      _id?: string;
      name: string;
      address?: string;
      location?: {
        latitude: number;
        longitude: number;
      };
    };
  };
};

export type GetMyVisitsResponse = {
  success: boolean;
  message: string;
  data: {
    visits: VisitResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
};

class VisitApiService {
  private authStorage = AuthStorageService.getInstance();

  private async getAuthHeader() {
    const h = await this.authStorage.getAuthHeader();
    return h || {};
  }

  /**
   * POST /visits - Create a new visit
   */
  async createVisit(payload: CreateVisitPayload) {
    const headers = await this.getAuthHeader();
    console.log("[visitApiService] createVisit payload:", payload);
    console.log("[visitApiService] createVisit headers:", headers);
    
    try {
      const res = await apiClient.post("/visits", payload, { headers });
      console.log("[visitApiService] createVisit status:", res.status);
      console.log("[visitApiService] createVisit FULL response:", JSON.stringify(res.data, null, 2));
      console.log("[visitApiService] createVisit data:", res.data);
      console.log("[visitApiService] createVisit data.data:", res.data?.data);
      console.log("[visitApiService] createVisit data.data.visit:", res.data?.data?.visit);
      console.log("[visitApiService] createVisit data.data.visit._id:", res.data?.data?.visit?._id);
      return res.data;
    } catch (err: any) {
      console.log(
        "[visitApiService] createVisit error:",
        err?.response?.status,
        err?.response?.data || err?.message
      );
      throw err;
    }
  }

  /**
   * GET /visits/my - Get my visits with pagination and date filtering
   */
  async getMyVisits(params: { 
    page?: number; 
    limit?: number;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<GetMyVisitsResponse> {
    const headers = await this.getAuthHeader();
    console.log("[visitApiService] getMyVisits params:", params);
    console.log("[visitApiService] getMyVisits headers:", headers);
    
    try {
      const res = await apiClient.get("/visits/my", { headers, params });
      console.log("[visitApiService] getMyVisits status:", res.status);
      console.log("[visitApiService] getMyVisits data:", res.data);
      console.log("[visitApiService] getMyVisits visits count:", res.data?.data?.visits?.length);
      return res.data;
    } catch (err: any) {
      console.log(
        "[visitApiService] getMyVisits error:",
        err?.response?.status,
        err?.response?.data || err?.message
      );
      throw err;
    }
  }

  /**
   * GET /visits/:id - Get visit by ID
   */
  async getVisitById(visitId: string) {
    const headers = await this.getAuthHeader();
    console.log("[visitApiService] getVisitById id:", visitId);
    console.log("[visitApiService] getVisitById headers:", headers);
    
    try {
      const res = await apiClient.get(`/visits/${visitId}`, { headers });
      console.log("[visitApiService] getVisitById status:", res.status);
      console.log("[visitApiService] getVisitById data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log(
        "[visitApiService] getVisitById error:",
        err?.response?.status,
        err?.response?.data || err?.message
      );
      throw err;
    }
  }

  /**
   * PUT /visits/:id - Update a visit
   */
  async updateVisit(visitId: string, payload: Partial<CreateVisitPayload>) {
    const headers = await this.getAuthHeader();
    console.log("[visitApiService] ========================================");
    console.log("[visitApiService] UPDATE VISIT REQUEST");
    console.log("[visitApiService] ========================================");
    console.log("[visitApiService] updateVisit id:", visitId);
    console.log("[visitApiService] updateVisit payload:", JSON.stringify(payload, null, 2));
    console.log("[visitApiService] updateVisit orders:", payload.orders);
    console.log("[visitApiService] updateVisit headers:", headers);
    
    try {
      const res = await apiClient.put(`/visits/${visitId}`, payload, { headers });
      console.log("[visitApiService] ========================================");
      console.log("[visitApiService] UPDATE VISIT RESPONSE");
      console.log("[visitApiService] ========================================");
      console.log("[visitApiService] updateVisit status:", res.status);
      console.log("[visitApiService] updateVisit FULL response:", JSON.stringify(res.data, null, 2));
      console.log("[visitApiService] updateVisit data:", res.data);
      console.log("[visitApiService] updateVisit data.visit:", res.data?.data?.visit);
      console.log("[visitApiService] updateVisit ORDERS:", res.data?.data?.visit?.orders);
      console.log("[visitApiService] updateVisit orders count:", res.data?.data?.visit?.orders?.length || 0);
      console.log("[visitApiService] ========================================");
      return res.data;
    } catch (err: any) {
      console.log("[visitApiService] ========================================");
      console.log("[visitApiService] UPDATE VISIT ERROR");
      console.log("[visitApiService] ========================================");
      console.log(
        "[visitApiService] updateVisit error:",
        err?.response?.status,
        err?.response?.data || err?.message
      );
      console.log("[visitApiService] ========================================");
      throw err;
    }
  }

  /**
   * DELETE /visits/:id - Delete a visit
   */
  async deleteVisit(visitId: string) {
    const headers = await this.getAuthHeader();
    console.log("[visitApiService] deleteVisit id:", visitId);
    console.log("[visitApiService] deleteVisit headers:", headers);
    
    try {
      const res = await apiClient.delete(`/visits/${visitId}`, { headers });
      console.log("[visitApiService] deleteVisit status:", res.status);
      console.log("[visitApiService] deleteVisit data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log(
        "[visitApiService] deleteVisit error:",
        err?.response?.status,
        err?.response?.data || err?.message
      );
      throw err;
    }
  }
}

export default new VisitApiService();
