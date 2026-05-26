// Central config for the Chrome extension.
// Build scripts or manual updates should keep these in sync with .env / Convex.
const CONFIG = {
  API_BASE: "https://canny-woodpecker-211.convex.site",
  WEB_BASE: "http://localhost:3000",
  LOCAL_PDF_API: "http://localhost:8000",
};

// For content scripts that cannot import modules
if (typeof globalThis !== "undefined") {
  globalThis.__RESUMOD_CONFIG__ = CONFIG;
}
