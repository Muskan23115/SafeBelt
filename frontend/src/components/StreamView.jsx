import { useState, useEffect, useRef } from "react";

export default function StreamView() {
  const [status, setStatus] = useState("connecting"); // connecting | live | error
  const [ocrReady,   setOcrReady]   = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const imgRef = useRef(null);

  // Poll stats for live badge counts
  const [counts, setCounts] = useState({ compliant: 0, violations: 0 });

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) return;
        const data = await res.json();
        setOcrReady(data.ocr_ready   ?? false);
        setOcrLoading(data.ocr_loading ?? false);
        setCounts({
          compliant: data.vehicles_scanned - data.violations,
          violations: data.violations,
        });
      } catch {/* backend not up yet */}
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  // Track stream img load/error
  const handleLoad  = () => setStatus("live");
  const handleError = () => setStatus("error");

  return (
    <div className="relative w-full rounded-card overflow-hidden border border-hairline bg-ink"
         style={{ aspectRatio: "16/9" }}>

      {/* MJPEG stream */}
      <img
        ref={imgRef}
        id="stream-img"
        src="/api/stream"
        alt="Live seatbelt detection stream"
        className="w-full h-full object-cover"
        onLoad={handleLoad}
        onError={handleError}
      />

      {/* Connecting overlay */}
      {status === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/80 text-white gap-3">
          <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="font-body text-sm text-white/70">Connecting to stream…</p>
        </div>
      )}

      {/* Error overlay */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/90 text-white gap-3">
          <svg className="w-10 h-10 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          <p className="font-body text-sm text-white/70">Stream unavailable — start the backend</p>
          <button
            onClick={() => { setStatus("connecting"); if(imgRef.current) imgRef.current.src = "/api/stream?" + Date.now(); }}
            className="btn-secondary text-white border-white/40 text-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* Live badge top-left */}
      {status === "live" && (
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <span className="flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"/>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-error"/>
          </span>
          <span className="badge badge-error backdrop-blur-sm bg-white/90">LIVE</span>
        </div>
      )}

      {/* Count badges top-right */}
      {status === "live" && (
        <div className="absolute top-4 right-4 flex gap-2">
          <span id="badge-compliant" className="badge badge-success backdrop-blur-sm bg-white/90">
            ✓ {counts.compliant} Compliant
          </span>
          <span id="badge-violation" className="badge badge-error backdrop-blur-sm bg-white/90">
            ✗ {counts.violations} Violations
          </span>
        </div>
      )}

      {/* OCR loading banner — only shown while actively loading (first violation triggered it) */}
      {ocrLoading && !ocrReady && status === "live" && (
        <div className="absolute bottom-0 left-0 right-0 bg-amber-600/92 backdrop-blur-sm px-4 py-2.5
                        flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0"/>
          <p className="font-body text-xs text-white font-medium tracking-wide">
            Initializing OCR engine — plate recognition will begin shortly
          </p>
        </div>
      )}
    </div>
  );
}
