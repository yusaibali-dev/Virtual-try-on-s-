"""
Job Queue Manager supporting Redis + RQ with fallback to In-Process Queue.
Provides seamless unified interface for enqueueing, state tracking, and SSE streaming.
"""

import os
import json
import time
import asyncio
from typing import Optional, Dict, Any, AsyncGenerator
from cloud_gpu_provider import get_cloud_provider

# Redis configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# In-memory fallbacks when Redis is offline or not installed locally
_in_memory_jobs: Dict[str, Dict[str, Any]] = {}
_in_memory_queues: Dict[str, asyncio.Queue] = {}

class JobQueueManager:
    """
    Unified manager handling:
    1. Redis + RQ (distributed scale-out in Docker/production)
    2. In-process asyncio queue (local dev fallback)
    """

    def __init__(self, redis_url: str = REDIS_URL):
        self.redis_url = redis_url
        self.redis_conn = None
        self.rq_queue = None
        self.is_redis_available = False
        self._init_redis()

    def _init_redis(self):
        """Attempts connection to Redis with short timeout."""
        try:
            import redis
            from rq import Queue
            r = redis.from_url(self.redis_url, socket_connect_timeout=1.5, socket_timeout=1.5)
            r.ping()
            self.redis_conn = r
            self.rq_queue = Queue("tryon_jobs", connection=r)
            self.is_redis_available = True
            print(f"[JobQueue] Successfully connected to Redis at {self.redis_url}. Using Redis + RQ queue.")
        except Exception as e:
            self.is_redis_available = False
            self.redis_conn = None
            self.rq_queue = None
            print(f"[JobQueue] Redis not reachable at {self.redis_url} ({e}). Falling back to in-process queue.")

    def register_job(self, job_id: str, job_type: str, category: str, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Creates initial job record."""
        provider = get_cloud_provider()
        job_data = {
            "id": job_id,
            "job_type": job_type,
            "status": "queued",
            "progress": 0,
            "message": f"Job queued for {provider.name} GPU inference",
            "category": category,
            "provider": provider.name,
            "created_at": time.time(),
            "result_url": None,
            "latency_s": None,
            "cost_usd": None
        }
        if details:
            job_data.update(details)

        if self.is_redis_available and self.redis_conn:
            try:
                self.redis_conn.set(f"job:{job_id}", json.dumps(job_data), ex=86400) # 24h TTL
                return job_data
            except Exception as e:
                print(f"[JobQueue] Redis set failed: {e}. Falling back to in-memory.")

        _in_memory_jobs[job_id] = job_data
        _in_memory_queues[job_id] = asyncio.Queue()
        return job_data

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves job state."""
        if self.is_redis_available and self.redis_conn:
            try:
                raw = self.redis_conn.get(f"job:{job_id}")
                if raw:
                    return json.loads(raw)
            except Exception as e:
                print(f"[JobQueue] Redis get failed: {e}")

        return _in_memory_jobs.get(job_id)

    def update_job(self, job_id: str, updates: Dict[str, Any]):
        """Updates job state and broadcasts update to listeners."""
        current = self.get_job(job_id) or {}
        current.update(updates)

        if self.is_redis_available and self.redis_conn:
            try:
                payload = json.dumps(current)
                self.redis_conn.set(f"job:{job_id}", payload, ex=86400)
                # Publish event to Redis Pub/Sub for SSE listeners
                event_data = {
                    "percent": current.get("progress", 0),
                    "message": current.get("message", ""),
                    "status": current.get("status", "processing"),
                    "result_url": current.get("result_url"),
                    "latency_s": current.get("latency_s"),
                    "cost_usd": current.get("cost_usd")
                }
                self.redis_conn.publish(f"job_events:{job_id}", json.dumps(event_data))
                return
            except Exception as e:
                print(f"[JobQueue] Redis update failed: {e}")

        # In-memory update
        _in_memory_jobs[job_id] = current
        queue = _in_memory_queues.get(job_id)
        if queue:
            try:
                queue.put_nowait({
                    "percent": current.get("progress", 0),
                    "message": current.get("message", ""),
                    "status": current.get("status", "processing"),
                    "result_url": current.get("result_url"),
                    "latency_s": current.get("latency_s"),
                    "cost_usd": current.get("cost_usd")
                })
            except Exception:
                pass

    def cancel_job(self, job_id: str) -> bool:
        """Cancels a job."""
        job = self.get_job(job_id)
        if not job:
            return False

        self.update_job(job_id, {
            "status": "cancelled",
            "message": "Job cancelled by user request"
        })
        return True

    async def stream_job_events(self, job_id: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Async generator yielding progress updates for SSE stream."""
        job = self.get_job(job_id)
        if not job:
            return

        # 1. Send initial current state
        yield {
            "data": json.dumps({
                "percent": job.get("progress", 0),
                "message": job.get("message", ""),
                "status": job.get("status", "queued"),
                "result_url": job.get("result_url"),
                "latency_s": job.get("latency_s"),
                "cost_usd": job.get("cost_usd")
            })
        }

        # 2. Redis PubSub mode
        if self.is_redis_available and self.redis_conn:
            pubsub = self.redis_conn.pubsub()
            pubsub.subscribe(f"job_events:{job_id}")
            try:
                while True:
                    current = self.get_job(job_id)
                    if current and current.get("status") in ("completed", "failed", "cancelled"):
                        break

                    message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                    if message and message.get("data"):
                        raw_data = message["data"]
                        if isinstance(raw_data, bytes):
                            raw_data = raw_data.decode("utf-8")
                        yield {"data": raw_data}
                        data_obj = json.loads(raw_data)
                        if data_obj.get("status") in ("completed", "failed", "cancelled"):
                            break
                    else:
                        await asyncio.sleep(0.5)
                        yield {"comment": "ping"}
            finally:
                pubsub.unsubscribe(f"job_events:{job_id}")
                pubsub.close()
            return

        # 3. In-memory queue fallback mode
        queue = _in_memory_queues.get(job_id)
        while True:
            current = self.get_job(job_id)
            if current and current.get("status") in ("completed", "failed", "cancelled"):
                break
            if not queue:
                break
            try:
                update = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield {"data": json.dumps(update)}
                if update.get("status") in ("completed", "failed", "cancelled"):
                    break
            except asyncio.TimeoutError:
                yield {"comment": "ping"}


# Global singleton instance
job_queue_manager = JobQueueManager()
