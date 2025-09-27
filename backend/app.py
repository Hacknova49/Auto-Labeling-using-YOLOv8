from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from typing import List, Optional, Dict, Any
import uvicorn
import os
import json
import uuid
import shutil
import zipfile
from datetime import datetime
from pathlib import Path

# Mock YOLOv8 - Replace with actual YOLOv8 import in production
# from ultralytics import YOLO

app = FastAPI(title="YOLOv8 Auto-Labeling API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global configuration
UPLOAD_DIR = Path("uploads")
RESULTS_DIR = Path("results")
DATASETS_DIR = Path("datasets")

# Create directories
UPLOAD_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(exist_ok=True)
DATASETS_DIR.mkdir(exist_ok=True)

# Mock YOLO model - Replace with actual model loading
# model = YOLO('yolov8n.pt')  # or yolov8s.pt, yolov8m.pt, yolov8l.pt, yolov8x.pt

# In-memory storage for demo - Use proper database in production
jobs_db = {}
datasets_db = {}

class MockYOLOResult:
    """Mock YOLO result for demonstration"""
    def __init__(self, image_path: str):
        self.image_path = image_path
        # Mock detection results
        self.boxes = [
            {
                "id": str(uuid.uuid4()),
                "x": 100,
                "y": 150,
                "width": 200,
                "height": 180,
                "class_name": "person",
                "confidence": 0.85
            },
            {
                "id": str(uuid.uuid4()),
                "x": 300,
                "y": 200,
                "width": 150,
                "height": 120,
                "class_name": "car",
                "confidence": 0.78
            }
        ]

def apply_prioritization(results: List[Dict], prompt: Dict[str, Any]) -> List[Dict]:
    """Apply prioritization settings to detection results"""
    filtered_results = []
    
    for result in results:
        confidence_threshold = prompt.get("confidenceThreshold", 0.5)
        if result["confidence"] < confidence_threshold:
            continue
            
        # Class priority filtering
        class_priorities = prompt.get("classPriorities", [])
        if class_priorities and result["class_name"] not in class_priorities:
            continue
            
        # Ignore classes filtering
        ignore_classes = prompt.get("ignoreClasses", [])
        if result["class_name"] in ignore_classes:
            continue
            
        # Object size filtering
        object_area = result["width"] * result["height"]
        min_size = prompt.get("minObjectSize", 0)
        max_size = prompt.get("maxObjectSize", float('inf'))
        
        if object_area < min_size or object_area > max_size:
            continue
            
        # Apply class weights
        class_weights = prompt.get("classWeights", {})
        if result["class_name"] in class_weights:
            result["confidence"] *= class_weights[result["class_name"]]
            result["confidence"] = min(1.0, result["confidence"])  # Cap at 1.0
            
        filtered_results.append(result)
    
    return filtered_results

def process_single_image(image_path: str, prioritization: Dict[str, Any]) -> Dict[str, Any]:
    """Process a single image with YOLO detection"""
    try:
        # Mock YOLO inference - Replace with actual inference
        # results = model(image_path)
        
        # Mock processing
        mock_result = MockYOLOResult(image_path)
        detections = apply_prioritization(mock_result.boxes, prioritization)
        
        return {
            "image_path": image_path,
            "detections": detections,
            "processing_time": 1.2,  # Mock processing time
            "status": "completed"
        }
    except Exception as e:
        return {
            "image_path": image_path,
            "error": str(e),
            "status": "failed"
        }

@app.post("/api/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    """Upload multiple image files"""
    uploaded_files = []
    
    for file in files:
        if not file.content_type.startswith('image/'):
            continue
            
        file_id = str(uuid.uuid4())
        file_extension = Path(file.filename).suffix
        file_path = UPLOAD_DIR / f"{file_id}{file_extension}"
        
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        uploaded_files.append({
            "id": file_id,
            "filename": file.filename,
            "path": str(file_path),
            "size": os.path.getsize(file_path)
        })
    
    return {"uploaded_files": uploaded_files, "count": len(uploaded_files)}

@app.post("/api/process")
async def process_images(
    background_tasks: BackgroundTasks,
    image_ids: List[str],
    prioritization: Optional[Dict[str, Any]] = None
):
    """Process images with YOLOv8 detection"""
    job_id = str(uuid.uuid4())
    
    # Initialize job
    jobs_db[job_id] = {
        "id": job_id,
        "status": "processing",
        "image_ids": image_ids,
        "prioritization": prioritization or {},
        "results": [],
        "created_at": datetime.now(),
        "completed_at": None
    }
    
    # Start background processing
    background_tasks.add_task(process_images_background, job_id, image_ids, prioritization or {})
    
    return {"job_id": job_id, "status": "processing", "image_count": len(image_ids)}

async def process_images_background(job_id: str, image_ids: List[str], prioritization: Dict[str, Any]):
    """Background task for processing images"""
    results = []
    
    for image_id in image_ids:
        # Find image file
        image_files = list(UPLOAD_DIR.glob(f"{image_id}.*"))
        if not image_files:
            results.append({
                "image_id": image_id,
                "error": "Image file not found",
                "status": "failed"
            })
            continue
        
        image_path = str(image_files[0])
        result = process_single_image(image_path, prioritization)
        result["image_id"] = image_id
        results.append(result)
    
    # Update job status
    jobs_db[job_id].update({
        "status": "completed",
        "results": results,
        "completed_at": datetime.now()
    })

@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get job processing status"""
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs_db[job_id]
    return {
        "id": job["id"],
        "status": job["status"],
        "image_count": len(job["image_ids"]),
        "completed_count": len([r for r in job["results"] if r.get("status") == "completed"]),
        "results": job["results"] if job["status"] == "completed" else [],
        "created_at": job["created_at"].isoformat(),
        "completed_at": job["completed_at"].isoformat() if job["completed_at"] else None
    }

@app.post("/api/datasets")
async def create_dataset(
    name: str,
    image_ids: List[str],
    export_format: str = "yolo"
):
    """Create a new dataset"""
    dataset_id = str(uuid.uuid4())
    
    # Collect all processed results for these images
    all_results = []
    for job in jobs_db.values():
        for result in job["results"]:
            if result.get("image_id") in image_ids and result.get("status") == "completed":
                all_results.append(result)
    
    dataset = {
        "id": dataset_id,
        "name": name,
        "version": "1.0",
        "created_at": datetime.now(),
        "image_count": len(image_ids),
        "annotation_count": sum(len(r.get("detections", [])) for r in all_results),
        "export_format": export_format,
        "image_ids": image_ids,
        "results": all_results
    }
    
    datasets_db[dataset_id] = dataset
    
    return {
        "id": dataset_id,
        "name": name,
        "version": dataset["version"],
        "image_count": dataset["image_count"],
        "annotation_count": dataset["annotation_count"]
    }

@app.get("/api/datasets")
async def list_datasets():
    """List all datasets"""
    return [
        {
            "id": dataset["id"],
            "name": dataset["name"],
            "version": dataset["version"],
            "created_at": dataset["created_at"].isoformat(),
            "image_count": dataset["image_count"],
            "annotation_count": dataset["annotation_count"],
            "export_format": dataset["export_format"]
        }
        for dataset in datasets_db.values()
    ]

@app.get("/api/datasets/{dataset_id}/export")
async def export_dataset(dataset_id: str):
    """Export dataset in specified format"""
    if dataset_id not in datasets_db:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    dataset = datasets_db[dataset_id]
    export_format = dataset["export_format"]
    
    # Create export directory
    export_dir = DATASETS_DIR / dataset_id
    export_dir.mkdir(exist_ok=True)
    
    # Generate export files based on format
    if export_format == "yolo":
        create_yolo_export(dataset, export_dir)
    elif export_format == "coco":
        create_coco_export(dataset, export_dir)
    elif export_format == "pascal":
        create_pascal_export(dataset, export_dir)
    
    # Create ZIP file
    zip_path = DATASETS_DIR / f"{dataset['name']}_{export_format}.zip"
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        for root, dirs, files in os.walk(export_dir):
            for file in files:
                file_path = Path(root) / file
                zipf.write(file_path, file_path.relative_to(export_dir))
    
    return FileResponse(
        zip_path,
        media_type='application/zip',
        filename=f"{dataset['name']}_{export_format}.zip"
    )

def create_yolo_export(dataset: Dict[str, Any], export_dir: Path):
    """Create YOLO format export"""
    images_dir = export_dir / "images"
    labels_dir = export_dir / "labels"
    images_dir.mkdir(exist_ok=True)
    labels_dir.mkdir(exist_ok=True)
    
    # Class names
    classes = set()
    for result in dataset["results"]:
        for detection in result.get("detections", []):
            classes.add(detection["class_name"])
    
    class_names = sorted(list(classes))
    
    # Write classes.txt
    with open(export_dir / "classes.txt", "w") as f:
        f.write("\n".join(class_names))
    
    # Process each image and its annotations
    for result in dataset["results"]:
        image_id = result["image_id"]
        
        # Copy image
        src_images = list(UPLOAD_DIR.glob(f"{image_id}.*"))
        if src_images:
            shutil.copy2(src_images[0], images_dir / src_images[0].name)
            
            # Create label file
            label_file = labels_dir / f"{image_id}.txt"
            with open(label_file, "w") as f:
                for detection in result.get("detections", []):
                    class_idx = class_names.index(detection["class_name"])
                    # Convert to YOLO format (normalized center coordinates)
                    x_center = (detection["x"] + detection["width"] / 2) / 640  # Assuming 640px width
                    y_center = (detection["y"] + detection["height"] / 2) / 640  # Assuming 640px height
                    width = detection["width"] / 640
                    height = detection["height"] / 640
                    
                    f.write(f"{class_idx} {x_center} {y_center} {width} {height}\n")

def create_coco_export(dataset: Dict[str, Any], export_dir: Path):
    """Create COCO format export"""
    # This is a simplified COCO export implementation
    coco_data = {
        "images": [],
        "annotations": [],
        "categories": []
    }
    
    # Collect classes
    classes = set()
    for result in dataset["results"]:
        for detection in result.get("detections", []):
            classes.add(detection["class_name"])
    
    # Add categories
    for i, class_name in enumerate(sorted(classes)):
        coco_data["categories"].append({
            "id": i,
            "name": class_name,
            "supercategory": "object"
        })
    
    annotation_id = 1
    class_map = {name: i for i, name in enumerate(sorted(classes))}
    
    for result in dataset["results"]:
        image_id = result["image_id"]
        
        # Add image info
        coco_data["images"].append({
            "id": image_id,
            "file_name": f"{image_id}.jpg",
            "width": 640,  # Mock dimensions
            "height": 640
        })
        
        # Add annotations
        for detection in result.get("detections", []):
            coco_data["annotations"].append({
                "id": annotation_id,
                "image_id": image_id,
                "category_id": class_map[detection["class_name"]],
                "bbox": [detection["x"], detection["y"], detection["width"], detection["height"]],
                "area": detection["width"] * detection["height"],
                "iscrowd": 0
            })
            annotation_id += 1
    
    # Write COCO JSON
    with open(export_dir / "annotations.json", "w") as f:
        json.dump(coco_data, f, indent=2)

def create_pascal_export(dataset: Dict[str, Any], export_dir: Path):
    """Create Pascal VOC format export"""
    annotations_dir = export_dir / "Annotations"
    annotations_dir.mkdir(exist_ok=True)
    
    for result in dataset["results"]:
        image_id = result["image_id"]
        
        # Create XML annotation
        xml_content = f"""<?xml version="1.0"?>
<annotation>
    <folder>images</folder>
    <filename>{image_id}.jpg</filename>
    <size>
        <width>640</width>
        <height>640</height>
        <depth>3</depth>
    </size>
"""
        
        for detection in result.get("detections", []):
            xml_content += f"""    <object>
        <name>{detection["class_name"]}</name>
        <pose>Unspecified</pose>
        <truncated>0</truncated>
        <difficult>0</difficult>
        <bndbox>
            <xmin>{int(detection["x"])}</xmin>
            <ymin>{int(detection["y"])}</ymin>
            <xmax>{int(detection["x"] + detection["width"])}</xmax>
            <ymax>{int(detection["y"] + detection["height"])}</ymax>
        </bndbox>
    </object>
"""
        
        xml_content += "</annotation>"
        
        with open(annotations_dir / f"{image_id}.xml", "w") as f:
            f.write(xml_content)

@app.get("/")
async def root():
    return {"message": "YOLOv8 Auto-Labeling API", "version": "1.0.0"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)