import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Save, Trash2, Plus, RotateCcw, ZoomIn, ZoomOut, Square } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { drawBoundingBoxes, getCanvasCoordinates, findBoundingBoxAtPoint, drawTemporaryBox } from '../utils/canvas';
import { generateId } from '../utils/file';
import type { BoundingBox } from '../types';

interface AnnotationEditorProps {
  imageId: string;
  onBack: () => void;
  onNext: (nextId: string) => void;
}

export const AnnotationEditor: React.FC<AnnotationEditorProps> = ({ imageId, onBack, onNext }) => {
  const { images, updateBoundingBoxes, updateImage, processImages, isProcessing } = useProject();
  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false); // New state for panning
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 }); // New state for panning
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const currentImage = images.find(img => img.id === imageId);
  const currentIndex = images.findIndex(img => img.id === imageId);

  // Draw canvas whenever image, selection, zoom, or pan changes
  useEffect(() => {
    if (currentImage && canvasRef.current && imageRef.current && imageRef.current.complete) {
      drawBoundingBoxes(canvasRef.current, imageRef.current, currentImage, selectedBox, zoom, pan);
    }
  }, [currentImage, selectedBox, zoom, pan]);

  // Automatically run YOLO detection if no boxes exist
  useEffect(() => {
    if (currentImage && currentImage.boundingBoxes.length === 0) {
      processImages([currentImage.id]);
    }
  }, [currentImage]);

  const handleZoomIn = () => {
    setZoom(prevZoom => Math.min(prevZoom + 0.1, 5)); // Max zoom 5x
  };

  const handleZoomOut = () => {
    setZoom(prevZoom => Math.max(prevZoom - 0.1, 0.1)); // Min zoom 0.1x
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !currentImage) return;

    const coords = getCanvasCoordinates(e, canvasRef.current, currentImage, zoom, pan);

    if (isDrawing) {
      setDrawStart(coords);
      setSelectedBox(null); // Deselect any box when starting to draw
    } else {
      const clickedBox = findBoundingBoxAtPoint(coords, currentImage.boundingBoxes);

      if (clickedBox) {
        setSelectedBox(clickedBox.id);
        // Future: Add logic here for resizing/moving selected box
      } else {
        setSelectedBox(null);
        setIsPanning(true);
        setLastPanPos({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !currentImage) return;

    if (isPanning) {
      const dx = e.clientX - lastPanPos.x;
      const dy = e.clientY - lastPanPos.y;
      setPan(prevPan => ({ x: prevPan.x + dx, y: prevPan.y + dy }));
      setLastPanPos({ x: e.clientX, y: e.clientY });
    } else if (isDrawing && drawStart) {
      if (canvasRef.current && imageRef.current) {
        // Redraw existing annotations first
        drawBoundingBoxes(canvasRef.current, imageRef.current, currentImage, selectedBox, zoom, pan);
        
        // Draw temporary box
        const currentCoords = getCanvasCoordinates(e, canvasRef.current, currentImage, zoom, pan);
        drawTemporaryBox(canvasRef.current, drawStart, currentCoords, currentImage, zoom, pan);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsPanning(false);
    if (isDrawing && drawStart && currentImage) {
      if (!canvasRef.current) return;
      
      const endCoords = getCanvasCoordinates(e, canvasRef.current, currentImage, zoom, pan);

      const newBoxX = Math.min(drawStart.x, endCoords.x);
      const newBoxY = Math.min(drawStart.y, endCoords.y);
      const newBoxWidth = Math.abs(drawStart.x - endCoords.x);
      const newBoxHeight = Math.abs(drawStart.y - endCoords.y);

      if (newBoxWidth > 5 && newBoxHeight > 5) { // Minimum size for a valid box
        const newBox: BoundingBox = {
          id: generateId(),
          x: newBoxX,
          y: newBoxY,
          width: newBoxWidth,
          height: newBoxHeight,
          className: 'object', // Default class name, could be made configurable
          confidence: 1.0,
        };
        updateBoundingBoxes(imageId, [...currentImage.boundingBoxes, newBox]);
        setSelectedBox(newBox.id);
      }
      setDrawStart(null);
      setIsDrawing(false); // Exit drawing mode after drawing a box
    }
  };

  const toggleDrawingMode = () => {
    setIsDrawing(prev => !prev);
    setSelectedBox(null); // Deselect any box when toggling drawing mode
  };

  const addNewBox = () => {
    if (!currentImage) return;

    const newBox: BoundingBox = {
      id: generateId(),
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
      onNext(images[currentIndex + 1].id);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      onNext(images[currentIndex - 1].id);
    }
  };

  const handleSave = () => {
    if (currentImage) {
      updateImage(imageId, { status: 'reviewed' });
    }
  };

  const handleDetectObjects = () => {
    if (currentImage) processImages([currentImage.id]);
  };

  if (!currentImage) {
    return <div className="flex items-center justify-center h-screen text-white">Image not found</div>;
  }

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <button onClick={onBack} className="inline-flex items-center text-gray-400 hover:text-white">
              <ArrowLeft className="h-5 w-5 mr-2" /> Back
            </button>
            <div className="text-sm text-gray-400">{currentIndex + 1} of {images.length}</div>
          </div>
          <h2 className="text-lg font-semibold text-white truncate">{currentImage.filename}</h2>
          <div className="text-sm text-gray-400">{currentImage.width} × {currentImage.height}</div>
        </div>

        {/* Tools */}
        <div className="p-4 border-b border-gray-700 space-y-2">
          <button
            onClick={addNewBox}
            className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Box (Fixed Pos)
          </button>
          <button
            onClick={toggleDrawingMode}
            className={`w-full flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md ${isDrawing ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
          >
            <Square className="h-4 w-4 mr-1" /> {isDrawing ? 'Stop Drawing' : 'Draw New Box'}
          </button>
          <button
            onClick={deleteSelectedBox}
            disabled={!selectedBox}
            className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete Box
          </button>
          <button
            onClick={handleDetectObjects}
            disabled={isProcessing}
            className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Detect Objects
          </button>
          <div className="flex justify-between space-x-2">
            <button
              onClick={handleZoomOut}
              className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-200 bg-gray-700 hover:bg-gray-600 rounded-md"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={handleResetView}
              className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-200 bg-gray-700 hover:bg-gray-600 rounded-md"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={handleZoomIn}
              className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-200 bg-gray-700 hover:bg-gray-600 rounded-md"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Annotation List */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-white mb-3">Annotations ({currentImage.boundingBoxes.length})</h3>
          <div className="space-y-2">
            {currentImage.boundingBoxes.map(box => (
              <div
                key={box.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedBox === box.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500'
                }`}
                onClick={() => setSelectedBox(box.id)}
              >
                <div className="text-white font-medium">{box.className}</div>
                <div className="text-sm text-gray-400">Confidence: {(box.confidence*100).toFixed(1)}%</div>
                <div className="text-xs text-gray-500">
                  {Math.round(box.x)}, {Math.round(box.y)} • {Math.round(box.width)} × {Math.round(box.height)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          <div className="flex justify-between">
            <button onClick={goToPrevious} disabled={currentIndex === 0} className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed">
              <ArrowLeft className="h-4 w-4 mr-1" /> Previous
            </button>
            <button onClick={goToNext} disabled={currentIndex === images.length -1} className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed">
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </button>
          </div>
          <button onClick={handleSave} className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md">
            <Save className="h-4 w-4 mr-2" /> Save & Review
          </button>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex items-center justify-center bg-gray-900 p-4">
        <div className="relative">
          <img
            ref={imageRef}
            src={currentImage.url}
            alt={currentImage.filename}
            className="hidden"
            onLoad={() => {
              if (canvasRef.current && imageRef.current) {
                const canvas = canvasRef.current;
                const image = imageRef.current;

                const maxWidth = 800;
                const maxHeight = 600;

                let newWidth = image.naturalWidth;
                let newHeight = image.naturalHeight;

                // Scale down if image is larger than max dimensions, maintaining aspect ratio
                if (newWidth > maxWidth) {
                  newHeight = (newHeight / newWidth) * maxWidth;
                  newWidth = maxWidth;
                }
                if (newHeight > maxHeight) {
                  newWidth = (newWidth / newHeight) * maxHeight;
                  newHeight = maxHeight;
                }

                canvas.width = newWidth;
                canvas.height = newHeight;
                drawBoundingBoxes(canvas, image, currentImage, selectedBox, zoom, pan);
              }
            }}
          />
          <canvas
            ref={canvasRef}
            className="border border-gray-600 rounded-lg shadow-lg"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp} // End pan/draw if mouse leaves canvas
            style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 8rem)', cursor: isDrawing ? 'crosshair' : (isPanning ? 'grabbing' : 'grab') }}
          />
          <div className="absolute top-4 right-4 bg-gray-800 bg-opacity-80 rounded-lg px-3 py-1">
            <span className="text-white text-sm">{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
