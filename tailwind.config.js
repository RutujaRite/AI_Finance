/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["variant", [
    "&:is(.dark *)",
    "&:is([data-theme=\"dark\"] *)",
    "&:is([data-bs-theme=\"dark\"] *)",
    "&:is(.dark)",
    "&:is([data-theme=\"dark\"])",
    "&:is([data-bs-theme=\"dark\"])"
  ]],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "2xs": "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        "xs": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      },
    },
  },
  plugins: [],
};
