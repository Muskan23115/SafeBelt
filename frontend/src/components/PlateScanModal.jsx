import { useEffect, useRef, useState, useCallback } from "react";

/**
 * PlateScanModal
 * --------------
 * Shown when a seatbelt violation is detected.
 * Props:
 *   onClose(plate: string|null)  — called when user skips or plate is auto-read
 *   streamSrc                    — MJPEG stream URL (defaults to /api/stream)
 */
export default function PlateScanModal({ onClose, streamSrc = "/api/stream" }) {
  const [mode, setMode] = useState("scanning"); // "scanning" | "manual"
  const [manualPlate, setManualPlate] = useState("");
  const [manualError, setManualError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dotCount, setDotCount] = useState(0);
  const pollRef = useRef(null);
  const inputRef = useRef(null);

  // ── Animated ellipsis ──────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setDotCount((c) => (c + 1) % 4), 500);
    return () => clearInterval(id);
  }, []);

  // ── Auto-dismiss: poll /api/stats until live.plate is a real plate ─────────
  useEffect(() => {
    if (mode !== "scanning") return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) return;
        const data = await res.json();
        const plate = data?.live?.plate;
        if (plate && plate !== "UNKNOWN" && plate.length >= 4) {
          clearInterval(pollRef.current);
          onClose(plate);
        }
      } catch { /* ignore */ }
    }, 1500);

    return () => clearInterval(pollRef.current);
  }, [mode, onClose]);

  // ── Focus manual input when switching to manual mode ──────────────────────
  useEffect(() => {
    if (mode === "manual" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode]);

  const handleSkip = useCallback(() => {
    clearInterval(pollRef.current);
    onClose(null);
  }, [onClose]);

  const handleManualSubmit = useCallback(async () => {
    const p = manualPlate.trim().toUpperCase();
    if (p.length < 4) {
      setManualError("Please enter a valid plate number (min 4 characters).");
      return;
    }
    setSubmitting(true);
    setManualError("");
    try {
      const res = await fetch("/api/violations/manual", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ plate: p }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setManualError(err.detail ?? `Server error ${res.status} — please try again.`);
        return;
      }
      // Success — stop auto-poll and close modal
      clearInterval(pollRef.current);
      onClose(p);
    } catch {
      setManualError("Network error — is the backend running?");
    } finally {
      setSubmitting(false);
    }
  }, [manualPlate, onClose]);

  const dots = ".".repeat(dotCount);

  return (
    /* ── Backdrop ──────────────────────────────────────────────────────────── */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(6px)" }}
    >
      {/* ── Modal card ────────────────────────────────────────────────────── */}
      <div
        className="relative w-full max-w-2xl bg-surface rounded-2xl overflow-hidden fade-up"
        style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.45)" }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
          <div className="flex items-center gap-3">
            {/* Pulsing red dot */}
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-60" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-error" />
            </span>
            <h2
              className="font-display text-xl text-ink"
              style={{ fontFamily: '"EB Garamond", Georgia, serif' }}
            >
              Seatbelt Violation Detected!
            </h2>
          </div>
          {/* SCANNING PLATE badge */}
          <span
            className="caption-upper px-3 py-1 rounded-pill text-white text-xs"
            style={{ background: "#f97316", letterSpacing: "0.08em" }}
          >
            SCANNING PLATE{dots}
          </span>
        </div>

        {/* ── Camera crop with alignment box ──────────────────────────────── */}
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: "16/9", background: "#0a0a0a" }}
        >
          {/* Live MJPEG crop */}
          <img
            src={streamSrc}
            alt="Live camera feed for plate scanning"
            className="w-full h-full object-cover"
            style={{ filter: "brightness(0.75)" }}
          />

          {/* Dark vignette overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 65% 55% at 50% 55%, transparent 0%, rgba(0,0,0,0.65) 100%)",
            }}
          />

          {/* Green dashed alignment box */}
          <div
            className="absolute"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "52%",
              aspectRatio: "3.2/1",
              border: "2.5px dashed #00ff00",
              borderRadius: "8px",
              boxShadow: "0 0 20px rgba(0,255,0,0.25), inset 0 0 20px rgba(0,255,0,0.08)",
            }}
          >
            {/* Corner accents */}
            {[
              { top: -3, left: -3 },
              { top: -3, right: -3 },
              { bottom: -3, left: -3 },
              { bottom: -3, right: -3 },
            ].map((style, i) => (
              <div
                key={i}
                className="absolute w-4 h-4 border-2"
                style={{
                  ...style,
                  borderColor: "#00ff00",
                  borderRadius: "3px",
                  background: "rgba(0,255,0,0.1)",
                }}
              />
            ))}

            {/* Label */}
            <div
              className="absolute left-1/2 -top-8"
              style={{ transform: "translateX(-50%)" }}
            >
              <span
                className="caption-upper text-white px-3 py-1 rounded"
                style={{
                  background: "rgba(0,0,0,0.7)",
                  border: "1px solid rgba(0,255,0,0.5)",
                  color: "#00ff00",
                  fontSize: "0.6rem",
                  letterSpacing: "0.12em",
                }}
              >
                ALIGN LICENSE PLATE
              </span>
            </div>

            {/* Scanning line animation */}
            <div
              className="absolute inset-x-0"
              style={{
                height: "2px",
                background: "linear-gradient(90deg, transparent, #00ff00, transparent)",
                animation: "scan-line 2s linear infinite",
                top: 0,
              }}
            />
          </div>

          {/* Top-left live badge */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="badge badge-error" style={{ fontSize: "0.55rem", padding: "2px 10px" }}>
              LIVE
            </span>
          </div>
        </div>

        {/* ── Bottom orange bar ───────────────────────────────────────────── */}
        <div
          className="px-5 py-2.5 text-center font-body font-semibold text-xs tracking-wider"
          style={{ background: "#000", color: "#f97316", letterSpacing: "0.1em" }}
        >
          ⚡ ALIGNMENT BOX ACTIVE — ALIGN PLATE IN CENTER ⚡
        </div>

        {/* ── Instruction + controls ──────────────────────────────────────── */}
        <div className="px-6 py-5">
          <p className="font-body text-sm text-stone-500 text-center mb-5 leading-relaxed">
            Position the vehicle's license plate inside the green center target box.
            The AI scanner will automatically crop and detect it without capturing the occupant's face.
          </p>

          {/* Manual entry form */}
          {mode === "manual" && (
            <div className="mb-4 fade-up">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  id="manual-plate-input"
                  type="text"
                  placeholder="e.g. RJ14 AB 1234"
                  value={manualPlate}
                  disabled={submitting}
                  onChange={(e) => {
                    setManualPlate(e.target.value.toUpperCase());
                    setManualError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && !submitting && handleManualSubmit()}
                  className="flex-1 font-body text-sm border border-hairline rounded-pill px-4 py-2.5
                             text-ink bg-canvas focus:outline-none focus:border-ink/40 transition-colors
                             uppercase tracking-wider disabled:opacity-50"
                  maxLength={20}
                />
                <button
                  id="manual-plate-submit"
                  onClick={handleManualSubmit}
                  disabled={submitting}
                  className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ minWidth: 90 }}
                >
                  {submitting ? (
                    <>
                      <span
                        className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white
                                   rounded-full animate-spin"
                      />
                      Saving…
                    </>
                  ) : (
                    "Confirm Plate"
                  )}
                </button>
              </div>
              {manualError && (
                <p className="font-body text-xs text-error mt-2 pl-2">{manualError}</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-3">
            {mode === "scanning" ? (
              <button
                id="enter-manually-btn"
                onClick={() => setMode("manual")}
                className="btn-secondary text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                Enter Manually
              </button>
            ) : (
              <button
                id="back-to-scan-btn"
                onClick={() => { setMode("scanning"); setManualPlate(""); setManualError(""); }}
                className="btn-secondary text-sm"
              >
                ← Back to Scan
              </button>
            )}
            <button
              id="skip-and-log-btn"
              onClick={handleSkip}
              className="btn-secondary text-sm text-stone-400 border-stone-200"
            >
              Skip &amp; Log
            </button>
          </div>
        </div>
      </div>

      {/* ── Scan-line keyframe (injected inline) ──────────────────────────── */}
      <style>{`
        @keyframes scan-line {
          0%   { top: 0;    opacity: 1; }
          95%  { top: 100%; opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
