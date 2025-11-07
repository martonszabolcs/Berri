import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Text,
} from 'react-native';

interface HistorySelectAndReorderProps {
  selectedSort: string;
  isGridView: boolean;
  onToggleSelect: () => void;
  onToggleGridView: () => void;
}

const HistorySelectAndReorder: React.FC<HistorySelectAndReorderProps> = ({
  selectedSort,
  isGridView: _isGridView,
  onToggleSelect,
  onToggleGridView,
}) => {
  return (
    <View style={styles.selectAndReorderContainer}>
      <TouchableOpacity
        style={styles.selectButton}
        onPress={onToggleSelect}
      >
        <Text style={styles.selectText}>{selectedSort}</Text>
        <Image
          style={styles.dropdownArrow}
          resizeMode="contain"
          source={require('../../assets/arrow-down.png')}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.reorderButton}
        onPress={onToggleGridView}
      >
        <Image
          source={require('../../assets/arrange.png')}
          style={styles.reorderIcon}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  selectAndReorderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  selectButton: {
    paddingVertical: 8,
    flex: 1,
    flexDirection: 'row',
  },
  reorderButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  reorderIcon: {
    width: 20,
    height: 14,
    tintColor: 'white',
  },
  selectText: {
    fontSize: 16,
    color: 'white',
  },
  dropdownArrow: {
    marginLeft: 10,
    width: 12,
    height: 12,
    alignSelf: 'center',
  },
});

export default HistorySelectAndReorder;