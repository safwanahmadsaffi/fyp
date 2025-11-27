import apiClient from "../../lib/axios";
import { AuthStorageService } from "../auth/AuthStorageService";
import { CheckinStorageService, CheckInRecord } from "./CheckinStorageService";
import { NetworkUtils } from "../utils/NetworkUtils";

type CreateCheckInPayload = {
  checkInNotes?: string;
  checkInTime?: string;
};

type UpdateCheckInPayload = {
  checkInNotes?: string;
};

class attendService {
  private authStorage = AuthStorageService.getInstance();
  private checkinStorage = CheckinStorageService.getInstance();

  private async getAuthHeader() {
    const h = await this.authStorage.getAuthHeader();
    return h || {};
  }

  /**
   * Get all check-ins with offline-first approach
   * 1. Try to fetch from server and sync to local DB
   * 2. If offline or no server data, return from local DB
   * 3. Always keep local DB in sync
   * 4. Never throw errors - always return data or empty array
   * @param startDate - Optional start date filter
   * @param endDate - Optional end date filter
   */
  async getMyCheckIns(startDate?: Date | null, endDate?: Date | null) {
    try {
      const headers = await this.getAuthHeader();
      console.log("[attendService] getMyCheckIns - checking connection...");
      
      const isOnline = await NetworkUtils.checkConnection();
      
      if (isOnline) {
        try {
          console.log("[attendService] 🟢 Online - fetching from server");
          
          // Build query parameters
          let url = "/checkins/my";
          const params: string[] = [];
          
          if (startDate) {
            params.push(`startDate=${startDate.toISOString()}`);
          }
          if (endDate) {
            params.push(`endDate=${endDate.toISOString()}`);
          }
          
          if (params.length > 0) {
            url += `?${params.join('&')}`;
          }
          
          console.log("[attendService] Fetching with URL:", url);
          const res = await apiClient.get(url, { headers });
          console.log("[attendService] getMyCheckIns status:", res.status);
          console.log("[attendService] getMyCheckIns response:", JSON.stringify(res.data).substring(0, 200));
          
          // Extract check-ins from response - API returns { success, data: { checkIns: [...] } }
          const serverCheckIns = res.data?.data?.checkIns || res.data?.checkIns || res.data?.checkins || [];
          console.log("[attendService] 📥 Received", Array.isArray(serverCheckIns) ? serverCheckIns.length : 0, "check-ins from server");
          
          // Always sync to local database (even if empty array)
          if (Array.isArray(serverCheckIns)) {
            if (serverCheckIns.length > 0) {
              await this.checkinStorage.syncFromServer(serverCheckIns);
              console.log("[attendService] ✅ Synced", serverCheckIns.length, "check-ins to local DB");
            } else {
              console.log("[attendService] ℹ️ No check-ins from server, keeping local data");
            }
          }
          
          // If server has data, return it; otherwise return from local DB
          if (Array.isArray(serverCheckIns) && serverCheckIns.length > 0) {
            return res.data;
          } else {
            console.log("[attendService] 📱 Server has no data, returning from local DB");
            const localCheckIns = await this.checkinStorage.getAllCheckIns();
            return {
              success: true,
              data: {
                checkIns: localCheckIns,
              },
              source: localCheckIns.length > 0 ? 'local' : 'server',
            };
          }
        } catch (err: any) {
          console.log("[attendService] ⚠️ Server fetch failed, falling back to local DB:", err?.message);
          // Fall through to local DB
        }
      }
      
      // Offline or server failed - return from local DB
      console.log("[attendService] 🔴 Using local database");
      const localCheckIns = await this.checkinStorage.getAllCheckIns();
      return {
        success: true,
        data: {
          checkIns: localCheckIns,
        },
        source: 'local',
      };
    } catch (error: any) {
      // Catch-all error handler - ensure we never throw
      console.error("[attendService] ❌ Critical error in getMyCheckIns:", error);
      try {
        // Last resort - try to get from local DB
        const localCheckIns = await this.checkinStorage.getAllCheckIns();
        return {
          success: true,
          data: {
            checkIns: localCheckIns,
          },
          source: 'local',
        };
      } catch (dbError) {
        console.error("[attendService] ❌ Failed to access local DB:", dbError);
        // Return empty array as absolute last resort
        return {
          success: false,
          data: {
            checkIns: [],
          },
          source: 'error',
          error: error.message,
        };
      }
    }
  }

  /**
   * Get active check-in with offline-first approach
   * Returns from local DB if server has no active check-in
   */
  async getActiveCheckIn() {
    const headers = await this.getAuthHeader();
    console.log("[attendService] getActiveCheckIn - checking connection...");
    
    const isOnline = await NetworkUtils.checkConnection();
    
    if (isOnline) {
      try {
        console.log("[attendService] 🟢 Online - fetching active check-in from server");
        const res = await apiClient.get("/checkins/active", { headers });
        console.log("[attendService] getActiveCheckIn status:", res.status);
        
        // Sync active check-in to local DB
        const activeCheckIn = res.data?.checkIn || res.data;
        if (activeCheckIn && activeCheckIn._id) {
          await this.checkinStorage.saveCheckIn(activeCheckIn);
          console.log("[attendService] ✅ Synced active check-in to local DB");
          return res.data;
        } else {
          // No active check-in on server, check local DB
          console.log("[attendService] 📱 No active check-in on server, checking local DB");
          const localActiveCheckIn = await this.checkinStorage.getActiveCheckIn();
          return {
            success: true,
            checkIn: localActiveCheckIn,
            source: localActiveCheckIn ? 'local' : 'server',
          };
        }
      } catch (err: any) {
        console.log("[attendService] ⚠️ Server fetch failed, falling back to local DB:", err?.message);
        // Fall through to local DB
      }
    }
    
    // Offline or server failed - return from local DB
    console.log("[attendService] 🔴 Using local database for active check-in");
    const localActiveCheckIn = await this.checkinStorage.getActiveCheckIn();
    return {
      success: true,
      checkIn: localActiveCheckIn,
      source: 'local',
    };
  }

  async createCheckIn(payload: CreateCheckInPayload) {
    const headers = await this.getAuthHeader();
    console.log("[attendService] createCheckIn payload:", payload);
    console.log("[attendService] createCheckIn headers:", headers);
    try {
      const res = await apiClient.post("/checkins", payload, { headers });
      console.log("[attendService] createCheckIn status:", res.status);
      console.log("[attendService] createCheckIn data:", res.data);
      
      // Save to local DB after successful API call
      const createdCheckIn = res.data?.checkIn || res.data?.data?.checkIn || res.data;
      if (createdCheckIn && createdCheckIn._id) {
        await this.checkinStorage.saveCheckIn(createdCheckIn);
        console.log("[attendService] ✅ Saved check-in to local DB");
      }
      
      return res.data;
    } catch (err: any) {
      console.log("[attendService] createCheckIn error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }

  async getAllCheckIns(params: { page?: number; limit?: number } = {}) {
    const headers = await this.getAuthHeader();
    console.log("[attendService] getAllCheckIns params:", params);
    console.log("[attendService] getAllCheckIns headers:", headers);
    try {
      const res = await apiClient.get("/checkins", { headers, params });
      console.log("[attendService] getAllCheckIns status:", res.status);
      console.log("[attendService] getAllCheckIns data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log("[attendService] getAllCheckIns error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }

  async getCheckInById(checkinId: string) {
    const headers = await this.getAuthHeader();
    console.log("[attendService] getCheckInById id:", checkinId);
    console.log("[attendService] getCheckInById headers:", headers);
    try {
      const res = await apiClient.get(`/checkins/${checkinId}`, { headers });
      console.log("[attendService] getCheckInById status:", res.status);
      console.log("[attendService] getCheckInById data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log("[attendService] getCheckInById error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }

  async updateCheckIn(checkinId: string, payload: UpdateCheckInPayload) {
    const headers = await this.getAuthHeader();
    console.log("[attendService] updateCheckIn id:", checkinId);
    console.log("[attendService] updateCheckIn payload:", payload);
    console.log("[attendService] updateCheckIn headers:", headers);
    try {
      const res = await apiClient.put(`/checkins/${checkinId}`, payload, { headers });
      console.log("[attendService] updateCheckIn status:", res.status);
      console.log("[attendService] updateCheckIn data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log("[attendService] updateCheckIn error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }

  async checkOut(checkinId: string, payload?: { checkOutTime?: string; durationMs?: number }) {
    const headers = await this.getAuthHeader();
    console.log("[attendService] checkOut id:", checkinId);
    if (payload) console.log("[attendService] checkOut payload:", payload);
    console.log("[attendService] checkOut headers:", headers);
    try {
      const res = await apiClient.put(`/checkins/${checkinId}/checkout`, payload || {}, { headers });
      console.log("[attendService] checkOut status:", res.status);
      console.log("[attendService] checkOut data:", res.data);
      
      // Update local DB after successful checkout
      if (payload?.checkOutTime) {
        await this.checkinStorage.updateCheckOut(checkinId, payload.checkOutTime);
        console.log("[attendService] ✅ Updated check-out in local DB");
      }
      
      return res.data;
    } catch (err: any) {
      console.log("[attendService] checkOut error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }

  async deleteCheckIn(checkinId: string) {
    const headers = await this.getAuthHeader();
    console.log("[attendService] deleteCheckIn id:", checkinId);
    console.log("[attendService] deleteCheckIn headers:", headers);
    try {
      const res = await apiClient.delete(`/checkins/${checkinId}`, { headers });
      console.log("[attendService] deleteCheckIn status:", res.status);
      console.log("[attendService] deleteCheckIn data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log("[attendService] deleteCheckIn error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }
}

export default new attendService();
