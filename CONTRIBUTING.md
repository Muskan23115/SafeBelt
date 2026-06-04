# Contributing to SafeBelt

Thanks for your interest in contributing! SafeBelt is an open-source seatbelt compliance monitoring system built with OpenCV, YOLOv8, AprilTag detection, FastAPI, and React.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Commit Convention](#commit-convention)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Reporting Issues](#reporting-issues)

---

## Getting Started

1. **Fork** this repository
2. **Clone** your fork
   ```bash
   git clone https://github.com/<your-username>/SafeBelt.git
   cd SafeBelt
   ```
3. **Create a branch** for your change
   ```bash
   git checkout -b feat/your-feature-name
   ```

---

## Project Structure

```
SafeBelt/
├── backend/
│   ├── main.py          # FastAPI app, routes, seed data
│   ├── detector.py      # OpenCV + YOLOv8 + AprilTag pipeline
│   ├── ocr.py           # EasyOCR plate recognition (lazy-loaded)
│   ├── models.py        # SQLAlchemy models
│   └── database.py      # DB engine + session
├── frontend/
│   └── src/
│       ├── pages/       # LiveMonitor, ViolationsLog, Stats
│       └── components/  # NavBar, ViolationRow, StatCard, StreamView
└── CONTRIBUTING.md
```

---

## Development Setup

### Backend

```bash
# From project root
pip install fastapi uvicorn opencv-python ultralytics easyocr sqlalchemy python-multipart pupil-apriltags
python -m uvicorn backend.main:app --port 8000
```

> On first run, YOLOv8 (~6MB) auto-downloads. EasyOCR (~100MB) loads lazily on first violation.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` and proxies `/api` and `/stream` to `http://127.0.0.1:8000`.

### Camera

- Default: `cv2.VideoCapture(0)` (your webcam)
- Override: set `CAMERA_SOURCE=demo.mp4` env var to use the synthetic demo clip
- On Windows, avoid `--reload` flag with uvicorn — it opens the camera twice and corrupts the stream

---

## Making Changes

- **Backend changes** — edit files in `backend/`, restart uvicorn
- **Frontend changes** — Vite hot-reloads automatically
- **New DB fields** — update `models.py` and delete `safebelt.db` to re-migrate on next run
- **Design changes** — follow the ElevenLabs-inspired design system: off-white canvas `#f5f5f5`, ink `#292524`, pill buttons, 16px card radius, Inter + EB Garamond fonts

---

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <short description>
```

| Type | Use for |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no logic change |
| `refactor` | Code restructure, no feature/fix |
| `perf` | Performance improvement |
| `chore` | Build, deps, config |

**Examples**
```
feat(detector): add multi-lane vehicle tracking
fix(stats): prevent negative compliance rate when violations exceed scanned count
docs(contributing): add Windows camera setup note
chore(deps): pin easyocr to 1.7.1
```

---

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Reference the issue your PR addresses: `Closes #12`
- Include a short description of what changed and why
- If touching the CV pipeline, note whether you tested with a real camera or the synthetic demo
- Screenshots or screen recordings are welcome for UI changes

### PR Title Format
Follow the same Conventional Commits format:
```
fix(ocr): lazy-load EasyOCR only on first violation
```

---

## Reporting Issues

When filing a bug, please include:

- OS and Python version
- Whether you're using a real camera or `CAMERA_SOURCE=demo.mp4`
- The full traceback from the uvicorn terminal
- Browser console errors if it's a frontend issue

---

## Code of Conduct

Be respectful. This project welcomes contributors of all experience levels.