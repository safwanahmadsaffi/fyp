import React, { useState, useRef, useMemo, useEffect } from 'react';

import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Text,
  Pressable,
  TouchableOpacity,
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
import { useWindowDimensions } from 'react-native';
import Container from '../Abstracts/Container';
import ValidText from '../Abstracts/ValidText';
import Button from '../Abstracts/Button';
import { Colors, FontSize } from '../Theme';
import { RootStackParamList } from '../types/navigation';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Shop } from '../types/shop';
import HeaderBar from '../Abstracts/HeaderBar';
import { withAuthGuard } from '../services/auth/withAuthGuard';
import NetInfo from '@react-native-community/netinfo';
import visitApiService, { VisitResponse } from '../services/visits/visitApiService';
import { ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';

type HistoryProps = NativeStackScreenProps<RootStackParamList, 'History'>;

const HistoryScreen: React.FC<HistoryProps> = ({ route, navigation }) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [visits, setVisits] = useState<VisitResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShopIndex, setSelectedShopIndex] = useState(0);
  const [filterToday, setFilterToday] = useState(false);
  const [activePage, setActivePage] = useState(0);
  const [routeCoords, setRouteCoords] = useState<number[][]>([]);
  const [online, setOnline] = useState<boolean>(true);
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [selectedShopOrders, setSelectedShopOrders] = useState<any>(null);

  const pagerRef = useRef<PagerView>(null);
  const flatListRef = useRef<FlatList<any>>(null);
  const cameraRef = useRef<CameraRef>(null);

  // Fetch visits from API
  useEffect(() => {
    const fetchVisits = async () => {
      try {
        setLoading(true);
        console.log(' [History] Fetching visits from API...');
        
        const response = await visitApiService.getMyVisits({ page: 1, limit: 100 });
        
        console.log(' [History] API Response:', response);
        
        if (response?.data?.visits) {
          const visitsList = response.data.visits;
          console.log(' [History] Loaded', visitsList.length, 'visits');
          setVisits(visitsList);
        } else {
          console.log(' [History] No visits found in response');
          setVisits([]);
        }
      } catch (error: any) {
        console.error(' [History] Failed to fetch visits:', error);
        Toast.show({
          type: 'error',
          text1: 'Failed to load visit history',
          text2: error?.message || 'Please try again',
        });
        setVisits([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVisits();
  }, []);

  /** Mock coordinates if no location available */
  const getMockCoords = (index: number): [number, number] => {
    const baseLng = 73.0551;
    const baseLat = 31.4181;
    return [baseLng + 0.01 * (index % 5), baseLat + 0.01 * (index % 5)];
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
      hour12: true,
    });
  };

  // Convert visits to shop-like format for display
  const visitedShops = useMemo(() => {
    return visits.map((visit) => ({
      id: visit._id,
      name: visit.allocation?.shop?.name || 'Unknown Shop',
      address: visit.allocation?.shop?.address || 'No address',
      owner: '', // Not provided in visit API
      phone: '', // Not provided in visit API
      location: visit.allocation?.shop?.location ? {
        lat: visit.allocation.shop.location.latitude,
        lng: visit.allocation.shop.location.longitude,
      } : undefined,
      status: 'Visited' as const,
      lastVisited: visit.visitDateTime,
      orders: visit.orders || [],
      notes: visit.notes || '',
      duration: visit.duration || 0,
    }));
  }, [visits]);

  const todayVisitedShops = useMemo(() => {
    if (!filterToday) return visitedShops;
    const today = new Date().toDateString();
    return visitedShops.filter(
      s => s.lastVisited && new Date(s.lastVisited).toDateString() === today,
    );
  }, [filterToday, visitedShops]);

  const getShopCoords = (shop: any, idx: number): [number, number] =>
    shop?.location ? [shop.location.lng, shop.location.lat] : getMockCoords(idx);

  const fetchRoute = async (start: number[], end: number[]) => {
    if (!online) return [] as number[][];
    const url = `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json.routes?.length > 0) {
        return json.routes[0].geometry.coordinates as number[][];
      }
    } catch (e) {
      console.warn('Route fetch error:', e);
    }
    return [];
  };

  useEffect(() => {
    const sub = NetInfo.addEventListener(state => {
      const isOn = !!state.isConnected && !!state.isInternetReachable;
      setOnline(isOn);
    });
    NetInfo.fetch().then(s => setOnline(!!s.isConnected && !!s.isInternetReachable)).catch(() => setOnline(false));
    return () => {
      try { sub && sub(); } catch {}
    };
  }, []);

  useEffect(() => {
    const buildRoute = async () => {
      if (todayVisitedShops.length < 2) {
        setRouteCoords([]);
        return;
      }

      let allCoords: number[][] = [];
      for (let i = 0; i < todayVisitedShops.length - 1; i++) {
        const start = getShopCoords(todayVisitedShops[i], i);
        const end = getShopCoords(todayVisitedShops[i + 1], i + 1);
        const segment = await fetchRoute(start, end);
        allCoords = [...allCoords, ...segment];
      }
      setRouteCoords(allCoords);
    };

    if (online) {
      buildRoute();
    } else {
      setRouteCoords([]);
    }
  }, [todayVisitedShops, online]);

  const flyTo = (shop: Shop, idx: number) => {
    const coords = getShopCoords(shop, idx);
    cameraRef.current?.setCamera({
      centerCoordinate: coords,
      zoomLevel: 15,
      animationDuration: 1200,
    });
  };

  const handleMarkerPress = (index: number) => {
    setSelectedShopIndex(index);
    const shop = todayVisitedShops[index];
    if (shop) {
      flatListRef.current?.scrollToIndex({ index, animated: true });
      flyTo(shop, index);
    }
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    if (newIndex !== selectedShopIndex) {
      setSelectedShopIndex(newIndex);
      const shop = todayVisitedShops[newIndex];
      if (shop) flyTo(shop, newIndex);
    }
  };

  const handleShopCardPress = (item: any, index: number) => {
    console.log('📦 [History] Shop clicked:', item.name);
    console.log('📦 [History] Orders:', item.orders);
    
    setSelectedShopOrders({
      shopName: item.name,
      shopAddress: item.address,
      visitDate: item.lastVisited,
      orders: item.orders || [],
      notes: item.notes || '',
    });
    setOrderModalVisible(true);
  };

  // List view card rendering
  const renderListCard = ({ item, index }: { item: Shop; index: number }) => (
    <TouchableOpacity
      style={styles.listCard}
      activeOpacity={0.9}
      onPress={() => handleShopCardPress(item, index)}
    >
      <View style={styles.cardHeader}>
        <ValidText text={item.name} style={styles.shopName} numberOfLines={1} />
        {item.lastVisited && (
          <ValidText
            text={formatDate(item.lastVisited)}
            style={styles.dateTime}
            numberOfLines={1}
          />
        )}
      </View>
      {item.owner && (
        <ValidText text={item.owner} style={styles.shopDetails} numberOfLines={1} />
      )}
      {item.phone && (
        <ValidText text={item.phone} style={styles.shopDetails} numberOfLines={1} />
      )}
      <Text 
        style={styles.shopDetails} 
        numberOfLines={1} 
        ellipsizeMode="tail"
      >
        {item.address}
      </Text>
      
      {/* Order count badge */}
      {item.orders && item.orders.length > 0 && (
        <View style={styles.orderBadge}>
          <Icon name="shopping-cart" size={14} color={Colors.white} />
          <Text style={styles.orderBadgeText}>{item.orders.length} {item.orders.length === 1 ? 'Order' : 'Orders'}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Map view card rendering (for bottom carousel)
  const renderShopCard = ({ item, index }: { item: Shop; index: number }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => handleShopCardPress(item, index)}
    >
      <View style={styles.cardHeader}>
        <ValidText text={item.name} style={styles.shopName} numberOfLines={1} />
        {item.lastVisited && (
          <ValidText
            text={formatDate(item.lastVisited)}
            style={styles.dateTime}
            numberOfLines={1}
          />
        )}
      </View>
      {item.owner && (
        <ValidText text={item.owner} style={styles.shopDetails} numberOfLines={1} />
      )}
      {item.phone && (
        <ValidText text={item.phone} style={styles.shopDetails} numberOfLines={1} />
      )}
      <Text 
        style={styles.shopDetails} 
        numberOfLines={1} 
        ellipsizeMode="tail"
      >
        {item.address}
      </Text>
      
      {/* Order count badge */}
      {item.orders && item.orders.length > 0 && (
        <View style={styles.orderBadge}>
          <Icon name="shopping-cart" size={14} color={Colors.white} />
          <Text style={styles.orderBadgeText}>{item.orders.length} {item.orders.length === 1 ? 'Order' : 'Orders'}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Reusable HeaderBar */}
      <HeaderBar title="History" showBack={true} />

      <View style={styles.tabRow}>
        {['List View', 'Map View'].map((tab, idx) => {
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
        <View key="1">
          <Container>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primaryblue} />
                <Text style={styles.loadingText}>Loading visit history...</Text>
              </View>
            ) : visitedShops.length === 0 ? (
              <View style={styles.emptyContainer}>
                <ValidText
                  text="No Shop is Visited Yet"
                  style={styles.emptyText}
                />
              </View>
            ) : (
              <>
                <FlatList
                  data={visitedShops}
                  keyExtractor={item => item.id}
                  renderItem={({ item, index }) => (
                    <View style={{ marginVertical: 6, marginHorizontal: 16 }}>
                      {renderListCard({ item, index })}
                    </View>
                  )}
                  contentContainerStyle={{ paddingBottom: 20 }}
                  showsVerticalScrollIndicator={false}
                />
                <View style={styles.checkinButtonContainer}>
                  <Button
                    text="Check-in History"
                    onPress={() => navigation.navigate('CheckinHistory')}
                    backgroundColor={Colors.primaryblue}
                    color={Colors.white}
                    width="90%"
                    height={48}
                    borderRadius={12}
                    fontSize={FontSize.Button}
                    elevation={3}
                  />
                </View>
              </>
            )}
          </Container>
        </View>

        <View key="2" style={{ flex: 1 }}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primaryblue} />
              <Text style={styles.loadingText}>Loading map...</Text>
            </View>
          ) : visitedShops.length === 0 ? (
            <View style={styles.emptyContainer}>
              <ValidText
                text="No Shop is Visited to Display on Map"
                style={styles.emptyText}
              />
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.filterBtn}
                onPress={() => setFilterToday(prev => !prev)}
              >
                <Text style={styles.filterText}>
                  {filterToday ? 'Show All Shops' : 'Show Today’s Shops'}
                </Text>
              </TouchableOpacity>

              {online && (
                <MapView
                  style={StyleSheet.absoluteFillObject}
                  mapStyle="https://api.maptiler.com/maps/streets/style.json?key=d32QYUyZavtY6E2jfGra"
                >
                  <Camera
                    ref={cameraRef}
                    zoomLevel={14}
                    centerCoordinate={getShopCoords(
                      todayVisitedShops[selectedShopIndex] ?? todayVisitedShops[0],
                      selectedShopIndex,
                    )}
                  />

                  {routeCoords.length > 0 && (
                    <ShapeSource id="routeSource" shape={routeGeoJSON}>
                      <LineLayer
                        id="routeLayer"
                        style={{
                          lineColor: Colors.primaryblue,
                          lineWidth: 5,
                        }}
                      />
                    </ShapeSource>
                  )}

                  {todayVisitedShops.map((shop, index) => {
                    const coords = getShopCoords(shop, index);
                    const isSelected = selectedShopIndex === index;

                    let markerColor = Colors.grey;
                    if (shop.status === 'Visited') markerColor = Colors.green;
                    if (isSelected) markerColor = Colors.red;

                    return (
                      <PointAnnotation
                        key={`${shop.id}-${shop.status}-${isSelected}`}
                        id={`${shop.id}-${index}`}
                        coordinate={coords}
                        onSelected={() => handleMarkerPress(index)}
                      >
                        <View
                          style={{
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon
                            name="location-on"
                            size={34}
                            color={markerColor}
                          />
                        </View>
                      </PointAnnotation>
                    );
                  })}
                </MapView>
              )}

              {todayVisitedShops.length > 0 && (
                <View style={styles.shopCardContainer}>
                  <FlatList
                    ref={flatListRef}
                    data={todayVisitedShops}
                    keyExtractor={item => item.id}
                    renderItem={renderShopCard}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={width}
                    decelerationRate="fast"
                    onMomentumScrollEnd={onScrollEnd}
                  />
                </View>
              )}
            </>
          )}
        </View>
      </PagerView>

      {/* Orders Modal */}
      <Modal
        visible={orderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOrderModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <ValidText text={selectedShopOrders?.shopName || 'Shop Orders'} style={styles.modalTitle} />
                <Text style={styles.modalSubtitle}>
                  {selectedShopOrders?.visitDate ? formatDate(selectedShopOrders.visitDate) : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setOrderModalVisible(false)}
                style={styles.closeIcon}
              >
                <Icon name="close" size={22} color={Colors.grey} />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Shop Address */}
              <View style={styles.modalSection}>
                <Icon name="location-on" size={18} color={Colors.primaryblue} />
                <Text style={styles.modalSectionText}>
                  {selectedShopOrders?.shopAddress || 'No address'}
                </Text>
              </View>

              {/* Orders List */}
              <View style={styles.ordersSection}>
                <Text style={styles.sectionTitle}>
                  Orders ({selectedShopOrders?.orders?.length || 0})
                </Text>
                
                {selectedShopOrders?.orders && selectedShopOrders.orders.length > 0 ? (
                  selectedShopOrders.orders.map((order: any, idx: number) => (
                    <View key={order._id || order.id || idx} style={styles.orderItem}>
                      <View style={styles.orderHeader}>
                        <Text style={styles.orderName}>{order.name}</Text>
                        <Text style={styles.orderQuantity}>Qty: {order.quantity}</Text>
                      </View>
                      
                      <View style={styles.orderPriceRow}>
                        <View style={styles.priceItem}>
                          <Text style={styles.priceLabel}>Current Price:</Text>
                          <Text style={styles.priceValue}>Rs. {order.price}</Text>
                        </View>
                        <View style={styles.priceItem}>
                          <Text style={styles.priceLabel}>New Price:</Text>
                          <Text style={[styles.priceValue, order.newPrice !== order.price && styles.highlightPrice]}>
                            Rs. {order.newPrice}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.orderTotal}>
                        <Text style={styles.totalLabel}>Total:</Text>
                        <Text style={styles.totalValue}>
                          Rs. {(order.newPrice * order.quantity).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyOrders}>
                    <Icon name="shopping-cart" size={48} color={Colors.grey} />
                    <Text style={styles.emptyOrdersText}>No orders placed</Text>
                  </View>
                )}
              </View>

              {/* Notes Section */}
              {selectedShopOrders?.notes && (
                <View style={styles.notesSection}>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  <Text style={styles.notesText}>{selectedShopOrders.notes}</Text>
                </View>
              )}

              {/* Grand Total */}
              {selectedShopOrders?.orders && selectedShopOrders.orders.length > 0 && (
                <View style={styles.grandTotalSection}>
                  <Text style={styles.grandTotalLabel}>Grand Total</Text>
                  <Text style={styles.grandTotalValue}>
                    Rs. {selectedShopOrders.orders.reduce(
                      (sum: number, order: any) => sum + (order.newPrice * order.quantity),
                      0
                    ).toFixed(2)}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalActionsRow}>
              <Button
                text="Close"
                onPress={() => setOrderModalVisible(false)}
                backgroundColor="#faf3ff"
                color={Colors.primaryblue}
                width="100%"
                height={42}
                borderRadius={10}
                fontSize={FontSize.Button}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Toast />
    </SafeAreaView>
  );
};

export default withAuthGuard(HistoryScreen);

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    //  backgroundColor: Colors.offwhite
  },

  backBtn: { marginRight: 10 },
  topBarTitle: {
    fontSize: FontSize.H2,
    fontWeight: '700',
    color: Colors.black,
  },

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

  filterBtn: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 10,
    backgroundColor: Colors.primaryblue,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  filterText: {
    color: Colors.white,
    fontSize: FontSize.Caption,
    fontWeight: '600',
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
    height: 140,
  },
  listCard: {
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
  shopDetails: { 
    fontSize: FontSize.Body, 
    color: Colors.grey,
    marginBottom: 4,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  checkinButtonContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  emptyText: {
    fontSize: FontSize.H3,
    fontWeight: '600',
    color: Colors.grey,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.grey,
    marginTop: 12,
  },

  // Order badge on card
  orderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryblue,
    paddingHorizontal: 8,
    paddingVertical:4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  orderBadgeText: {
    color: Colors.white,
    fontSize: FontSize.Caption,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    width: '100%',
    maxHeight: '95%',
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  closeIcon: {
    marginLeft: 'auto',
  },
  modalTitle: {
    fontSize: FontSize.H3,
    fontWeight: '700',
    color: Colors.black,
  },
  modalSubtitle: {
    fontSize: FontSize.Caption,
    color: Colors.grey,
    marginTop: 4,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxHeight: 400,
  },
  modalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalSectionText: {
    fontSize: FontSize.Body,
    color: Colors.grey,
    marginLeft: 8,
    flex: 1,
  },

  // Orders section
  ordersSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: FontSize.H3,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 12,
  },
  orderItem: {
    backgroundColor: '#f7faff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primaryblue,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderName: {
    fontSize: FontSize.Body,
    fontWeight: '700',
    color: Colors.black,
    flex: 1,
  },
  orderQuantity: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.primaryblue,
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  orderPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceItem: {
    flex: 1,
  },
  priceLabel: {
    fontSize: FontSize.Caption,
    color: Colors.grey,
    marginBottom: 2,
  },
  priceValue: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.black,
  },
  highlightPrice: {
    color: Colors.green,
  },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalLabel: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.grey,
  },
  totalValue: {
    fontSize: FontSize.H3,
    fontWeight: '700',
    color: Colors.primaryblue,
  },

  // Empty orders
  emptyOrders: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyOrdersText: {
    fontSize: FontSize.Body,
    color: Colors.grey,
    marginTop: 12,
  },

  // Notes section
  notesSection: {
    marginTop: 16,
    backgroundColor: '#fffbf0',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ffa500',
  },
  notesText: {
    fontSize: FontSize.Body,
    color: Colors.grey,
    lineHeight: 20,
  },

  // Grand total
  grandTotalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: Colors.primaryblue,
    padding: 16,
    borderRadius: 12,
  },
  grandTotalLabel: {
    fontSize: FontSize.H3,
    fontWeight: '700',
    color: Colors.white,
  },
  grandTotalValue: {
    fontSize: FontSize.H2,
    fontWeight: '700',
    color: Colors.white,
  },

  // Modal footer
  modalActionsRow: {
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
});