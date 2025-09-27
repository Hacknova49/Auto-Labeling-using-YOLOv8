import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { ImageData, Dataset, PrioritizationPrompt, BoundingBox } from '../types';
import { useImageProcessing } from '../hooks/useImageProcessing';
import { useFileUpload } from '../hooks/useFileUpload';
import { generateId } from '../utils/file';

interface ProjectContextType {
  images: ImageData[];
  datasets: Dataset[];
  currentDataset: Dataset | null;
  prioritizationPrompt: PrioritizationPrompt;
  processingQueue: string[];
  addImages: (files: File[]) => void;
  updateImage: (imageId: string, updates: Partial<ImageData>) => void;
  updateBoundingBoxes: (imageId: string, boxes: BoundingBox[]) => void;
  setPrioritizationPrompt: (prompt: PrioritizationPrompt) => void;
  processImages: (imageIds: string[]) => void;
  createDataset: (name: string) => void;
  exportDataset: (format: 'yolo' | 'coco' | 'pascal') => void;
  isProcessing: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [images, setImages] = useState<ImageData[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [currentDataset, setCurrentDataset] = useState<Dataset | null>(null);
  const [prioritizationPrompt, setPrioritizationPrompt] = useState<PrioritizationPrompt>({
    confidenceThreshold: 0.5,
  });
  
  const { isProcessing, processingQueue, processImages: processImagesHook } = useImageProcessing();
  const { uploadFiles: uploadFilesHook } = useFileUpload();

  const addImages = (files: File[]) => {
    uploadFilesHook(files)
      .then(imageDataList => {
        setImages(prev => [...prev, ...imageDataList]);
      })
      .catch(error => {
        console.error('Failed to add images:', error);
      });
  };

  const updateImage = (imageId: string, updates: Partial<ImageData>) => {
    setImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, ...updates } : img
    ));
  };

  const updateBoundingBoxes = (imageId: string, boxes: BoundingBox[]) => {
    updateImage(imageId, { boundingBoxes: boxes });
  };

  const processImages = async (imageIds: string[]) => {
    const imagesToProcess = images.filter(img => imageIds.includes(img.id));
    
    await processImagesHook(
      imagesToProcess,
      prioritizationPrompt,
      (imageId, status) => {
        updateImage(imageId, { status });
      },
      (imageId, detections, processingTime) => {
        updateImage(imageId, {
          status: 'completed',
          boundingBoxes: detections,
          processingTime,
        });
      }
    );
  };

  const createDataset = (name: string) => {
    const dataset: Dataset = {
      id: generateId(),
      name,
      version: '1.0',
      createdAt: new Date(),
      imageCount: images.length,
      totalAnnotations: images.reduce((sum, img) => sum + img.boundingBoxes.length, 0),
    };
    setDatasets(prev => [...prev, dataset]);
    setCurrentDataset(dataset);
  };

  const exportDataset = (format: 'yolo' | 'coco' | 'pascal') => {
    console.log(`Exporting dataset in ${format} format...`);
    // TODO: Implement dataset export with API service
  };

  return (
    <ProjectContext.Provider value={{
      images,
      datasets,
      currentDataset,
      prioritizationPrompt,
      processingQueue,
      addImages,
      updateImage,
      updateBoundingBoxes,
      setPrioritizationPrompt,
      processImages,
      createDataset,
      exportDataset,
      isProcessing,
    }}>
      {children}
    </ProjectContext.Provider>
  );
};
