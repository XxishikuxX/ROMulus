import { Outlet, Navigate } from 'react-router-dom';
import { Gamepad2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-indigo-950 flex">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-purple-600/20"></div>
        <div className="relative z-10 text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl">
            <Gamepad2 className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">ROMulus</h1>
          <p className="text-xl text-gray-300 max-w-md">
            Your ultimate retro gaming platform. Play classic games anywhere.
          </p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md"><Outlet /></div>
      </div>
    </div>
  );
}
