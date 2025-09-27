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
        width: 800,
        height: 600,
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
      const img = images.find(i => i.id === imageId);
      if (!img) continue;

      updateImage(imageId, { status: "processing" });

      try {
        // Convert blob from object URL
        const fileResponse = await fetch(img.url);
        const blob = await fileResponse.blob();
        const formData = new FormData();
        formData.append("file", blob, img.filename);

        // Send to YOLOv8 backend
        const res = await fetch("http://localhost:8000/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Detection API error");

        const data = await res.json();

        // Apply prioritization filters
        const detections: BoundingBox[] = data.boundingBoxes
          .filter((box: any) => {
            // Confidence filter
            if (
              prioritizationPrompt.confidenceThreshold &&
              box.confidence < prioritizationPrompt.confidenceThreshold
            ) return false;

            // Ignore classes
            if (
              prioritizationPrompt.ignoreClasses &&
              prioritizationPrompt.ignoreClasses.includes(box.class_name)
            ) return false;

            // Object size constraints
            const area = box.width * box.height;
            if (
              prioritizationPrompt.minObjectSize &&
              area < prioritizationPrompt.minObjectSize
            ) return false;

            if (
              prioritizationPrompt.maxObjectSize &&
              area > prioritizationPrompt.maxObjectSize
            ) return false;

            return true;
          })
          .map((box: any) => ({
            id: Math.random().toString(36).substring(7),
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            className: box.class_name,
            confidence: box.confidence,
          }));

        // Optional: reorder based on class priorities
        if (prioritizationPrompt.classPriorities?.length) {
          detections.sort((a, b) => {
            const priA =
              prioritizationPrompt.classPriorities?.indexOf(a.className) ?? 999;
            const priB =
              prioritizationPrompt.classPriorities?.indexOf(b.className) ?? 999;
            return priA - priB;
          });
        }

        updateImage(imageId, {
          status: "completed",
          boundingBoxes: detections,
          processingTime: 1.0,
        });
      } catch (err) {
        console.error("Detection failed:", err);
        updateImage(imageId, { status: "pending" });
      }
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
    console.log(`Exporting dataset in ${format} format...`);
    // TODO: call backend /api/datasets/{dataset_id}/export
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
