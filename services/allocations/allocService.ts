import apiClient from "../../lib/axios";
import { AuthStorageService } from "../auth/AuthStorageService";

// Types
export type RecordVisitPayload = {
  visitDateTime: string; // ISO
  duration?: number; // minutes
  notes?: string;
};

export type GetAllocationsParams = {
  page?: number;
  limit?: number;
  allocationDate?: string; // YYYY-MM-DD format
  isActive?: boolean;
};

class allocService {
  private authStorage = AuthStorageService.getInstance();

  private async getAuthHeader() {
    const h = await this.authStorage.getAuthHeader();
    return h || {};
  }

  // GET /allocations/my
  async getMyAllocations(params?: GetAllocationsParams) {
    const headers = await this.getAuthHeader();
    console.log("[allocService] getMyAllocations headers:", headers);
    console.log("[allocService] getMyAllocations params:", params);
    try {
      const res = await apiClient.get("/allocations/my", { 
        headers,
        params: params || {}
      });
      console.log("[allocService] getMyAllocations status:", res.status);
      console.log("[allocService] getMyAllocations data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log("[allocService] getMyAllocations error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }

  // POST /allocations/:id/visit
  async recordVisit(allocationId: string, payload: RecordVisitPayload) {
    const headers = await this.getAuthHeader();
    console.log("[allocService] recordVisit id:", allocationId);
    console.log("[allocService] recordVisit payload:", payload);
    console.log("[allocService] recordVisit headers:", headers);
    try {
      const res = await apiClient.post(`/allocations/${allocationId}/visit`, payload, { headers });
      console.log("[allocService] recordVisit status:", res.status);
      console.log("[allocService] recordVisit data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log("[allocService] recordVisit error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }
}

export default new allocService();
