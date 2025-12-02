import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Monitor, Tv, Smartphone, Zap, Settings, Save, RotateCcw, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

interface ShaderPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  performance: string;
  path: string;
  settings: Record<string, number>;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  crt: <Tv className="w-5 h-5" />,
  ntsc: <Monitor className="w-5 h-5" />,
  lcd: <Smartphone className="w-5 h-5" />,
  upscale: <Zap className="w-5 h-5" />,
  clean: <Eye className="w-5 h-5" />,
  special: <Settings className="w-5 h-5" />,
};

const PERFORMANCE_COLORS: Record<string, string> = {
  low: 'text-green-400 bg-green-500/10',
  medium: 'text-yellow-400 bg-yellow-500/10',
  high: 'text-orange-400 bg-orange-500/10',
  'very-high': 'text-red-400 bg-red-500/10',
};

export default function ShaderSettings({ system }: { system?: string }) {
  const queryClient = useQueryClient();
  const [selectedPreset, setSelectedPreset] = useState<ShaderPreset | null>(null);
  const [customSettings, setCustomSettings] = useState<Record<string, number>>({});
  const [previewMode, setPreviewMode] = useState(false);

  const { data: presetsData, isLoading } = useQuery({
    queryKey: ['shader-presets'],
    queryFn: async () => {
      const res = await api.get('/shaders/presets');
      return res.data;
    },
  });

  const { data: recommendations } = useQuery({
    queryKey: ['shader-recommendations', system],
    queryFn: async () => {
      if (!system) return null;
      const res = await api.get(`/shaders/recommendations/${system}`);
      return res.data;
    },
    enabled: !!system,
  });

  const { data: userConfigs } = useQuery({
    queryKey: ['user-shader-configs'],
    queryFn: async () => {
      const res = await api.get('/shaders/user-configs');
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; presetId: string; system?: string; settings: any }) => {
      const res = await api.post('/shaders/user-configs', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-shader-configs'] });
      toast.success('Shader configuration saved!');
    },
  });

  const handleSelectPreset = (preset: ShaderPreset) => {
    setSelectedPreset(preset);
    setCustomSettings(preset.settings);
  };

  const handleSettingChange = (key: string, value: number) => {
    setCustomSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!selectedPreset) return;
    
    saveMutation.mutate({
      name: `${selectedPreset.name} (Custom)`,
      presetId: selectedPreset.id,
      system,
      settings: customSettings,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const presets = presetsData?.presets || [];
  const categories = presetsData?.categories || [];

  return (
    <div className="space-y-6">
      {/* Recommendations for current system */}
      {recommendations?.presets?.length > 0 && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4">
          <h4 className="text-sm font-medium text-indigo-400 mb-3">
            Recommended for {system}
          </h4>
          <div className="flex flex-wrap gap-2">
            {recommendations.presets.slice(0, 3).map((preset: ShaderPreset) => (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedPreset?.id === preset.id
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category: string) => (
          <button
            key={category}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl text-gray-300 transition-colors capitalize"
          >
            {CATEGORY_ICONS[category]}
            {category}
          </button>
        ))}
      </div>

      {/* Preset grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {presets.map((preset: ShaderPreset) => (
          <motion.button
            key={preset.id}
            onClick={() => handleSelectPreset(preset)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`text-left p-4 rounded-xl border transition-all ${
              selectedPreset?.id === preset.id
                ? 'bg-indigo-500/20 border-indigo-500/50'
                : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {CATEGORY_ICONS[preset.category]}
                <span className="font-medium text-white">{preset.name}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs ${PERFORMANCE_COLORS[preset.performance]}`}>
                {preset.performance}
              </span>
            </div>
            <p className="text-sm text-gray-400 line-clamp-2">{preset.description}</p>
          </motion.button>
        ))}
      </div>

      {/* Settings panel */}
      {selectedPreset && (
        <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-white">{selectedPreset.name} Settings</h4>
            <div className="flex gap-2">
              <button
                onClick={() => setCustomSettings(selectedPreset.settings)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
                title="Reset to defaults"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(customSettings).map(([key, value]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-gray-300">{formatSettingName(key)}</label>
                  <span className="text-sm text-gray-500">{value}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={getSettingMax(key)}
                  step={getSettingStep(key)}
                  value={value}
                  onChange={(e) => handleSettingChange(key, parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User saved configs */}
      {userConfigs?.configs?.length > 0 && (
        <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
          <h4 className="text-lg font-semibold text-white mb-4">Your Saved Configurations</h4>
          <div className="space-y-2">
            {userConfigs.configs.map((config: any) => (
              <div
                key={config.id}
                className="flex items-center justify-between p-3 bg-gray-700/30 rounded-xl"
              >
                <div>
                  <p className="font-medium text-white">{config.name}</p>
                  <p className="text-sm text-gray-400">
                    {config.system || 'Global'} • {config.presetId}
                  </p>
                </div>
                <button className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm">
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
function formatSettingName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function getSettingMax(key: string): number {
  if (key.includes('gamma')) return 3.0;
  if (key.includes('mask') || key.includes('strength')) return 1.0;
  if (key.includes('scale')) return 10.0;
  if (key.includes('size')) return 10.0;
  return 2.0;
}

function getSettingStep(key: string): number {
  if (key.includes('gamma')) return 0.1;
  return 0.01;
}
