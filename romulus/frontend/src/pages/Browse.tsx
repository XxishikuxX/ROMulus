import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Grid3X3,
  LayoutGrid,
  List,
  ChevronDown,
  Play,
  Heart,
  Plus,
  X,
  Gamepad2,
  Star,
  Clock,
  Users,
} from 'lucide-react';

// System configurations
const systems = [
  { id: 'all', name: 'All Systems', icon: '🎮', count: 2456 },
  { id: 'nes', name: 'NES', icon: '🕹️', count: 312 },
  { id: 'snes', name: 'SNES', icon: '🎮', count: 287 },
  { id: 'n64', name: 'Nintendo 64', icon: '🎮', count: 198 },
  { id: 'gamecube', name: 'GameCube', icon: '🎮', count: 156 },
  { id: 'wii', name: 'Wii', icon: '🎮', count: 234 },
  { id: 'gb', name: 'Game Boy', icon: '📱', count: 412 },
  { id: 'gba', name: 'GBA', icon: '📱', count: 298 },
  { id: 'nds', name: 'DS', icon: '📱', count: 267 },
  { id: 'ps1', name: 'PlayStation', icon: '🎮', count: 345 },
  { id: 'ps2', name: 'PlayStation 2', icon: '🎮', count: 423 },
  { id: 'psp', name: 'PSP', icon: '📱', count: 189 },
  { id: 'genesis', name: 'Genesis', icon: '🎮', count: 234 },
  { id: 'dreamcast', name: 'Dreamcast', icon: '🎮', count: 145 },
];

const genres = ['Action', 'Adventure', 'RPG', 'Platformer', 'Puzzle', 'Racing', 'Sports', 'Fighting', 'Shooter', 'Strategy'];

const sortOptions = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'recent', label: 'Recently Added' },
  { value: 'name', label: 'Name A-Z' },
  { value: 'rating', label: 'Highest Rated' },
];

// Mock games data
const mockGames = [
  { id: 1, title: 'Super Mario World', system: 'SNES', genre: 'Platformer', rating: 4.9, players: 8234, coverColor: 'from-red-500 to-yellow-500', inLibrary: true },
  { id: 2, title: 'The Legend of Zelda: OOT', system: 'N64', genre: 'Adventure', rating: 5.0, players: 7892, coverColor: 'from-green-500 to-emerald-600', inLibrary: false },
  { id: 3, title: 'Final Fantasy VII', system: 'PS1', genre: 'RPG', rating: 4.9, players: 6543, coverColor: 'from-purple-600 to-blue-600', inLibrary: true },
  { id: 4, title: 'Sonic the Hedgehog 2', system: 'Genesis', genre: 'Platformer', rating: 4.7, players: 5432, coverColor: 'from-blue-500 to-cyan-400', inLibrary: false },
  { id: 5, title: 'Pokemon Emerald', system: 'GBA', genre: 'RPG', rating: 4.8, players: 6789, coverColor: 'from-emerald-500 to-teal-500', inLibrary: true },
  { id: 6, title: 'Chrono Trigger', system: 'SNES', genre: 'RPG', rating: 5.0, players: 5678, coverColor: 'from-cyan-500 to-purple-600', inLibrary: false },
  { id: 7, title: 'Super Smash Bros Melee', system: 'GameCube', genre: 'Fighting', rating: 4.9, players: 7234, coverColor: 'from-orange-500 to-red-500', inLibrary: true },
  { id: 8, title: 'Metroid Prime', system: 'GameCube', genre: 'Action', rating: 4.8, players: 4567, coverColor: 'from-orange-600 to-red-700', inLibrary: false },
  { id: 9, title: 'Castlevania: SOTN', system: 'PS1', genre: 'Action', rating: 4.9, players: 5123, coverColor: 'from-gray-700 to-purple-900', inLibrary: true },
  { id: 10, title: 'Earthbound', system: 'SNES', genre: 'RPG', rating: 4.7, players: 3456, coverColor: 'from-pink-500 to-rose-600', inLibrary: false },
  { id: 11, title: 'Mega Man X', system: 'SNES', genre: 'Action', rating: 4.8, players: 4321, coverColor: 'from-cyan-500 to-blue-600', inLibrary: false },
  { id: 12, title: 'Streets of Rage 2', system: 'Genesis', genre: 'Action', rating: 4.6, players: 3987, coverColor: 'from-amber-500 to-orange-600', inLibrary: true },
];

type ViewMode = 'grid-large' | 'grid-small' | 'list';

export default function Browse() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSystem, setSelectedSystem] = useState('all');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('popular');
  const [viewMode, setViewMode] = useState<ViewMode>('grid-large');
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre) 
        : [...prev, genre]
    );
  };

  const filteredGames = mockGames.filter(game => {
    if (searchQuery && !game.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedSystem !== 'all' && game.system.toLowerCase().replace(' ', '') !== selectedSystem) return false;
    if (selectedGenres.length > 0 && !selectedGenres.includes(game.genre)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Browse Games</h1>
          <p className="text-gray-400 mt-1">Explore our collection of {mockGames.length.toLocaleString()} games</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 lg:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-[#0a0a12] border border-white/[0.06] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-xl border transition-colors ${
              showFilters || selectedGenres.length > 0
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                : 'bg-[#0a0a12] border-white/[0.06] text-gray-400 hover:text-white'
            }`}
          >
            <Filter className="w-5 h-5" />
          </button>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-2 px-4 py-3 bg-[#0a0a12] border border-white/[0.06] rounded-xl text-gray-300 hover:text-white transition-colors"
            >
              <span className="text-sm">{sortOptions.find(o => o.value === sortBy)?.label}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {showSortMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-[#0c0c14] border border-white/[0.06] rounded-xl shadow-xl overflow-hidden z-20"
                >
                  {sortOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => { setSortBy(option.value); setShowSortMenu(false); }}
                      className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                        sortBy === option.value
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* View Mode */}
          <div className="hidden sm:flex items-center bg-[#0a0a12] border border-white/[0.06] rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid-large')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid-large' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('grid-small')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid-small' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              <Grid3X3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 bg-[#0a0a12] border border-white/[0.06] rounded-2xl space-y-6">
              {/* Genre Filters */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Genre</h3>
                <div className="flex flex-wrap gap-2">
                  {genres.map(genre => (
                    <button
                      key={genre}
                      onClick={() => toggleGenre(genre)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        selectedGenres.includes(genre)
                          ? 'bg-cyan-500 text-white'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Filters */}
              {selectedGenres.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Active filters:</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedGenres.map(genre => (
                      <span
                        key={genre}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-sm"
                      >
                        {genre}
                        <button onClick={() => toggleGenre(genre)} className="hover:text-white">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => setSelectedGenres([])}
                    className="text-sm text-gray-500 hover:text-white transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Systems Sidebar */}
        <aside className="hidden xl:block w-64 flex-shrink-0">
          <div className="sticky top-24 bg-[#0a0a12] border border-white/[0.06] rounded-2xl p-4">
            <h3 className="font-semibold mb-4">Systems</h3>
            <nav className="space-y-1">
              {systems.map(system => (
                <button
                  key={system.id}
                  onClick={() => setSelectedSystem(system.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                    selectedSystem === system.id
                      ? 'bg-cyan-500/20 text-white'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span>{system.icon}</span>
                    <span className="text-sm font-medium">{system.name}</span>
                  </div>
                  <span className="text-xs text-gray-500">{system.count}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Games Grid */}
        <div className="flex-1">
          {/* Results count */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-400">
              Showing <span className="text-white font-medium">{filteredGames.length}</span> games
            </p>
          </div>

          {/* Grid */}
          <div className={`grid gap-4 ${
            viewMode === 'grid-large' 
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4' 
              : viewMode === 'grid-small'
              ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6'
              : 'grid-cols-1'
          }`}>
            {filteredGames.map((game, index) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                whileHover={{ y: -4 }}
                className={`group relative bg-[#0a0a12] rounded-2xl overflow-hidden border border-white/[0.04] hover:border-white/20 transition-all cursor-pointer ${
                  viewMode === 'list' ? 'flex items-center' : ''
                }`}
              >
                {/* Cover */}
                <div className={`relative ${
                  viewMode === 'list' ? 'w-24 h-24 flex-shrink-0' : 'aspect-[3/4]'
                } bg-gradient-to-br ${game.coverColor}`}>
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
                  
                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Play className="w-5 h-5 text-white ml-0.5" />
                    </div>
                  </div>

                  {/* System badge */}
                  {viewMode !== 'list' && (
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg text-xs font-medium">
                        {game.system}
                      </span>
                    </div>
                  )}

                  {/* Quick actions */}
                  {viewMode !== 'list' && (
                    <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 bg-black/50 backdrop-blur-sm rounded-lg hover:bg-black/70 transition-colors">
                        <Heart className={`w-4 h-4 ${game.inLibrary ? 'text-red-500 fill-red-500' : 'text-white'}`} />
                      </button>
                      <button className="p-1.5 bg-black/50 backdrop-blur-sm rounded-lg hover:bg-black/70 transition-colors">
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className={`${viewMode === 'list' ? 'flex-1 flex items-center justify-between px-4' : 'p-4'}`}>
                  <div className={viewMode === 'list' ? '' : ''}>
                    <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors truncate">
                      {game.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {viewMode === 'list' && (
                        <span className="text-sm text-gray-500">{game.system} •</span>
                      )}
                      <span className="text-sm text-gray-500">{game.genre}</span>
                    </div>
                  </div>

                  {viewMode !== 'grid-small' && (
                    <div className={`flex items-center gap-4 ${viewMode === 'list' ? '' : 'mt-3'}`}>
                      <div className="flex items-center gap-1 text-yellow-400">
                        <Star className="w-4 h-4 fill-yellow-400" />
                        <span className="text-sm font-medium">{game.rating}</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-500">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">{(game.players / 1000).toFixed(1)}k</span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Empty State */}
          {filteredGames.length === 0 && (
            <div className="text-center py-16">
              <Gamepad2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-300">No games found</h3>
              <p className="text-gray-500 mt-2">Try adjusting your filters or search query</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
