# YOLOv8 Auto-Labeling Web Application

A comprehensive web application for automated object detection and labeling using YOLOv8, designed for AI model training data preparation.

## Features

### 🚀 Core Functionality
- **YOLOv8 Integration**: GPU-accelerated inference with CPU fallback
- **Multiple Input Types**: Single images, batch folder uploads, video files, and webcam capture
- **Auto-labeling**: Generate bounding boxes, class names, and confidence scores automatically
- **Export Formats**: Support for YOLO, COCO, and Pascal VOC annotation formats

### 🎯 Prioritization System
- **Natural Language Prompts**: Describe detection priorities in plain English
- **JSON Configuration**: Advanced settings for precise control
- **Class Prioritization**: Focus on specific object classes
- **Confidence Filtering**: Adjust detection thresholds
- **Size Filtering**: Filter objects by minimum/maximum area
- **Class Weighting**: Boost confidence for important classes

### ✏️ Interactive Editor
- **Visual Annotation**: Drag and resize bounding boxes
- **Class Management**: Change object classes and delete/add boxes
- **Keyboard Shortcuts**: Speed up the review process
- **Batch Processing**: Queue multiple images for inference
- **Real-time Feedback**: See processing progress and results

### 📊 Dataset Management
- **Project Organization**: Organize images and annotations into projects
- **Dataset Versioning**: Create and manage different dataset versions
- **Export Options**: Download complete datasets as ZIP files
- **Statistics**: Track annotation progress and dataset metrics

## Architecture

### Frontend (React + TypeScript + Tailwind CSS)
- Modern, responsive user interface
- Real-time progress tracking
- Interactive annotation tools
- Drag-and-drop file uploads
- Dark theme optimized for long annotation sessions

### Backend (FastAPI + Python)
- RESTful API with OpenAPI documentation
- Background job processing
- File upload and management
- Multiple export format generation
- YOLOv8 model integration

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+
- Docker and Docker Compose (optional)

### Option 1: Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd yolov8-auto-labeling
```

2. Start the application:
```bash
docker-compose up --build
```

3. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Option 2: Manual Setup

#### Backend Setup
1. Create a virtual environment:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. For actual YOLOv8 integration, uncomment the YOLOv8 dependencies in `requirements.txt` and install:
```bash
pip install ultralytics torch torchvision opencv-python
```

4. Start the backend server:
```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup
1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Access the application at http://localhost:3000

## YOLOv8 Integration

The current implementation includes mock YOLOv8 functionality for demonstration. To integrate with actual YOLOv8:

1. Uncomment YOLOv8 dependencies in `backend/requirements.txt`
2. Replace mock inference in `backend/app.py`:

```python
from ultralytics import YOLO

# Load YOLOv8 model
model = YOLO('yolov8n.pt')  # or yolov8s.pt, yolov8m.pt, yolov8l.pt, yolov8x.pt

def process_single_image(image_path: str, prioritization: Dict[str, Any]) -> Dict[str, Any]:
    """Process a single image with YOLO detection"""
    try:
        # Actual YOLOv8 inference
        results = model(image_path, conf=prioritization.get("confidenceThreshold", 0.5))
        
        detections = []
        for r in results:
            boxes = r.boxes
            if boxes is not None:
                for box in boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = box.conf[0].item()
                    cls = int(box.cls[0].item())
                    class_name = model.names[cls]
                    
                    detections.append({
                        "id": str(uuid.uuid4()),
                        "x": x1,
                        "y": y1,
                        "width": x2 - x1,
                        "height": y2 - y1,
                        "class_name": class_name,
                        "confidence": conf
                    })
        
        # Apply prioritization filters
        filtered_detections = apply_prioritization(detections, prioritization)
        
        return {
            "image_path": image_path,
            "detections": filtered_detections,
            "processing_time": time.time() - start_time,
            "status": "completed"
        }
    except Exception as e:
        return {
            "image_path": image_path,
            "error": str(e),
            "status": "failed"
        }
```

## API Endpoints

### Upload Images
```http
POST /api/upload
Content-Type: multipart/form-data
```

### Process Images
```http
POST /api/process
Content-Type: application/json

{
  "image_ids": ["image1", "image2"],
  "prioritization": {
    "confidenceThreshold": 0.7,
    "classPriorities": ["person", "car"],
    "classWeights": {"person": 1.2},
    "minObjectSize": 100,
    "customPrompt": "Focus on detecting people and vehicles"
  }
}
```

### Get Job Status
```http
GET /api/jobs/{job_id}
```

### Create Dataset
```http
POST /api/datasets
Content-Type: application/json

{
  "name": "Training Dataset v1",
  "image_ids": ["image1", "image2"],
  "export_format": "yolo"
}
```

### Export Dataset
```http
GET /api/datasets/{dataset_id}/export
```

## Keyboard Shortcuts

- `Space`: Next image
- `Shift + Space`: Previous image
- `Delete`: Delete selected bounding box
- `Enter`: Save and mark as reviewed
- `Esc`: Deselect current bounding box
- `+`: Zoom in
- `-`: Zoom out
- `0`: Reset zoom and pan

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the API documentation at http://localhost:8000/docs
- Review the example configurations in the prioritization panel

## Performance Tips

1. **GPU Acceleration**: Ensure CUDA is available for faster YOLOv8 inference
2. **Batch Processing**: Process multiple images simultaneously for better throughput
3. **Image Optimization**: Consider resizing very large images before processing
4. **Model Selection**: Choose appropriate YOLOv8 model size (n/s/m/l/x) based on speed/accuracy requirements