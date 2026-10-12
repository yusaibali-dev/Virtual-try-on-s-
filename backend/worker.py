"""
Redis + RQ Worker Task Definitions and Worker Daemon.
Executes try-on and hairstyle jobs via CloudGPUProvider (Modal, RunPod, or Local).
Includes strict privacy telemetry: logs job_id, provider, latency, and cost — NEVER images or prompt text.
"""

import os
import io
import time
import asyncio
from typing import Optional
from PIL import Image

from cloud_gpu_provider import get_cloud_provider
from job_queue import job_queue_manager, REDIS_URL

TRYON_DIR = os.path.join(os.path.dirname(__file__), "storage", "tryon")
os.makedirs(TRYON_DIR, exist_ok=True)


def execute_tryon_task(
    job_id: str,
    person_bytes: bytes,
    garment_bytes: bytes,
    category: str = "upper",
    steps: int = 30
):
    """
    RQ worker task executing CatVTON try-on inference.
    """
    start_time = time.time()
    provider = get_cloud_provider()

    try:
        job_queue_manager.update_job(job_id, {
            "status": "processing",
            "progress": 5,
            "message": f"Initializing inference on {provider.name} provider..."
        })

        person_img = Image.open(io.BytesIO(person_bytes)).convert("RGB")
        garment_img = Image.open(io.BytesIO(garment_bytes))

        async def on_progress(percent: int, message: str):
            job_queue_manager.update_job(job_id, {
                "progress": percent,
                "message": message,
                "status": "processing"
            })

        # Run inference via active CloudGPUProvider
        result_img = asyncio.run(provider.run_tryon(
            person_image=person_img,
            garment_image=garment_img,
            category=category,
            steps=steps,
            progress_callback=on_progress
        ))

        # Save result image to disk
        out_filename = f"{job_id}_result.png"
        out_path = os.path.join(TRYON_DIR, out_filename)
        result_img.save(out_path, format="PNG")
        result_url = f"/storage/tryon/{out_filename}"

        duration = time.time() - start_time
        telemetry = provider.log_telemetry(job_id, "tryon", duration, "completed")

        job_queue_manager.update_job(job_id, {
            "status": "completed",
            "progress": 100,
            "message": "Try-on completed successfully!",
            "result_url": result_url,
            "latency_s": telemetry["latency_s"],
            "cost_usd": telemetry["cost_usd"],
            "provider": provider.name
        })

        return {
            "job_id": job_id,
            "status": "completed",
            "result_url": result_url,
            "latency_s": telemetry["latency_s"],
            "cost_usd": telemetry["cost_usd"]
        }

    except Exception as e:
        duration = time.time() - start_time
        provider.log_telemetry(job_id, "tryon", duration, "failed")
        job_queue_manager.update_job(job_id, {
            "status": "failed",
            "message": str(e),
            "latency_s": round(duration, 3)
        })
        raise e


def execute_hairstyle_task(
    job_id: str,
    person_bytes: bytes,
    reference_bytes: Optional[bytes] = None,
    color_hex: Optional[str] = None,
    backend_override: Optional[str] = None
):
    """
    RQ worker task executing Hairstyle synthesis inference.
    """
    start_time = time.time()
    provider = get_cloud_provider()

    try:
        job_queue_manager.update_job(job_id, {
            "status": "processing",
            "progress": 5,
            "message": f"Initializing hairstyle synthesis on {provider.name} provider..."
        })

        person_img = Image.open(io.BytesIO(person_bytes)).convert("RGB")
        reference_img = Image.open(io.BytesIO(reference_bytes)).convert("RGBA") if reference_bytes else None

        async def on_progress(percent: int, message: str):
            job_queue_manager.update_job(job_id, {
                "progress": percent,
                "message": message,
                "status": "processing"
            })

        # Run inference via active CloudGPUProvider
        result_img = asyncio.run(provider.run_hairstyle(
            person_image=person_img,
            reference_style_image=reference_img,
            color_hex=color_hex,
            backend_override=backend_override,
            progress_callback=on_progress
        ))

        # Save result image to disk
        out_filename = f"{job_id}_hair_result.png"
        out_path = os.path.join(TRYON_DIR, out_filename)
        result_img.save(out_path, format="PNG")
        result_url = f"/storage/tryon/{out_filename}"

        duration = time.time() - start_time
        telemetry = provider.log_telemetry(job_id, "hairstyle", duration, "completed")

        job_queue_manager.update_job(job_id, {
            "status": "completed",
            "progress": 100,
            "message": "Hairstyle synthesis completed successfully!",
            "result_url": result_url,
            "latency_s": telemetry["latency_s"],
            "cost_usd": telemetry["cost_usd"],
            "provider": provider.name
        })

        return {
            "job_id": job_id,
            "status": "completed",
            "result_url": result_url,
            "latency_s": telemetry["latency_s"],
            "cost_usd": telemetry["cost_usd"]
        }

    except Exception as e:
        duration = time.time() - start_time
        provider.log_telemetry(job_id, "hairstyle", duration, "failed")
        job_queue_manager.update_job(job_id, {
            "status": "failed",
            "message": str(e),
            "latency_s": round(duration, 3)
        })
        raise e


if __name__ == "__main__":
    import sys
    import redis
    from rq import Worker, Queue

    print("=" * 60)
    print("Virtual Try-On Distributed RQ Worker")
    print(f"Connecting to Redis: {REDIS_URL}")
    print(f"Active Inference Provider: {get_cloud_provider().name.upper()}")
    print("=" * 60)

    try:
        r = redis.from_url(REDIS_URL)
        r.ping()
        print("Connected to Redis successfully. Listening on 'tryon_jobs' queue...")
        worker = Worker([Queue("tryon_jobs", connection=r)], connection=r)
        burst_mode = "--burst" in sys.argv
        worker.work(burst=burst_mode)
    except Exception as exc:
        print(f"FATAL: Worker failed to connect to Redis: {exc}")
        sys.exit(1)
