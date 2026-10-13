import urllib.request
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

URLS = {
    "face_landmarker.task": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    "pose_landmarker_lite.task": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    "hand_landmarker.task": "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    "hair_segmenter.tflite": "https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite",
}

def ensure_models():
    for name, url in URLS.items():
        dest = MODELS_DIR / name
        if not dest.exists() or dest.stat().st_size == 0:
            print(f"Downloading self-hosted model {name}...")
            urllib.request.urlretrieve(url, dest)
            print(f"  -> Saved {name} ({dest.stat().st_size} bytes)")
        else:
            print(f"Model {name} present ({dest.stat().st_size} bytes)")

if __name__ == "__main__":
    ensure_models()
