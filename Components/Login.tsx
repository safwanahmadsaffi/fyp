import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Container from '../Abstracts/Container';
import Input from '../Abstracts/TextInputs';
import Button from '../Abstracts/Button';
import ValidText from '../Abstracts/ValidText';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, FontSize } from '../Theme'; // ✅ import HeaderBar
import { AuthStorageService } from '../services/auth/AuthStorageService';
import unAuthService from '../services/auth/unAuthService';
const { width } = Dimensions.get('window');

interface Props {
  navigation: any;
}

const Login: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const authService = AuthStorageService.getInstance();

  useEffect(() => {
    const checkAuth = async () => {
      const expired = await authService.isExpired();
      if (!expired) {
        navigation.replace('Dashboard');
      }
    };
    checkAuth();
  }, [navigation]);

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Please fill all fields');
      return;
    }
    setError('');
    try {
      console.log('[Login] attempting login (username)', { username });
      await unAuthService.login({ username, password });
      console.log('[Login] login (username) success');
    } catch (e: any) {
      console.log('[Login] login (username) failed', e?.response?.status, e?.response?.data || e?.message);
      setError('Invalid username or password');
      return;
    }
    navigation.replace('Dashboard');
  };

  return (
    <Container style={styles.container}>
     

      <KeyboardAvoidingView
        
        style={{ flex: 1}}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top header */}
          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back 👋</Text>
            <Text style={styles.subtitle}>Login to continue</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <View style={styles.inputContainer}>
              <Input
                placeholder="Username"
                value={username}
                setValue={setUsername}
                keyboardType="default"
                borderRadius={12}
                color={Colors.black}
                placeholderTextColor={Colors.grey}
              />
              <Input
                placeholder="Password"
                value={password}
                setValue={setPassword}
                secureTextEntry={!showPassword}
                borderRadius={12}
                color={Colors.black}
                placeholderTextColor={Colors.grey}
                Tailing_icon={() => (
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Icon
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={Colors.grey}
                    />
                  </TouchableOpacity>
                )}
              />
              {error ? <ValidText text={error} style={styles.errorText} /> : null}
            </View>

            <Button
              text="Login"
              onPress={handleLogin}
              backgroundColor={Colors.primaryblue}
              borderRadius={10}
              fontSize={FontSize.Button * 1.1}
              style={styles.loginButton}
            />

            {/* <TouchableOpacity
              style={styles.forgotPasswordContainer}
              onPress={() => navigation.navigate('ForgotPasswordEmail')}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity> */}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryblue,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: FontSize.H1 * 1.1,
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
    paddingVertical: '10%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    marginBottom: 20,
    alignItems: 'center',
    gap: 15,
    width: '100%',
  },
  errorText: {
    color: Colors.orange,
    marginTop: 6,
    fontSize: FontSize.Caption,
    fontWeight: '500',
    textAlign: 'center',
  },
  loginButton: {
    marginTop: 10,
    height: 48,
    width: '90%',
    justifyContent: 'center',
  },
  forgotPasswordContainer: {
    marginTop: 18,
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: Colors.primaryblue,
    fontWeight: '600',
    fontSize: FontSize.Body,
  },
});

export default Login;
