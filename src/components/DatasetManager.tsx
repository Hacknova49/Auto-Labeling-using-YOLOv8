import React, { useState } from 'react';
import { ArrowLeft, Plus, Download, Archive, Calendar, Image, Tag } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

interface DatasetManagerProps {
  onBack: () => void;
}

export const DatasetManager: React.FC<DatasetManagerProps> = ({ onBack }) => {
  const { datasets, images, createDataset, exportDataset } = useProject();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [datasetName, setDatasetName] = useState('');
  const [exportFormat, setExportFormat] = useState<'yolo' | 'coco' | 'pascal'>('yolo');

  const handleCreateDataset = () => {
    if (datasetName.trim()) {
      createDataset(datasetName.trim());
      setDatasetName('');
      setShowCreateModal(false);
    }
  };

  const handleExport = (datasetId: string) => {
    exportDataset(exportFormat);
    // Mock download notification
    alert(`Dataset exported in ${exportFormat.toUpperCase()} format!`);
  };

  const completedImages = images.filter(img => img.status === 'completed' || img.status === 'reviewed');
  const totalAnnotations = completedImages.reduce((sum, img) => sum + img.boundingBoxes.length, 0);

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={onBack}
                className="inline-flex items-center text-gray-400 hover:text-white mr-4"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Dashboard
              </button>
              <h1 className="text-xl font-bold text-white">Dataset Manager</h1>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Dataset
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Current Project Stats */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Current Project</h2>
          <div className="grid grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{completedImages.length}</div>
              <div className="text-sm text-gray-400">Labeled Images</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{totalAnnotations}</div>
              <div className="text-sm text-gray-400">Total Annotations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{datasets.length}</div>
              <div className="text-sm text-gray-400">Datasets Created</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-400">
                {totalAnnotations > 0 ? (totalAnnotations / Math.max(completedImages.length, 1)).toFixed(1) : '0'}
              </div>
              <div className="text-sm text-gray-400">Avg. Annotations/Image</div>
            </div>
          </div>
        </div>

        {/* Export Options */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Export Format</h2>
          <div className="flex space-x-4">
            {(['yolo', 'coco', 'pascal'] as const).map((format) => (
              <button
                key={format}
                onClick={() => setExportFormat(format)}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  exportFormat === format
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Datasets List */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-white">Saved Datasets</h2>
          
          {datasets.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <div className="text-gray-400 text-lg mb-2">No datasets created yet</div>
              <div className="text-gray-500 mb-4">Create a dataset to save your current progress</div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Dataset
              </button>
            </div>
          ) : (
            <div className="grid gap-6">
              {datasets.map((dataset) => (
                <div key={dataset.id} className="bg-gray-800 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-2">{dataset.name}</h3>
                      <div className="flex items-center space-x-6 text-sm text-gray-400">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {dataset.createdAt.toLocaleDateString()}
                        </div>
                        <div className="flex items-center">
                          <Image className="h-4 w-4 mr-1" />
                          {dataset.imageCount} images
                        </div>
                        <div className="flex items-center">
                          <Tag className="h-4 w-4 mr-1" />
                          {dataset.totalAnnotations} annotations
                        </div>
                        <div className="text-blue-400">v{dataset.version}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleExport(dataset.id)}
                        className="inline-flex items-center px-3 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 hover:text-white hover:bg-gray-700"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Dataset Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={() => setShowCreateModal(false)}></div>

            <div className="inline-block align-bottom bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="mb-4">
                <h3 className="text-lg leading-6 font-medium text-white">
                  Create New Dataset
                </h3>
                <p className="mt-2 text-sm text-gray-400">
                  Save your current progress as a versioned dataset.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Dataset Name
                </label>
                <input
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  placeholder="My Training Dataset"
                  autoFocus
                />
              </div>

              <div className="mb-6">
                <div className="text-sm text-gray-400">
                  This dataset will include {completedImages.length} labeled images with {totalAnnotations} total annotations.
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 hover:text-white hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDataset}
                  disabled={!datasetName.trim()}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Dataset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};