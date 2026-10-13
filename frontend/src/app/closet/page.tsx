"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  Shirt,
  Plus,
  Trash2,
  Heart,
  ExternalLink,
  Camera,
  Upload,
  Globe,
  Link2,
  AlertCircle,
  CheckCircle2,
  Filter,
  Eye,
  ShieldAlert,
  Loader2,
  X
} from "lucide-react";

export interface ClosetItem {
  id: string;
  title: string;
  category: "upper" | "lower" | "dress" | "earring" | "necklace" | "ring" | "bracelet" | "hair";
  image_filename: string;
  thumbnail_filename: string;
  image_url: string;
  thumbnail_url: string;
  original_url?: string;
  source_type: "upload" | "image_url" | "product_url";
  is_favourite: boolean;
  created_at?: string;
}

const CATEGORIES = [
  { id: "all", label: "All Items" },
  { id: "upper", label: "Tops & Upper" },
  { id: "lower", label: "Pants & Skirts" },
  { id: "dress", label: "Dresses" },
  { id: "earring", label: "Earrings" },
  { id: "necklace", label: "Necklaces" },
  { id: "ring", label: "Rings" },
  { id: "bracelet", label: "Bracelets" },
  { id: "hair", label: "Hair & Wigs" },
];

export default function ClosetPage() {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [filterFavourites, setFilterFavourites] = useState(false);

  // Dialog State
  const [showAddModal, setShowAddModal] = useState(false);
  const [importType, setImportType] = useState<"image_url" | "product_url" | "upload">("image_url");
  const [urlInput, setUrlInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [categoryOverride, setCategoryOverride] = useState("");
  const [fileInput, setFileInput] = useState<File | null>(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Single-origin relative API base
  const apiBase = "";

  // Fetch Items from Backend
  const fetchItems = async () => {
    try {
      setLoading(true);
      let url = `${apiBase}/api/items`;
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (filterFavourites) params.append("favourites", "true");
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.warn("Could not fetch items from backend:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [selectedCategory, filterFavourites]);

  // Handle URL or File Submit
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      let createdItem: ClosetItem;

      if (importType === "upload") {
        if (!fileInput) throw new Error("Please select an image file to upload.");
        const formData = new FormData();
        formData.append("file", fileInput);
        if (titleInput) formData.append("title", titleInput);
        if (categoryOverride) formData.append("category", categoryOverride);

        const res = await fetch(`${apiBase}/api/items/upload`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Upload failed");
        createdItem = data;
      } else {
        if (!urlInput.trim()) throw new Error("Please enter a valid URL.");
        const res = await fetch(`${apiBase}/api/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: urlInput.trim(),
            type: importType,
            title: titleInput.trim() || undefined,
            category: categoryOverride || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Import failed");
        createdItem = data;
      }

      setSuccessMsg(`"${createdItem.title}" processed with background removal and saved to closet!`);
      setShowAddModal(false);
      setUrlInput("");
      setTitleInput("");
      setCategoryOverride("");
      setFileInput(null);
      fetchItems();
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Favourite
  const handleToggleFavourite = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/api/items/${id}/favourite`, { method: "PATCH" });
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, is_favourite: !item.is_favourite } : item))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Item
  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to remove this item from your closet?")) return;
    try {
      const res = await fetch(`${apiBase}/api/items/${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col selection:bg-cyan-500/30">
      {/* Header */}
      <header className="border-b border-neutral-800/80 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-300 hover:text-white transition-all text-xs font-medium"
            >
              Home
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Shirt className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-sm sm:text-base leading-none">AI Closet</h1>
                <p className="text-[11px] text-cyan-400 mt-0.5">Your Virtual Wardrobe & Cutouts</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/studio"
              className="px-3 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              <span>Live Studio</span>
            </Link>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Status Alerts */}
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-2xl text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filters and Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? "bg-cyan-500 text-neutral-950 font-semibold shadow-md shadow-cyan-500/20"
                    : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Favourites Filter */}
          <button
            onClick={() => setFilterFavourites(!filterFavourites)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all shrink-0 ${
              filterFavourites
                ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${filterFavourites ? "fill-rose-400 text-rose-400" : ""}`} />
            <span>Favourites Only</span>
          </button>
        </div>

        {/* Closet Grid */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
            <span className="text-xs text-neutral-400">Loading your closet...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 rounded-3xl bg-neutral-900/40 border border-neutral-800/80 text-center min-h-[350px]">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3">
              <Shirt className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Your Closet is Empty</h3>
            <p className="text-xs text-neutral-400 max-w-sm mb-5 leading-relaxed">
              Add clothing, jewelry, or hairstyles by pasting any online product image URL, product page link, or uploading a photo.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-semibold text-xs transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Your First Item
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="group rounded-2xl bg-neutral-900/60 border border-neutral-800/80 hover:border-neutral-700 transition-all overflow-hidden flex flex-col"
              >
                {/* Image Preview with checkered background for alpha cutout visibility */}
                <div
                  className="aspect-square relative w-full flex items-center justify-center p-3 overflow-hidden"
                  style={{
                    backgroundImage:
                      "radial-gradient(#262626 15%, transparent 16%), radial-gradient(#262626 15%, transparent 16%)",
                    backgroundSize: "16px 16px",
                    backgroundPosition: "0 0, 8px 8px",
                    backgroundColor: "#121212",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${apiBase}${item.image_url}`}
                    alt={item.title}
                    className="max-h-full max-w-full object-contain filter drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Category Pill */}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-mono text-cyan-300 border border-white/10 uppercase">
                    {item.category}
                  </span>

                  {/* Favourite Button */}
                  <button
                    onClick={() => handleToggleFavourite(item.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-neutral-400 hover:text-rose-400 transition-colors"
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${item.is_favourite ? "fill-rose-400 text-rose-400" : ""}`}
                    />
                  </button>
                </div>

                {/* Details Footer */}
                <div className="p-3 flex-1 flex flex-col justify-between border-t border-neutral-800/60 bg-neutral-900/40">
                  <div>
                    <h4 className="text-xs font-semibold text-white truncate" title={item.title}>
                      {item.title}
                    </h4>
                    <span className="text-[10px] text-neutral-400 capitalize block mt-0.5">
                      Source: {item.source_type.replace("_", " ")}
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-neutral-800/40 flex items-center justify-between">
                    <Link
                      href="/studio"
                      className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <span>Try On</span>
                    </Link>

                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-neutral-500 hover:text-rose-400 transition-colors p-1"
                      title="Delete item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Visible Copyright & Fair-Use Notice Banner */}
        <section className="mt-8 p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 text-neutral-400 text-xs">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-semibold text-neutral-200">Copyright, Intellectual Property & Terms of Use Notice</h4>
              <p className="leading-relaxed text-[11px]">
                Items imported from external URLs or product pages are processed solely for on-device personal virtual
                fitting simulation under fair use. All product names, designs, logos, and trademarks remain the property
                of their respective copyright and brand holders. Our automated web fetcher strictly obeys{" "}
                <code className="text-cyan-400">robots.txt</code> protocols, blocks private intranet endpoints (SSRF
                protection), and does not republish or redistribute third-party commercial catalog assets.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <h3 className="font-semibold text-sm text-white">Add Item to Closet</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Source Type Selector */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setImportType("image_url")}
                  className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                    importType === "image_url"
                      ? "bg-cyan-500/15 border-cyan-400 text-cyan-300"
                      : "bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:bg-neutral-800"
                  }`}
                >
                  <Link2 className="w-4 h-4" />
                  <span>Image URL</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportType("product_url")}
                  className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                    importType === "product_url"
                      ? "bg-cyan-500/15 border-cyan-400 text-cyan-300"
                      : "bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:bg-neutral-800"
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <span>Product Page</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportType("upload")}
                  className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                    importType === "upload"
                      ? "bg-cyan-500/15 border-cyan-400 text-cyan-300"
                      : "bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:bg-neutral-800"
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload File</span>
                </button>
              </div>

              {/* URL Input */}
              {importType !== "upload" ? (
                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1">
                    {importType === "product_url" ? "Product Web Page URL" : "Direct Image URL"}
                  </label>
                  <input
                    type="url"
                    required
                    placeholder={
                      importType === "product_url"
                        ? "https://www.example.com/products/blue-summer-dress"
                        : "https://example.com/clothing-item.png"
                    }
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                  <span className="text-[10px] text-neutral-500 mt-1 block">
                    {importType === "product_url"
                      ? "Extracts og:image & title, obeys robots.txt, protected against SSRF"
                      : "Max 10 MB, png/jpg/webp, background automatically cut out"}
                  </span>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1">Select Local Image File</label>
                  <input
                    type="file"
                    required
                    accept="image/*"
                    onChange={(e) => setFileInput(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:text-neutral-950 file:font-semibold file:text-xs"
                  />
                </div>
              )}

              {/* Optional Title Input */}
              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">Item Title (Optional)</label>
                <input
                  type="text"
                  placeholder="Auto-detected if left empty"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Manual Category Override */}
              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">
                  Category (Auto-Detected or Manual Override)
                </label>
                <select
                  value={categoryOverride}
                  onChange={(e) => setCategoryOverride(e.target.value)}
                  className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="">Auto-Detect Category</option>
                  <option value="upper">Tops & Upper Body</option>
                  <option value="lower">Pants & Skirts</option>
                  <option value="dress">Dresses</option>
                  <option value="earring">Earrings</option>
                  <option value="necklace">Necklace</option>
                  <option value="ring">Rings</option>
                  <option value="bracelet">Bracelets</option>
                  <option value="hair">Hair & Wigs</option>
                </select>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-800 text-xs font-medium text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-semibold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing Cutout...</span>
                    </>
                  ) : (
                    <span>Add to Closet</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
