import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import StatCard from "../components/StatCard";

const ScanIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
  </svg>
);
const AlertIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
  </svg>
);
const CheckIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
);

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-hairline rounded-xl px-4 py-3 shadow-card-hover font-body text-xs">
      <p className="text-stone-400 mb-1 caption-upper">{label}</p>
      <p className="text-error font-semibold text-base">{payload[0].value} violation{payload[0].value !== 1 ? "s" : ""}</p>
    </div>
  );
}

export default function Stats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/stats");
        if (res.ok) { setStats(await res.json()); setLoading(false); }
      } catch { /* backend not up */ }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  const chartData = stats?.violations_per_hour ?? [];
  const maxCount  = Math.max(...chartData.map(d => d.count), 1);

  return (
    <div className="relative overflow-hidden">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-10 px-6 md:px-12 overflow-hidden">
        <div className="orb w-80 h-80 bg-mint"  style={{ top: "-60px", left:  "10%" }} />
        <div className="orb w-64 h-64 bg-peach" style={{ top: "40px",  right: "5%"  }} />
        <div className="relative z-10 max-w-5xl mx-auto">
          <span className="badge badge-neutral mb-4 inline-flex">ANALYTICS</span>
          <h1 className="display text-5xl md:text-6xl text-ink mb-3 leading-tight">
            Compliance Statistics
          </h1>
          <p className="font-body text-stone-400 text-lg">
            Real-time metrics updated every 5 seconds.
          </p>
        </div>
      </section>

      {/* ── Stat Cards ───────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 pb-10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5">
          {loading ? (
            [1,2,3].map(i => (
              <div key={i} className="card animate-pulse">
                <div className="h-3 bg-stone-100 rounded w-24 mb-6"/>
                <div className="h-10 bg-stone-100 rounded w-20"/>
              </div>
            ))
          ) : (
            <>
              <StatCard
                id="stat-scanned"
                label="Vehicles Scanned"
                value={stats?.vehicles_scanned?.toLocaleString() ?? "—"}
                sub="Total detections"
                icon={ScanIcon}
              />
              <StatCard
                id="stat-violations"
                label="Violations Logged"
                value={stats?.violations?.toLocaleString() ?? "—"}
                sub="Non-compliant frames"
                icon={AlertIcon}
              />
              <StatCard
                id="stat-compliance"
                label="Compliance Rate"
                value={stats ? `${stats.compliance_rate}%` : "—"}
                sub="Across all detections"
                icon={CheckIcon}
              />
            </>
          )}
        </div>
      </section>

      {/* ── Bar Chart ────────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-2xl text-ink font-light">Violations per Hour</h2>
                <p className="font-body text-xs text-stone-400 mt-0.5">Last 24 hours</p>
              </div>
              <span className="badge badge-neutral">{stats?.violations ?? 0} total</span>
            </div>

            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-stone-200 border-t-stone-400 rounded-full animate-spin"/>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} barSize={16} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0efee" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10, fill: "#a8a29e", fontFamily: "Inter" }}
                    tickLine={false}
                    axisLine={false}
                    interval={2}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "#a8a29e", fontFamily: "Inter" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f5f5f5" }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={entry.count === 0 ? "#e7e5e4" : entry.count === maxCount ? "#dc2626" : "#f87171"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mt-4 px-1">
            {[
              { color: "#dc2626", label: "Peak hour" },
              { color: "#f87171", label: "Active violations" },
              { color: "#e7e5e4", label: "No violations" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: color }} />
                <span className="font-body text-xs text-stone-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
