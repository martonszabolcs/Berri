import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Text from './Text';

interface FileInfo {
  filename: string;
  url: string;
}

interface HistoryEntry {
  timestamp: number;
  destination?: number; // Legacy support
  destinations?: number[]; // New multi-destination support
  files: FileInfo[];
}

type RootStackParamList = {
  HistoryDetailScreen: { 
    history: HistoryEntry
  };
};

type HistoryCardNavigationProp = StackNavigationProp<RootStackParamList>;

interface HistoryCardProps {
  history: HistoryEntry;
  isGridView?: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string | number) => void;
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
      onToggleSelection(history.timestamp);
    } else {
      // Navigate via parent navigator to hide tab bar
      navigation.getParent()?.navigate('HistoryDetailScreen', { history });
    }
  };

  // Create display values from timestamp and destination
  const displayName = `${history.files[0]?.filename}`;
  const displayDate = new Date(history.timestamp).toLocaleDateString();

  if (isGridView) {
    return (
      <TouchableOpacity style={styles.gridContainer} onPress={handlePress}>
        {/* Image on top */}
        <View style={styles.gridImageContainer}>
          <Image 
            source={{ uri: `file://${history.files[0]?.url}` }} 
            style={[styles.gridImage, isSelected ? { borderColor: '#3b82f6', borderWidth: 2 } : {}]}
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
          <Text style={styles.gridName}>{displayName}</Text>
          <Text>{history.files.length} files</Text>
          <Text style={styles.gridCreatedAt}>{displayDate}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: `file://${history.files[0]?.url}` }} 
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
        <Text style={styles.name}>{displayName}</Text>
        <Text>{history.files.length} files</Text>
        <Text style={styles.createdAt}>{displayDate}</Text>
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
    width: 90,
    height: 127,
  },
  textContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
    alignSelf: "flex-start"
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
    width: 120,
    height: 160,
  },
  gridTextContainer: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
  },
  gridName: {
    fontSize: 12,
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