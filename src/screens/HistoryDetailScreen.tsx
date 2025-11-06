import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Layout, Text, DestinationIcon } from '../components';

interface FileInfo {
  filename: string;
  url: string;
}

interface HistoryEntry {
  timestamp: number;
  destination: number;
  files: FileInfo[];
}

type RootStackParamList = {
  HistoryDetailScreen: { 
    history: HistoryEntry
  };
  HistoryScreen: undefined;
};

type HistoryDetailScreenRouteProp = RouteProp<RootStackParamList, 'HistoryDetailScreen'>;
type HistoryDetailScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const HistoryDetailScreen = () => {
  const navigation = useNavigation<HistoryDetailScreenNavigationProp>();
  const route = useRoute<HistoryDetailScreenRouteProp>();
  const { history } = route.params;
  
  // State for selected destinations (1-7) - initialize with the original destination
  const [selectedDestinations, setSelectedDestinations] = useState<number[]>([history.destination]);

  // Create display values from history data
  const displayName = `Document ${history.destination}`;
  const displayDate = new Date(history.timestamp).toLocaleDateString();

  const toggleDestination = (destinationId: number) => {
    // setSelectedDestinations(prev => {
    //   if (prev.includes(destinationId)) {
    //     return prev.filter(id => id !== destinationId);
    //   } else {
    //     return [...prev, destinationId];
    //   }
    // });
    setSelectedDestinations([destinationId])
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
    <Layout type="default" headerTitle={displayName} showBackButton={true}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Title and Date */}
        <View style={styles.headerInfo}>
          <Text style={styles.title}>{displayName}</Text>
          <Text style={styles.createdAt}>{displayDate}</Text>
        </View>

        {/* Images - show all files */}
        <View style={styles.imagesContainer}>
          {history.files && history.files.length > 0 ? (
            history.files.map((file, index) => (
              <View key={index} style={styles.imageContainer}>
                <Text style={styles.fileName}>{file.filename}</Text>
                <Image 
                  source={{ uri: `file://${file.url}` }} 
                  style={styles.image}
                  resizeMode="contain"
                />
              </View>
            ))
          ) : (
            <View style={styles.imageContainer}>
              <View style={[styles.image, styles.noImageContainer]}>
                <Text style={styles.noImageText}>No images available</Text>
              </View>
            </View>
          )}
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
                onPress={() => toggleDestination(destinationId)}
              >
                <DestinationIcon 
                  type={destinationId as 1 | 2 | 3 | 4 | 5 | 6 | 7} 
                  variant={selectedDestinations.includes(destinationId) ? "history-active" : "history"}
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
  imagesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  imageContainer: {
    marginBottom: 20,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  image: {
    width: '100%',
    height: 400,
    borderRadius: 8,
  },
  noImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  noImageText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
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