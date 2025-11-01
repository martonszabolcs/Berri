import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Text from './Text';

type RootStackParamList = {
  HistoryDetailScreen: { 
    history: {
      id: string;
      name: string;
      createdAt: string;
      imageUri: string;
    }
  };
};

type HistoryCardNavigationProp = StackNavigationProp<RootStackParamList>;

interface HistoryCardProps {
  history: {
    id: string;
    name: string;
    createdAt: string;
    imageUri: string;
  };
  isGridView?: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
}

const HistoryCard = ({ 
  history, 
  isGridView = false, 
  isSelectionMode = false, 
  isSelected = false, 
  onToggleSelection 
}: HistoryCardProps) => {
  const navigation = useNavigation<HistoryCardNavigationProp>();

  const handlePress = () => {
    if (isSelectionMode && onToggleSelection) {
      onToggleSelection(history.id);
    } else {
      navigation.navigate('HistoryDetailScreen', { history });
    }
  };

  if (isGridView) {
    return (
      <TouchableOpacity style={styles.gridContainer} onPress={handlePress}>
        {/* Image on top */}
        <View style={styles.gridImageContainer}>
          <Image 
            source={{ uri: history.imageUri }} 
            style={styles.gridImage}
            resizeMode="cover"
          />
          {/* Selection Circle for Grid View */}
          {isSelectionMode && (
            <View style={styles.selectionCircleContainer}>
              <View style={[
                styles.selectionCircle,
                isSelected && styles.selectedCircle
              ]}>
                {isSelected && (
                  <View style={styles.selectedDot} />
                )}
              </View>
            </View>
          )}
        </View>
        
        {/* Text content below image */}
        <View style={styles.gridTextContainer}>
          <Text style={styles.gridName}>{history.name}</Text>
          <Text style={styles.gridCreatedAt}>{history.createdAt}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      {/* A4 size image on the left */}
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: history.imageUri }} 
          style={styles.image}
          resizeMode="cover"
        />
        {/* Selection Circle for List View */}
        {isSelectionMode && (
          <View style={styles.listSelectionCircleContainer}>
            <View style={[
              styles.selectionCircle,
              isSelected && styles.selectedCircle
            ]}>
              {isSelected && (
                <View style={styles.selectedDot} />
              )}
            </View>
          </View>
        )}
      </View>
      
      {/* Text content on the right */}
      <View style={styles.textContainer}>
        <Text style={styles.name}>{history.name}</Text>
        <Text style={styles.createdAt}>{history.createdAt}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  imageContainer: {
    marginRight: 16,
  },
  image: {
    width: 60, // A4 aspect ratio approximation
    height: 80, // A4 is roughly 1:1.4 ratio
    borderRadius: 4,
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  createdAt: {
    fontSize: 14,
    opacity: 0.7,
  },
  // Grid view styles
  gridContainer: {
    width: '48%', // Two cards per row with some margin
    marginBottom: 16,
    alignItems: 'center',
  },
  gridImageContainer: {
    marginBottom: 8,
  },
  gridImage: {
    width: 120, // Larger image for grid view
    height: 160, // Maintain A4 aspect ratio
    borderRadius: 4,
  },
  gridTextContainer: {
    alignItems: 'center',
    gap: 4,
  },
  gridName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  gridCreatedAt: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  // Selection Circle Styles
  selectionCircleContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  listSelectionCircleContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3b82f6',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCircle: {
    backgroundColor: '#3b82f6',
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
});

export default HistoryCard;