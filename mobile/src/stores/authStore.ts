import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  token: null,
  
  login: async (email, password) => {
    // Implementation
  },
  
  logout: async () => {
    await AsyncStorage.removeItem('authToken');
    set({ isAuthenticated: false, user: null, token: null });
  },
  
  checkAuth: async () => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      set({ isAuthenticated: true, token, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },
}));
