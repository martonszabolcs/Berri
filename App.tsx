import React, { useEffect } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { store } from './src/store';
import Navigation from './src/navigation';
// import { generateTestImage, generateColorfulTestImage, generateTestPDF, getGeneratedFileHistory } from './src/utils/testImageGenerator';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  // Generate test files on app startup
  // useEffect(() => {
  //   const generateTestFiles = async () => {
  //     console.log('🚀 ========================================');
  //     console.log('🚀 BERRI APP: Generating test files on startup...');
  //     console.log('🚀 ========================================');
      
  //     try {
  //       // Generate a simple test image
  //       console.log('1️⃣ Generating simple test image...');
  //       const testImage = await generateTestImage('berri-test-simple.jpg');
  //       if (testImage) {
  //         console.log('✅ Simple test image generated:', testImage.name);
  //         console.log('📍 Location:', testImage.path);
  //       }
        
  //       // Generate a colorful test image
  //       console.log('2️⃣ Generating colorful test image...');
  //       const colorfulImage = await generateColorfulTestImage('berri-test-colorful.jpg');
  //       if (colorfulImage) {
  //         console.log('✅ Colorful test image generated:', colorfulImage.name);
  //         console.log('📍 Location:', colorfulImage.path);
  //       }
        
  //       // Generate a test PDF
  //       console.log('3️⃣ Generating test PDF...');
  //       const testPdf = await generateTestPDF('berri-test-document.pdf');
  //       if (testPdf) {
  //         console.log('✅ Test PDF generated:', testPdf.name);
  //         console.log('📍 Location:', testPdf.path);
  //       }
        
  //       console.log('🎉 ========================================');
  //       console.log('🎉 ALL TEST FILES GENERATED SUCCESSFULLY!');
  //       console.log('🎉 ========================================');
        
  //       // Display current history
  //       const history = await getGeneratedFileHistory();
  //       console.log('📋 Current AsyncStorage history:');
  //       console.log('📋 Total entries:', history.length);
  //       history.forEach((entry, index) => {
  //         console.log(`📋 ${index + 1}. Destination ${entry.destination} (${new Date(entry.timestamp).toLocaleString()})`);
  //         console.log(`    Files: ${entry.files.length}`);
  //         entry.files.forEach((file, fileIndex) => {
  //           console.log(`    ${fileIndex + 1}. ${file.filename}`);
  //           console.log(`       URL: ${file.url}`);
  //         });
  //       });
        
  //     } catch (error) {
  //       console.error('❌ ========================================');
  //       console.error('❌ ERROR GENERATING TEST FILES:', error);
  //       console.error('❌ ========================================');
  //     }
  //   };

  //   generateTestFiles();
  // }, []);

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <Navigation />
      </SafeAreaProvider>
    </Provider>
  );
}

export default App;
