import { useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { TextInput, Button, Layout, Text } from '../components';
import { useAppDispatch } from '../store/hooks';
import { loginUser } from '../store/appSlice';
import { showErrorToast, showSuccessToast } from '../utils/toast';
import React from 'react';

type RootStackParamList = {
  LaunchScreen: undefined;
  MainTabs: undefined;
  LoginScreen: undefined;
  ForgottenScreen: undefined;
  RegisterScreen: undefined;
};

type LoginScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'LoginScreen'
>;

const LoginScreen = () => {
  const [email, setEmail] = useState(''); //'weruss.kiss@gmail.com'
  const [password, setPassword] = useState(''); //'1234Aa!!'
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const dispatch = useAppDispatch();

  const handleLogin = async () => {
    console.log('🚀 LoginScreen: handleLogin started', { email });
    
    if (!email || !password) {
      showErrorToast('Missing Fields', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🚀 LoginScreen: Dispatching loginUser thunk');
      // Use Redux thunk directly
      const result = await dispatch(loginUser({ email, password }));

      console.log('📊 LoginScreen: loginUser result', result);

      if (loginUser.fulfilled.match(result)) {
        console.log('✅ LoginScreen: Login successful, navigating to MainTabs');
        showSuccessToast('Welcome back!', 'Login successful');
        // Navigate to main tabs on success
        navigation.replace('MainTabs');
      } else {
        console.error('❌ LoginScreen: Login failed', result.error);
        showErrorToast('Login Failed', result.error.message || 'Invalid email or password');
      }
    } catch (error: any) {
      console.error('❌ LoginScreen: Login exception', error);
      showErrorToast('Login Failed', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout type="auth">
      <View style={styles.content}>
        <Image
          resizeMode="contain"
          source={require('../assets/logo.png')}
          style={styles.logo}
        />
        <View style={styles.form}>
          <TextInput
            placeholder="email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

          <TextInput
            placeholder="password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />

          <TouchableOpacity
            onPress={() => navigation.navigate('ForgottenScreen')}
          >
            <Text style={styles.forgotPassword}>
              Forgotten password?
            </Text>
          </TouchableOpacity>

          <Button
            title={isLoading ? 'Loading...' : 'Log in'}
            onPress={handleLogin}
            disabled={isLoading}
            size="large"
            buttonStyle={styles.loginButton}
          />
        </View>
      </View>
    </Layout>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: '60%',
    marginBottom: 20,
  },
  title: {
    color: 'white',
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 48,
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  input: {
    marginBottom: 24,
  },
  forgotPassword: {
    textAlign: 'right',
    marginBottom: 16,
  },
  loginButton: {
    marginTop: 16,
  },
});

export default LoginScreen;
