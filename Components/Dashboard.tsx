import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';

import Container from '../Abstracts/Container';
import ValidText from '../Abstracts/ValidText';
import Button from '../Abstracts/Button';
import ShopCard from '../Components/ShopCard';
import { Colors, FontSize } from '../Theme';
import { Shop } from '../types/shop';
import { Leave } from '../types/leaves';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import HeaderBar from '../Abstracts/HeaderBar';
import { withAuthGuard } from '../services/auth/withAuthGuard';
import { OfflineFirstService } from '../services/sync/OfflineFirstService';
import { SyncService } from '../services/sync/SyncService';
import { generateId } from '../services/utils/uid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationTracker } from '../services/tracking/LocationTracker';
import { DatabaseService } from '../services/database/DatabaseService';
import attendService from '../services/attendance/attendService';
import allocService from '../services/allocations/allocService';
import { VisitService } from '../services/visits/VisitService';
import visitApiService from '../services/visits/visitApiService';
import { enqueueSync } from '../services/sync/enqueue';
import NewOrderForm from './NewOrderForm';
import { AllocationSyncService } from '../services/allocations/AllocationSyncService';

type DashboardNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Dashboard'
>;

type DashboardRouteProp = RouteProp<RootStackParamList, 'Dashboard'>;

interface DashboardProps {
  navigation: DashboardNavigationProp;
  route: DashboardRouteProp;
}

const Dashboard: React.FC<DashboardProps> = ({ navigation, route }) => {
  const [shops, setShops] = useState<Shop[]>([]); // Start with empty array - will load from API
  const [orderFormVisible, setOrderFormVisible] = useState(false);
  const [selectedShop, setSelectedShop] = useState<{ id: string; name: string; visitId?: string; allocationId?: string; existingOrders?: any[] } | null>(null);
  const [leaves, setLeaves] = useState<Leave[]>(route.params?.leaves || []);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [activeCheckInId, setActiveCheckInId] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00');
  const [allocatedCount, setAllocatedCount] = useState<number>(0);
  const [visitedTodayCount, setVisitedTodayCount] = useState<number>(0);
  const [pendingTodayCount, setPendingTodayCount] = useState<number>(0);
  const [syncPending, setSyncPending] = useState<number>(0);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const salesmanName = 'Ali';

  useEffect(() => {
    if (route.params?.updatedShops) {
      setShops(route.params.updatedShops);
    }
  }, [route.params?.updatedShops]);

  useEffect(() => {
    if (route.params?.leaves) {
      setLeaves(route.params.leaves);
    }
  }, [route.params?.leaves]);

  // Reusable function to load allocations
  const loadAllocations = async () => {
    try {
      console.log('[Dashboard] 📥 Syncing all allocations from server to local database...');
      
      // Get current date in YYYY-MM-DD format
      const today = new Date();
      const currentDate = today.toISOString().split('T')[0];
      
      console.log('[Dashboard] 📅 Filtering allocations for date:', currentDate);
      
      // 1. Fetch ALL allocations from API with current date filter (no limit)
      const syncedCount = await AllocationSyncService.syncFromServer({
        allocationDate: currentDate,
        isActive: true
      });
      console.log('[Dashboard] ✅ Synced', syncedCount, 'allocations to local database');
      
      // 2. Load from local database (now has fresh data from server)
      await loadShopsFromLocalDB();
      
      // 3. Show success message
      Toast.show({
        type: 'success',
        text1: 'Data Synced',
        text2: `Loaded ${syncedCount} shop${syncedCount !== 1 ? 's' : ''} for today`,
        position: 'top',
        visibilityTime: 2000,
      });
      
    } catch (error: any) {
      console.warn('[Dashboard] ❌ Failed to sync from server:', error?.message || 'Network error');
      console.log('[Dashboard] 📱 Loading shops from local database as fallback...');
      
      // Fallback to local database (may have old data)
      await loadShopsFromLocalDB();
      
      // Show offline message
      Toast.show({
        type: 'info',
        text1: 'Working Offline',
        text2: 'Showing locally stored data',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // Load allocations on mount
  useEffect(() => {
    loadAllocations();
  }, []);
    
  // Helper function to check if allocation is valid for current date
  const isAllocationValidForDate = (frequency: string, assignedDays: string, currentDate: Date): boolean => {
    // API uses 0-6 format (0=Sunday, 1=Monday, ..., 6=Saturday)
    const dayOfWeek = currentDate.getDay(); // 0-6 (0=Sunday)
    
    console.log('[Dashboard] Checking allocation - Frequency:', frequency, 'Day of week:', dayOfWeek, '(0=Sun, 6=Sat)');
    
    // Daily frequency - valid every day
    if (frequency === 'daily') {
      return true;
    }
    
    // Weekly frequency - check if current day is in assigned days
    if (frequency === 'weekly') {
      try {
        const days = JSON.parse(assignedDays || '[]');
        console.log('[Dashboard] Weekly allocation days:', days);
        
        // If days is an array of numbers (0-6), check if current day is included
        if (Array.isArray(days) && days.length > 0) {
          const isValid = days.includes(dayOfWeek);
          console.log('[Dashboard] Day', dayOfWeek, 'is', isValid ? 'included' : 'not included', 'in', days);
          return isValid;
        }
        
        // If days is empty array, assume all days
        return true;
      } catch (e) {
        console.warn('[Dashboard] Failed to parse assigned days:', e);
        return true; // Default to showing if parse fails
      }
    }
    
    // Monthly or other frequencies - show all for now
    return true;
  };

  const loadShopsFromLocalDB = async () => {
      try {
        const db = DatabaseService.getInstance().getDatabase();
        if (!db) {
          console.log('[Dashboard] Database not available');
          return;
        }
        
        // Get current date for filtering
        const currentDate = new Date();
        console.log('[Dashboard] Current date for filtering:', currentDate.toISOString());
        
        // Join shops with allocations to get allocation details
        const [results] = await db.executeSql(
          `SELECT s.*, a.id as allocation_id, a.frequency, a.assigned_days, a.status as allocation_status
           FROM shops s 
           LEFT JOIN allocations a ON a.shop_id = s.id 
           WHERE a.status = 'active'
           ORDER BY s.name ASC`
        );
        
        const localShops: Shop[] = [];
        for (let i = 0; i < results.rows.length; i++) {
          const row = results.rows.item(i);
          
          // Filter by frequency and days for current date
          const frequency = row.frequency || 'daily';
          const assignedDays = row.assigned_days || '[]';
          
          if (isAllocationValidForDate(frequency, assignedDays, currentDate)) {
            localShops.push({
              id: row.id,
              name: row.name,
              address: row.address || '',
              owner: row.owner_name || '',
              phone: row.owner_phone || '',
              allocationId: row.allocation_id || '',
              status: 'Pending',
              location: row.latitude && row.longitude
                ? { lat: row.latitude, lng: row.longitude }
                : undefined,
            });
          } else {
            console.log('[Dashboard] Filtered out shop:', row.name, '- Not scheduled for today');
          }
        }
        
        console.log('[Dashboard] Loaded', localShops.length, 'shops from local DB (filtered by date)');
        setShops(localShops);
      } catch (error: any) {
        console.error('[Dashboard] Failed to load from local DB:', error?.message);
      }
    };

  const pendingLeaves = leaves.filter(l => l.status === 'Pending').length;

  const sortedShops = useMemo(() => {
    const priority = (s: Shop) => (s.status === 'Pending' ? 0 : 1);
    return [...shops].sort((a, b) => {
      const pa = priority(a);
      const pb = priority(b);
      if (pa !== pb) return pa - pb;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [shops]);

  // Timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    
    if (isCheckedIn && checkInTime) {
      interval = setInterval(() => {
        const now = new Date();
        const diff = now.getTime() - checkInTime.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setElapsedTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCheckedIn, checkInTime]);

  const handleCheckIn = async () => {
    const now = new Date();
    const attendanceId = generateId();

    try {
      console.log('[Dashboard] Creating check-in...');
      
      // ✅ Call createCheckIn API with proper payload
      const created = await OfflineFirstService.execute(
        () => attendService.createCheckIn({
          checkInTime: now.toISOString(),
          checkInNotes: '', // Optional notes
        }),
        {
          tableName: 'attendance_records',
          recordId: attendanceId,
          operation: 'INSERT',
          data: { 
            id: attendanceId, 
            user_id: 'current-user', 
            check_in_time: now.toISOString(),
            checkInTime: now.toISOString(),
          },
        }
      );

      console.log('[Dashboard] createCheckIn response:', created);
      const createdItem: any = created ? ((created as any).data?.checkIn || (created as any).data || created) : null;

      // Update UI state
      setIsCheckedIn(true);
      const newId = createdItem?._id || createdItem?.id || attendanceId;
      setActiveCheckInId(newId);

      if (createdItem?.checkInTime) {
        setCheckInTime(new Date(createdItem.checkInTime));
      } else {
        setCheckInTime(now);
      }

      // Save to AsyncStorage
      await AsyncStorage.setItem('active_attendance_id', newId);
      if (createdItem) {
        await AsyncStorage.setItem('latest_checkin', JSON.stringify(createdItem));
      }

      // Start location tracking
      await LocationTracker.start(newId);
      setElapsedTime('00:00');

      Toast.show({
        type: 'success',
        text1: 'Checked In Successfully',
        text2: created ? 'Synced to server' : 'Saved locally (will sync)',
        position: 'top',
      });
      
      console.log('[Dashboard] ✅ Check-in successful, ID:', newId);
    } catch (error) {
      console.error('[Dashboard] Check-in error:', error);
      Toast.show({
        type: 'error',
        text1: 'Check-in failed',
        text2: 'Please try again',
        position: 'top',
      });
    }
  };

  const handleCheckOut = async () => {
    console.log('[Dashboard] handleCheckOut called');
    const when = new Date();

    try {
      // Use stored check-in ID or fetch from server
      let checkInId = activeCheckInId;
      
      if (!checkInId) {
        console.log('[Dashboard] No stored check-in ID, fetching from server...');
        try {
          const activeResp = await attendService.getActiveCheckIn();
          console.log('[Dashboard] getActiveCheckIn response:', activeResp);

          const activeCheckIn = activeResp?.data?.checkIn || activeResp?.checkIn;
          checkInId = activeCheckIn?._id || activeCheckIn?.id;
        } catch (error) {
          console.log('[Dashboard] Failed to fetch active check-in (offline?):', error);
          // Continue with stored ID if we have it
        }
      }

      console.log('[Dashboard] Check-in ID for checkout:', checkInId);

      if (!checkInId) {
        Toast.show({
          type: 'error',
          text1: 'No active check-in found',
          text2: 'Please check in first',
          position: 'top',
        });
        return;
      }

      // ✅ Use OfflineFirstService for checkout (works online and offline)
      console.log('[Dashboard] Calling checkout with OfflineFirstService...');
      await OfflineFirstService.execute(
        () => attendService.checkOut(checkInId, {
          checkOutTime: when.toISOString(),
        }),
        {
          tableName: 'attendance_records',
          recordId: checkInId,
          operation: 'UPDATE',
          data: {
            check_out_time: when.toISOString(),
            checkOutTime: when.toISOString(),
          },
        }
      );

      console.log('[Dashboard] ✅ Checkout queued/completed');

      // Update UI state after successful operation
      setIsCheckedIn(false);
      setActiveCheckInId(null);
      setCheckInTime(null);
      setElapsedTime('00:00');
      
      // Clear AsyncStorage
      await AsyncStorage.removeItem('active_attendance_id');
      await AsyncStorage.removeItem('latest_checkin');
      
      // Stop location tracking
      LocationTracker.stop();

      Toast.show({
        type: 'success',
        text1: 'Checked Out Successfully',
        text2: 'Location tracking stopped',
        position: 'top',
      });
      
      console.log('[Dashboard] ✅ Check-out successful');
    } catch (err) {
      console.error('[Dashboard] Checkout failed:', err);
      Toast.show({
        type: 'error',
        text1: 'Checkout failed',
        text2: 'Please try again',
        position: 'top',
      });
    }
  };

  useEffect(() => {
    const initFromServer = async () => {
      try {
        console.log('[Dashboard] Checking for active check-in on app load...');
        
        // ✅ Use getActiveCheckIn API to check for active check-in
        const resp = await attendService.getActiveCheckIn();
        console.log('[Dashboard] getActiveCheckIn response:', resp);
        
        const activeCheckIn = resp?.data?.checkIn || resp?.checkIn;
        
        if (activeCheckIn && !activeCheckIn.checkOutTime) {
          // Active check-in found
          const checkInId = activeCheckIn._id || activeCheckIn.id;
          console.log('[Dashboard] Active check-in found:', checkInId);
          
          setIsCheckedIn(true);
          setCheckInTime(activeCheckIn.checkInTime ? new Date(activeCheckIn.checkInTime) : new Date());
          setActiveCheckInId(checkInId);
          
          // Save to AsyncStorage
          try {
            await AsyncStorage.setItem('active_attendance_id', checkInId);
            await AsyncStorage.setItem('latest_checkin', JSON.stringify(activeCheckIn));
          } catch (e) {
            console.warn('[Dashboard] Failed to save to AsyncStorage:', e);
          }
          
          // Start location tracking
          await LocationTracker.start(checkInId);
          
          console.log('[Dashboard] ✅ Restored active check-in session');
        } else {
          // No active check-in
          console.log('[Dashboard] No active check-in found');
          setIsCheckedIn(false);
          setCheckInTime(null);
          setActiveCheckInId(null);
          
          try {
            await AsyncStorage.removeItem('active_attendance_id');
            await AsyncStorage.removeItem('latest_checkin');
          } catch {}
        }
      } catch (error) {
        console.error('[Dashboard] Failed to check active check-in:', error);
        // Fallback to local storage if API fails
        const active = await AsyncStorage.getItem('active_attendance_id');
        if (active) {
          console.log('[Dashboard] Using cached check-in from AsyncStorage');
          setActiveCheckInId(active);
          setIsCheckedIn(true);
        }
      }
    };
    initFromServer();
  }, []);

  useEffect(() => {
    // restore running session indicator if there is an active attendance id
    const restore = async () => {
      const active = await AsyncStorage.getItem('active_attendance_id');
      const latestRaw = await AsyncStorage.getItem('latest_checkin');
      if (active) {
        setActiveCheckInId(active);
        try {
          if (latestRaw) {
            const latest = JSON.parse(latestRaw);
            if (latest?.checkInTime && (latest?.checkOutTime === null || latest?.checkOutTime === undefined)) {
              setIsCheckedIn(true);
              setCheckInTime(new Date(latest.checkInTime));
            }
          }
        } catch {}
        await LocationTracker.start(active);
      }
    };
    restore();
  }, []);

  // Load dashboard stats from DB
  useEffect(() => {
    const loadStats = async () => {
      const db = DatabaseService.getInstance().getDatabase();
      const today = new Date().toISOString().slice(0,10);
      const userId = 'current-user'; // TODO: replace with real user id
      const [visTodayRes] = await db.executeSql(
        `SELECT COUNT(1) AS cnt FROM visits WHERE visit_date = ? AND status = 'completed' AND user_id = ?`,
        [today, userId],
      );
      setVisitedTodayCount(visTodayRes.rows.item(0)?.cnt ?? 0);

      const [pendingRes] = await db.executeSql(
        `SELECT COUNT(1) AS cnt FROM visits WHERE visit_date = ? AND status = 'planned' AND user_id = ?`,
        [today, userId],
      );
      setPendingTodayCount(pendingRes.rows.item(0)?.cnt ?? 0);

      const [allocRes] = await db.executeSql(
        `SELECT COUNT(1) AS cnt FROM allocations WHERE user_id = ? AND status = 'active'`,
        [userId],
      );
      setAllocatedCount(allocRes.rows.item(0)?.cnt ?? 0);

      const [syncRes] = await db.executeSql(
        `SELECT COUNT(1) AS cnt FROM sync_queue WHERE synced = 0`,
        [],
      );
      setSyncPending(syncRes.rows.item(0)?.cnt ?? 0);
    };
    loadStats().catch(() => undefined);
    const id = setInterval(loadStats, 15000);
    return () => clearInterval(id);
  }, []);

  const markVisited = useCallback(
    async (shopId: string) => {
      const shop = shops.find(s => s.id === shopId);
      if (!shop) return;
      if (shop.status === 'Visited') {
        Toast.show({ type: 'info', text1: 'Already visited', position: 'top' });
        return;
      }
      const now = new Date();
      try {
        // VisitService.createVisit already handles offline-first via OfflineFirstService
        const visitId = await VisitService.createVisit({
          userId: 'current-user',
          shopId: String(shopId),
          allocationId: shop.allocationId || `alloc-${shopId}`, // Use shop's allocationId or generate one
          date: now,
          status: 'completed',
        });
      } catch (e) {
        console.error('[Dashboard] Failed to create visit:', e);
        // proceed with UI update even if DB write fails
      }

      const updated = shops.map(s =>
        s.id === shopId
          ? {
              ...s,
              status: 'Visited' as const,
              lastVisited: now.toISOString(),
            }
          : s,
      );
      setShops(updated);
      Toast.show({ type: 'success', text1: `${shop.name} marked visited`, position: 'top' });
    },
    [shops],
  );

  const handleEditShop = (shopId: string) => {
    const shop = shops.find(s => s.id === shopId);
    if (shop) {
      navigation.navigate('ShopDetails', {
        shop,
        shopId: shop.id,
        onUpdate: (updatedShop: Shop) => {
          const updated = shops.map(s => 
            s.id === updatedShop.id ? updatedShop : s
          );
          setShops(updated);
          Toast.show({
            type: 'success',
            text1: 'Shop updated successfully',
            position: 'top',
          });
        },
      });
    }
  };

  const renderShop = ({ item }: { item: Shop }) => (
    <View style={styles.shopCardWrapper}>
      <ShopCard
        shop={{
          ...item,
          lastVisited: item.lastVisited ? formatDate(item.lastVisited) : undefined,
        }}
        onMarkVisited={markVisited}
        onNewOrder={async (id: string | number) => {
          const shop = shops.find(s => s.id === String(id));
          if (shop) {
            try {
              console.log('🔄 Creating visit for shop:', { id, name: shop.name });
              
              // Create a visit for this shop using API (not local VisitService)
              const today = new Date();
              const response = await visitApiService.createVisit({
                allocationId: shop.allocationId || `alloc-${id}`,
                visitDateTime: today.toISOString(),
                duration: 30,
                notes: '',
              });
              
              console.log('📦 Visit API response:', response);
              console.log('📦 Full response object:', JSON.stringify(response, null, 2));
              
              // Extract visitId from API response
              const visitId = response?.data?.visit?._id || response?.data?._id || response?._id;
              console.log('✅ Visit created for order. Visit ID:', visitId);
              console.log('📋 Visit ID type:', typeof visitId);
              console.log('📋 Visit ID value:', visitId);
              
              if (!visitId) {
                console.error('❌ No visit ID in response:', response);
                throw new Error('Failed to get visit ID from API response');
              }
              
              // Check if visit already has orders
              try {
                const visitDetails = await visitApiService.getVisitById(String(visitId));
                const existingOrders = visitDetails?.data?.visit?.orders || [];
                
                if (existingOrders.length > 0) {
                  console.log('⚠️ Visit already has orders:', existingOrders);
                  Toast.show({
                    type: 'info',
                    text1: 'Orders Already Submitted',
                    text2: 'This visit already has orders. You can view them but cannot edit.',
                    visibilityTime: 3000,
                  });
                }
                
                setSelectedShop({ 
                  id: String(id), 
                  name: shop.name, 
                  visitId: String(visitId),
                  existingOrders 
                });
              } catch (err) {
                console.log('Could not fetch visit details, proceeding without existing orders check');
                setSelectedShop({ id: String(id), name: shop.name, visitId: String(visitId) });
              }
              
              setOrderFormVisible(true);
            } catch (error) {
              console.error('❌ Failed to create visit:', error);
              Toast.show({
                type: 'error',
                text1: 'Failed to create visit',
                text2: 'Please try again',
              });
            }
          }
        }}
        style={{ flex: 1 }}
      />
    </View>
  );

  const renderHeader = () => (
    <View>
      <ValidText text={`Welcome, ${salesmanName}`} style={styles.welcome} />

      {/* Stats */}
      {/* <View style={[styles.statsRow, isLandscape && styles.statsRowLandscape]}>
        <View style={[styles.statCard, { backgroundColor: Colors.primaryblue }]}>
          <Icon name="place" size={20} color={Colors.white} />
          <ValidText text={`${visitedTodayCount}`} style={styles.statValue} />
          <ValidText text={'Visits Today'} style={styles.statLabel} />
        </View> */}

        {/* <View style={[styles.statCard, { backgroundColor: Colors.orange }]}>
          <Icon name="event-busy" size={20} color={Colors.white} />
          <ValidText text={`${pendingLeaves}`} style={styles.statValue} />
          <ValidText text={'Pending Leaves'} style={styles.statLabel} />
        </View> */}

        {/* <View style={[styles.statCard, { backgroundColor: Colors.green }]}>
          <Icon name="store" size={20} color={Colors.white} />
          <ValidText text={`${allocatedCount}`} style={styles.statValue} />
          <ValidText text={'Shops Allocated'} style={styles.statLabel} />
        </View> */}

        {/* <View style={[styles.statCard, { backgroundColor: Colors.orange }]}>
          <Icon name="schedule" size={20} color={Colors.white} />
          <ValidText text={`${pendingTodayCount}`} style={styles.statValue} />
          <ValidText text={'Planned Today'} style={styles.statLabel} />
        </View>
      </View> */}

      {/* Assigned Shops Section */}
      <View style={styles.sectionHeader}>
        <ValidText text="Assigned Shops" style={styles.sectionTitle} />
        <Button
          text="View All"
          onPress={() =>
            shops.length > 0 &&
            navigation.navigate('Shops', {
              shops,
              onUpdate: (updated: Shop[]) => navigation.setParams({ updatedShops: updated }),
            })
          }
          backgroundColor={shops.length > 0 ? Colors.white : Colors.grey}
          color={shops.length > 0 ? Colors.primaryblue : Colors.white}
          width={90}
          height={40}
          borderRadius={10}
          elevation={shops.length > 0 ? 1 : 0}
          fontSize={FontSize.Button}
        />
      </View>

      {/* {allocatedCount === 0 && (
        // <View style={styles.noShopsContainer}>
        //   <Icon name="info-outline" size={40} color={Colors.grey} style={{ marginBottom: 8 }} />
        //   <ValidText text="No shops have been assigned to you yet." style={styles.noShopsText} />
        //   <ValidText text="Please check back later or contact your manager." style={styles.noShopsSubText} />
        // </View>
      )} */}
    </View>
  );

  // const renderNotifications = () => (
  //   <View style={{ marginTop: 16 }}>
  //     <ValidText text="Notifications" style={styles.sectionTitle} />
  //     <View style={styles.notifications}>
  //       <View style={styles.notificationCard}>
  //         <Icon name="check-circle" size={20} color={Colors.green} style={{ marginRight: 8 }} />
  //         <ValidText text="Leave approved by Manager" style={styles.notificationText} />
  //       </View>

  //       <View style={styles.notificationCard}>
  //         <Icon name="alarm" size={20} color={Colors.orange} style={{ marginRight: 8 }} />
  //         <ValidText text="Reminder: Visit Al-Hadi Store before 5 PM" style={styles.notificationText} numberOfLines={2} />
  //       </View>
  //     </View>
  //     <View style={{ height: 32 }} />
  //   </View>
  // );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.offwhite , paddingTop: StatusBar.currentHeight}}>
      
      <Container>
        <HeaderBar title="Dashboard" showBack={false} />
        
        {/* Bottom Nav Bar */}
        <View style={styles.topBar}>
          <Icon name="home" size={26} color={Colors.primaryblue} onPress={() => navigation.navigate('Home')} />
          <Icon name="store" size={26} color={Colors.grey} onPress={() => navigation.navigate('Shops', {
            shops,
            onUpdate: (updated: Shop[]) => navigation.setParams({ updatedShops: updated }),
          })} />
          {/* <Icon name="event" size={26} color={Colors.grey} onPress={() => navigation.navigate('Leaves', {
            leaves,
            onUpdate: (updatedLeaves: Leave[]) => setLeaves(updatedLeaves),
          })} /> */}
          <Icon name="history" size={26} color={Colors.grey} onPress={() => navigation.navigate('CheckinHistory')} />
          <Icon name="person" size={26} color={Colors.grey} onPress={() => navigation.navigate('Profile')} />
        </View>

        {/* Timer Display + Sync Counter */}
        {isCheckedIn && (
          <View style={styles.timerContainer}>
            <Icon name="timer" size={28} color={Colors.primaryblue} />
            <View style={{ marginLeft: 12, alignItems: 'center' }}>
              <ValidText text="Session Time" style={styles.checkedInText} />
              <ValidText text={elapsedTime} style={styles.timerText} />
            </View>
            <View style={{ marginLeft: 16, alignItems: 'center' }}>
              <ValidText text="Sync Pending" style={styles.checkedInText} />
              <ValidText text={`${syncPending}`} style={styles.timerText} />
            </View>
          </View>
        )}

        {/* Check-in/Check-out Button */}
        <View style={styles.attendanceContainer}>
          <Button
            text={isCheckedIn ? 'Check Out' : 'Check In'}
            onPress={isCheckedIn ? handleCheckOut : handleCheckIn}
            backgroundColor={isCheckedIn ? Colors.orange : Colors.primaryblue}
            color={Colors.white}
            width={'100%'}
            height={50}
            borderRadius={12}
            borderWidth={0}
            borderColor={Colors.primaryblue}
            elevation={2}
            fontSize={FontSize.H3}
            Leading_icon={() => (
              <Icon
                name={isCheckedIn ? 'logout' : 'login'}
                size={24}
                color={Colors.white}
              />
            )}
          />
        </View>

        {/* Scrollable Content */}
        <FlatList
          data={sortedShops}
          key={isLandscape ? 'landscape' : 'portrait'}
          numColumns={isLandscape ? 2 : 1}
          keyExtractor={item => item.id}
          renderItem={renderShop}
          ListHeaderComponent={renderHeader}
         // ListFooterComponent={renderNotifications}
          columnWrapperStyle={isLandscape ? { justifyContent: 'space-between', alignItems: 'stretch' } : undefined}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        <Toast />
      </Container>

      {/* Order Form Modal */}
      {selectedShop && (
        <NewOrderForm
          visible={orderFormVisible}
          shopId={selectedShop.id}
          shopName={selectedShop.name}
          visitId={selectedShop.visitId}
          allocationId={selectedShop.allocationId}
          existingOrders={selectedShop.existingOrders}
          onClose={() => {
            setOrderFormVisible(false);
            setSelectedShop(null);
          }}
          onSuccess={async () => {
            try {
              console.log('🔄 [Dashboard] Refreshing data after order placement...');
              // Refresh allocations to get updated visit data
              await loadAllocations();
              console.log('✅ [Dashboard] Data refreshed successfully');
            } catch (error) {
              console.error('❌ [Dashboard] Failed to refresh data:', error);
              // Still mark as visited even if refresh fails
              const updated = shops.map(s =>
                s.id === selectedShop.id
                  ? { ...s, status: 'Visited' as const, lastVisited: new Date().toISOString() }
                  : s
              );
              setShops(updated);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    // backgroundColor: Colors.offwhite,
    paddingTop: StatusBar.currentHeight,
    justifyContent: 'center',
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderRadius: 15,
    elevation: 2,
    marginBottom: 12,
    marginTop:10
  },

  listContent: {
    paddingBottom: 20,
  },

  welcome: {
    fontSize: FontSize.H2,
    fontWeight: '700',
    color: Colors.black,
    marginVertical: 12,
    textAlign: 'center',
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap:4,
    // marginHorizontal:0
  },
  statsRowLandscape: { marginHorizontal: 4 },

  statCard: {
    flex: 1,
    // marginHorizontal: 3,
    borderRadius: 12,
    paddingVertical: 25,
    // paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent:'space-around',
    minWidth:94,
  },
  statValue: {
    color: Colors.white,
    fontSize: FontSize.H2,
    fontWeight: '800',
    marginTop: 6,
  },
  statLabel: {
    color: Colors.white,
    fontSize: FontSize.Caption,
    marginTop: 4,
    textAlign: 'center',
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
    // marginHorizontal:0
  },
  sectionTitle: {
    fontSize: FontSize.H3,
    fontWeight: '700',
    color: Colors.black,
    
  },

  shopCardWrapper: {
    flex: 1,
    // margin: 6,
  },

  notifications: { marginTop: 8 },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 1,
  },
  notificationText: {
    fontSize: FontSize.Body,
    color: Colors.black,
    flex: 1,
    flexWrap: 'wrap',
  },

  noShopsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    padding: 20,
    borderRadius: 12,
    marginTop: 12,
    elevation: 1,
  },
  noShopsText: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.black,
    textAlign: 'center',
  },
  noShopsSubText: {
    fontSize: FontSize.Caption,
    color: Colors.grey,
    marginTop: 4,
    textAlign: 'center',
  },

  attendanceContainer: {
    marginBottom: 12,
    marginTop: 10,
    alignItems:'center'
  },

  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 12,
    borderRadius: 15,
    elevation: 2,
    marginBottom: 12,
  },

  checkedInText: {
    fontSize: FontSize.Caption,
    fontWeight: '600',
    color: Colors.grey,
  },

  timerText: {
    fontSize: FontSize.H2,
    fontWeight: '700',
    color: Colors.primaryblue,
    marginTop: 2,
  },

  checkInTimeText: {
    fontSize: FontSize.Caption,
    color: Colors.grey,
    marginTop: 2,
  },
});

export default Dashboard;