import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Search,
  Grid3X3,
  LayoutGrid,
  List,
  ChevronDown,
  Play,
  MoreVertical,
  Clock,
  Star,
  Trash2,
  Download,
  FolderOpen,
  Plus,
  Filter,
  Heart,
  SortAsc,
  Gamepad2,
} from 'lucide-react';

const libraryGames = [
  { id: 1, title: 'Super Mario World', system: 'SNES', lastPlayed: '2 hours ago', playTime: '24h 32m', favorite: true, coverColor: 'from-red-500 to-yellow-500' },
  { id: 2, title: 'Final Fantasy VII', system: 'PS1', lastPlayed: 'Yesterday', playTime: '86h 15m', favorite: true, coverColor: 'from-purple-600 to-blue-600' },
  { id: 3, title: 'Pokemon Emerald', system: 'GBA', lastPlayed: '3 days ago', playTime: '52h 48m', favorite: false, coverColor: 'from-emerald-500 to-teal-500' },
  { id: 4, title: 'Chrono Trigger', system: 'SNES', lastPlayed: 'Last week', playTime: '38h 20m', favorite: true, coverColor: 'from-cyan-500 to-purple-600' },
  { id: 5, title: 'Super Smash Bros Melee', system: 'GameCube', lastPlayed: '2 days ago', playTime: '156h 42m', favorite: true, coverColor: 'from-orange-500 to-red-500' },
  { id: 6, title: 'Castlevania: SOTN', system: 'PS1', lastPlayed: '5 days ago', playTime: '18h 55m', favorite: false, coverColor: 'from-gray-700 to-purple-900' },
  { id: 7, title: 'Metroid Prime', system: 'GameCube', lastPlayed: '2 weeks ago', playTime: '22h 10m', favorite: false, coverColor: 'from-orange-600 to-red-700' },
  { id: 8, title: 'Sonic Adventure 2', system: 'Dreamcast', lastPlayed: 'Last month', playTime: '45h 30m', favorite: true, coverColor: 'from-blue-500 to-cyan-400' },
];

const collections = [
  { id: 1, name: 'Favorites', count: 12, icon: '❤️' },
  { id: 2, name: 'Currently Playing', count: 4, icon: '🎮' },
  { id: 3, name: 'Completed', count: 28, icon: '✅' },
  { id: 4, name: 'Want to Play', count: 15, icon: '📋' },
];

type ViewMode = 'grid' | 'compact' | 'list';
type SortOption = 'recent' | 'name' | 'playtime' | 'system';
type FilterOption = 'all' | 'favorites' | 'recent';

export default function Library() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [selectedGame, setSelectedGame] = useState<number | null>(null);

  const filteredGames = libraryGames
    .filter(game => {
      if (searchQuery && !game.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterBy === 'favorites' && !game.favorite) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.title.localeCompare(b.title);
      if (sortBy === 'playtime') return parseInt(b.playTime) - parseInt(a.playTime);
      return 0;
    });

  const stats = {
    totalGames: libraryGames.length,
    totalPlaytime: '444h',
    favorites: libraryGames.filter(g => g.favorite).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold">My Library</h1>
          <p className="text-gray-400 mt-1">Your personal game collection</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{stats.totalGames}</p>
            <p className="text-xs text-gray-500">Games</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <p className="text-2xl font-bold text-cyan-400">{stats.totalPlaytime}</p>
            <p className="text-xs text-gray-500">Playtime</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <p className="text-2xl font-bold text-pink-400">{stats.favorites}</p>
            <p className="text-xs text-gray-500">Favorites</p>
          </div>
        </div>
      </div>

      {/* Collections */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {collections.map((collection, index) => (
          <motion.button
            key={collection.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            className="p-4 bg-[#0a0a12] border border-white/[0.06] rounded-2xl text-left hover:border-cyan-500/50 transition-all group"
          >
            <span className="text-2xl">{collection.icon}</span>
            <h3 className="font-semibold mt-2 group-hover:text-cyan-400 transition-colors">{collection.name}</h3>
            <p className="text-sm text-gray-500">{collection.count} games</p>
          </motion.button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#0a0a12] border border-white/[0.06] rounded-2xl">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search your library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-white/5 border border-white/[0.06] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            {(['all', 'favorites', 'recent'] as FilterOption[]).map(filter => (
              <button
                key={filter}
                onClick={() => setFilterBy(filter)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
                  filterBy === filter
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                    : 'bg-white/5 text-gray-400 border border-transparent hover:text-white'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/[0.06] rounded-xl text-gray-300 hover:text-white transition-colors"
            >
              <SortAsc className="w-4 h-4" />
              <span className="text-sm capitalize hidden sm:inline">{sortBy}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            
            <AnimatePresence>
              {showSortMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 top-full mt-2 w-40 bg-[#0c0c14] border border-white/[0.06] rounded-xl shadow-xl overflow-hidden z-20"
                >
                  {(['recent', 'name', 'playtime', 'system'] as SortOption[]).map(option => (
                    <button
                      key={option}
                      onClick={() => { setSortBy(option); setShowSortMenu(false); }}
                      className={`w-full px-4 py-2.5 text-left text-sm capitalize transition-colors ${
                        sortBy === option ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* View Mode */}
          <div className="flex items-center bg-white/5 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'compact' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Games Grid */}
      <div className={`grid gap-4 ${
        viewMode === 'grid' 
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
          : viewMode === 'compact'
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'
          : 'grid-cols-1'
      }`}>
        {filteredGames.map((game, index) => (
          <motion.div
            key={game.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            whileHover={{ y: viewMode !== 'list' ? -4 : 0 }}
            className={`group relative bg-[#0a0a12] rounded-2xl overflow-hidden border border-white/[0.04] hover:border-cyan-500/30 transition-all ${
              viewMode === 'list' ? 'flex items-center' : ''
            }`}
          >
            {/* Cover */}
            <div className={`relative ${
              viewMode === 'list' ? 'w-20 h-20 flex-shrink-0' : viewMode === 'compact' ? 'aspect-square' : 'aspect-[3/4]'
            } bg-gradient-to-br ${game.coverColor}`}>
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
              
              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/50"
                >
                  <Play className="w-5 h-5 text-white ml-0.5" />
                </motion.button>
              </div>

              {/* Favorite badge */}
              {game.favorite && viewMode !== 'list' && (
                <div className="absolute top-2 right-2">
                  <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className={`${viewMode === 'list' ? 'flex-1 flex items-center justify-between px-4 py-3' : 'p-4'}`}>
              <div className="min-w-0">
                <h3 className="font-semibold text-white truncate group-hover:text-cyan-400 transition-colors">
                  {game.title}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">{game.system}</p>
                
                {viewMode === 'grid' && (
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{game.playTime}</span>
                    </div>
                    <span>{game.lastPlayed}</span>
                  </div>
                )}
              </div>

              {viewMode === 'list' && (
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-medium">{game.playTime}</p>
                    <p className="text-xs text-gray-500">{game.lastPlayed}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                      <Play className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setSelectedGame(selectedGame === game.id ? null : game.id)}
                      className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Context menu for list view */}
            <AnimatePresence>
              {viewMode === 'list' && selectedGame === game.id && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-4 top-full mt-2 w-48 bg-[#0c0c14] border border-white/[0.06] rounded-xl shadow-xl overflow-hidden z-20"
                >
                  <button className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                    <Play className="w-4 h-4" />
                    Play Now
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                    <Heart className="w-4 h-4" />
                    {game.favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                    <FolderOpen className="w-4 h-4" />
                    Add to Collection
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                    Remove from Library
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}

        {/* Add Game Card */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          className={`${
            viewMode === 'list' ? 'flex items-center justify-center py-4' : 'aspect-[3/4] flex flex-col items-center justify-center'
          } border-2 border-dashed border-white/[0.06] rounded-2xl hover:border-cyan-500/50 transition-colors group`}
        >
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:bg-cyan-500/20 transition-colors">
            <Plus className="w-6 h-6 text-gray-500 group-hover:text-cyan-400" />
          </div>
          <span className="text-gray-500 group-hover:text-cyan-400 transition-colors">Add Game</span>
        </motion.button>
      </div>

      {/* Empty State */}
      {filteredGames.length === 0 && (
        <div className="text-center py-16">
          <Gamepad2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-300">No games found</h3>
          <p className="text-gray-500 mt-2">Try adjusting your search or filters</p>
          <Link
            to="/browse"
            className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-cyan-500 rounded-xl font-medium hover:bg-indigo-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Browse Games
          </Link>
        </div>
      )}
    </div>
  );
}
