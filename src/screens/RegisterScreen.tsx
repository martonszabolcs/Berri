import { useState } from 'react';
import { View, StyleSheet, Alert, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { TextInput, Button, Layout, LiText } from '../components';
import { useAppDispatch } from '../store/hooks';
import { registerUser } from '../store/appSlice';
import React from 'react';

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

    if (!name || !email || !password) {
      Alert.alert('Hiba', 'Kérlek töltsd ki az összes mezőt!');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🚀 RegisterScreen: Dispatching registerUser thunk');
      const result = await dispatch(registerUser({ name, email, password }));

      if (registerUser.fulfilled.match(result)) {
        console.log('✅ RegisterScreen: Registration successful');
        Alert.alert(
          'Sikeres regisztráció',
          'Kérlek ellenőrizd az email-edet a verifikációért!',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('LoginScreen'),
            },
          ],
        );
      } else {
        console.error('❌ RegisterScreen: Registration failed', result.error);
        Alert.alert(
          'Hiba',
          result.error.message || 'Regisztrációs hiba történt!',
        );
      }
    } catch (error: any) {
      console.error('❌ RegisterScreen: Registration exception', error);
      Alert.alert('Hiba', 'Regisztrációs hiba történt!');
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
            onPress={handleRegister}
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
  loginButton: {
    marginTop: 16,
  },
});

export default RegisterScreen;
