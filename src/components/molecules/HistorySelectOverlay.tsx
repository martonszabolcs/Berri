import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Image,
  Text,
  Animated,
} from 'react-native';

interface HistorySelectOverlayProps {
  visible: boolean;
  selectedSort: string;
  sortOptions: string[];
  selectAnimation: Animated.Value;
  onClose: () => void;
  onSelectOption: (option: string) => void;
}

const HistorySelectOverlay: React.FC<HistorySelectOverlayProps> = ({
  visible,
  selectedSort,
  sortOptions,
  selectAnimation,
  onClose,
  onSelectOption,
}) => {
  if (!visible) return null;

  return (
    <TouchableOpacity
      style={styles.overlay}
      activeOpacity={1}
      onPress={onClose}
    >
      <Animated.View
        style={[
          styles.selectOptions,
          {
            opacity: selectAnimation,
            transform: [
              {
                translateY: selectAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.sortByLabel}>Sort by</Text>
        {sortOptions.map(option => (
          <TouchableOpacity
            key={option}
            style={styles.selectOption}
            onPress={() => onSelectOption(option)}
          >
            <Text
              style={[
                styles.optionText,
                selectedSort === option && styles.selectedOptionText,
              ]}
            >
              {option}
            </Text>
            {selectedSort === option && (
              <Image
                source={require('../../assets/checkmark.png')}
                style={styles.checkmarkIcon}
              />
            )}
          </TouchableOpacity>
        ))}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, // Start from top of contentWrapper, not full screen
    left: 0,
    right: 0,
    // bottom: 0,
    backgroundColor: 'rgba(37, 37, 68, 0.86)',
    zIndex: 1000,
    paddingTop: 20, // Small margin from select
    paddingHorizontal: 20,
  },
  selectOptions: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  sortByLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    paddingHorizontal: 10,
    color: 'white',
  },
  selectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  optionText: {
    fontSize: 16,
    color: 'white',
  },
  selectedOptionText: {
    color: '#F3CCFBEB',
  },
  checkmarkIcon: {
    width: 16,
    height: 16,
    tintColor: '#F3CCFBEB',
  },
});

export default HistorySelectOverlay;