import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#FF7A1A",
          dark: "#E25E00",
          light: "#FFF1E6",
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
