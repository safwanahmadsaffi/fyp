import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthToken } from '../types/database';

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

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export class AuthStorageService {
  private static instance: AuthStorageService;
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'current_user';
  private readonly REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry

  private constructor() {}

  public static getInstance(): AuthStorageService {
    if (!AuthStorageService.instance) {
      AuthStorageService.instance = new AuthStorageService();
    }
    return AuthStorageService.instance;
  }

  // Store authentication tokens
  public async storeAuthData(authResponse: AuthResponse): Promise<void> {
    try {
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

      await AsyncStorage.multiSet([
        [this.TOKEN_KEY, JSON.stringify(tokenData)],
        [this.USER_KEY, JSON.stringify(authResponse.user)],
      ]);
    } catch (error) {
      console.error('Error storing auth data:', error);
      throw error;
    }
  }

  // Get stored authentication token
  public async getAuthToken(): Promise<AuthToken | null> {
    try {
      const tokenString = await AsyncStorage.getItem(this.TOKEN_KEY);
      if (!tokenString) return null;

      const tokenData: AuthToken = JSON.parse(tokenString);

      // Check if token is expired
      if (this.isTokenExpired(tokenData)) {
        await this.clearAuthData();
        return null;
      }

      return tokenData;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // Get current user data
  public async getCurrentUser(): Promise<any | null> {
    try {
      const userString = await AsyncStorage.getItem(this.USER_KEY);
      return userString ? JSON.parse(userString) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // Check if token is expired or will expire soon
  public async isTokenValid(): Promise<boolean> {
    const token = await this.getAuthToken();
    if (!token) return false;

    const now = new Date();
    const expiresAt = new Date(token.expires_at);
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();

    return timeUntilExpiry > this.REFRESH_THRESHOLD;
  }

  // Check if token needs refresh
  public async needsTokenRefresh(): Promise<boolean> {
    const token = await this.getAuthToken();
    if (!token) return false;

    const now = new Date();
    const expiresAt = new Date(token.expires_at);
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();

    return timeUntilExpiry <= this.REFRESH_THRESHOLD && timeUntilExpiry > 0;
  }

  // Update token after refresh
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

      await AsyncStorage.setItem(this.TOKEN_KEY, JSON.stringify(tokenData));
    } catch (error) {
      console.error('Error updating token:', error);
      throw error;
    }
  }

  // Clear all authentication data
  public async clearAuthData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([this.TOKEN_KEY, this.USER_KEY]);
    } catch (error) {
      console.error('Error clearing auth data:', error);
      throw error;
    }
  }

  // Check if user is authenticated
  public async isAuthenticated(): Promise<boolean> {
    const token = await this.getAuthToken();
    return token !== null;
  }

  // Get authorization header for API requests
  public async getAuthHeader(): Promise<{ Authorization: string } | null> {
    const token = await this.getAuthToken();
    if (!token) return null;

    return {
      Authorization: `Bearer ${token.access_token}`,
    };
  }

  // Private helper method to check if token is expired
  private isTokenExpired(token: AuthToken): boolean {
    const now = new Date();
    const expiresAt = new Date(token.expires_at);
    return now >= expiresAt;
  }

  // Get token expiry time for debugging
  public async getTokenExpiryTime(): Promise<Date | null> {
    const token = await this.getAuthToken();
    return token ? new Date(token.expires_at) : null;
  }
}
