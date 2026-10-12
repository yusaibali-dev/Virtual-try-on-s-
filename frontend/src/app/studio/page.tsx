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
  X
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

  // Milestone 2: Jewelry Selection & Try-On State
  const [activeCategory, setActiveCategory] = useState<"earring" | "necklace" | "ring" | "bracelet">("necklace");
  const [selectedItems, setSelectedItems] = useState<{
    earring: JewelryItem | null;
    necklace: JewelryItem | null;
    ring: JewelryItem | null;
    bracelet: JewelryItem | null;
  }>({
    earring: JEWELRY_CATALOG.find((i) => i.id === "earring-diamond-drop") || null,
    necklace: JEWELRY_CATALOG.find((i) => i.id === "necklace-sapphire-pendant") || null,
    ring: JEWELRY_CATALOG.find((i) => i.id === "ring-solitaire-diamond") || null,
    bracelet: JEWELRY_CATALOG.find((i) => i.id === "bracelet-diamond-tennis") || null
  });

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
  }>({
    earringScale: 1.0,
    earringOffsetY: 0,
    necklaceScale: 1.0,
    necklaceOffsetY: 15,
    ringScale: 1.0,
    braceletScale: 1.0
  });

  // Performance Metrics
  const [fps, setFps] = useState(0);
  const [latencyMs, setLatencyMs] = useState(0);
  const [detectionsCount, setDetectionsCount] = useState({ faces: 0, poses: 0, hands: 0 });
  const [isInsecureOrigin, setIsInsecureOrigin] = useState(false);
  const [screenshotFlash, setScreenshotFlash] = useState(false);
  const [screenshotSuccess, setScreenshotSuccess] = useState<string | null>(null);

  // One-Euro Filters for Jitter-Free Fitting
  const leftEarFilterRef = useRef(new OneEuroTransform(0.6, 0.02));
  const rightEarFilterRef = useRef(new OneEuroTransform(0.6, 0.02));
  const necklaceFilterRef = useRef(new OneEuroTransform(0.5, 0.025));
  const ringFilterRef = useRef(new OneEuroTransform(0.7, 0.03));
  const braceletFilterRef = useRef(new OneEuroTransform(0.7, 0.03));

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

  // Preload images into cache
  useEffect(() => {
    JEWELRY_CATALOG.forEach((item) => {
      if (!imageCacheRef.current.has(item.id)) {
        const img = new Image();
        img.src = item.svgDataUri;
        imageCacheRef.current.set(item.id, img);
      }
    });
  }, []);

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

        // Face Landmarker
        const faceModel = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 1
        }).catch(async () => {
          setGpuAccelerated(false);
          return FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "CPU"
            },
            runningMode: "VIDEO",
            numFaces: 1
          });
        });

        // Pose Landmarker Lite
        const poseModel = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        }).catch(async () => {
          return PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
              delegate: "CPU"
            },
            runningMode: "VIDEO",
            numPoses: 1
          });
        });

        // Hand Landmarker
        const handModel = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        }).catch(async () => {
          return HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
              delegate: "CPU"
            },
            runningMode: "VIDEO",
            numHands: 2
          });
        });

        if (!isMounted) return;
        faceLandmarkerRef.current = faceModel;
        poseLandmarkerRef.current = poseModel;
        handLandmarkerRef.current = handModel;

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

      // -------------------------------------------------------------
      // 1. POSE DETECTION: Necklaces & Collarbone fitting
      // -------------------------------------------------------------
      if (poseLandmarkerRef.current && mp) {
        try {
          const poseResult = poseLandmarkerRef.current.detectForVideo(video, timestamp);
          if (poseResult.landmarks && poseResult.landmarks.length > 0) {
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
          } else {
            necklaceFilterRef.current.reset();
          }
        } catch (e) {}
      }

      // -------------------------------------------------------------
      // 2. FACE DETECTION: Earrings (Left & Right Ear lobes)
      // -------------------------------------------------------------
      if (faceLandmarkerRef.current && mp) {
        try {
          const faceResult = faceLandmarkerRef.current.detectForVideo(video, timestamp);
          if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
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
          } else {
            leftEarFilterRef.current.reset();
            rightEarFilterRef.current.reset();
          }
        } catch (e) {}
      }

      // -------------------------------------------------------------
      // 3. HAND DETECTION: Rings (Ring Finger) & Bracelets (Wrist)
      // -------------------------------------------------------------
      if (handLandmarkerRef.current && mp) {
        try {
          const handResult = handLandmarkerRef.current.detectForVideo(video, timestamp);
          if (handResult.landmarks && handResult.landmarks.length > 0) {
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

      // FPS Window Calculation
      const now = performance.now();
      frameTimestampsRef.current.push(now);
      while (frameTimestampsRef.current.length > 0 && frameTimestampsRef.current[0] < now - 1000) {
        frameTimestampsRef.current.shift();
      }

      if (now - lastMetricsUpdateRef.current > 400) {
        lastMetricsUpdateRef.current = now;
        setFps(frameTimestampsRef.current.length);
        setLatencyMs(Math.round(inferenceDuration));
        setDetectionsCount({
          faces: detectedFaces,
          poses: detectedPoses,
          hands: detectedHands
        });
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

  const currentCategoryItems = JEWELRY_CATALOG.filter((i) => i.type === activeCategory);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col selection:bg-cyan-500/30">
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
          <div className="flex items-center gap-2.5">
            {/* Screenshot capture button */}
            <button
              onClick={captureScreenshot}
              id="btn-screenshot"
              className="px-3.5 py-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Capture Photo</span>
            </button>

            {/* Performance Badge */}
            <div
              id="fps-counter"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-medium border shadow-inner transition-colors ${
                fps >= 20
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : fps >= 12
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/30"
              }`}
            >
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              <span>{fps} FPS</span>
              <span className="text-neutral-500">|</span>
              <span className="text-neutral-400">{latencyMs}ms</span>
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

      {/* Insecure Origin Alert for Mobile */}
      {isInsecureOrigin && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <strong>HTTPS Required on Mobile:</strong> Tap to connect via Cloudflare Tunnel (
              <code className="bg-black/30 px-1 py-0.5 rounded">cloudflared tunnel --url http://localhost:3000</code>
              ) to enable phone camera access.
            </span>
          </div>
        </div>
      )}

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

            {/* Landmarks Overlay Canvas */}
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
                    itemType={activeCategory}
                    metalColor={selectedItems[activeCategory]?.metal.includes("Gold") ? "#f59e0b" : "#e2e8f0"}
                    gemColor={
                      selectedItems[activeCategory]?.gem.includes("Emerald")
                        ? "#10b981"
                        : selectedItems[activeCategory]?.gem.includes("Ruby")
                        ? "#f43f5e"
                        : "#38bdf8"
                    }
                  />
                </div>
              </div>
            )}

            {/* Model Loading Spinner */}
            {modelsLoading && (
              <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
                <div className="relative mb-4">
                  <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                  <Sparkles className="w-5 h-5 text-cyan-400 absolute inset-0 m-auto" />
                </div>
                <h3 className="text-base font-medium text-white mb-1">Preparing Real-Time Pipeline</h3>
                <p className="text-xs text-neutral-400 max-w-xs">{loadingStatus}</p>
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
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-neutral-950/60 rounded-2xl border border-neutral-800/80 mb-3.5">
              {(
                [
                  { id: "necklace", label: "Necklace" },
                  { id: "earring", label: "Earrings" },
                  { id: "ring", label: "Rings" },
                  { id: "bracelet", label: "Bracelets" }
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`py-1.5 rounded-xl text-xs font-semibold transition-all ${
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
                  {activeCategory === "earring"
                    ? "Earrings Scale"
                    : activeCategory === "necklace"
                    ? "Necklace Scale"
                    : activeCategory === "ring"
                    ? "Ring Scale"
                    : "Bracelet Scale"}
                </span>
                <span className="font-mono text-cyan-300 text-[11px]">
                  {activeCategory === "earring"
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
                max="1.8"
                step="0.05"
                value={
                  activeCategory === "earring"
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
                    [activeCategory === "earring"
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

            {/* Vertical Offset Slider for necklace or earrings */}
            {(activeCategory === "necklace" || activeCategory === "earring") && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-300">Vertical Offset Position</span>
                  <span className="font-mono text-cyan-300 text-[11px]">
                    {activeCategory === "necklace" ? `${tuning.necklaceOffsetY}px` : `${tuning.earringOffsetY}px`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-40"
                  max="60"
                  step="2"
                  value={activeCategory === "necklace" ? tuning.necklaceOffsetY : tuning.earringOffsetY}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setTuning((prev) => ({
                      ...prev,
                      [activeCategory === "necklace" ? "necklaceOffsetY" : "earringOffsetY"]: val
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
