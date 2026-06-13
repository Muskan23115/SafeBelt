"""
SafeBelt AI — FastAPI backend
Endpoints:
  GET  /api/stream                MJPEG live stream
  GET  /api/violations            Paginated, filterable violation log
  POST /api/violations/manual     Log a manually-entered plate + vehicle lookup
  GET  /api/stats                 Aggregate stats + violations/hour histogram
  GET  /api/ocr_status            EasyOCR load state {ready, loading}
"""
import asyncio
import base64
import logging
import os
import random
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import Violation
from . import ocr as _ocr
from .detector import SeatbeltDetector, _rand_rj_plate
from . import vehicle_lookup as _vl

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── DB init ───────────────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="SafeBelt AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Config ────────────────────────────────────────────────────────────────────
LOCATION_NAME = os.environ.get("LOCATION_NAME", "Jaipur, RJ")
BASE_LAT      = float(os.environ.get("BASE_LAT",  "26.9124"))   # Jaipur
BASE_LON      = float(os.environ.get("BASE_LON",  "75.7873"))   # Jaipur
GPS_JITTER    = 0.002   # ±0.002° (~200 m) per record

# ── Detector singleton ────────────────────────────────────────────────────────
detector = SeatbeltDetector()


# ── Violation callback (called from detector thread) ─────────────────────────
def _on_violation(plate: str, thumbnail_jpg: Optional[bytes]):
    """Write violation to DB. Triggers EasyOCR load on first call."""
    # Trigger lazy OCR load (no-op if already loading/loaded)
    _ocr.ensure_loaded()

    # Call vehicle lookup API (returns VehicleInfo with None fields on error)
    vehicle = _vl.lookup(plate)

    from .database import SessionLocal
    db = SessionLocal()
    try:
        thumb_b64 = base64.b64encode(thumbnail_jpg).decode() if thumbnail_jpg else None
        v = Violation(
            plate              = plate,
            timestamp          = datetime.utcnow(),
            location           = LOCATION_NAME,
            lat                = BASE_LAT + random.uniform(-GPS_JITTER, GPS_JITTER),
            lon                = BASE_LON + random.uniform(-GPS_JITTER, GPS_JITTER),
            thumbnail_b64      = thumb_b64,
            vehicle_make_model = vehicle.make_model,
            vehicle_color      = vehicle.color,
            fuel_type          = vehicle.fuel_type,
            owner_name         = vehicle.owner_name,
            insurance_status   = vehicle.insurance_status,
            puc_status         = vehicle.puc_status,
        )
        db.add(v)
        db.commit()
    except Exception as exc:
        logger.error("DB write error: %s", exc)
        db.rollback()
    finally:
        db.close()


detector.add_violation_callback(_on_violation)


# ── Seed mock data ────────────────────────────────────────────────────────────
_SEED_LOCATIONS = [
    "Jaipur, RJ — NH-48",
    "Jaipur, RJ — Tonk Road",
    "Jaipur, RJ — Ajmer Road",
    "Jaipur, RJ — Sirsi Road",
    "Jaipur, RJ — Ring Road",
]


def _seed_mock_violations():
    from .database import SessionLocal
    db = SessionLocal()
    try:
        if db.query(Violation).count() > 0:
            return

        logger.info("Seeding 10 mock violations (RJ format)…")
        rng = random.Random(2024)   # fixed seed for reproducible demo data

        for i in range(10):
            hours_ago = rng.uniform(0.5, 23.5)
            ts        = datetime.utcnow() - timedelta(hours=hours_ago)
            db.add(Violation(
                plate         = _rand_rj_plate(),
                timestamp     = ts,
                location      = rng.choice(_SEED_LOCATIONS),
                lat           = BASE_LAT + rng.uniform(-GPS_JITTER, GPS_JITTER),
                lon           = BASE_LON + rng.uniform(-GPS_JITTER, GPS_JITTER),
                thumbnail_b64 = None,
                frame_id      = i,
            ))
        db.commit()
        logger.info("Mock data seeded.")
    except Exception as exc:
        logger.error("Seed error: %s", exc)
        db.rollback()
    finally:
        db.close()


# ── Startup / shutdown ────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    _seed_mock_violations()
    # NOTE: EasyOCR is NOT loaded here — it loads lazily on first violation.
    detector.start()
    logger.info("SafeBelt AI backend ready at http://localhost:8000")


@app.on_event("shutdown")
async def shutdown():
    detector.stop()


# ── MJPEG stream ──────────────────────────────────────────────────────────────
async def _mjpeg_generator():
    boundary = b"--frame\r\n"
    header   = b"Content-Type: image/jpeg\r\n\r\n"
    while True:
        frame, _ = detector.get_latest()
        if frame is not None:
            jpg = detector.encode_frame_jpeg(frame)
            yield boundary + header + jpg + b"\r\n"
        await asyncio.sleep(0.04)   # ~25 fps to clients


@app.get("/api/stream")
async def stream():
    return StreamingResponse(
        _mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache, no-store"},
    )


# ── Violations ────────────────────────────────────────────────────────────────
@app.get("/api/violations")
def get_violations(
    page:      int            = Query(1,  ge=1),
    page_size: int            = Query(20, ge=1, le=100),
    date:      Optional[str]  = Query(None, description="YYYY-MM-DD"),
    location:  Optional[str]  = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Violation)
    if date:
        try:
            d = datetime.strptime(date, "%Y-%m-%d")
            q = q.filter(Violation.timestamp >= d,
                         Violation.timestamp <  d + timedelta(days=1))
        except ValueError:
            pass
    if location:
        q = q.filter(Violation.location.ilike(f"%{location}%"))

    total = q.count()
    rows  = (q.order_by(Violation.timestamp.desc())
              .offset((page - 1) * page_size)
              .limit(page_size)
              .all())

    return {
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "items": [
            {
                "id":                v.id,
                "plate":             v.plate,
                "timestamp":         v.timestamp.isoformat() + "Z",
                "location":          v.location,
                "lat":               v.lat,
                "lon":               v.lon,
                "thumbnail_b64":     v.thumbnail_b64,
                "vehicle_make_model": v.vehicle_make_model,
                "vehicle_color":     v.vehicle_color,
                "fuel_type":         v.fuel_type,
                "owner_name":        v.owner_name,
                "insurance_status":  v.insurance_status,
                "puc_status":        v.puc_status,
            }
            for v in rows
        ],
    }


# ── Manual plate entry ───────────────────────────────────────────────────────
class ManualPlateRequest(BaseModel):
    plate: str


@app.post("/api/violations/manual")
def log_manual_violation(
    body: ManualPlateRequest,
    db:   Session = Depends(get_db),
):
    """
    Log a violation from a manually-entered plate number.
    Runs vehicle lookup, saves to DB, returns the full violation object.
    """
    plate = body.plate.strip().upper()
    if not plate:
        raise HTTPException(status_code=422, detail="plate must not be empty")

    # Vehicle lookup (gracefully returns empty VehicleInfo on any error)
    vehicle = _vl.lookup(plate)

    from .database import SessionLocal
    db_local = SessionLocal()
    try:
        v = Violation(
            plate              = plate,
            timestamp          = datetime.utcnow(),
            location           = LOCATION_NAME,
            lat                = BASE_LAT + random.uniform(-GPS_JITTER, GPS_JITTER),
            lon                = BASE_LON + random.uniform(-GPS_JITTER, GPS_JITTER),
            thumbnail_b64      = None,
            vehicle_make_model = vehicle.make_model,
            vehicle_color      = vehicle.color,
            fuel_type          = vehicle.fuel_type,
            owner_name         = vehicle.owner_name,
            insurance_status   = vehicle.insurance_status,
            puc_status         = vehicle.puc_status,
        )
        db_local.add(v)
        db_local.commit()
        db_local.refresh(v)
        logger.info("Manual violation logged: %s", plate)
        return {
            "id":                v.id,
            "plate":             v.plate,
            "timestamp":         v.timestamp.isoformat() + "Z",
            "location":          v.location,
            "lat":               v.lat,
            "lon":               v.lon,
            "thumbnail_b64":     v.thumbnail_b64,
            "vehicle_make_model": v.vehicle_make_model,
            "vehicle_color":     v.vehicle_color,
            "fuel_type":         v.fuel_type,
            "owner_name":        v.owner_name,
            "insurance_status":  v.insurance_status,
            "puc_status":        v.puc_status,
        }
    except Exception as exc:
        logger.error("Manual violation DB error: %s", exc)
        db_local.rollback()
        raise HTTPException(status_code=500, detail="Failed to save violation")
    finally:
        db_local.close()


# ── Stats ─────────────────────────────────────────────────────────────────────
@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    total_violations = db.query(Violation).count()
    _, result        = detector.get_latest()
    total_scanned    = max(detector.total_scanned, total_violations)
    compliant_count  = max(0, total_scanned - total_violations)
    compliance_rate  = round((compliant_count / max(total_scanned, 1)) * 100, 1)

    # Violations per hour — last 24 h
    now     = datetime.utcnow()
    buckets: list[dict] = []
    for h in range(23, -1, -1):
        start = now - timedelta(hours=h + 1)
        end   = now - timedelta(hours=h)
        count = db.query(Violation).filter(
            Violation.timestamp >= start,
            Violation.timestamp <  end,
        ).count()
        buckets.append({"hour": end.strftime("%H:00"), "count": count})

    return {
        "vehicles_scanned":   total_scanned,
        "violations":         total_violations,
        "compliance_rate":    compliance_rate,
        "violations_per_hour": buckets,
        "live": {
            "compliant": result.compliant if result else True,
            "plate":     result.plate     if result else None,
        },
        "ocr_ready":   _ocr.is_ready(),
        "ocr_loading": _ocr.is_loading(),
    }


# ── OCR status ────────────────────────────────────────────────────────────────
@app.get("/api/ocr_status")
def ocr_status():
    return {
        "ready":   _ocr.is_ready(),
        "loading": _ocr.is_loading(),
    }
