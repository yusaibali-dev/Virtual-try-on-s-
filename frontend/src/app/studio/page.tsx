"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Camera,
  RefreshCw,
  FlipHorizontal,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  User,
  Hand,
  Eye,
  Sliders,
  ChevronLeft,
  CheckCircle2,
  Cpu,
  Gem,
  Download,
  Box,
  Image as ImageIcon,
  ChevronRight,
  Maximize2,
  X,
  Scissors,
  Wand2,
  Moon,
  Sun,
  Info,
  Trash2,
  Shield
} from "lucide-react";
import type {
  FaceLandmarker as FaceLandmarkerType,
  PoseLandmarker as PoseLandmarkerType,
  HandLandmarker as HandLandmarkerType,
  DrawingUtils as DrawingUtilsType
} from "@mediapipe/tasks-vision";
import { OneEuroTransform } from "@/lib/oneEuroFilter";
import { JEWELRY_CATALOG, JewelryItem } from "@/lib/jewelryCatalog";

// Dynamically import Three.js 3D viewer to avoid SSR window issues
const Jewelry3DViewer = dynamic(() => import("@/components/Jewelry3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-xs text-neutral-500 animate-pulse">
      Loading 3D Engine...
    </div>
  )
});

export default function StudioPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Camera & Mirror States
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isMirrored, setIsMirrored] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // MediaPipe Models Loading & State
  const [modelsLoading, setModelsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("Initializing Vision Pipeline...");
  const [gpuAccelerated, setGpuAccelerated] = useState(true);

  // Landmark Mesh Visual Toggles
  const [enableFace, setEnableFace] = useState(false);
  const [enablePose, setEnablePose] = useState(false);
  const [enableHands, setEnableHands] = useState(false);

  // Milestone 2, 3 & 5: Selection & Try-On State
  const [activeCategory, setActiveCategory] = useState<
    "necklace" | "earring" | "ring" | "bracelet" | "hair" | "upper" | "dress"
  >("hair");
  const [selectedItems, setSelectedItems] = useState<{
    earring: any | null;
    necklace: any | null;
    ring: any | null;
    bracelet: any | null;
    hair: any | null;
    upper: any | null;
    dress: any | null;
  }>({
    earring: JEWELRY_CATALOG.find((i) => i.id === "earring-diamond-drop") || null,
    necklace: JEWELRY_CATALOG.find((i) => i.id === "necklace-sapphire-pendant") || null,
    ring: JEWELRY_CATALOG.find((i) => i.id === "ring-solitaire-diamond") || null,
    bracelet: JEWELRY_CATALOG.find((i) => i.id === "bracelet-diamond-tennis") || null,
    hair: JEWELRY_CATALOG.find((i) => i.id === "hair-blonde-bob") || null,
    upper: JEWELRY_CATALOG.find((i) => i.id === "garment-cyber-tee") || null,
    dress: null
  });

  // Milestone 5: Hair Recolouring & Styling State
  const [hairColor, setHairColor] = useState("#f59e0b"); // Vibrant amber gold
  const [hairOpacity, setHairOpacity] = useState(0.70);
  const [hairShine, setHairShine] = useState(0.40);
  const [enableHairRecolor, setEnableHairRecolor] = useState(true);

  // Display Mode: 2D Overlay (Canvas PNG) vs 3D Interactive GLB
  const [renderMode, setRenderMode] = useState<"2d" | "3d">("2d");

  // Custom Tuning Sliders: Size Scale & Offset
  const [tuning, setTuning] = useState<{
    earringScale: number;
    earringOffsetY: number;
    necklaceScale: number;
    necklaceOffsetY: number;
    ringScale: number;
    braceletScale: number;
    upperScale: number;
    upperOffsetY: number;
    hairScale: number;
    hairOffsetY: number;
  }>({
    earringScale: 1.0,
    earringOffsetY: 0,
    necklaceScale: 1.0,
    necklaceOffsetY: 15,
    ringScale: 1.0,
    braceletScale: 1.0,
    upperScale: 1.0,
    upperOffsetY: 30,
    hairScale: 1.0,
    hairOffsetY: -20
  });

  // Performance Metrics
  const [fps, setFps] = useState(0);
  const [latencyMs, setLatencyMs] = useState(0);
  const [detectionsCount, setDetectionsCount] = useState({ faces: 0, poses: 0, hands: 0 });
  const [isInsecureOrigin, setIsInsecureOrigin] = useState(false);
  const [screenshotFlash, setScreenshotFlash] = useState(false);
  const [screenshotSuccess, setScreenshotSuccess] = useState<string | null>(null);

  // Milestone 7: Near-Real-Time Live AI Streaming State
  const [liveAiActive, setLiveAiActive] = useState(false);
  const [liveAiImage, setLiveAiImage] = useState<string | null>(null);
  const [liveAiLatencyMs, setLiveAiLatencyMs] = useState(0);
  const [liveAiFps, setLiveAiFps] = useState(2.5);
  const [liveAiFallbackReason, setLiveAiFallbackReason] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedResultUrl, setEnhancedResultUrl] = useState<string | null>(null);

  // Milestone 8: Privacy Consent, Onboarding Tips, & Theme State
  const [hasConsented, setHasConsented] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("vton_camera_consent") === "true";
    }
    return false;
  });
  const [showTips, setShowTips] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);

  const liveAiWsRef = useRef<WebSocket | null>(null);
  const liveAiTimerRef = useRef<NodeJS.Timeout | null>(null);
  const liveAiLastSendRef = useRef<number>(0);
  const liveAiInFlightRef = useRef<boolean>(false);

  // One-Euro Filters for Jitter-Free Fitting
  const leftEarFilterRef = useRef(new OneEuroTransform(0.6, 0.02));
  const rightEarFilterRef = useRef(new OneEuroTransform(0.6, 0.02));
  const necklaceFilterRef = useRef(new OneEuroTransform(0.5, 0.025));
  const ringFilterRef = useRef(new OneEuroTransform(0.7, 0.03));
  const braceletFilterRef = useRef(new OneEuroTransform(0.7, 0.03));

  // Upper clothing / dress filter
  const upperFilterRef = useRef(new OneEuroTransform(0.5, 0.025));

  // Hair overlay transform filter
  const hairFilterRef = useRef(new OneEuroTransform(0.6, 0.02));

  // MediaPipe ImageSegmenter instance ref
  const imageSegmenterRef = useRef<any>(null);

  // Closet items loaded from backend
  const [closetItems, setClosetItems] = useState<any[]>([]);

  // Preloaded Image Cache for zero-lag canvas rendering
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // MediaPipe references
  const faceLandmarkerRef = useRef<FaceLandmarkerType | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarkerType | null>(null);
  const handLandmarkerRef = useRef<HandLandmarkerType | null>(null);
  const drawingUtilsRef = useRef<DrawingUtilsType | null>(null);
  const mpClassesRef = useRef<any>(null);

  const requestRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const frameTimestampsRef = useRef<number[]>([]);
  const lastMetricsUpdateRef = useRef<number>(0);

  // Performance & Adaptive Governor Refs (Direct DOM mutation, zero per-frame React state re-renders)
  const fpsCounterRef = useRef<HTMLDivElement>(null);
  const fpsTextRef = useRef<HTMLSpanElement>(null);
  const latencyTextRef = useRef<HTMLSpanElement>(null);
  const detectionCadenceRef = useRef<number>(1); // 1 = every frame, 2 = balanced, 3 = battery saver
  const frameCountRef = useRef<number>(0);
  const offscreenDetectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPoseResultRef = useRef<any>(null);
  const lastFaceResultRef = useRef<any>(null);
  const lastHandResultRef = useRef<any>(null);

  // Fetch closet items from backend (single-origin relative)
  const apiBase = "";

  useEffect(() => {
    async function loadCloset() {
      try {
        const res = await fetch(`/api/items`);
        if (res.ok) {
          const data = await res.json();
          setClosetItems(data);
          data.forEach((item: any) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = item.image_url;
            imageCacheRef.current.set(item.id, img);
          });
        }
      } catch (e) {
        console.warn("Could not load closet items in studio:", e);
      }
    }
    loadCloset();
  }, []);

  // Preload catalog images into cache
  useEffect(() => {
    JEWELRY_CATALOG.forEach((item) => {
      if (!imageCacheRef.current.has(item.id)) {
        const img = new Image();
        img.src = item.svgDataUri;
        imageCacheRef.current.set(item.id, img);
      }
    });
  }, []);

  // Milestone 7: WebSocket Live AI Connection & Adaptive Frame Loop
  useEffect(() => {
    if (!liveAiActive) {
      if (liveAiWsRef.current) {
        liveAiWsRef.current.close();
        liveAiWsRef.current = null;
      }
      if (liveAiTimerRef.current) {
        clearInterval(liveAiTimerRef.current);
        liveAiTimerRef.current = null;
      }
      liveAiInFlightRef.current = false;
      return;
    }

    const proto = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = typeof window !== "undefined" ? window.location.host : "";
    const wsUrl = `${proto}//${host}/api/tryon/live`;

    const ws = new WebSocket(wsUrl);
    liveAiWsRef.current = ws;

    ws.onopen = () => {
      console.log("[Live AI] Connected to /api/tryon/live WebSocket");
      setLiveAiFallbackReason(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        liveAiInFlightRef.current = false;

        if (data.error === "VRAM_LOW") {
          setLiveAiActive(false);
          setLiveAiFallbackReason("GPU VRAM exceeded safety threshold (<1.0 GB headroom). Auto-fallback to Tier-A overlay.");
          return;
        }

        if (data.status === "success" && data.image_jpeg) {
          setLiveAiImage(data.image_jpeg);
          if (data.timing && data.timing.client_timestamp) {
            const rtt = Math.round(performance.now() - data.timing.client_timestamp);
            setLiveAiLatencyMs(rtt);

            // Auto-fallback: if latency is above 6000ms (6s), disable Live AI and notify user
            if (rtt > 6000) {
              setLiveAiActive(false);
              setLiveAiFallbackReason(`Measured inference latency (${(rtt / 1000).toFixed(1)}s) exceeded 6.0s limit. Auto-fallback to fast Tier-A overlay.`);
              return;
            }

            // Adaptive frame rate: faster latency -> 3.5 to 4 fps; slower latency -> 1.5 to 2 fps
            if (rtt < 800) {
              setLiveAiFps(3.5);
            } else if (rtt < 1500) {
              setLiveAiFps(2.5);
            } else {
              setLiveAiFps(1.5);
            }
          }
        }
      } catch (err) {
        console.warn("[Live AI] Message parse error:", err);
      }
    };

    ws.onerror = (e) => {
      console.warn("[Live AI] WebSocket error:", e);
      setLiveAiActive(false);
      setLiveAiFallbackReason("WebSocket connection failed. Falling back to Tier-A on-device overlay.");
    };

    ws.onclose = () => {
      console.log("[Live AI] WebSocket closed");
    };

    // Frame capture helper (downscaled 384px JPEG for fast upload)
    const sendNextFrame = () => {
      if (!videoRef.current || !liveAiActive || ws.readyState !== WebSocket.OPEN) return;
      if (liveAiInFlightRef.current) return; // Latest-frame backpressure: drop if still in flight

      const video = videoRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      const offCanvas = document.createElement("canvas");
      const targetWidth = 384;
      const targetHeight = Math.round((video.videoHeight / video.videoWidth) * targetWidth);
      offCanvas.width = targetWidth;
      offCanvas.height = targetHeight;
      const ctx = offCanvas.getContext("2d");
      if (!ctx) return;

      // Draw camera video frame
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
      const jpegData = offCanvas.toDataURL("image/jpeg", 0.75);

      const activeItem = selectedItems[activeCategory];
      const payload = {
        frame_jpeg: jpegData,
        timestamp: performance.now(),
        closet_item_id: activeItem?.id || null,
        category: activeCategory === "hair" ? "hair" : (activeCategory === "upper" || activeCategory === "dress") ? activeCategory : "upper"
      };

      liveAiInFlightRef.current = true;
      ws.send(JSON.stringify(payload));
    };

    // Start adaptive sending timer
    const intervalMs = Math.round(1000 / liveAiFps);
    liveAiTimerRef.current = setInterval(sendNextFrame, intervalMs);

    return () => {
      if (liveAiTimerRef.current) clearInterval(liveAiTimerRef.current);
      if (ws) ws.close();
      liveAiInFlightRef.current = false;
    };
  }, [liveAiActive, liveAiFps, activeCategory, selectedItems]);

  // Secure context detection
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isSecure =
        window.isSecureContext ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      if (!isSecure) {
        setIsInsecureOrigin(true);
      }
    }
  }, []);

  // Initialize MediaPipe Vision Tasks
  useEffect(() => {
    let isMounted = true;

    async function initMediaPipe() {
      try {
        setModelsLoading(true);
        setLoadingStatus("Loading MediaPipe WASM runtime...");

        const visionModule = await import("@mediapipe/tasks-vision");
        const { FilesetResolver, FaceLandmarker, PoseLandmarker, HandLandmarker, DrawingUtils } = visionModule;
        mpClassesRef.current = { FaceLandmarker, PoseLandmarker, HandLandmarker, DrawingUtils };

        let vision;
        try {
          vision = await FilesetResolver.forVisionTasks("/wasm");
        } catch {
          vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm"
          );
        }

        if (!isMounted) return;
        setLoadingStatus("Compiling neural landmarkers (Face, Pose, Hands)...");

        // Face Landmarker (self-hosted with fallback)
        const faceModelPath = "/models/face_landmarker.task";
        const faceModel = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: faceModelPath,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 1
        }).catch(async () => {
          setGpuAccelerated(false);
          return FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: faceModelPath,
              delegate: "CPU"
            },
            runningMode: "VIDEO",
            numFaces: 1
          }).catch(() => {
            return FaceLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                delegate: "CPU"
              },
              runningMode: "VIDEO",
              numFaces: 1
            });
          });
        });

        // Pose Landmarker Lite (self-hosted with fallback)
        const poseModelPath = "/models/pose_landmarker_lite.task";
        const poseModel = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: poseModelPath,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        }).catch(async () => {
          return PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: poseModelPath,
              delegate: "CPU"
            },
            runningMode: "VIDEO",
            numPoses: 1
          }).catch(() => {
            return PoseLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                delegate: "CPU"
              },
              runningMode: "VIDEO",
              numPoses: 1
            });
          });
        });

        // Hand Landmarker (self-hosted with fallback)
        const handModelPath = "/models/hand_landmarker.task";
        const handModel = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: handModelPath,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        }).catch(async () => {
          return HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: handModelPath,
              delegate: "CPU"
            },
            runningMode: "VIDEO",
            numHands: 2
          }).catch(() => {
            return HandLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "CPU"
              },
              runningMode: "VIDEO",
              numHands: 2
            });
          });
        });

        // Image Segmenter for live hair recolouring & person segmentation (self-hosted with fallback)
        const { ImageSegmenter } = visionModule;
        const hairModelPath = "/models/hair_segmenter.tflite";
        const segmenterModel = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: hairModelPath,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          outputCategoryMask: true,
          outputConfidenceMasks: false
        }).catch(async () => {
          return ImageSegmenter.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: hairModelPath,
              delegate: "CPU"
            },
            runningMode: "VIDEO",
            outputCategoryMask: true,
            outputConfidenceMasks: false
          }).catch(() => {
            return ImageSegmenter.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite",
                delegate: "CPU"
              },
              runningMode: "VIDEO",
              outputCategoryMask: true,
              outputConfidenceMasks: false
            }).catch((e) => {
              console.warn("Hair segmenter model unavailable:", e);
              return null;
            });
          });
        });

        if (!isMounted) return;
        faceLandmarkerRef.current = faceModel;
        poseLandmarkerRef.current = poseModel;
        handLandmarkerRef.current = handModel;
        imageSegmenterRef.current = segmenterModel;

        setModelsLoading(false);
      } catch (err: any) {
        console.error("Failed to load MediaPipe models:", err);
        if (isMounted) {
          setCameraError(`MediaPipe initialization error: ${err?.message || "Unknown error"}`);
          setModelsLoading(false);
        }
      }
    }

    initMediaPipe();

    return () => {
      isMounted = false;
      if (faceLandmarkerRef.current) faceLandmarkerRef.current.close();
      if (poseLandmarkerRef.current) poseLandmarkerRef.current.close();
      if (handLandmarkerRef.current) handLandmarkerRef.current.close();
    };
  }, []);

  // Setup Camera Stream
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera API (getUserMedia) not supported in this browser or requires HTTPS.");
      return;
    }

    try {
      setCameraError(null);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: facingMode,
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      let msg = "Failed to access camera.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "Camera permission denied. Please allow camera permissions in your browser.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg = "No camera found on this device.";
      } else if (err.name === "NotReadableError") {
        msg = "Camera is already in use by another application.";
      }
      setCameraError(msg);
    }
  }, [facingMode]);

  // Restart camera when facingMode changes
  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera]);

  const toggleFacingMode = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    setIsMirrored(nextMode === "user");
    // Reset filters on camera switch to avoid jumping
    leftEarFilterRef.current.reset();
    rightEarFilterRef.current.reset();
    necklaceFilterRef.current.reset();
    ringFilterRef.current.reset();
    braceletFilterRef.current.reset();
  };

  // Screenshot capture feature (blends video + canvas into a downloadable PNG)
  const captureScreenshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setScreenshotFlash(true);
    setTimeout(() => setScreenshotFlash(false), 200);

    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = video.videoWidth || canvas.width;
    captureCanvas.height = video.videoHeight || canvas.height;
    const ctx = captureCanvas.getContext("2d");
    if (!ctx) return;

    if (isMirrored) {
      ctx.translate(captureCanvas.width, 0);
      ctx.scale(-1, 1);
    }

    // Draw video frame first
    ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
    // Draw jewelry & overlay canvas
    ctx.drawImage(canvas, 0, 0, captureCanvas.width, captureCanvas.height);

    const dataUrl = captureCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `VTON-Jewelry-TryOn-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();

    setScreenshotSuccess("Photo saved to downloads!");
    setTimeout(() => setScreenshotSuccess(null), 3000);
  };

  // Inference & Landmark Overlay Loop with One-Euro Filter & Fitting
  const renderLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2 || video.paused || video.ended) {
      requestRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      requestRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const startTime = performance.now();
      const timestamp = startTime;

      if (!drawingUtilsRef.current && mpClassesRef.current) {
        drawingUtilsRef.current = new mpClassesRef.current.DrawingUtils(ctx);
      }
      const drawingUtils = drawingUtilsRef.current;
      const mp = mpClassesRef.current;

      let detectedFaces = 0;
      let detectedPoses = 0;
      let detectedHands = 0;

      frameCountRef.current++;
      const shouldDetect = (frameCountRef.current % detectionCadenceRef.current) === 0;

      // Downscaled offscreen canvas (480p) for high-performance MediaPipe inference
      if (!offscreenDetectionCanvasRef.current) {
        offscreenDetectionCanvasRef.current = document.createElement("canvas");
      }
      const offCanvas = offscreenDetectionCanvasRef.current;
      const targetDetectW = 480;
      const targetDetectH = Math.round((video.videoHeight / (video.videoWidth || 1)) * targetDetectW) || 360;
      if (offCanvas.width !== targetDetectW || offCanvas.height !== targetDetectH) {
        offCanvas.width = targetDetectW;
        offCanvas.height = targetDetectH;
      }
      if (shouldDetect) {
        const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
        if (offCtx) {
          offCtx.drawImage(video, 0, 0, targetDetectW, targetDetectH);
        }
      }

      // -------------------------------------------------------------
      // 1. POSE DETECTION: Necklaces & Collarbone fitting
      // -------------------------------------------------------------
      if (poseLandmarkerRef.current && mp) {
        try {
          if (shouldDetect) {
            lastPoseResultRef.current = poseLandmarkerRef.current.detectForVideo(offCanvas, timestamp);
          }
          const poseResult = lastPoseResultRef.current;
          if (poseResult && poseResult.landmarks && poseResult.landmarks.length > 0) {
            detectedPoses = poseResult.landmarks.length;
            const landmarks = poseResult.landmarks[0];

            // If landmark wireframe enabled:
            if (enablePose && drawingUtils) {
              drawingUtils.drawConnectors(landmarks, mp.PoseLandmarker.POSE_CONNECTIONS, {
                color: "#A855F7",
                lineWidth: 2
              });
              drawingUtils.drawLandmarks(landmarks, {
                color: "#F43F5E",
                fillColor: "#FB7185",
                radius: 3,
                lineWidth: 1
              });
            }

            // NECKLACE FITTING:
            // MediaPipe Pose landmarks:
            // 11 = Left shoulder, 12 = Right shoulder, 0 = Nose
            const leftShoulder = landmarks[11];
            const rightShoulder = landmarks[12];
            const nose = landmarks[0];

            const necklaceItem = selectedItems.necklace;
            const isVisible =
              (leftShoulder.visibility ?? 1) > 0.5 &&
              (rightShoulder.visibility ?? 1) > 0.5 &&
              necklaceItem !== null;

            if (isVisible && necklaceItem) {
              const lx = leftShoulder.x * canvas.width;
              const ly = leftShoulder.y * canvas.height;
              const rx = rightShoulder.x * canvas.width;
              const ry = rightShoulder.y * canvas.height;

              // Shoulder width and midpoint (base of neck)
              const shoulderDist = Math.hypot(rx - lx, ry - ly);
              const midX = (lx + rx) / 2;
              const midY = (ly + ry) / 2;

              // Neck orientation angle
              const rawAngle = Math.atan2(ry - ly, rx - lx);

              // Position necklace slightly below neck base
              const targetY = midY + tuning.necklaceOffsetY;
              const targetScale = (shoulderDist * 0.95 * tuning.necklaceScale) / 300;

              // One-Euro Filter smoothing
              const smoothed = necklaceFilterRef.current.filter(
                midX,
                targetY,
                targetScale,
                rawAngle,
                timestamp
              );

              // Render Necklace PNG
              const img = imageCacheRef.current.get(necklaceItem.id);
              if (img && img.complete) {
                ctx.save();
                ctx.translate(smoothed.x, smoothed.y);
                ctx.rotate(smoothed.angle);
                const w = 300 * smoothed.scale;
                const h = 170 * smoothed.scale;
                ctx.drawImage(img, -w / 2, -h * 0.15, w, h);
                ctx.restore();
              }
            } else {
              necklaceFilterRef.current.reset();
            }

            // UPPER CLOTHING / DRESS FITTING (Shoulder + Hip Keypoint Warping):
            const garmentItem = selectedItems.upper || selectedItems.dress;
            if (garmentItem && (leftShoulder.visibility ?? 1) > 0.4 && (rightShoulder.visibility ?? 1) > 0.4) {
              const lx = leftShoulder.x * canvas.width;
              const ly = leftShoulder.y * canvas.height;
              const rx = rightShoulder.x * canvas.width;
              const ry = rightShoulder.y * canvas.height;

              // Pose Hip landmarks: 23 = Left Hip, 24 = Right Hip
              const leftHip = landmarks[23];
              const rightHip = landmarks[24];
              const hasHips = leftHip && rightHip && (leftHip.visibility ?? 1) > 0.3;

              const midX = (lx + rx) / 2;
              const midY = (ly + ry) / 2;
              const shoulderDist = Math.hypot(rx - lx, ry - ly);
              const rawAngle = Math.atan2(ry - ly, rx - lx);

              // Compute torso length from shoulders down to hips (or estimate from shoulder width)
              const torsoHeight = hasHips
                ? Math.hypot(((leftHip.x + rightHip.x)/2 - midX/canvas.width) * canvas.width, ((leftHip.y + rightHip.y)/2 - midY/canvas.height) * canvas.height)
                : shoulderDist * 1.35;

              const garmentScale = (shoulderDist * 2.2 * tuning.upperScale) / 300;
              const targetY = midY + tuning.upperOffsetY;

              const smoothedGarment = upperFilterRef.current.filter(
                midX,
                targetY,
                garmentScale,
                rawAngle,
                timestamp
              );

              const gImg = imageCacheRef.current.get(garmentItem.id);
              if (gImg && gImg.complete) {
                ctx.save();
                ctx.translate(smoothedGarment.x, smoothedGarment.y);
                ctx.rotate(smoothedGarment.angle);

                const gw = 300 * smoothedGarment.scale;
                // Scale torso length realistically
                const gh = Math.max(torsoHeight * 1.15, (gImg.height / Math.max(1, gImg.width)) * gw);

                // Render garment body
                ctx.drawImage(gImg, -gw / 2, 0, gw, gh);
                ctx.restore();

                // Forearms & Hands in front of garment:
                // MediaPipe Pose landmarks: 15 = Left wrist, 16 = Right wrist, 13 = Left elbow, 14 = Right elbow
                const leftElbow = landmarks[13];
                const rightElbow = landmarks[14];
                const leftWrist = landmarks[15];
                const rightWrist = landmarks[16];

                if (leftElbow && leftWrist && (leftWrist.visibility ?? 1) > 0.5) {
                  const elX = leftElbow.x * canvas.width;
                  const elY = leftElbow.y * canvas.height;
                  const wrX = leftWrist.x * canvas.width;
                  const wrY = leftWrist.y * canvas.height;

                  // Sample live video arm pixels to composite in front of garment
                  ctx.save();
                  ctx.beginPath();
                  ctx.lineWidth = shoulderDist * 0.22;
                  ctx.lineCap = "round";
                  ctx.moveTo(elX, elY);
                  ctx.lineTo(wrX, wrY);
                  ctx.clip();
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  ctx.restore();
                }

                if (rightElbow && rightWrist && (rightWrist.visibility ?? 1) > 0.5) {
                  const elX = rightElbow.x * canvas.width;
                  const elY = rightElbow.y * canvas.height;
                  const wrX = rightWrist.x * canvas.width;
                  const wrY = rightWrist.y * canvas.height;

                  ctx.save();
                  ctx.beginPath();
                  ctx.lineWidth = shoulderDist * 0.22;
                  ctx.lineCap = "round";
                  ctx.moveTo(elX, elY);
                  ctx.lineTo(wrX, wrY);
                  ctx.clip();
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  ctx.restore();
                }
              }
            } else {
              upperFilterRef.current.reset();
            }
          } else {
            necklaceFilterRef.current.reset();
            upperFilterRef.current.reset();
          }
        } catch (e) {}
      }

      // -------------------------------------------------------------
      // 2. FACE DETECTION: Earrings (Left & Right Ear lobes)
      // -------------------------------------------------------------
      if (faceLandmarkerRef.current && mp) {
        try {
          if (shouldDetect) {
            lastFaceResultRef.current = faceLandmarkerRef.current.detectForVideo(offCanvas, timestamp);
          }
          const faceResult = lastFaceResultRef.current;
          if (faceResult && faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
            detectedFaces = faceResult.faceLandmarks.length;
            const landmarks = faceResult.faceLandmarks[0];

            if (enableFace && drawingUtils) {
              drawingUtils.drawConnectors(landmarks, mp.FaceLandmarker.FACE_LANDMARKS_CONTOURS, {
                color: "#00F0FF",
                lineWidth: 1
              });
            }

            // EARRINGS FITTING:
            // MediaPipe 468 Face Mesh Landmarks:
            // Left earlobe / tragus area: 177 / 234 / 132
            // Right earlobe / tragus area: 401 / 454 / 361
            // Forehead / Chin for head rotation: 10 (top forehead), 152 (chin)
            const leftEarLobe = landmarks[177] || landmarks[234];
            const rightEarLobe = landmarks[401] || landmarks[454];
            const chin = landmarks[152];
            const forehead = landmarks[10];

            const earringItem = selectedItems.earring;

            if (earringItem) {
              const earDist = Math.hypot(
                (rightEarLobe.x - leftEarLobe.x) * canvas.width,
                (rightEarLobe.y - leftEarLobe.y) * canvas.height
              );
              // Head tilt angle
              const headTilt = Math.atan2(
                (chin.y - forehead.y) * canvas.height,
                (chin.x - forehead.x) * canvas.width
              ) - Math.PI / 2;

              const earringScale = (earDist * 0.28 * tuning.earringScale) / 80;
              const img = imageCacheRef.current.get(earringItem.id);

              // 1. Left Earring
              // Visibility check: landmark z depth or distance from nose
              const leftVisible = leftEarLobe.z < 0.2;
              if (leftVisible && img && img.complete) {
                const lx = leftEarLobe.x * canvas.width;
                const ly = leftEarLobe.y * canvas.height + tuning.earringOffsetY;
                const smoothLeft = leftEarFilterRef.current.filter(
                  lx,
                  ly,
                  earringScale,
                  headTilt,
                  timestamp
                );

                ctx.save();
                ctx.translate(smoothLeft.x, smoothLeft.y);
                ctx.rotate(smoothLeft.angle);
                const ew = 80 * smoothLeft.scale;
                const eh = 130 * smoothLeft.scale;
                ctx.drawImage(img, -ew / 2, 0, ew, eh);
                ctx.restore();
              } else {
                leftEarFilterRef.current.reset();
              }

              // 2. Right Earring
              const rightVisible = rightEarLobe.z < 0.2;
              if (rightVisible && img && img.complete) {
                const rx = rightEarLobe.x * canvas.width;
                const ry = rightEarLobe.y * canvas.height + tuning.earringOffsetY;
                const smoothRight = rightEarFilterRef.current.filter(
                  rx,
                  ry,
                  earringScale,
                  headTilt,
                  timestamp
                );

                ctx.save();
                ctx.translate(smoothRight.x, smoothRight.y);
                ctx.rotate(smoothRight.angle);
                const ew = 80 * smoothRight.scale;
                const eh = 130 * smoothRight.scale;
                ctx.drawImage(img, -ew / 2, 0, ew, eh);
                ctx.restore();
              } else {
                rightEarFilterRef.current.reset();
              }
            }

            // -------------------------------------------------------------
            // HAIR STYLING & 2D OVERLAY (Milestone 5)
            // -------------------------------------------------------------
            const hairItem = selectedItems.hair;
            const topForehead = landmarks[10];
            const leftTemple = landmarks[127] || landmarks[234];
            const rightTemple = landmarks[356] || landmarks[454];

            if (hairItem && topForehead) {
              const headTilt = Math.atan2(
                (chin.y - topForehead.y) * canvas.height,
                (chin.x - topForehead.x) * canvas.width
              ) - Math.PI / 2;

              const templeDist = Math.hypot(
                (rightTemple.x - leftTemple.x) * canvas.width,
                (rightTemple.y - leftTemple.y) * canvas.height
              );
              const hairScale = (templeDist * 1.85 * tuning.hairScale) / 200;

              const hX = topForehead.x * canvas.width;
              const hY = topForehead.y * canvas.height + tuning.hairOffsetY;

              const smoothHair = hairFilterRef.current.filter(
                hX,
                hY,
                hairScale,
                headTilt,
                timestamp
              );

              // 1. Hair 2D Overlay
              const hairImg = imageCacheRef.current.get(hairItem.id);
              if (hairImg && hairImg.complete) {
                ctx.save();
                ctx.translate(smoothHair.x, smoothHair.y);
                ctx.rotate(smoothHair.angle);
                const hw = 200 * smoothHair.scale;
                const hh = 180 * smoothHair.scale;
                ctx.drawImage(hairImg, -hw / 2, -hh * 0.25, hw, hh);
                ctx.restore();
              }

              // 2. Real-Time Hair Recolouring Tint (Color picker + opacity + shine)
              if (enableHairRecolor) {
                ctx.save();
                ctx.translate(smoothHair.x, smoothHair.y);
                ctx.rotate(smoothHair.angle);

                // Tint gradient based on selected hairColor and shine
                const tintGrad = ctx.createRadialGradient(0, 0, 10, 0, 20, 120 * smoothHair.scale);
                tintGrad.addColorStop(0, `${hairColor}${Math.round(hairShine * 255).toString(16).padStart(2, "0")}`);
                tintGrad.addColorStop(0.7, `${hairColor}${Math.round(hairOpacity * 255).toString(16).padStart(2, "0")}`);
                tintGrad.addColorStop(1, "transparent");

                ctx.globalCompositeOperation = "color";
                ctx.fillStyle = tintGrad;
                ctx.beginPath();
                ctx.ellipse(0, -20 * smoothHair.scale, 85 * smoothHair.scale, 75 * smoothHair.scale, 0, 0, Math.PI * 2);
                ctx.fill();

                // Specular shine highlights
                if (hairShine > 0.1) {
                  ctx.globalCompositeOperation = "screen";
                  ctx.fillStyle = `rgba(255, 255, 255, ${hairShine * 0.45})`;
                  ctx.beginPath();
                  ctx.ellipse(0, -35 * smoothHair.scale, 50 * smoothHair.scale, 18 * smoothHair.scale, 0, 0, Math.PI * 2);
                  ctx.fill();
                }

                ctx.restore();
              }
            } else {
              hairFilterRef.current.reset();
            }
          } else {
            leftEarFilterRef.current.reset();
            rightEarFilterRef.current.reset();
            hairFilterRef.current.reset();
          }
        } catch (e) {}
      }

      // -------------------------------------------------------------
      // 3. HAND DETECTION: Rings (Ring Finger) & Bracelets (Wrist)
      // -------------------------------------------------------------
      if (handLandmarkerRef.current && mp) {
        try {
          if (shouldDetect) {
            lastHandResultRef.current = handLandmarkerRef.current.detectForVideo(offCanvas, timestamp);
          }
          const handResult = lastHandResultRef.current;
          if (handResult && handResult.landmarks && handResult.landmarks.length > 0) {
            detectedHands = handResult.landmarks.length;

            if (enableHands && drawingUtils) {
              for (const landmarks of handResult.landmarks) {
                drawingUtils.drawConnectors(landmarks, mp.HandLandmarker.HAND_CONNECTIONS, {
                  color: "#10B981",
                  lineWidth: 1.5
                });
                drawingUtils.drawLandmarks(landmarks, {
                  color: "#FBBF24",
                  fillColor: "#F59E0B",
                  radius: 3,
                  lineWidth: 1
                });
              }
            }

            const primaryHand = handResult.landmarks[0];
            // MediaPipe Hand Landmarks:
            // 0 = Wrist
            // 9 = Middle finger MCP (knuckle base)
            // 13 = Ring finger MCP, 14 = Ring finger PIP (first joint), 15 = Ring finger DIP
            const wrist = primaryHand[0];
            const middleMCP = primaryHand[9];
            const ringMCP = primaryHand[13];
            const ringPIP = primaryHand[14];

            // A. RING FITTING (Placed between MCP and PIP of ring finger)
            const ringItem = selectedItems.ring;
            if (ringItem) {
              const rX = ((ringMCP.x + ringPIP.x) / 2) * canvas.width;
              const rY = ((ringMCP.y + ringPIP.y) / 2) * canvas.height;
              const fingerAngle = Math.atan2(
                (ringPIP.y - ringMCP.y) * canvas.height,
                (ringPIP.x - ringMCP.x) * canvas.width
              ) + Math.PI / 2;

              const knuckleDist = Math.hypot(
                (ringPIP.x - ringMCP.x) * canvas.width,
                (ringPIP.y - ringMCP.y) * canvas.height
              );
              const rScale = (knuckleDist * 1.5 * tuning.ringScale) / 100;

              const smoothRing = ringFilterRef.current.filter(
                rX,
                rY,
                rScale,
                fingerAngle,
                timestamp
              );

              const rImg = imageCacheRef.current.get(ringItem.id);
              if (rImg && rImg.complete) {
                ctx.save();
                ctx.translate(smoothRing.x, smoothRing.y);
                ctx.rotate(smoothRing.angle);
                const rw = 100 * smoothRing.scale;
                const rh = 95 * smoothRing.scale;
                ctx.drawImage(rImg, -rw / 2, -rh / 2, rw, rh);
                ctx.restore();
              }
            } else {
              ringFilterRef.current.reset();
            }

            // B. BRACELET FITTING (Placed around wrist)
            const braceletItem = selectedItems.bracelet;
            if (braceletItem) {
              const wX = wrist.x * canvas.width;
              const wY = wrist.y * canvas.height;
              const wristAngle = Math.atan2(
                (middleMCP.y - wrist.y) * canvas.height,
                (middleMCP.x - wrist.x) * canvas.width
              ) + Math.PI / 2;

              const handSize = Math.hypot(
                (middleMCP.x - wrist.x) * canvas.width,
                (middleMCP.y - wrist.y) * canvas.height
              );
              const bScale = (handSize * 1.25 * tuning.braceletScale) / 180;

              const smoothBracelet = braceletFilterRef.current.filter(
                wX,
                wY,
                bScale,
                wristAngle,
                timestamp
              );

              const bImg = imageCacheRef.current.get(braceletItem.id);
              if (bImg && bImg.complete) {
                ctx.save();
                ctx.translate(smoothBracelet.x, smoothBracelet.y);
                ctx.rotate(smoothBracelet.angle);
                const bw = 180 * smoothBracelet.scale;
                const bh = 95 * smoothBracelet.scale;
                ctx.drawImage(bImg, -bw / 2, -bh / 2, bw, bh);
                ctx.restore();
              }
            } else {
              braceletFilterRef.current.reset();
            }
          } else {
            ringFilterRef.current.reset();
            braceletFilterRef.current.reset();
          }
        } catch (e) {}
      }

      const inferenceDuration = performance.now() - startTime;

      // FPS Window & Adaptive Quality Governor (protect 25+ FPS budget)
      const now = performance.now();
      frameTimestampsRef.current.push(now);
      while (frameTimestampsRef.current.length > 0 && frameTimestampsRef.current[0] < now - 1000) {
        frameTimestampsRef.current.shift();
      }

      if (now - lastMetricsUpdateRef.current > 500) {
        lastMetricsUpdateRef.current = now;
        const currentFps = frameTimestampsRef.current.length;
        const currentLatency = Math.round(inferenceDuration);

        // Adaptive Governor: High (>=26 fps) -> Balanced (18-25 fps) -> Battery Saver (<18 fps)
        if (currentFps >= 26) {
          detectionCadenceRef.current = 1;
        } else if (currentFps >= 18) {
          detectionCadenceRef.current = 2; // Every 2nd frame
        } else {
          detectionCadenceRef.current = 3; // Every 3rd frame
        }

        // Direct DOM update avoiding React re-renders
        if (fpsTextRef.current) {
          fpsTextRef.current.textContent = `${currentFps} FPS`;
        }
        if (latencyTextRef.current) {
          latencyTextRef.current.textContent = `${currentLatency}ms`;
        }
        if (fpsCounterRef.current) {
          fpsCounterRef.current.className = `flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-medium border shadow-inner transition-colors ${
            currentFps >= 22
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : currentFps >= 14
              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
          }`;
        }
      }
    }

    requestRef.current = requestAnimationFrame(renderLoop);
  }, [
    enableFace,
    enablePose,
    enableHands,
    selectedItems,
    tuning
  ]);

  // Start animation loop
  useEffect(() => {
    requestRef.current = requestAnimationFrame(renderLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [renderLoop]);

  // Merge built-in catalog items with user closet items from backend
  const currentCategoryItems = [
    ...JEWELRY_CATALOG.filter((i) => i.type === activeCategory),
    ...closetItems
      .filter((i) => i.category === activeCategory)
      .map((i) => ({
        id: i.id,
        type: i.category,
        name: i.title,
        category: i.category,
        metal: "Closet Item",
        gem: "Custom Cutout",
        previewSvg: `${apiBase}${i.thumbnail_url}`,
        svgDataUri: `${apiBase}${i.image_url}`
      }))
  ];

  return (
    <div
      className={`min-h-screen flex flex-col selection:bg-cyan-500/30 transition-colors duration-300 ${
        isLightMode
          ? "bg-neutral-100 text-neutral-900"
          : "bg-neutral-950 text-white"
      }`}
    >
      {/* Top Header */}
      <header className="border-b border-neutral-800/80 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Gem className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-sm sm:text-base leading-none">VTON Studio</h1>
                <p className="text-[11px] text-cyan-400 mt-0.5">Live Jewellery Try-On & Landmark Tracking</p>
              </div>
            </div>
          </div>

          {/* Action Header controls */}
          <div className="flex items-center gap-2">
            {/* Dark / Light Mode Toggle */}
            <button
              onClick={() => setIsLightMode(!isLightMode)}
              title="Toggle Light / Dark Mode"
              className="p-1.5 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all text-xs"
            >
              {isLightMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-400" />}
            </button>

            {/* Onboarding Tips Toggle */}
            <button
              onClick={() => setShowTips(!showTips)}
              title="Onboarding Tips (Lighting & Framing)"
              className="p-1.5 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all text-xs"
            >
              <Info className="w-4 h-4 text-purple-400" />
            </button>

            {/* Delete My Data Button */}
            <button
              onClick={async () => {
                if (confirm("Permanently wipe all your saved photos, uploaded closet items, and generated try-on frames from the server?")) {
                  setIsDeletingData(true);
                  try {
                    const res = await fetch(`${apiBase}/api/user/delete-data`, { method: "POST" });
                    if (res.ok) {
                      localStorage.removeItem("vton_camera_consent");
                      setHasConsented(false);
                      setClosetItems([]);
                      alert("All user data and photos have been permanently deleted.");
                    }
                  } catch (e) {
                    alert("Failed to delete user data.");
                  } finally {
                    setIsDeletingData(false);
                  }
                }
              }}
              disabled={isDeletingData}
              title="Delete All My Data (GDPR / Privacy Wipe)"
              className="p-1.5 rounded-full bg-neutral-800/80 hover:bg-rose-900/40 text-neutral-400 hover:text-rose-400 border border-transparent hover:border-rose-500/30 transition-all text-xs"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <Link
              href="/closet"
              className="px-3 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors hidden sm:inline-block"
            >
              Closet
            </Link>

            {/* Screenshot capture button */}
            <button
              onClick={captureScreenshot}
              id="btn-screenshot"
              className="px-3.5 py-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Capture</span>
            </button>

            {/* Performance Badge */}
            <div
              id="fps-counter"
              ref={fpsCounterRef}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-medium border shadow-inner transition-colors bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            >
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              <span ref={fpsTextRef}>30 FPS</span>
              <span className="text-neutral-500">|</span>
              <span ref={latencyTextRef} className="text-neutral-400">12ms</span>
            </div>
          </div>
        </div>
      </header>

      {/* Screenshot Flash Notification */}
      {screenshotFlash && <div className="fixed inset-0 bg-white/40 pointer-events-none z-50 transition-opacity" />}
      {screenshotSuccess && (
        <div className="fixed top-16 right-4 z-50 bg-emerald-500/90 text-neutral-950 px-4 py-2 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4" />
          <span>{screenshotSuccess}</span>
        </div>
      )}

      {/* Milestone 8: Privacy Consent Modal (Must consent before camera access) */}
      {!hasConsented && (
        <div className="fixed inset-0 bg-neutral-950/95 backdrop-blur-xl z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-4">
              <Shield className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Camera &amp; Privacy Notice</h2>
            <p className="text-xs text-neutral-300 leading-relaxed mb-5 text-left bg-neutral-950/60 p-4 rounded-2xl border border-neutral-800 space-y-2">
              <span className="block font-semibold text-cyan-300">Your privacy is guaranteed:</span>
              <span className="block">• <strong>On-Device Landmark Tracking:</strong> MediaPipe processes facial, hand, and pose landmarks locally on your device hardware.</span>
              <span className="block">• <strong>In-Memory Live AI:</strong> Live video frames streamed to the server are processed purely in RAM and discarded immediately (zero image logging).</span>
              <span className="block">• <strong>1-Hour Auto-Delete:</strong> Any captured try-on photos are permanently erased after 1 hour (TTL auto-delete).</span>
              <span className="block">• <strong>Right to Erasure:</strong> Tap &ldquo;Delete My Data&rdquo; at any time to wipe all files instantly.</span>
            </p>
            <div className="flex gap-3 w-full">
              <Link
                href="/"
                className="flex-1 py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
              >
                Decline &amp; Exit
              </Link>
              <button
                onClick={() => {
                  setHasConsented(true);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("vton_camera_consent", "true");
                  }
                }}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-neutral-950 text-xs font-bold transition-all shadow-lg shadow-cyan-500/25"
              >
                I Agree &amp; Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Milestone 8: Onboarding Tips Overlay (Lighting & Framing) */}
      {showTips && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowTips(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-5 h-5 text-purple-400" />
              <h3 className="text-sm font-bold text-white">Studio Onboarding &amp; Framing Tips</h3>
            </div>
            <div className="space-y-2.5 text-xs text-neutral-300">
              <div className="p-3 bg-neutral-950/70 rounded-2xl border border-neutral-800/80">
                <strong className="text-amber-300 block mb-1">1. Optimal Lighting:</strong>
                Position front-facing, diffuse lighting towards your face. Avoid harsh backlights or strong window shadows behind you.
              </div>
              <div className="p-3 bg-neutral-950/70 rounded-2xl border border-neutral-800/80">
                <strong className="text-cyan-300 block mb-1">2. Torso &amp; Shoulder Framing:</strong>
                For clothing and necklaces, step back ~1 meter so shoulders and chest are visible. For rings and bracelets, hold your hands steady at collar height.
              </div>
              <div className="p-3 bg-neutral-950/70 rounded-2xl border border-neutral-800/80">
                <strong className="text-emerald-300 block mb-1">3. Live AI vs Snapshot:</strong>
                Toggle &ldquo;Live AI&rdquo; for continuous preview, or tap &ldquo;Capture &amp; Enhance&rdquo; for full-resolution photorealistic diffusion rendering.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Milestone 7: Near-Real-Time Live AI Status & Auto-Fallback Banner */}
      {liveAiFallbackReason && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 px-4 py-2 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>
              <strong>Live AI Auto-Fallback:</strong> {liveAiFallbackReason}
            </span>
          </div>
        </div>
      )}

      {/* Milestone 5 & 7: Preview / Live AI Latency Notice */}
      <div className="bg-gradient-to-r from-cyan-950/40 via-purple-950/40 to-neutral-900 border-b border-cyan-500/20 px-4 py-2 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
          <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wider border ${
            liveAiActive
              ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse"
              : "bg-neutral-800 text-neutral-300 border-neutral-700"
          }`}>
            {liveAiActive ? "Near Real-Time Live AI" : "Tier-A Live Preview"}
          </span>
          <span className="text-neutral-300">
            {liveAiActive ? (
              <>
                Streaming adaptive frames (~{liveAiFps.toFixed(1)} fps) to single-GPU FASHN VTON pipeline. Latency:{" "}
                <strong className="text-cyan-300 font-mono">{liveAiLatencyMs}ms</strong>. Tier-A overlay stays smoothly active between updates.
              </>
            ) : (
              <>
                On-device real-time neural tracking &amp; garment warp. Toggle <strong className="text-cyan-400">Live AI</strong> below for near-real-time FASHN VTON, or tap <strong className="text-purple-300">Capture &amp; Enhance</strong> for high-res photo fitting.
              </>
            )}
          </span>
        </div>
      </div>

      {/* Main Studio Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col lg:flex-row gap-5 items-stretch">
        {/* Left: Interactive Camera Viewport */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div
            ref={containerRef}
            className="relative w-full aspect-[3/4] sm:aspect-[4/3] max-h-[72vh] rounded-3xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl flex items-center justify-center group"
          >
            {/* Native Video Feed */}
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300"
              style={{
                transform: isMirrored ? "scaleX(-1)" : "none"
              }}
            />

            {/* Milestone 7: Live AI Crossfade Image Layer (Near-Real-Time FASHN VTON Result) */}
            {liveAiActive && liveAiImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={liveAiImage}
                alt="Live AI Try-On Feed"
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 pointer-events-none"
                style={{
                  transform: isMirrored ? "scaleX(-1)" : "none",
                  opacity: 0.88
                }}
              />
            )}

            {/* Landmarks & Garment Overlay Canvas (Tier-A remains active over Live AI) */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-transform duration-300"
              style={{
                transform: isMirrored ? "scaleX(-1)" : "none"
              }}
            />

            {/* 3D GLB/Three.js Preview Overlay (when 3D mode is toggled) */}
            {renderMode === "3d" && selectedItems[activeCategory] && (
              <div className="absolute top-4 right-4 w-40 h-40 sm:w-52 sm:h-52 bg-neutral-950/80 backdrop-blur-md rounded-2xl border border-cyan-500/30 shadow-2xl overflow-hidden z-20 flex flex-col">
                <div className="p-2 border-b border-neutral-800 flex items-center justify-between text-[11px] font-semibold text-cyan-400">
                  <span className="flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5" /> 3D R3F View
                  </span>
                  <button
                    onClick={() => setRenderMode("2d")}
                    className="text-neutral-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 w-full h-full">
                  <Jewelry3DViewer
                    itemType={
                      (["earring", "necklace", "ring", "bracelet"].includes(activeCategory)
                        ? activeCategory
                        : "necklace") as "earring" | "necklace" | "ring" | "bracelet"
                    }
                    metalColor={selectedItems[activeCategory]?.metal?.includes("Gold") ? "#f59e0b" : "#e2e8f0"}
                    gemColor={
                      selectedItems[activeCategory]?.gem?.includes("Emerald")
                        ? "#10b981"
                        : selectedItems[activeCategory]?.gem?.includes("Ruby")
                        ? "#f43f5e"
                        : "#38bdf8"
                    }
                  />
                </div>
              </div>
            )}

            {/* Loading Skeleton & Model Initializer */}
            {modelsLoading && (
              <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
                <div className="relative mb-5">
                  <div className="w-16 h-16 rounded-2xl border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                  <Sparkles className="w-6 h-6 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">Initializing Neural Engine</h3>
                <p className="text-xs text-neutral-400 max-w-xs mb-6">{loadingStatus}</p>

                {/* Loading Skeleton Cards */}
                <div className="flex gap-2.5 max-w-xs w-full">
                  <div className="flex-1 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 animate-pulse flex flex-col items-center justify-center gap-1.5 p-2">
                    <div className="w-8 h-2 rounded bg-neutral-800" />
                    <div className="w-12 h-1.5 rounded bg-neutral-800/60" />
                  </div>
                  <div className="flex-1 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 animate-pulse delay-100 flex flex-col items-center justify-center gap-1.5 p-2">
                    <div className="w-8 h-2 rounded bg-neutral-800" />
                    <div className="w-12 h-1.5 rounded bg-neutral-800/60" />
                  </div>
                  <div className="flex-1 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 animate-pulse delay-200 flex flex-col items-center justify-center gap-1.5 p-2">
                    <div className="w-8 h-2 rounded bg-neutral-800" />
                    <div className="w-12 h-1.5 rounded bg-neutral-800/60" />
                  </div>
                </div>
              </div>
            )}

            {/* Camera Error Screen */}
            {cameraError && (
              <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl mb-3 text-rose-400">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-rose-300 mb-1">Camera Permission Required</h3>
                <p className="text-xs text-neutral-300 max-w-md mb-4">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
                </button>
              </div>
            )}

            {/* Live Tracking Status HUD */}
            {!modelsLoading && !cameraError && (
              <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 pointer-events-none">
                <span className="px-2.5 py-1 rounded-full bg-neutral-900/80 backdrop-blur-md border border-white/10 text-[11px] font-medium text-cyan-300 flex items-center gap-1.5 shadow-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  Ears: {detectionsCount.faces > 0 ? "Tracked" : "Searching"}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-neutral-900/80 backdrop-blur-md border border-white/10 text-[11px] font-medium text-purple-300 flex items-center gap-1.5 shadow-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  Collar: {detectionsCount.poses > 0 ? "Fitted" : "Searching"}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-neutral-900/80 backdrop-blur-md border border-white/10 text-[11px] font-medium text-emerald-300 flex items-center gap-1.5 shadow-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Hands: {detectionsCount.hands > 0 ? `${detectionsCount.hands} Active` : "Searching"}
                </span>
              </div>
            )}

            {/* Quick Floating Controls at Bottom of Preview */}
            <div className="absolute bottom-4 inset-x-4 flex items-center justify-center gap-2.5 z-10 pointer-events-auto">
              <button
                id="btn-switch-camera"
                onClick={toggleFacingMode}
                title="Switch Camera (Front / Back)"
                className="px-3 py-2 rounded-2xl bg-neutral-900/85 hover:bg-neutral-800 text-white border border-white/15 backdrop-blur-md shadow-xl flex items-center gap-2 text-xs font-medium transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">{facingMode === "user" ? "Front" : "Rear"}</span>
              </button>

              <button
                id="btn-toggle-mirror"
                onClick={() => setIsMirrored(!isMirrored)}
                title="Toggle Mirror View"
                className={`px-3 py-2 rounded-2xl border backdrop-blur-md shadow-xl flex items-center gap-2 text-xs font-medium transition-all active:scale-95 ${
                  isMirrored
                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                    : "bg-neutral-900/85 border-white/15 text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                <FlipHorizontal className="w-4 h-4" />
                <span>{isMirrored ? "Mirrored" : "Normal"}</span>
              </button>

              <button
                id="btn-toggle-3d"
                onClick={() => setRenderMode(renderMode === "2d" ? "3d" : "2d")}
                title="Toggle 3D R3F Model Inspector"
                className={`px-3 py-2 rounded-2xl border backdrop-blur-md shadow-xl flex items-center gap-2 text-xs font-medium transition-all active:scale-95 ${
                  renderMode === "3d"
                    ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                    : "bg-neutral-900/85 border-white/15 text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                <Box className="w-4 h-4 text-purple-400" />
                <span>{renderMode === "3d" ? "3D Active" : "3D GLB Mode"}</span>
              </button>

              <button
                id="btn-toggle-camera"
                onClick={() => {
                  if (cameraActive) {
                    if (videoRef.current && videoRef.current.srcObject) {
                      const stream = videoRef.current.srcObject as MediaStream;
                      stream.getTracks().forEach((track) => track.stop());
                      videoRef.current.srcObject = null;
                    }
                    setCameraActive(false);
                  } else {
                    startCamera();
                  }
                }}
                className={`p-2 rounded-2xl border backdrop-blur-md shadow-xl transition-all active:scale-95 ${
                  cameraActive
                    ? "bg-neutral-900/85 border-white/15 text-neutral-300 hover:text-white"
                    : "bg-rose-500/20 border-rose-500/40 text-rose-300"
                }`}
              >
                <Camera className="w-4 h-4" />
              </button>

              {/* Milestone 7: Live AI Near-Real-Time Toggle Button */}
              <button
                id="btn-toggle-live-ai"
                onClick={() => {
                  setLiveAiFallbackReason(null);
                  setLiveAiActive(!liveAiActive);
                }}
                title="Toggle Near-Real-Time Live AI FASHN VTON Stream"
                className={`px-3 py-2 rounded-2xl border backdrop-blur-md shadow-xl flex items-center gap-2 text-xs font-semibold transition-all active:scale-95 ${
                  liveAiActive
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-neutral-950 border-cyan-300 shadow-cyan-500/30"
                    : "bg-neutral-900/85 border-white/15 text-neutral-300 hover:text-white"
                }`}
              >
                <Sparkles className={`w-4 h-4 ${liveAiActive ? "animate-spin" : "text-cyan-400"}`} />
                <span>{liveAiActive ? "Live AI Active" : "Live AI"}</span>
                {liveAiActive && (
                  <span className="text-[10px] bg-black/40 text-cyan-200 px-1.5 py-0.5 rounded-full font-mono">
                    {liveAiLatencyMs > 0 ? `${(liveAiLatencyMs / 1000).toFixed(1)}s` : "syncing"}
                  </span>
                )}
              </button>

              {/* Milestone 7: Wired Capture & Enhance Action Button */}
              <button
                id="btn-capture-enhance"
                disabled={isEnhancing}
                onClick={async () => {
                  if (!videoRef.current) return;
                  const video = videoRef.current;
                  if (video.videoWidth === 0) return;

                  setIsEnhancing(true);
                  try {
                    // 1. Snapshot native full-resolution video frame
                    const capCanvas = document.createElement("canvas");
                    capCanvas.width = video.videoWidth;
                    capCanvas.height = video.videoHeight;
                    const cctx = capCanvas.getContext("2d");
                    if (!cctx) throw new Error("Canvas context failed");
                    cctx.drawImage(video, 0, 0);

                    const blob = await new Promise<Blob | null>((resolve) =>
                      capCanvas.toBlob(resolve, "image/png", 0.95)
                    );
                    if (!blob) throw new Error("Snapshot blob creation failed");

                    // 2. Submit to full-resolution pipeline
                    const activeGarment = selectedItems[activeCategory];
                    const formData = new FormData();
                    formData.append("person_photo", blob, "studio_capture.png");
                    if (activeGarment) {
                      formData.append("closet_item_id", activeGarment.id);
                    }
                    formData.append("category", activeCategory === "hair" ? "hair" : (activeCategory === "upper" || activeCategory === "dress") ? activeCategory : "upper");

                    const res = await fetch(`${apiBase}/api/tryon/photo`, {
                      method: "POST",
                      body: formData
                    });

                    if (res.ok) {
                      const data = await res.json();
                      alert(`Full-resolution Capture & Enhance job started! (Job ID: ${data.job_id})\nView high-res diffusion rendering on the /tryon studio page.`);
                    } else {
                      alert("Capture & Enhance submission failed. Please try again.");
                    }
                  } catch (e: any) {
                    alert(`Capture & Enhance error: ${e.message}`);
                  } finally {
                    setIsEnhancing(false);
                  }
                }}
                title="Capture & Enhance current frame with full-resolution FASHN VTON diffusion"
                className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-xl shadow-purple-500/25 flex items-center gap-2 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
              >
                <Wand2 className={`w-4 h-4 text-amber-300 ${isEnhancing ? "animate-spin" : ""}`} />
                <span>{isEnhancing ? "Enhancing..." : "Capture & Enhance"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Jewelry Catalog Carousel & Tuning Controls */}
        <div className="w-full lg:w-96 flex flex-col gap-4">
          {/* Jewelry Category Switcher */}
          <div className="p-3.5 rounded-3xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Gem className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">Jewellery Carousel</h2>
              </div>
              <span className="text-[10px] text-neutral-400 font-mono">6 Styles / Category</span>
            </div>

            {/* Category tabs */}
            <div className="grid grid-cols-7 gap-1 p-1 bg-neutral-950/60 rounded-2xl border border-neutral-800/80 mb-3.5">
              {(
                [
                  { id: "hair", label: "Hair" },
                  { id: "upper", label: "Tops" },
                  { id: "dress", label: "Dresses" },
                  { id: "necklace", label: "Necklace" },
                  { id: "earring", label: "Earrings" },
                  { id: "ring", label: "Rings" },
                  { id: "bracelet", label: "Bracelets" }
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id as any)}
                  className={`py-1.5 rounded-xl text-[10px] font-semibold transition-all ${
                    activeCategory === cat.id
                      ? "bg-cyan-500 text-neutral-950 shadow-md shadow-cyan-500/20"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Horizontal Scrollable Carousel (6 items per type) */}
            <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-56 p-1">
              {currentCategoryItems.map((item) => {
                const isSelected = selectedItems[activeCategory]?.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedItems((prev) => ({
                        ...prev,
                        [activeCategory]: isSelected ? null : item
                      }));
                    }}
                    className={`flex flex-col items-center p-2 rounded-2xl border text-center transition-all relative group ${
                      isSelected
                        ? "bg-cyan-500/15 border-cyan-400 shadow-md shadow-cyan-500/20"
                        : "bg-neutral-800/40 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/80"
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
                    )}
                    <div className="w-12 h-12 flex items-center justify-center p-1 mb-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.previewSvg}
                        alt={item.name}
                        className="w-full h-full object-contain filter drop-shadow-sm group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <span className="text-[11px] font-medium text-white truncate w-full">{item.name}</span>
                    <span className="text-[9px] text-neutral-400 truncate w-full mt-0.5">{item.metal}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Remove Active Button */}
            {selectedItems[activeCategory] && (
              <button
                onClick={() =>
                  setSelectedItems((prev) => ({
                    ...prev,
                    [activeCategory]: null
                  }))
                }
                className="w-full mt-2.5 py-1.5 rounded-xl border border-neutral-800 hover:bg-neutral-800 text-[11px] text-neutral-400 hover:text-white transition-colors"
              >
                Clear current {activeCategory}
              </button>
            )}
          </div>

          {/* Milestone 5: Hair Recolour & Style Tuning Panel */}
          {activeCategory === "hair" && (
            <div className="p-4 rounded-3xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">Hair Recolouring</h3>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableHairRecolor}
                    onChange={(e) => setEnableHairRecolor(e.target.checked)}
                    className="accent-amber-400 rounded cursor-pointer"
                  />
                  <span className="text-[11px] text-neutral-300">Live Tint</span>
                </label>
              </div>

              {/* Color Swatches and Color Picker */}
              <div>
                <span className="text-xs text-neutral-300 block mb-1.5">Hair Tint Shade</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    {[
                      { name: "Gold Blonde", color: "#f59e0b" },
                      { name: "Brunette", color: "#6b3e26" },
                      { name: "Auburn Red", color: "#b91c1c" },
                      { name: "Jet Black", color: "#171717" },
                      { name: "Platinum", color: "#e2e8f0" },
                      { name: "Cyber Violet", color: "#a855f7" }
                    ].map((swatch) => (
                      <button
                        key={swatch.color}
                        onClick={() => setHairColor(swatch.color)}
                        title={swatch.name}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                          hairColor === swatch.color ? "border-white scale-110 shadow-md shadow-white/20" : "border-neutral-700"
                        }`}
                        style={{ backgroundColor: swatch.color }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="color"
                      value={hairColor}
                      onChange={(e) => setHairColor(e.target.value)}
                      className="w-7 h-7 rounded-lg border border-neutral-700 bg-transparent cursor-pointer"
                      title="Custom Hair Shade"
                    />
                    <span className="font-mono text-[10px] text-neutral-400">{hairColor}</span>
                  </div>
                </div>
              </div>

              {/* Opacity Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-300">Color Opacity</span>
                  <span className="font-mono text-amber-300 text-[11px]">{Math.round(hairOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={hairOpacity}
                  onChange={(e) => setHairOpacity(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Shine / Specular Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-300">Shine &amp; Specular</span>
                  <span className="font-mono text-amber-300 text-[11px]">{Math.round(hairShine * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={hairShine}
                  onChange={(e) => setHairShine(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Precision Sizing & Placement Tuning Sliders */}
          <div className="p-4 rounded-3xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Fitting Sliders & Tuning</h3>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">1€ Jitter Filter Active</span>
            </div>

            {/* Sizing Slider for active category */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-neutral-300">
                  {activeCategory === "hair"
                    ? "Hair Overlay Scale"
                    : activeCategory === "upper"
                    ? "Garment Width / Scale"
                    : activeCategory === "dress"
                    ? "Dress Width / Scale"
                    : activeCategory === "earring"
                    ? "Earrings Scale"
                    : activeCategory === "necklace"
                    ? "Necklace Scale"
                    : activeCategory === "ring"
                    ? "Ring Scale"
                    : "Bracelet Scale"}
                </span>
                <span className="font-mono text-cyan-300 text-[11px]">
                  {activeCategory === "hair"
                    ? `${tuning.hairScale.toFixed(2)}x`
                    : activeCategory === "upper" || activeCategory === "dress"
                    ? `${tuning.upperScale.toFixed(2)}x`
                    : activeCategory === "earring"
                    ? `${tuning.earringScale.toFixed(2)}x`
                    : activeCategory === "necklace"
                    ? `${tuning.necklaceScale.toFixed(2)}x`
                    : activeCategory === "ring"
                    ? `${tuning.ringScale.toFixed(2)}x`
                    : `${tuning.braceletScale.toFixed(2)}x`}
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={
                  activeCategory === "hair"
                    ? tuning.hairScale
                    : activeCategory === "upper" || activeCategory === "dress"
                    ? tuning.upperScale
                    : activeCategory === "earring"
                    ? tuning.earringScale
                    : activeCategory === "necklace"
                    ? tuning.necklaceScale
                    : activeCategory === "ring"
                    ? tuning.ringScale
                    : tuning.braceletScale
                }
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setTuning((prev) => ({
                    ...prev,
                    [activeCategory === "hair"
                      ? "hairScale"
                      : activeCategory === "upper" || activeCategory === "dress"
                      ? "upperScale"
                      : activeCategory === "earring"
                      ? "earringScale"
                      : activeCategory === "necklace"
                      ? "necklaceScale"
                      : activeCategory === "ring"
                      ? "ringScale"
                      : "braceletScale"]: val
                  }));
                }}
                className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Vertical Offset Slider for necklace, earrings, hair, or upper garments */}
            {(activeCategory === "necklace" ||
              activeCategory === "earring" ||
              activeCategory === "hair" ||
              activeCategory === "upper" ||
              activeCategory === "dress") && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-300">Vertical Offset Position</span>
                  <span className="font-mono text-cyan-300 text-[11px]">
                    {activeCategory === "hair"
                      ? `${tuning.hairOffsetY}px`
                      : activeCategory === "upper" || activeCategory === "dress"
                      ? `${tuning.upperOffsetY}px`
                      : activeCategory === "necklace"
                      ? `${tuning.necklaceOffsetY}px`
                      : `${tuning.earringOffsetY}px`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-80"
                  max="100"
                  step="2"
                  value={
                    activeCategory === "hair"
                      ? tuning.hairOffsetY
                      : activeCategory === "upper" || activeCategory === "dress"
                      ? tuning.upperOffsetY
                      : activeCategory === "necklace"
                      ? tuning.necklaceOffsetY
                      : tuning.earringOffsetY
                  }
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setTuning((prev) => ({
                      ...prev,
                      [activeCategory === "hair"
                        ? "hairOffsetY"
                        : activeCategory === "upper" || activeCategory === "dress"
                        ? "upperOffsetY"
                        : activeCategory === "necklace"
                        ? "necklaceOffsetY"
                        : "earringOffsetY"]: val
                    }));
                  }}
                  className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Landmarks Mesh Overlay Inspector (Optional Dev Layer) */}
          <div className="p-3.5 rounded-3xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm text-xs space-y-2">
            <span className="text-neutral-400 font-semibold block text-[11px]">Debug Landmark Mesh:</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setEnableFace(!enableFace)}
                className={`p-2 rounded-xl border text-[11px] font-medium transition-colors ${
                  enableFace
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                    : "bg-neutral-800/40 border-neutral-800 text-neutral-400"
                }`}
              >
                Face Mesh
              </button>
              <button
                onClick={() => setEnablePose(!enablePose)}
                className={`p-2 rounded-xl border text-[11px] font-medium transition-colors ${
                  enablePose
                    ? "bg-purple-500/20 border-purple-400 text-purple-300"
                    : "bg-neutral-800/40 border-neutral-800 text-neutral-400"
                }`}
              >
                Pose Joints
              </button>
              <button
                onClick={() => setEnableHands(!enableHands)}
                className={`p-2 rounded-xl border text-[11px] font-medium transition-colors ${
                  enableHands
                    ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                    : "bg-neutral-800/40 border-neutral-800 text-neutral-400"
                }`}
              >
                Hand Points
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
