import { useState } from 'react';
import { View, StyleSheet, Alert, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { TextInput, Button, Layout, Text } from '../components';
import { useAuth } from '../hooks/useAuth';
import React from 'react';

type RootStackParamList = {
  LaunchScreen: undefined;
  LoginScreen: undefined;
  ResetPasswordScreen: undefined;
};

type ForgottenScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ResetPasswordScreen'
>;

const ForgottenScreen = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<ForgottenScreenNavigationProp>();
  const { forgotPassword } = useAuth();

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Hiba', 'Kérlek add meg az email címedet!');
      return;
    }

    setIsLoading(true);

    try {
      const result = await forgotPassword(email);
      
      if (result.success) {
        Alert.alert(
          'Sikeres kérés',
          'Elküldtük a visszaállítási kódot az email címedre.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('ResetPasswordScreen'),
            },
          ]
        );
      } else {
        Alert.alert('Hiba', result.error || 'Hiba történt a kérés során!');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      Alert.alert('Hiba', 'Hiba történt a kérés során!');
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
          <Text style={styles.description}>
            Add meg az email címedet és küldünk egy kódot a jelszó visszaállításához
          </Text>
          <TextInput
            placeholder="email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

          <TouchableOpacity onPress={() => navigation.navigate('LoginScreen')}>
            <Text style={styles.backLink}>
              Vissza a bejelentkezéshez?
            </Text>
          </TouchableOpacity>

          <Button
            title={isLoading ? 'Küldés...' : 'Kód küldése'}
            onPress={handleForgotPassword}
            disabled={isLoading}
            size="large"
            buttonStyle={styles.submitButton}
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
  form: {
    width: '100%',
    maxWidth: 400,
  },
  description: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    marginBottom: 24,
  },
  backLink: {
    textAlign: 'right',
    marginBottom: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  submitButton: {
    marginTop: 16,
  },
});

export default ForgottenScreen;
