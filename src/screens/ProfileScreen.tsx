import React from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Rect, LinearGradient, Stop, Defs } from 'react-native-svg';
import { Layout, Header, Button, Text, AvatarIcon } from '../components';
import { useAppSelector } from '../store/hooks';

type ProfileStackParamList = {
  ProfileScreen: undefined;
  ResetPasswordScreen: undefined;
  AuthScreen: undefined;
};

type ProfileScreenNavigationProp = StackNavigationProp<ProfileStackParamList>;

const ProfileScreen = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const user = useAppSelector((state) => state.app.user);
  const userEmail = user?.email || '';
  const userName = user?.name || '';
  const userCreatedAt = user?.createdAt || '';

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
    <Layout type="dark" >
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
            <AvatarIcon 
              character={userEmail.charAt(0)}
              size={100}
            />
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.joinedText}>Joined {userCreatedAt}</Text>
          </View>

          {/* User Details Boxes */}
          <View style={styles.detailsSection}>
            <View style={styles.detailBox}>
              {/* Gradient Background */}
              <Svg 
                width="100%" 
                height="100%" 
                style={styles.svgBackground}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <Defs>
                  <LinearGradient
                    id="detailGradient"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <Stop offset="0%" stopColor="rgba(255, 255, 255, 1)" />
                    <Stop offset="100%" stopColor="rgba(153, 153, 153, 1)" />
                  </LinearGradient>
                </Defs>
                
                <Rect
                  x="0"
                  y="0"
                  width="100"
                  height="100"
                  fill="url(#detailGradient)"
                />
              </Svg>
              
              {/* Content */}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Name</Text>
                <Text style={styles.detailValue}>{userName}</Text>
              </View>
            </View>
            
            <View style={styles.detailBox}>
              {/* Gradient Background */}
              <Svg 
                width="100%" 
                height="100%" 
                style={styles.svgBackground}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <Defs>
                  <LinearGradient
                    id="detailGradient2"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <Stop offset="0%" stopColor="rgba(255, 255, 255, 1)" />
                    <Stop offset="100%" stopColor="rgba(153, 153, 153, 1)" />
                  </LinearGradient>
                </Defs>
                
                <Rect
                  x="0"
                  y="0"
                  width="100"
                  height="100"
                  fill="url(#detailGradient2)"
                />
              </Svg>
              
              {/* Content */}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{userEmail}</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsSection}>
            <Button
              title="RESET PASSWORD"
              variant="normal"
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
    gap: 0,
    marginBottom: 100,
  },
  detailBox: {
    position: 'relative',
    overflow: 'hidden',
    paddingVertical: 12,
    minHeight: 70,
    justifyContent: 'center',
    width: '80%',
    marginHorizontal: "auto",
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    zIndex: 10,
    position: 'relative',
    flex: 1,
    width: '100%',
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '400',
    color: 'white',
    flex: 2,
    textAlign: 'right',
    flexShrink: 1,
  },
  svgBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    opacity: 0.6,
  },
  actionsSection: {
    alignItems: 'center',
    width: '80%',
    marginHorizontal: "auto",
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