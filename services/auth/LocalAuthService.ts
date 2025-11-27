// This file is deprecated. See AuthStorageService for the new implementation.
import { DatabaseService } from '../database/DatabaseService';
import { AuthStorageService, StoredAuth } from './AuthStorageService';
import { PasswordService } from './PasswordService';

export class LocalAuthService {
  private static db = DatabaseService.getInstance();

  public static async login(email: string, password: string): Promise<StoredAuth | null> {
    try {
      const result = await this.db.executeSql(
        'SELECT id, name, email, password_hash, role FROM users WHERE email = ? AND status = ?',
        [email, 'active']
      );

      if (result.rows.length === 0) {
        return null;
      }

      const userData = result.rows.item(0);
      
      // Verify password
      if (!PasswordService.verifyPassword(userData.password_hash, password)) {
        return null;
      }
      
      // Create a mock token for local authentication
      const auth: StoredAuth = {
        userId: userData.id,
        accessToken: `local_token_${userData.id}`,
        expiresAtEpochMs: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      };

      // Save the auth state
      await AuthStorageService.getInstance().storeAuthData({
        user: {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
        },
        access_token: auth.accessToken,
        expires_in: 24 * 60 * 60, // 24 hours in seconds
      });

      return auth;
    } catch (error) {
      console.error('Login failed:', error);
      return null;
    }
  }

  public static async getCurrentUser() {
    const auth = await AuthStorageService.getInstance().getAuthToken();
    if (!auth) return null;

    try {
      const result = await this.db.executeSql(
        'SELECT id, name, email, role FROM users WHERE id = ? AND status = ?',
        [auth.userId, 'active']
      );

      if (result.rows.length === 0) {
        await AuthStorageService.getInstance().clearAuthData();
        return null;
      }

      return result.rows.item(0);
    } catch (error) {
      console.error('Get current user failed:', error);
      return null;
    }
  }

  public static async logout(): Promise<void> {
    await AuthStorageService.getInstance().clearAuthData();
  }
}