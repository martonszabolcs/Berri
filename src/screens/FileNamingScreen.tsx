import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Layout, Button, Text } from '../components';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { updateUserSettings } from '../store/api/userApiService';
import { useNavigation } from '@react-navigation/native';
import { refreshUser } from '../store/appSlice';

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

type TemplateItem = {
  id: string;
  type: 'button' | 'text';
  content: string;
  originalOption?: TemplateOption;
};

const FileNamingScreen = () => {
  const navigation = useNavigation();
  const settings = useAppSelector(state => state.app.settings);
  const dispatch = useAppDispatch();
  const textInputRef = useRef<TextInput>(null);
  
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [availableOptions, setAvailableOptions] = useState<TemplateOption[]>(TEMPLATE_OPTIONS);
  const [currentText, setCurrentText] = useState('');

  // Initialize with existing fileNaming template from user settings
  useEffect(() => {
    console.log("settings", settings);
    if (settings?.fileNaming) {
      console.log('🔧 Initializing FileNaming with existing template:', settings.fileNaming);
      
      // Parse the existing template string to rebuild template items
      const templateString = settings.fileNaming;
      const templateParts = templateString.split('_');
      
      const initialItems: TemplateItem[] = [];
      const remainingOptions = [...TEMPLATE_OPTIONS];
      
      templateParts.forEach((part: string, index: number) => {
        const matchingOption = TEMPLATE_OPTIONS.find(opt => opt.value === part);
        if (matchingOption) {
          initialItems.push({
            id: `${matchingOption.id}-${index}`,
            type: 'button',
            content: matchingOption.label,
            originalOption: matchingOption
          });
          const optionIndex = remainingOptions.findIndex(opt => opt.id === matchingOption.id);
          if (optionIndex > -1) {
            remainingOptions.splice(optionIndex, 1);
          }
        } else if (part.trim()) {
          // This is custom text
          initialItems.push({
            id: `text-${index}`,
            type: 'text',
            content: part
          });
        }
      });
      
      setTemplateItems(initialItems);
      setAvailableOptions(remainingOptions);
    } else {
      const templateString = "{Berri}_{Year}_{Month}_{Day}";
      const templateParts = templateString.split('_');
      const initialItems: TemplateItem[] = [];
      templateParts.forEach((part: string, index: number) => {
        const matchingOption = TEMPLATE_OPTIONS.find(opt => opt.value === part);
        if (matchingOption) {
          initialItems.push({
            id: `${matchingOption.id}-${index}`,
            type: 'button',
            content: matchingOption.label,
            originalOption: matchingOption
          });
        }
      });
      setTemplateItems(initialItems);
      setAvailableOptions(prev => prev.filter(opt => !initialItems.find(item => item.originalOption?.id === opt.id)));
    }
  }, [settings]);

  const handleOptionSelect = (option: TemplateOption) => {
    // Add current text if any
    if (currentText.trim()) {
      const newTextItem: TemplateItem = {
        id: `text-${Date.now()}`,
        type: 'text',
        content: currentText.trim()
      };
      setTemplateItems(prev => [...prev, newTextItem]);
      setCurrentText('');
    }

    // Add button option
    const newButtonItem: TemplateItem = {
      id: `${option.id}-${Date.now()}`,
      type: 'button',
      content: option.label,
      originalOption: option
    };
    
    setTemplateItems(prev => [...prev, newButtonItem]);
    
    // Remove from available options
    setAvailableOptions(prev => prev.filter(opt => opt.id !== option.id));
  };

  const handleRemoveItem = (itemToRemove: TemplateItem) => {
    // Remove from template items
    setTemplateItems(prev => prev.filter(item => item.id !== itemToRemove.id));
    
    // If it was a button, add back to available options
    if (itemToRemove.type === 'button' && itemToRemove.originalOption) {
      setAvailableOptions(prev => {
        const newAvailable = [...prev, itemToRemove.originalOption!];
        // Sort by original order
        return newAvailable.sort((a, b) => {
          const aIndex = TEMPLATE_OPTIONS.findIndex(opt => opt.id === a.id);
          const bIndex = TEMPLATE_OPTIONS.findIndex(opt => opt.id === b.id);
          return aIndex - bIndex;
        });
      });
    }
  };

  const handleTextSubmit = () => {
    if (currentText.trim()) {
      const newTextItem: TemplateItem = {
        id: `text-${Date.now()}`,
        type: 'text',
        content: currentText.trim()
      };
      setTemplateItems(prev => [...prev, newTextItem]);
      setCurrentText('');
    }
  };

  const handleSave = async () => {
    // Add current text if any before saving
    let finalItems = [...templateItems];
    if (currentText.trim()) {
      finalItems.push({
        id: `text-${Date.now()}`,
        type: 'text',
        content: currentText.trim()
      });
    }

    const templateString = finalItems.map(item => {
      if (item.type === 'button' && item.originalOption) {
        return item.originalOption.value;
      }
      return item.content;
    }).join('_');
    
    const displayString = finalItems.map(item => item.content).join(' + ');
    
    console.log('💾 Saving fileNaming template:', templateString);
    
    try {
      // Update user settings with the new fileNaming template
      const success = await updateUserSettings({ fileNaming: templateString });
      
      if (success) {
        console.log('✅ FileNaming template saved successfully');
        
        // Refresh user data to get updated settings
        await dispatch(refreshUser());
        console.log('✅ User data refreshed after fileNaming save');
        
        Alert.alert(
          'Template Saved',
'',          [
            { 
              text: 'OK', 
              onPress: () => navigation.goBack() 
            }
          ]
        );
      } else {
        console.error('❌ Failed to save fileNaming template');
        Alert.alert(
          'Error',
          'Failed to save template. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Error saving fileNaming template:', error);
      Alert.alert(
        'Error',
        'An error occurred while saving the template.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <Layout type="dark" headerTitle="File Naming Template" showBackButton={true}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Edit Label */}
          <Text style={styles.editLabel}>EDIT</Text>

          {/* Template Preview Box */}
          <View style={styles.templateBox}>
            <View style={styles.templateContent}>
              {templateItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.templateItem,
                    item.type === 'button' ? styles.buttonItem : styles.textItem
                  ]}
                  onPress={() => handleRemoveItem(item)}
                >
                  <Text style={[
                    styles.templateItemText,
                    item.type === 'button' ? styles.buttonItemText : styles.textItemText
                  ]}>
                    {item.content}
                  </Text>
                </TouchableOpacity>
              ))}
              
              {/* Text Input */}
              <TextInput
                ref={textInputRef}
                style={styles.textInput}
                value={currentText}
                onChangeText={setCurrentText}
                onSubmitEditing={handleTextSubmit}
                placeholder={templateItems.length === 0 ? "Tap options below or type here..." : ""}
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                multiline={false}
                returnKeyType="done"
              />
            </View>
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
  templateContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  templateItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 4,
    marginBottom: 4,
  },
  buttonItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  textItem: {
    backgroundColor: 'rgba(100, 150, 255, 0.8)',
  },
  templateItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonItemText: {
    color: '#333',
  },
  textItemText: {
    color: 'white',
  },
  textInput: {
    flex: 1,
    minWidth: 100,
    color: 'white',
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
  },
  placeholderText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
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
    fontSize: 16,
    fontWeight: '500',
  },
  saveButtonContainer: {
    marginTop: 20,
  },
});

export default FileNamingScreen;