/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Premium SaaS palette — blue / grey / white only.
        brand: {
          DEFAULT: "#2563EB",
          dark: "#1D4ED8",
          light: "#3B82F6",
          soft: "#DBEAFE", // secondary / tints
          wash: "#EFF6FF",
        },
        ink: {
          DEFAULT: "#0F172A", // primary text
          muted: "#64748B", // muted text
        },
        canvas: "#F8FAFC", // app background
        // Back-compat alias so existing `linkedin` classes keep working.
        linkedin: {
          DEFAULT: "#2563EB",
          dark: "#1D4ED8",
          light: "#3B82F6",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -12px rgba(15, 23, 42, 0.10)",
        lift: "0 2px 4px rgba(15, 23, 42, 0.05), 0 16px 40px -16px rgba(37, 99, 235, 0.18)",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
    },
  },
  plugins: [],
};
