import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Layout, Header, TextInput, Button } from '../components';

const ResetPasswordScreen = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleResetPassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    // Here you would typically call your API to reset the password
    Alert.alert(
      'Success', 
      'Password has been reset successfully!',
      [{ text: 'OK', onPress: () => {
        // Reset form
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }}]
    );
  };

  return (
    <Layout type="auth">
      <Header title="Reset Password" showBackButton />
      
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.instructionText}>
            Enter your current password and choose a new one.
          </Text>

          <View style={styles.formSection}>
            <TextInput
              placeholder="Current Password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
            
            <TextInput
              placeholder="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            
            <TextInput
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <Button
            title="Reset Password"
            variant="normal"
            size="medium"
            onPress={handleResetPassword}
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
  resetButton: {
    width: '100%',
  },
});

export default ResetPasswordScreen;