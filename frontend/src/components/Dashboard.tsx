import React, { useState } from 'react';
import { Upload, Folder, Camera, Video, Settings, Database, Play, Download } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { FileUpload } from './FileUpload';
import { PrioritizationPanel } from './PrioritizationPanel';
import { ImageGrid } from './ImageGrid';

interface DashboardProps {
  onViewChange: (view: 'dashboard' | 'editor' | 'datasets') => void;
  onImageSelect: (imageId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onViewChange, onImageSelect }) => {
  const { images, isProcessing, processImages } = useProject();
  const [showPrioritization, setShowPrioritization] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const handleProcessAll = () => {
    const pendingImages = images.filter(img => img.status === 'pending').map(img => img.id);
    if (pendingImages.length > 0) {
      processImages(pendingImages);
    }
  };

  const stats = {
    total: images.length,
    pending: images.filter(img => img.status === 'pending').length,
    processing: images.filter(img => img.status === 'processing').length,
    completed: images.filter(img => img.status === 'completed').length,
    reviewed: images.filter(img => img.status === 'reviewed').length,
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-white">YOLOv8 Auto-Labeling</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowPrioritization(!showPrioritization)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-300 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Settings className="h-4 w-4 mr-2" />
                Prioritization
              </button>
              <button
                onClick={() => onViewChange('datasets')}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-300 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Database className="h-4 w-4 mr-2" />
                Datasets
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Bar */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-sm text-gray-400">Total Images</div>
          </div>
          <div className="bg-yellow-900/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
            <div className="text-sm text-gray-400">Pending</div>
          </div>
          <div className="bg-blue-900/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">{stats.processing}</div>
            <div className="text-sm text-gray-400">Processing</div>
          </div>
          <div className="bg-green-900/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
            <div className="text-sm text-gray-400">Completed</div>
          </div>
          <div className="bg-purple-900/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400">{stats.reviewed}</div>
            <div className="text-sm text-gray-400">Reviewed</div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Images
            </button>
            <button 
              disabled
              className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-500 cursor-not-allowed opacity-50"
            >
              <Folder className="h-4 w-4 mr-2" />
              Upload Folder (Coming Soon)
            </button>
            <button 
              disabled
              className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-500 cursor-not-allowed opacity-50"
            >
              <Camera className="h-4 w-4 mr-2" />
              Webcam (Coming Soon)
            </button>
            <button 
              disabled
              className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-500 cursor-not-allowed opacity-50"
            >
              <Video className="h-4 w-4 mr-2" />
              Upload Video (Coming Soon)
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            {stats.pending > 0 && (
              <button
                onClick={handleProcessAll}
                disabled={isProcessing}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <Play className="h-4 w-4 mr-2" />
                {isProcessing ? 'Processing...' : `Process ${stats.pending} Images`}
              </button>
            )}
            {stats.completed > 0 && (
              <button className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <Download className="h-4 w-4 mr-2" />
                Export Dataset
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-8">
          {/* Main Content */}
          <div className="flex-1">
            <ImageGrid onImageSelect={onImageSelect} />
          </div>
          
          {/* Sidebar */}
          {showPrioritization && (
            <div className="w-80">
              <PrioritizationPanel onClose={() => setShowPrioritization(false)} />
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <FileUpload onClose={() => setShowUpload(false)} />
      )}
    </div>
  );
};