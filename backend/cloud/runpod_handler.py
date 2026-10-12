"""
RunPod Serverless Handler Template for Virtual Try-On.
Deploy with RunPod Serverless Container (RTX 4090 or A40).
"""

import io
import base64
from PIL import Image

try:
    import runpod
except ImportError:
    runpod = None


def handler(job):
    """
    RunPod serverless job handler.
    Input format:
        job['input']: {
            'person_b64': str,
            'garment_b64': str,
            'category': 'upper' | 'lower' | 'dress',
            'steps': int
        }
    """
    job_input = job.get("input", {})
    person_bytes = base64.b64decode(job_input["person_b64"])
    garment_bytes = base64.b64decode(job_input["garment_b64"])
    category = job_input.get("category", "upper")
    steps = job_input.get("steps", 30)

    person_img = Image.open(io.BytesIO(person_bytes)).convert("RGB")
    garment_img = Image.open(io.BytesIO(garment_bytes))

    # Run inference execution
    result_img = person_img # Placeholder template

    buffered = io.BytesIO()
    result_img.save(buffered, format="PNG")
    res_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

    return {"result_b64": res_b64, "status": "COMPLETED"}


if __name__ == "__main__" and runpod is not None:
    runpod.serverless.start({"handler": handler})
