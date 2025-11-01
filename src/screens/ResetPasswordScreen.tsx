import React, { useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, TextInput as RNTextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Layout, TextInput, Button, Text } from '../components';
import { useAppDispatch } from '../store/hooks';
import { resetPassword } from '../store/appSlice';

type RootStackParamList = {
  LoginScreen: undefined;
};

type ResetPasswordScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'LoginScreen'
>;

const ResetPasswordScreen = () => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<ResetPasswordScreenNavigationProp>();
  const dispatch = useAppDispatch();

  // Refs for the code input fields
  const codeRefs = useRef<(RNTextInput | null)[]>([]);

  const handleCodeChange = (value: string, index: number) => {
    if (value.length > 1) return; // Only allow single character
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto focus next field
    if (value && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyPress = (e: any, index: number) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handleResetPassword = async () => {
    const codeString = code.join('');
    
    if (codeString.length !== 6) {
      Alert.alert('Hiba', 'Kérlek add meg a 6 karakteres kódot!');
      return;
    }

    if (!newPassword || !confirmPassword) {
      Alert.alert('Hiba', 'Kérlek töltsd ki az összes mezőt!');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Hiba', 'A jelszavak nem egyeznek!');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Hiba', 'A jelszónak legalább 6 karakter hosszúnak kell lennie!');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🚀 ResetPasswordScreen: Dispatching resetPassword thunk');
      const result = await dispatch(resetPassword({ token: codeString, password: newPassword }));
      
      if (resetPassword.fulfilled.match(result)) {
        console.log('✅ ResetPasswordScreen: Reset password successful');
        Alert.alert(
          'Sikeres változtatás',
          'A jelszavad sikeresen megváltozott!',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('LoginScreen'),
            },
          ]
        );
      } else {
        console.error('❌ ResetPasswordScreen: Reset password failed', result.error);
        Alert.alert('Hiba', result.error.message || 'Hiba történt a jelszó megváltoztatása során!');
      }
    } catch (error) {
      console.error('❌ ResetPasswordScreen: Reset password exception', error);
      Alert.alert('Hiba', 'Hiba történt a jelszó megváltoztatása során!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout type="auth" headerTitle="Jelszó visszaállítása" showBackButton={true}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.instructionText}>
            Add meg a 6 karakteres kódot amit emailben küldtünk, és válassz új jelszót.
          </Text>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Visszaállítási kód</Text>
            <View style={styles.codeContainer}>
              {code.map((digit, index) => (
                <RNTextInput
                  key={index}
                  ref={(ref) => {codeRefs.current[index] = ref}}
                  style={styles.codeInput}
                  value={digit}
                  onChangeText={(value) => handleCodeChange(value, index)}
                  onKeyPress={(e) => handleCodeKeyPress(e, index)}
                  keyboardType="default"
                  maxLength={1}
                  autoCapitalize="characters"
                  textAlign="center"
                  placeholder="-"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                />
              ))}
            </View>
            
            <Text style={styles.sectionTitle}>Új jelszó</Text>
            <TextInput
              placeholder="Új jelszó"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            
            <TextInput
              placeholder="Új jelszó megerősítése"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <Button
            title={isLoading ? 'Mentés...' : 'Jelszó megváltoztatása'}
            variant="normal"
            size="medium"
            onPress={handleResetPassword}
            disabled={isLoading}
            buttonStyle={styles.resetButton}
          />
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
  instructionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  formSection: {
    gap: 20,
    marginBottom: 40,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  codeInput: {
    width: 45,
    height: 55,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  resetButton: {
    width: '100%',
  },
});

export default ResetPasswordScreen;