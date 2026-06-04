export default function ViolationRow({ violation, index }) {
  const { plate, timestamp, location, thumbnail_b64 } = violation;

  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div
      className="flex items-center gap-4 py-4 divider fade-up"
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      {/* Circular thumbnail */}
      <div className="shrink-0 w-14 h-14 rounded-full overflow-hidden border-2 border-error/20 bg-stone-100 flex items-center justify-center">
        {thumbnail_b64 ? (
          <img
            src={`data:image/jpeg;base64,${thumbnail_b64}`}
            alt={`Violation thumbnail for ${plate}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg className="w-7 h-7 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 10l4.553-2.069A1 1 0 0121 8.87V15.13a1 1 0 01-1.447.9L15 14M4 8h7a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2z"/>
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-base font-medium text-ink tracking-tight">{plate}</span>
          <span className="badge badge-error">VIOLATION</span>
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="font-body text-xs text-stone-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {dateStr} · {timeStr}
          </span>
          {location && (
            <span className="font-body text-xs text-stone-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              {location}
            </span>
          )}
        </div>
      </div>

      {/* Time ago pill */}
      <div className="shrink-0">
        <span className="caption-upper text-stone-300 hidden sm:block">
          {timeAgo(date)}
        </span>
      </div>
    </div>
  );
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
