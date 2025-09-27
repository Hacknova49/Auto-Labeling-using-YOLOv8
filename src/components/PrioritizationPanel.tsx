import React, { useState } from 'react';
import { X, Plus, Minus, Settings, Save } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

interface PrioritizationPanelProps {
  onClose: () => void;
}

export const PrioritizationPanel: React.FC<PrioritizationPanelProps> = ({ onClose }) => {
  const { prioritizationPrompt, setPrioritizationPrompt } = useProject();
  const [localPrompt, setLocalPrompt] = useState(prioritizationPrompt);
  const [mode, setMode] = useState<'simple' | 'advanced' | 'json'>('simple');
  const [jsonInput, setJsonInput] = useState(JSON.stringify(prioritizationPrompt, null, 2));

  const commonClasses = [
    'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
    'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
    'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
    'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee'
  ];

  const handleSave = () => {
    if (mode === 'json') {
      try {
        const parsed = JSON.parse(jsonInput);
        setPrioritizationPrompt(parsed);
      } catch (error) {
        alert('Invalid JSON format');
        return;
      }
    } else {
      setPrioritizationPrompt(localPrompt);
    }
    onClose();
  };

  const addPriorityClass = (className: string) => {
    if (!localPrompt.classPriorities?.includes(className)) {
      setLocalPrompt(prev => ({
        ...prev,
        classPriorities: [...(prev.classPriorities || []), className]
      }));
    }
  };

  const removePriorityClass = (className: string) => {
    setLocalPrompt(prev => ({
      ...prev,
      classPriorities: prev.classPriorities?.filter(c => c !== className) || []
    }));
  };

  const updateClassWeight = (className: string, weight: number) => {
    setLocalPrompt(prev => ({
      ...prev,
      classWeights: {
        ...(prev.classWeights || {}),
        [className]: weight
      }
    }));
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-white flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          Prioritization Settings
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Mode Selector */}
      <div className="flex space-x-2 mb-6">
        {['simple', 'advanced', 'json'].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m as any)}
            className={`px-3 py-1 text-sm rounded ${
              mode === m
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {mode === 'json' ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              JSON Configuration
            </label>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="w-full h-64 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white font-mono text-sm"
              placeholder="Enter JSON configuration..."
            />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Confidence Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Confidence Threshold: {localPrompt.confidenceThreshold || 0.5}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={localPrompt.confidenceThreshold || 0.5}
              onChange={(e) => setLocalPrompt(prev => ({
                ...prev,
                confidenceThreshold: parseFloat(e.target.value)
              }))}
              className="w-full"
            />
          </div>

          {/* Priority Classes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Priority Classes
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {(localPrompt.classPriorities || []).map((className) => (
                <span
                  key={className}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {className}
                  <button
                    onClick={() => removePriorityClass(className)}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {commonClasses
                .filter(c => !localPrompt.classPriorities?.includes(c))
                .map((className) => (
                  <button
                    key={className}
                    onClick={() => addPriorityClass(className)}
                    className="text-left px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
                  >
                    <Plus className="h-3 w-3 inline mr-1" />
                    {className}
                  </button>
                ))}
            </div>
          </div>

          {mode === 'advanced' && (
            <>
              {/* Object Size Filters */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Min Object Size (px²)
                  </label>
                  <input
                    type="number"
                    value={localPrompt.minObjectSize || ''}
                    onChange={(e) => setLocalPrompt(prev => ({
                      ...prev,
                      minObjectSize: e.target.value ? parseInt(e.target.value) : undefined
                    }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Object Size (px²)
                  </label>
                  <input
                    type="number"
                    value={localPrompt.maxObjectSize || ''}
                    onChange={(e) => setLocalPrompt(prev => ({
                      ...prev,
                      maxObjectSize: e.target.value ? parseInt(e.target.value) : undefined
                    }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    placeholder="10000"
                  />
                </div>
              </div>

              {/* Custom Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Custom Natural Language Prompt
                </label>
                <textarea
                  value={localPrompt.customPrompt || ''}
                  onChange={(e) => setLocalPrompt(prev => ({
                    ...prev,
                    customPrompt: e.target.value
                  }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  rows={3}
                  placeholder="Focus on detecting people and vehicles with high confidence..."
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-700">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </button>
      </div>
    </div>
  );
};