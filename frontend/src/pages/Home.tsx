import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Play,
  Clock,
  TrendingUp,
  Star,
  ChevronRight,
  Gamepad2,
  Users,
  Trophy,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

const recentGames = [
  { id: 1, title: 'Super Mario World', system: 'SNES', lastPlayed: '2 hours ago', progress: 65, coverColor: 'from-red-500 to-yellow-500' },
  { id: 2, title: 'The Legend of Zelda: OOT', system: 'N64', lastPlayed: 'Yesterday', progress: 32, coverColor: 'from-green-500 to-emerald-600' },
  { id: 3, title: 'Sonic Adventure 2', system: 'Dreamcast', lastPlayed: '3 days ago', progress: 78, coverColor: 'from-blue-500 to-cyan-400' },
  { id: 4, title: 'Pokemon Emerald', system: 'GBA', lastPlayed: 'Last week', progress: 45, coverColor: 'from-emerald-500 to-teal-500' },
];

const trendingGames = [
  { id: 1, title: 'Final Fantasy VII', system: 'PS1', players: 1243, coverColor: 'from-purple-600 to-blue-600' },
  { id: 2, title: 'Super Smash Bros Melee', system: 'GameCube', players: 892, coverColor: 'from-orange-500 to-red-500' },
  { id: 3, title: 'Chrono Trigger', system: 'SNES', players: 756, coverColor: 'from-indigo-500 to-purple-600' },
  { id: 4, title: 'Metal Gear Solid 3', system: 'PS2', players: 621, coverColor: 'from-gray-600 to-gray-800' },
  { id: 5, title: 'Persona 4 Golden', system: 'PS Vita', players: 534, coverColor: 'from-yellow-400 to-orange-500' },
  { id: 6, title: 'Metroid Prime', system: 'GameCube', players: 489, coverColor: 'from-orange-600 to-red-700' },
];

const friendActivity = [
  { id: 1, username: 'GamerPro99', avatar: 'G', game: 'Dark Souls', action: 'started playing', time: '5 min ago', online: true },
  { id: 2, username: 'RetroKing', avatar: 'R', game: 'Earthbound', action: 'earned an achievement in', time: '15 min ago', online: true },
  { id: 3, username: 'PixelQueen', avatar: 'P', game: 'Castlevania: SOTN', action: 'completed', time: '1 hour ago', online: false },
];

const stats = [
  { label: 'Games Played', value: '47', icon: Gamepad2, color: 'from-cyan-500 to-teal-500' },
  { label: 'Hours Played', value: '312', icon: Clock, color: 'from-orange-500 to-amber-500' },
  { label: 'Achievements', value: '156', icon: Trophy, color: 'from-yellow-500 to-orange-500' },
  { label: 'Friends Online', value: '8', icon: Users, color: 'from-emerald-500 to-green-500' },
];

export default function Home() {
  const { user } = useAuthStore();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  return (
    <div className="space-y-8 pb-8">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-600/10 via-cyan-500/5 to-orange-500/5 border border-white/[0.06]"
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/4 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl" />
        </div>

        <div className="relative p-8 lg:p-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 backdrop-blur-sm rounded-full text-sm"
              >
                <Sparkles className="w-4 h-4 text-orange-400" />
                <span className="text-cyan-300">Welcome to EmuVerse</span>
              </motion.div>
              
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="text-4xl lg:text-5xl font-bold"
              >
                {greeting},{' '}
                <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-orange-400 bg-clip-text text-transparent">
                  {user?.username || 'Gamer'}
                </span>
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="text-lg text-gray-300 max-w-xl"
              >
                Ready to continue your adventure? Your games are waiting.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-wrap gap-3 pt-2"
              >
                <Link
                  to="/browse"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-xl font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition-all hover:-translate-y-0.5"
                >
                  <Play className="w-5 h-5" />
                  Browse Games
                </Link>
                <Link
                  to="/library"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.05] hover:bg-orange-500/10 border border-white/[0.08] hover:border-orange-500/30 backdrop-blur-sm rounded-xl font-semibold transition-all"
                >
                  My Library
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-2 gap-4"
            >
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="p-4 bg-[#0a0a12]/80 backdrop-blur-sm rounded-2xl border border-white/[0.06] hover:border-cyan-500/30 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-gray-400">{stat.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Continue Playing */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Continue Playing</h2>
              <p className="text-sm text-gray-400">Pick up where you left off</p>
            </div>
          </div>
          <Link to="/library" className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentGames.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -4 }}
              className="group relative bg-[#0a0a12] rounded-2xl overflow-hidden border border-white/[0.04] hover:border-cyan-500/30 transition-all cursor-pointer"
            >
              <div className={`aspect-[4/3] bg-gradient-to-br ${game.coverColor} relative`}>
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play className="w-6 h-6 text-white ml-1" />
                  </div>
                </div>
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-lg text-xs font-medium">{game.system}</span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors truncate">{game.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{game.lastPlayed}</p>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400">Progress</span>
                    <span className="text-gray-300">{game.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${game.progress}%` }}
                      transition={{ delay: 0.5 + index * 0.1, duration: 0.8 }}
                      className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Trending & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Trending Now</h2>
                <p className="text-sm text-gray-400">Popular with the community</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {trendingGames.map((game, index) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.02 }}
                className="group relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${game.coverColor}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="absolute inset-0 p-4 flex flex-col justify-end">
                  <span className="text-xs font-medium text-white/70 mb-1">{game.system}</span>
                  <h3 className="font-bold text-white leading-tight">{game.title}</h3>
                  <div className="flex items-center gap-1 mt-2 text-xs text-white/60">
                    <Users className="w-3.5 h-3.5" />
                    <span>{game.players} playing</span>
                  </div>
                </div>
                <div className="absolute inset-0 bg-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Friends</h2>
                <p className="text-sm text-gray-400">See what they're playing</p>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a25] rounded-2xl border border-white/5 divide-y divide-white/5">
            {friendActivity.map((friend, index) => (
              <motion.div
                key={friend.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 hover:bg-cyan-500/5 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-sm font-semibold">
                      {friend.avatar}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#1a1a25] ${friend.online ? 'bg-green-500' : 'bg-gray-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-semibold text-white">{friend.username}</span>{' '}
                      <span className="text-gray-400">{friend.action}</span>{' '}
                      <span className="font-medium text-cyan-400">{friend.game}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{friend.time}</p>
                  </div>
                </div>
              </motion.div>
            ))}
            <div className="p-4">
              <Link to="/friends" className="flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                View all friends <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Featured Collections */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Featured Collections</h2>
              <p className="text-sm text-gray-400">Curated game collections</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: 'Best of SNES', count: 25, gradient: 'from-purple-600 to-indigo-600', icon: '🎮' },
            { title: 'RPG Classics', count: 42, gradient: 'from-emerald-600 to-teal-600', icon: '⚔️' },
            { title: 'Hidden Gems', count: 18, gradient: 'from-rose-600 to-pink-600', icon: '💎' },
          ].map((collection, index) => (
            <motion.div
              key={collection.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              className={`relative p-6 rounded-2xl bg-gradient-to-br ${collection.gradient} overflow-hidden cursor-pointer group`}
            >
              <div className="absolute top-0 right-0 text-6xl opacity-20 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform">
                {collection.icon}
              </div>
              <div className="relative">
                <h3 className="text-xl font-bold mb-1">{collection.title}</h3>
                <p className="text-sm text-white/70">{collection.count} games</p>
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium">
                  Explore <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
