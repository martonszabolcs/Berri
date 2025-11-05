import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Layout, Button, Text } from '../components';
import { useAppDispatch } from '../store/hooks';
import { uploadAndSendFile } from '../store/uploadSlice';
import { generateTestImage, getImageUri, getImagePath } from '../utils/testImageGenerator';

const TestUploadScreen = () => {
  const dispatch = useAppDispatch();
  const [generatedFiles, setGeneratedFiles] = useState<Array<{
    name: string;
    path: string;
    uri: string;
    type: 'image' | 'pdf';
  }>>([]);

  useEffect(() => {
    // List the test files that were generated on app startup
    setGeneratedFiles([
      {
        name: 'berri-test-simple.jpg',
        path: getImagePath('berri-test-simple.jpg'),
        uri: getImageUri('berri-test-simple.jpg'),
        type: 'image'
      },
      {
        name: 'berri-test-colorful.jpg',
        path: getImagePath('berri-test-colorful.jpg'),
        uri: getImageUri('berri-test-colorful.jpg'),
        type: 'image'
      },
      {
        name: 'berri-test-document.jpg',
        path: getImagePath('berri-test-colorful.jpg'),
        uri: getImageUri('berri-test-colorful.jpg'),
        type: 'image'
      }
    ]);
  }, []);

  const handleGenerateNew = async () => {
    try {
      console.log('🎨 Generating new test files...');
      
      const timestamp = Date.now();
      const newImage = await generateTestImage(`test-${timestamp}.jpg`);
      
      if (newImage) {
        const newFile = {
          name: newImage.name,
          path: newImage.path,
          uri: newImage.uri,
          type: 'image' as const
        };
        
        setGeneratedFiles(prev => [...prev, newFile]);
        
        Alert.alert(
          'Success',
          `Generated new test file: ${newImage.name}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Error generating new file:', error);
      Alert.alert('Error', 'Failed to generate new test file');
    }
  };

  const handleUploadFile = async (file: typeof generatedFiles[0]) => {
    try {
      console.log('📤 Uploading test file:', file.name);
      
      // Create a File-like object for upload
      const fileObject = {
        uri: file.uri,
        name: file.name,
        type: file.type === 'image' ? 'image/jpeg' : 'application/pdf',
        path: file.path
      };
      
      // Upload to destination type 1 (Cherry)
      const result = await dispatch(uploadAndSendFile({
        type: 1,
        file: fileObject
      })).unwrap();
      
      if (result) {
        Alert.alert(
          'Upload Success',
          `File uploaded successfully!\nSent to: ${result.sentTo.join(', ')}`,
          [{ text: 'OK' }]
        );
      }
      
    } catch (error) {
      console.error('❌ Error uploading file:', error);
      Alert.alert(
        'Upload Error',
        'Failed to upload file. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <Layout type="dark" headerTitle="Test File Upload" showBackButton={true}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          
          <Text style={styles.sectionTitle}>Generated Test Files</Text>
          <Text style={styles.description}>
            These files were generated automatically when the app started. 
            You can use them to test the upload functionality.
          </Text>

          <View style={styles.filesContainer}>
            {generatedFiles.map((file, index) => (
              <View key={index} style={styles.fileItem}>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName}>{file.name}</Text>
                  <Text style={styles.fileType}>
                    {file.type === 'image' ? '📸 Image' : '📄 PDF'}
                  </Text>
                </View>
                <Button
                  title="Upload"
                  variant="outline"
                  size="small"
                  onPress={() => handleUploadFile(file)}
                />
              </View>
            ))}
          </View>

          <View style={styles.actionButtons}>
            <Button
              title="Generate New Test File"
              variant="normal"
              size="medium"
              onPress={handleGenerateNew}
            />
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>ℹ️ How to use:</Text>
            <Text style={styles.infoText}>
              1. Files are generated automatically on app startup{'\n'}
              2. Tap "Upload" next to any file to test upload functionality{'\n'}
              3. Generate new test files with the button above{'\n'}
              4. Files are stored in the device's Documents directory
            </Text>
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
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 30,
    lineHeight: 20,
  },
  filesContainer: {
    gap: 15,
    marginBottom: 30,
  },
  fileItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileInfo: {
    flex: 1,
    marginRight: 15,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  fileType: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  actionButtons: {
    marginBottom: 30,
  },
  infoSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
  },
});

export default TestUploadScreen;