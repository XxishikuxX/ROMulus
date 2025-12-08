import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Save,
  Upload,
  Rewind,
  FastForward,
  RotateCcw,
  MessageSquare,
  Users,
  X,
  ChevronRight,
  Gamepad2,
  Wifi,
  Trophy,
  Clock,
} from 'lucide-react';

export default function GamePlayer() {
  const { romId } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [volume, setVolume] = useState(80);
  const [playTime, setPlayTime] = useState(0);
  const [isRewinding, setIsRewinding] = useState(false);
  const [isFastForwarding, setIsFastForwarding] = useState(false);

  const game = {
    title: 'Super Mario World',
    system: 'SNES',
    coverColor: 'from-red-500 to-yellow-500',
  };

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (isPlaying && !showSettings && !showChat) {
          setShowControls(false);
        }
      }, 3000);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, [isPlaying, showSettings, showChat]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => setPlayTime(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black flex flex-col">
      {/* Game Canvas */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <div className={`aspect-[4/3] h-full max-w-full bg-gradient-to-br ${game.coverColor} relative`}>
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-center">
              <Gamepad2 className="w-24 h-24 text-white/20 mx-auto mb-4" />
              <p className="text-white/40 text-lg">Game canvas</p>
              <p className="text-white/30 text-sm mt-2">{game.title} • {game.system}</p>
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="absolute top-4 left-4 flex items-center gap-3">
          {isRewinding && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/80 backdrop-blur-sm rounded-lg text-sm font-medium">
              <Rewind className="w-4 h-4" /> Rewinding
            </motion.div>
          )}
          {isFastForwarding && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/80 backdrop-blur-sm rounded-lg text-sm font-medium">
              <FastForward className="w-4 h-4" /> 2x Speed
            </motion.div>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-20 pb-4">
            <div className="flex items-center justify-between px-6 mb-4">
              <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="font-semibold text-lg">{game.title}</h2>
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span>{game.system}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatTime(playTime)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 rounded-lg text-green-400 text-sm">
                <Wifi className="w-4 h-4" /><span>Connected</span>
              </div>
            </div>

            <div className="flex items-center justify-between px-6">
              <div className="flex items-center gap-2">
                <button onMouseDown={() => setIsRewinding(true)} onMouseUp={() => setIsRewinding(false)} onMouseLeave={() => setIsRewinding(false)} className="p-3 rounded-xl hover:bg-white/10 transition-colors">
                  <Rewind className={`w-5 h-5 ${isRewinding ? 'text-blue-400' : ''}`} />
                </button>
                <button onClick={() => setIsPlaying(!isPlaying)} className="p-4 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </button>
                <button onMouseDown={() => setIsFastForwarding(true)} onMouseUp={() => setIsFastForwarding(false)} onMouseLeave={() => setIsFastForwarding(false)} className="p-3 rounded-xl hover:bg-white/10 transition-colors">
                  <FastForward className={`w-5 h-5 ${isFastForwarding ? 'text-orange-400' : ''}`} />
                </button>
                <button className="p-3 rounded-xl hover:bg-white/10 transition-colors"><RotateCcw className="w-5 h-5" /></button>
              </div>

              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"><Save className="w-4 h-4" /><span className="text-sm">Save</span></button>
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"><Upload className="w-4 h-4" /><span className="text-sm">Load</span></button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 group">
                  <button onClick={() => setIsMuted(!isMuted)} className="p-3 rounded-xl hover:bg-white/10 transition-colors">
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <div className="w-0 group-hover:w-24 overflow-hidden transition-all">
                    <input type="range" min="0" max="100" value={isMuted ? 0 : volume} onChange={(e) => setVolume(parseInt(e.target.value))} className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-cyan-500" />
                  </div>
                </div>
                <button className="p-3 rounded-xl hover:bg-white/10 transition-colors relative">
                  <Trophy className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full text-xs font-bold flex items-center justify-center text-black">3</span>
                </button>
                <button className="p-3 rounded-xl hover:bg-white/10 transition-colors"><Users className="w-5 h-5" /></button>
                <button onClick={() => setShowChat(!showChat)} className={`p-3 rounded-xl transition-colors ${showChat ? 'bg-cyan-500/30 text-cyan-400' : 'hover:bg-white/10'}`}><MessageSquare className="w-5 h-5" /></button>
                <button onClick={() => setShowSettings(!showSettings)} className={`p-3 rounded-xl transition-colors ${showSettings ? 'bg-cyan-500/30 text-cyan-400' : 'hover:bg-white/10'}`}><Settings className="w-5 h-5" /></button>
                <button onClick={toggleFullscreen} className="p-3 rounded-xl hover:bg-white/10 transition-colors">
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0, x: 300 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 300 }} className="absolute top-0 right-0 bottom-0 w-80 bg-[#08080e]/95 backdrop-blur-xl border-l border-white/[0.06] overflow-y-auto">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="font-semibold">Settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-6">
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-3">Visual Filter</h4>
                <select className="w-full px-3 py-2 bg-white/5 border border-white/[0.06] rounded-lg text-sm">
                  <option>None</option>
                  <option>CRT Royale</option>
                  <option>CRT Lottes</option>
                  <option>xBRZ 4x</option>
                </select>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-3">Input Lag Preset</h4>
                <div className="grid grid-cols-2 gap-2">
                  {['Ultra Low', 'Low', 'Balanced', 'Smooth'].map(preset => (
                    <button key={preset} className={`px-3 py-2 rounded-lg text-sm transition-colors ${preset === 'Low' ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/50' : 'bg-white/5 hover:bg-white/10'}`}>{preset}</button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
