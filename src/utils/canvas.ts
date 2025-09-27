import type { BoundingBox, ImageData } from '../types';

export const drawBoundingBoxes = (
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  imageData: ImageData,
  selectedBoxId: string | null,
  zoom: number,
  pan: { x: number; y: number }
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Calculate the scale factor from original image dimensions to canvas display dimensions
  const imageToCanvasScale = canvas.width / imageData.width;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(pan.x, pan.y);
  ctx.scale(zoom, zoom);

  // Draw the image
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // Draw bounding boxes
  imageData.boundingBoxes.forEach((box) => {
    const isSelected = selectedBoxId === box.id;
    ctx.strokeStyle = isSelected ? '#3B82F6' : '#10B981';
    ctx.lineWidth = isSelected ? 3 / zoom : 2 / zoom;
    ctx.setLineDash(isSelected ? [5 / zoom, 5 / zoom] : []);

    // Scale box coordinates from original image dimensions to canvas display dimensions
    const displayX = box.x * imageToCanvasScale;
    const displayY = box.y * imageToCanvasScale;
    const displayWidth = box.width * imageToCanvasScale;
    const displayHeight = box.height * imageToCanvasScale;

    ctx.strokeRect(displayX, displayY, displayWidth, displayHeight);

    // Draw label
    const text = `${box.className} (${(box.confidence * 100).toFixed(0)}%)`;
    ctx.fillStyle = isSelected ? '#3B82F6' : '#10B981';
    ctx.font = `${12 / zoom}px Arial`;
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width + (8 / zoom);
    const textHeight = 20 / zoom;

    ctx.fillRect(displayX, displayY - textHeight, textWidth, textHeight);

    ctx.fillStyle = 'white';
    ctx.fillText(text, displayX + (4 / zoom), displayY - (6 / zoom));
  });

  ctx.restore();
};

export const getCanvasCoordinates = (
  e: React.MouseEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
  imageData: ImageData,
  zoom: number,
  pan: { x: number; y: number }
): { x: number; y: number } => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Convert mouse coordinates to image coordinates
  const xOnImage = ((mouseX - pan.x) / zoom) * (imageData.width / canvas.width);
  const yOnImage = ((mouseY - pan.y) / zoom) * (imageData.height / canvas.height);

  return { x: xOnImage, y: yOnImage };
};

export const findBoundingBoxAtPoint = (
  point: { x: number; y: number },
  boundingBoxes: BoundingBox[]
): BoundingBox | null => {
  return boundingBoxes.find(box =>
    point.x >= box.x && 
    point.x <= box.x + box.width &&
    point.y >= box.y && 
    point.y <= box.y + box.height
  ) || null;
};

export const drawTemporaryBox = (
  canvas: HTMLCanvasElement,
  startPoint: { x: number; y: number },
  currentPoint: { x: number; y: number },
  imageData: ImageData,
  zoom: number,
  pan: { x: number; y: number }
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.translate(pan.x, pan.y);
  ctx.scale(zoom, zoom);

  const imageToCanvasScale = canvas.width / imageData.width;
  const startXOnCanvas = startPoint.x * imageToCanvasScale;
  const startYOnCanvas = startPoint.y * imageToCanvasScale;
  const currentXOnCanvas = currentPoint.x * imageToCanvasScale;
  const currentYOnCanvas = currentPoint.y * imageToCanvasScale;

  const tempBoxX = Math.min(startXOnCanvas, currentXOnCanvas);
  const tempBoxY = Math.min(startYOnCanvas, currentYOnCanvas);
  const tempBoxWidth = Math.abs(startXOnCanvas - currentXOnCanvas);
  const tempBoxHeight = Math.abs(startYOnCanvas - currentYOnCanvas);

  ctx.strokeStyle = '#3B82F6';
  ctx.lineWidth = 2 / zoom;
  ctx.setLineDash([5 / zoom, 5 / zoom]);
  ctx.strokeRect(tempBoxX, tempBoxY, tempBoxWidth, tempBoxHeight);
  ctx.restore();
};