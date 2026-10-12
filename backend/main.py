from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(
    title="VTON Studio API",
    description="Backend API for Virtual Try-On and Hair Styling Inference",
    version="0.1.0"
)

# Enable CORS for local development and mobile network testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "VTON Studio Backend",
        "version": "0.1.0"
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "gpu_available": False,  # Will be dynamically detected when torch/CUDA is loaded
        "milestone": "Milestone 1 - Scaffold & Camera"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
