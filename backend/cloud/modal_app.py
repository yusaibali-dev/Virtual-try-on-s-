"""
Modal Serverless GPU Application Template for Virtual Try-On.
Deploy with:
    modal deploy backend/cloud/modal_app.py
"""

import io
import base64
from PIL import Image

try:
    import modal
    app = modal.App("virtual-tryon")
    # Nvidia A10G image definition
    image = (
        modal.Image.debian_slim(python_version="3.11")
        .pip_install(
            "torch>=2.2.0",
            "torchvision",
            "diffusers>=0.27.0",
            "transformers>=4.38.0",
            "accelerate>=0.28.0",
            "pillow",
            "numpy"
        )
    )
except ImportError:
    modal = None
    app = None
    image = None


if app is not None:
    @app.function(
        image=image,
        gpu="A10G",
        timeout=300,
        container_idle_timeout=120
    )
    @modal.web_endpoint(method="POST")
    def tryon_endpoint(data: dict) -> dict:
        """
        Serverless webhook called by FastAPI backend ModalGPUProvider.
        Expects:
            person_b64: Base64 string of person photo
            garment_b64: Base64 string of garment photo
            category: 'upper', 'lower', or 'dress'
            steps: int (e.g. 30)
        Returns:
            result_b64: Base64 string of output image
        """
        person_bytes = base64.b64decode(data["person_b64"])
        garment_bytes = base64.b64decode(data["garment_b64"])
        category = data.get("category", "upper")
        steps = data.get("steps", 30)

        person_img = Image.open(io.BytesIO(person_bytes)).convert("RGB")
        garment_img = Image.open(io.BytesIO(garment_bytes))

        # Model inference execution (CatVTON)
        # result_img = catvton_pipeline(person=person_img, garment=garment_img, category=category, steps=steps)
        result_img = person_img # Placeholder for serverless deployment template

        buffered = io.BytesIO()
        result_img.save(buffered, format="PNG")
        res_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        return {"status": "success", "result_b64": res_b64}
