import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
}

interface Preferences {
  theme: 'dark' | 'light' | 'system';
  accentColor: string;
  sidebarCollapsed: boolean;
  gridSize: 'small' | 'medium' | 'large';
  showBoxArt: boolean;
  preferredQuality: '720p' | '1080p' | '4k';
  lowLatencyMode: boolean;
  controllerConfig?: Record<string, any>;
}

interface AuthState {
  user: User | null;
  preferences: Preferences | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  updatePreferences: (data: Partial<Preferences>) => void;
  refreshAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      preferences: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      initialize: async () => {
        const { token, refreshToken } = get();
        
        if (!token) {
          set({ isLoading: false });
          return;
        }

        try {
          // Verify token is still valid
          const response = await api.get('/auth/verify');
          
          if (response.data.valid) {
            set({ 
              user: response.data.user,
              isAuthenticated: true,
              isLoading: false 
            });
            
            // Fetch preferences
            try {
              const prefsResponse = await api.get('/users/me/preferences');
              set({ preferences: prefsResponse.data });
            } catch {}
          } else {
            // Try to refresh
            const refreshed = await get().refreshAuth();
            if (!refreshed) {
              get().logout();
            }
          }
        } catch (error) {
          // Try to refresh token
          const refreshed = await get().refreshAuth();
          if (!refreshed) {
            get().logout();
          }
        }
        
        set({ isLoading: false });
      },

      login: async (email: string, password: string) => {
        const response = await api.post('/auth/login', { email, password });
        
        const { user, token, refreshToken } = response.data;
        
        set({
          user,
          token,
          refreshToken,
          preferences: user.preferences,
          isAuthenticated: true
        });
      },

      register: async (email: string, username: string, password: string) => {
        const response = await api.post('/auth/register', { 
          email, 
          username, 
          password 
        });
        
        const { user, token, refreshToken } = response.data;
        
        set({
          user,
          token,
          refreshToken,
          isAuthenticated: true
        });
      },

      logout: () => {
        api.post('/auth/logout').catch(() => {});
        
        set({
          user: null,
          preferences: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false
        });
      },

      updateUser: (data: Partial<User>) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...data } });
        }
      },

      updatePreferences: (data: Partial<Preferences>) => {
        const { preferences } = get();
        set({ preferences: { ...preferences, ...data } as Preferences });
      },

      refreshAuth: async () => {
        const { refreshToken } = get();
        
        if (!refreshToken) {
          return false;
        }

        try {
          const response = await api.post('/auth/refresh', { refreshToken });
          
          set({
            token: response.data.token,
            refreshToken: response.data.refreshToken
          });
          
          return true;
        } catch {
          return false;
        }
      }
    }),
    {
      name: 'romulus-auth',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken
      })
    }
  )
);
