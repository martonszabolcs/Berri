import { useState } from 'react';
import { View, StyleSheet, Image, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { TextInput, Button, Layout, LiText } from '../components';
import { useAppDispatch } from '../store/hooks';
import { registerUser } from '../store/appSlice';
import { showErrorToast, showSuccessToast } from '../utils/toast';
import React from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Dimensions } from 'react-native';

const screenHeight = Dimensions.get('window').height;
type RootStackParamList = {
  LaunchScreen: undefined;
  MainTabs: undefined;
  LoginScreen: undefined;
  RegisterScreen: undefined;
};

type RegisterScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'RegisterScreen'
>;

const RegisterScreen = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const dispatch = useAppDispatch();

  const handleRegister = async () => {
    if (password.length < 8) {
      showErrorToast('Weak Password', 'Password must have 8+ characters');
      return;
    }

    if (!name || !email || !password) {
      showErrorToast('Missing Fields', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🚀 RegisterScreen: Dispatching registerUser thunk');
      const result = await dispatch(registerUser({ name, email, password }));

      if (registerUser.fulfilled.match(result)) {
        console.log('✅ RegisterScreen: Registration successful');
        showSuccessToast(
          'Account Created!',
          'Please check your email to verify your account',
        );
        setTimeout(() => navigation.navigate('LoginScreen'), 1500);
      } else {
        console.error('❌ RegisterScreen: Registration failed', result.error);
        const errorMessage =
          (result.payload as string) ||
          result.error?.message ||
          'Something went wrong during registration.';
        showErrorToast('Registration Failed', errorMessage);
      }
    } catch (error: any) {
      console.error('❌ RegisterScreen: Registration exception', error);
      const errorMessage =
        error.response?.data?.message ||
        'Something went wrong during registration.';
      showErrorToast('Registration Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout type="auth">
      <KeyboardAwareScrollView
        enableOnAndroid
        extraScrollHeight={200}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={[styles.content]}>
          <Image
            resizeMode="contain"
            source={require('../assets/logo.png')}
            style={styles.logo}
          />
          <View style={styles.form}>
            <TextInput
              placeholder="name"
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              placeholder="e-mail"
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

            <LiText text="minimum 8 characters" />

            <Button
              title={isLoading ? 'Loading...' : 'SIGN UP'}
              onPress={handleRegister}
              disabled={isLoading}
              size="large"
              buttonStyle={styles.loginButton}
            />
          </View>
        </View>
      </KeyboardAwareScrollView>
    </Layout>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: '60%',
    marginBottom: 20,
    marginTop: 100,
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
    marginTop: 50,
    paddingBottom: 120,
  },
  input: {
    marginBottom: 24,
  },
  loginButton: {
    marginTop: 16,
  },
});

export default RegisterScreen;
