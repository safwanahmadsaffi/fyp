import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StoredAuth {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAtEpochMs: number; // absolute epoch ms
}

const AUTH_KEY = 'sp_auth_v1';

export class AuthService {
  public static async save(auth: StoredAuth): Promise<void> {
    const serialized = JSON.stringify(auth);
    await AsyncStorage.setItem(AUTH_KEY, serialized);
  }

  public static async get(): Promise<StoredAuth | null> {
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    try {
      const parsed: StoredAuth = JSON.parse(raw);
      return parsed;
    } catch (_e) {
      await AsyncStorage.removeItem(AUTH_KEY);
      return null;
    }
  }

  public static async isExpired(graceMs: number = 0): Promise<boolean> {
    const auth = await AuthService.get();
    if (!auth) return true;
    return Date.now() + graceMs >= auth.expiresAtEpochMs;
  }

  public static async clear(): Promise<void> {
    await AsyncStorage.removeItem(AUTH_KEY);
  }

  public static async withValidToken<T>(
    refreshFn?: (refreshToken: string) => Promise<StoredAuth | null>,
  ): Promise<string | null> {
    const current = await AuthService.get();
    if (!current) return null;

    const isExp = await AuthService.isExpired(30_000); // 30s grace
    if (!isExp) return current.accessToken;

    if (!current.refreshToken || !refreshFn) {
      return null;
    }

    const refreshed = await refreshFn(current.refreshToken);
    if (refreshed) {
      await AuthService.save(refreshed);
      return refreshed.accessToken;
    }
    return null;
  }
}


