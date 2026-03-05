import React, { useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, TextInput as RNTextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Layout, TextInput, Button, Text } from '../components';
import { useAppDispatch } from '../store/hooks';
import { resetPassword } from '../store/appSlice';
import { showErrorToast, showSuccessToast } from '../utils/toast';

type RootStackParamList = {
  LoginScreen: undefined;
};

type ResetPasswordScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'LoginScreen'
>;

const ResetPasswordScreen = () => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<ResetPasswordScreenNavigationProp>();
  const dispatch = useAppDispatch();

  // Refs for the code input fields
  const codeRefs = useRef<(RNTextInput | null)[]>([]);

  const handleCodeChange = (value: string, index: number) => {
    if (value.length > 1) return; // Only allow single character
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto focus next field
    if (value && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyPress = (e: any, index: number) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handleResetPassword = async () => {
    const codeString = code.join('');
    
    if (codeString.length !== 6) {
      showErrorToast('Invalid Code', 'Please enter the 6-character code from your email');
      return;
    }

    if (!newPassword || !confirmPassword) {
      showErrorToast('Missing Fields', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      showErrorToast('Password Mismatch', 'Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      showErrorToast('Weak Password', 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🚀 ResetPasswordScreen: Dispatching resetPassword thunk');
      const result = await dispatch(resetPassword({ token: codeString, password: newPassword }));
      
      if (resetPassword.fulfilled.match(result)) {
        console.log('✅ ResetPasswordScreen: Reset password successful');
        showSuccessToast('Password Updated!', 'You can now log in with your new password');
        setTimeout(() => navigation.navigate('LoginScreen'), 1500);
      } else {
        console.error('❌ ResetPasswordScreen: Reset password failed', result.error);
        showErrorToast('Reset Failed', result.error.message || 'Could not reset password');
      }
    } catch (error) {
      console.error('❌ ResetPasswordScreen: Reset password exception', error);
      showErrorToast('Reset Failed', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout type="auth" headerTitle="Reset password" showBackButton={true}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.instructionText}>
            Give the 6-character code we sent to your email, and choose a new password.
          </Text>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Code</Text>
            <View style={styles.codeContainer}>
              {code.map((digit, index) => (
                <RNTextInput
                  key={index}
                  ref={(ref) => {codeRefs.current[index] = ref}}
                  style={styles.codeInput}
                  value={digit}
                  onChangeText={(value) => handleCodeChange(value, index)}
                  onKeyPress={(e) => handleCodeKeyPress(e, index)}
                  keyboardType="default"
                  maxLength={1}
                  autoCapitalize="characters"
                  textAlign="center"
                  placeholder="-"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                />
              ))}
            </View>
            
            <Text style={styles.sectionTitle}>New password</Text>
            <TextInput
              placeholder="Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            
            <TextInput
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <Button
            title={isLoading ? 'Loading...' : 'Save'}
            variant="normal"
            size="medium"
            onPress={handleResetPassword}
            disabled={isLoading}
            buttonStyle={styles.resetButton}
          />
        </View>
      </ScrollView>
    </Layout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    paddingTop: 20,
    paddingBottom: 100,
  },
  instructionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  formSection: {
    gap: 20,
    marginBottom: 40,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  codeInput: {
    width: 45,
    height: 55,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  resetButton: {
    width: '100%',
  },
});

export default ResetPasswordScreen;