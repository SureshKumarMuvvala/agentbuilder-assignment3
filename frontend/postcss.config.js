// PostCSS pipeline Vite runs over our CSS: Tailwind expands the utility classes,
// Autoprefixer adds vendor prefixes.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
