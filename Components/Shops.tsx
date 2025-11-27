import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Text,
  Pressable,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PagerView from 'react-native-pager-view';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  MapView,
  Camera,
  PointAnnotation,
  CameraRef,
  ShapeSource,
  LineLayer,
} from '@maplibre/maplibre-react-native';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';

import Container from '../Abstracts/Container';
import ValidText from '../Abstracts/ValidText';
import ShopCard from '../Components/ShopCard';
import { Colors, FontSize } from '../Theme';
import { RootStackParamList } from '../types/navigation';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Shop } from '../types/shop';
import HeaderBar from '../Abstracts/HeaderBar';
import { withAuthGuard } from '../services/auth/withAuthGuard';
import { VisitService } from '../services/visits/VisitService';
import { enqueueSync } from '../services/sync/enqueue';
import allocService from '../services/allocations/allocService';
import visitApiService from '../services/visits/visitApiService';
import NewOrderForm from './NewOrderForm';
import Button from '../Abstracts/Button';
import { VisitSyncService } from '../services/visits/VisitSyncService';
import { OrderService } from '../services/orders/OrderService';
import { AllocationSyncService } from '../services/allocations/AllocationSyncService';
import { DatabaseService } from '../services/database/DatabaseService';

type ShopsProps = NativeStackScreenProps<RootStackParamList, 'Shops'>;

const { width } = Dimensions.get('window');

const ShopsScreen: React.FC<ShopsProps> = ({ route, navigation }) => {
  const { shops, onUpdate } = route.params;

  const [shopList, setShopList] = useState<Shop[]>(shops);
  const [orderFormVisible, setOrderFormVisible] = useState(false);
  const [selectedShop, setSelectedShop] = useState<{
    id: string;
    name: string;
    visitId?: string;
    allocationId?: string;
    existingOrders?: any[];
  } | null>(null);
  const [showOnlyWithOrders, setShowOnlyWithOrders] = useState(false);

  // Date filter states
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [dateFilterActive, setDateFilterActive] = useState(false);

  // Visit Shop section states
  const [filteredVisits, setFilteredVisits] = useState<any[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [visitShops, setVisitShops] = useState<Shop[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [visitModalVisible, setVisitModalVisible] = useState(false);

  // Map View section states
  const [mapViewDate, setMapViewDate] = useState<Date>(new Date());
  const [showMapDatePicker, setShowMapDatePicker] = useState(false);

  // Helper function to check if allocation is valid for current date
  const isAllocationValidForDate = (frequency: string, assignedDays: string, currentDate: Date): boolean => {
    // API uses 0-6 format (0=Sunday, 1=Monday, ..., 6=Saturday)
    const dayOfWeek = currentDate.getDay(); // 0-6 (0=Sunday)
    
    console.log('[Shops] Checking allocation - Frequency:', frequency, 'Day of week:', dayOfWeek, '(0=Sun, 6=Sat)');
    
    // Daily frequency - valid every day
    if (frequency === 'daily') {
      return true;
    }
    
    // Weekly frequency - check if current day is in assigned days
    if (frequency === 'weekly') {
      try {
        const days = JSON.parse(assignedDays || '[]');
        console.log('[Shops] Weekly allocation days:', days);
        
        // If days is an array of numbers (0-6), check if current day is included
        if (Array.isArray(days) && days.length > 0) {
          const isValid = days.includes(dayOfWeek);
          console.log('[Shops] Day', dayOfWeek, 'is', isValid ? 'included' : 'not included', 'in', days);
          return isValid;
        }
        
        // If days is empty array, assume all days
        return true;
      } catch (e) {
        console.warn('[Shops] Failed to parse assigned days:', e);
        return true; // Default to showing if parse fails
      }
    }
    
    // Monthly or other frequencies - show all for now
    return true;
  };

  // Load shops from local database (offline fallback)
  const loadShopsFromLocalDB = async () => {
    try {
      const db = DatabaseService.getInstance().getDatabase();
      if (!db) {
        console.log('[Shops] Database not available');
        return;
      }
      
      // Get current date for filtering
      const currentDate = new Date();
      const currentDateStr = currentDate.toISOString().split('T')[0];
      console.log('[Shops] Current date for filtering:', currentDateStr);
      
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
            frequency: frequency,
            assignedDays: assignedDays,
            location: row.latitude && row.longitude
              ? { lat: row.latitude, lng: row.longitude }
              : undefined,
          });
        } else {
          console.log('[Shops] Filtered out shop:', row.name, '- Not scheduled for today');
        }
      }
      
      console.log('[Shops] Loaded', localShops.length, 'shops from local DB (filtered by date)');
      setShopList(localShops);
      onUpdate?.(localShops);
    } catch (error: any) {
      console.error('[Shops] Failed to load from local DB:', error?.message);
      throw error;
    }
  };

  useEffect(() => {
    const loadAllocations = async () => {
      try {
        console.log('[Shops] 📥 Syncing all allocations from server to local database...');
        
        // Get current date in YYYY-MM-DD format for visit matching
        const today = new Date();
        const currentDate = today.toISOString().split('T')[0];
        
        console.log('[Shops] 📅 Loading all allocations without date filters');
        
        // 1. Sync ALL allocations from API to offline database (no filters, no limit)
        const syncedCount = await AllocationSyncService.syncFromServer();
        console.log('[Shops] ✅ Synced', syncedCount, 'allocations to local database');
        
        // 2. Fetch ALL allocations from API to get full data with visits (no filters, no limit)
        const resp = await allocService.getMyAllocations();
        
        const list = (resp?.data?.allocations ||
          resp?.allocations ||
          []) as any[];

        console.log('[Shops] ✅ Fetched', list.length, 'allocations from API');

        const mapped: Shop[] = list
          .filter((a: any) => a?.shop) // Only include allocations with valid shop
          .map((a: any) => {
            const visits = a?.visits || [];

            // Find today's visit
            const todayVisit = visits.find((v: any) => {
              const visitDate = v?.visitDateTime
                ? new Date(v.visitDateTime).toISOString().split('T')[0]
                : null;
              return visitDate === currentDate;
            });

            const hasVisitedToday = !!todayVisit;
            const todayOrders = todayVisit?.orders || [];
            const todayVisitId = todayVisit?._id;

            console.log(
              `[Shops] ${a?.shop?.name}: visited today=${hasVisitedToday}, orders=${todayOrders.length}, visitId=${todayVisitId}, frequency=${a?.frequency}, days=${JSON.stringify(a?.days)}`,
            );

            // API uses 'days' field, not 'assignedDays'
            const daysData = a?.days || a?.assignedDays;
            const daysJson = typeof daysData === 'string' 
              ? daysData 
              : (daysData ? JSON.stringify(daysData) : '[]');

            return {
              id:
                a?.shop?._id ||
                a?.shop?.id ||
                a?._id ||
                String(Math.random()),
              name: a?.shop?.name || '',
              address: a?.shop?.address || '',
              owner: '',
              phone: '',
              allocationId: a?._id || a?.id || '',
              status: hasVisitedToday
                ? ('Visited' as const)
                : ('Pending' as const),
              lastVisited: todayVisit?.visitDateTime,
              visitId: todayVisitId, // Store today's visit ID
              orders: todayOrders,
              frequency: a?.frequency || 'daily',
              assignedDays: daysJson,
              location: a?.shop?.location
                ? {
                    lat: a.shop.location.latitude,
                    lng: a.shop.location.longitude,
                  }
                : undefined,
            };
          });

        console.log('[Shops] Mapped', mapped.length, 'shops');
        setShopList(mapped);
        onUpdate?.(mapped);
        
        Toast.show({
          type: 'success',
          text1: 'Shops Loaded',
          text2: `Loaded ${mapped.length} shop${mapped.length !== 1 ? 's' : ''}`,
          position: 'top',
          visibilityTime: 2000,
        });
      } catch (error) {
        console.error('[Shops] ❌ Failed to sync from server:', error);
        console.log('[Shops] 📱 Loading shops from local database as fallback...');
        
        // Fallback: Load from offline database
        try {
          await loadShopsFromLocalDB();
          
          Toast.show({
            type: 'info',
            text1: 'Working Offline',
            text2: 'Showing locally stored data',
            position: 'top',
            visibilityTime: 3000,
          });
        } catch (dbError) {
          console.error('[Shops] Failed to load from local DB:', dbError);
          Toast.show({
            type: 'error',
            text1: 'Failed to Load Shops',
            text2: 'No data available',
            position: 'top',
          });
        }
      }
    };
    loadAllocations();
  }, []);
  const [selectedShopIndex, setSelectedShopIndex] = useState(0);
  const [filterToday, setFilterToday] = useState(false);
  const [activePage, setActivePage] = useState(0);

  // Fetch visits from API with optional date filtering
  const fetchVisitsWithDateFilter = async () => {
    setLoadingVisits(true);
    try {
      console.log('📥 Syncing visits from server to local database...');

      // 1. Sync from server to local database
      const syncedCount = await VisitSyncService.syncFromServer({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 1000,
      });

      console.log('✅ Synced', syncedCount, 'visits to local database');

      // 2. Load from local database (now has fresh data)
      const filter: any = { limit: 1000 };

      if (startDate) {
        filter.startDate = startDate;
      }

      if (endDate) {
        filter.endDate = endDate;
      }

      const localVisits = await VisitService.getVisits(filter);
      console.log('✅ Loaded', localVisits.length, 'visits from local DB');

      // Transform local visits to match API format
      const transformedVisits = localVisits.map((v: any) => ({
        _id: v.id,
        visitDateTime: v.visit_date,
        duration: 30, // Default duration
        notes: v.notes || '',
        allocation: {
          _id: v.allocation_id,
          shop: {
            _id: v.shop_id,
            name:
              shopList.find(s => s.id === v.shop_id)?.name || 'Unknown Shop',
            address: shopList.find(s => s.id === v.shop_id)?.address || '',
          },
        },
        orders: JSON.parse(v.orders) || [], // Orders would need separate query
      }));

      const localOrders = await OrderService.getAllOrders();
      console.log(
        '✅ Loaded',
        localOrders.length,
        'orders from local DB',
        localOrders,
      );

      console.log('✅ Transformed visits:', transformedVisits, localVisits);
      setFilteredVisits(transformedVisits);

      // Only set filter active if dates were actually used
      if (startDate || endDate) {
        setDateFilterActive(true);
      }

      Toast.show({
        type: 'success',
        text1: 'Visits Synced',
        text2: `Loaded ${transformedVisits.length} visits from server`,
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('❌ Error syncing visits from server:', error);
      console.log('📱 Falling back to local database...');

      // OFFLINE FALLBACK: Read from local database
      try {
        const filter: any = { limit: 1000 };

        if (startDate) {
          filter.startDate = startDate;
        }

        if (endDate) {
          filter.endDate = endDate;
        }

        const localVisits = await VisitService.getVisits(filter);
        console.log('✅ Loaded visits from local DB:', localVisits.length);

        // Transform local visits to match API format
        const transformedVisits = localVisits.map((v: any) => ({
          _id: v.id,
          visitDateTime: v.visit_date,
          duration: 30, // Default duration
          notes: v.notes || '',
          allocation: {
            _id: v.allocation_id,
            shop: {
              _id: v.shop_id,
              name:
                shopList.find(s => s.id === v.shop_id)?.name || 'Unknown Shop',
              address: shopList.find(s => s.id === v.shop_id)?.address || '',
            },
          },
          orders: JSON.parse(v.orders) || [], // Orders would need separate query
        }));

        setFilteredVisits(transformedVisits);

        // Only set filter active if dates were actually used
        if (startDate || endDate) {
          setDateFilterActive(true);
        }

        Toast.show({
          type: 'info',
          text1: 'Working Offline',
          text2: `Showing ${transformedVisits.length} visits from local data`,
          visibilityTime: 2000,
        });
      } catch (dbError) {
        console.error('❌ Error loading from local DB:', dbError);
        Toast.show({
          type: 'error',
          text1: 'Failed to load visits',
          text2: 'No data available offline',
          visibilityTime: 2000,
        });
      }
    } finally {
      setLoadingVisits(false);
    }
  };

  // Load all visits when component mounts
  useEffect(() => {
    fetchVisitsWithDateFilter();
  }, []);

  const [routeCoords, setRouteCoords] = useState<number[][]>([]);

  const pagerRef = useRef<PagerView>(null);
  const flatListRef = useRef<FlatList<Shop>>(null);
  const cameraRef = useRef<CameraRef>(null);

  /** Mock coords near Faisalabad */
  const getMockCoords = (index: number): [number, number] => {
    const baseLng = 73.0551;
    const baseLat = 31.4181;
    return [baseLng + 0.01 * (index % 5), baseLat + 0.01 * (index % 5)];
  };

  const sortedShopList = shopList;
  // const sortedShopList = useMemo(() => {
  //   let filtered = [...shopList];

  //   // Filter out shops with empty names
  //   filtered = filtered.filter(shop => shop.name && shop.name.trim() !== '');

        
    
  //   // Filter by orders if needed - COMMENTED OUT FOR LIST VIEW
  //   // if (showOnlyWithOrders) {
  //   //   filtered = filtered.filter(shop => {
  //   //     const orders = shop.orders || [];
  //   //     return orders.length > 0;
  //   //   });
  //   // }

  //   // Sort by priority
  //   // const priority = (s: Shop) => (s.status === 'Pending' ? 0 : 1);
  //   // return filtered.sort((a, b) => {
  //   //   const pa = priority(a);
  //   //   const pb = priority(b);
  //   //   if (pa !== pb) return pa - pb;
  //   //   // optional secondary: most recently visited later
  //   //   return (a.name || '').localeCompare(b.name || '');
  //   });


  // }, [shopList]);

  // Computed list for Visit Shop section (uses API data)
  const visitShopList = useMemo(() => {
    if (!dateFilterActive) {
      return [];
    }

    let filtered = [...visitShops];

    // Filter by orders if needed
    if (showOnlyWithOrders) {
      filtered = filtered.filter(shop => {
        const orders = shop.orders || [];
        return orders.length > 0;
      });
    }

    return filtered;
  }, [visitShops, showOnlyWithOrders, dateFilterActive]);

  // Filter visits for the "Visit Shop" section based on orders
  const displayedVisits = useMemo(() => {
    let filtered = [...filteredVisits];

    // Filter by orders if needed
    if (showOnlyWithOrders) {
      filtered = filtered.filter(visit => {
        const orders = visit.orders || [];
        return orders.length > 0;
      });
    }

    return filtered;
  }, [filteredVisits, showOnlyWithOrders]);

  const getShopCoords = (
    shop: Shop | undefined,
    idx: number,
  ): [number, number] =>
    shop?.location
      ? [shop.location.lng, shop.location.lat]
      : getMockCoords(idx);

  const fetchRoute = async (start: number[], end: number[]) => {
    const url = `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json.routes && json.routes.length > 0) {
        return json.routes[0].geometry.coordinates as number[][];
      }
    } catch (e) {
      console.warn('Route fetch error:', e);
    }
    return [];
  };

  useEffect(() => {
    const buildRoute = async () => {
      const visited = shopList.filter(s => s.status === 'Visited');
      if (visited.length < 2) {
        setRouteCoords([]);
        return;
      }

      let allCoords: number[][] = [];
      for (let i = 0; i < visited.length - 1; i++) {
        const start = getShopCoords(visited[i], i);
        const end = getShopCoords(visited[i + 1], i + 1);
        const segment = await fetchRoute(start, end);
        allCoords = [...allCoords, ...segment];
      }
      setRouteCoords(allCoords);

      const last = visited[visited.length - 1];
      if (last) {
        const coords = getShopCoords(last, visited.length - 1);
        cameraRef.current?.setCamera({
          centerCoordinate: coords,
          zoomLevel: 15,
          animationDuration: 1200,
        });
      }
    };

    buildRoute();
  }, [shopList]);

  const routeGeoJSON = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: routeCoords,
        },
        properties: {},
      },
    ],
  };

  const todayShops = useMemo(() => {
    if (!filterToday) return shopList;
    // Use the selected map view date instead of always using today
    const selectedDate = mapViewDate.toDateString();
    return shopList.filter(
      s =>
        s.lastVisited &&
        new Date(s.lastVisited).toDateString() === selectedDate,
    );
  }, [shopList, filterToday, mapViewDate]);

  const handleMarkerPress = (index: number) => {
    setSelectedShopIndex(index);
    const shop = todayShops[index];
    if (shop) {
      flatListRef.current?.scrollToIndex({ index, animated: true });
      flyTo(shop, index);
    }
  };

  const flyTo = (shop: Shop, idx: number) => {
    const coords = getShopCoords(shop, idx);
    cameraRef.current?.setCamera({
      centerCoordinate: coords,
      zoomLevel: 15,
      animationDuration: 1200,
    });
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    if (newIndex !== selectedShopIndex) {
      setSelectedShopIndex(newIndex);
      const shop = todayShops[newIndex];
      if (shop) flyTo(shop, newIndex);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <HeaderBar title="Assigned Shops" showBack={true} />

      <View style={styles.tabRow}>
        {['List View', 'Visit Shops', 'Map View'].map((tab, idx) => {
          const isActive = activePage === idx;
          return (
            <Pressable
              key={tab}
              onPress={() => {
                pagerRef.current?.setPage(idx);
                setActivePage(idx);
              }}
              style={[styles.tabButton, isActive && styles.activeTabButton]}
            >
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={e => setActivePage(e.nativeEvent.position)}
      >
        {/* List View */}
        <View key="1">
          <Container>
            {shopList.length === 0 ? (
              <View style={styles.emptyBox}>
                <ValidText
                  text="No shop is assigned"
                  style={styles.emptyText}
                />
              </View>
            ) : (
              <>
                {/* Order Filter Button - COMMENTED OUT */}
                {/* <View style={styles.filterButtonContainer}>
                  <Button 
                    onPress={() => setShowOnlyWithOrders(!showOnlyWithOrders)} 
                    text={showOnlyWithOrders ? "Show All Shops" : "Show Shops with Orders"}
                    backgroundColor={showOnlyWithOrders ? Colors.green : Colors.primaryblue}
                    color={Colors.white}
                    width="90%"
                    height={45}
                    fontSize={FontSize.Button}
                  />
                </View> */}

                {/* Date Filter Section - COMMENTED OUT */}
                {/* <View style={styles.dateFilterContainer}>
                  <View style={styles.dateFilterHeader}>
                    <Text style={styles.dateFilterTitle}>Filter by Visit Date</Text>
                    {dateFilterActive && (
                      <TouchableOpacity 
                        onPress={() => {
                          setDateFilterActive(false);
                          setStartDate(null);
                          setEndDate(null);
                        }}
                        style={styles.clearFilterButton}
                      >
                        <Icon name="clear" size={18} color={Colors.white} />
                        <Text style={styles.clearFilterText}>Clear</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <View style={styles.datePickersRow}>
                    <View style={styles.datePickerItem}>
                      <Text style={styles.dateLabel}>From</Text>
                      <TouchableOpacity 
                        style={styles.dateButton}
                        onPress={() => setShowStartPicker(true)}
                      >
                        <Icon name="calendar-today" size={18} color={Colors.primaryblue} />
                        <Text style={styles.dateButtonText}>
                          {startDate ? startDate.toLocaleDateString() : 'Select'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.datePickerItem}>
                      <Text style={styles.dateLabel}>To</Text>
                      <TouchableOpacity 
                        style={styles.dateButton}
                        onPress={() => setShowEndPicker(true)}
                      >
                        <Icon name="calendar-today" size={18} color={Colors.primaryblue} />
                        <Text style={styles.dateButtonText}>
                          {endDate ? endDate.toLocaleDateString() : 'Select'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {(startDate || endDate) && (
                    <Button 
                      onPress={() => setDateFilterActive(true)} 
                      text="Apply Date Filter"
                      backgroundColor={dateFilterActive ? Colors.green : Colors.primaryblue}
                      color={Colors.white}
                      width="100%"
                      height={40}
                      fontSize={FontSize.Caption}
                    />
                  )}
                </View> */}

                {/* Empty state logic - updated to remove showOnlyWithOrders check */}
                {sortedShopList.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Icon name="store" size={64} color={Colors.grey} />
                    <ValidText
                      text="No shops available"
                      style={styles.emptyText}
                    />
                    <Text
                      style={{
                        color: Colors.grey,
                        fontSize: FontSize.Caption,
                        marginTop: 8,
                      }}
                    >
                      No shops are assigned to you
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={sortedShopList}
                    keyExtractor={item => String(item.id)}
                    renderItem={({ item }) => {
                      console.log(`[ShopCard Render] ${item.name}:`, {
                        status: item.status,
                        hasOrders: item.orders?.length || 0,
                        orders: item.orders,
                      });
                      return (
                        <View style={{ flex: 1, margin: 6 }}>
                          <ShopCard
                            shop={item}
                            onMarkVisited={async (id: string | number) => {
                              const now = new Date();
                              const shop = shopList.find(s => s.id === id);
                              try {
                                const visitId = await VisitService.createVisit({
                                  userId: 'current-user',
                                  shopId: String(id),
                                  allocationId:
                                    shop?.allocationId || `alloc-${id}`,
                                  date: now,
                                  status: 'completed',
                                });
                                await enqueueSync('visits', visitId, 'INSERT', {
                                  id: visitId,
                                  user_id: 'current-user',
                                  shop_id: String(id),
                                  visit_date: now.toISOString().slice(0, 10),
                                  status: 'completed',
                                });
                              } catch (e) {
                                // Even if DB write fails, still update UI so user flow continues
                              }

                              const updated = shopList.map(s =>
                                s.id === id
                                  ? {
                                      ...s,
                                      status: 'Visited' as const,
                                      lastVisited: now.toISOString(),
                                    }
                                  : s,
                              );
                              setShopList(updated);
                              onUpdate?.(updated);
                              Toast.show({
                                type: 'success',
                                text1: `${item.name} marked visited`,
                                visibilityTime: 1500,
                                position: 'top',
                              });
                            }}
                            onNewOrder={(id: string | number) => {
                              const shop = shopList.find(s => s.id === id);
                              if (shop) {
                                console.log('📝 Opening order form for shop:', {
                                  id,
                                  name: shop.name,
                                  visitId: shop.visitId,
                                  allocationId: shop.allocationId,
                                });

                                // Open order form - visitId already stored in shop if exists
                                setSelectedShop({
                                  id: String(id),
                                  name: shop.name,
                                  allocationId: shop.allocationId,
                                  visitId: shop.visitId, // Use stored visitId from today's visit
                                });
                                setOrderFormVisible(true);
                              }
                            }}
                            style={{ flex: 1 }}
                          />
                        </View>
                      );
                    }}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                  />
                )}
              </>
            )}
          </Container>
        </View>

        {/* visit shop */}
        <View key="2">
          <ScrollView style={{ flex: 1 }}>
            <Container>
              {shopList.length === 0 ? (
                <View style={styles.emptyBox}>
                  <ValidText
                    text="No shop is assigned"
                    style={styles.emptyText}
                  />
                </View>
              ) : (
                <>
                  {/* Order Filter Button */}
                  <View style={styles.filterButtonContainer}>
                    <Button
                      onPress={() => setShowOnlyWithOrders(!showOnlyWithOrders)}
                      text={
                        showOnlyWithOrders
                          ? 'Show All Visits'
                          : 'Show Visits with Orders'
                      }
                      backgroundColor={
                        showOnlyWithOrders ? Colors.green : Colors.primaryblue
                      }
                      color={Colors.white}
                      width="100%"
                      height={45}
                      fontSize={FontSize.Button}
                      elevation={2}
                    />
                  </View>

                  {/* Date Filter Section */}
                  <View style={styles.dateFilterContainer}>
                    <View style={styles.dateFilterHeader}>
                      <Text style={styles.dateFilterTitle}>
                        Filter by Visit Date
                      </Text>
                      {dateFilterActive && (
                        <TouchableOpacity
                          onPress={async () => {
                            // Clear dates and filter state
                            setStartDate(null);
                            setEndDate(null);
                            setDateFilterActive(false);
                            // Reload all visits
                            setLoadingVisits(true);
                            try {
                              // Sync from server to local database
                              const syncedCount =
                                await VisitSyncService.syncFromServer({
                                  limit: 1000,
                                });
                              console.log(
                                '✅ Synced',
                                syncedCount,
                                'visits after clear',
                              );

                              // Load from local database
                              const localVisits = await VisitService.getVisits({
                                limit: 1000,
                              });
                              const transformedVisits = localVisits.map(
                                (v: any) => ({
                                  _id: v.id,
                                  visitDateTime: v.visit_date,
                                  duration: 30,
                                  notes: v.notes || '',
                                  allocation: {
                                    _id: v.allocation_id,
                                    shop: {
                                      _id: v.shop_id,
                                      name:
                                        shopList.find(s => s.id === v.shop_id)
                                          ?.name || 'Unknown Shop',
                                      address:
                                        shopList.find(s => s.id === v.shop_id)
                                          ?.address || '',
                                    },
                                  },
                                  orders: [],
                                }),
                              );
                              setFilteredVisits(transformedVisits);

                              Toast.show({
                                type: 'success',
                                text1: 'Visits Reloaded',
                                text2: `Loaded ${transformedVisits.length} visits`,
                                visibilityTime: 2000,
                              });
                            } catch (error) {
                              console.error('❌ Error syncing visits:', error);
                              console.log(
                                '📱 Falling back to local database...',
                              );

                              // OFFLINE FALLBACK
                              try {
                                const localVisits =
                                  await VisitService.getVisits({
                                    limit: 1000,
                                  });
                                const transformedVisits = localVisits.map(
                                  (v: any) => ({
                                    _id: v.id,
                                    visitDateTime: v.visit_date,
                                    duration: 30,
                                    notes: v.notes || '',
                                    allocation: {
                                      _id: v.allocation_id,
                                      shop: {
                                        _id: v.shop_id,
                                        name:
                                          shopList.find(s => s.id === v.shop_id)
                                            ?.name || 'Unknown Shop',
                                        address:
                                          shopList.find(s => s.id === v.shop_id)
                                            ?.address || '',
                                      },
                                    },
                                    orders: [],
                                  }),
                                );
                                setFilteredVisits(transformedVisits);
                                Toast.show({
                                  type: 'info',
                                  text1: 'Working Offline',
                                  text2: `Showing ${transformedVisits.length} visits from local data`,
                                  visibilityTime: 2000,
                                });
                              } catch (dbError) {
                                console.error(
                                  '❌ Error loading from local DB:',
                                  dbError,
                                );
                                Toast.show({
                                  type: 'error',
                                  text1: 'Failed to reload visits',
                                  text2: 'No data available offline',
                                  visibilityTime: 2000,
                                });
                              }
                            } finally {
                              setLoadingVisits(false);
                            }
                          }}
                          style={styles.clearFilterButton}
                        >
                          <Icon name="clear" size={18} color={Colors.white} />
                          <Text style={styles.clearFilterText}>Clear</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.datePickersRow}>
                      {/* Start Date */}
                      <View style={styles.datePickerItem}>
                        <Text style={styles.dateLabel}>From</Text>
                        <TouchableOpacity
                          style={styles.dateButton}
                          onPress={() => setShowStartPicker(true)}
                        >
                          <Icon
                            name="calendar-today"
                            size={18}
                            color={Colors.primaryblue}
                          />
                          <Text style={styles.dateButtonText}>
                            {startDate
                              ? startDate.toLocaleDateString()
                              : 'Select'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* End Date */}
                      <View style={styles.datePickerItem}>
                        <Text style={styles.dateLabel}>To</Text>
                        <TouchableOpacity
                          style={styles.dateButton}
                          onPress={() => setShowEndPicker(true)}
                        >
                          <Icon
                            name="calendar-today"
                            size={18}
                            color={Colors.primaryblue}
                          />
                          <Text style={styles.dateButtonText}>
                            {endDate ? endDate.toLocaleDateString() : 'Select'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Apply Filter Button */}
                    {(startDate || endDate) && (
                      <Button
                        onPress={
                          loadingVisits ? undefined : fetchVisitsWithDateFilter
                        }
                        text={
                          loadingVisits ? 'Loading...' : 'Apply Date Filter'
                        }
                        backgroundColor={
                          loadingVisits ? Colors.grey : Colors.primaryblue
                        }
                        color={Colors.white}
                        width="100%"
                        height={40}
                        fontSize={FontSize.Caption}
                      />
                    )}
                  </View>

                  {/* Date Pickers */}
                  {showStartPicker && Platform.OS !== 'web' && (
                    <DateTimePicker
                      value={startDate || new Date()}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        // Handle Android (dismisses on selection or cancel)
                        if (Platform.OS === 'android') {
                          setShowStartPicker(false);
                        }

                        // Handle the selection
                        if (event.type === 'set' && selectedDate) {
                          setStartDate(selectedDate);
                          if (Platform.OS === 'ios') {
                            setShowStartPicker(false);
                          }
                        } else if (event.type === 'dismissed') {
                          setShowStartPicker(false);
                        }
                      }}
                    />
                  )}

                  {showEndPicker && Platform.OS !== 'web' && (
                    <DateTimePicker
                      value={endDate || new Date()}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        // Handle Android (dismisses on selection or cancel)
                        if (Platform.OS === 'android') {
                          setShowEndPicker(false);
                        }

                        // Handle the selection
                        if (event.type === 'set' && selectedDate) {
                          setEndDate(selectedDate);
                          if (Platform.OS === 'ios') {
                            setShowEndPicker(false);
                          }
                        } else if (event.type === 'dismissed') {
                          setShowEndPicker(false);
                        }
                      }}
                    />
                  )}

                  {/* Visit Count Header */}
                  {displayedVisits.length > 0 && (
                    <View style={styles.visitCountHeader}>
                      <Text style={styles.visitCountText}>
                        {showOnlyWithOrders
                          ? `${displayedVisits.length} visit(s) with orders`
                          : dateFilterActive
                          ? `${displayedVisits.length} visit(s) in selected date range`
                          : `All Visits (${displayedVisits.length})`}
                      </Text>
                    </View>
                  )}

                  {/* Display Visits as Cards */}
                  {loadingVisits ? (
                    <View style={styles.emptyBox}>
                      <Text
                        style={{ color: Colors.grey, fontSize: FontSize.Body }}
                      >
                        Loading visits...
                      </Text>
                    </View>
                  ) : displayedVisits.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Icon name="event-busy" size={64} color={Colors.grey} />
                      <ValidText
                        text={
                          showOnlyWithOrders
                            ? 'No visits with orders found'
                            : 'No visits found'
                        }
                        style={styles.emptyText}
                      />
                      <Text
                        style={{
                          color: Colors.grey,
                          fontSize: FontSize.Caption,
                          marginTop: 8,
                        }}
                      >
                        {showOnlyWithOrders
                          ? 'Submit orders to visits to see them here'
                          : dateFilterActive
                          ? 'Try adjusting your date range'
                          : 'Use the date filter above to view visits'}
                      </Text>
                    </View>
                  ) : (
                    <>
                      {displayedVisits.map(item => (
                        <TouchableOpacity
                          key={item._id}
                          style={styles.visitCard}
                          onPress={() => {
                            setSelectedVisit(item);
                            setVisitModalVisible(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.visitCardHeader}>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={styles.visitShopName}
                                numberOfLines={1}
                              >
                                {item?.allocation?.shop?.name || 'Unknown Shop'}
                              </Text>
                              <Text
                                style={styles.visitAddress}
                                numberOfLines={1}
                              >
                                {item?.allocation?.shop?.address ||
                                  'No address'}
                              </Text>
                            </View>
                            <Icon
                              name="chevron-right"
                              size={24}
                              color={Colors.primaryblue}
                            />
                          </View>

                          <View style={styles.visitCardBody}>
                            <View style={styles.visitInfoRow}>
                              <Icon
                                name="access-time"
                                size={16}
                                color={Colors.grey}
                              />
                              <Text style={styles.visitInfoText}>
                                {new Date(item.visitDateTime).toLocaleString()}
                              </Text>
                            </View>

                            {item.duration > 0 && (
                              <View style={styles.visitInfoRow}>
                                <Icon
                                  name="timer"
                                  size={16}
                                  color={Colors.grey}
                                />
                                <Text style={styles.visitInfoText}>
                                  {item.duration} minutes
                                </Text>
                              </View>
                            )}

                            <View style={styles.visitInfoRow}>
                              <Icon
                                name="shopping-cart"
                                size={16}
                                color={Colors.grey}
                              />
                              <Text style={styles.visitInfoText}>
                                {item.orders?.length || 0} order(s)
                              </Text>
                            </View>

                            {item.notes && (
                              <View style={styles.visitInfoRow}>
                                <Icon
                                  name="note"
                                  size={16}
                                  color={Colors.grey}
                                />
                                <Text
                                  style={styles.visitInfoText}
                                  numberOfLines={1}
                                >
                                  {item.notes}
                                </Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.visitCardActions}>
                            {item.orders && item.orders.length > 0 ? (
                              <TouchableOpacity
                                style={styles.viewOrderButton}
                                onPress={e => {
                                  e.stopPropagation();
                                  // Open modal to view orders
                                  setSelectedVisit(item);
                                  setVisitModalVisible(true);
                                }}
                              >
                                <Icon
                                  name="visibility"
                                  size={18}
                                  color={Colors.green}
                                />
                                <Text style={styles.viewOrderButtonText}>
                                  View Orders
                                </Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={styles.newOrderButton}
                                onPress={e => {
                                  e.stopPropagation();
                                  // Open order form for this visit
                                  const shop = item.allocation?.shop;
                                  const allocationId =
                                    item.allocation?._id || item.allocation;
                                  if (shop && allocationId) {
                                    console.log(
                                      '📝 Opening order form for visit:',
                                      {
                                        visitId: item._id,
                                        shopName: shop.name,
                                        allocationId: allocationId,
                                      },
                                    );
                                    setSelectedShop({
                                      id: shop._id,
                                      name: shop.name,
                                      allocationId: allocationId,
                                      visitId: item._id,
                                    });
                                    setOrderFormVisible(true);
                                  } else {
                                    Toast.show({
                                      type: 'error',
                                      text1: 'Cannot open order form',
                                      text2: 'Shop information is missing',
                                    });
                                  }
                                }}
                              >
                                <Icon
                                  name="add-shopping-cart"
                                  size={18}
                                  color={Colors.primaryblue}
                                />
                                <Text style={styles.newOrderButtonText}>
                                  New Order
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </>
              )}
            </Container>
          </ScrollView>
        </View>

        {/* Map View */}
        <View key="3" style={{ flex: 1 }}>
          {shopList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <ValidText
                text="No shop is assigned to display on map"
                style={styles.emptyText}
              />
            </View>
          ) : (
            <>
              {/* Date Filter for Map View */}
              <View style={styles.mapDateFilterContainer}>
                <TouchableOpacity
                  style={styles.mapDateButton}
                  onPress={() => setShowMapDatePicker(true)}
                >
                  <Icon name="calendar-today" size={20} color={Colors.white} />
                  <Text style={styles.mapDateButtonText}>
                    {mapViewDate.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.filterBtn}
                  onPress={() => setFilterToday(prev => !prev)}
                >
                  <Text style={styles.filterText}>
                    {filterToday
                      ? 'Show All Shops'
                      : `Show Visits for ${mapViewDate.toLocaleDateString()}`}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Date Picker */}
              {showMapDatePicker && (
                <DateTimePicker
                  value={mapViewDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowMapDatePicker(false);
                    if (event.type === 'set' && selectedDate) {
                      setMapViewDate(selectedDate);
                      // Auto-enable filter when date is selected
                      setFilterToday(true);
                    }
                  }}
                />
              )}

              {/* Show message when filter is active but no visits found */}
              {filterToday && todayShops.length === 0 && (
                <View style={styles.mapEmptyOverlay}>
                  <Icon name="event-busy" size={48} color={Colors.grey} />
                  <Text style={styles.mapEmptyText}>
                    No visits found for {mapViewDate.toLocaleDateString()}
                  </Text>
                  <Text style={styles.mapEmptySubText}>
                    Try selecting a different date or show all shops
                  </Text>
                </View>
              )}

              <MapView
                style={StyleSheet.absoluteFillObject}
                mapStyle="https://api.maptiler.com/maps/streets/style.json?key=d32QYUyZavtY6E2jfGra"
              >
                <Camera
                  ref={cameraRef}
                  zoomLevel={14}
                  centerCoordinate={getShopCoords(
                    todayShops[selectedShopIndex] ?? todayShops[0],
                    selectedShopIndex,
                  )}
                />

                {routeCoords.length > 0 && (
                  <ShapeSource id="routeSource" shape={routeGeoJSON}>
                    <LineLayer
                      id="routeLayer"
                      style={{ lineColor: Colors.primaryblue, lineWidth: 5 }}
                    />
                  </ShapeSource>
                )}

                {todayShops.map((shop, index) => {
                  const coords = getShopCoords(shop, index);
                  return (
                    <PointAnnotation
                      key={`${shop.id}-${shop.status}`}
                      id={String(shop.id)}
                      coordinate={coords}
                      onSelected={() => handleMarkerPress(index)}
                    >
                      <Icon
                        name="location-on"
                        size={34}
                        color={
                          shop.status === 'Visited' ? Colors.green : Colors.red
                        }
                      />
                    </PointAnnotation>
                  );
                })}
              </MapView>

              <View style={styles.shopCardContainer}>
                <FlatList
                  ref={flatListRef}
                  data={todayShops}
                  keyExtractor={item => String(item.id)}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => handleMarkerPress(index)}
                      style={styles.card}
                    >
                      <View style={styles.cardHeader}>
                        <ValidText
                          text={item.name}
                          style={styles.shopName}
                          numberOfLines={1}
                        />
                        {item.lastVisited && (
                          <ValidText
                            text={new Date(item.lastVisited).toLocaleString()}
                            style={styles.dateTime}
                            numberOfLines={1}
                          />
                        )}
                      </View>
                      {!!item.owner && (
                        <ValidText
                          text={item.owner}
                          style={styles.shopDetails}
                          numberOfLines={1}
                        />
                      )}
                      {!!item.phone && (
                        <ValidText
                          text={item.phone}
                          style={styles.shopDetails}
                          numberOfLines={1}
                        />
                      )}
                      <ValidText
                        text={item.address}
                        style={styles.shopDetails}
                        numberOfLines={2}
                      />
                    </TouchableOpacity>
                  )}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={width}
                  decelerationRate="fast"
                  onMomentumScrollEnd={onScrollEnd}
                />
              </View>
            </>
          )}
        </View>
      </PagerView>

      <Toast />

      {/* Visit Detail Modal */}
      <Modal
        visible={visitModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setVisitModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Visit Details</Text>
              <TouchableOpacity onPress={() => setVisitModalVisible(false)}>
                <Icon name="close" size={28} color={Colors.black} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              {selectedVisit && (
                <>
                  {/* Shop Information */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>
                      Shop Information
                    </Text>
                    <View style={styles.modalRow}>
                      <Icon name="store" size={20} color={Colors.primaryblue} />
                      <Text style={styles.modalLabel}>Name:</Text>
                      <Text style={styles.modalValue}>
                        {selectedVisit.allocation?.shop?.name || 'Unknown'}
                      </Text>
                    </View>
                    {selectedVisit.allocation?.shop?.address && (
                      <View style={styles.modalRow}>
                        <Icon
                          name="location-on"
                          size={20}
                          color={Colors.primaryblue}
                        />
                        <Text style={styles.modalLabel}>Address:</Text>
                        <Text style={styles.modalValue}>
                          {selectedVisit.allocation?.shop?.address}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Visit Information */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>
                      Visit Information
                    </Text>
                    <View style={styles.modalRow}>
                      <Icon name="event" size={20} color={Colors.primaryblue} />
                      <Text style={styles.modalLabel}>Date & Time:</Text>
                      <Text style={styles.modalValue}>
                        {new Date(selectedVisit.visitDateTime).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Icon name="timer" size={20} color={Colors.primaryblue} />
                      <Text style={styles.modalLabel}>Duration:</Text>
                      <Text style={styles.modalValue}>
                        {selectedVisit.duration || 0} minutes
                      </Text>
                    </View>
                    {selectedVisit.notes && (
                      <View style={styles.modalRow}>
                        <Icon
                          name="note"
                          size={20}
                          color={Colors.primaryblue}
                        />
                        <Text style={styles.modalLabel}>Notes:</Text>
                        <Text style={styles.modalValue}>
                          {selectedVisit.notes}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Orders */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>
                      Orders ({selectedVisit.orders?.length || 0})
                    </Text>
                    {selectedVisit.orders && selectedVisit.orders.length > 0 ? (
                      selectedVisit.orders.map((order: any, index: number) => (
                        <View key={index} style={styles.orderItem}>
                          <View style={styles.orderHeader}>
                            <Text style={styles.orderName}>{order.name}</Text>
                            <Text style={styles.orderQuantity}>
                              Qty: {order.quantity}
                            </Text>
                          </View>
                          <View style={styles.orderPricing}>
                            {order.price !== order.newPrice && (
                              <Text style={styles.oldPrice}>
                                ${order.price?.toFixed(2)}
                              </Text>
                            )}
                            <Text style={styles.newPrice}>
                              ${order.newPrice?.toFixed(2)}
                            </Text>
                          </View>
                          <View style={styles.orderPricing}>
                            <Text>Total Amount:</Text>
                            <Text style={styles.newPrice}>
                              ${order.newPrice * order.quantity}
                            </Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noOrdersText}>No orders placed</Text>
                    )}
                  </View>
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Grand Amount</Text>
                    <Text style={styles.orderName}>
                      {selectedVisit.orders.reduce(
                        (total: number, order: any) =>
                          total + order.newPrice * order.quantity,
                        0,
                      ) || 0}
                    </Text>
                  </View>

                  {/* Metadata */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>
                      Additional Info
                    </Text>
                    <View style={styles.modalRow}>
                      <Icon name="fingerprint" size={20} color={Colors.grey} />
                      <Text style={styles.modalLabel}>Visit ID:</Text>
                      <Text style={[styles.modalValue, { fontSize: 10 }]}>
                        {selectedVisit._id}
                      </Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Icon name="schedule" size={20} color={Colors.grey} />
                      <Text style={styles.modalLabel}>Created:</Text>
                      <Text style={styles.modalValue}>
                        {new Date(selectedVisit.createdAt).toLocaleString()}
                      </Text>
                    </View>
                    {selectedVisit.updatedAt !== selectedVisit.createdAt && (
                      <View style={styles.modalRow}>
                        <Icon name="update" size={20} color={Colors.grey} />
                        <Text style={styles.modalLabel}>Updated:</Text>
                        <Text style={styles.modalValue}>
                          {new Date(selectedVisit.updatedAt).toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                onPress={() => setVisitModalVisible(false)}
                text="Close"
                backgroundColor={Colors.primaryblue}
                color={Colors.white}
                width="100%"
                height={45}
                fontSize={FontSize.Button}
              />
            </View>
          </View>
        </View>
      </Modal>

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
              console.log('🔄 Refreshing visits data after order placement...');

              // Refresh the visits list for "Visit Shop" section
              await fetchVisitsWithDateFilter();

              // Mark shop as visited
              const updated = shopList.map(s =>
                s.id === selectedShop.id
                  ? {
                      ...s,
                      status: 'Visited' as const,
                      lastVisited: new Date().toISOString(),
                    }
                  : s,
              );
              setShopList(updated);
              onUpdate?.(updated);

              console.log('✅ Visits data refreshed successfully');
            } catch (error) {
              console.error('❌ Failed to refresh visits:', error);
              // Still update local state even if refresh fails
              const updated = shopList.map(s =>
                s.id === selectedShop.id
                  ? {
                      ...s,
                      status: 'Visited' as const,
                      lastVisited: new Date().toISOString(),
                    }
                  : s,
              );
              setShopList(updated);
              onUpdate?.(updated);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
};

export default withAuthGuard(ShopsScreen);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.offwhite },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    padding: 4,
    marginHorizontal: '5%',
    marginBottom: 12,
    borderRadius: 30,
    elevation: 2,
    marginTop: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 25,
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: Colors.primaryblue,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.grey,
  },
  activeTabText: {
    color: Colors.white,
    fontWeight: '700',
  },
  shopCardContainer: { position: 'absolute', bottom: 10 },
  mapDateFilterContainer: {
    position: 'absolute',
    top: 15,
    left: 15,
    right: 15,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  mapDateButton: {
    backgroundColor: Colors.primaryblue,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapDateButtonText: {
    color: Colors.white,
    fontSize: FontSize.Caption,
    fontWeight: '600',
  },
  filterBtn: {
    backgroundColor: Colors.primaryblue,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    flex: 1,
  },
  filterText: {
    color: Colors.white,
    fontSize: FontSize.Caption,
    fontWeight: '600',
    textAlign: 'center',
  },
  mapEmptyOverlay: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -50 }],
    backgroundColor: Colors.white,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    zIndex: 5,
    width: 200,
    elevation: 4,
  },
  mapEmptyText: {
    color: Colors.black,
    fontSize: FontSize.Body,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  mapEmptySubText: {
    color: Colors.grey,
    fontSize: FontSize.Caption,
    marginTop: 6,
    textAlign: 'center',
  },
  card: {
    width: width - 20,
    marginHorizontal: 10,
    backgroundColor: '#f7faff',
    borderLeftWidth: 6,
    borderLeftColor: Colors.primaryblue,
    padding: 10,
    borderRadius: 16,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  shopName: {
    fontSize: FontSize.H3,
    fontWeight: '700',
    color: Colors.primaryblue,
    flex: 1,
    marginRight: 10,
    flexShrink: 1,
  },
  dateTime: {
    fontSize: FontSize.Caption,
    color: Colors.white,
    backgroundColor: Colors.primaryblue,
    padding: 5,
    borderRadius: 10,
    maxWidth: '46%',
  },
  shopDetails: { fontSize: FontSize.Body, color: Colors.grey },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: FontSize.Body,
    color: Colors.grey,
    fontWeight: '600',
  },
  filterButtonContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    // paddingHorizontal: 16,
    backgroundColor: Colors.offwhite,
  },
  dateFilterContainer: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    // marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  dateFilterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateFilterTitle: {
    fontSize: FontSize.Body,
    fontWeight: '700',
    color: Colors.black,
  },
  clearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.red || '#ff4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  clearFilterText: {
    color: Colors.white,
    fontSize: FontSize.Caption,
    fontWeight: '600',
    marginLeft: 4,
  },
  datePickersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  datePickerItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  dateLabel: {
    fontSize: FontSize.Caption,
    color: Colors.grey,
    fontWeight: '600',
    marginBottom: 6,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7faff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primaryblue,
  },
  dateButtonText: {
    fontSize: FontSize.Caption,
    color: Colors.black,
    marginLeft: 8,
    fontWeight: '600',
  },
  // Visit Count Header
  visitCountHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f0f4ff',
    // marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primaryblue,
  },
  visitCountText: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.primaryblue,
  },
  // Visit Card Styles
  visitCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primaryblue,
  },
  visitCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  visitShopName: {
    fontSize: FontSize.H3,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 4,
  },
  visitAddress: {
    fontSize: FontSize.Caption,
    color: Colors.grey,
  },
  visitCardBody: {
    gap: 8,
  },
  visitInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  visitInfoText: {
    fontSize: FontSize.Body,
    color: Colors.grey,
    flex: 1,
  },
  visitCardActions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  newOrderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3f2fd',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  newOrderButtonText: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.primaryblue,
  },
  viewOrderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f5e9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  viewOrderButtonText: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.green,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: FontSize.H2,
    fontWeight: '700',
    color: Colors.black,
  },
  modalBody: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: FontSize.H3,
    fontWeight: '700',
    color: Colors.primaryblue,
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  modalLabel: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.grey,
    minWidth: 80,
  },
  modalValue: {
    fontSize: FontSize.Body,
    color: Colors.black,
    flex: 1,
  },
  orderItem: {
    backgroundColor: '#f7faff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.green,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  orderName: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.black,
    flex: 1,
  },
  orderQuantity: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.primaryblue,
  },
  orderPricing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  oldPrice: {
    fontSize: FontSize.Caption,
    color: Colors.grey,
    textDecorationLine: 'line-through',
  },
  newPrice: {
    fontSize: FontSize.Body,
    fontWeight: '700',
    color: Colors.green,
  },
  noOrdersText: {
    fontSize: FontSize.Body,
    color: Colors.grey,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
});
