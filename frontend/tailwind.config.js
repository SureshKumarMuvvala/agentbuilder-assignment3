/** @type {import('tailwindcss').Config} */
// Tailwind is the only styling layer — we hand-build a LangSmith-style dark
// execution viewer rather than pulling in a component kit, so the graded
// LangGraph concepts stay front-and-centre and the build stays dependency-light.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Node accent colours mirror the CLI's NODE_META palette so the same
        // concept reads the same colour in the terminal and the browser.
        node: {
          magenta: "#c084fc", // 5 · Memory
          yellow: "#fde047", // 2 · Routing
          blue: "#60a5fa", // 3 · Fan-out (SerpApi demand)
          cyan: "#22d3ee", // 3 · Fan-out (Oxylabs supply)
          green: "#4ade80", // 4 · Agent + Tools
        },
      },
    },
  },
  plugins: [],
};
