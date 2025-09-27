import { useState } from 'react';
import { apiService } from '../services/api';
import { POLLING_INTERVAL, MAX_POLLING_ATTEMPTS } from '../constants';
import type { PrioritizationPrompt, BoundingBox } from '../types';

export const useImageProcessing = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingQueue, setProcessingQueue] = useState<string[]>([]);

  const processImages = async (
    images: Array<{ id: string; url: string; filename: string }>,
    prioritization: PrioritizationPrompt,
    onProgress?: (imageId: string, status: 'processing' | 'completed' | 'failed') => void,
    onComplete?: (imageId: string, detections: BoundingBox[], processingTime: number) => void
  ) => {
    setIsProcessing(true);
    setProcessingQueue(images.map(img => img.id));

    try {
      for (const image of images) {
        onProgress?.(image.id, 'processing');

        try {
          // Convert blob URL back to file
          const response = await fetch(image.url);
          const blob = await response.blob();
          const file = new File([blob], image.filename, { type: blob.type });

          // Upload file
          const uploadData = await apiService.uploadFiles([file]);
          const uploadedFile = uploadData.uploaded_files[0];

          // Process the uploaded image
          const processData = await apiService.processImages([uploadedFile.id], prioritization);
          const jobId = processData.job_id;

          // Poll for results
          let completed = false;
          let attempts = 0;

          while (!completed && attempts < MAX_POLLING_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));

            const statusData = await apiService.getJobStatus(jobId);

            if (statusData.status === 'completed') {
              completed = true;
              const result = statusData.results[0];

              if (result && result.detections) {
                const detections: BoundingBox[] = result.detections.map((detection: any) => ({
                  id: detection.id || Math.random().toString(36).substring(7),
                  x: detection.x,
                  y: detection.y,
                  width: detection.width,
                  height: detection.height,
                  className: detection.class_name,
                  confidence: detection.confidence,
                }));

                onProgress?.(image.id, 'completed');
                onComplete?.(image.id, detections, result.processing_time || 1.0);
              } else {
                throw new Error('No detection results');
              }
            }

            attempts++;
          }

          if (!completed) {
            throw new Error('Processing timeout');
          }

        } catch (error) {
          console.error(`Detection failed for ${image.filename}:`, error);
          onProgress?.(image.id, 'failed');
        }
      }
    } finally {
      setProcessingQueue([]);
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    processingQueue,
    processImages,
  };
};