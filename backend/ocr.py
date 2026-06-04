"""
EasyOCR wrapper — lazy-loaded on first violation, never at startup.

Usage:
  - Call ensure_loaded() when a violation is detected (triggers background load).
  - Call read_plate(frame) to get text; returns None while model is loading.
  - Call is_ready() / is_loading() to report state to the frontend.
"""
import threading
import logging

logger = logging.getLogger(__name__)

_reader  = None
_loading = False
_lock    = threading.Lock()


def _load_reader():
    global _reader, _loading
    try:
        import easyocr
        logger.info("EasyOCR: loading model (first-run may download ~100 MB)…")
        r = easyocr.Reader(["en"], gpu=False, verbose=False)
        with _lock:
            _reader = r
        logger.info("EasyOCR: ready.")
    except Exception as exc:
        logger.warning("EasyOCR failed to load: %s", exc)
    finally:
        with _lock:
            _loading = False


def ensure_loaded():
    """
    Kick off background EasyOCR load if not already started.
    Call this on first violation detection — NOT at startup.
    """
    global _loading
    with _lock:
        if _reader is not None or _loading:
            return
        _loading = True
    t = threading.Thread(target=_load_reader, daemon=True, name="easyocr-loader")
    t.start()
    logger.info("EasyOCR: background load triggered by first violation.")


def is_ready() -> bool:
    with _lock:
        return _reader is not None


def is_loading() -> bool:
    with _lock:
        return _loading


def read_plate(frame) -> str | None:
    """
    Run OCR on frame, return most confident plate-like string or None.
    Silently returns None while model is still loading.
    """
    with _lock:
        reader = _reader
    if reader is None:
        return None
    try:
        # Allow spaces so "RJ14 AB 1234" is read correctly
        results = reader.readtext(
            frame,
            allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ",
        )
        candidates = [
            (text.strip().upper(), conf)
            for (_, text, conf) in results
            if 4 <= len(text.strip()) <= 14 and conf > 0.35
        ]
        if candidates:
            return max(candidates, key=lambda x: x[1])[0]
    except Exception as exc:
        logger.debug("OCR error: %s", exc)
    return None
