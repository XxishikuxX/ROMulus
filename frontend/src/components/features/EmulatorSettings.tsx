import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Zap, Rewind, FastForward, Monitor, Volume2, 
  Save, RotateCcw, Download, Upload, ChevronDown 
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

interface EmulatorSettings {
  runAhead: {
    enabled: boolean;
    frames: number;
    useSecondInstance: boolean;
  };
  rewind: {
    enabled: boolean;
    bufferSize: number;
    granularity: number;
  };
  fastForward: {
    speed: number;
    frameSkip: number;
    holdToActivate: boolean;
  };
  slowMotion: {
    speed: number;
    holdToActivate: boolean;
  };
  video: {
    vsync: boolean;
    hardGpuSync: boolean;
    maxSwapchainImages: number;
    frameDelay: number;
    aspectRatio: string;
    integerScale: boolean;
    smoothing: boolean;
  };
  audio: {
    enabled: boolean;
    latency: number;
    volume: number;
    rateControl: boolean;
  };
}

const ASPECT_RATIOS = [
  { value: 'core', label: 'Core Provided' },
  { value: '4:3', label: '4:3' },
  { value: '16:9', label: '16:9' },
  { value: '16:10', label: '16:10' },
  { value: 'stretch', label: 'Stretch' },
];

export default function EmulatorSettingsPanel({ system = 'global' }: { system?: string }) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<string | null>('performance');

  const { data, isLoading } = useQuery({
    queryKey: ['emulator-settings', system],
    queryFn: async () => {
      const res = await api.get(`/emulator-settings/system/${system}`);
      return res.data;
    },
  });

  const { data: presetsData } = useQuery({
    queryKey: ['input-lag-presets'],
    queryFn: async () => {
      const res = await api.get('/emulator-settings/presets/input-lag');
      return res.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (settings: Partial<EmulatorSettings>) => {
      const res = await api.put(`/emulator-settings/system/${system}`, { settings });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emulator-settings', system] });
      toast.success('Settings saved!');
    },
  });

  const applyPresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      const res = await api.post(`/emulator-settings/presets/input-lag/${presetId}`, { system });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emulator-settings', system] });
      toast.success('Preset applied!');
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete(`/emulator-settings/system/${system}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emulator-settings', system] });
      toast.success('Settings reset to defaults');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const settings: EmulatorSettings = data?.settings || {};

  const updateSetting = (path: string, value: any) => {
    const keys = path.split('.');
    const newSettings = JSON.parse(JSON.stringify(settings));
    let current = newSettings;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    
    updateMutation.mutate(newSettings);
  };

  const sections = [
    { id: 'performance', label: 'Performance', icon: Zap },
    { id: 'rewind', label: 'Rewind & Fast Forward', icon: Rewind },
    { id: 'video', label: 'Video', icon: Monitor },
    { id: 'audio', label: 'Audio', icon: Volume2 },
  ];

  return (
    <div className="space-y-6">
      {/* Input Lag Presets */}
      <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          Input Lag Presets
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {presetsData?.presets?.map((preset: any) => (
            <button
              key={preset.id}
              onClick={() => applyPresetMutation.mutate(preset.id)}
              disabled={applyPresetMutation.isPending}
              className="p-4 bg-gray-700/30 hover:bg-gray-700/50 rounded-xl text-left transition-colors"
            >
              <p className="font-medium text-white">{preset.name}</p>
              <p className="text-xs text-gray-400 mt-1">{preset.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Settings sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.id} className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden">
            <button
              onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-700/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <section.icon className="w-5 h-5 text-indigo-400" />
                <span className="font-medium text-white">{section.label}</span>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${
                activeSection === section.id ? 'rotate-180' : ''
              }`} />
            </button>

            {activeSection === section.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-4 pb-4"
              >
                {section.id === 'performance' && (
                  <div className="space-y-4">
                    {/* Run-Ahead */}
                    <div className="p-4 bg-gray-700/30 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium text-white">Run-Ahead</p>
                          <p className="text-sm text-gray-400">Reduce input lag by running frames ahead</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.runAhead?.enabled}
                            onChange={(e) => updateSetting('runAhead.enabled', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                        </label>
                      </div>
                      {settings.runAhead?.enabled && (
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-gray-300">Frames</span>
                              <span className="text-sm text-gray-500">{settings.runAhead?.frames}</span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="6"
                              value={settings.runAhead?.frames || 1}
                              onChange={(e) => updateSetting('runAhead.frames', parseInt(e.target.value))}
                              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                          </div>
                          <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                              type="checkbox"
                              checked={settings.runAhead?.useSecondInstance}
                              onChange={(e) => updateSetting('runAhead.useSecondInstance', e.target.checked)}
                              className="rounded border-gray-600 bg-gray-700 text-indigo-500"
                            />
                            Use Second Instance (better compatibility)
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Hard GPU Sync */}
                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl">
                      <div>
                        <p className="font-medium text-white">Hard GPU Sync</p>
                        <p className="text-sm text-gray-400">Force CPU-GPU sync for lower latency</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.video?.hardGpuSync}
                          onChange={(e) => updateSetting('video.hardGpuSync', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      </label>
                    </div>

                    {/* Frame Delay */}
                    <div className="p-4 bg-gray-700/30 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-300">Frame Delay</span>
                        <span className="text-sm text-gray-500">{settings.video?.frameDelay || 0}ms</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="15"
                        value={settings.video?.frameDelay || 0}
                        onChange={(e) => updateSetting('video.frameDelay', parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                  </div>
                )}

                {section.id === 'rewind' && (
                  <div className="space-y-4">
                    {/* Rewind */}
                    <div className="p-4 bg-gray-700/30 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium text-white">Rewind</p>
                          <p className="text-sm text-gray-400">Go back in time during gameplay</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.rewind?.enabled}
                            onChange={(e) => updateSetting('rewind.enabled', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                        </label>
                      </div>
                      {settings.rewind?.enabled && (
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-gray-300">Buffer Size</span>
                              <span className="text-sm text-gray-500">{settings.rewind?.bufferSize || 100}MB</span>
                            </div>
                            <input
                              type="range"
                              min="10"
                              max="500"
                              step="10"
                              value={settings.rewind?.bufferSize || 100}
                              onChange={(e) => updateSetting('rewind.bufferSize', parseInt(e.target.value))}
                              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-gray-300">Granularity</span>
                              <span className="text-sm text-gray-500">{settings.rewind?.granularity || 1} frames</span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="10"
                              value={settings.rewind?.granularity || 1}
                              onChange={(e) => updateSetting('rewind.granularity', parseInt(e.target.value))}
                              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Fast Forward */}
                    <div className="p-4 bg-gray-700/30 rounded-xl">
                      <p className="font-medium text-white mb-3">Fast Forward</p>
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-300">Speed</span>
                            <span className="text-sm text-gray-500">{settings.fastForward?.speed || 2}x</span>
                          </div>
                          <input
                            type="range"
                            min="1.5"
                            max="10"
                            step="0.5"
                            value={settings.fastForward?.speed || 2}
                            onChange={(e) => updateSetting('fastForward.speed', parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                          <input
                            type="checkbox"
                            checked={settings.fastForward?.holdToActivate !== false}
                            onChange={(e) => updateSetting('fastForward.holdToActivate', e.target.checked)}
                            className="rounded border-gray-600 bg-gray-700 text-indigo-500"
                          />
                          Hold to activate
                        </label>
                      </div>
                    </div>

                    {/* Slow Motion */}
                    <div className="p-4 bg-gray-700/30 rounded-xl">
                      <p className="font-medium text-white mb-3">Slow Motion</p>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-300">Speed</span>
                          <span className="text-sm text-gray-500">{settings.slowMotion?.speed || 0.5}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="0.9"
                          step="0.1"
                          value={settings.slowMotion?.speed || 0.5}
                          onChange={(e) => updateSetting('slowMotion.speed', parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {section.id === 'video' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl">
                      <div>
                        <p className="font-medium text-white">VSync</p>
                        <p className="text-sm text-gray-400">Prevent screen tearing</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.video?.vsync !== false}
                          onChange={(e) => updateSetting('video.vsync', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      </label>
                    </div>

                    <div className="p-4 bg-gray-700/30 rounded-xl">
                      <p className="text-sm text-gray-300 mb-2">Aspect Ratio</p>
                      <select
                        value={settings.video?.aspectRatio || 'core'}
                        onChange={(e) => updateSetting('video.aspectRatio', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                      >
                        {ASPECT_RATIOS.map((ratio) => (
                          <option key={ratio.value} value={ratio.value}>{ratio.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl">
                      <div>
                        <p className="font-medium text-white">Integer Scale</p>
                        <p className="text-sm text-gray-400">Pixel-perfect scaling</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.video?.integerScale}
                          onChange={(e) => updateSetting('video.integerScale', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl">
                      <div>
                        <p className="font-medium text-white">Bilinear Filtering</p>
                        <p className="text-sm text-gray-400">Smooth scaling</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.video?.smoothing}
                          onChange={(e) => updateSetting('video.smoothing', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      </label>
                    </div>
                  </div>
                )}

                {section.id === 'audio' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl">
                      <div>
                        <p className="font-medium text-white">Audio Enabled</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.audio?.enabled !== false}
                          onChange={(e) => updateSetting('audio.enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      </label>
                    </div>

                    <div className="p-4 bg-gray-700/30 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-300">Volume</span>
                        <span className="text-sm text-gray-500">{settings.audio?.volume || 100}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={settings.audio?.volume || 100}
                        onChange={(e) => updateSetting('audio.volume', parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>

                    <div className="p-4 bg-gray-700/30 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-300">Latency</span>
                        <span className="text-sm text-gray-500">{settings.audio?.latency || 64}ms</span>
                      </div>
                      <input
                        type="range"
                        min="16"
                        max="256"
                        step="8"
                        value={settings.audio?.latency || 64}
                        onChange={(e) => updateSetting('audio.latency', parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={() => resetMutation.mutate()}
          className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </button>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">
            <Upload className="w-4 h-4" />
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
