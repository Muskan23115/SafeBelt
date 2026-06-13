/**
 * ViolationRow — enriched row with vehicle lookup data.
 *
 * Props: violation (object), index (number for stagger animation)
 *
 * violation fields:
 *   plate, timestamp, location, thumbnail_b64,
 *   vehicle_make_model, vehicle_color, fuel_type,
 *   owner_name, insurance_status, puc_status
 */

const DASH = "—";

function fmt(val) {
  return val && val.trim() ? val.trim() : DASH;
}

// ── Status chip (INS / PUC) ──────────────────────────────────────────────────
function StatusChip({ label, status }) {
  const isActive  = status === "ACTIVE";
  const isExpired = status === "EXPIRED";
  const color = isActive
    ? { bg: "rgba(22,163,74,0.1)", text: "#16a34a", dot: "#16a34a" }
    : isExpired
    ? { bg: "rgba(220,38,38,0.1)", text: "#dc2626", dot: "#dc2626" }
    : { bg: "rgba(120,113,108,0.1)", text: "#78716c", dot: "#a8a29e" };

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill font-body font-semibold"
      style={{
        background: color.bg,
        color: color.text,
        fontSize: "0.6rem",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 5, height: 5,
          borderRadius: "50%",
          background: color.dot,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      {label}: {status ?? DASH}
    </span>
  );
}

// ── Fuel type pill ───────────────────────────────────────────────────────────
function FuelPill({ fuel }) {
  if (!fuel || fuel === DASH) return null;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-pill font-body font-semibold"
      style={{
        background: "rgba(251,191,36,0.12)",
        color: "#b45309",
        fontSize: "0.58rem",
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        border: "1px solid rgba(251,191,36,0.3)",
      }}
    >
      {fuel}
    </span>
  );
}

// ── Small thumbnail chip ─────────────────────────────────────────────────────
function ThumbChip({ b64 }) {
  if (!b64) return null;
  return (
    <span
      className="inline-block rounded overflow-hidden border border-hairline shrink-0"
      style={{ width: 28, height: 18, verticalAlign: "middle" }}
    >
      <img
        src={`data:image/jpeg;base64,${b64}`}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </span>
  );
}

// ── Main row ─────────────────────────────────────────────────────────────────
export default function ViolationRow({ violation, index }) {
  const {
    plate,
    timestamp,
    location,
    thumbnail_b64,
    vehicle_make_model,
    vehicle_color,
    fuel_type,
    owner_name,
    insurance_status,
    puc_status,
  } = violation;

  const date    = new Date(timestamp);
  const dateStr = date.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const makeModel = fmt(vehicle_make_model);
  const color     = fmt(vehicle_color);
  const fuel      = fuel_type && fuel_type.trim() ? fuel_type.trim().toUpperCase() : null;
  const owner     = fmt(owner_name);

  // Build the make/model · color · owner line
  const vehicleLine = [makeModel, color]
    .filter((v) => v !== DASH)
    .join(" · ")
    || DASH;
  const ownerLine = owner !== DASH ? `Owned by ${owner}` : null;

  return (
    <div
      className="flex items-start gap-4 py-4 divider fade-up"
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      {/* ── Left: circular thumbnail ────────────────────────────────────── */}
      <div
        className="shrink-0 w-14 h-14 rounded-full overflow-hidden border-2 border-error/20
                   bg-stone-100 flex items-center justify-center"
      >
        {thumbnail_b64 ? (
          <img
            src={`data:image/jpeg;base64,${thumbnail_b64}`}
            alt={`Violation frame for plate ${plate}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg className="w-7 h-7 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 10l4.553-2.069A1 1 0 0121 8.87V15.13a1 1 0 01-1.447.9L15 14M4 8h7a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2z"/>
          </svg>
        )}
      </div>

      {/* ── Centre: info block ──────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Line 1: plate + thumb chip + VIOLATION badge + fuel pill */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="font-body font-semibold text-ink tracking-tight"
            style={{ fontSize: "0.92rem" }}
          >
            {plate}
          </span>
          <ThumbChip b64={thumbnail_b64} />
          <span className="badge badge-error" style={{ fontSize: "0.55rem", padding: "2px 9px" }}>
            VIOLATION
          </span>
          {fuel && <FuelPill fuel={fuel} />}
        </div>

        {/* Line 2: make · color · owner */}
        <div
          className="font-body text-stone-500 mt-0.5 leading-snug"
          style={{ fontSize: "0.78rem" }}
        >
          {vehicleLine !== DASH && (
            <span>{vehicleLine}</span>
          )}
          {vehicleLine !== DASH && ownerLine && (
            <span className="text-stone-300 mx-1">·</span>
          )}
          {ownerLine && (
            <span className="text-stone-400">{ownerLine}</span>
          )}
          {vehicleLine === DASH && !ownerLine && (
            <span className="text-stone-300">{DASH}</span>
          )}
        </div>

        {/* Line 3: timestamp + location */}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="font-body text-stone-400 flex items-center gap-1" style={{ fontSize: "0.72rem" }}>
            {/* Clock icon */}
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {dateStr} · {timeStr}
          </span>
          {location && (
            <span className="font-body text-stone-400 flex items-center gap-1" style={{ fontSize: "0.72rem" }}>
              {/* Pin icon */}
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              {location}
            </span>
          )}
        </div>
      </div>

      {/* ── Right: INS/PUC status + time-ago ───────────────────────────── */}
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        {/* Relative time */}
        <span
          className="caption-upper text-stone-300 hidden sm:block mb-1"
          style={{ fontSize: "0.55rem" }}
        >
          {timeAgo(date)}
        </span>

        {/* INS status */}
        <StatusChip label="INS" status={insurance_status} />

        {/* PUC status */}
        <StatusChip label="PUC" status={puc_status} />
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60)  return `${seconds}S AGO`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)  return `${minutes}M AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)    return `${hours}H AGO`;
  return `${Math.floor(hours / 24)}D AGO`;
}
