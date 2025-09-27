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
from PIL import Image

# Real YOLO import
from ultralytics import YOLO

app = FastAPI(title="YOLOv8 Auto-Labeling API", version="1.0.0")

# CORS configuration (change origins for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global configuration
UPLOAD_DIR = Path("uploads")
RESULTS_DIR = Path("results")
DATASETS_DIR = Path("datasets")
LABELS_DIR = Path("labels")
PREVIEW_DIR = Path("previews")

for d in (UPLOAD_DIR, RESULTS_DIR, DATASETS_DIR, LABELS_DIR, PREVIEW_DIR):
    d.mkdir(parents=True, exist_ok=True)

# Load YOLOv8 model (change model file if needed)
# Make sure 'yolov8n.pt' is available in working dir or give full path.
model = YOLO("yolov8n.pt")

# In-memory storage for demo - replace with DB for production
jobs_db: Dict[str, Any] = {}
datasets_db: Dict[str, Any] = {}

def apply_prioritization(detections: List[Dict], prompt: Dict[str, Any]) -> List[Dict]:
    """Apply prioritization settings to detection results (keeps original logic but reads keys used in your UI)."""
    filtered_results = []
    if prompt is None:
        prompt = {}
    confidence_threshold = prompt.get("confidenceThreshold", prompt.get("min_confidence", 0.5))
    class_priorities = prompt.get("classPriorities", prompt.get("classPriorities", []))
    ignore_classes = prompt.get("ignoreClasses", [])
    min_size = prompt.get("minObjectSize", 0)
    max_size = prompt.get("maxObjectSize", float("inf"))
    class_weights = prompt.get("classWeights", {})

    for result in detections:
        # Confidence threshold check
        if result.get("confidence", 0) < confidence_threshold:
            continue

        # Class priority filtering (if provided, only keep those classes)
        if class_priorities and result.get("class_name") not in class_priorities:
            continue

        # Ignore classes
        if result.get("class_name") in ignore_classes:
            continue

        # Size filter (area)
        object_area = result.get("width", 0) * result.get("height", 0)
        if object_area < min_size or object_area > max_size:
            continue

        # Apply class weights (boost confidence)
        cname = result.get("class_name")
        if cname in class_weights:
            try:
                weight = float(class_weights[cname])
                result["confidence"] = min(1.0, result["confidence"] * weight)
            except Exception:
                pass

        filtered_results.append(result)

    return filtered_results

def save_yolo_label_for_image(image_path: str, detections: List[Dict], labels_dir: Path):
    """
    Save YOLO format .txt for a single image.
    The model.names mapping is used for class index -> name.
    """
    try:
        img = Image.open(image_path)
        img_w, img_h = img.size
    except Exception:
        img_w, img_h = 640, 640  # fallback

    labels_dir.mkdir(parents=True, exist_ok=True)
    base = Path(image_path).stem
    label_file = labels_dir / f"{base}.txt"

    # Build mapping: class name -> index based on model.names (deterministic)
    # model.names is a dict mapping numeric id -> class name
    name_to_idx = {v: int(k) for k, v in model.names.items()}

    lines = []
    for d in detections:
        cname = d["class_name"]
        if cname not in name_to_idx:
            # If class not known to model (unlikely), skip
            continue
        cls_id = name_to_idx[cname]
        x_center = (d["x"] + d["width"] / 2) / img_w
        y_center = (d["y"] + d["height"] / 2) / img_h
        w = d["width"] / img_w
        h = d["height"] / img_h
        lines.append(f"{cls_id} {x_center:.6f} {y_center:.6f} {w:.6f} {h:.6f}")

    with open(label_file, "w") as f:
        f.write("\n".join(lines))

def draw_and_save_preview(image_path: str, detections: List[Dict], preview_dir: Path) -> Optional[str]:
    """Draw simple rectangles on the image and save to preview dir (PIL). Returns path or None."""
    try:
        img = Image.open(image_path).convert("RGBA")
        from PIL import ImageDraw, ImageFont
        draw = ImageDraw.Draw(img)

        for d in detections:
            x = d["x"]
            y = d["y"]
            w = d["width"]
            h = d["height"]
            # Rectangle
            draw.rectangle([x, y, x + w, y + h], outline="red", width=2)
            label = f"{d['class_name']} {d['confidence']:.2f}"
            # Attempt to draw label background
            draw.rectangle([x, y - 12, x + 80, y], fill="red")
            draw.text((x + 2, y - 12), label, fill="white")

        preview_dir.mkdir(parents=True, exist_ok=True)
        preview_path = preview_dir / (Path(image_path).stem + "_preview.jpg")
        img.convert("RGB").save(preview_path, format="JPEG")
        return str(preview_path)
    except Exception:
        return None

def process_single_image(image_path: str, prioritization: Dict[str, Any]) -> Dict[str, Any]:
    """Run YOLOv8 on a single image and return structured detections."""
    try:
        start = datetime.now()
        results = model(str(image_path))  # run inference
        detections: List[Dict[str, Any]] = []

        # results[0].boxes contains the Boxes object; iterate boxes
        boxes = results[0].boxes
        # boxes.xyxy (tensor), boxes.conf, boxes.cls
        # ultralytics boxes elements may be tensors; access with .xyxy, .conf, .cls or iterate boxes
        for b in boxes:
            # b.xyxy -> tensor of shape (4,), b.conf -> tensor, b.cls -> tensor
            try:
                xyxy = b.xyxy.tolist()[0] if hasattr(b.xyxy, "tolist") and len(b.xyxy.tolist()) > 0 else b.xyxy.tolist()
            except Exception:
                # fallback: try indexing
                try:
                    xyxy = [float(x) for x in b.xyxy]
                except Exception:
                    continue
            # Safely extract coords
            if isinstance(xyxy, list) and len(xyxy) >= 4:
                x1, y1, x2, y2 = float(xyxy[0]), float(xyxy[1]), float(xyxy[2]), float(xyxy[3])
            else:
                continue

            conf = float(b.conf) if hasattr(b, "conf") else float(b[4])  # fallback
            cls_id = int(b.cls) if hasattr(b, "cls") else int(b[5]) if len(b) > 5 else 0
            class_name = model.names.get(cls_id, str(cls_id))

            detections.append({
                "id": str(uuid.uuid4()),
                "x": x1,
                "y": y1,
                "width": max(0.0, x2 - x1),
                "height": max(0.0, y2 - y1),
                "class_name": class_name,
                "confidence": conf
            })

        # Apply prioritization filters provided by client
        detections = apply_prioritization(detections, prioritization or {})

        # Save YOLO labels for this image
        try:
            save_yolo_label_for_image(image_path, detections, LABELS_DIR)
        except Exception:
            pass

        # Save preview visualization (optional)
        preview_path = draw_and_save_preview(image_path, detections, PREVIEW_DIR)

        end = datetime.now()
        elapsed = (end - start).total_seconds()

        return {
            "image_path": str(image_path),
            "detections": detections,
            "preview": preview_path,
            "processing_time": round(elapsed, 3),
            "status": "completed"
        }
    except Exception as e:
        return {"image_path": str(image_path), "error": str(e), "status": "failed"}

@app.post("/api/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    """Upload multiple image files"""
    uploaded_files = []

    supported = {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}
    for file in files:
        if not file.content_type.startswith("image/"):
            continue

        file_id = str(uuid.uuid4())
        ext = Path(file.filename).suffix or ".jpg"
        if ext.lower() not in supported:
            # try to accept by content-type anyway
            ext = ext.lower()

        dest = UPLOAD_DIR / f"{file_id}{ext}"
        with open(dest, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        uploaded_files.append({
            "id": file_id,
            "filename": file.filename,
            "path": str(dest),
            "size": os.path.getsize(dest)
        })

    return {"uploaded_files": uploaded_files, "count": len(uploaded_files)}

@app.post("/api/upload_folder")
async def upload_folder(file: UploadFile = File(...)):
    """
    Accept a zipped folder (client should zip the folder before upload).
    Extracts images and returns created image IDs (saved into uploads/).
    """
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are supported for folder upload")

    folder_id = str(uuid.uuid4())
    tmp_folder = UPLOAD_DIR / f"tmp_{folder_id}"
    tmp_folder.mkdir(parents=True, exist_ok=True)
    zip_path = tmp_folder / file.filename

    with open(zip_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            z.extractall(tmp_folder)
    except Exception as e:
        shutil.rmtree(tmp_folder, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Failed to extract zip: {e}")

    # Walk and copy images into UPLOAD_DIR with generated ids
    supported_exts = {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}
    uploaded_files = []
    for root, _, files in os.walk(tmp_folder):
        for fname in files:
            if Path(fname).suffix.lower() in supported_exts:
                src = Path(root) / fname
                new_id = str(uuid.uuid4())
                dest = UPLOAD_DIR / f"{new_id}{src.suffix.lower()}"
                shutil.copy2(src, dest)
                uploaded_files.append({
                    "id": new_id,
                    "filename": fname,
                    "path": str(dest),
                    "size": os.path.getsize(dest)
                })

    # cleanup tmp folder
    shutil.rmtree(tmp_folder, ignore_errors=True)

    return {"folder_id": folder_id, "uploaded_files": uploaded_files, "count": len(uploaded_files)}

@app.post("/api/process")
async def process_images(
    background_tasks: BackgroundTasks,
    image_ids: List[str],
    prioritization: Optional[Dict[str, Any]] = None
):
    """Start a background job to process images by id (IDs returned from upload endpoints)."""
    job_id = str(uuid.uuid4())
    jobs_db[job_id] = {
        "id": job_id,
        "status": "processing",
        "image_ids": image_ids,
        "prioritization": prioritization or {},
        "results": [],
        "created_at": datetime.now(),
        "completed_at": None
    }

    # Use synchronous function for background task (safer)
    background_tasks.add_task(process_images_background, job_id, image_ids, prioritization or {})
    return {"job_id": job_id, "status": "processing", "image_count": len(image_ids)}

def process_images_background(job_id: str, image_ids: List[str], prioritization: Dict[str, Any]):
    """Background worker processing images synchronously (called by BackgroundTasks)."""
    results = []
    for image_id in image_ids:
        # find file under UPLOAD_DIR matching image_id.*
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
        # attach the image id so exports and dataset creation can find it
        result["image_id"] = image_id
        results.append(result)

    jobs_db[job_id].update({
        "status": "completed",
        "results": results,
        "completed_at": datetime.now()
    })

@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get job processing status and results (after completion)."""
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs_db[job_id]
    completed_count = len([r for r in job["results"] if r.get("status") == "completed"])
    return {
        "id": job["id"],
        "status": job["status"],
        "image_count": len(job["image_ids"]),
        "completed_count": completed_count,
        "results": job["results"] if job["status"] == "completed" else [],
        "created_at": job["created_at"].isoformat(),
        "completed_at": job["completed_at"].isoformat() if job["completed_at"] else None
    }

@app.post("/api/datasets")
async def create_dataset(
    name: str,
    image_ids: List[str],
    export_format: str = "yolo"   # options: yolo, coco, pascal
):
    """Create a dataset from previously processed images (collects results from jobs_db)."""
    dataset_id = str(uuid.uuid4())
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
    return [
        {
            "id": ds["id"],
            "name": ds["name"],
            "version": ds["version"],
            "created_at": ds["created_at"].isoformat(),
            "image_count": ds["image_count"],
            "annotation_count": ds["annotation_count"],
            "export_format": ds["export_format"]
        } for ds in datasets_db.values()
    ]

@app.get("/api/datasets/{dataset_id}/export")
async def export_dataset(dataset_id: str):
    """Export dataset in requested format, return ZIP file response."""
    if dataset_id not in datasets_db:
        raise HTTPException(status_code=404, detail="Dataset not found")

    dataset = datasets_db[dataset_id]
    export_format = dataset["export_format"]

    export_dir = DATASETS_DIR / dataset_id
    # Clean export dir if exists
    if export_dir.exists():
        shutil.rmtree(export_dir)
    export_dir.mkdir(parents=True, exist_ok=True)

    if export_format == "yolo":
        create_yolo_export(dataset, export_dir)
    elif export_format == "coco":
        create_coco_export(dataset, export_dir)
    elif export_format == "pascal":
        create_pascal_export(dataset, export_dir)
    else:
        raise HTTPException(status_code=400, detail="Unsupported export format")

    zip_path = DATASETS_DIR / f"{dataset['name']}_{export_format}.zip"
    with zipfile.ZipFile(zip_path, "w") as zipf:
        for root, _, files in os.walk(export_dir):
            for file in files:
                file_path = Path(root) / file
                zipf.write(file_path, file_path.relative_to(export_dir))

    return FileResponse(zip_path, media_type="application/zip", filename=f"{dataset['name']}_{export_format}.zip")

def create_yolo_export(dataset: Dict[str, Any], export_dir: Path):
    """Create YOLO format export with images/ and labels/ and classes.txt (reads actual image sizes)."""
    images_dir = export_dir / "images"
    labels_dir = export_dir / "labels"
    images_dir.mkdir(parents=True, exist_ok=True)
    labels_dir.mkdir(parents=True, exist_ok=True)

    # Collect classes
    classes = set()
    for result in dataset["results"]:
        for d in result.get("detections", []):
            classes.add(d["class_name"])
    class_names = sorted(list(classes))

    # Write classes.txt
    with open(export_dir / "classes.txt", "w") as f:
        f.write("\n".join(class_names))

    # Process each image result
    for result in dataset["results"]:
        image_id = result["image_id"]
        src_images = list(UPLOAD_DIR.glob(f"{image_id}.*"))
        if not src_images:
            continue
        src = src_images[0]
        dst_img = images_dir / src.name
        shutil.copy2(src, dst_img)

        # Build label lines using actual image size
        try:
            img = Image.open(src)
            img_w, img_h = img.size
        except Exception:
            img_w = img_h = 640

        label_lines = []
        for det in result.get("detections", []):
            if det["class_name"] not in class_names:
                continue
            class_idx = class_names.index(det["class_name"])
            x_c = (det["x"] + det["width"] / 2) / img_w
            y_c = (det["y"] + det["height"] / 2) / img_h
            w = det["width"] / img_w
            h = det["height"] / img_h
            label_lines.append(f"{class_idx} {x_c:.6f} {y_c:.6f} {w:.6f} {h:.6f}")

        with open(labels_dir / f"{image_id}.txt", "w") as lf:
            lf.write("\n".join(label_lines))

def create_coco_export(dataset: Dict[str, Any], export_dir: Path):
    """Simple COCO export (not complete but suitable for many use-cases)."""
    coco = {"images": [], "annotations": [], "categories": []}
    classes = sorted({d["class_name"] for r in dataset["results"] for d in r.get("detections", [])})
    class_map = {name: i + 1 for i, name in enumerate(classes)}  # COCO category ids start at 1

    for name, cid in class_map.items():
        coco["categories"].append({"id": cid, "name": name, "supercategory": "object"})

    ann_id = 1
    for r in dataset["results"]:
        image_id = r["image_id"]
        src_images = list(UPLOAD_DIR.glob(f"{image_id}.*"))
        if not src_images:
            continue
        src = src_images[0]
        try:
            img = Image.open(src)
            w, h = img.size
            fname = src.name
        except Exception:
            w = h = 640
            fname = f"{image_id}.jpg"

        coco["images"].append({"id": image_id, "file_name": fname, "width": w, "height": h})

        for det in r.get("detections", []):
            cat_id = class_map.get(det["class_name"])
            if cat_id is None:
                continue
            bbox = [det["x"], det["y"], det["width"], det["height"]]
            area = det["width"] * det["height"]
            coco["annotations"].append({
                "id": ann_id,
                "image_id": image_id,
                "category_id": cat_id,
                "bbox": bbox,
                "area": area,
                "iscrowd": 0
            })
            ann_id += 1

    with open(export_dir / "annotations.json", "w") as f:
        json.dump(coco, f, indent=2)

def create_pascal_export(dataset: Dict[str, Any], export_dir: Path):
    """Create Pascal VOC XML files (one per image) and copy images into export."""
    ann_dir = export_dir / "Annotations"
    images_dir = export_dir / "JPEGImages"
    ann_dir.mkdir(parents=True, exist_ok=True)
    images_dir.mkdir(parents=True, exist_ok=True)

    for r in dataset["results"]:
        image_id = r["image_id"]
        src_images = list(UPLOAD_DIR.glob(f"{image_id}.*"))
        if not src_images:
            continue
        src = src_images[0]
        try:
            img = Image.open(src)
            w, h = img.size
        except Exception:
            w = h = 640

        # copy image
        shutil.copy2(src, images_dir / src.name)

        xml_content = f"""<?xml version="1.0"?>
<annotation>
    <folder>JPEGImages</folder>
    <filename>{src.name}</filename>
    <size>
        <width>{w}</width>
        <height>{h}</height>
        <depth>3</depth>
    </size>
"""

        for det in r.get("detections", []):
            xmin = int(det["x"])
            ymin = int(det["y"])
            xmax = int(det["x"] + det["width"])
            ymax = int(det["y"] + det["height"])
            xml_content += f"""    <object>
        <name>{det['class_name']}</name>
        <pose>Unspecified</pose>
        <truncated>0</truncated>
        <difficult>0</difficult>
        <bndbox>
            <xmin>{xmin}</xmin>
            <ymin>{ymin}</ymin>
            <xmax>{xmax}</xmax>
            <ymax>{ymax}</ymax>
        </bndbox>
    </object>
"""

        xml_content += "</annotation>"

        with open(ann_dir / f"{image_id}.xml", "w") as f:
            f.write(xml_content)

@app.get("/")
async def root():
    return {"message": "YOLOv8 Auto-Labeling API", "version": "1.0.0"}

if __name__ == "__main__":
    # Use uvicorn.run to allow `python app.py`
    uvicorn.run(app, host="0.0.0.0", port=8000)
