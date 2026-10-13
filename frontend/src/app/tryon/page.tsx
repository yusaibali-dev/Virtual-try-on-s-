"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Sparkles,
  Camera,
  Shirt,
  Upload,
  ArrowRight,
  Download,
  X,
  Play,
  RotateCcw,
  Sliders,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Maximize2,
  Scissors,
  Layers,
  Palette,
  Cpu
} from "lucide-react";

interface ClosetItem {
  id: string;
  title: string;
  category: string;
  image_url: string;
  thumbnail_url: string;
}

export default function PhotoTryonPage() {
  // Mode: "clothing" (CatVTON) vs "hairstyle" (HairFastGAN / SD+IP-Adapter)
  const [tryonMode, setTryonMode] = useState<"clothing" | "hairstyle">("hairstyle");

  // Closet items
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [selectedGarment, setSelectedGarment] = useState<ClosetItem | null>(null);
  const [category, setCategory] = useState<"upper" | "lower" | "dress">("upper");

  // Person photo
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);

  // Milestone 6: Hairstyle State & Backend Switcher
  const [hairstyleBackend, setHairstyleBackend] = useState<"hairfastgan" | "diffusion_ipadapter">("hairfastgan");
  const [hairReferenceFile, setHairReferenceFile] = useState<File | null>(null);
  const [hairReferencePreview, setHairReferencePreview] = useState<string | null>(null);
  const [selectedHairItem, setSelectedHairItem] = useState<ClosetItem | null>(null);
  const [hairColor, setHairColor] = useState("#f59e0b");
  const [enableColorTransfer, setEnableColorTransfer] = useState(true);

  // Job & Progress
  const [jobId, setJobId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Before / After Slider state (0 to 100)
  const [sliderPos, setSliderPos] = useState(50);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const apiBase = "";

  // Load user closet items & hairstyle config
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`${apiBase}/api/items`);
        if (res.ok) {
          const data = await res.json();
          setClosetItems(data);
          if (data.length > 0) {
            setSelectedGarment(data[0]);
            const hairItem = data.find((i: ClosetItem) => i.category === "hair");
            if (hairItem) setSelectedHairItem(hairItem);
          }
        }
      } catch (e) {
        console.warn("Could not load closet items:", e);
      }

      try {
        const cfgRes = await fetch(`${apiBase}/api/hairstyle/config`);
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          if (cfg.active_backend) {
            setHairstyleBackend(cfg.active_backend);
          }
        }
      } catch (e) {
        console.warn("Could not load hairstyle config:", e);
      }
    }
    loadData();
  }, [apiBase]);

  // Handle Backend Switch
  const handleBackendChange = async (newBackend: "hairfastgan" | "diffusion_ipadapter") => {
    setHairstyleBackend(newBackend);
    try {
      await fetch(`${apiBase}/api/hairstyle/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backend: newBackend })
      });
    } catch (e) {
      console.warn("Failed to persist backend choice:", e);
    }
  };

  // Handle Person Photo Selection
  const handlePersonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPersonFile(file);
      setPersonPreview(URL.createObjectURL(file));
      setResultUrl(null);
    }
  };

  // Handle Hair Reference File Selection
  const handleHairRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setHairReferenceFile(file);
      setHairReferencePreview(URL.createObjectURL(file));
      setSelectedHairItem(null);
    }
  };

  // Submit Try-On Job (Clothing or Hairstyle)
  const handleStartTryon = async () => {
    if (!personFile) {
      setErrorMsg("Please upload a person photo first.");
      return;
    }

    if (tryonMode === "clothing" && !selectedGarment) {
      setErrorMsg("Please select a clothing item from your closet.");
      return;
    }

    if (tryonMode === "hairstyle" && !hairReferenceFile && !selectedHairItem) {
      setErrorMsg("Please select a hairstyle reference from closet or upload one.");
      return;
    }

    setErrorMsg(null);
    setIsProcessing(true);
    setProgressPercent(5);
    setProgressMessage(`Submitting job to GPU queue (${tryonMode === "hairstyle" ? hairstyleBackend : "CatVTON"})...`);
    setResultUrl(null);

    try {
      const formData = new FormData();
      formData.append("person_photo", personFile);

      let endpoint = `${apiBase}/api/tryon/photo`;

      if (tryonMode === "hairstyle") {
        endpoint = `${apiBase}/api/tryon/hairstyle`;
        formData.append("backend", hairstyleBackend);
        if (enableColorTransfer) {
          formData.append("color_hex", hairColor);
        }
        if (hairReferenceFile) {
          formData.append("reference_photo", hairReferenceFile);
        } else if (selectedHairItem) {
          formData.append("closet_item_id", selectedHairItem.id);
        }
      } else {
        if (selectedGarment) {
          formData.append("closet_item_id", selectedGarment.id);
        }
        formData.append("category", category);
      }

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to start try-on job.");
      }

      const jobData = await res.json();
      const currentJobId = jobData.job_id;
      // Connect to progress updates (WebSocket with polling fallback for Cloudflare tunnel resilience)
      let closed = false;
      const proto = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = typeof window !== "undefined" ? window.location.host : "";
      const wsUrl = `${proto}//${host}/api/jobs/${currentJobId}/ws`;

      const handleUpdate = (data: any) => {
        if (closed) return;
        if (data.percent !== undefined) setProgressPercent(data.percent);
        if (data.message) setProgressMessage(data.message);

        if (data.status === "completed") {
          closed = true;
          setIsProcessing(false);
          setResultUrl(data.result_url ? `${data.result_url}` : "");
        } else if (data.status === "failed") {
          closed = true;
          setIsProcessing(false);
          setErrorMsg(data.message || "Pipeline synthesis failed.");
        } else if (data.status === "cancelled") {
          closed = true;
          setIsProcessing(false);
          setProgressMessage("Job cancelled.");
        }
      };

      // Polling fallback
      let pollTimer: NodeJS.Timeout | null = null;
      const startPolling = () => {
        if (pollTimer || closed) return;
        pollTimer = setInterval(async () => {
          if (closed) {
            if (pollTimer) clearInterval(pollTimer);
            return;
          }
          try {
            const pollRes = await fetch(`/api/jobs/${currentJobId}`);
            if (pollRes.ok) {
              const pData = await pollRes.json();
              handleUpdate(pData);
            }
          } catch (e) {}
        }, 1000);
      };

      try {
        const ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          try {
            const raw = JSON.parse(event.data);
            const data = typeof raw.data === "string" ? JSON.parse(raw.data) : (raw.data || raw);
            handleUpdate(data);
            if (closed) ws.close();
          } catch (err) {
            console.warn("WS parse error:", err);
          }
        };
        ws.onerror = () => {
          startPolling();
        };
        ws.onclose = () => {
          if (!closed) startPolling();
        };
      } catch (err) {
        startPolling();
      }
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMsg(err.message || "An error occurred during inference.");
    }
  };

  // Cancel Job
  const handleCancel = async () => {
    if (jobId) {
      try {
        await fetch(`${apiBase}/api/jobs/${jobId}/cancel`, { method: "POST" });
      } catch (e) {}
    }
    setIsProcessing(false);
    setProgressMessage("Job cancelled");
  };

  // Before/After Slider Drag Handling
  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingRef.current || !sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const offsetX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    setSliderPos(Math.round((offsetX / rect.width) * 100));
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col selection:bg-cyan-500/30">
      {/* Header */}
      <header className="border-b border-neutral-800/80 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all text-xs font-medium flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Home</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-sm sm:text-base leading-none">Photo Try-On Studio</h1>
                <p className="text-[11px] text-cyan-400 mt-0.5">CatVTON &amp; Hairstyle Neural Transfer</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Try-on Mode Switcher (Clothes vs Hair) */}
            <div className="flex items-center p-1 bg-neutral-950/80 rounded-2xl border border-neutral-800">
              <button
                onClick={() => setTryonMode("hairstyle")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  tryonMode === "hairstyle"
                    ? "bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Hairstyle</span>
              </button>
              <button
                onClick={() => setTryonMode("clothing")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  tryonMode === "clothing"
                    ? "bg-cyan-500 text-neutral-950 shadow-md shadow-cyan-500/20"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Shirt className="w-3.5 h-3.5" />
                <span>Clothes (CatVTON)</span>
              </button>
            </div>

            <Link
              href="/closet"
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors"
            >
              Closet
            </Link>
            <Link
              href="/studio"
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors"
            >
              Live Camera
            </Link>
          </div>
        </div>
      </header>

      {/* Main Studio Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-6 items-stretch">
        {/* Left: Interactive Canvas / Before-After Slider Area */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="relative w-full aspect-[3/4] max-h-[72vh] rounded-3xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl flex items-center justify-center group">
            {/* If Result is Ready: Interactive Before/After Split Slider */}
            {resultUrl && personPreview ? (
              <div
                ref={sliderContainerRef}
                onMouseDown={() => (isDraggingRef.current = true)}
                onMouseUp={() => (isDraggingRef.current = false)}
                onMouseLeave={() => (isDraggingRef.current = false)}
                onMouseMove={handleMouseMove}
                onTouchStart={() => (isDraggingRef.current = true)}
                onTouchEnd={() => (isDraggingRef.current = false)}
                onTouchMove={handleMouseMove}
                className="relative w-full h-full select-none cursor-ew-resize overflow-hidden"
              >
                {/* Result Image (Full background) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resultUrl}
                  alt="Try-On Result"
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Original Person Image (Clipped by slider position) */}
                <div
                  className="absolute inset-0 h-full overflow-hidden border-r-2 border-cyan-400 shadow-2xl"
                  style={{ width: `${sliderPos}%` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={personPreview}
                    alt="Original Person"
                    className="absolute inset-0 w-full h-full object-cover max-w-none"
                    style={{ width: sliderContainerRef.current?.clientWidth || "100%" }}
                  />
                  <span className="absolute bottom-4 left-4 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-mono text-white">
                    BEFORE
                  </span>
                </div>

                <span className="absolute bottom-4 right-4 px-2.5 py-1 rounded-md bg-cyan-500/80 backdrop-blur-md text-[10px] font-mono text-neutral-950 font-bold">
                  AFTER ({tryonMode === "hairstyle" ? hairstyleBackend : "CatVTON"})
                </span>

                {/* Slider Divider Handle */}
                <div
                  className="absolute top-0 bottom-0 w-8 -ml-4 flex items-center justify-center pointer-events-none"
                  style={{ left: `${sliderPos}%` }}
                >
                  <div className="w-8 h-8 rounded-full bg-cyan-400 text-neutral-950 shadow-xl flex items-center justify-center font-bold text-xs border-2 border-white">
                    ⟷
                  </div>
                </div>
              </div>
            ) : personPreview ? (
              /* Person Image Loaded but result not generated yet */
              <div className="relative w-full h-full flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={personPreview}
                  alt="Person preview"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              /* Upload Prompt */
              <label className="flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:opacity-80 transition-opacity">
                <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">Upload Person Photo</h3>
                <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
                  Upload a clear portrait photo to try on hairstyles or clothes with neural models.
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePersonFileChange}
                  className="hidden"
                />
              </label>
            )}

            {/* Processing Overlay with Progress Bar */}
            {isProcessing && (
              <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center z-30">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4 animate-spin">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">
                  {tryonMode === "hairstyle" ? "Neural Hairstyle Synthesis" : "Neural Diffusion Inpainting"}
                </h3>
                <p className="text-xs text-neutral-300 max-w-sm mb-5">{progressMessage}</p>

                {/* Progress Bar */}
                <div className="w-full max-w-xs bg-neutral-800 rounded-full h-2 mb-2 overflow-hidden border border-neutral-700">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-amber-500 h-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-cyan-400 mb-6">{progressPercent}%</span>

                <button
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors"
                >
                  Cancel Inference
                </button>
              </div>
            )}
          </div>

          {/* Action buttons under canvas */}
          <div className="mt-4 flex items-center justify-center gap-3 w-full">
            {resultUrl && (
              <a
                href={resultUrl}
                download="TryOn-Result.png"
                className="px-5 py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-semibold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download Result</span>
              </a>
            )}
            {personPreview && (
              <label className="px-4 py-2.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                <span>Change Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePersonFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Right Sidebar: Item Selection & Inference Controls */}
        <div className="w-full lg:w-96 flex flex-col gap-5">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Hairstyle Specific Controls */}
          {tryonMode === "hairstyle" ? (
            <>
              {/* Backend Config Switcher */}
              <div className="p-4 rounded-3xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                      Hairstyle Backend Switch
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400">RTX 3070</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleBackendChange("hairfastgan")}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      hairstyleBackend === "hairfastgan"
                        ? "bg-amber-500/15 border-amber-400 text-amber-300 font-semibold"
                        : "bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:bg-neutral-800"
                    }`}
                  >
                    <div className="text-xs font-semibold">1. HairFastGAN</div>
                    <div className="text-[10px] text-neutral-400 mt-1">~1.0s | 2.4 GB VRAM</div>
                    <div className="text-[9px] text-emerald-400 mt-0.5">★ Recommended for Speed</div>
                  </button>

                  <button
                    onClick={() => handleBackendChange("diffusion_ipadapter")}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      hairstyleBackend === "diffusion_ipadapter"
                        ? "bg-purple-500/15 border-purple-400 text-purple-300 font-semibold"
                        : "bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:bg-neutral-800"
                    }`}
                  >
                    <div className="text-xs font-semibold">2. SD + IP-Adapter</div>
                    <div className="text-[10px] text-neutral-400 mt-1">~3.5s | 4.6 GB VRAM</div>
                    <div className="text-[9px] text-purple-400 mt-0.5">Diffusion Inpainting</div>
                  </button>
                </div>
              </div>

              {/* Hair Color Transfer Controls */}
              <div className="p-4 rounded-3xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                      Color Transfer &amp; Tint
                    </h3>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableColorTransfer}
                      onChange={(e) => setEnableColorTransfer(e.target.checked)}
                      className="accent-amber-400 rounded cursor-pointer"
                    />
                    <span className="text-[11px] text-neutral-300">Active</span>
                  </label>
                </div>

                {enableColorTransfer && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 flex-1">
                      {[
                        { name: "Gold Blonde", color: "#f59e0b" },
                        { name: "Brunette", color: "#6b3e26" },
                        { name: "Auburn Red", color: "#b91c1c" },
                        { name: "Jet Black", color: "#171717" },
                        { name: "Platinum", color: "#e2e8f0" }
                      ].map((swatch) => (
                        <button
                          key={swatch.color}
                          onClick={() => setHairColor(swatch.color)}
                          title={swatch.name}
                          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                            hairColor === swatch.color ? "border-white scale-110" : "border-neutral-700"
                          }`}
                          style={{ backgroundColor: swatch.color }}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={hairColor}
                      onChange={(e) => setHairColor(e.target.value)}
                      className="w-7 h-7 rounded-lg border border-neutral-700 bg-transparent cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Hairstyle Reference Picker (Closet or Upload) */}
              <div className="p-4 rounded-3xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                    Reference Hairstyle
                  </h3>
                  <label className="text-[11px] text-amber-400 hover:underline cursor-pointer">
                    + Upload Style
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleHairRefChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {hairReferencePreview && (
                  <div className="mb-3 p-2 bg-neutral-950/80 border border-amber-500/40 rounded-2xl flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={hairReferencePreview}
                      alt="Uploaded hair ref"
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                    <div className="flex-1 truncate">
                      <span className="text-xs text-white block truncate">Custom Uploaded Hairstyle</span>
                      <span className="text-[10px] text-amber-400 font-mono">Reference Style Image</span>
                    </div>
                    <button
                      onClick={() => {
                        setHairReferenceFile(null);
                        setHairReferencePreview(null);
                      }}
                      className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Closet Hair Items */}
                <div className="grid grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
                  {closetItems.filter((i) => i.category === "hair" || i.category === "headwear").map((item) => {
                    const isSelected = selectedHairItem?.id === item.id && !hairReferenceFile;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedHairItem(item);
                          setHairReferenceFile(null);
                          setHairReferencePreview(null);
                        }}
                        className={`p-2 rounded-2xl border text-center transition-all flex flex-col items-center relative ${
                          isSelected
                            ? "bg-amber-500/15 border-amber-400 shadow-md shadow-amber-500/20"
                            : "bg-neutral-800/40 border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" />
                        )}
                        <div className="w-12 h-12 flex items-center justify-center mb-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`${apiBase}${item.thumbnail_url}`}
                            alt={item.title}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <span className="text-[10px] text-white truncate w-full">{item.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* Clothing Category Selector & Closet Item Picker */
            <>
              <div className="p-4 rounded-3xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm space-y-3">
                <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Garment Category</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "upper", label: "Tops / Upper" },
                      { id: "lower", label: "Pants / Lower" },
                      { id: "dress", label: "Full Dress" }
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        category === cat.id
                          ? "bg-cyan-500/15 border-cyan-400 text-cyan-300 font-semibold"
                          : "bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:bg-neutral-800"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-3xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Select Garment</h3>
                  <Link href="/closet" className="text-[11px] text-cyan-400 hover:underline">
                    Manage Closet
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-2.5 max-h-60 overflow-y-auto p-1">
                  {closetItems.filter((i) => i.category !== "hair").map((item) => {
                    const isSelected = selectedGarment?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedGarment(item);
                          if (["upper", "lower", "dress"].includes(item.category)) {
                            setCategory(item.category as any);
                          }
                        }}
                        className={`p-2 rounded-2xl border text-center transition-all flex flex-col items-center relative ${
                          isSelected
                            ? "bg-cyan-500/15 border-cyan-400 shadow-md shadow-cyan-500/20"
                            : "bg-neutral-800/40 border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400" />
                        )}
                        <div className="w-12 h-12 flex items-center justify-center mb-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`${apiBase}${item.thumbnail_url}`}
                            alt={item.title}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <span className="text-[10px] text-white truncate w-full">{item.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Execution Button */}
          <button
            onClick={handleStartTryon}
            disabled={
              isProcessing ||
              !personFile ||
              (tryonMode === "clothing" ? !selectedGarment : (!hairReferenceFile && !selectedHairItem))
            }
            className={`w-full py-4 rounded-2xl font-bold text-sm transition-all shadow-xl flex items-center justify-center gap-2 ${
              tryonMode === "hairstyle"
                ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-neutral-950 shadow-amber-500/20"
                : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-neutral-950 shadow-cyan-500/20"
            } disabled:opacity-40`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running Inference...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  {tryonMode === "hairstyle"
                    ? `Transfer Hairstyle (${hairstyleBackend})`
                    : "Generate Photo Try-On"}
                </span>
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
