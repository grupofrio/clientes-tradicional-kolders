import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F8FAFC",
        foreground: "#0F172A",
        primary: {
          DEFAULT: "#0066FF",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#E2E8F0",
          foreground: "#1E293B",
        },
        accent: {
          DEFAULT: "#00B4FF",
          foreground: "#ffffff",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#0F172A",
        },
        border: "#CBD5E1",
        muted: {
          DEFAULT: "#F1F5F9",
          foreground: "#64748B",
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
