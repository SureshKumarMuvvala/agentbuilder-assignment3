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
        // Verdict semantics — the product's whole point reads in one glance:
        // GO is go, NICHE is caution, NO-GO is stop.
        verdict: {
          go: "#34d399", // emerald
          niche: "#fbbf24", // amber
          nogo: "#fb7185", // rose
        },
        // Premium near-black surfaces (Vercel/Linear-style elevation ramp).
        surface: {
          0: "#08090c", // app background
          1: "#0d0f14", // sidebar / drawer
          2: "#12151c", // cards
          3: "#1a1f29", // raised / hover
        },
        hairline: "#1e2430", // 1px borders
      },
      boxShadow: {
        // Soft, low-contrast elevation for cards on a dark canvas.
        card: "0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};
