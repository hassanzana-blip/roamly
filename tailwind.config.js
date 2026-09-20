/** @type {import('tailwindcss').Config} */
module.exports = {
  future: { hoverOnlyWhenSupported: true },
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope Variable", "Manrope", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Newsreader Variable", "Newsreader", "Iowan Old Style", "Times New Roman", "Georgia", "serif"],
      },
      colors: {
        gold: "hsl(var(--gold))",
        skyline: "hsl(var(--skyline))",
        night: "hsl(var(--night))",
        coral: "hsl(var(--coral))",
        "coral-ink": "hsl(var(--coral-ink))",
        "coral-on-dark": "hsl(var(--coral-on-dark))",
        /* HelloSky 4.0 */
        petrol: {
          DEFAULT: "hsl(var(--petrol) / <alpha-value>)",
          deep: "hsl(var(--petrol-deep))",
        },
        azure: {
          DEFAULT: "hsl(var(--azure))",
          ink: "hsl(var(--azure-ink))",
        },
        mint: {
          DEFAULT: "hsl(var(--mint))",
          deep: "hsl(var(--mint-deep))",
        },
        lavender: {
          DEFAULT: "hsl(var(--lavender))",
          deep: "hsl(var(--lavender-deep))",
        },
        /* 3.0 aliases (mapped onto 4.0 tokens in index.css) */
        burgundy: {
          DEFAULT: "hsl(var(--burgundy))",
          deep: "hsl(var(--burgundy-deep))",
        },
        ivory: "hsl(var(--ivory))",
        blush: "hsl(var(--blush))",
        like: "hsl(var(--like) / <alpha-value>)",
        sand: "hsl(var(--sand))",
        sunny: { DEFAULT: "hsl(var(--sunny))", ink: "hsl(var(--sunny-ink))" },
        "sky-soft": "hsl(var(--sky-soft))",
        "rose-soft": "hsl(var(--rose-soft))",
        sea: "hsl(var(--sea))",
        forest: "hsl(var(--forest))",
        apricot: "hsl(var(--apricot))",
        "sunny-warm": "hsl(var(--sunny-warm))",
        "lav-soft": "hsl(var(--lav-soft))",
        page: "hsl(var(--page))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft: "hsl(var(--primary-soft))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      /* Measured radii: cards never balloon past 20px */
      borderRadius: {
        xs: "4px",
        sm: "6px",
        DEFAULT: "8px",
        md: "10px",
        lg: "var(--radius)",
        xl: "16px",
        "2xl": "16px",
        "3xl": "20px",
        "4xl": "24px",
        "5xl": "28px",
      },
      boxShadow: {
        xs: "0 1px 2px 0 hsl(240 10% 8% / 0.05)",
        sm: "0 1px 3px 0 hsl(240 10% 8% / 0.08), 0 1px 2px -1px hsl(240 10% 8% / 0.06)",
        md: "0 4px 12px -2px hsl(240 10% 8% / 0.10), 0 2px 4px -2px hsl(240 10% 8% / 0.06)",
        bar: "0 -6px 24px -12px hsl(240 10% 8% / 0.25)",
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      spacing: {
        18: "4.5rem",
        "safe-b": "env(safe-area-inset-bottom)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.23, 1, 0.32, 1)",
        "in-out": "cubic-bezier(0.77, 0, 0.175, 1)",
      },
      transitionDuration: {
        fast: "150ms",
        base: "220ms",
        slow: "320ms",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "collapsible-down": {
          from: { height: "0", opacity: "0" },
          to: { height: "var(--radix-collapsible-content-height)", opacity: "1" },
        },
        "collapsible-up": {
          from: { height: "var(--radix-collapsible-content-height)", opacity: "1" },
          to: { height: "0", opacity: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)",
        "accordion-up": "accordion-up 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
        "collapsible-down": "collapsible-down 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)",
        "collapsible-up": "collapsible-up 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
