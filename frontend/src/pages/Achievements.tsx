import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star, Medal, Lock, CheckCircle, Clock, TrendingUp, Search, Filter } from 'lucide-react';

const achievements = [
  { id: 1, title: 'First Steps', description: 'Complete your first game', points: 10, earned: true, earnedDate: '2024-01-15', icon: '🎮', rarity: 'common' },
  { id: 2, title: 'Speed Demon', description: 'Complete Sonic the Hedgehog 2 in under 1 hour', points: 50, earned: true, earnedDate: '2024-01-20', icon: '⚡', rarity: 'rare' },
  { id: 3, title: 'RPG Master', description: 'Play 100 hours of RPG games', points: 100, earned: true, earnedDate: '2024-02-01', icon: '⚔️', rarity: 'epic' },
  { id: 4, title: 'Collector', description: 'Add 50 games to your library', points: 25, earned: true, earnedDate: '2024-02-10', icon: '📚', rarity: 'common' },
  { id: 5, title: 'Social Butterfly', description: 'Add 10 friends', points: 15, earned: false, progress: 7, total: 10, icon: '👥', rarity: 'common' },
  { id: 6, title: 'Marathon Runner', description: 'Play for 24 hours total', points: 30, earned: false, progress: 18, total: 24, icon: '🏃', rarity: 'uncommon' },
  { id: 7, title: 'Retro Legend', description: 'Complete 10 games from the 90s', points: 75, earned: false, progress: 4, total: 10, icon: '🏆', rarity: 'rare' },
  { id: 8, title: 'Perfectionist', description: 'Get 100% completion on any game', points: 150, earned: false, icon: '💯', rarity: 'legendary' },
];

const stats = {
  totalPoints: 185,
  totalEarned: 4,
  totalAvailable: 8,
  rank: 'Silver',
  nextRank: 'Gold',
  pointsToNext: 115,
};

const rarityColors = {
  common: 'from-gray-500 to-gray-600',
  uncommon: 'from-green-500 to-emerald-600',
  rare: 'from-blue-500 to-indigo-600',
  epic: 'from-purple-500 to-pink-600',
  legendary: 'from-yellow-500 to-orange-500',
};

export default function Achievements() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'earned' | 'locked'>('all');

  const filteredAchievements = achievements.filter(a => {
    if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterStatus === 'earned' && !a.earned) return false;
    if (filterStatus === 'locked' && a.earned) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold">Achievements</h1>
          <p className="text-gray-400 mt-1">Track your gaming milestones</p>
        </div>

        {/* Stats Cards */}
        <div className="flex items-center gap-4">
          <div className="p-4 bg-[#0a0a12] border border-white/[0.06] rounded-2xl text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center mx-auto mb-2">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <p className="text-2xl font-bold text-yellow-400">{stats.totalPoints}</p>
            <p className="text-xs text-gray-500">Points</p>
          </div>
          <div className="p-4 bg-[#0a0a12] border border-white/[0.06] rounded-2xl text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <p className="text-2xl font-bold text-green-400">{stats.totalEarned}/{stats.totalAvailable}</p>
            <p className="text-xs text-gray-500">Earned</p>
          </div>
          <div className="p-4 bg-[#0a0a12] border border-white/[0.06] rounded-2xl text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center mx-auto mb-2">
              <Medal className="w-6 h-6 text-white" />
            </div>
            <p className="text-2xl font-bold text-cyan-400">{stats.rank}</p>
            <p className="text-xs text-gray-500">Rank</p>
          </div>
        </div>
      </div>

      {/* Rank Progress */}
      <div className="p-6 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 border border-white/[0.06] rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold">Rank Progress</span>
          </div>
          <span className="text-sm text-gray-400">{stats.pointsToNext} points to {stats.nextRank}</span>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '65%' }}
            transition={{ duration: 1, delay: 0.3 }}
            className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-full"
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>{stats.rank}</span>
          <span>{stats.nextRank}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search achievements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[#0a0a12] border border-white/[0.06] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="flex items-center gap-2">
          {(['all', 'earned', 'locked'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
                filterStatus === status
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                  : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredAchievements.map((achievement, index) => (
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`relative p-5 bg-[#0a0a12] border rounded-2xl transition-all ${
              achievement.earned
                ? 'border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-transparent'
                : 'border-white/[0.04] hover:border-white/20'
            }`}
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={`relative w-14 h-14 rounded-xl bg-gradient-to-br ${rarityColors[achievement.rarity as keyof typeof rarityColors]} flex items-center justify-center text-2xl flex-shrink-0 ${!achievement.earned && 'opacity-50 grayscale'}`}>
                {achievement.icon}
                {achievement.earned && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                )}
                {!achievement.earned && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gray-600 rounded-full flex items-center justify-center">
                    <Lock className="w-3 h-3 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`font-semibold ${achievement.earned ? 'text-white' : 'text-gray-400'}`}>
                    {achievement.title}
                  </h3>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${
                    achievement.earned
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-white/5 text-gray-500'
                  }`}>
                    <Star className="w-3 h-3" />
                    {achievement.points}
                  </div>
                </div>
                
                <p className="text-sm text-gray-500 mt-1">{achievement.description}</p>

                {/* Progress bar for locked achievements */}
                {!achievement.earned && achievement.progress !== undefined && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500">Progress</span>
                      <span className="text-gray-400">{achievement.progress}/{achievement.total}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full"
                        style={{ width: `${(achievement.progress! / achievement.total!) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Earned date */}
                {achievement.earned && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    Earned {new Date(achievement.earnedDate!).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            {/* Rarity indicator */}
            <div className="absolute top-3 right-3">
              <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize bg-gradient-to-r ${rarityColors[achievement.rarity as keyof typeof rarityColors]} bg-clip-text text-transparent`}>
                {achievement.rarity}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
