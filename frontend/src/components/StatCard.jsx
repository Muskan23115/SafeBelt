export default function StatCard({ label, value, sub, delta, icon }) {
  const positive = delta >= 0;

  return (
    <div className="card group cursor-default">
      <div className="flex items-start justify-between mb-4">
        <span className="caption-upper text-stone-400">{label}</span>
        {icon && (
          <span className="w-9 h-9 rounded-full bg-canvas flex items-center justify-center text-stone-400
                           group-hover:bg-ink group-hover:text-white transition-colors duration-200">
            {icon}
          </span>
        )}
      </div>

      <p className="font-display text-5xl text-ink font-light leading-none mb-2">{value}</p>

      {(sub || delta !== undefined) && (
        <div className="flex items-center gap-2 mt-3">
          {sub && <span className="font-body text-xs text-stone-400">{sub}</span>}
          {delta !== undefined && (
            <span className={`caption-upper flex items-center gap-0.5 ${
              positive ? "text-success" : "text-error"
            }`}>
              {positive ? "▲" : "▼"} {Math.abs(delta)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
