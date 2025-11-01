import { useState } from 'react';
import { View, StyleSheet, Alert, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { TextInput, Button, Layout, Text } from '../components';
import { useAuth } from '../hooks';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Hiba', 'Kérlek töltsd ki az összes mezőt!');
      return;
    }

    setIsLoading(true);

    try {
      // Call the auth hook
      const result = await login(email, password);

      if (result.success) {
        // Navigate to main tabs on success
        navigation.replace('MainTabs');
      } else {
        Alert.alert('Hiba', result.error);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Hiba', 'Bejelentkezési hiba történt!');
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
