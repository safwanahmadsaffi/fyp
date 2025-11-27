import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Modal,
  Platform,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import Toast from 'react-native-toast-message';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import ValidText from '../Abstracts/ValidText';
import Button from '../Abstracts/Button';
import Input from '../Abstracts/TextInputs';
import Container from '../Abstracts/Container';
import { Colors, FontSize } from '../Theme';
import { RootStackParamList } from '../types/navigation';
import { Leave } from '../types/leaves';
import HeaderBar from '../Abstracts/HeaderBar';

type LeavesRouteParams = {
  leaves?: Leave[];
  onUpdate?: (leaves: Leave[]) => void;
};

type LeavesProps = NativeStackScreenProps<RootStackParamList, 'Leaves'> & {
  route: { params: LeavesRouteParams };
};

const TOTAL_QUOTA = 12;

const useLeaveStats = (leaves: Leave[]) => {
  return useMemo(() => {
    const approved = leaves.filter(l => l.status === 'Approved').length;
    const pending = leaves.filter(l => l.status === 'Pending').length;
    const remaining = TOTAL_QUOTA - (approved + pending);
    return { approved, pending, remaining };
  }, [leaves]);
};

const LeavesScreen: React.FC<LeavesProps> = ({ navigation, route }) => {
  const initialLeaves: Leave[] = route.params?.leaves || [];

  useEffect(() => {
    if (route.params?.leaves) {
      setLeaves(route.params.leaves);
    } else {
      setLeaves([
        {
          id: '1',
          startDate: '2025-09-15',
          endDate: '2025-09-16',
          reason: 'Medical Appointment',
          type: 'Sick Leave',
          status: 'Approved',
        },
        {
          id: '2',
          startDate: '2025-09-20',
          endDate: '2025-09-21',
          reason: 'Family Event',
          type: 'Casual Leave',
          status: 'Pending',
        },
      ]);
    }
  }, [route.params?.leaves]);

  const [leaves, setLeaves] = useState<Leave[]>(initialLeaves);
  const [modalVisible, setModalVisible] = useState(false);
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [pickerMode, setPickerMode] = useState<'start' | 'end' | null>(null);
  const [leaveType, setLeaveType] = useState('');

  const { approved, pending, remaining } = useLeaveStats(leaves);

  const openDatePicker = useCallback((mode: 'start' | 'end') => {
    setPickerMode(mode);
  }, []);

  const formatDate = useCallback(
    (date: Date) =>
      new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date),
    [],
  );

  const onDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (!selectedDate) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Date',
          text2: 'You cannot select a past date.',
        });
        return;
      }

      if (pickerMode === 'start') {
        setStartDate(selectedDate);
        if (endDate && selectedDate > endDate) {
          setEndDate(null);
          Toast.show({
            type: 'info',
            text1: 'End Date Reset',
            text2: 'End date must be after start date.',
          });
        }
      } else if (pickerMode === 'end') {
        if (startDate && selectedDate < startDate) {
          Toast.show({
            type: 'error',
            text1: 'Invalid Range',
            text2: 'End date cannot be before start date.',
          });
          return;
        }
        setEndDate(selectedDate);
      }

      if (Platform.OS === 'android') setPickerMode(null);
    },
    [pickerMode, startDate, endDate],
  );

  const onUpdate = route.params?.onUpdate;

  const applyLeave = useCallback(() => {
    if (!reason || !startDate || !endDate || !leaveType) {
      Toast.show({
        type: 'error',
        text1: 'Missing Information',
        text2: 'Please fill all fields before submitting.',
      });
      return;
    }

    const newLeave: Leave = {
      id: Date.now().toString(),
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      reason,
      type: leaveType,
      status: 'Pending',
    };

    const updatedLeaves = [...leaves, newLeave];
    setLeaves(updatedLeaves);
    if (onUpdate) onUpdate(updatedLeaves);

    setModalVisible(false);
    setReason('');
    setStartDate(null);
    setEndDate(null);
    setLeaveType('');

    Toast.show({
      type: 'success',
      text1: 'Leave Applied',
      text2: 'Your leave request has been submitted.',
    });
  }, [reason, startDate, endDate, leaveType, formatDate, leaves, onUpdate]);

  const renderLeave = useCallback(
    ({ item }: { item: Leave }) => (
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <ValidText
            text={`${item.startDate} → ${item.endDate}`}
            style={styles.date}
          />
          <View style={[styles.badge, getBadgeStyle(item.status)]}>
            <ValidText text={item.status} style={styles.badgeText} />
          </View>
        </View>
        <ValidText text={item.type} style={styles.type} />
        <ValidText text={item.reason} style={styles.reason} />
      </View>
    ),
    [],
  );

  const ListHeader = useCallback(
    () => (
      <View style={styles.statsRow}>
        <StatCard label="Approved" value={approved} color={Colors.green} />
        <StatCard label="Pending" value={pending} color={Colors.orange} />
        <StatCard label="Remaining" value={remaining} color={Colors.red} />
      </View>
    ),
    [approved, pending, remaining],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.offwhite }}>
      <Container>
        <HeaderBar title="Leave" showBack={true} />

        {/* Leave List */}
        <FlatList
          data={leaves}
          keyExtractor={item => item.id}
          renderItem={renderLeave}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={
            <ValidText
              text="No leave records found."
              style={{ textAlign: 'center', marginTop: 40, color: Colors.grey }}
            />
          }
        />

        {/* Fixed Bottom Button */}
        <View style={styles.bottomButtonWrapper}>
          <Button
            text="Apply for Leave"
            onPress={() => setModalVisible(true)}
            backgroundColor={Colors.primaryblue}
            width="100%"
          />
        </View>

        {/* Modal */}
        <Modal visible={modalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <FlatList
              data={[{}]}
              keyExtractor={(_, idx) => idx.toString()}
              contentContainerStyle={{
                alignItems: 'center',
                paddingVertical: 20,
              }}
              renderItem={() => (
                <View style={styles.modalCard}>
                  <View style={styles.modalHeader}>
                    <ValidText
                      text="Apply for Leave"
                      style={styles.modalTitle}
                    />
                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                      <Icon name="close" size={22} color={Colors.grey} />
                    </TouchableOpacity>
                  </View>

                  {/* Start & End Dates */}
                  <View style={styles.row}>
                    <View
                      style={[styles.fieldWrapper, { flex: 1, marginRight: 6 }]}
                    >
                      <ValidText text="Start Date" style={styles.label} />
                      <TouchableOpacity
                        style={styles.inputWrapper}
                        onPress={() => openDatePicker('start')}
                      >
                        <Icon
                          name="calendar-today"
                          size={20}
                          color={Colors.grey}
                          style={styles.inputIcon}
                        />
                        <Input
                          value={startDate ? formatDate(startDate) : ''}
                          placeholder="Start Date"
                          backgroundColor={Colors.offwhite}
                          borderRadius={12}
                          fontSize={FontSize.Body}
                          paddingHorizontal={28}
                          editable={false}
                          width="100%"
                        />
                      </TouchableOpacity>
                    </View>

                    <View
                      style={[styles.fieldWrapper, { flex: 1, marginLeft: 6 }]}
                    >
                      <ValidText text="End Date" style={styles.label} />
                      <TouchableOpacity
                        style={styles.inputWrapper}
                        onPress={() => openDatePicker('end')}
                      >
                        <Icon
                          name="calendar-today"
                          size={20}
                          color={Colors.grey}
                          style={styles.inputIcon}
                        />
                        <Input
                          value={endDate ? formatDate(endDate) : ''}
                          placeholder="End Date"
                          backgroundColor={Colors.offwhite}
                          borderRadius={12}
                          fontSize={FontSize.Body}
                          paddingHorizontal={28}
                          editable={false}
                          width="100%"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Leave Type */}
                  <View style={styles.fieldWrapper}>
                    <ValidText text="Leave Type" style={styles.label} />

                    <View style={styles.pickerContainer}>
                      {/* Icon */}
                      <Icon
                        name="category"
                        size={20}
                        color={Colors.grey}
                        style={styles.pickerIcon}
                      />

                      {/* Wrapper for padding */}
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={leaveType}
                          onValueChange={val => setLeaveType(val)}
                          style={styles.picker}
                          dropdownIconColor={Colors.grey}
                        >
                          <Picker.Item label="Select leave type" value="" />
                          <Picker.Item label="Sick Leave" value="Sick Leave" />
                          <Picker.Item
                            label="Casual Leave"
                            value="Casual Leave"
                          />
                          <Picker.Item
                            label="Annual Leave"
                            value="Annual Leave"
                          />
                          <Picker.Item label="Other" value="Other" />
                        </Picker>
                      </View>
                    </View>
                  </View>

                  {/* Reason */}
                  <View style={styles.fieldWrapper}>
                    <ValidText text="Reason" style={styles.label} />
                    <View style={styles.inputWrapper}>
                      <Icon
                        name="edit"
                        size={20}
                        color={Colors.grey}
                        style={styles.inputIcon}
                      />
                      <Input
                        value={reason}
                        setValue={setReason}
                        placeholder="Reason for leave"
                        backgroundColor={Colors.offwhite}
                        borderRadius={12}
                        fontSize={FontSize.Body}
                        paddingHorizontal={50}
                        width="100%"
                        multiline={true}
                        numberOfLines={4}
                        textAlignVertical="top"
                      />
                    </View>
                  </View>

                  {/* Buttons */}
                  <View style={styles.actionsRow}>
                    <Button
                      text="Cancel"
                      onPress={() => setModalVisible(false)}
                      backgroundColor={Colors.grey}
                      width="48%"
                    />
                    <Button
                      text="Submit"
                      onPress={applyLeave}
                      backgroundColor={Colors.primaryblue}
                      width="48%"
                    />
                  </View>
                </View>
              )}
            />
          </View>
        </Modal>

        {/* Date Picker */}
        {pickerMode && (
          <DateTimePicker
            value={new Date()}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}

        <Toast topOffset={60} />
      </Container>
    </SafeAreaView>
  );
};

const StatCard = ({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) => (
  <View style={[styles.statCard, { backgroundColor: color }]}>
    <ValidText text={label} style={styles.statLabel} />
    <ValidText text={String(value)} style={styles.statValue} />
  </View>
);

const getBadgeStyle = (status: string) => {
  switch (status) {
    case 'Approved':
      return { backgroundColor: Colors.green };
    case 'Rejected':
      return { backgroundColor: Colors.red };
    default:
      return { backgroundColor: Colors.orange };
  }
};

const { width } = Dimensions.get('window');
const cardWidth = width / 4 - 12;

const styles = StyleSheet.create({
  

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 15,
    gap: 40,
  },
  statCard: {
    width: cardWidth,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    elevation: 3,
  },
  statLabel: { color: Colors.white, fontSize: 12 },
  statValue: { color: Colors.white, fontSize: 18, fontWeight: '700' },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#f3faf5',
    borderLeftWidth: 6,
    borderLeftColor: Colors.green,
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
  },
  date: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.black,
    marginRight: 12,
  },
  type: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.green,
    marginTop: 6,
  },
  reason: { fontSize: FontSize.Body, color: Colors.grey, marginTop: 4 },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20 },
  badgeText: { color: Colors.white, fontWeight: '600' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    elevation: 6,
    marginTop: 200,
  },

  row: { flexDirection: 'row', justifyContent: 'space-between' },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: FontSize.H2, fontWeight: '700', color: Colors.black },

  fieldWrapper: { marginBottom: 12 },
  label: { fontSize: FontSize.Body, color: Colors.grey, marginBottom: 4 },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
    minHeight: 45,
  },
  inputIcon: { position: 'absolute', left: 12, zIndex: 1 },
  pickerWrapper: {
    flex: 1,
    paddingLeft: 36,
  },

  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.grey,
    borderRadius: 12,
    backgroundColor: Colors.offwhite,
    height: 55,
    position: 'relative',
  },

  pickerIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },

  picker: {
    flex: 1,
    color: Colors.black,
  },

  bottomButtonWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: Colors.offwhite,
    borderTopWidth: 1,
    borderTopColor: Colors.grey,
  },
});

export default LeavesScreen;
