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
        background: "#EFF6FF",
        foreground: "#1E293B",
        primary: {
          DEFAULT: "#1E3A8A",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#EFF6FF",
          foreground: "#1E293B",
        },
        accent: {
          DEFAULT: "#2563EB",
          foreground: "#ffffff",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#1E293B",
        },
        border: "#DBEAFE",
        muted: {
          DEFAULT: "#EFF6FF",
          foreground: "#6B7280",
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
