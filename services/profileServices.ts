import { ApiClient } from './api/ApiClient';

export interface UpdateUserPayload {
  name?: string;
  isActive?: boolean;
  phone?: string;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
  [key: string]: any;
}

export class ProfileService {
  constructor(private client: ApiClient) {}

  public async updateUser(userId: string, data: UpdateUserPayload): Promise<User> {
    return await this.client.request<User>(`/users/${encodeURIComponent(userId)}` , {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}
