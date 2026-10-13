# Virtual Try-On Test Fixtures (Inputs)

This directory holds the 5 input images used to construct the **6 fixed test pairs** for benchmarking clothes try-on pipelines (3 People × 2 Garments).

> [!NOTE]
> All files in this folder (except this `README.md`) are strictly `.gitignore`d to protect privacy. Real faces, user photos, and third-party garment images are never committed to version control.

## Required Files

Please place your test images directly into this folder using the filenames below (supported extensions: `.jpg`, `.jpeg`, `.png`, `.webp`):

### 1. Person Photos (3 slots)
- `person_1.jpg` (or `.png` / `.webp`): Person A (standing portrait, front-facing)
- `person_2.jpg` (or `.png` / `.webp`): Person B (female full-body / 3/4 standing view)
- `person_3.jpg` (or `.png` / `.webp`): Person C (relaxed pose / alternative framing)

### 2. Garment Photos (2 slots)
- `garment_flatlay.png` (or `.jpg` / `.webp`): Garment 1 — Flat-lay product cutout from closet (e.g. top / shirt on white or transparent background)
- `garment_model.jpg` (or `.png` / `.webp`): Garment 2 — Garment worn by an e-commerce model

---

## 6 Fixed Evaluation Pairs
The benchmark will systematically evaluate:
1. `Pair 1`: `person_1` + `garment_flatlay`
2. `Pair 2`: `person_1` + `garment_model`
3. `Pair 3`: `person_2` + `garment_flatlay`
4. `Pair 4`: `person_2` + `garment_model`
5. `Pair 5`: `person_3` + `garment_flatlay`
6. `Pair 6`: `person_3` + `garment_model`
