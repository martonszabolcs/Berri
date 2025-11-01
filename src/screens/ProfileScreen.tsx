import React from 'react';
import { View, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Layout, Header, Button, TextInput, Text } from '../components';

type ProfileStackParamList = {
  ProfileScreen: undefined;
  ResetPasswordScreen: undefined;
  AuthScreen: undefined;
};

type ProfileScreenNavigationProp = StackNavigationProp<ProfileStackParamList>;

const ProfileScreen = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      navigation.reset({
        index: 0,
        routes: [{ name: 'AuthScreen' }],
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to logout');
    }
  };

  const handleResetPassword = () => {
    navigation.navigate('ResetPasswordScreen');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            // Here you would call your API to delete the account
            Alert.alert('Account Deleted', 'Your account has been successfully deleted.');
          }
        }
      ]
    );
  };

  return (
    <Layout type="default">
      <Header 
        title="Profile" 
        showBackButton={true}
        rightComponent={
          <Button
            title="Log out"
            variant="text"
            size="small"
            onPress={() => handleLogout()}
            textStyle={styles.logoutButtonText}
          />
        }
      />
      
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Profile Image and Info */}
          <View style={styles.profileSection}>
            <Image 
              source={require('../assets/logo.png')} 
              style={styles.profileImage}
            />
            <Text style={styles.userName}>John Doe</Text>
            <Text style={styles.joinedText}>Joined in March 2024</Text>
          </View>

          {/* User Details Boxes */}
          <View style={styles.detailsSection}>
            <View style={styles.detailBox}>
              <Text style={styles.detailLabel}>Name</Text>
              <TextInput
                value="John Doe"
                editable={false}
              />
            </View>
            
            <View style={styles.detailBox}>
              <Text style={styles.detailLabel}>Email</Text>
              <TextInput
                value="user@example.com"
                editable={false}
              />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsSection}>
            <Button
              title="Reset Password"
              variant="outline"
              size="medium"
              onPress={handleResetPassword}
              buttonStyle={styles.actionButton}
            />
            
            <Button
              title="Delete this account"
              variant="text"
              size="medium"
              onPress={handleDeleteAccount}
              buttonStyle={styles.deleteButton}
            />
          </View>
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
  profileSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 20,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  joinedText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
  detailsSection: {
    gap: 20,
    marginBottom: 40,
  },
  detailBox: {
    gap: 8,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionsSection: {
    gap: 20,
    alignItems: 'center',
  },
  actionButton: {
    width: '100%',
  },
  deleteButton: {
    marginTop: 20,
  },
  logoutButtonText: {
  },
});

export default ProfileScreen;