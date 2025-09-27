import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Save, Trash2, Plus, RotateCcw, ZoomIn, ZoomOut, Square } from 'lucide-react';
import { useProject, BoundingBox } from '../contexts/ProjectContext';

interface AnnotationEditorProps {
  imageId: string;
  onBack: () => void;
  onNext: (nextId: string) => void;
}

export const AnnotationEditor: React.FC<AnnotationEditorProps> = ({ imageId, onBack, onNext }) => {
  const { images, updateBoundingBoxes, updateImage } = useProject();
  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const currentImage = images.find(img => img.id === imageId);
  const currentIndex = images.findIndex(img => img.id === imageId);

  useEffect(() => {
    if (currentImage && canvasRef.current && imageRef.current) {
      drawCanvas();
    }
  }, [currentImage, selectedBox, zoom, pan]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !currentImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    ctx.drawImage(image, 0, 0, canvas.width / zoom, canvas.height / zoom);

    // Draw bounding boxes
    currentImage.boundingBoxes.forEach((box) => {
      const isSelected = selectedBox === box.id;
      
      ctx.strokeStyle = isSelected ? '#3B82F6' : '#10B981';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.setLineDash(isSelected ? [5, 5] : []);
      
      ctx.strokeRect(
        (box.x / currentImage.width) * (canvas.width / zoom),
        (box.y / currentImage.height) * (canvas.height / zoom),
        (box.width / currentImage.width) * (canvas.width / zoom),
        (box.height / currentImage.height) * (canvas.height / zoom)
      );

      // Draw label
      ctx.fillStyle = isSelected ? '#3B82F6' : '#10B981';
      ctx.fillRect(
        (box.x / currentImage.width) * (canvas.width / zoom),
        (box.y / currentImage.height) * (canvas.height / zoom) - 20,
        ctx.measureText(`${box.className} (${(box.confidence * 100).toFixed(0)}%)`).width + 8,
        20
      );
      
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.fillText(
        `${box.className} (${(box.confidence * 100).toFixed(0)}%)`,
        (box.x / currentImage.width) * (canvas.width / zoom) + 4,
        (box.y / currentImage.height) * (canvas.height / zoom) - 6
      );
    });

    ctx.restore();
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !currentImage) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left - pan.x) / zoom) * (currentImage.width / canvas.width);
    const y = ((e.clientY - rect.top - pan.y) / zoom) * (currentImage.height / canvas.height);

    // Check if clicked on existing box
    const clickedBox = currentImage.boundingBoxes.find(box => 
      x >= box.x && x <= box.x + box.width &&
      y >= box.y && y <= box.y + box.height
    );

    if (clickedBox) {
      setSelectedBox(clickedBox.id);
    } else {
      setSelectedBox(null);
      if (isDrawing) {
        setDrawStart({ x, y });
      }
    }
  };

  const addNewBox = () => {
    if (!currentImage) return;
    
    const newBox: BoundingBox = {
      id: Math.random().toString(36).substring(7),
      x: currentImage.width * 0.25,
      y: currentImage.height * 0.25,
      width: currentImage.width * 0.3,
      height: currentImage.height * 0.3,
      className: 'person',
      confidence: 0.85,
    };

    updateBoundingBoxes(imageId, [...currentImage.boundingBoxes, newBox]);
    setSelectedBox(newBox.id);
  };

  const deleteSelectedBox = () => {
    if (!selectedBox || !currentImage) return;
    
    const updatedBoxes = currentImage.boundingBoxes.filter(box => box.id !== selectedBox);
    updateBoundingBoxes(imageId, updatedBoxes);
    setSelectedBox(null);
  };

  const goToNext = () => {
    if (currentIndex < images.length - 1) {
      const nextImage = images[currentIndex + 1];
      onNext(nextImage.id);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      const prevImage = images[currentIndex - 1];
      onNext(prevImage.id);
    }
  };

  const handleSave = () => {
    if (currentImage) {
      updateImage(imageId, { status: 'reviewed' });
    }
  };

  if (!currentImage) {
    return <div className="flex items-center justify-center h-screen text-white">Image not found</div>;
  }

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="inline-flex items-center text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Dashboard
            </button>
            <div className="text-sm text-gray-400">
              {currentIndex + 1} of {images.length}
            </div>
          </div>
          <h2 className="text-lg font-semibold text-white truncate">
            {currentImage.filename}
          </h2>
          <div className="text-sm text-gray-400">
            {currentImage.width} × {currentImage.height}
          </div>
        </div>

        {/* Tools */}
        <div className="p-4 border-b border-gray-700">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={addNewBox}
              className="inline-flex items-center justify-center px-3 py-2 border border-gray-600 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Box
            </button>
            <button
              onClick={deleteSelectedBox}
              disabled={!selectedBox}
              className="inline-flex items-center justify-center px-3 py-2 border border-gray-600 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </button>
          </div>
          
          <div className="grid grid-cols-4 gap-2 mb-4">
            <button
              onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
              className="p-2 border border-gray-600 rounded-md text-gray-400 hover:text-white hover:bg-gray-700"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={() => setZoom(Math.min(3, zoom + 0.25))}
              className="p-2 border border-gray-600 rounded-md text-gray-400 hover:text-white hover:bg-gray-700"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-2 border border-gray-600 rounded-md text-gray-400 hover:text-white hover:bg-gray-700"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsDrawing(!isDrawing)}
              className={`p-2 border border-gray-600 rounded-md ${
                isDrawing ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Square className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Annotations List */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-white mb-3">
            Annotations ({currentImage.boundingBoxes.length})
          </h3>
          <div className="space-y-2">
            {currentImage.boundingBoxes.map((box) => (
              <div
                key={box.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedBox === box.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
                onClick={() => setSelectedBox(box.id)}
              >
                <div className="text-white font-medium">{box.className}</div>
                <div className="text-sm text-gray-400">
                  Confidence: {(box.confidence * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">
                  {Math.round(box.x)}, {Math.round(box.y)} • {Math.round(box.width)} × {Math.round(box.height)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Previous
            </button>
            <button
              onClick={goToNext}
              disabled={currentIndex === images.length - 1}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </button>
          </div>
          <button
            onClick={handleSave}
            className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-2" />
            Save & Mark as Reviewed
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex items-center justify-center bg-gray-900 p-4">
        <div className="relative">
          <img
            ref={imageRef}
            src={currentImage.url}
            alt={currentImage.filename}
            className="hidden"
            onLoad={() => {
              if (canvasRef.current && imageRef.current) {
                canvasRef.current.width = Math.min(800, imageRef.current.naturalWidth);
                canvasRef.current.height = Math.min(600, imageRef.current.naturalHeight);
                drawCanvas();
              }
            }}
          />
          <canvas
            ref={canvasRef}
            className="border border-gray-600 rounded-lg shadow-lg cursor-crosshair"
            onClick={handleCanvasClick}
            style={{
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 8rem)',
            }}
          />
          
          {/* Zoom indicator */}
          <div className="absolute top-4 right-4 bg-gray-800 bg-opacity-80 rounded-lg px-3 py-1">
            <span className="text-white text-sm">{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};