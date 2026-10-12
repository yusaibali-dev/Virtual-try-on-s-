import os
import uuid
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn

from security import validate_url_ssrf, fetch_image_from_url, fetch_product_page_og
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
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    category: Optional[str] = Form(None)
):
    """
    Upload an item image from local device.
    Applies background removal, category detection, thumbnail creation, and DB persistence.
    """
    try:
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Uploaded file exceeds 10 MB limit.")

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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
