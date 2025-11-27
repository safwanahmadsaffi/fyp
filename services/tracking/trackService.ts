import apiClient from "../../lib/axios";
import { AuthStorageService } from "../auth/AuthStorageService";

export type PagingQuery = {
  page?: number;
  limit?: number;
};

export type RouteQuery = {
  userId: string;
  date: string; // ISO date string, e.g. 2024-01-15
};

export type CreateTrackingPayload = {
  location: {
    longitude: number;
    latitude: number;
  };
};

export type UpdateTrackingPayload = Partial<CreateTrackingPayload>;

class trackService {
  private authStorage = AuthStorageService.getInstance();

  private async getAuthHeader() {
    const h = await this.authStorage.getAuthHeader();
    return h || {};
  }

  // GET /trackings/my
  async getMyTrackings(params?: { startDate?: string; endDate?: string }) {
    const headers = await this.getAuthHeader();
    console.log("[trackService] getMyTrackings params:", params);
    console.log("[trackService] getMyTrackings headers:", headers);
    try {
      const res = await apiClient.get("/trackings/my", { headers, params });
      console.log("[trackService] getMyTrackings status:", res.status);
      console.log("[trackService] getMyTrackings data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log("[trackService] getMyTrackings error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }

  // GET /trackings (Admin)
  async getAllTrackings(params: PagingQuery = {}) {
    const headers = await this.getAuthHeader();
    console.log("[trackService] getAllTrackings params:", params);
    console.log("[trackService] getAllTrackings headers:", headers);
    try {
      const res = await apiClient.get("/trackings", { headers, params });
      console.log("[trackService] getAllTrackings status:", res.status);
      console.log("[trackService] getAllTrackings data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log("[trackService] getAllTrackings error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }

  // GET /trackings/:id
  async getTrackingById(trackingId: string) {
    const headers = await this.getAuthHeader();
    console.log("[trackService] getTrackingById id:", trackingId);
    console.log("[trackService] getTrackingById headers:", headers);
    try {
      const res = await apiClient.get(`/trackings/${trackingId}`, { headers });
      console.log("[trackService] getTrackingById status:", res.status);
      console.log("[trackService] getTrackingById data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log("[trackService] getTrackingById error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }

  // GET /trackings/route?userId=...&date=...
  async getTrackingRoute(params: RouteQuery) {
    const headers = await this.getAuthHeader();
    console.log("[trackService] getTrackingRoute params:", params);
    console.log("[trackService] getTrackingRoute headers:", headers);
    try {
      const res = await apiClient.get("/trackings/route", { headers, params });
      console.log("[trackService] getTrackingRoute status:", res.status);
      console.log("[trackService] getTrackingRoute data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log("[trackService] getTrackingRoute error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }

  // POST /trackings
  async createTracking(payload: CreateTrackingPayload) {
    const headers = await this.getAuthHeader();
    console.log("[trackService] createTracking payload:", payload);
    console.log("[trackService] createTracking headers:", headers);
    try {
      const res = await apiClient.post("/trackings", payload, { headers });
      console.log("[trackService] createTracking status:", res.status);
      console.log("[trackService] createTracking data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log("[trackService] createTracking error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }

  // PUT /trackings/:id
  async updateTracking(trackingId: string, payload: UpdateTrackingPayload) {
    const headers = await this.getAuthHeader();
    console.log("[trackService] updateTracking id:", trackingId);
    console.log("[trackService] updateTracking payload:", payload);
    console.log("[trackService] updateTracking headers:", headers);
    try {
      const res = await apiClient.put(`/trackings/${trackingId}`, payload, { headers });
      console.log("[trackService] updateTracking status:", res.status);
      console.log("[trackService] updateTracking data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log("[trackService] updateTracking error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }

  // DELETE /trackings/:id (Admin)
  async deleteTracking(trackingId: string) {
    const headers = await this.getAuthHeader();
    console.log("[trackService] deleteTracking id:", trackingId);
    console.log("[trackService] deleteTracking headers:", headers);
    try {
      const res = await apiClient.delete(`/trackings/${trackingId}`, { headers });
      console.log("[trackService] deleteTracking status:", res.status);
      console.log("[trackService] deleteTracking data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log("[trackService] deleteTracking error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }
}

export default new trackService();
