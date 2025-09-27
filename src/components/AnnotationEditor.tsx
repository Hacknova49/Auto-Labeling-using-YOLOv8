import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Save, Trash2, Plus, RotateCcw, ZoomIn, ZoomOut, Square, Move, CreditCard as Edit3, Eye, EyeOff } from 'lucide-react';
import { useProject, BoundingBox } from '../contexts/ProjectContext';

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
    if (currentImage && canvasRef.current && imageRef.current) {
      drawCanvas();
    }
  }, [currentImage, selectedBox, zoom, pan]);

  // Automatically run YOLO detection if no boxes exist
  useEffect(() => {
    if (currentImage && currentImage.boundingBoxes.length === 0) {
      processImages([currentImage.id]);
    }
  }, [currentImage]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !currentImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate the scale factor from original image dimensions to the canvas display dimensions (at zoom=1)
    // This assumes the canvas dimensions are set proportionally in onLoad.
    const imageToCanvasScale = canvas.width / currentImage.width;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw the image to fill the canvas at the current zoom level.
    // The canvas dimensions are already set to fit the image (proportionally scaled down)
    // when zoom = 1.
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    currentImage.boundingBoxes.forEach((box) => {
      const isSelected = selectedBox === box.id;
      ctx.strokeStyle = isSelected ? '#3B82F6' : '#10B981';
      ctx.lineWidth = isSelected ? 3 / zoom : 2 / zoom; // Adjust line width for zoom
      ctx.setLineDash(isSelected ? [5 / zoom, 5 / zoom] : []); // Adjust dash for zoom

      // Scale box coordinates from original image dimensions to the current canvas display dimensions (at zoom=1)
      const displayX = box.x * imageToCanvasScale;
      const displayY = box.y * imageToCanvasScale;
      const displayWidth = box.width * imageToCanvasScale;
      const displayHeight = box.height * imageToCanvasScale;

      ctx.strokeRect(displayX, displayY, displayWidth, displayHeight);

      const text = `${box.className} (${(box.confidence * 100).toFixed(0)}%)`;
      ctx.fillStyle = isSelected ? '#3B82F6' : '#10B981';
      ctx.font = `${12 / zoom}px Arial`; // Adjust font size for zoom
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width + (8 / zoom); // Adjust padding for zoom
      const textHeight = 20 / zoom; // Approximate height for the text background

      ctx.fillRect(
        displayX,
        displayY - textHeight,
        textWidth,
        textHeight
      );

      ctx.fillStyle = 'white';
      ctx.fillText(
        text,
        displayX + (4 / zoom),
        displayY - (6 / zoom)
      );
    });

    ctx.restore();
  };

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

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert mouse coordinates on canvas to coordinates on the original image
    const xOnImage = ((mouseX - pan.x) / zoom) * (currentImage.width / canvasRef.current.width);
    const yOnImage = ((mouseY - pan.y) / zoom) * (currentImage.height / canvasRef.current.height);

    if (isDrawing) {
      setDrawStart({ x: xOnImage, y: yOnImage });
      setSelectedBox(null); // Deselect any box when starting to draw
    } else {
      const clickedBox = currentImage.boundingBoxes.find(box =>
        xOnImage >= box.x && xOnImage <= box.x + box.width &&
        yOnImage >= box.y && yOnImage <= box.y + box.height
      );

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
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      drawCanvas(); // Redraw existing annotations first

      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      const rect = canvas.getBoundingClientRect();
      const currentXOnCanvas = (e.clientX - rect.left - pan.x) / zoom;
      const currentYOnCanvas = (e.clientY - rect.top - pan.y) / zoom;

      // Convert drawStart (image coords) to canvas coords
      const imageToCanvasScale = canvas.width / currentImage.width;
      const startXOnCanvas = drawStart.x * imageToCanvasScale;
      const startYOnCanvas = drawStart.y * imageToCanvasScale;

      const tempBoxX = Math.min(startXOnCanvas, currentXOnCanvas);
      const tempBoxY = Math.min(startYOnCanvas, currentYOnCanvas);
      const tempBoxWidth = Math.abs(startXOnCanvas - currentXOnCanvas);
      const tempBoxHeight = Math.abs(startYOnCanvas - currentYOnCanvas);

      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([5 / zoom, 5 / zoom]);
      ctx.strokeRect(tempBoxX, tempBoxY, tempBoxWidth, tempBoxHeight);
      ctx.restore();
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsPanning(false);
    if (isDrawing && drawStart && currentImage) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const endXOnImage = ((e.clientX - rect.left - pan.x) / zoom) * (currentImage.width / canvas.width);
      const endYOnImage = ((e.clientY - rect.top - pan.y) / zoom) * (currentImage.height / canvas.height);

      const newBoxX = Math.min(drawStart.x, endXOnImage);
      const newBoxY = Math.min(drawStart.y, endYOnImage);
      const newBoxWidth = Math.abs(drawStart.x - endXOnImage);
      const newBoxHeight = Math.abs(drawStart.y - endYOnImage);

      if (newBoxWidth > 5 && newBoxHeight > 5) { // Minimum size for a valid box
        const newBox: BoundingBox = {
          id: Math.random().toString(36).substring(7),
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
                drawCanvas();
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
