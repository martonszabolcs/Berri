import React, { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Text, Button } from '../index';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { connectCloudStorage, disconnectCloudStorage } from '../../store/settingsSlice';

interface CloudStorageConnectorProps {
  storageType: 'googleDrive' | 'oneDrive' | 'dropbox';
  onConnectionChange?: (isConnected: boolean, storageType: 'googleDrive' | 'oneDrive' | 'dropbox') => void;
  style?: any;
}

export const CloudStorageConnector: React.FC<CloudStorageConnectorProps> = ({
  storageType,
  onConnectionChange,
  style,
}) => {
  const dispatch = useAppDispatch();
  const { connectionStatus, isLoading } = useAppSelector((state) => state.settings);
  const [isProcessing, setIsProcessing] = useState(false);

  const connected = connectionStatus[storageType];

  const getStorageDisplayName = (type: 'googleDrive' | 'oneDrive' | 'dropbox'): string => {
    switch (type) {
      case 'dropbox':
        return 'Dropbox';
      case 'googleDrive':
        return 'Google Drive';
      case 'oneDrive':
        return 'OneDrive';
      default:
        return type;
    }
  };

  const handleConnect = async () => {
    try {
      setIsProcessing(true);
      console.log('🚀 CloudStorageConnector: Dispatching connectCloudStorage');
      
      const result = await dispatch(connectCloudStorage(storageType));
      
      if (connectCloudStorage.fulfilled.match(result)) {
        Alert.alert(
          'Sikeresen csatlakoztatva!',
          `${getStorageDisplayName(storageType)} sikeresen csatlakoztatva.`,
          [{ text: 'OK' }]
        );
        onConnectionChange?.(true, storageType);
      } else {
        Alert.alert(
          'Csatlakoztatás sikertelen',
          result.error?.message || `Nem sikerült csatlakozni a ${getStorageDisplayName(storageType)}-hoz.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error(`Error connecting to ${storageType}:`, error);
      Alert.alert(
        'Hiba',
        'Váratlan hiba történt a csatlakoztatás során.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Kapcsolat bontása',
      `Biztosan bontani szeretnéd a kapcsolatot a ${getStorageDisplayName(storageType)}-dal?`,
      [
        { text: 'Mégse', style: 'cancel' },
        {
          text: 'Igen',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsProcessing(true);
              console.log('🚀 CloudStorageConnector: Dispatching disconnectCloudStorage');
              
              const result = await dispatch(disconnectCloudStorage(storageType));
              
              if (disconnectCloudStorage.fulfilled.match(result)) {
                Alert.alert(
                  'Kapcsolat bontva',
                  `${getStorageDisplayName(storageType)} kapcsolat sikeresen bontva.`,
                  [{ text: 'OK' }]
                );
                onConnectionChange?.(false, storageType);
              } else {
                Alert.alert(
                  'Hiba',
                  'Nem sikerült bontani a kapcsolatot.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              console.error(`Error disconnecting from ${storageType}:`, error);
              Alert.alert(
                'Hiba',
                'Váratlan hiba történt a kapcsolat bontása során.',
                [{ text: 'OK' }]
              );
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const renderConnectedStatus = () => (
    <View style={styles.connectedContainer}>
      <View style={styles.statusIndicator}>
        <View style={styles.connectedDot} />
        <Text style={styles.connectedText}>Csatlakoztatva</Text>
      </View>
      <Button
        title="Kapcsolat bontása"
        onPress={handleDisconnect}
        disabled={isProcessing || isLoading}
        size="small"
        variant="outline"
        buttonStyle={styles.disconnectButton}
      />
    </View>
  );

  const renderDisconnectedStatus = () => (
    <View style={styles.disconnectedContainer}>
      <View style={styles.statusIndicator}>
        <View style={styles.disconnectedDot} />
        <Text style={styles.disconnectedText}>Nem csatlakoztatva</Text>
      </View>
      <Button
        title="Csatlakoztatás"
        onPress={handleConnect}
        disabled={isProcessing || isLoading}
        size="small"
        buttonStyle={styles.connectButton}
      />
    </View>
  );

  if (isLoading || isProcessing) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>
            {isProcessing ? 'Feldolgozás...' : 'Betöltés...'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.storageTitle}>{getStorageDisplayName(storageType)}</Text>
      </View>
      
      {connected ? renderConnectedStatus() : renderDisconnectedStatus()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  header: {
    marginBottom: 12,
  },
  storageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  connectedContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  disconnectedContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#28a745',
    marginRight: 8,
  },
  disconnectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc3545',
    marginRight: 8,
  },
  connectedText: {
    color: '#28a745',
    fontSize: 14,
    fontWeight: '500',
  },
  disconnectedText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '500',
  },
  connectButton: {
    minWidth: 120,
  },
  disconnectButton: {
    minWidth: 120,
    borderColor: '#dc3545',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
});