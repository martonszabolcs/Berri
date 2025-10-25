import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Layout, Header, Button } from '../components';

type TemplateOption = {
  id: string;
  label: string;
  value: string;
};

const TEMPLATE_OPTIONS: TemplateOption[] = [
  { id: 'bi', label: 'BI', value: '{BI}' },
  { id: 'berri', label: 'Berri', value: '{Berri}' },
  { id: 'page', label: 'Page', value: '{Page}' },
  { id: 'year', label: 'Year', value: '{Year}' },
  { id: 'month', label: 'Month', value: '{Month}' },
  { id: 'day', label: 'Day', value: '{Day}' },
  { id: 'time', label: 'Time', value: '{Time}' },
];

const FileNamingScreen = () => {
  const [selectedOptions, setSelectedOptions] = useState<TemplateOption[]>([]);
  const [availableOptions, setAvailableOptions] = useState<TemplateOption[]>(TEMPLATE_OPTIONS);

  const handleOptionSelect = (option: TemplateOption) => {
    // Add to selected options
    setSelectedOptions(prev => [...prev, option]);
    
    // Remove from available options
    setAvailableOptions(prev => prev.filter(opt => opt.id !== option.id));
  };

  const handleRemoveOption = (optionToRemove: TemplateOption) => {
    // Remove from selected options
    setSelectedOptions(prev => prev.filter(opt => opt.id !== optionToRemove.id));
    
    // Add back to available options in original order
    setAvailableOptions(prev => {
      const newAvailable = [...prev, optionToRemove];
      // Sort by original order
      return newAvailable.sort((a, b) => {
        const aIndex = TEMPLATE_OPTIONS.findIndex(opt => opt.id === a.id);
        const bIndex = TEMPLATE_OPTIONS.findIndex(opt => opt.id === b.id);
        return aIndex - bIndex;
      });
    });
  };

  const handleSave = () => {
    const templateString = selectedOptions.map(opt => opt.value).join('_');
    const displayString = selectedOptions.map(opt => opt.label).join(' + ');
    
    Alert.alert(
      'Template Saved',
      `Selected template: ${displayString}\n\nGenerated template string: ${templateString || '(empty)'}`,
      [{ text: 'OK' }]
    );
  };

  return (
    <Layout type="default">
      <Header title="File Naming Template" showBackButton />
      
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Edit Label */}
          <Text style={styles.editLabel}>EDIT</Text>

          {/* Template Preview Box */}
          <View style={styles.templateBox}>
            {selectedOptions.length === 0 ? (
              <Text style={styles.placeholderText}>Tap options below to build your template</Text>
            ) : (
              <View style={styles.selectedOptionsContainer}>
                {selectedOptions.map((option, index) => (
                  <TouchableOpacity
                    key={`${option.id}-${index}`}
                    style={styles.selectedOption}
                    onPress={() => handleRemoveOption(option)}
                  >
                    <Text style={styles.selectedOptionText}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Instruction Text */}
          <Text style={styles.instructionText}>
            Tap the options below in the desired order
          </Text>

          {/* Available Options */}
          <View style={styles.optionsContainer}>
            {availableOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={styles.optionButton}
                onPress={() => handleOptionSelect(option)}
              >
                <Text style={styles.optionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Save Button */}
          <View style={styles.saveButtonContainer}>
            <Button
              title="Save Template"
              variant="normal"
              size="medium"
              onPress={handleSave}
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
    paddingBottom: 100, // Extra space for tab bar
  },
  editLabel: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  templateBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 20,
    minHeight: 80,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  placeholderText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  selectedOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedOptionText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  instructionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 22,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 40,
  },
  optionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  optionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButtonContainer: {
    marginTop: 20,
  },
});

export default FileNamingScreen;