import React from "react";
import Link from "next/link";
import {
  Camera,
  Sparkles,
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Smartphone,
  Eye,
  Activity
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col selection:bg-cyan-500/30">
      {/* Header */}
      <header className="border-b border-neutral-800/80 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white">VTON Studio</span>
              <span className="text-[10px] text-cyan-400 block font-mono font-medium">Virtual Try-On Suite</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/studio"
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-semibold text-xs transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-1.5"
            >
              <Camera className="w-4 h-4" />
              <span>Open Studio</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-medium mb-6 animate-pulse">
          <Zap className="w-3.5 h-3.5" />
          <span>Milestone 1 Ready: Live On-Device Vision & Camera Pipeline</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-3xl leading-tight sm:leading-tight">
          Next-Gen AI Virtual Try-On & Landmark Tracking
        </h1>

        <p className="mt-5 text-base sm:text-lg text-neutral-400 max-w-2xl leading-relaxed">
          High-performance on-device computer vision powered by MediaPipe Vision, designed for zero latency mobile camera tracking, body fitting, and VTON diffusion pipelines.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link
            href="/studio"
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm transition-all shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" />
            <span>Launch Camera Studio</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 font-medium text-sm transition-all flex items-center justify-center gap-2"
          >
            <span>Documentation & Setup</span>
          </a>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-16 sm:mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          {/* Card 1 */}
          <div className="p-6 rounded-3xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm relative overflow-hidden group hover:border-neutral-700 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4">
              <Eye className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Triple Landmarker Tracking</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Concurrent Face Mesh (468 points), Pose estimation (33 joints), and Dual Hands (42 points) tracking directly in the browser.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-3xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm relative overflow-hidden group hover:border-neutral-700 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Mobile First & 20+ FPS</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Front/back lens switching, horizontal mirror toggling, and GPU delegation delivering smooth real-time tracking on phone cameras.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-3xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm relative overflow-hidden group hover:border-neutral-700 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">VTON Ready Architecture</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Scaffolded monorepo prepared for CatVTON and HairFastGAN diffusion pipeline on an RTX 3070 with 8 GB VRAM.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800/60 py-6 text-center text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Virtual Try-On Web App · Milestone 1: Scaffold & Camera</span>
          <div className="flex items-center gap-4 text-neutral-400">
            <Link href="/studio" className="hover:text-cyan-400 transition-colors">Studio</Link>
            <span>·</span>
            <span>FastAPI Backend (:8000)</span>
            <span>·</span>
            <span>Next.js Frontend (:3000)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
