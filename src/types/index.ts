export interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  className: string;
  confidence: number;
}

export interface ImageData {
  id: string;
  filename: string;
  url: string;
  width: number;
  height: number;
  status: 'pending' | 'processing' | 'completed' | 'reviewed';
  boundingBoxes: BoundingBox[];
  processingTime?: number;
}

export interface Dataset {
  id: string;
  name: string;
  version: string;
  createdAt: Date;
  imageCount: number;
  totalAnnotations: number;
}

export interface PrioritizationPrompt {
  classPriorities?: string[];
  classWeights?: Record<string, number>;
  confidenceThreshold?: number;
  minObjectSize?: number;
  maxObjectSize?: number;
  ignoreClasses?: string[];
  customPrompt?: string;
}

export interface UploadResponse {
  uploaded_files: Array<{
    id: string;
    filename: string;
    path: string;
    size: number;
    contentType: string;
    width: number;
    height: number;
  }>;
  count: number;
  errors?: string[];
}

export interface ProcessResponse {
  job_id: string;
  status: string;
  image_count: number;
}

export interface JobStatusResponse {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  image_count: number;
  completed_count: number;
  results: Array<{
    image_id: string;
    image_path: string;
    detections: Array<{
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      class_name: string;
      confidence: number;
    }>;
    processing_time: number;
    status: string;
  }>;
  created_at: string;
  completed_at?: string;
}