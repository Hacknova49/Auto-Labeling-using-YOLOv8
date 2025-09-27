import React, { useState, useRef } from 'react';
import { Upload, X, Image, Folder, AlertCircle, Loader2 } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

interface FileUploadProps {
  onClose: () => void;
}

// Add this interface above the component
interface FolderInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  webkitdirectory?: string | boolean;
  directory?: string | boolean;
  mozdirectory?: string | boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onClose }) => {
  const { addImages } = useProject();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadMode, setUploadMode] = useState<'single' | 'folder'>('single');
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement & FolderInputProps>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const items = Array.from(e.dataTransfer.items);
    const files: File[] = [];
    
    // Process dropped items
    items.forEach((item) => {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && file.type.startsWith('image/')) {
          files.push(file);
        }
      }
    });

    setUploadedFiles(files);
  };

  // Update the handleFileSelect function:
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) {
      setError('No files selected');
      return;
    }

    const imageFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit
      return isImage && isValidSize;
    });
    
    if (imageFiles.length === 0) {
      setError('No valid image files selected');
      return;
    }
    
    if (files.length !== imageFiles.length) {
      setError(`${files.length - imageFiles.length} files were skipped (non-image files or too large)`);
    }
    
    setUploadedFiles(imageFiles);
  };

  const handleUpload = async () => {
    if (uploadedFiles.length > 0) {
      try {
        setIsUploading(true);
        await addImages(uploadedFiles);
        onClose();
      } catch (error) {
        setError('Failed to upload images');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg leading-6 font-medium text-white">
              Upload Images for Auto-Labeling
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Upload Mode Selector */}
          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => setUploadMode('single')}
              className={`flex items-center px-4 py-2 rounded-md ${
                uploadMode === 'single' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Image className="h-4 w-4 mr-2" />
              Single Images
            </button>
            <button
              onClick={() => setUploadMode('folder')}
              className={`flex items-center px-4 py-2 rounded-md ${
                uploadMode === 'folder' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Folder className="h-4 w-4 mr-2" />
              Folder Upload
            </button>
          </div>

          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-600 hover:border-gray-500'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <div className="text-lg font-medium text-white mb-2">
              {uploadMode === 'folder' ? 'Drop folder here or click to browse' : 'Drop images here or click to browse'}
            </div>
            <div className="text-sm text-gray-400 mb-4">
              Supports JPG, PNG, JPEG files
            </div>
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-white bg-gray-700 hover:bg-gray-600"
              >
                Browse Files
              </button>
              {uploadMode === 'folder' && (
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-white bg-gray-700 hover:bg-gray-600"
                >
                  <Folder className="h-4 w-4 mr-2" />
                  Browse Folder
                </button>
              )}
            </div>
          </div>

          {/* Hidden File Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            accept="image/*"
            // @ts-ignore
            webkitdirectory=""
            // @ts-ignore
            directory=""
            // @ts-ignore
            mozdirectory=""
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* File List */}
          {uploadedFiles.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-white mb-4">
                Selected Files ({uploadedFiles.length})
              </h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center space-x-3">
                      <Image className="h-8 w-8 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-white truncate max-w-xs">
                          {file.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 flex items-center text-sm text-red-400">
              <AlertCircle className="h-4 w-4 mr-2" />
              {error}
            </div>
          )}

          {/* Upload Button */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 hover:text-white hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploadedFiles.length === 0 || isUploading}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
            >
              {isUploading ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Uploading...
                </>
              ) : (
                `Upload ${uploadedFiles.length} File${uploadedFiles.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};