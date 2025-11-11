import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Layout, TextInput, Button, Text, LiText } from '../components';
import { useAppDispatch } from '../store/hooks';
import { updatePassword } from '../store/appSlice';

const UpdatePasswordScreen = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();
  const dispatch = useAppDispatch();

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields!');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match!');
      return;
    }

    if (
      newPassword.length < 8 ||
      newPassword.search(/[a-z]/) === -1 ||
      newPassword.search(/[A-Z]/) === -1 ||
      newPassword.search(/[0-9]/) === -1 ||
      newPassword.search(/[^A-Za-z0-9]/) === -1
    ) {
      Alert.alert(
        'Hiba',
        'Password must contain at least 8 characters, one lowercase letter, one uppercase letter, one number, and one special character',
      );
      return;
    }

    setIsLoading(true);

    try {
      console.log('🚀 UpdatePasswordScreen: Dispatching updatePassword thunk');
      const result = await dispatch(updatePassword({ password: newPassword }));

      if (updatePassword.fulfilled.match(result)) {
        console.log('✅ UpdatePasswordScreen: Update password successful');
        Alert.alert('Success', 'Your password has been updated successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        console.error(
          '❌ UpdatePasswordScreen: Update password failed',
          result.error,
        );
        Alert.alert(
          'Error',
          result.error.message ||
            'Something went wrong while updating your password!',
        );
      }
    } catch (error) {
      console.error(
        '❌ UpdatePasswordScreen: Update password exception',
        error,
      );
      Alert.alert(
        'Error',
        'Something went wrong while updating your password!',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout type="dark" headerTitle="Reset password" showBackButton={true}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>New password</Text>

            <LiText text="minimum 8 characters" />
            <LiText text="one lowercase letter" />
            <LiText text="one uppercase letter" />
            <LiText text="one number" />
            <LiText text="one special character" />
            <TextInput
              placeholder="Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <TextInput
              placeholder="New password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <Button
            title={isLoading ? 'Loading...' : 'Save'}
            variant="normal"
            size="medium"
            onPress={handleUpdatePassword}
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

export default UpdatePasswordScreen;
