import { useState } from 'react';
import { View, StyleSheet, Alert, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { TextInput, Button, Layout, Text } from '../components';
import { useAuth } from '../hooks';
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

interface LiTextProps {
  text: string;
}

const LiText = ({ text }: LiTextProps) => {
  return (
    <View style={styles.liContainer}>
      <View style={styles.bullet} />
      <Text>{text}</Text>
    </View>
  );
};

const RegisterScreen = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const { register } = useAuth();

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
      // Call the auth hook
      const result = await register(name, email, password);

      if (result.success) {
        Alert.alert(
          'Sikeres regisztráció',
          'Kérlek ellenőrizd az email-edet a verifikációért!',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('LoginScreen'),
            },
          ]
        );
      } else {
        Alert.alert('Hiba', result.error);
      }
    } catch (error: any) {
      console.error('Register error:', error);
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
  liContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  bullet: {
    marginRight: 8,
    width: 10,
    height: 10,
    borderRadius: 20,
    backgroundColor: 'white',
  },
  loginButton: {
    marginTop: 16,
  },
});

export default RegisterScreen;
