/**
 * ROMulus Mobile App Entry Point
 * @format
 */

import { AppRegistry, LogBox, Platform } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Ignore specific warnings in development
LogBox.ignoreLogs([
  'ViewPropTypes will be removed',
  'ColorPropType will be removed',
  'Sending `onAnimatedValueUpdate`',
  'Non-serializable values were found in the navigation state',
]);

// Register the main component
AppRegistry.registerComponent(appName, () => App);

// For web support (if needed)
if (Platform.OS === 'web') {
  const rootTag = document.getElementById('root') || document.getElementById('app');
  AppRegistry.runApplication(appName, { rootTag });
}
