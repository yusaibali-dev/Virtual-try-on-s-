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
  Maximize2
} from "lucide-react";

interface ClosetItem {
  id: string;
  title: string;
  category: string;
  image_url: string;
  thumbnail_url: string;
}

export default function PhotoTryonPage() {
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [selectedGarment, setSelectedGarment] = useState<ClosetItem | null>(null);
  const [category, setCategory] = useState<"upper" | "lower" | "dress">("upper");

  // Person photo
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);

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

  const apiBase = typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000`
    : "http://localhost:8000";

  // Load user closet items
  useEffect(() => {
    async function loadCloset() {
      try {
        const res = await fetch(`${apiBase}/api/items`);
        if (res.ok) {
          const data = await res.json();
          setClosetItems(data);
          if (data.length > 0) {
            setSelectedGarment(data[0]);
            if (["upper", "lower", "dress"].includes(data[0].category)) {
              setCategory(data[0].category as any);
            }
          }
        }
      } catch (e) {
        console.warn("Could not load closet items:", e);
      }
    }
    loadCloset();
  }, [apiBase]);

  // Handle Person Photo Selection
  const handlePersonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPersonFile(file);
      setPersonPreview(URL.createObjectURL(file));
      setResultUrl(null);
    }
  };

  // Submit Photo Try-On Job
  const handleStartTryon = async () => {
    if (!personFile) {
      setErrorMsg("Please upload a person photo first.");
      return;
    }
    if (!selectedGarment) {
      setErrorMsg("Please select a clothing item from your closet.");
      return;
    }

    setErrorMsg(null);
    setIsProcessing(true);
    setProgressPercent(5);
    setProgressMessage("Submitting job to GPU queue...");
    setResultUrl(null);

    try {
      const formData = new FormData();
      formData.append("person_photo", personFile);
      formData.append("closet_item_id", selectedGarment.id);
      formData.append("category", category);

      const res = await fetch(`${apiBase}/api/tryon/photo`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to start try-on job.");
      }

      const jobData = await res.json();
      const currentJobId = jobData.job_id;
      setJobId(currentJobId);

      // Connect to Server-Sent Events (SSE) Stream for real-time progress
      const eventSource = new EventSource(`${apiBase}/api/jobs/${currentJobId}/stream`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.percent !== undefined) setProgressPercent(data.percent);
          if (data.message) setProgressMessage(data.message);

          if (data.status === "completed") {
            setIsProcessing(false);
            setResultUrl(`${apiBase}${data.result_url}`);
            eventSource.close();
          } else if (data.status === "failed") {
            setIsProcessing(false);
            setErrorMsg(data.message || "Try-on pipeline failed.");
            eventSource.close();
          } else if (data.status === "cancelled") {
            setIsProcessing(false);
            setProgressMessage("Job cancelled.");
            eventSource.close();
          }
        } catch (err) {
          console.warn("SSE parse error:", err);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
      };
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMsg(err.message || "An error occurred");
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
                <h1 className="font-semibold text-sm sm:text-base leading-none">CatVTON Photo Try-On</h1>
                <p className="text-[11px] text-cyan-400 mt-0.5">Diffusion High-Resolution Neural Fitting</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
                  AFTER (CatVTON)
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
                  Upload a clear portrait or full-body photo to try on clothes with CatVTON.
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
                <h3 className="text-base font-semibold text-white mb-1">Neural Diffusion Inpainting</h3>
                <p className="text-xs text-neutral-300 max-w-sm mb-5">{progressMessage}</p>

                {/* Progress Bar */}
                <div className="w-full max-w-xs bg-neutral-800 rounded-full h-2 mb-2 overflow-hidden border border-neutral-700">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
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
                download="CatVTON-Result.png"
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

          {/* Clothing Category Selector */}
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

          {/* Closet Item Picker */}
          <div className="p-4 rounded-3xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Select Closet Item</h3>
              <Link href="/closet" className="text-[11px] text-cyan-400 hover:underline">
                Manage Closet
              </Link>
            </div>

            {closetItems.length === 0 ? (
              <div className="p-6 rounded-2xl bg-neutral-950/60 border border-neutral-800 text-center my-auto">
                <Shirt className="w-6 h-6 text-neutral-500 mx-auto mb-2" />
                <p className="text-xs text-neutral-400 mb-3">No items found in closet.</p>
                <Link
                  href="/closet"
                  className="px-3 py-1.5 rounded-xl bg-cyan-500 text-neutral-950 font-semibold text-xs inline-block"
                >
                  Add Clothing
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 max-h-60 overflow-y-auto p-1">
                {closetItems.map((item) => {
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
            )}
          </div>

          {/* Execution Button */}
          <button
            onClick={handleStartTryon}
            disabled={isProcessing || !personFile || !selectedGarment}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-neutral-950 font-bold text-sm transition-all shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running Try-On...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Photo Try-On</span>
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
