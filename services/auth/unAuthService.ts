import apiClient from "../../lib/axios";
import { AuthStorageService, AuthResponse } from "./AuthStorageService";

type RegisterPayload = {
  name: string;
  username: string;
  email: string;
  password: string;
  role?: string;
  phone?: string;
  address?: string;
};

type UsernameLoginPayload = {
  username: string;
  password: string;
};

type EmailLoginPayload = {
  email: string;
  password: string;
};

type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

class unAuthService {
  private authStorage = AuthStorageService.getInstance();

  private toSeconds(value: any): number {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return 7 * 24 * 60 * 60;
    const m = value.trim().match(/^(\d+)([smhd])$/i);
    if (!m) return 7 * 24 * 60 * 60;
    const num = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    switch (unit) {
      case "s":
        return num;
      case "m":
        return num * 60;
      case "h":
        return num * 60 * 60;
      case "d":
      default:
        return num * 24 * 60 * 60;
    }
  }

  private async storeAuthFromResponse(resData: any): Promise<void> {
    console.log("[unAuthService] storeAuthFromResponse raw:", JSON.stringify(resData));
    const data = resData?.data || resData;
    const token = data?.token || resData?.token;
    const user = data?.user || resData?.user;
    const expiresInRaw = data?.expiresIn || resData?.expiresIn || 7 * 24 * 60 * 60;

    const auth: AuthResponse = {
      user: {
        id: user?._id || user?.id,
        name: user?.name,
        email: user?.email,
        role: user?.role,
      },
      access_token: token,
      expires_in: this.toSeconds(expiresInRaw),
    };

    console.log("[unAuthService] parsed auth to store:", auth);
    await this.authStorage.storeAuthData(auth);
    console.log("[unAuthService] auth stored successfully");
    // Read back from SQLite/AsyncStorage and log for verification
    const tokenReadBack = await this.authStorage.getAuthToken();
    const userReadBack = await this.authStorage.getCurrentUser();
    console.log("[unAuthService] read-back token from SQLite:", tokenReadBack);
    console.log("[unAuthService] read-back user from storage:", userReadBack);
  }

  async register(payload: RegisterPayload) {
    console.log("[unAuthService] register payload:", payload);
    try {
      const res = await apiClient.post("/auth/register", payload);
      console.log("[unAuthService] register response status:", res.status);
      console.log("[unAuthService] register response data:", res.data);
      if (res?.data) {
        const hasToken = res.data?.data?.token || res.data?.token;
        if (hasToken) {
          await this.storeAuthFromResponse(res.data);
        }
      }
      return res.data;
    } catch (err: any) {
      console.log("[unAuthService] register error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }

  async login(payload: UsernameLoginPayload) {
    console.log("[unAuthService] login (username) payload:", payload);
    try {
      const res = await apiClient.post("/auth/login", payload);
      console.log("[unAuthService] login response status:", res.status);
      console.log("[unAuthService] login response data:", res.data);
      await this.storeAuthFromResponse(res.data);
      return res.data;
    } catch (err: any) {
      console.log("[unAuthService] login error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }

  async loginWithEmail(payload: EmailLoginPayload) {
    console.log("[unAuthService] loginWithEmail payload:", payload);
    try {
      const res = await apiClient.post("/auth/login", payload);
      console.log("[unAuthService] loginWithEmail response status:", res.status);
      console.log("[unAuthService] loginWithEmail response data:", res.data);
      await this.storeAuthFromResponse(res.data);
      return res.data;
    } catch (err: any) {
      console.log("[unAuthService] loginWithEmail error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }

  async getProfile() {
    const authHeader = await this.authStorage.getAuthHeader();
    console.log("[unAuthService] getProfile headers:", authHeader);
    try {
      const res = await apiClient.get("/auth/profile", { headers: { ...(authHeader || {}) } });
      console.log("[unAuthService] getProfile response status:", res.status);
      console.log("[unAuthService] getProfile response data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log("[unAuthService] getProfile error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }

  async updateProfile(fields: {
    name?: string;
    phone?: string;
    bio?: string;
    file?: { uri: string; name: string; type: string } | any;
  }) {
    const form = new FormData();
    if (fields.name) form.append("name", fields.name as any);
    if (fields.phone) form.append("phone", fields.phone as any);
    if (fields.bio) form.append("bio", fields.bio as any);
    if (fields.file) form.append("file", fields.file as any);

    const authHeader = await this.authStorage.getAuthHeader();
    console.log("[unAuthService] updateProfile fields:", fields);
    console.log("[unAuthService] updateProfile headers:", authHeader);
    try {
      const res = await apiClient.put("/auth/profile", form, {
        headers: {
          ...(authHeader || {}),
          "Content-Type": "multipart/form-data",
        },
      });
      console.log("[unAuthService] updateProfile response status:", res.status);
      console.log("[unAuthService] updateProfile response data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log("[unAuthService] updateProfile error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }

  async changePassword(payload: ChangePasswordPayload) {
    const authHeader = await this.authStorage.getAuthHeader();
    console.log("[unAuthService] changePassword payload:", payload);
    console.log("[unAuthService] changePassword headers:", authHeader);
    try {
      const res = await apiClient.put("/auth/change-password", payload, {
        headers: { ...(authHeader || {}) },
      });
      console.log("[unAuthService] changePassword response status:", res.status);
      console.log("[unAuthService] changePassword response data:", res.data);
      return res.data;
    } catch (err: any) {
      console.log("[unAuthService] changePassword error:", err?.response?.status, err?.response?.data || err?.message);
      throw err;
    }
  }
}

export default new unAuthService();