// screens/ProfilePage.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  ScrollView,
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
  StatusBar,
  SafeAreaView,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Input from '../Abstracts/TextInputs';
import Button from '../Abstracts/Button';
import Container from '../Abstracts/Container';
import DateTimePicker from '@react-native-community/datetimepicker';
import { launchImageLibrary } from 'react-native-image-picker';
import Toast from 'react-native-toast-message';
import { Colors, FontSize } from '../Theme';
import { useNavigation } from '@react-navigation/native';
import ValidText from '../Abstracts/ValidText';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import HeaderBar from '../Abstracts/HeaderBar';
import { AllocationService, ShopAllocationView } from '../services/allocations/AllocationService';
import { AuthStorageService } from '../services/auth/AuthStorageService';
import { withAuthGuard } from '../services/auth/withAuthGuard';
import attendService from '../services/attendance/attendService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationTracker } from '../services/tracking/LocationTracker';
import unAuthService from '../services/auth/unAuthService';

type ProfilePageNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Profile'
>;

const ProfilePage: React.FC = () => {
  const navigation = useNavigation<ProfilePageNavigationProp>();
  const { width } = useWindowDimensions();

  const [editMode, setEditMode] = useState(false);
  const [profilePic, setProfilePic] = useState(
    'https://randomuser.me/api/portraits/men/1.jpg',
  );
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState(new Date('1990-01-01'));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [allocations, setAllocations] = useState<ShopAllocationView[]>([]);
  const [selectedFile, setSelectedFile] = useState<
    | { uri: string; name: string; type: string }
    | undefined
  >();
  const [initialPic, setInitialPic] = useState<string>('');
  const [showEmailHover, setShowEmailHover] = useState(false);

  const pickImage = useCallback(() => {
    launchImageLibrary({ mediaType: 'photo' }, response => {
      const asset = response.assets && response.assets[0];
      if (asset?.uri) {
        setProfilePic(asset.uri);
        const name = asset.fileName || asset.uri.split('/').pop() || 'avatar.jpg';
        const type = asset.type || 'image/jpeg';
        setSelectedFile({ uri: asset.uri, name, type });
      }
    });
  }, []);

  const validateForm = useCallback(() => {
    if (!userName.trim()) {
      Toast.show({ type: 'error', text1: 'Full Name is required' });
      return false;
    }
    const phoneRegex = /^\+?\d{7,15}$/;
    if (!phone.trim() || !phoneRegex.test(phone)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Phone Number',
        text2: 'Enter a valid format like +923001234567',
      });
      return false;
    }
    return true;
  }, [userName, phone]);

  const toggleEditSave = useCallback(async () => {
    if (editMode) {
      if (!validateForm()) return;
      try {
        const payload: any = { name: userName, phone };
        // Only send file if changed
        if (selectedFile && profilePic !== initialPic) {
          payload.file = selectedFile;
        }
        const updated = await unAuthService.updateProfile(payload);
        const user = updated?.data?.user || updated?.user || updated;
        if (user) {
          setUserName(user.name || userName);
          setEmail(user.email || email);
          setPhone(user.phone || phone);
          const pic = user.avatar?.url || user.photo?.url || user.image || user.avatar || profilePic;
          setProfilePic(pic);
          setInitialPic(pic);
          setSelectedFile(undefined);
        }
        Toast.show({ type: 'success', text1: 'Profile saved' });
      } catch (e) {
        Toast.show({ type: 'error', text1: 'Failed to save profile' });
        return; // don't exit edit mode on failure
      }
    }
    setEditMode(prev => !prev);
  }, [editMode, validateForm, userName, phone, selectedFile, profilePic, initialPic, email]);

  const onChangeDate = useCallback((event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (!selectedDate) return;
    }
    if (selectedDate) setDob(selectedDate);
  }, []);

  const formatDate = useCallback(
    (date: Date) =>
      date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [],
  );

  const middleTruncate = useCallback((text: string, max: number = 28) => {
    if (!text) return '';
    if (text.length <= max) return text;
    const keep = Math.max(6, Math.floor((max - 3) / 2));
    return `${text.slice(0, keep)}...${text.slice(-keep)}`;
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Profile
        const prof = await unAuthService.getProfile();
        const user = prof?.data?.user || prof?.user || prof;
        if (user) {
          setUserName(user.name || '');
          setEmail(user.email || '');
          setPhone(user.phone || '');
          const pic = user.avatar?.url || user.photo?.url || user.image || user.avatar || profilePic;
          setProfilePic(pic);
          setInitialPic(pic);
        }
      } catch {}
      try {
        const rows = await AllocationService.getUserAllocations('current-user');
        setAllocations(rows);
      } catch {}
    };
    loadData();
  }, []);

  // 🔹 Field Renderer
  const renderField = useCallback(
    (
      label: string,
      value: string | Date,
      setter?: (val: string) => void,
      isDate?: boolean,
      iconName?: string,
      editable: boolean = true,
    ) => {
      const displayValue = isDate
        ? formatDate(value as Date)
        : (value as string);
      const canEdit = editMode && editable;

      return (
        <View style={styles.fieldWrapper} key={label}>
          <ValidText text={label} style={styles.label} />

          {isDate ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => canEdit && setShowDatePicker(true)}
            >
              <Input
                value={displayValue}
                setValue={undefined}
                placeholder={label}
                editable={false}
                backgroundColor={Colors.offwhite}
                borderRadius={12}
                fontSize={FontSize.Body}
                paddingHorizontal={iconName ? 40 : 14}
                style={styles.input}
              />
              {iconName && (
                <Icon
                  name={iconName}
                  size={20}
                  color={Colors.grey}
                  style={styles.inputIcon}
                />
              )}
            </TouchableOpacity>
          ) : (
            label === 'Email' ? (
              <TouchableOpacity activeOpacity={0.8} onPress={() => setShowEmailHover(v => !v)}>
                <Input
                  value={middleTruncate(String(value || ''))}
                  setValue={undefined}
                  placeholder={label}
                  editable={false}
                  backgroundColor={Colors.offwhite}
                  borderRadius={12}
                  fontSize={FontSize.Body}
                  paddingHorizontal={iconName ? 40 : 14}
                  keyboardType={'email-address'}
                  autoCapitalize={'none'}
                  autoCorrect={false}
                  textContentType={'emailAddress'}
                  autoComplete={'email'}
                  textAlign={'left'}
                  style={styles.input}
                />
                {iconName && (
                  <Icon
                    name={iconName}
                    size={20}
                    color={Colors.grey}
                    style={styles.inputIcon}
                  />
                )}
              </TouchableOpacity>
            ) : (
              <View>
                <Input
                  value={displayValue}
                  setValue={canEdit && setter ? setter : undefined}
                  placeholder={label}
                  editable={canEdit}
                  backgroundColor={Colors.offwhite}
                  borderRadius={12}
                  fontSize={FontSize.Body}
                  paddingHorizontal={iconName ? 40 : 14}
                  keyboardType={label === 'Email' ? 'email-address' : undefined}
                  autoCapitalize={label === 'Email' ? 'none' as const : undefined}
                  autoCorrect={label === 'Email' ? false : undefined}
                  scrollEnabled={label === 'Email' ? true : undefined}
                  selectTextOnFocus={label === 'Email' ? true : undefined}
                  textContentType={label === 'Email' ? 'emailAddress' : undefined}
                  autoComplete={label === 'Email' ? 'email' : undefined}
                  textAlign={'left'}
                  style={styles.input}
                />
                {iconName && (
                  <Icon
                    name={iconName}
                    size={20}
                    color={Colors.grey}
                    style={styles.inputIcon}
                  />
                )}
              </View>
            )
          )}
        </View>
      );
    },
    [editMode, formatDate],
  );
  const renderReadOnlyField = useCallback(
    (label: string, value: string) => (
      <View style={styles.fieldWrapper}>
        <ValidText text={label} style={styles.label} />
        <View style={styles.readonlyBox}>
          <ValidText text={value} style={styles.readonlyText} />
        </View>
      </View>
    ),
    [],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Container style={styles.container}>
        <HeaderBar title="Profile" showBack={true} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Pic */}
          {/* <View style={styles.profilePicContainer}>
            <Image source={{ uri: profilePic }} style={styles.profilePic} />
            {editMode && (
              <TouchableOpacity
                style={styles.cameraOverlay}
                onPress={pickImage}
              >
                <Icon name="camera-alt" size={20} color={Colors.white} />
              </TouchableOpacity>
            )}
          </View> */}

          <View style={styles.contentWrapper}>
            <ValidText text="Personal Info" style={styles.sectionTitle} />

            {renderField('Full Name', userName, setUserName, false, 'person')}
            {renderField(
              'Email',
              email || '',
              undefined,
              false,
              'email',
              false,
            )}
            {renderField('Phone Number', phone, setPhone, false, 'phone')}
            {renderField(
              'Date of Birth',
              dob,
              undefined,
              true,
              'calendar-today',
            )}

            <ValidText text="Work Info" style={styles.sectionTitle} />
            <View style={styles.workRow}>
              {/* <View style={styles.workCol}>
                {renderReadOnlyField('Employee Number', 'EMP 1235')}
              </View> */}
              <View style={styles.workCol}>
                {renderReadOnlyField('Date of Joining', 'Jun 1, 2023')}
              </View>
            </View>

            <View style={styles.buttonsRow}>
              <Button
                text={editMode ? 'Save Changes' : 'Edit Profile'}
                width="100%"
                backgroundColor={editMode ? Colors.primaryblue : Colors.green}
                color={Colors.white}
                fontSize={FontSize.Button}
                paddingVertical={12}
                borderRadius={10}
                onPress={toggleEditSave}
                style={styles.primaryButton}
                TextIcon={() => (
                  <Icon
                    name={editMode ? 'save' : 'edit'}
                    size={20}
                    color={Colors.white}
                  />
                )}
              />
              <Button
                text="Change Password"
                width="100%"
                backgroundColor={Colors.orange}
                color={Colors.white}
                fontSize={FontSize.Button}
                paddingVertical={12}
                borderRadius={10}
                onPress={() => navigation.navigate('ChangePassword')}
                style={[styles.primaryButton, { marginTop: 10 }]}
                TextIcon={() => (
                  <Icon name="lock" size={20} color={Colors.white} />
                )}
              />
              <Button
                text="Logout"
                width="100%"
                backgroundColor={Colors.orange}
                color={Colors.white}
                fontSize={FontSize.Button}
                paddingVertical={12}
                borderRadius={10}
                onPress={async () => {
                  try {
                    // determine active check-in id
                    let id = await AsyncStorage.getItem('active_attendance_id');
                    if (!id) {
                      try {
                        const resp = await attendService.getMyCheckIns();
                        const list = (resp?.data?.checkIns || resp?.checkIns || []) as any[];
                        const sorted = Array.isArray(list)
                          ? [...list].sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime())
                          : [];
                        const latest = sorted[0];
                        if (latest && (latest.checkOutTime === null || latest.checkOutTime === undefined)) {
                          id = latest._id || latest.id || null as any;
                        }
                      } catch {}
                    }
                    if (id) {
                      try { await attendService.checkOut(id); } catch {}
                    }
                  } finally {
                    try { LocationTracker.stop(); } catch {}
                    try { await AsyncStorage.removeItem('active_attendance_id'); } catch {}
                    try { await AsyncStorage.removeItem('latest_checkin'); } catch {}
                    await AuthStorageService.getInstance().clearAuthData();
                    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                  }
                }}
                style={[styles.primaryButton, { marginTop: 10 }]}
                TextIcon={() => (
                  <Icon name="logout" size={20} color={Colors.white} />
                )}
              />
            </View>

            {/* Allocated Shops */}
            {/* <ValidText text="Allocated Shops" style={styles.sectionTitle} /> */}
            {Object.entries(AllocationService.groupByFrequency(allocations)).map(([freq, items]) => (
              <View key={freq} style={{ marginBottom: 12 }}>
                <ValidText text={`${freq.toUpperCase()} (${items.length})`} style={styles.subSectionTitle} />
                {items.map(item => (
                  <View key={item.id} style={styles.allocCard}>
                    <ValidText text={item.shop_name} style={styles.allocTitle} />
                    <ValidText text={item.address} style={styles.allocAddress} />
                    {!!item.assigned_days && (
                      <ValidText
                        text={`Days: ${AllocationService.getAssignedDaysLabel(item.assigned_days)}`}
                        style={styles.allocDays}
                      />
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={dob}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onChangeDate}
              maximumDate={new Date()}
            />
          )}
        </ScrollView>

        <Toast />
      </Container>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.offwhite, flex: 1 },
  safe: { flex: 1, paddingTop: StatusBar.currentHeight ?? 0 },

  scrollContent: { padding: 20, alignItems: 'center' },

  profilePicContainer: {
    alignSelf: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  profilePic: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: Colors.primaryblue,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: Colors.primaryblue,
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: Colors.white,
  },

  contentWrapper: { width: '100%', maxWidth: 700 },

  sectionTitle: {
    fontSize: FontSize.H2,
    fontWeight: '600',
    color: Colors.primaryblue,
    marginBottom: 10,
    textAlign: 'center',
  },
  subSectionTitle: {
    fontSize: FontSize.H3,
    fontWeight: '600',
    color: Colors.black,
    marginTop: 6,
    marginBottom: 6,
  },
  readonlyBox: {
    minHeight: 47,
    justifyContent: 'center',
    paddingVertical: 0,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Colors.offwhite,
    borderWidth: 1,
    borderColor: Colors.grey,
  },
  readonlyText: {
    fontSize: FontSize.Body,
    color: Colors.black,
    lineHeight: 20,
  },

  fieldWrapper: { marginBottom: 4, },
  label: { fontSize: FontSize.Body, color: Colors.grey, marginBottom: 6 },

  input: { height: 48, paddingVertical: 0, color: Colors.black, width:'100%' },
  inputIcon: { position: 'absolute', left: 12, top: 14 },

  workRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: '4%',
    marginBottom: '3%',
  },
  workCol: {
    flex: 1,
  },

  buttonsRow: { marginTop: 0 },
  primaryButton: { alignSelf: 'center', width: '100%' },
  allocCard: {
    backgroundColor: Colors.offwhite,
    borderWidth: 1,
    borderColor: Colors.grey,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  allocTitle: { fontSize: FontSize.H4, color: Colors.black, marginBottom: 2 },
  allocAddress: { fontSize: FontSize.Body, color: Colors.grey, marginBottom: 4 },
  allocDays: { fontSize: FontSize.Small, color: Colors.black },
});

export default withAuthGuard(ProfilePage);
