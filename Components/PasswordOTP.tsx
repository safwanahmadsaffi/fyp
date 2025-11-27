import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import Container from '../Abstracts/Container';
import Input from '../Abstracts/TextInputs';
import Button from '../Abstracts/Button';
import ValidText from '../Abstracts/ValidText';
import { Colors, FontSize } from '../Theme';
import HeaderBar from '../Abstracts/HeaderBar';

interface Props {
  navigation: any;
  route: any;
}

const ForgotPasswordOTP: React.FC<Props> = ({ navigation, route }) => {
  const email = route?.params?.email ?? '';

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  const handleVerifyOTP = () => {
    if (!otp) {
      setError('Please enter the OTP');
      return;
    }
    if (otp.length !== 6) {
      setError('OTP must be 6 digits');
      return;
    }
    setError('');
    navigation.navigate('ForgotPasswordNewPassword', { email });
  };

  return (
    <Container style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <HeaderBar title="OTP" showBack={true} />

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
              <Text style={styles.title}>Verify OTP</Text>
              <Text style={styles.subtitle}>
                Enter the OTP sent to{' '}
                <Text style={styles.highlight}>{email || 'your email'}</Text>
              </Text>
            </View>

            {/* Card */}
            <View style={styles.card}>
              <View style={styles.inputContainer}>
                <Input
                  placeholder="Enter OTP"
                  value={otp}
                  setValue={setOtp}
                  keyboardType="numeric"
                  borderRadius={12}
                  color={Colors.black}
                  placeholderTextColor={Colors.grey}
                />
                {error ? <ValidText text={error} style={styles.errorText} /> : null}
              </View>

              <Button
                text="Verify OTP"
                onPress={handleVerifyOTP}
                backgroundColor={Colors.primaryblue}
                borderRadius={10}
                fontSize={FontSize.Button * 1.1}
                style={styles.verifyButton}
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
    backgroundColor: Colors.primaryblue,
  },
  safe: {
    flex: 1,
    paddingTop: StatusBar.currentHeight,
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
  highlight: {
    fontWeight: '600',
    color: Colors.white,
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
  verifyButton: {
    marginTop: 10,
    height: 48,
    width: '100%',
    justifyContent: 'center',
  },
});

export default ForgotPasswordOTP;
