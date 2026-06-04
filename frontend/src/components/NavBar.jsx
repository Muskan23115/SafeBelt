import { useState } from "react";
import { NavLink } from "react-router-dom";

const LINKS = [
  { to: "/",           label: "Live Monitor" },
  { to: "/violations", label: "Violations"   },
  { to: "/stats",      label: "Statistics"   },
];

export default function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 h-16 bg-white/90 backdrop-blur shadow-nav flex items-center px-6 md:px-10">
      {/* Logo */}
      <NavLink to="/" className="flex items-center gap-2.5 mr-auto md:mr-0">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="8" fill="#292524"/>
          <path d="M14 6C9.58 6 6 9.58 6 14s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 3a5 5 0 110 10A5 5 0 0114 9zm0 2a3 3 0 100 6 3 3 0 000-6z" fill="#a7e5d3"/>
          <circle cx="14" cy="14" r="2" fill="white"/>
        </svg>
        <span className="font-display text-lg text-ink font-medium tracking-tight">
          SafeBelt <span className="text-stone-400">AI</span>
        </span>
      </NavLink>

      {/* Desktop nav links */}
      <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
        {LINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `font-body text-sm transition-colors duration-150 ${
                isActive ? "text-ink font-medium" : "text-stone-400 hover:text-ink"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Desktop CTA */}
      <div className="hidden md:flex items-center gap-3 ml-auto">
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="btn-secondary text-xs px-4 py-2"
        >
          GitHub
        </a>
        <NavLink to="/" className="btn-primary text-xs px-4 py-2">
          Live Demo
        </NavLink>
      </div>

      {/* Mobile hamburger */}
      <button
        id="hamburger-btn"
        aria-label="Toggle menu"
        onClick={() => setOpen(!open)}
        className="md:hidden ml-auto flex flex-col gap-1.5 p-2"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`block h-0.5 bg-ink rounded-full transition-all duration-200 ${
              i === 1 ? "w-5" : "w-6"
            }`}
          />
        ))}
      </button>

      {/* Mobile dropdown */}
      {open && (
        <div className="absolute top-16 left-0 right-0 bg-white border-b border-hairline shadow-lg md:hidden z-50 fade-up">
          <nav className="flex flex-col py-3 px-6 gap-0">
            {LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `py-3 font-body text-sm border-b border-hairline last:border-0 transition-colors ${
                    isActive ? "text-ink font-medium" : "text-stone-400"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
