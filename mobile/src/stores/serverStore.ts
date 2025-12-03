import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ServerState {
  serverUrl: string | null;
  isConnected: boolean;
  isLoading: boolean;
  authToken: string | null;
  connect: (url: string) => Promise<void>;
  disconnect: () => void;
  loadSavedServer: () => Promise<void>;
}

export const useServerStore = create<ServerState>((set) => ({
  serverUrl: null,
  isConnected: false,
  isLoading: true,
  authToken: null,
  
  connect: async (url) => {
    await AsyncStorage.setItem('serverUrl', url);
    set({ serverUrl: url, isConnected: true });
  },
  
  disconnect: () => {
    set({ serverUrl: null, isConnected: false });
  },
  
  loadSavedServer: async () => {
    const url = await AsyncStorage.getItem('serverUrl');
    if (url) {
      set({ serverUrl: url, isConnected: true, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },
}));
