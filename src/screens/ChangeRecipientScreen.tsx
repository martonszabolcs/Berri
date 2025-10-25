import React, { useState } from 'react';
import { View, StyleSheet, Image, ScrollView } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Layout, Button, TextInput, Text } from '../components';

type RootStackParamList = {
  ChangeRecipientScreen: { destinationId: string };
};

type ChangeRecipientScreenRouteProp = RouteProp<RootStackParamList, 'ChangeRecipientScreen'>;
type ChangeRecipientScreenNavigationProp = StackNavigationProp<RootStackParamList>;

interface EmailInput {
  id: string;
  value: string;
}

const ChangeRecipientScreen = () => {
  const navigation = useNavigation<ChangeRecipientScreenNavigationProp>();
  const route = useRoute<ChangeRecipientScreenRouteProp>();
  const { destinationId } = route.params;
  
  const [emails, setEmails] = useState<EmailInput[]>([
    { id: '1', value: '' }
  ]);

  // Get destination image based on type
  const getDestinationImage = (type: string) => {
    switch (type) {
      case '1': return require('../assets/dest_1.png');
      case '2': return require('../assets/dest_2.png');
      case '3': return require('../assets/dest_3.png');
      case '4': return require('../assets/dest_4.png');
      case '5': return require('../assets/dest_5.png');
      case '6': return require('../assets/dest_6.png');
      case '7': return require('../assets/dest_7.png');
      default: return require('../assets/dest_1.png');
    }
  };

  const handleEmailChange = (id: string, value: string) => {
    setEmails(prevEmails => {
      const updatedEmails = prevEmails.map(email =>
        email.id === id ? { ...email, value } : email
      );

      // If this is the last input and it has content, and we have less than 5 emails, add a new one
      const currentEmailIndex = updatedEmails.findIndex(email => email.id === id);
      const isLastEmail = currentEmailIndex === updatedEmails.length - 1;
      const hasContent = value.trim().length > 0;
      const canAddMore = updatedEmails.length < 5;

      if (isLastEmail && hasContent && canAddMore) {
        const newId = (parseInt(updatedEmails[updatedEmails.length - 1].id, 10) + 1).toString();
        updatedEmails.push({ id: newId, value: '' });
      }

      return updatedEmails;
    });
  };

  const handleDeleteEmail = (id: string) => {
    setEmails(prevEmails => {
      const filtered = prevEmails.filter(email => email.id !== id);
      // Always keep at least one input
      return filtered.length === 0 ? [{ id: '1', value: '' }] : filtered;
    });
  };

  const handleSave = () => {
    // Filter out empty emails for saving
    const validEmails = emails.filter(email => email.value.trim().length > 0);
    console.log('Saving emails:', validEmails.map(email => email.value));
    // Here you would typically save to your state management or API
    navigation.goBack();
  };

  return (
    <Layout type="default" headerTitle="Change Recipient">
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Destination Info */}
        <View style={styles.destinationInfo}>
          <Image 
            source={getDestinationImage(destinationId)} 
            style={styles.destinationImage}
          />
          <View style={styles.emailContainer}>
            <Text style={styles.emailLabel}>Email</Text>
            <Text style={styles.emailText}>test@email.com</Text>
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <Button
            title="Save"
            variant="normal"
            size="medium"
            buttonStyle={styles.saveButton}
            onPress={handleSave}
          />
        </View>

        {/* Email Inputs */}
        <View style={styles.emailInputsContainer}>
          {emails.map((email, index) => (
            <View key={email.id} style={styles.emailInputRow}>
              <View style={styles.textInputContainer}>
                <TextInput
                  placeholder={`Email ${index + 1}`}
                  value={email.value}
                  onChangeText={(value) => handleEmailChange(email.id, value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              
              {/* Show delete button only if there's content AND it's not the only input, OR if there are multiple inputs and this one has content */}
              {(email.value.trim().length > 0 && emails.length > 1) && (
                <Button
                  title="DELETE"
                  variant="destructive"
                  size="small"
                  buttonStyle={styles.deleteButton}
                  onPress={() => handleDeleteEmail(email.id)}
                />
              )}
            </View>
          ))}
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
  destinationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    paddingVertical: 20,
  },
  destinationImage: {
    width: 60,
    height: 60,
    marginRight: 20,
  },
  emailContainer: {
    flex: 1,
  },
  emailLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  emailText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
  },
  saveButtonContainer: {
    marginBottom: 30,
  },
  saveButton: {
    width: '100%',
  },
  emailInputsContainer: {
    gap: 15,
    paddingBottom: 100, // Extra space for tab bar
  },
  emailInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textInputContainer: {
    flex: 1,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});

export default ChangeRecipientScreen;