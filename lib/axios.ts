import axios from "axios";
import { AuthStorageService } from "../services/auth/AuthStorageService";

const apiClient = axios.create({
  // baseURL: 'http://172.17.64.1:5000/api',
  baseURL:'https://sp-loc-track-backend.vercel.app/api',
  timeout: 15000, // Increased timeout for slower connections
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  validateStatus: (status) => {
    // Accept any status code to handle it in interceptor
    return status >= 200 && status < 600;
  },
});

// Request interceptor to attach Bearer token from AsyncStorage/DB
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const authHeader = await AuthStorageService.getInstance().getAuthHeader();
      config.headers = {
        ...(config.headers || {}),
        ...(authHeader || {}),
        'X-Requested-At': Date.now().toString(),
      } as any;
    } catch (e) {
      // non-fatal if token retrieval fails
      config.headers = {
        ...(config.headers || {}),
        'X-Requested-At': Date.now().toString(),
      } as any;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for basic error logging/cleanup
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config: originalRequest } = error || {} as any;
    if (response) {
      if (response.status === 401) {
        try {
          // Avoid loops: do not retry refresh requests and only retry once
          if (!originalRequest || originalRequest._retry || (originalRequest?.url || '').includes('/auth/refresh')) {
            throw error;
          }

          const authService = AuthStorageService.getInstance();
          const current = await authService.getAuthToken();
          if (!current?.refreshToken) throw error;

          // Use a bare axios call to bypass interceptors
          const refreshUrl = `${apiClient.defaults.baseURL}/auth/refresh`;
          const refreshRes = await axios.post(refreshUrl, { refreshToken: current.refreshToken }, {
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            timeout: 10000,
          });

          const { accessToken, refreshToken, expiresInSec } = refreshRes.data || {};
          if (!accessToken || !expiresInSec) throw error;

          const currentUser = await authService.getCurrentUser();
          await authService.storeAuthData({
            user: currentUser,
            access_token: accessToken,
            refresh_token: refreshToken ?? current.refreshToken,
            expires_in: expiresInSec,
          });

          // Mark request as retried and set new Authorization header
          originalRequest._retry = true;
          originalRequest.headers = {
            ...(originalRequest.headers || {}),
            Authorization: `Bearer ${accessToken}`,
          };

          return apiClient.request(originalRequest);
        } catch (e) {
          console.error('Unauthorized. Clearing auth data.');
          try { await AuthStorageService.getInstance().clearAuthData(); } catch {}
          // propagate original error after cleanup
          return Promise.reject(error);
        }
      }

      switch (response.status) {
        case 403:
          console.error('Access forbidden');
          break;
        case 404:
          console.error('Resource not found');
          break;
        case 500:
          console.error('Internal server error');
          break;
        default:
          console.error('API Error:', response.data?.message || 'Something went wrong');
      }
    } else if (error?.request) {
      // Network error - no response received
      console.warn('[API] Network error - no response from server');
      const networkError = new Error('Network error. Please check your internet connection.');
      (networkError as any).isNetworkError = true;
      (networkError as any).originalError = error;
      return Promise.reject(networkError);
    } else {
      // Request setup error
      console.error('[API] Request setup failed:', error?.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;