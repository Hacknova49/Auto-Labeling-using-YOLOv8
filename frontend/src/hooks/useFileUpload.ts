import { useState } from 'react';
import { validateImageFile, createImageFromFile, generateId } from '../utils/file';
import type { ImageData } from '../types';

export const useFileUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadFiles = async (files: File[]): Promise<ImageData[]> => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const validFiles: File[] = [];
      const errors: string[] = [];

      // Validate files
      for (const file of files) {
        const validation = validateImageFile(file);
        if (validation.isValid) {
          validFiles.push(file);
        } else {
          errors.push(`${file.name}: ${validation.error}`);
        }
      }

      if (validFiles.length === 0) {
        throw new Error('No valid files to upload');
      }

      if (errors.length > 0) {
        setUploadError(`${errors.length} files were skipped: ${errors.join(', ')}`);
      }

      // Create image data for valid files
      const imageDataPromises = validFiles.map(async (file): Promise<ImageData> => {
        const { width, height, url } = await createImageFromFile(file);
        
        return {
          id: generateId(),
          filename: file.name,
          url,
          width,
          height,
          status: 'pending',
          boundingBoxes: [],
        };
      });

      const imageDataList = await Promise.all(imageDataPromises);
      return imageDataList;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadError(errorMessage);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    isUploading,
    uploadError,
    uploadFiles,
    clearError: () => setUploadError(null),
  };
};