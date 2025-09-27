import React, { createContext, useContext, useState, ReactNode } from 'react';

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
  const [processingQueue, setProcessingQueue] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const addImages = (files: File[]) => {
    const newImages: ImageData[] = files
      .filter(file => file.type.startsWith('image/'))
      .map(file => ({
        id: Math.random().toString(36).substring(7),
        filename: file.name,
        url: URL.createObjectURL(file),
        width: 800, // Will be updated when image loads
        height: 600, // Will be updated when image loads
        status: 'pending' as const,
        boundingBoxes: [],
      }));

    setImages(prev => [...prev, ...newImages]);
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
    setIsProcessing(true);
    setProcessingQueue(imageIds);

    for (const imageId of imageIds) {
      updateImage(imageId, { status: 'processing' });
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock detection results
      const mockBoxes: BoundingBox[] = [
        {
          id: Math.random().toString(36).substring(7),
          x: Math.random() * 300,
          y: Math.random() * 200,
          width: 100 + Math.random() * 100,
          height: 80 + Math.random() * 80,
          className: ['person', 'car', 'bicycle', 'dog'][Math.floor(Math.random() * 4)],
          confidence: 0.7 + Math.random() * 0.3,
        },
        {
          id: Math.random().toString(36).substring(7),
          x: Math.random() * 400,
          y: Math.random() * 300,
          width: 80 + Math.random() * 120,
          height: 60 + Math.random() * 100,
          className: ['person', 'car', 'bicycle', 'dog'][Math.floor(Math.random() * 4)],
          confidence: 0.6 + Math.random() * 0.4,
        },
      ];

      updateImage(imageId, { 
        status: 'completed', 
        boundingBoxes: mockBoxes,
        processingTime: 1.5 + Math.random() * 2
      });
    }

    setProcessingQueue([]);
    setIsProcessing(false);
  };

  const createDataset = (name: string) => {
    const dataset: Dataset = {
      id: Math.random().toString(36).substring(7),
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
    // Mock export functionality
    console.log(`Exporting dataset in ${format} format...`);
    // In real implementation, this would generate and download the export file
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