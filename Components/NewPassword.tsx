import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import Container from '../Abstracts/Container';
import Input from '../Abstracts/TextInputs';
import Button from '../Abstracts/Button';
import ValidText from '../Abstracts/ValidText';
import HeaderBar from '../Abstracts/HeaderBar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, FontSize } from '../Theme';

interface Props {
  navigation: any;
}

const ChangePassword: React.FC<Props> = ({ navigation }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSavePassword = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('Please fill all fields');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and Confirm password do not match');
      return;
    }
    setError('');
    console.log('Password changed successfully');
    navigation.goBack();
  };

  return (
    <Container style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <HeaderBar title="Change Password" showBack={true} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Change Password</Text>
              <Text style={styles.subtitle}>
                Please enter your old password and set a new one
              </Text>
            </View>

            {/* Card */}
            <View style={styles.card}>
              <View style={styles.inputContainer}>
                <Input
                  placeholder="Old Password"
                  value={oldPassword}
                  setValue={setOldPassword}
                  secureTextEntry={!showOld}
                  borderRadius={12}
                  color={Colors.black}
                  placeholderTextColor={Colors.grey}
                  Tailing_icon={() => (
                    <TouchableOpacity onPress={() => setShowOld(!showOld)}>
                      <Icon
                        name={showOld ? 'eye-off-outline' : 'eye-outline'}
                        size={22}
                        color={Colors.grey}
                      />
                    </TouchableOpacity>
                  )}
                />

                <Input
                  placeholder="New Password"
                  value={newPassword}
                  setValue={setNewPassword}
                  secureTextEntry={!showNew}
                  borderRadius={12}
                  color={Colors.black}
                  placeholderTextColor={Colors.grey}
                  Tailing_icon={() => (
                    <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                      <Icon
                        name={showNew ? 'eye-off-outline' : 'eye-outline'}
                        size={22}
                        color={Colors.grey}
                      />
                    </TouchableOpacity>
                  )}
                />

                <Input
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  setValue={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                  borderRadius={12}
                  color={Colors.black}
                  placeholderTextColor={Colors.grey}
                  Tailing_icon={() => (
                    <TouchableOpacity
                      onPress={() => setShowConfirm(!showConfirm)}
                    >
                      <Icon
                        name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                        size={22}
                        color={Colors.grey}
                      />
                    </TouchableOpacity>
                  )}
                />

                {error ? (
                  <ValidText text={error} style={styles.errorText} />
                ) : null}
              </View>

              <Button
                text="Save Password"
                onPress={handleSavePassword}
                backgroundColor={Colors.primaryblue}
                borderRadius={10}
                fontSize={FontSize.Button * 1.1}
                style={styles.saveButton}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: Colors.primaryblue,
  },
  safe: {
    flex: 1,
    paddingTop: StatusBar.currentHeight
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: FontSize.H1,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.Body,
    color: Colors.offwhite,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    marginBottom: 10,
    alignItems: 'center',
    width: '110%',
  },
  errorText: {
    color: Colors.orange,
    marginTop: 5,
    fontSize: FontSize.Caption,
    textAlign: 'center',
  },
  saveButton: {
    marginTop: 10,
    height: 48,
    width: '100%',
    justifyContent: 'center',
  },
});

export default ChangePassword;
