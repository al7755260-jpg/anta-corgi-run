// Public models/audio are copied unchanged by Vite. Resolve them against the
// app base so a GitHub Pages repository path never falls back to /assets/.
export function assetUrl(filename) {
  return `${import.meta.env.BASE_URL}assets/${filename}`;
}
