import React, { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar, Platform, View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import KeepAwake from 'react-native-keep-awake';

// Screens
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import BrowseScreen from './src/screens/BrowseScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import GamePlayerScreen from './src/screens/GamePlayerScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ServerConnectScreen from './src/screens/ServerConnectScreen';
import ControllerSetupScreen from './src/screens/ControllerSetupScreen';

// Stores
import { useAuthStore } from './src/stores/authStore';
import { useServerStore } from './src/stores/serverStore';
import { useControllerStore } from './src/stores/controllerStore';

// Theme
const ROMulusTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: '#3b82f6',
    background: '#030305',
    card: '#08080e',
    text: '#f4f4f5',
    border: 'rgba(255,255,255,0.04)',
    notification: '#ec4899',
  },
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Navigator for main app
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#08080e',
          borderTopColor: 'rgba(255,255,255,0.04)',
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#71717a',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="Browse" 
        component={BrowseScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>🎮</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="Library" 
        component={LibraryScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>📚</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>⚙️</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Auth Stack
function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#030305' },
      }}
    >
      <Stack.Screen name="ServerConnect" component={ServerConnectScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

// Main App Navigator
function AppNavigator() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { isConnected, isLoading: serverLoading } = useServerStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize app
    const init = async () => {
      // Check stored credentials
      await useAuthStore.getState().checkAuth();
      await useServerStore.getState().loadSavedServer();
      setIsReady(true);
    };
    init();
  }, []);

  if (!isReady || authLoading || serverLoading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#030305' },
        animation: 'fade',
      }}
    >
      {!isConnected || !isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen 
            name="GamePlayer" 
            component={GamePlayerScreen}
            options={{
              orientation: 'landscape',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen name="ControllerSetup" component={ControllerSetupScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

// Main App Component
export default function App() {
  const { initializeController } = useControllerStore();

  useEffect(() => {
    // Initialize controller detection
    initializeController();

    // Keep screen awake during gameplay
    KeepAwake.activate();

    return () => {
      KeepAwake.deactivate();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar 
          barStyle="light-content" 
          backgroundColor="#030305"
          translucent={true}
        />
        <NavigationContainer theme={ROMulusTheme}>
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
