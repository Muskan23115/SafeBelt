import { useEffect, useState, useRef, useCallback } from "react";
import StreamView from "../components/StreamView";
import PlateScanModal from "../components/PlateScanModal";

export default function LiveMonitor() {
  const [stats, setStats] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Cooldown ref — prevents modal re-opening for 30 s after dismiss
  const cooldownUntil = useRef(0);
  // Track last non-compliant state to detect a fresh violation trigger
  const wasCompliant = useRef(true);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);

          const liveCompliant = data?.live?.compliant ?? true;

          // Show modal on rising edge: compliant → violation, if cooldown passed
          if (!liveCompliant && wasCompliant.current && Date.now() > cooldownUntil.current) {
            setShowModal(true);
          }
          wasCompliant.current = liveCompliant;
        }
      } catch { /* backend warming up */ }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  const handleModalClose = useCallback((_plate) => {
    setShowModal(false);
    // 30-second cooldown so the modal doesn't spam on every violation cycle
    cooldownUntil.current = Date.now() + 30_000;
  }, []);

  const compliant   = stats ? stats.vehicles_scanned - stats.violations : 0;
  const violations  = stats ? stats.violations : 0;
  const rate        = stats ? stats.compliance_rate : null;
  const isCompliant = stats?.live?.compliant ?? true;

  return (
    <div className="relative overflow-hidden">
      {/* ── Plate Scan Modal ──────────────────────────────────────────── */}
      {showModal && (
        <PlateScanModal onClose={handleModalClose} />
      )}

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-14 px-6 md:px-12 text-center overflow-hidden">
        {/* Lavender orb */}
        <div
          className="orb w-96 h-96 bg-lavender"
          style={{ top: "-80px", left: "50%", transform: "translateX(-50%)" }}
        />

        <div className="relative z-10">
          {/* Live status pill */}
          <div className="inline-flex items-center gap-2 mb-6">
            <span className={`w-2 h-2 rounded-full pulse-ring ${isCompliant ? "bg-success" : "bg-error"}`} />
            <span className={`badge ${isCompliant ? "badge-success" : "badge-error"}`}>
              {isCompliant ? "ALL COMPLIANT" : "VIOLATION DETECTED"}
            </span>
          </div>

          <h1 className="display text-5xl md:text-6xl text-ink mb-4 leading-tight">
            Monitoring in Progress
          </h1>
          <p className="font-body text-stone-400 text-lg max-w-lg mx-auto">
            AI-powered seatbelt compliance detection via live camera feed.
            AprilTag recognition · YOLOv8 · EasyOCR.
          </p>
        </div>
      </section>

      {/* ── Quick stats row ─────────────────────────────────────────── */}
      <section className="px-6 md:px-12 pb-8">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-4">
          {[
            { label: "Scanned",    value: stats?.vehicles_scanned ?? "—", color: "text-ink" },
            { label: "Compliant",  value: compliant,                        color: "text-success" },
            { label: "Violations", value: violations,                       color: "text-error" },
          ].map(({ label, value, color }) => (
            <div key={label} className="card text-center py-4 px-3">
              <p className={`font-display text-3xl ${color} font-light`}>{value}</p>
              <p className="caption-upper text-stone-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stream ───────────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 pb-24">
        <div className="max-w-4xl mx-auto">
          <StreamView />

          {/* Compliance rate bar */}
          {rate !== null && (
            <div className="mt-6 bg-surface rounded-card border border-hairline p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="caption-upper text-stone-400">Compliance Rate</span>
                <span className={`font-display text-2xl font-light ${
                  rate >= 80 ? "text-success" : rate >= 50 ? "text-amber-600" : "text-error"
                }`}>
                  {rate}%
                </span>
              </div>
              <div className="w-full h-2 bg-canvas rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    rate >= 80 ? "bg-success" : rate >= 50 ? "bg-amber-500" : "bg-error"
                  }`}
                  style={{ width: `${rate}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

