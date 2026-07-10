import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          // Driven by CSS variables (globals.css) so the palette can be
          // themed per tenant at runtime. <alpha-value> keeps opacity
          // modifiers such as bg-brand/10 working.
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          dark: "rgb(var(--brand-dark) / <alpha-value>)",
          light: "rgb(var(--brand-light) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        // Urdu / Nastaleeq typeface. Use the `font-urdu` class on any element.
        urdu: ['"Jameel Noori Nastaleeq"', '"Noto Nastaliq Urdu"', "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
