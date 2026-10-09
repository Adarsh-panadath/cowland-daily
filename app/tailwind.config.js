/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#14213D", 2: "#2B3A67", 3: "#4A5784", soft: "#6B7591" },
        milk: { DEFAULT: "#F6F7F9", 2: "#ECEEF3", 3: "#DDE1EA" },
        marigold: { DEFAULT: "#F2A900", soft: "#FFF1CC", deep: "#B37A00" },
        neem: { DEFAULT: "#2F7D5B", soft: "#DDF0E6", deep: "#1F5A40" },
        brick: { DEFAULT: "#C2410C", soft: "#FDE5D8" },
        sky: { dawn: "#F7C59F", rose: "#E8A0A0" },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "system-ui", "sans-serif"],
        sans: ['"Hanken Grotesk"', "system-ui", "sans-serif"],
        mr: ['"Mukta"', '"Hanken Grotesk"', "sans-serif"],
      },
      boxShadow: {
        lift: "0 1px 2px rgba(20,33,61,.06), 0 8px 24px -12px rgba(20,33,61,.18)",
        pop: "0 24px 60px -20px rgba(20,33,61,.45)",
      },
      keyframes: {
        rise: { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "none" } },
        slidein: { from: { transform: "translateX(100%)" }, to: { transform: "none" } },
        fade: { from: { opacity: 0 }, to: { opacity: 1 } },
      },
      animation: {
        rise: "rise .35s cubic-bezier(.2,.8,.2,1) both",
        slidein: "slidein .3s cubic-bezier(.2,.8,.2,1) both",
        fade: "fade .2s ease both",
      },
    },
  },
  plugins: [],
};
