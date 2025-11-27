import { SyncService } from './SyncService';
import { NetworkUtils } from '../utils/NetworkUtils';

/**
 * Initialize sync and network monitoring
 * Call this once when the app starts
 */
export function initializeSync() {
  console.log('[InitSync] 🚀 Initializing sync system...');
  
  // Initialize network monitoring
  NetworkUtils.initialize();
  
  // Get sync service instance
  const syncService = SyncService.getInstance();
  
  // Set up smart API handler that routes to respective APIs
  syncService.setSmartApiHandler();
  
  // Start background sync (every 15 seconds)
  syncService.startBackground(15000);
  
  console.log('[InitSync] ✅ Sync system initialized');
  
  return syncService;
}

/**
 * Clean up sync service
 * Call this when the app is closing
 */
export function cleanupSync() {
  const syncService = SyncService.getInstance();
  syncService.stopBackground();
  console.log('[InitSync] 🛑 Sync system stopped');
}
