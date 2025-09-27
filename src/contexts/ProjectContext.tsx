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
    const newImages: ImageData[] = [];
    
    files.filter(file => file.type.startsWith('image/')).forEach(file => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      
      img.onload = () => {
        const imageData: ImageData = {
          id: Math.random().toString(36).substring(7),
          filename: file.name,
          url: url,
          width: img.naturalWidth,
          height: img.naturalHeight,
          status: 'pending' as const,
          boundingBoxes: [],
        };
        
        setImages(prev => [...prev, imageData]);
      };
      
      img.src = url;
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
    setIsProcessing(true);
    setProcessingQueue(imageIds);

    for (const imageId of imageIds) {
      const img = images.find(i => i.id === imageId);
      if (!img) continue;

      updateImage(imageId, { status: "processing" });

      try {
        // Create FormData with the file
        const formData = new FormData();
        
        // Convert blob URL back to file
        const response = await fetch(img.url);
        const blob = await response.blob();
        const file = new File([blob], img.filename, { type: blob.type });
        formData.append("files", file);

        // Upload file first
        const uploadRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/upload`, {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) throw new Error("Upload failed");
        
        const uploadData = await uploadRes.json();
        const uploadedFile = uploadData.uploaded_files[0];
        
        // Process the uploaded image
        const processRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/process`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_ids: [uploadedFile.id],
            prioritization: prioritizationPrompt,
          }),
        });

        if (!processRes.ok) throw new Error("Processing failed");
        
        const processData = await processRes.json();
        const jobId = processData.job_id;
        
        // Poll for results
        let completed = false;
        let attempts = 0;
        const maxAttempts = 30;
        
        while (!completed && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const statusRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/jobs/${jobId}`);
          if (!statusRes.ok) throw new Error("Status check failed");
          
          const statusData = await statusRes.json();
          
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

              updateImage(imageId, {
                status: "completed",
                boundingBoxes: detections,
                processingTime: result.processing_time || 1.0,
              });
            } else {
              throw new Error("No detection results");
            }
          }
          
          attempts++;
        }
        
        if (!completed) {
          throw new Error("Processing timeout");
        }
        
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
