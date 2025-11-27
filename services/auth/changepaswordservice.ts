import apiClient from "../../lib/axios";
import { AuthStorageService } from "./AuthStorageService";
import { PasswordService } from "./PasswordService";
import { DatabaseService } from "../database/DatabaseService";

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

class ChangePaswordService {
  async changePassword(payload: ChangePasswordPayload) {
    console.log("[ChangePaswordService] Request payload:", payload);
    const res = await apiClient.put("/auth/change-password", payload);
    console.log("[ChangePaswordService] API response:", res?.data);

    // After backend success, also update local database for offline/local auth
    try {
      const auth = AuthStorageService.getInstance();
      const currentUser = await auth.getCurrentUser();
      if (currentUser?.id) {
        // Ensure DB ready
        const db = DatabaseService.getInstance();
        await db.initialize();

        // Hash and update local users table
        const hashed = await PasswordService.hashPassword(payload.newPassword);
        await db.executeSql(
          'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [hashed, currentUser.id]
        );
        console.log("[ChangePaswordService] Local DB password updated for user:", currentUser.id);
      } else {
        console.log("[ChangePaswordService] Skipped local DB update: no current user found");
      }
    } catch (localErr) {
      console.warn("[ChangePaswordService] Failed to update local DB password:", localErr);
    }

    return res.data;
  }
}

export default new ChangePaswordService();
