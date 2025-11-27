import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import HeaderBar from '../Abstracts/HeaderBar';
import Container from '../Abstracts/Container';
import ValidText from '../Abstracts/ValidText';
import { Colors, FontSize } from '../Theme';
import Icon from 'react-native-vector-icons/MaterialIcons';
import attendService from '../services/attendance/attendService';
import trackService from '../services/tracking/trackService';
import { withAuthGuard } from '../services/auth/withAuthGuard';
import Toast from 'react-native-toast-message';
import { MapView, Camera, ShapeSource, CircleLayer, LineLayer, SymbolLayer } from '@maplibre/maplibre-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

type CheckinHistoryProps = NativeStackScreenProps<RootStackParamList, 'CheckinHistory'>;

interface CheckIn {
  _id: string;
  userId: string;
  checkInTime: string;
  checkOutTime?: string;
  checkInNotes?: string;
  durationMs?: number;
  createdAt: string;
  updatedAt: string;
}

const CheckinHistoryScreen: React.FC<CheckinHistoryProps> = ({ navigation }) => {
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCheckin, setSelectedCheckin] = useState<CheckIn | null>(null);
  const [trackingData, setTrackingData] = useState<any[]>([]);
  const [loadingTracking, setLoadingTracking] = useState(false);
  
  // Date filter states
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const fetchCheckins = async () => {
    try {
      const response = await attendService.getMyCheckIns(startDate, endDate);
      console.log('[CheckinHistory] Fetched check-ins:', response);
      console.log('[CheckinHistory] Response data:', response?.data);
      console.log('[CheckinHistory] Response source:', response?.source);
      
      // Handle both online and offline responses
      // API returns checkIns (capital I) not checkins
      if (response?.checkIns) {
        console.log('[CheckinHistory] Setting checkIns from response.checkIns:', response.checkIns.length);
        setCheckins(response.checkIns);
      } else if (response?.data?.checkIns) {
        console.log('[CheckinHistory] Setting checkIns from response.data.checkIns:', response.data.checkIns.length);
        setCheckins(response.data.checkIns);
      } else if (response?.data?.checkins) {
        console.log('[CheckinHistory] Setting checkIns from response.data.checkins:', response.data.checkins.length);
        setCheckins(response.data.checkins);
      } else if (Array.isArray(response?.data)) {
        console.log('[CheckinHistory] Setting checkIns from response.data array:', response.data.length);
        setCheckins(response.data);
      } else {
        console.log('[CheckinHistory] No check-ins found in response');
        setCheckins([]);
      }
      
      // Show toast if data is from local storage
      if (response?.source === 'local') {
        Toast.show({
          type: 'info',
          text1: 'Offline Mode',
          text2: 'Showing locally stored check-ins',
          position: 'top',
          visibilityTime: 2000,
        });
      } else if (response?.source === 'error') {
        // Only show error if we have no data at all
        if (!response?.checkIns || response.checkIns.length === 0) {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: response?.error || 'Failed to fetch check-in history',
            position: 'top',
          });
        }
      }
    } catch (error: any) {
      console.error('[CheckinHistory] Error fetching check-ins:', error);
      // Don't show error toast - service should handle gracefully
      setCheckins([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCheckins();
  }, [startDate, endDate]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCheckins();
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Select Date';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateDuration = (checkInTime: string, checkOutTime?: string) => {
    if (!checkOutTime) return null;
    
    const checkIn = new Date(checkInTime).getTime();
    const checkOut = new Date(checkOutTime).getTime();
    const durationMs = checkOut - checkIn;
    
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const fetchTracking = async (checkin: CheckIn) => {
    setLoadingTracking(true);
    try {
      const response = await trackService.getMyTrackings({
        startDate: checkin.checkInTime,
        endDate: checkin.checkOutTime || new Date().toISOString(),
      });
      
      console.log('[CheckinHistory] Tracking data:', response);
      
      if (response?.data?.trackings) {
        setTrackingData(response.data.trackings);
      } else if (Array.isArray(response?.data)) {
        setTrackingData(response.data);
      } else {
        setTrackingData([]);
      }
    } catch (error: any) {
      console.error('[CheckinHistory] Error fetching tracking:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to fetch tracking data',
        position: 'top',
      });
      setTrackingData([]);
    } finally {
      setLoadingTracking(false);
    }
  };

  const handleCardPress = async (checkin: CheckIn) => {
    setSelectedCheckin(checkin);
    setModalVisible(true);
    await fetchTracking(checkin);
  };

  const renderCheckInCard = ({ item }: { item: CheckIn }) => {
    const isCheckedOut = !!item.checkOutTime;
    
    return (
      <TouchableOpacity
        onPress={() => handleCardPress(item)}
        activeOpacity={0.7}
      >
        <Container
          style={[styles.card, isCheckedOut ? styles.completedCard : styles.activeCard]}
          paddingHorizontal={16}
          paddingVertical={16}
        >
        {/* Header with status */}
        <View style={styles.cardHeader}>
          <View style={styles.statusBadge}>
            <Icon 
              name={isCheckedOut ? 'check-circle' : 'access-time'} 
              size={16} 
              color={isCheckedOut ? Colors.green : Colors.primaryblue} 
            />
            <Text style={[styles.statusText, { color: isCheckedOut ? Colors.green : Colors.primaryblue }]}>
              {isCheckedOut ? 'Completed' : 'Active'}
            </Text>
          </View>
          {item.checkOutTime && (
            <Text style={styles.durationText}>
              {calculateDuration(item.checkInTime, item.checkOutTime)}
            </Text>
          )}
        </View>

        {/* Check-in Time */}
        <View style={styles.timeRow}>
          <Icon name="login" size={18} color={Colors.primaryblue} />
          <View style={styles.timeContent}>
            <Text style={styles.timeLabel}>Check-in</Text>
            <Text style={styles.timeValue}>{formatDateTime(item.checkInTime)}</Text>
          </View>
        </View>

        {/* Check-out Time */}
        {item.checkOutTime && (
          <View style={styles.timeRow}>
            <Icon name="logout" size={18} color={Colors.green} />
            <View style={styles.timeContent}>
              <Text style={styles.timeLabel}>Check-out</Text>
              <Text style={styles.timeValue}>{formatDateTime(item.checkOutTime)}</Text>
            </View>
          </View>
        )}

        {/* Notes */}
        {item.checkInNotes && (
          <View style={styles.notesContainer}>
            <Icon name="note" size={16} color={Colors.grey} />
            <Text style={styles.notesText}>{item.checkInNotes}</Text>
          </View>
        )}
      </Container>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <HeaderBar
        title="Check-in History"
        showBack={true}
      />

      {/* Date Filter Section */}
      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowStartPicker(true)}
          >
            <Icon name="event" size={20} color={Colors.primaryblue} />
            <View style={styles.dateTextContainer}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <Text style={styles.dateValue}>{formatDate(startDate)}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowEndPicker(true)}
          >
            <Icon name="event" size={20} color={Colors.primaryblue} />
            <View style={styles.dateTextContainer}>
              <Text style={styles.dateLabel}>End Date</Text>
              <Text style={styles.dateValue}>{formatDate(endDate)}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {(startDate || endDate) && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearFilters}
          >
            <Icon name="clear" size={18} color={Colors.white} />
            <Text style={styles.clearButtonText}>Clear Filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={startDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleStartDateChange}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleEndDateChange}
        />
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primaryblue} />
          <Text style={styles.loadingText}>Loading check-in history...</Text>
        </View>
      ) : checkins.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="history" size={64} color={Colors.grey} />
          <ValidText text="No check-in history found" style={styles.emptyText} />
          <Text style={styles.emptySubtext}>Your check-in records will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={checkins}
          keyExtractor={(item) => item._id}
          renderItem={renderCheckInCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primaryblue]}
            />
          }
        />
      )}

      {/* Tracking Map Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Tracking Map</Text>
                {selectedCheckin && (
                  <Text style={styles.modalSubtitle}>
                    {formatDateTime(selectedCheckin.checkInTime)}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} color={Colors.grey} />
              </TouchableOpacity>
            </View>

            {/* Map Content */}
            {loadingTracking ? (
              <View style={styles.loadingMapContainer}>
                <ActivityIndicator size="large" color={Colors.primaryblue} />
                <Text style={styles.loadingText}>Loading tracking data...</Text>
              </View>
            ) : trackingData.length === 0 ? (
              <View style={styles.emptyMapContainer}>
                <Icon name="location-off" size={64} color={Colors.grey} />
                <Text style={styles.emptyText}>No tracking data available</Text>
              </View>
            ) : (
              <MapView
                style={styles.map}
                mapStyle="https://api.maptiler.com/maps/streets/style.json?key=d32QYUyZavtY6E2jfGra"
              >
                <Camera
                  zoomLevel={12}
                  centerCoordinate={[
                    trackingData[0]?.location?.longitude || 73.0479,
                    trackingData[0]?.location?.latitude || 31.4504,
                  ]}
                  animationDuration={1000}
                />

                {/* Tracking Line */}
                <ShapeSource
                  id="trackingLineSource"
                  shape={{
                    type: 'Feature',
                    properties: {},
                    geometry: {
                      type: 'LineString',
                      coordinates: trackingData.map((point: any) => [
                        point.location?.longitude || 0,
                        point.location?.latitude || 0,
                      ]),
                    },
                  }}
                >
                  <LineLayer
                    id="trackingLine"
                    style={{
                      lineColor: Colors.primaryblue,
                      lineWidth: 3,
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                  />
                </ShapeSource>

                {/* Tracking Points with Numbers */}
                <ShapeSource
                  id="trackingPointsSource"
                  shape={{
                    type: 'FeatureCollection',
                    features: trackingData.map((point: any, index: number) => ({
                      type: 'Feature',
                      geometry: {
                        type: 'Point',
                        coordinates: [
                          point.location?.longitude || 0,
                          point.location?.latitude || 0,
                        ],
                      },
                      properties: { 
                        number: index + 1,
                        title: `${index + 1}`,
                      },
                    })),
                  }}
                >
                  <CircleLayer
                    id="pointCircles"
                    style={{
                      circleRadius: 12,
                      circleColor: Colors.primaryblue,
                      circleStrokeWidth: 3,
                      circleStrokeColor: Colors.white,
                    }}
                  />
                  <SymbolLayer
                    id="pointNumbers"
                    style={{
                      textField: ['get', 'title'],
                      textSize: 12,
                      textColor: Colors.white,
                      textHaloColor: Colors.primaryblue,
                      textHaloWidth: 1,
                    }}
                  />
                </ShapeSource>
              </MapView>
            )}

            {/* Tracking Stats */}
            {!loadingTracking && trackingData.length > 0 && (
              <View style={styles.trackingStats}>
                <View style={styles.statItem}>
                  <Icon name="location-on" size={20} color={Colors.primaryblue} />
                  <Text style={styles.statText}>{trackingData.length} Points</Text>
                </View>
                {selectedCheckin?.checkOutTime && (
                  <View style={styles.statItem}>
                    <Icon name="schedule" size={20} color={Colors.green} />
                    <Text style={styles.statText}>
                      {calculateDuration(selectedCheckin.checkInTime, selectedCheckin.checkOutTime)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Toast />
    </SafeAreaView>
  );
};

export default withAuthGuard(CheckinHistoryScreen);

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.offwhite,
  },
  filterContainer: {
    backgroundColor: Colors.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.offwhite,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  dateLabel: {
    fontSize: FontSize.Caption,
    color: Colors.grey,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: FontSize.Body,
    color: Colors.black,
    fontWeight: '600',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryblue,
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  clearButtonText: {
    color: Colors.white,
    fontSize: FontSize.Body,
    fontWeight: '600',
    marginLeft: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: FontSize.Body,
    color: Colors.grey,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: FontSize.H3,
    fontWeight: '600',
    color: Colors.grey,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: FontSize.Body,
    color: Colors.grey,
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  card: {
    borderRadius: 14,
    marginBottom: 12,
    elevation: 3,
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  completedCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.green,
  },
  activeCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primaryblue,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: FontSize.Caption,
    fontWeight: '700',
    marginLeft: 4,
  },
  durationText: {
    fontSize: FontSize.Body,
    fontWeight: '700',
    color: Colors.primaryblue,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeContent: {
    marginLeft: 12,
    flex: 1,
  },
  timeLabel: {
    fontSize: FontSize.Caption,
    color: Colors.grey,
    marginBottom: 2,
  },
  timeValue: {
    fontSize: FontSize.Body,
    color: Colors.black,
    fontWeight: '600',
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  notesText: {
    fontSize: FontSize.Body,
    color: Colors.grey,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.95,
    height: height * 0.85,
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: FontSize.H2,
    fontWeight: '700',
    color: Colors.black,
  },
  modalSubtitle: {
    fontSize: FontSize.Caption,
    color: Colors.grey,
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  loadingMapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    flex: 1,
  },
  trackingStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.black,
    marginLeft: 8,
  },
});
