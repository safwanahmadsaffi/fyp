import { ApiClient } from './ApiClient';
import { AuthStorageService, StoredAuth } from '../auth/AuthStorageService';

export class AuthApi {
  private authService: AuthStorageService;

  constructor(private client: ApiClient) {
    this.authService = AuthStorageService.getInstance();
  }

  public async login(email: string, password: string): Promise<StoredAuth> {
    const res = await this.client.request<{ userId: string; accessToken: string; refreshToken?: string; expiresInSec: number }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    );

    const auth: StoredAuth = {
      userId: res.userId,
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      expiresAtEpochMs: Date.now() + res.expiresInSec * 1000,
    };

    await this.authService.storeAuthData({
      user: {
        id: res.userId,
        name: '', // Will be updated from user profile
        email: email,
        role: '', // Will be updated from user profile
      },
      access_token: res.accessToken,
      refresh_token: res.refreshToken,
      expires_in: res.expiresInSec,
    });

    return auth;
  }

  public async refresh(refreshToken: string): Promise<StoredAuth | null> {
    try {
      const res = await this.client.request<{ accessToken: string; refreshToken?: string; expiresInSec: number }>(
        '/auth/refresh',
        { method: 'POST', body: JSON.stringify({ refreshToken }) },
      );

      const current = await this.authService.getAuthToken();
      if (!current) return null;

      const auth: StoredAuth = {
        userId: current.userId,
        accessToken: res.accessToken,
        refreshToken: res.refreshToken ?? current.refreshToken,
        expiresAtEpochMs: Date.now() + res.expiresInSec * 1000,
      };

      await this.authService.storeAuthData({
        user: (await this.authService.getCurrentUser()),
        access_token: res.accessToken,
        refresh_token: res.refreshToken ?? current.refreshToken,
        expires_in: res.expiresInSec,
      });

      return auth;
    } catch (_e) {
      return null;
    }
  }
}


