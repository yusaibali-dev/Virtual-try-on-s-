import os
import uuid
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
import base64
import time

from security import (
    validate_url_ssrf,
    fetch_image_from_url,
    fetch_product_page_og,
    validate_upload_image,
    check_nsfw_content,
    rate_limiter
)
from pipeline import detect_category, remove_background, create_thumbnail, VALID_CATEGORIES
from database import init_db, insert_item, list_items, get_item, toggle_favourite, delete_item

# Storage directory setup
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "storage", "items")
THUMBNAILS_DIR = os.path.join(os.path.dirname(__file__), "storage", "thumbnails")
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(THUMBNAILS_DIR, exist_ok=True)

# Initialize database tables
init_db()

app = FastAPI(
    title="VTON Studio API",
    description="Backend API for Virtual Try-On, Closet Management, and AI Inference",
    version="0.2.0"
)

# Enable CORS for frontend development and network devices
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local storage for serving clean cutout images and thumbnails
app.mount("/storage/items", StaticFiles(directory=UPLOADS_DIR), name="items")
app.mount("/storage/thumbnails", StaticFiles(directory=THUMBNAILS_DIR), name="thumbnails")

class ItemUrlRequest(BaseModel):
    url: str
    type: str = "image_url"  # "image_url" or "product_url"
    title: Optional[str] = None
    category: Optional[str] = None

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "VTON Studio Backend",
        "version": "0.2.0"
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "storage": "sqlite + local fs",
        "milestone": "Milestone 3 - Closet & Internet Items"
    }

@app.post("/api/items")
async def create_item_from_url(payload: ItemUrlRequest):
    """
    Import an item using an image URL or product-page URL (extracting og:image and title).
    Validates SSRF, strips background with rembg, detects category, saves thumbnail,
    and stores in SQLite database.
    """
    try:
        url = payload.url.strip()
        validate_url_ssrf(url)

        title = payload.title or ""
        source_type = payload.type

        if source_type == "product_url":
            # Fetch OpenGraph og:image and title from product page
            image_url, og_title = fetch_product_page_og(url)
            if not title:
                title = og_title
            # Download extracted image
            image_bytes, _ = fetch_image_from_url(image_url)
        else:
            # Direct image URL
            image_bytes, _ = fetch_image_from_url(url)
            if not title:
                # Derive title from filename
                filename_part = url.split("?")[0].split("/")[-1]
                title = os.path.splitext(filename_part)[0].replace("-", " ").replace("_", " ").title() or "Online Item"

        # Auto-detect category
        detected_cat = detect_category(
            title=title,
            image_bytes=image_bytes,
            manual_override=payload.category
        )

        # Remove background (rembg or intelligent alpha transparency)
        clean_png_bytes = remove_background(image_bytes)

        # Create thumbnail
        thumbnail_bytes = create_thumbnail(clean_png_bytes)

        # Persist files locally
        item_id = str(uuid.uuid4())
        image_filename = f"{item_id}.png"
        thumb_filename = f"{item_id}_thumb.png"

        image_path = os.path.join(UPLOADS_DIR, image_filename)
        thumb_path = os.path.join(THUMBNAILS_DIR, thumb_filename)

        with open(image_path, "wb") as f:
            f.write(clean_png_bytes)
        with open(thumb_path, "wb") as f:
            f.write(thumbnail_bytes)

        # Record in SQLite database
        item_record = {
            "id": item_id,
            "title": title,
            "category": detected_cat,
            "image_filename": image_filename,
            "thumbnail_filename": thumb_filename,
            "original_url": url,
            "source_type": source_type,
            "is_favourite": False,
            "metadata": {
                "detected_category": detected_cat,
                "manual_category": payload.category
            }
        }
        insert_item(item_record)

        # Add image URLs
        item_record["image_url"] = f"/storage/items/{image_filename}"
        item_record["thumbnail_url"] = f"/storage/thumbnails/{thumb_filename}"

        return item_record

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process item: {str(e)}")

@app.post("/api/items/upload")
async def create_item_from_upload(
    request: Request,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    category: Optional[str] = Form(None)
):
    """
    Upload an item image from local device.
    Applies rate limiting, upload validation, NSFW content check,
    background removal, category detection, thumbnail creation, and DB persistence.
    """
    # 1. Rate limiting
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not rate_limiter.is_allowed(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded (max 40 requests/min). Please try again later.")

    try:
        content = await file.read()
        
        # 2. Upload validation
        validate_upload_image(content, file.filename)

        # 3. Basic NSFW check
        is_nsfw, nsfw_reason = check_nsfw_content(content)
        if is_nsfw:
            raise HTTPException(status_code=400, detail=f"Image upload rejected: {nsfw_reason}")

        item_title = title or os.path.splitext(file.filename)[0].replace("-", " ").replace("_", " ").title()

        detected_cat = detect_category(
            title=item_title,
            image_bytes=content,
            manual_override=category
        )

        clean_png_bytes = remove_background(content)
        thumbnail_bytes = create_thumbnail(clean_png_bytes)

        item_id = str(uuid.uuid4())
        image_filename = f"{item_id}.png"
        thumb_filename = f"{item_id}_thumb.png"

        image_path = os.path.join(UPLOADS_DIR, image_filename)
        thumb_path = os.path.join(THUMBNAILS_DIR, thumb_filename)

        with open(image_path, "wb") as f:
            f.write(clean_png_bytes)
        with open(thumb_path, "wb") as f:
            f.write(thumbnail_bytes)

        item_record = {
            "id": item_id,
            "title": item_title,
            "category": detected_cat,
            "image_filename": image_filename,
            "thumbnail_filename": thumb_filename,
            "original_url": file.filename,
            "source_type": "upload",
            "is_favourite": False,
            "metadata": {
                "detected_category": detected_cat,
                "manual_category": category
            }
        }
        insert_item(item_record)

        item_record["image_url"] = f"/storage/items/{image_filename}"
        item_record["thumbnail_url"] = f"/storage/thumbnails/{thumb_filename}"

        return item_record

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload processing failed: {str(e)}")

@app.get("/api/items")
def get_closet_items(
    category: Optional[str] = Query(None),
    favourites: bool = Query(False)
):
    """List all closet items with category filtering and favourites."""
    items = list_items(category=category, favourites_only=favourites)
    for it in items:
        it["image_url"] = f"/storage/items/{it['image_filename']}"
        it["thumbnail_url"] = f"/storage/thumbnails/{it['thumbnail_filename']}"
    return items

@app.patch("/api/items/{item_id}/favourite")
def toggle_item_favourite(item_id: str):
    """Toggle favourite status of an item."""
    try:
        new_status = toggle_favourite(item_id)
        return {"id": item_id, "is_favourite": new_status}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

@app.delete("/api/items/{item_id}")
def remove_closet_item(item_id: str):
    """Delete an item from closet and clean up storage files."""
    item = delete_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Item {item_id} not found")

    # Clean up files
    img_path = os.path.join(UPLOADS_DIR, item["image_filename"])
    thumb_path = os.path.join(THUMBNAILS_DIR, item["thumbnail_filename"])
    if os.path.exists(img_path):
        os.remove(img_path)
    if os.path.exists(thumb_path):
        os.remove(thumb_path)

    return {"deleted": True, "id": item_id}

# -------------------------------------------------------------
# Milestone 8: Privacy & Data Retention: TTL Cleanup & Delete All
# -------------------------------------------------------------
DEFAULT_TTL_SECONDS = 3600 # 1 hour TTL for uploaded try-on frames and temp files

def cleanup_stale_tryon_files(ttl_seconds: int = DEFAULT_TTL_SECONDS):
    """
    Purges temporary try-on outputs and uploads older than TTL (default 1 hour).
    Ensures no permanent retention of user photos.
    """
    now = time.time()
    count = 0
    for folder in (TRYON_DIR, UPLOADS_DIR, THUMBNAILS_DIR):
        if not os.path.exists(folder):
            continue
        for fname in os.listdir(folder):
            fpath = os.path.join(folder, fname)
            if os.path.isfile(fpath):
                file_age = now - os.path.getmtime(fpath)
                if file_age > ttl_seconds:
                    try:
                        os.remove(fpath)
                        count += 1
                    except Exception:
                        pass
    return count

@app.post("/api/user/delete-data")
def delete_all_user_data():
    """
    'Delete my data' action:
    Purges all items from SQLite database and wipes all stored photos,
    thumbnails, and try-on output files immediately.
    """
    # 1. Clear database items
    all_items = list_items()
    for item in all_items:
        delete_item(item["id"])

    # 2. Wipe storage directories
    for folder in (UPLOADS_DIR, THUMBNAILS_DIR, TRYON_DIR):
        if os.path.exists(folder):
            for fname in os.listdir(folder):
                fpath = os.path.join(folder, fname)
                try:
                    if os.path.isfile(fpath):
                        os.remove(fpath)
                except Exception:
                    pass

    return {
        "success": True,
        "message": "All user data, closet items, and generated try-on photos have been permanently deleted."
    }

@app.on_event("startup")
async def start_periodic_ttl_cleanup():
    """Starts background periodic TTL cleanup worker (runs every 15 minutes)."""
    async def ttl_worker():
        while True:
            await asyncio.sleep(900) # 15 minutes
            deleted = cleanup_stale_tryon_files(DEFAULT_TTL_SECONDS)
            if deleted > 0:
                print(f"[Privacy TTL] Automatically purged {deleted} stale files (>1h old).")
    asyncio.create_task(ttl_worker())

# -------------------------------------------------------------
# Milestone 4: CatVTON Photo Try-On & Job Queue Endpoints
# -------------------------------------------------------------
from sse_starlette.sse import EventSourceResponse
from model_manager import model_manager
import json
import asyncio
from PIL import Image
import io

TRYON_DIR = os.path.join(os.path.dirname(__file__), "storage", "tryon")
os.makedirs(TRYON_DIR, exist_ok=True)
app.mount("/storage/tryon", StaticFiles(directory=TRYON_DIR), name="tryon")

# In-memory single-GPU job state store
jobs_db: dict[str, dict] = {}
job_queues: dict[str, asyncio.Queue] = {}

class TryonJobRequest(BaseModel):
    closet_item_id: str
    category: Optional[str] = "upper"  # upper, lower, dress

async def process_tryon_job(job_id: str, person_bytes: bytes, garment_bytes: bytes, category: str):
    queue = job_queues.get(job_id)
    try:
        jobs_db[job_id]["status"] = "processing"
        if queue:
            await queue.put({"percent": 5, "message": "Initializing single-GPU pipeline...", "status": "processing"})

        person_img = Image.open(io.BytesIO(person_bytes)).convert("RGB")
        garment_img = Image.open(io.BytesIO(garment_bytes))

        async def on_progress(percent: int, message: str):
            jobs_db[job_id]["progress"] = percent
            jobs_db[job_id]["message"] = message
            if queue:
                await queue.put({"percent": percent, "message": message, "status": "processing"})

        result_img = await model_manager.run_tryon(
            person_image=person_img,
            garment_image=garment_img,
            category=category,
            steps=30,
            progress_callback=on_progress
        )

        # Save result to disk
        out_filename = f"{job_id}_result.png"
        out_path = os.path.join(TRYON_DIR, out_filename)
        result_img.save(out_path, format="PNG")

        result_url = f"/storage/tryon/{out_filename}"
        jobs_db[job_id]["status"] = "completed"
        jobs_db[job_id]["progress"] = 100
        jobs_db[job_id]["message"] = "Try-on completed successfully!"
        jobs_db[job_id]["result_url"] = result_url

        if queue:
            await queue.put({
                "percent": 100,
                "message": "Try-on completed successfully!",
                "status": "completed",
                "result_url": result_url
            })

    except asyncio.CancelledError:
        jobs_db[job_id]["status"] = "cancelled"
        jobs_db[job_id]["message"] = "Job cancelled by user"
        if queue:
            await queue.put({"status": "cancelled", "message": "Job cancelled"})
    except Exception as e:
        jobs_db[job_id]["status"] = "failed"
        jobs_db[job_id]["message"] = str(e)
        if queue:
            await queue.put({"status": "failed", "message": str(e)})

@app.post("/api/tryon/photo")
async def create_photo_tryon_job(
    person_photo: UploadFile = File(...),
    closet_item_id: str = Form(...),
    category: str = Form("upper")
):
    """
    Submits a photo try-on job to the single-GPU job queue.
    """
    # Fetch garment item from DB
    item = get_item(closet_item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Closet item '{closet_item_id}' not found.")

    garment_path = os.path.join(UPLOADS_DIR, item["image_filename"])
    if not os.path.exists(garment_path):
        raise HTTPException(status_code=404, detail="Garment image file missing.")

    person_bytes = await person_photo.read()
    with open(garment_path, "rb") as f:
        garment_bytes = f.read()

    job_id = str(uuid.uuid4())
    jobs_db[job_id] = {
        "id": job_id,
        "status": "queued",
        "progress": 0,
        "message": "Job queued for single-GPU inference",
        "category": category,
        "closet_item_id": closet_item_id,
        "result_url": None
    }
    job_queues[job_id] = asyncio.Queue()

    # Launch background task
    asyncio.create_task(process_tryon_job(job_id, person_bytes, garment_bytes, category))

    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Job submitted to GPU queue"
    }

@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    """Query state of a try-on job."""
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs_db[job_id]

@app.get("/api/jobs/{job_id}/stream")
async def stream_job_progress(job_id: str):
    """Server-Sent Events (SSE) stream for live progress updates."""
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")

    queue = job_queues.get(job_id)

    async def event_generator():
        # First send current state
        yield {
            "data": json.dumps({
                "percent": jobs_db[job_id]["progress"],
                "message": jobs_db[job_id]["message"],
                "status": jobs_db[job_id]["status"],
                "result_url": jobs_db[job_id].get("result_url")
            })
        }

        while True:
            if jobs_db[job_id]["status"] in ("completed", "failed", "cancelled"):
                break
            try:
                update = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield {"data": json.dumps(update)}
                if update.get("status") in ("completed", "failed", "cancelled"):
                    break
            except asyncio.TimeoutError:
                # Keepalive ping
                yield {"comment": "ping"}

    return EventSourceResponse(event_generator())

@app.post("/api/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    """Cancel an active try-on job."""
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    jobs_db[job_id]["status"] = "cancelled"
    jobs_db[job_id]["message"] = "Job cancelled by user request"
    return {"status": "cancelled", "job_id": job_id}

# -------------------------------------------------------------
# Milestone 6: Hairstyle Try-On & Pipeline Backend Switching
# -------------------------------------------------------------
class HairstyleConfigUpdate(BaseModel):
    backend: str  # "hairfastgan" or "diffusion_ipadapter"

@app.get("/api/hairstyle/config")
def get_hairstyle_config():
    """Returns current active hairstyle backend, available backends, and VRAM status."""
    return {
        "active_backend": model_manager.hairstyle_backend,
        "available_backends": [
            {
                "id": "hairfastgan",
                "name": "HairFastGAN",
                "description": "High-fidelity StyleGAN2 latent transfer (~1.0s, 2.4 GB VRAM)",
                "recommended_for": "Fast photo try-on on RTX 3070",
                "memory_gb": 2.4,
                "latency_s": 1.0
            },
            {
                "id": "diffusion_ipadapter",
                "name": "Face-Parsing + SD Inpainting + IP-Adapter",
                "description": "Stable Diffusion 1.5 inpainting with IP-Adapter (~3.5s, 4.6 GB VRAM)",
                "recommended_for": "Artistic & diverse creative restyling",
                "memory_gb": 4.6,
                "latency_s": 3.5
            }
        ],
        "vram_info": model_manager.get_vram_usage()
    }

@app.post("/api/hairstyle/config")
def set_hairstyle_config(cfg: HairstyleConfigUpdate):
    """Switches the global default hairstyle synthesis backend."""
    try:
        model_manager.set_hairstyle_backend(cfg.backend)  # type: ignore
        return {
            "success": True,
            "active_backend": model_manager.hairstyle_backend
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

async def process_hairstyle_job(
    job_id: str,
    person_bytes: bytes,
    reference_bytes: Optional[bytes],
    color_hex: Optional[str],
    backend: Optional[str]
):
    queue = job_queues.get(job_id)
    try:
        jobs_db[job_id]["status"] = "processing"
        if queue:
            await queue.put({
                "percent": 5,
                "message": f"Initializing hairstyle pipeline ({backend or model_manager.hairstyle_backend})...",
                "status": "processing"
            })

        person_img = Image.open(io.BytesIO(person_bytes)).convert("RGB")
        reference_img = Image.open(io.BytesIO(reference_bytes)).convert("RGBA") if reference_bytes else None

        async def on_progress(percent: int, message: str):
            jobs_db[job_id]["progress"] = percent
            jobs_db[job_id]["message"] = message
            if queue:
                await queue.put({"percent": percent, "message": message, "status": "processing"})

        result_img = await model_manager.run_hairstyle(
            person_image=person_img,
            reference_style_image=reference_img,
            color_hex=color_hex,
            backend_override=backend,  # type: ignore
            progress_callback=on_progress
        )

        out_filename = f"{job_id}_hair_result.png"
        out_path = os.path.join(TRYON_DIR, out_filename)
        result_img.save(out_path, format="PNG")

        result_url = f"/storage/tryon/{out_filename}"
        jobs_db[job_id]["status"] = "completed"
        jobs_db[job_id]["progress"] = 100
        jobs_db[job_id]["message"] = "Hairstyle synthesis completed successfully!"
        jobs_db[job_id]["result_url"] = result_url

        if queue:
            await queue.put({
                "percent": 100,
                "message": "Hairstyle synthesis completed successfully!",
                "status": "completed",
                "result_url": result_url
            })

    except asyncio.CancelledError:
        jobs_db[job_id]["status"] = "cancelled"
        jobs_db[job_id]["message"] = "Job cancelled by user"
        if queue:
            await queue.put({"status": "cancelled", "message": "Job cancelled"})
    except Exception as e:
        jobs_db[job_id]["status"] = "failed"
        jobs_db[job_id]["message"] = str(e)
        if queue:
            await queue.put({"status": "failed", "message": str(e)})

@app.post("/api/tryon/hairstyle")
async def create_hairstyle_job(
    person_photo: UploadFile = File(...),
    reference_photo: Optional[UploadFile] = File(None),
    closet_item_id: Optional[str] = Form(None),
    color_hex: Optional[str] = Form(None),
    backend: Optional[str] = Form(None)
):
    """
    Submits a hairstyle try-on job to the single-GPU job queue.
    Accepts:
    - person_photo: Target user image
    - reference_photo or closet_item_id: Hairstyle reference
    - color_hex: Optional hair color tint
    - backend: 'hairfastgan' or 'diffusion_ipadapter' (defaults to active backend)
    """
    person_bytes = await person_photo.read()
    reference_bytes = None

    if reference_photo:
        reference_bytes = await reference_photo.read()
    elif closet_item_id:
        item = get_item(closet_item_id)
        if item:
            item_path = os.path.join(UPLOADS_DIR, item["image_filename"])
            if os.path.exists(item_path):
                with open(item_path, "rb") as f:
                    reference_bytes = f.read()

    job_id = str(uuid.uuid4())
    chosen_backend = backend or model_manager.hairstyle_backend

    jobs_db[job_id] = {
        "id": job_id,
        "status": "queued",
        "progress": 0,
        "message": f"Hairstyle job queued ({chosen_backend})",
        "category": "hair",
        "backend": chosen_backend,
        "color_hex": color_hex,
        "result_url": None
    }
    job_queues[job_id] = asyncio.Queue()

    # Launch background task
    asyncio.create_task(
        process_hairstyle_job(
            job_id=job_id,
            person_bytes=person_bytes,
            reference_bytes=reference_bytes,
            color_hex=color_hex,
            backend=chosen_backend
        )
    )

    return {
        "job_id": job_id,
        "status": "queued",
        "backend": chosen_backend,
        "message": f"Hairstyle job queued on single-GPU manager ({chosen_backend})"
    }

# -------------------------------------------------------------
# Milestone 7: Near-Real-Time AI Quality (WebSocket /api/tryon/live)
# -------------------------------------------------------------
@app.websocket("/api/tryon/live")
async def websocket_live_tryon(websocket: WebSocket):
    """
    WebSocket endpoint for near-real-time live CatVTON camera stream.
    Features:
    - Latest-frame-wins backpressure (drops stale queued frames, never backlogs)
    - Reduced resolution & steps
    - Timing metadata & VRAM guard check
    """
    await websocket.accept()
    print("[WebSocket] Live AI client connected.")

    # State for latest frame dropped-frame control
    latest_frame_data = {"frame_bytes": None, "timestamp": 0, "closet_item_id": None, "category": "upper"}
    has_new_frame = asyncio.Event()
    is_active = True

    async def frame_receiver():
        nonlocal is_active
        try:
            while is_active:
                msg_text = await websocket.receive_text()
                msg = json.loads(msg_text)
                img_b64 = msg.get("frame_jpeg")
                if img_b64:
                    if "," in img_b64:
                        img_b64 = img_b64.split(",", 1)[1]
                    frame_bytes = base64.b64decode(img_b64)
                    latest_frame_data["frame_bytes"] = frame_bytes
                    latest_frame_data["timestamp"] = msg.get("timestamp", 0)
                    latest_frame_data["closet_item_id"] = msg.get("closet_item_id")
                    latest_frame_data["category"] = msg.get("category", "upper")
                    # Signal that a fresh frame has arrived (overwriting any previous unread frame)
                    has_new_frame.set()
        except WebSocketDisconnect:
            is_active = False
        except Exception as e:
            print(f"[WebSocket] Receiver error: {e}")
            is_active = False

    receiver_task = asyncio.create_task(frame_receiver())

    try:
        while is_active:
            # Wait for latest frame
            await has_new_frame.wait()
            has_new_frame.clear()

            frame_bytes = latest_frame_data["frame_bytes"]
            client_ts = latest_frame_data["timestamp"]
            item_id = latest_frame_data["closet_item_id"]
            category = latest_frame_data["category"]

            if not frame_bytes:
                continue

            # VRAM Guard Check
            vram = model_manager.get_vram_usage()
            if vram.get("allocated_gb", 0.0) > (model_manager.max_vram_gb - 1.0):
                await websocket.send_text(json.dumps({
                    "error": "VRAM_LOW",
                    "message": "GPU VRAM headroom critical. Live AI paused.",
                    "status": "fallback"
                }))
                await asyncio.sleep(1.0)
                continue

            # Load garment
            garment_img = None
            if item_id:
                item = get_item(item_id)
                if item:
                    item_path = os.path.join(UPLOADS_DIR, item["image_filename"])
                    if os.path.exists(item_path):
                        garment_img = Image.open(item_path)

            if garment_img is None:
                # Default cyan sports tee
                garment_img = Image.new("RGBA", (300, 300), (6, 182, 212, 240))

            person_img = Image.open(io.BytesIO(frame_bytes)).convert("RGB")

            # Execute fast live CatVTON
            result_img, timing = await model_manager.run_live_tryon(
                person_image=person_img,
                garment_image=garment_img,
                category=category,
                reduced_steps=4
            )

            # Encode result to JPEG
            buf = io.BytesIO()
            result_img.save(buf, format="JPEG", quality=80)
            res_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

            timing["client_timestamp"] = client_ts
            timing["server_timestamp"] = time.time()

            await websocket.send_text(json.dumps({
                "status": "success",
                "image_jpeg": f"data:image/jpeg;base64,{res_b64}",
                "timing": timing
            }))

    except WebSocketDisconnect:
        print("[WebSocket] Client disconnected.")
    except Exception as e:
        print(f"[WebSocket] Inference loop error: {e}")
    finally:
        is_active = False
        receiver_task.cancel()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

