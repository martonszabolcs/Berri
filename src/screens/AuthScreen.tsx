import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Button, Layout } from '../components';

type RootStackParamList = {
  LaunchScreen: undefined;
  CameraScreen: undefined;
  LoginScreen: undefined;
};

type LoginScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'LoginScreen',
  'RegisterScreen'
>;

const AuthScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();

  return (
    <Layout type="auth">
      <View style={styles.content}>
        <Image
          resizeMode="contain"
          source={require('../assets/logo.png')}
          style={{ width: '60%', marginBottom: 20 }}
        />
        <View style={styles.form}>
          <Button
            title={'Sign up'}
            onPress={() => navigation.navigate('RegisterScreen')}
            size="large"
            buttonStyle={styles.loginButton}
          />
          <Button
            title={'Log in'}
            onPress={() => navigation.navigate('LoginScreen')}
            size="large"
            buttonStyle={styles.loginButton}
            variant="outline"
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

export default AuthScreen;
