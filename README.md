# SafeBelt 🛡️

> Real-time seatbelt compliance monitoring — YOLOv8 · AprilTag · EasyOCR · FastAPI · React

---

## Quick Start

### 1 — Backend

```powershell
# From project root
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Run (auto-creates safebelt.db + seeds 10 mock violations)
uvicorn backend.main:app --reload --port 8000
```

**Environment variables** (optional):

| Variable        | Default                    | Description                        |
|-----------------|----------------------------|------------------------------------|
| `CAMERA_SOURCE` | `0`                        | Camera index or file path          |
| `LOCATION_NAME` | `Highway 1, Junction 12`   | Location tag on violations         |
| `BASE_LAT`      | `28.6139`                  | Base latitude for GPS mock         |
| `BASE_LON`      | `77.2090`                  | Base longitude for GPS mock        |
| `DATABASE_URL`  | `sqlite:///./safebelt.db`  | SQLAlchemy DB connection string    |

### 2 — Frontend

```powershell
cd frontend
npm install   # if not already done
npm run dev   # http://localhost:5173
```

---

## Pages

| Route          | Page            | Description                                       |
|----------------|-----------------|---------------------------------------------------|
| `/`            | Live Monitor    | MJPEG stream + real-time compliance counts        |
| `/violations`  | Violations Log  | Filterable table of all logged violations         |
| `/stats`       | Statistics      | Cards (scanned / violations / rate) + hourly chart |

---

## API Reference

| Method | Endpoint              | Description                          |
|--------|-----------------------|--------------------------------------|
| GET    | `/api/stream`         | MJPEG video stream                   |
| GET    | `/api/violations`     | Paginated violations (`page`, `date`, `location`) |
| GET    | `/api/stats`          | Aggregate stats + violations/hour    |
| GET    | `/api/ocr_status`     | EasyOCR ready status                 |

---

## Detection Pipeline

```
Camera / demo.mp4 / Synthetic Scene
        │
        ▼
   OpenCV frame read
        │
        ▼
  YOLOv8n → vehicle/person bounding boxes
        │
        ▼
  pupil-apriltags → scan ROI for tag36h11
        │
     ┌──┴──────────────────┐
 Tag found              No tag found
 (COMPLIANT ✓)          (VIOLATION ✗)
                              │
                         EasyOCR → plate
                              │
                         Save to SQLite
```

### Synthetic Demo Mode
When no camera or `demo.mp4` is found, the system auto-generates a procedural road scene with moving vehicles. Compliant vehicles display an AprilTag icon in green; violations show the plate number in red.

---

## Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Backend   | Python 3.11+, FastAPI, SQLAlchemy       |
| Database  | SQLite (swappable via `DATABASE_URL`)   |
| CV        | OpenCV, YOLOv8 (Ultralytics), pupil-apriltags |
| OCR       | EasyOCR (lazy-loaded, non-blocking)     |
| Frontend  | React 18, Vite 5, Tailwind CSS 3        |
| Charts    | Recharts                                |

---

## Folder Structure

```
seatbelt_monitoring/
├── backend/
│   ├── __init__.py
│   ├── database.py      # SQLAlchemy engine + session
│   ├── models.py        # Violation ORM model
│   ├── ocr.py           # Lazy EasyOCR wrapper
│   ├── detector.py      # CV pipeline + synthetic scene
│   └── main.py          # FastAPI app + endpoints
├── frontend/
│   ├── src/
│   │   ├── components/  # NavBar, StreamView, ViolationRow, StatCard
│   │   ├── pages/       # LiveMonitor, ViolationsLog, Stats
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── tailwind.config.js
│   └── vite.config.js
├── requirements.txt
└── README.md
```
