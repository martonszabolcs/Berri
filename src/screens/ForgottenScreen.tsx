import { useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { TextInput, Button, Layout, Text } from '../components';
import { useAppDispatch } from '../store/hooks';
import { forgotPassword } from '../store/appSlice';
import { showErrorToast, showSuccessToast } from '../utils/toast';
import React from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

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
  const dispatch = useAppDispatch();

  const handleForgotPassword = async () => {
    if (!email) {
      showErrorToast('Missing Email', 'Please enter your email address');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🚀 ForgottenScreen: Dispatching forgotPassword thunk');
      const result = await dispatch(forgotPassword({ email }));
      
      if (forgotPassword.fulfilled.match(result)) {
        console.log('✅ ForgottenScreen: Forgot password successful');
        showSuccessToast('Code Sent!', 'Check your email for the reset code');
        setTimeout(() => navigation.navigate('ResetPasswordScreen'), 1500);
      } else {
        console.error('❌ ForgottenScreen: Forgot password failed', result.error);
        showErrorToast('Request Failed', result.error.message || 'Could not send reset email');
      }
    } catch (error) {
      console.error('❌ ForgottenScreen: Forgot password exception', error);
      showErrorToast('Request Failed', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout type="auth">
       <KeyboardAwareScrollView
                    enableOnAndroid
                    extraScrollHeight={60}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ flexGrow: 1 }}
                  >
      <View style={styles.content}>
        <Image
          resizeMode="contain"
          source={require('../assets/logo.png')}
          style={styles.logo}
        />
        <View style={styles.form}>
          <Text style={styles.description}>
            Enter your email address and we'll send you a code to reset your password
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
              Back to login?
            </Text>
          </TouchableOpacity>

          <Button
            title={isLoading ? 'Sending...' : 'Send Code'}
            onPress={handleForgotPassword}
            disabled={isLoading}
            size="large"
            buttonStyle={styles.submitButton}
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
