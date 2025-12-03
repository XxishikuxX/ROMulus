import { create } from 'zustand';
import { controllerService } from '../services/ControllerService';

interface ControllerState {
  isConnected: boolean;
  controllerName: string;
  initializeController: () => void;
}

export const useControllerStore = create<ControllerState>((set) => ({
  isConnected: false,
  controllerName: 'No Controller',
  
  initializeController: () => {
    controllerService.initialize();
    controllerService.on('connected', (state) => {
      set({ isConnected: true, controllerName: state.name });
    });
    controllerService.on('disconnected', () => {
      set({ isConnected: false, controllerName: 'No Controller' });
    });
  },
}));
