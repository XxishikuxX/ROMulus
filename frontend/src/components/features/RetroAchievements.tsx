import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Link2, Unlink, Medal, Star, Clock, Gamepad2, CheckCircle, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

interface RAProfile {
  username: string;
  points: number;
  softcorePoints?: number;
  rank: number;
  motto?: string;
  userPic: string;
  memberSince?: string;
  richPresence?: string;
}

interface RAAchievement {
  id: number;
  title: string;
  description: string;
  points: number;
  badgeUrl: string;
  badgeLockedUrl: string;
  isEarned: boolean;
  isEarnedHardcore: boolean;
  dateEarned?: string;
}

export default function RetroAchievements() {
  const queryClient = useQueryClient();
  const [linkForm, setLinkForm] = useState({ username: '', apiKey: '' });
  const [showLinkForm, setShowLinkForm] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['ra-profile'],
    queryFn: async () => {
      const res = await api.get('/retroachievements/profile');
      return res.data;
    },
    retry: false,
  });

  const linkMutation = useMutation({
    mutationFn: async (data: { username: string; apiKey: string }) => {
      const res = await api.post('/retroachievements/link', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ra-profile'] });
      setShowLinkForm(false);
      setLinkForm({ username: '', apiKey: '' });
      toast.success('RetroAchievements account linked!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to link account');
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/retroachievements/unlink');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ra-profile'] });
      toast.success('Account unlinked');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  // Not linked state
  if (!profile?.profile) {
    return (
      <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">RetroAchievements</h3>
            <p className="text-sm text-gray-400">Earn achievements in retro games</p>
          </div>
        </div>

        {!showLinkForm ? (
          <div className="space-y-4">
            <p className="text-gray-300">
              Link your RetroAchievements account to track achievements, compete on leaderboards, 
              and show off your gaming accomplishments!
            </p>
            <button
              onClick={() => setShowLinkForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-xl transition-colors"
            >
              <Link2 className="w-4 h-4" />
              Link Account
            </button>
            <p className="text-xs text-gray-500">
              Don't have an account?{' '}
              <a href="https://retroachievements.org" target="_blank" rel="noopener noreferrer" 
                className="text-indigo-400 hover:underline">
                Create one at retroachievements.org
              </a>
            </p>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); linkMutation.mutate(linkForm); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
              <input
                type="text"
                value={linkForm.username}
                onChange={(e) => setLinkForm(f => ({ ...f, username: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white"
                placeholder="Your RA username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">API Key</label>
              <input
                type="password"
                value={linkForm.apiKey}
                onChange={(e) => setLinkForm(f => ({ ...f, apiKey: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white"
                placeholder="Your RA API key"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Find your API key in your{' '}
                <a href="https://retroachievements.org/settings" target="_blank" rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline">
                  RA settings
                </a>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={linkMutation.isPending}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-lg disabled:opacity-50"
              >
                {linkMutation.isPending ? 'Linking...' : 'Link Account'}
              </button>
              <button
                type="button"
                onClick={() => setShowLinkForm(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // Linked state
  const { profile: raProfile, recentAchievements } = profile;

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <img
              src={raProfile.userPic}
              alt={raProfile.username}
              className="w-16 h-16 rounded-xl"
            />
            <div>
              <h3 className="text-xl font-bold text-white">{raProfile.username}</h3>
              {raProfile.motto && <p className="text-sm text-gray-400">{raProfile.motto}</p>}
              {raProfile.richPresence && (
                <p className="text-sm text-indigo-400 flex items-center gap-1 mt-1">
                  <Gamepad2 className="w-4 h-4" />
                  {raProfile.richPresence}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => unlinkMutation.mutate()}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Unlink account"
          >
            <Unlink className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-700/30 rounded-xl p-4 text-center">
            <Trophy className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{raProfile.points?.toLocaleString()}</p>
            <p className="text-sm text-gray-400">Points</p>
          </div>
          <div className="bg-gray-700/30 rounded-xl p-4 text-center">
            <Medal className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">#{raProfile.rank?.toLocaleString()}</p>
            <p className="text-sm text-gray-400">Rank</p>
          </div>
          <div className="bg-gray-700/30 rounded-xl p-4 text-center">
            <Star className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{raProfile.softcorePoints?.toLocaleString() || 0}</p>
            <p className="text-sm text-gray-400">Softcore</p>
          </div>
        </div>
      </div>

      {/* Recent Achievements */}
      {recentAchievements?.length > 0 && (
        <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            Recent Achievements
          </h4>
          <div className="space-y-3">
            {recentAchievements.map((achievement: any) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 p-3 bg-gray-700/30 rounded-xl"
              >
                <img
                  src={achievement.badgeUrl}
                  alt={achievement.title}
                  className="w-12 h-12 rounded-lg"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{achievement.title}</p>
                  <p className="text-sm text-gray-400 truncate">{achievement.gameTitle}</p>
                </div>
                <div className="text-right">
                  <p className="text-yellow-400 font-medium">{achievement.points} pts</p>
                  {achievement.hardcore && (
                    <span className="text-xs text-red-400">HARDCORE</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Achievement display for game page
export function GameAchievements({ gameId }: { gameId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ra-game', gameId],
    queryFn: async () => {
      const res = await api.get(`/retroachievements/game/${gameId}`);
      return res.data;
    },
    retry: false,
  });

  if (isLoading) {
    return <div className="animate-pulse bg-gray-800/50 rounded-xl h-48" />;
  }

  if (!data?.achievements) {
    return null;
  }

  const { progress, achievements } = data;

  return (
    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Achievements
        </h4>
        <div className="text-right">
          <p className="text-white font-medium">
            {progress.numEarned} / {progress.numAchievements}
          </p>
          <p className="text-sm text-gray-400">{progress.completionPercentage}% Complete</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-700 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all"
          style={{ width: `${progress.completionPercentage}%` }}
        />
      </div>

      {/* Achievement list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
        {achievements.map((achievement: RAAchievement) => (
          <div
            key={achievement.id}
            className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
              achievement.isEarned
                ? 'bg-yellow-500/10 border border-yellow-500/30'
                : 'bg-gray-700/30 border border-transparent'
            }`}
          >
            <div className="relative">
              <img
                src={achievement.isEarned ? achievement.badgeUrl : achievement.badgeLockedUrl}
                alt={achievement.title}
                className={`w-12 h-12 rounded-lg ${!achievement.isEarned && 'opacity-50 grayscale'}`}
              />
              {achievement.isEarned && (
                <CheckCircle className="absolute -bottom-1 -right-1 w-5 h-5 text-green-400 bg-gray-900 rounded-full" />
              )}
              {!achievement.isEarned && (
                <Lock className="absolute -bottom-1 -right-1 w-5 h-5 text-gray-400 bg-gray-900 rounded-full" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate ${achievement.isEarned ? 'text-white' : 'text-gray-400'}`}>
                {achievement.title}
              </p>
              <p className="text-xs text-gray-500 truncate">{achievement.description}</p>
            </div>
            <div className="text-right">
              <p className={`font-medium ${achievement.isEarned ? 'text-yellow-400' : 'text-gray-500'}`}>
                {achievement.points}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
