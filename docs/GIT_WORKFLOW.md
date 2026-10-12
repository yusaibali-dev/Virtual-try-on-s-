# Git Workflow Guidelines

## 1. Branch Strategy
- `main`: Production-ready branch. Always kept in a working, deployable state.
- Feature / Milestone branches: Branch off `main` for substantial features (e.g. `feature/milestone-X-name`). Merge via pull request or squash-merge after validation.

---

## 2. Commit Message Standards
Use Conventional Commits:
- `feat:` New features or enhancements (e.g. `feat: add live jewelry try-on with One-Euro filter`)
- `fix:` Bug fixes (e.g. `fix: prevent SSRF on local IP ranges in URL importer`)
- `chore:` Maintenance, dependency updates, tooling, repo hygiene (e.g. `chore: initial scaffold`, `chore: update .gitignore`)
- `docs:` Documentation updates (e.g. `docs: update PROGRESS.md for milestone 3`)
- `test:` Adding or updating tests (e.g. `test: add SSRF and URL validation tests`)
- `refactor:` Code refactoring without behavior change

---

## 3. Pre-Commit Checklist & Secret Protection
Before staging and committing changes:
1. **No Credentials or Secrets**:
   - Never commit `.env`, `.env.local`, API keys, private tokens, certificates (`.pem`, `.key`), or database credentials.
   - Run `git grep -nEi "(api[_-]?key|secret|token|password)"` on staged files.
2. **Exclude Build & Machine Artifacts**:
   - Keep `node_modules/`, `.next/`, `__pycache__/`, `*.pyc`, `dist/`, and local caches strictly ignored.
3. **Exclude Large AI Weights & Model Checkpoints**:
   - Never track model weights (`*.safetensors`, `*.ckpt`, `*.pth`, `*.onnx`, `weights/`, `models_cache/`).
4. **Exclude Local User Data**:
   - Never commit local database files (`*.db`, `*.sqlite`), uploaded user files, or captured photos.
5. **Run Tests & Verify Build**:
   - Backend: `python -m pytest` passes 100%.
   - Frontend: `npm run build` completes with 0 type or lint errors.

---

## 4. Remote & Upstream Tracking
- Primary remote: `origin` pointing to the GitHub repository.
- Ensure branch tracking is set:
  ```bash
  git push -u origin main
  ```
- Check status and sync regularly:
  ```bash
  git status
  git log --oneline -n 5
  ```
