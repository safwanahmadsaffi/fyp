import { AuthService } from '../auth/AuthService';

export interface ApiClientOptions {
  baseUrl: string;
}

export class ApiClient {
  private baseUrl: string;
  constructor(opts: ApiClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
  }

  private async getAuthHeader(): Promise<Record<string, string>> {
    const token = await AuthService.withValidToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  public async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(await this.getAuthHeader()),
      ...(init.headers as Record<string, string> | undefined),
    };
    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    if (res.status === 204) return undefined as unknown as T;
    return (await res.json()) as T;
  }
}


