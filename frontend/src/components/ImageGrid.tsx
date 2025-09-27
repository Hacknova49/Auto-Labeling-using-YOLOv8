import React from 'react';
import { Clock, CheckCircle, AlertCircle, Eye, Loader2 } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

interface ImageGridProps {
  onImageSelect: (imageId: string) => void;
}

export const ImageGrid: React.FC<ImageGridProps> = ({ onImageSelect }) => {
  const { images } = useProject();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'reviewed':
        return <Eye className="h-4 w-4 text-purple-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-red-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'border-yellow-400';
      case 'processing':
        return 'border-blue-400';
      case 'completed':
        return 'border-green-400';
      case 'reviewed':
        return 'border-purple-400';
      default:
        return 'border-red-400';
    }
  };

  if (images.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-lg mb-4">No images uploaded yet</div>
        <div className="text-gray-500">Upload some images to get started with auto-labeling</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {images.map((image) => (
        <div
          key={image.id}
          className={`bg-gray-800 rounded-lg overflow-hidden border-2 transition-all duration-200 hover:scale-105 cursor-pointer ${getStatusColor(image.status)}`}
          onClick={() => onImageSelect(image.id)}
        >
          <div className="aspect-square relative">
            <img
              src={image.url}
              alt={image.filename}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200" />

            {/* Status Badge */}
            <div className="absolute top-2 right-2 flex items-center space-x-1 bg-gray-900 bg-opacity-80 rounded-full px-2 py-1">
              {getStatusIcon(image.status)}
              <span className="text-xs text-white capitalize">{image.status}</span>
            </div>

            {/* Detection Count */}
            {image.boundingBoxes.length > 0 && (
              <div className="absolute top-2 left-2 bg-blue-600 bg-opacity-90 rounded-full px-2 py-1">
                <span className="text-xs text-white font-medium">
                  {image.boundingBoxes.length} objects
                </span>
              </div>
            )}
            
            {/* Processing indicator */}
            {image.status === 'processing' && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="text-white text-sm">Processing...</div>
              </div>
            )}
          </div>

          <div className="p-3">
            <div className="text-white text-sm font-medium truncate">{image.filename}</div>
            <div className="text-gray-400 text-xs mt-1 flex items-center justify-between">
              <span>{image.width} × {image.height}</span>
              {image.processingTime && <span>{image.processingTime.toFixed(1)}s</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
