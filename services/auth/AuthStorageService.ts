import AsyncStorage from '@react-native-async-storage/async-storage';
import { DatabaseService } from '../database/DatabaseService';
import { PasswordService } from './PasswordService';
import { User, AuthToken } from '../../types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
}

export interface StoredAuth {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAtEpochMs: number;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export class AuthStorageService {
  private static instance: AuthStorageService;
  private readonly USER_KEY = 'current_user';
  private readonly REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry
  private readonly DEFAULT_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours for local auth
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
    // Ensure database is initialized
    this.db.initialize().catch(err => {
      console.error('Failed to initialize database:', err);
    });
  }

  public static getInstance(): AuthStorageService {
    if (!AuthStorageService.instance) {
      AuthStorageService.instance = new AuthStorageService();
    }
    return AuthStorageService.instance;
  }

  // Local authentication
  public async loginLocal(email: string, password: string): Promise<StoredAuth | null> {
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
      
      const auth: StoredAuth = {
        userId: userData.id,
        accessToken: `local_token_${userData.id}`,
        expiresAtEpochMs: Date.now() + this.DEFAULT_EXPIRY,
      };

      await this.storeAuthData({
        user: {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
        },
        access_token: auth.accessToken,
        expires_in: this.DEFAULT_EXPIRY / 1000,
      });

      return auth;
    } catch (error) {
      console.error('Login failed:', error);
      return null;
    }
  }

  // Store authentication tokens
  public async storeAuthData(authResponse: AuthResponse): Promise<void> {
    try {
      // Ensure DB is initialized before writing
      await this.db.initialize();

      const expiresAt = new Date(Date.now() + (authResponse.expires_in * 1000));

      const tokenData: AuthToken = {
        id: 1, // We'll use a fixed ID since we only store one user's tokens
        user_id: authResponse.user.id,
        access_token: authResponse.access_token,
        refresh_token: authResponse.refresh_token,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Store in SQLite
      await this.db.executeSql(
        `INSERT OR REPLACE INTO auth_tokens 
         (id, user_id, access_token, refresh_token, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [1, tokenData.user_id, tokenData.access_token, tokenData.refresh_token,
         tokenData.expires_at, tokenData.created_at, tokenData.updated_at]
      );

      // Debug: read-back to verify persistence
      try {
        const rb = await this.db.executeSql('SELECT * FROM auth_tokens WHERE id = 1');
        const row = rb.rows.length > 0 ? rb.rows.item(0) : null;
        console.log('[AuthStorageService] auth_tokens read-back:', row);
      } catch (e) {
        console.warn('[AuthStorageService] read-back failed:', e);
      }

      // Store current user in AsyncStorage for fast access
      await AsyncStorage.setItem(this.USER_KEY, JSON.stringify(authResponse.user));
    } catch (error) {
      console.error('Error storing auth data:', error);
      throw error;
    }
  }

  public async getAuthToken(): Promise<StoredAuth | null> {
    try {
      // Ensure database is initialized before any operation
      await this.db.initialize();
      
      const result = await this.db.executeSql(
        'SELECT * FROM auth_tokens WHERE id = 1'
      );

      if (result.rows.length === 0) {
        return null;
      }

      const token = result.rows.item(0) as AuthToken;
      
      // Check if token is expired
      if (this.isTokenExpired(token)) {
        await this.clearAuthData();
        return null;
      }

      return {
        userId: token.user_id,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAtEpochMs: new Date(token.expires_at).getTime(),
      };
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  public async getCurrentUser(): Promise<any | null> {
    try {
      const userString = await AsyncStorage.getItem(this.USER_KEY);
      if (!userString) return null;
      
      const user = JSON.parse(userString);
      
      try {
        const result = await this.db.executeSql(
          'SELECT id FROM users WHERE id = ? AND status = ?',
          [user.id, 'active']
        );
        if (result.rows.length > 0) {
          return user;
        }
      } catch {}
      
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  public async isTokenValid(): Promise<boolean> {
    const token = await this.getAuthToken();
    if (!token) return false;

    const now = Date.now();
    return token.expiresAtEpochMs - now > this.REFRESH_THRESHOLD;
  }

  public async isExpired(graceMs: number = 0): Promise<boolean> {
    const token = await this.getAuthToken();
    if (!token) return true;
    return Date.now() + graceMs >= token.expiresAtEpochMs;
  }

  public async needsTokenRefresh(): Promise<boolean> {
    const token = await this.getAuthToken();
    if (!token) return false;

    const now = Date.now();
    const timeUntilExpiry = token.expiresAtEpochMs - now;

    return timeUntilExpiry <= this.REFRESH_THRESHOLD && timeUntilExpiry > 0;
  }

  public async updateToken(refreshResponse: RefreshTokenResponse): Promise<void> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) throw new Error('No current user found');

      const expiresAt = new Date(Date.now() + (refreshResponse.expires_in * 1000));

      const tokenData: AuthToken = {
        id: 1,
        user_id: currentUser.id,
        access_token: refreshResponse.access_token,
        refresh_token: refreshResponse.refresh_token,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await this.db.executeSql(
        `UPDATE auth_tokens 
         SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = ? 
         WHERE id = 1`,
        [tokenData.access_token, tokenData.refresh_token, 
         tokenData.expires_at, tokenData.updated_at]
      );
    } catch (error) {
      console.error('Error updating token:', error);
      throw error;
    }
  }

  public async clearAuthData(): Promise<void> {
    try {
      await Promise.all([
        this.db.executeSql('DELETE FROM auth_tokens WHERE id = 1'),
        AsyncStorage.removeItem(this.USER_KEY)
      ]);
    } catch (error) {
      console.error('Error clearing auth data:', error);
      throw error;
    }
  }

  public async isAuthenticated(): Promise<boolean> {
    const token = await this.getAuthToken();
    return token !== null;
  }

  public async getAuthHeader(): Promise<{ Authorization: string } | null> {
    const token = await this.getAuthToken();
    if (!token) return null;

    return {
      Authorization: `Bearer ${token.accessToken}`,
    };
  }

  private isTokenExpired(token: AuthToken): boolean {
    const now = new Date();
    const expiresAt = new Date(token.expires_at);
    return now >= expiresAt;
  }

  public async getTokenExpiryTime(): Promise<Date | null> {
    const token = await this.getAuthToken();
    return token ? new Date(token.expiresAtEpochMs) : null;
  }

  public async withValidToken<T>(
    refreshFn?: (refreshToken: string) => Promise<StoredAuth | null>,
  ): Promise<string | null> {
    const current = await this.getAuthToken();
    if (!current) return null;

    const isExp = await this.isExpired(30_000); // 30s grace
    if (!isExp) return current.accessToken;

    if (!current.refreshToken || !refreshFn) {
      return null;
    }

    const refreshed = await refreshFn(current.refreshToken);
    if (refreshed) {
      await this.storeAuthData({
        user: (await this.getCurrentUser()),
        access_token: refreshed.accessToken,
        refresh_token: refreshed.refreshToken,
        expires_in: Math.floor((refreshed.expiresAtEpochMs - Date.now()) / 1000),
      });
      return refreshed.accessToken;
    }
    return null;
  }
}