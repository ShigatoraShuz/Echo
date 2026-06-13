import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/shared/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/config/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "hsl(var(--danger) / <alpha-value>)",
          foreground: "hsl(var(--danger-foreground) / <alpha-value>)",
        },
        crisis: {
          DEFAULT: "hsl(var(--crisis) / <alpha-value>)",
          soft: "hsl(var(--crisis-soft) / <alpha-value>)",
        },
        calm: "hsl(var(--calm) / <alpha-value>)",
        happy: "hsl(var(--happy) / <alpha-value>)",
        neutral: "hsl(var(--neutral) / <alpha-value>)",
        sad: "hsl(var(--sad) / <alpha-value>)",
        anxious: "hsl(var(--anxious) / <alpha-value>)",
        angry: "hsl(var(--angry) / <alpha-value>)",
        mood: {
          calm: "hsl(var(--calm) / <alpha-value>)",
          happy: "hsl(var(--happy) / <alpha-value>)",
          neutral: "hsl(var(--neutral) / <alpha-value>)",
          sad: "hsl(var(--sad) / <alpha-value>)",
          anxious: "hsl(var(--anxious) / <alpha-value>)",
          angry: "hsl(var(--angry) / <alpha-value>)",
        },
        risk: {
          low: "hsl(var(--risk-low) / <alpha-value>)",
          mild: "hsl(var(--risk-mild) / <alpha-value>)",
          moderate: "hsl(var(--risk-moderate) / <alpha-value>)",
          high: "hsl(var(--risk-high) / <alpha-value>)",
          severe: "hsl(var(--risk-severe) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        chart: {
          1: "hsl(var(--chart-1) / <alpha-value>)",
          2: "hsl(var(--chart-2) / <alpha-value>)",
          3: "hsl(var(--chart-3) / <alpha-value>)",
          4: "hsl(var(--chart-4) / <alpha-value>)",
          5: "hsl(var(--chart-5) / <alpha-value>)",
        },
        surface: {
          DEFAULT: "hsl(var(--surface) / <alpha-value>)",
          raised: "hsl(var(--surface-raised) / <alpha-value>)",
          muted: "hsl(var(--surface-muted) / <alpha-value>)",
          subtle: "hsl(var(--surface-subtle) / <alpha-value>)",
        },
        overlay: "hsl(var(--overlay))",
        emotion: {
          anger: "hsl(var(--emotion-anger) / <alpha-value>)",
          anticipation: "hsl(var(--emotion-anticipation) / <alpha-value>)",
          disgust: "hsl(var(--emotion-disgust) / <alpha-value>)",
          fear: "hsl(var(--emotion-fear) / <alpha-value>)",
          joy: "hsl(var(--emotion-joy) / <alpha-value>)",
          sadness: "hsl(var(--emotion-sadness) / <alpha-value>)",
          surprise: "hsl(var(--emotion-surprise) / <alpha-value>)",
          trust: "hsl(var(--emotion-trust) / <alpha-value>)",
        },
        info: {
          DEFAULT: "hsl(var(--information) / <alpha-value>)",
          surface: "hsl(var(--information-surface) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 0.25rem)",
        "2xl": "calc(var(--radius) + 0.5rem)",
        "3xl": "calc(var(--radius) + 1rem)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
        subtle: "var(--shadow-subtle)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
