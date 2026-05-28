/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          sidebar: "#161618", // Sleek grayish black (charcoal)
          base: "#111113",    // Premium matte black
          card: "#1b1b1e",    // Matte charcoal secondary
        },
        border: {
          muted: "#252528",   // Sleek border highlight
          accent: "#323236",  // Platinum-accented borders
        },
        content: {
          muted: "#8e8e93",   // Clean silver/gray muted text
          highlight: "#ffffff", // Pure white emphasis
          normal: "#e5e5ea",  // Premium soft white text
        },
        accent: {
          blue: "#ffffff",
          hover: "#f4f4f5",
          danger: "#a1a1aa",  // Matte silver/gray for warnings
          success: "#ffffff",
          warning: "#71717a"
        }
      },
      fontFamily: {
        sans: ["Instrument Sans", "Inter", "sans-serif"],
        display: ["Cormorant Garamond", "serif"],
        mono: ["JetBrains Mono", "SF Mono", "monospace"],
      }
    },
  },
  plugins: [],
}
