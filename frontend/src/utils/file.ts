import { SUPPORTED_IMAGE_FORMATS, MAX_FILE_SIZE } from '../constants';

export const validateImageFile = (file: File): { isValid: boolean; error?: string } => {
  // Check if it's an image
  if (!file.type.startsWith('image/')) {
    return { isValid: false, error: 'File is not an image' };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { 
      isValid: false, 
      error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` 
    };
  }

  // Check file extension
  const extension = getFileExtension(file.name);
  if (!SUPPORTED_IMAGE_FORMATS.includes(extension)) {
    return { 
      isValid: false, 
      error: `Unsupported format. Supported: ${SUPPORTED_IMAGE_FORMATS.join(', ')}` 
    };
  }

  return { isValid: true };
};

export const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.substring(lastDot).toLowerCase() : '';
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const createImageFromFile = (file: File): Promise<{ width: number; height: number; url: string }> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        url,
      });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(7);
};