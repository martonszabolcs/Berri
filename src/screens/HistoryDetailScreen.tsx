import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Layout, Text } from '../components';

type RootStackParamList = {
  HistoryDetailScreen: { 
    history: {
      id: string;
      name: string;
      createdAt: string;
      imageUri: string;
    }
  };
  HistoryScreen: undefined;
};

type HistoryDetailScreenRouteProp = RouteProp<RootStackParamList, 'HistoryDetailScreen'>;
type HistoryDetailScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const HistoryDetailScreen = () => {
  const navigation = useNavigation<HistoryDetailScreenNavigationProp>();
  const route = useRoute<HistoryDetailScreenRouteProp>();
  const { history } = route.params;
  
  // State for selected destinations (1-7)
  const [selectedDestinations, setSelectedDestinations] = useState<number[]>([]);

  // Get destination image based on type
  const getDestinationImage = (type: number) => {
    switch (type) {
      case 1: return require('../assets/dest_1.png');
      case 2: return require('../assets/dest_2.png');
      case 3: return require('../assets/dest_3.png');
      case 4: return require('../assets/dest_4.png');
      case 5: return require('../assets/dest_5.png');
      case 6: return require('../assets/dest_6.png');
      case 7: return require('../assets/dest_7.png');
      default: return require('../assets/dest_1.png');
    }
  };

  const toggleDestination = (destinationId: number) => {
    setSelectedDestinations(prev => {
      if (prev.includes(destinationId)) {
        return prev.filter(id => id !== destinationId);
      } else {
        return [...prev, destinationId];
      }
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Scan',
      'Are you sure you want to delete this scan?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Here you would typically call your delete API
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleResend = () => {
    if (selectedDestinations.length === 0) {
      Alert.alert('No Destinations', 'Please select at least one destination to resend to.');
      return;
    }

    Alert.alert(
      'Resend Scan',
      `Resend this scan to ${selectedDestinations.length} destination(s)?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Resend',
          onPress: () => {
            // Here you would typically call your resend API
            Alert.alert('Success', 'Scan has been resent successfully!', [
              {
                text: 'OK',
                onPress: () => navigation.navigate('HistoryScreen'),
              },
            ]);
          },
        },
      ]
    );
  };

  return (
    <Layout type="default" headerTitle={history.name} showBackButton={true}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Title and Date */}
        <View style={styles.headerInfo}>
          <Text style={styles.title}>{history.name}</Text>
          <Text style={styles.createdAt}>{history.createdAt}</Text>
        </View>

        {/* Large Image */}
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: history.imageUri }} 
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        {/* Bottom Action Bar */}
        <View style={styles.actionBar}>
          {/* Delete Button */}
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Image 
              source={require('../assets/trash.png')} 
              style={styles.deleteIcon}
            />
          </TouchableOpacity>

          {/* Destination Icons */}
          <View style={styles.destinationsContainer}>
            {[1, 2, 3, 4, 5, 6, 7].map((destinationId) => (
              <TouchableOpacity
                key={destinationId}
                style={[
                  styles.destinationButton,
                  selectedDestinations.includes(destinationId) && styles.destinationButtonActive
                ]}
                onPress={() => toggleDestination(destinationId)}
              >
                <Image 
                  source={getDestinationImage(destinationId)} 
                  style={[
                    styles.destinationIcon,
                    selectedDestinations.includes(destinationId) && styles.destinationIconActive
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Resend Button */}
          <TouchableOpacity style={styles.resendButton} onPress={handleResend}>
            <Image 
              source={require('../assets/resend.png')} 
              style={styles.resendIcon}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Layout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerInfo: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  createdAt: {
    fontSize: 14,
    opacity: 0.7,
  },
  imageContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  image: {
    width: '100%',
    height: 400,
    borderRadius: 8,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    gap: 12,
  },
  deleteButton: {
    padding: 8,
  },
  deleteIcon: {
    width: 24,
    height: 24,
    tintColor: '#FF4444',
  },
  destinationsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  destinationButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  destinationButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  destinationIcon: {
    width: 28,
    height: 28,
    tintColor: 'rgba(255, 255, 255, 0.6)',
  },
  destinationIconActive: {
    tintColor: 'white',
  },
  resendButton: {
    padding: 8,
  },
  resendIcon: {
    width: 24,
    height: 24,
    tintColor: '#4CAF50',
  },
});

export default HistoryDetailScreen;