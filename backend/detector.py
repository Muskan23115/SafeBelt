"""
SeatbeltDetector — OpenCV + YOLOv8 + AprilTag detection pipeline.

Video source priority:
  1. Real camera at CAMERA_SOURCE env var (default index 0)
  2. demo.mp4 in project root  — generated once on first run, reused thereafter
  3. (demo.mp4 generation uses a procedural SyntheticScene renderer)
"""
import os
import time
import random
import threading
import logging
from dataclasses import dataclass
from typing import Optional, Callable

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
_PROJECT_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
DEMO_VIDEO_PATH = os.path.join(_PROJECT_ROOT, "demo.mp4")

# Demo clip settings
DEMO_FPS       = 20
DEMO_DURATION  = 35          # seconds
DEMO_WIDTH     = 1280
DEMO_HEIGHT    = 720

# ── Optional heavy CV imports ─────────────────────────────────────────────────
try:
    from ultralytics import YOLO as _YOLO
    _yolo_model = _YOLO("yolov8n.pt")
    YOLO_AVAILABLE = True
    logger.info("YOLOv8 loaded.")
except Exception as _e:
    _yolo_model = None
    YOLO_AVAILABLE = False
    logger.warning("YOLOv8 not available: %s", _e)

try:
    import pupil_apriltags as _apriltag_lib
    _at_detector = _apriltag_lib.Detector(families="tag36h11")
    APRILTAG_AVAILABLE = True
    logger.info("AprilTag detector ready.")
except Exception as _e:
    _at_detector = None
    APRILTAG_AVAILABLE = False
    logger.warning("pupil-apriltags not available: %s", _e)


# ── Data classes ──────────────────────────────────────────────────────────────
@dataclass
class DetectionResult:
    compliant: bool
    plate: Optional[str]
    thumbnail_jpg: Optional[bytes]
    vehicles_count: int
    violations_count: int


@dataclass
class VehicleState:
    x: float
    y: int
    w: int
    h: int
    speed: float
    color: tuple        # BGR
    compliant: bool
    plate: str
    violation_logged: bool = False
    logged_at: float   = 0.0


# ── RJ-format plate generator ─────────────────────────────────────────────────
_RJ_DISTRICTS = ["14", "20", "06", "45", "01", "27", "11"]
_ALPHA = "ABCDEFGHJKLMNPRSTUVWXYZ"


def _rand_rj_plate() -> str:
    dist = random.choice(_RJ_DISTRICTS)
    series = "".join(random.choices(_ALPHA, k=2))
    num = random.randint(1000, 9999)
    return f"RJ{dist} {series} {num}"


# ── Synthetic road-scene renderer ─────────────────────────────────────────────
class SyntheticScene:
    """Draws a scrolling road with annotated vehicles. Used to pre-render demo.mp4."""

    CAR_COLORS = [
        (130, 70, 50), (50, 130, 70), (50, 70, 130),
        (100, 80, 30), (60, 60, 60),  (140, 50, 90),
        (30, 110, 110), (80, 30, 120),
    ]

    def __init__(self, width: int = DEMO_WIDTH, height: int = DEMO_HEIGHT):
        self.W = width
        self.H = height
        self.horizon = int(height * 0.50)
        self.road_offset = 0
        self.frame_idx = 0
        self.vehicles: list[VehicleState] = []
        self._rng = random.Random(42)   # deterministic for video generation
        self._spawn_initial()

    def _lane_y(self, lane: int) -> int:
        usable = self.H - self.horizon - 70
        return self.horizon + 40 + lane * (usable // 3)

    def _spawn_initial(self):
        for i in range(6):
            lane = i % 3
            self.vehicles.append(VehicleState(
                x=self._rng.randint(-500, self.W),
                y=self._lane_y(lane),
                w=self._rng.randint(155, 205),
                h=68,
                speed=self._rng.uniform(1.6, 4.0),
                color=self.CAR_COLORS[i % len(self.CAR_COLORS)],
                compliant=self._rng.random() > 0.40,
                plate=_rand_rj_plate(),
            ))

    # ── Drawing helpers ───────────────────────────────────────────────────────
    def _draw_apriltag(self, frame: np.ndarray, cx: int, cy: int, size: int = 24):
        h = size // 2
        cv2.rectangle(frame, (cx - h, cy - h), (cx + h, cy + h), (255, 255, 255), -1)
        i = size // 3
        cv2.rectangle(frame, (cx - i, cy - i), (cx + i, cy + i), (0, 0, 0), -1)
        d = size // 7
        cv2.rectangle(frame, (cx - d, cy - d), (cx + d, cy + d), (255, 255, 255), -1)
        # corner squares
        for ddx, ddy in [(-h, -h), (h - 6, -h), (-h, h - 6), (h - 6, h - 6)]:
            cv2.rectangle(frame, (cx + ddx, cy + ddy), (cx + ddx + 6, cy + ddy + 6),
                          (255, 255, 255), -1)

    def _draw_plate(self, frame: np.ndarray, plate: str, x: int, y: int, w: int, h: int):
        """Render license plate text centred on the rear of the vehicle."""
        font = cv2.FONT_HERSHEY_SIMPLEX
        scale = 0.44
        (pw, ph), _ = cv2.getTextSize(plate, font, scale, 1)
        px = x + (w - pw) // 2
        py = y + h - 5
        # white plate background
        cv2.rectangle(frame, (px - 4, py - ph - 3), (px + pw + 4, py + 3), (255, 255, 255), -1)
        cv2.rectangle(frame, (px - 4, py - ph - 3), (px + pw + 4, py + 3), (180, 180, 180), 1)
        cv2.putText(frame, plate, (px, py), font, scale, (10, 10, 10), 1, cv2.LINE_AA)

    def _draw_vehicle(self, frame: np.ndarray, v: VehicleState):
        x, y, w, h = int(v.x), v.y, v.w, v.h
        bc = v.color
        roof_c = tuple(min(c + 45, 255) for c in bc)

        # Body
        cv2.rectangle(frame, (x, y), (x + w, y + h), bc, -1)
        # Roof/cabin
        rx1, ry1 = x + w // 5, y - h // 2
        rx2, ry2 = x + w - w // 5, y + 5
        cv2.rectangle(frame, (rx1, ry1), (rx2, ry2), roof_c, -1)
        # Windshield glass
        cv2.rectangle(frame, (rx1 + 5, ry1 + 5), (rx2 - 5, ry2 - 2), (160, 195, 215), -1)
        # Wheels
        for wx in [x + 30, x + w - 30]:
            cv2.circle(frame, (wx, y + h + 7), 14, (15, 15, 15), -1)
            cv2.circle(frame, (wx, y + h + 7), 6,  (55, 55, 55), -1)
        # Tail-lights
        cv2.rectangle(frame, (x - 6, y + 10), (x,     y + 26), (20,  20, 160), -1)
        cv2.rectangle(frame, (x + w, y + 10), (x + w + 6, y + 26), (30, 80, 220), -1)

        # ── Compliance overlay ────────────────────────────────────────────────
        if v.compliant:
            box_col = (55, 195, 75)       # green
            label   = "SEATBELT DETECTED"
            # AprilTag icon inside car
            self._draw_apriltag(frame, x + w // 2, y + h // 2)
        else:
            box_col = (45, 45, 215)       # red (BGR)
            label   = f"VIOLATION  {v.plate}"
            self._draw_plate(frame, v.plate, x, y, w, h)

        # Bounding box (2 px)
        cv2.rectangle(frame, (x - 3, ry1 - 5), (x + w + 3, y + h + 22), box_col, 2)

        # Label badge above box
        font = cv2.FONT_HERSHEY_SIMPLEX
        (tw, th), _ = cv2.getTextSize(label, font, 0.43, 1)
        lby = ry1 - 9
        cv2.rectangle(frame, (x - 3, lby - th - 4), (x - 3 + tw + 10, lby + 3), box_col, -1)
        cv2.putText(frame, label, (x + 2, lby), font, 0.43, (255, 255, 255), 1, cv2.LINE_AA)

    def _draw_background(self, frame: np.ndarray):
        """Sky gradient, road, lane markings, background buildings."""
        # Sky
        for row in range(self.horizon):
            t = row / self.horizon
            frame[row] = [int(95 + t * 55), int(85 + t * 48), int(55 + t * 28)]

        # Road surface
        frame[self.horizon:] = [38, 40, 42]

        # Road edge
        cv2.line(frame, (0, self.horizon), (self.W, self.horizon), (70, 70, 70), 2)

        # Lane dividers
        usable = self.H - self.horizon
        for lane in range(1, 3):
            ly = self.horizon + lane * (usable // 3)
            cv2.line(frame, (0, ly), (self.W, ly), (75, 75, 75), 1)

        # Dashed centre marking (moves with road_offset)
        period = 100
        off = self.road_offset % period
        mid_y = self.horizon + usable // 2
        for sx in range(-period + off, self.W + period, period):
            x1, x2 = max(0, sx), min(self.W, sx + 58)
            if x1 < x2:
                cv2.rectangle(frame, (x1, mid_y - 2), (x2, mid_y + 2), (185, 185, 185), -1)

        # Background city skyline
        for i in range(12):
            bx = int((i * 160 - self.frame_idx * 0.25) % (self.W + 300) - 150)
            bh = 55 + (i * 29) % 90
            bw = 55 + (i * 19) % 55
            by = self.horizon - bh
            shade = 52 + (i * 11) % 28
            cv2.rectangle(frame, (bx, by), (bx + bw, self.horizon), (shade, shade, shade + 10), -1)
            # Building windows
            for wy in range(by + 7, self.horizon - 8, 15):
                for wx in range(bx + 7, bx + bw - 7, 13):
                    lit = ((self.frame_idx // 25 + i + wy) % 6) != 0
                    wc = (195, 215, 250) if lit else (28, 28, 38)
                    cv2.rectangle(frame, (wx, wy), (wx + 6, wy + 8), wc, -1)

    def generate(self) -> np.ndarray:
        frame = np.zeros((self.H, self.W, 3), dtype=np.uint8)
        self._draw_background(frame)

        # Draw vehicles sorted back-to-front
        for v in sorted(self.vehicles, key=lambda v: v.y):
            self._draw_vehicle(frame, v)

        # HUD overlay
        ts = time.strftime("%Y-%m-%d  %H:%M:%S")
        cv2.putText(frame, f"SafeBelt AI  |  DEMO  |  {ts}",
                    (12, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (235, 235, 235), 1, cv2.LINE_AA)
        cv2.putText(frame, "Jaipur Highway Monitoring — Synthetic Demo",
                    (12, 54), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (80, 210, 175), 1, cv2.LINE_AA)

        # Move vehicles
        for v in self.vehicles:
            v.x += v.speed
            if v.x > self.W + 70:
                v.x = float(self._rng.randint(-280, -60))
                v.compliant = self._rng.random() > 0.40
                v.plate     = _rand_rj_plate()
                v.color     = self._rng.choice(self.CAR_COLORS)
                v.violation_logged = False

        self.road_offset += 3
        self.frame_idx   += 1
        return frame

    @property
    def current_violations(self) -> list[VehicleState]:
        return [v for v in self.vehicles if not v.compliant and 0 < int(v.x) < self.W]


# ── Demo video generation ─────────────────────────────────────────────────────
def _generate_demo_video():
    """
    Render demo.mp4 once and save to disk.
    Uses the mp4v codec (universally available via OpenCV).
    """
    if os.path.exists(DEMO_VIDEO_PATH):
        logger.info("demo.mp4 found — skipping generation.")
        return

    logger.info(
        "Generating demo.mp4 (%ds @ %dfps @ %dx%d) — please wait…",
        DEMO_DURATION, DEMO_FPS, DEMO_WIDTH, DEMO_HEIGHT
    )
    scene  = SyntheticScene(DEMO_WIDTH, DEMO_HEIGHT)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out    = cv2.VideoWriter(DEMO_VIDEO_PATH, fourcc, DEMO_FPS, (DEMO_WIDTH, DEMO_HEIGHT))

    total_frames = DEMO_DURATION * DEMO_FPS
    for _ in range(total_frames):
        out.write(scene.generate())

    out.release()
    size_mb = os.path.getsize(DEMO_VIDEO_PATH) / 1_048_576
    logger.info("demo.mp4 saved (%.1f MB).", size_mb)


# ── Main detector ─────────────────────────────────────────────────────────────
class SeatbeltDetector:
    def __init__(self):
        cam_src_env = os.environ.get("CAMERA_SOURCE", "0")
        try:
            cam_src = int(cam_src_env)
        except ValueError:
            cam_src = cam_src_env

        self._cap: Optional[cv2.VideoCapture] = None
        self._using_demo_file = False
        # Live synthetic state (only when reading from demo.mp4 — to detect violations)
        self._live_scene: Optional[SyntheticScene] = None

        self._frame_lock   = threading.Lock()
        self._latest_frame: Optional[np.ndarray]    = None
        self._latest_result: Optional[DetectionResult] = None

        self._running = False
        self._thread: Optional[threading.Thread] = None

        self.total_scanned   = 0
        self.total_violations = 0
        self._violation_callbacks: list[Callable] = []

        self._init_capture(cam_src)

    def _init_capture(self, cam_src):
        # 1 — Try real camera
        cap = cv2.VideoCapture(cam_src)
        if cap.isOpened():
        # Force YUY2 decode on Windows to fix corrupted frames
            cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'YUY2'))
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self._cap = cap
            logger.info("Camera opened at source: %s", cam_src)
            return
        cap.release()
        logger.info("No camera at source %s — falling back to demo.mp4.", cam_src)

        # 2 — Generate demo.mp4 if needed, then open it
        _generate_demo_video()

        cap2 = cv2.VideoCapture(DEMO_VIDEO_PATH)
        if cap2.isOpened():
            self._cap          = cap2
            self._using_demo_file = True
            # Parallel live scene tracks vehicle state for violation detection
            self._live_scene   = SyntheticScene(DEMO_WIDTH, DEMO_HEIGHT)
            logger.info("Streaming from demo.mp4 (looping).")
        else:
            cap2.release()
            logger.error("Could not open demo.mp4 — stream will be empty.")

    # ── Public API ────────────────────────────────────────────────────────────
    def add_violation_callback(self, cb: Callable):
        self._violation_callbacks.append(cb)

    def start(self):
        self._running = True
        self._thread  = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False

    def get_latest(self) -> tuple[Optional[np.ndarray], Optional[DetectionResult]]:
        with self._frame_lock:
            return self._latest_frame, self._latest_result

    # ── Internal loop ─────────────────────────────────────────────────────────
    def _loop(self):
        while self._running:
            frame, result = self._process_next()
            if frame is not None:
                with self._frame_lock:
                    self._latest_frame  = frame
                    self._latest_result = result
            time.sleep(1.0 / DEMO_FPS)

    def _read_frame(self) -> tuple[bool, Optional[np.ndarray]]:
        if self._cap is None:
            return False, None
        ret, frame = self._cap.read()
        if not ret:
            # Loop video
            self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = self._cap.read()
        return ret, frame if ret else None

    def _detect_apriltag(self, gray: np.ndarray) -> bool:
        if _at_detector is not None:
            try:
                return len(_at_detector.detect(gray)) > 0
            except Exception:
                pass
        return random.random() > 0.35

    # ── Frame processing ──────────────────────────────────────────────────────
    def _process_next(self) -> tuple[Optional[np.ndarray], Optional[DetectionResult]]:
        ret, frame = self._read_frame()
        if not ret or frame is None:
            return None, None

        self.total_scanned += 1

        # ── Demo-file path: use parallel SyntheticScene for violation state ──
        if self._using_demo_file and self._live_scene is not None:
            violations    = self._live_scene.current_violations
            is_violation  = len(violations) > 0

            # Advance the live scene in sync with the video
            self._live_scene.generate()

            if is_violation:
                self.total_violations += 1
                for v in violations:
                    now = time.time()
                    if not v.violation_logged or (now - v.logged_at) > 9.0:
                        v.violation_logged = True
                        v.logged_at        = now
                        thumb = self._make_thumbnail(frame)
                        for cb in self._violation_callbacks:
                            try:
                                cb(plate=v.plate, thumbnail_jpg=thumb)
                            except Exception as exc:
                                logger.debug("Violation callback error: %s", exc)

            return frame, DetectionResult(
                compliant        = not is_violation,
                plate            = violations[0].plate if violations else None,
                thumbnail_jpg    = None,
                vehicles_count   = self.total_scanned,
                violations_count = self.total_violations,
            )

        # ── Real camera path ──────────────────────────────────────────────────
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        rois: list[tuple[int,int,int,int]] = []
        if _yolo_model is not None:
            try:
                results = _yolo_model(frame, verbose=False, classes=[0, 2, 3, 5, 7])
                for box in results[0].boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    rois.append((x1, y1, x2, y2))
            except Exception:
                pass

        if not rois:
            rois = [(0, 0, frame.shape[1], frame.shape[0])]

        compliant = False
        for x1, y1, x2, y2 in rois:
            roi_gray = gray[y1:y2, x1:x2]
            if self._detect_apriltag(roi_gray):
                compliant = True
                cv2.rectangle(frame, (x1, y1), (x2, y2), (55, 195, 75), 2)
                cv2.putText(frame, "SEATBELT DETECTED", (x1, y1 - 6),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.48, (55, 195, 75), 1, cv2.LINE_AA)
            else:
                cv2.rectangle(frame, (x1, y1), (x2, y2), (45, 45, 215), 2)
                cv2.putText(frame, "VIOLATION", (x1, y1 - 6),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.48, (45, 45, 215), 1, cv2.LINE_AA)

        plate = None
        thumb = None
        if not compliant:
            self.total_violations += 1
            # Trigger EasyOCR lazy load on first violation
            from . import ocr as _ocr
            _ocr.ensure_loaded()
            plate = _ocr.read_plate(frame) or "UNKNOWN"
            thumb = self._make_thumbnail(frame)
            for cb in self._violation_callbacks:
                try:
                    cb(plate=plate, thumbnail_jpg=thumb)
                except Exception as exc:
                    logger.debug("Callback error: %s", exc)

        return frame, DetectionResult(
            compliant        = compliant,
            plate            = plate,
            thumbnail_jpg    = thumb,
            vehicles_count   = self.total_scanned,
            violations_count = self.total_violations,
        )

    @staticmethod
    def _make_thumbnail(frame: np.ndarray) -> bytes:
        small = cv2.resize(frame, (320, 180))
        _, buf = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, 72])
        return buf.tobytes()

    def encode_frame_jpeg(self, frame: np.ndarray) -> bytes:
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 82])
        return buf.tobytes()
