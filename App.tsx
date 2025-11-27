import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { initializeSync } from './services/sync/initializeSync';
import { clearFailedItems, getSyncQueueStats } from './services/sync/clearSyncQueue';
import Login from './Components/Login';
import ForgotPasswordEmail from './Components/ForgottenEmail';
import ForgotPasswordOTP from './Components/PasswordOTP';
import ResetPassword from './Components/ResetPassword';
import ChangePassword from './Components/ChangePassword';
import ProfilePage from './Components/Profile';
import Dashboard from './Components/Dashboard';
import Shops from './Components/Shops';
import History from './Components/History';
import { ShopVisit } from './Components/ShopVisit';
import ShopDetails from './Components/ShopDetails';
import CheckinHistory from './Components/CheckinHistory';

import { DatabaseService } from './services/database/DatabaseService';
import { DatabaseMigrations } from './services/database/DatabaseMigrations';
import { VisitService } from './services/visits/VisitService';
import { AttendanceService } from './services/attendance/AttendanceService';
import { AllocationService } from './services/allocations/AllocationService';
import { RootStackParamList } from './types/navigation';
import { SyncService } from './services/sync/SyncService';
import { LocationTracker } from './services/tracking/LocationTracker';
import allocService from './services/allocations/allocService';
import { AuthStorageService } from './services/auth/AuthStorageService';
import apiClient from './lib/axios';

const Stack = createNativeStackNavigator<RootStackParamList>();

const App: React.FC = () => {
  useEffect(() => {
    const init = async () => {
      try {
        console.log('🟡 Initializing database...');
        await DatabaseService.getInstance().initialize();
        console.log('✅ Database initialized');

        console.log('🟡 Closing stale attendance records...');
        await AttendanceService.closeStaleOpenRecords();
        console.log('✅ Attendance cleanup done');

        console.log('🟡 Running migrations...');
        await DatabaseMigrations.getInstance().runMigrations();
        console.log('✅ Migrations complete');

        // Note: Background sync is started by initializeSync() below
        // which sets up the smart API handler that routes to specific endpoints

        // Fetch fresh allocations from API ONLY if user is authenticated
        const authService = AuthStorageService.getInstance();
        const isAuthenticated = await authService.isAuthenticated();
        
        if (isAuthenticated) {
          try {
            console.log('🟡 User authenticated - Fetching fresh allocations from API...');
            const allocResp = await allocService.getMyAllocations();
            console.log('✅ Fresh allocations fetched:', allocResp?.data?.allocations?.length || 0);
          } catch (error: any) {
            console.warn('⚠️ Failed to fetch allocations from API:', error?.message);
            console.log('ℹ️ Will use local data as fallback');
          }
        } else {
          console.log('ℹ️ User not authenticated - Skipping allocation fetch (will load after login)');
        }

        console.log('✅ All initial setup complete');

        // Resume background location tracking if there is an active attendance record
        try {
          const db = DatabaseService.getInstance().getDatabase();
          const [res] = await db.executeSql(
            `SELECT id FROM attendance_records WHERE status = 'active' AND check_out_time IS NULL LIMIT 1`
          );
          if (res.rows.length > 0) {
            const attendanceId = res.rows.item(0).id as string;
            console.log('🔄 Resuming LocationTracker for active attendance:', attendanceId);
            await LocationTracker.start(attendanceId);
          }
        } catch (e) {
          console.warn('⚠️ Failed to resume background tracking:', e);
        }
      } catch (e) {
        console.error('❌ Initialization failed:', e);
        Toast.show({ type: 'error', text1: 'Database initialization failed' });
      }
    };

    init();
  }, []);
  useEffect(() => {
    const setupSync = async () => {
      // Initialize sync system
      initializeSync();
      
      // Clean up old failed items (one-time cleanup)
      try {
        const stats = await getSyncQueueStats();
        console.log('[App] 📊 Sync Queue Stats:', stats);
        
        if (stats.failed > 0) {
          console.log(`[App] 🗑️ Cleaning up ${stats.failed} failed items...`);
          const cleared = await clearFailedItems(25); // Clear items with retry > 25
          console.log(`[App] ✅ Cleared ${cleared} stuck items from queue`);
        }
      } catch (error) {
        console.warn('[App] Failed to cleanup sync queue:', error);
      }
    };
    
    setupSync();
  }, []);
  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="ForgotPasswordEmail" component={ForgotPasswordEmail} />
        <Stack.Screen name="ForgotPasswordOTP" component={ForgotPasswordOTP} />
        <Stack.Screen name="ForgotPasswordNewPassword" component={ResetPassword} />
        <Stack.Screen name="Dashboard" component={Dashboard} />
        <Stack.Screen name="Shops" component={Shops} />
        <Stack.Screen name="Profile" component={ProfilePage} />
        <Stack.Screen name="ChangePassword" component={ChangePassword} />
        <Stack.Screen name="History" component={History} />
        <Stack.Screen name="ShopVisit" component={ShopVisit} />
        <Stack.Screen name="ShopDetails" component={ShopDetails} />
        <Stack.Screen name="CheckinHistory" component={CheckinHistory} />
      </Stack.Navigator>
      <Toast />
    </NavigationContainer>
  );
};

export default App;
