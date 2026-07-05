import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Paleta institucional Grupo Frío (azul GF + cian hielo, verificada
      // contra grupofrio.mx). El navy anterior era genérico, no de marca.
      colors: {
        background: "#F0F9FF",
        foreground: "#0F2A3D",
        primary: {
          DEFAULT: "#0077BB",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#F0F9FF",
          foreground: "#0F2A3D",
        },
        accent: {
          DEFAULT: "#00B8D4",
          foreground: "#ffffff",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#0F2A3D",
        },
        border: "#DBEFF9",
        muted: {
          DEFAULT: "#F0F9FF",
          foreground: "#5B7285",
        },
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
    },
  },
  plugins: [],
};
export default config;
