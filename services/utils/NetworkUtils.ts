import NetInfo from '@react-native-community/netinfo';

export class NetworkUtils {
  private static isOnline: boolean = true;
  private static listeners: Array<(isOnline: boolean) => void> = [];

  public static async checkConnection(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      this.isOnline = state.isConnected === true && state.isInternetReachable !== false;
      return this.isOnline;
    } catch (error) {
      console.warn('[NetworkUtils] Failed to check connection:', error);
      return false;
    }
  }

  public static getConnectionStatus(): boolean {
    return this.isOnline;
  }

  public static subscribe(callback: (isOnline: boolean) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  public static initialize(): void {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected === true && state.isInternetReachable !== false;
      
      console.log('[NetworkUtils] Connection status:', this.isOnline ? '🟢 ONLINE' : '🔴 OFFLINE');
      
      // Notify listeners if status changed
      if (wasOnline !== this.isOnline) {
        this.listeners.forEach(callback => callback(this.isOnline));
      }
    });
  }
}
