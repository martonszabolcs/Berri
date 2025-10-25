import { useState } from 'react';
import { View, StyleSheet, Alert, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { TextInput, Button, Layout, Text } from '../components';
import React from 'react';

type RootStackParamList = {
  LaunchScreen: undefined;
  CameraScreen: undefined;
  LoginScreen: undefined;
};

type LoginScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'LoginScreen'
>;

const LiText = ({ text }) => {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
      }}
    >
      <View
        style={{
          marginRight: 8,
          width: 10,
          height: 10,
          borderRadius: 20,
          backgroundColor: 'white',
        }}
      />
      <Text>{text}</Text>
    </View>
  );
};

const LoginScreen = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<LoginScreenNavigationProp>();

  const handleLogin = async () => {
    if (
      password.length < 8 ||
      password.search(/[a-z]/) === -1 ||
      password.search(/[A-Z]/) === -1 ||
      password.search(/[0-9]/) === -1 ||
      password.search(/[^A-Za-z0-9]/) === -1
    ) {
      Alert.alert(
        'Hiba',
        'Password must contain at least 8 characters, one lowercase letter, one uppercase letter, one number, and one special character',
      );
      return;
    }

    if (!email || !password) {
      Alert.alert('Hiba', 'Kérlek töltsd ki az összes mezőt!');
      return;
    }

    setIsLoading(true);

    try {
      // Simulate API call - replace with actual authentication
      await new Promise<void>(resolve => setTimeout(resolve, 1000));

      // For demo purposes, accept any email/password
      // In real app, you would make an API call here
      const mockToken = 'user_auth_token_' + Date.now();

      // Store token in AsyncStorage
      await AsyncStorage.setItem('authToken', mockToken);

      // Navigate to Camera screen
      navigation.replace('CameraScreen');
    } catch (error) {
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
          style={{ width: '60%', marginBottom: 20 }}
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
          <LiText text="one lowercase letter" />
          <LiText text="one uppercase letter" />
          <LiText text="one number" />
          <LiText text="one special character" />

          <Button
            title={isLoading ? 'Loading...' : 'Sign up'}
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
  loginButton: {
    marginTop: 16,
  },
});

export default LoginScreen;
