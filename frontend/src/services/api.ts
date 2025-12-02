import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from localStorage (persisted by zustand)
    const authData = localStorage.getItem('emuverse-auth');
    if (authData) {
      try {
        const { state } = JSON.parse(authData);
        if (state?.token) {
          config.headers.Authorization = `Bearer ${state.token}`;
        }
      } catch {}
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 - Try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const authData = localStorage.getItem('emuverse-auth');
        if (authData) {
          const { state } = JSON.parse(authData);
          if (state?.refreshToken) {
            const response = await axios.post(`${API_URL}/auth/refresh`, {
              refreshToken: state.refreshToken
            });

            // Update stored tokens
            const newAuthData = {
              state: {
                ...state,
                token: response.data.token,
                refreshToken: response.data.refreshToken
              }
            };
            localStorage.setItem('emuverse-auth', JSON.stringify(newAuthData));

            // Retry original request
            originalRequest.headers.Authorization = `Bearer ${response.data.token}`;
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        // Clear auth and redirect to login
        localStorage.removeItem('emuverse-auth');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// API helper functions
export const romApi = {
  list: (params?: Record<string, any>) => api.get('/roms', { params }),
  get: (id: string) => api.get(`/roms/${id}`),
  search: (query: string) => api.get('/roms/search/autocomplete', { params: { q: query } }),
  getSystems: () => api.get('/roms/systems'),
  update: (id: string, data: any) => api.patch(`/roms/${id}`, data),
  delete: (id: string) => api.delete(`/roms/${id}`),
};

export const libraryApi = {
  get: (params?: Record<string, any>) => api.get('/library', { params }),
  add: (romId: string) => api.post(`/library/${romId}`),
  remove: (romId: string) => api.delete(`/library/${romId}`),
  toggleFavorite: (romId: string) => api.patch(`/library/${romId}/favorite`),
  getRecent: () => api.get('/library/recent'),
  getStats: () => api.get('/library/stats'),
};

export const sessionApi = {
  start: (romId: string, quality?: string) => api.post('/sessions/start', { romId, quality }),
  end: (sessionId: string) => api.post(`/sessions/${sessionId}/end`),
  get: (sessionId: string) => api.get(`/sessions/${sessionId}`),
  getActive: () => api.get('/sessions/active/current'),
  save: (sessionId: string, slot: number) => api.post(`/sessions/${sessionId}/save`, { slot }),
  load: (sessionId: string, slot: number) => api.post(`/sessions/${sessionId}/load`, { slot }),
};

export const socialApi = {
  searchUsers: (query: string) => api.get('/social/users/search', { params: { q: query } }),
  getFriends: () => api.get('/social/friends'),
  getRequests: () => api.get('/social/friends/requests'),
  sendRequest: (userId: string) => api.post(`/social/friends/request/${userId}`),
  acceptRequest: (friendshipId: string) => api.post(`/social/friends/accept/${friendshipId}`),
  declineRequest: (friendshipId: string) => api.delete(`/social/friends/request/${friendshipId}`),
  removeFriend: (userId: string) => api.delete(`/social/friends/${userId}`),
  blockUser: (userId: string) => api.post(`/social/block/${userId}`),
  getActivity: () => api.get('/social/activity'),
};

export const lobbyApi = {
  list: (params?: Record<string, any>) => api.get('/lobbies', { params }),
  get: (id: string) => api.get(`/lobbies/${id}`),
  create: (data: any) => api.post('/lobbies', data),
  join: (id: string, password?: string) => api.post(`/lobbies/${id}/join`, { password }),
  leave: (id: string) => api.post(`/lobbies/${id}/leave`),
  toggleReady: (id: string) => api.post(`/lobbies/${id}/ready`),
  setGame: (id: string, romId: string) => api.patch(`/lobbies/${id}/game`, { romId }),
  start: (id: string) => api.post(`/lobbies/${id}/start`),
  sendMessage: (id: string, content: string) => api.post(`/lobbies/${id}/chat`, { content }),
  kick: (lobbyId: string, userId: string) => api.post(`/lobbies/${lobbyId}/kick/${userId}`),
  invite: (lobbyId: string, userId: string) => api.post(`/lobbies/${lobbyId}/invite/${userId}`),
};

export const statsApi = {
  getOverview: () => api.get('/stats/overview'),
  getPlaytime: (params?: Record<string, any>) => api.get('/stats/playtime', { params }),
  getSystems: () => api.get('/stats/systems'),
  getRecommendations: () => api.get('/stats/recommendations'),
  getAchievements: () => api.get('/stats/achievements'),
  getHistory: (params?: Record<string, any>) => api.get('/stats/history', { params }),
  getLeaderboard: (type?: string) => api.get('/stats/leaderboard', { params: { type } }),
};

export const userApi = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (data: any) => api.patch('/users/me', data),
  changePassword: (currentPassword: string, newPassword: string) => 
    api.post('/users/me/password', { currentPassword, newPassword }),
  getPreferences: () => api.get('/users/me/preferences'),
  updatePreferences: (data: any) => api.patch('/users/me/preferences', data),
  updateController: (config: any) => api.put('/users/me/controller', { config }),
  getNotifications: () => api.get('/users/me/notifications'),
  markNotificationsRead: (ids?: string[]) => api.post('/users/me/notifications/read', { ids }),
  getUser: (userId: string) => api.get(`/users/${userId}`),
};

export const uploadApi = {
  uploadRom: (file: File, data: any, onProgress?: (percent: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value as string);
    });
    
    return api.post('/upload/rom', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      }
    });
  },
  uploadCover: (romId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/upload/cover/${romId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};

export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),
  // Users
  getUsers: (params?: Record<string, any>) => api.get('/admin/users', { params }),
  getUser: (id: string) => api.get(`/admin/users/${id}`),
  createUser: (data: any) => api.post('/admin/users', data),
  updateUser: (id: string, data: any) => api.patch(`/admin/users/${id}`, data),
  banUser: (id: string, reason: string) => api.post(`/admin/users/${id}/ban`, { reason }),
  unbanUser: (id: string) => api.post(`/admin/users/${id}/unban`),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  // ROMs
  getRoms: (params?: Record<string, any>) => api.get('/admin/roms', { params }),
  updateRom: (id: string, data: any) => api.patch(`/admin/roms/${id}`, data),
  deleteRom: (id: string) => api.delete(`/admin/roms/${id}`),
  // Config
  getConfig: () => api.get('/admin/config'),
  updateConfig: (key: string, value: any) => api.put(`/admin/config/${key}`, { value }),
  // Audit
  getAuditLogs: (params?: Record<string, any>) => api.get('/admin/audit', { params }),
  // Sessions
  getActiveSessions: () => api.get('/admin/sessions/active'),
  endSession: (id: string) => api.post(`/admin/sessions/${id}/end`),
};
