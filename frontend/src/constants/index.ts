export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff'];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const COMMON_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
  'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
  'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
  'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee'
];

export const POLLING_INTERVAL = 1000; // 1 second
export const MAX_POLLING_ATTEMPTS = 30;

export const EXPORT_FORMATS = ['yolo', 'coco', 'pascal'] as const;