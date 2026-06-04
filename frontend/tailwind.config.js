/** @type {import('tailwindcss').Config} */

function withOpacity(variableName) {
  return ({ opacityValue }) =>
    opacityValue !== undefined
      ? `rgba(var(${variableName}), ${opacityValue})`
      : `rgb(var(${variableName}))`;
}

export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas:   "#f5f5f5",
        ink:      withOpacity("--color-ink"),
        surface:  "#ffffff",
        hairline: "#e7e5e4",
        mint:     "#a7e5d3",
        peach:    "#f4c5a8",
        lavender: "#c8b8e0",
        sky:      "#a8c8e8",
        success:  withOpacity("--color-success"),
        error:    withOpacity("--color-error"),
      },
      fontFamily: {
        display: ['"EB Garamond"', "Georgia", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        pill: "9999px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06)",
        "card-hover": "0 4px 16px rgba(0,0,0,0.08)",
        "nav": "0 1px 0 #e7e5e4",
      },
    },
  },
  plugins: [],
};
