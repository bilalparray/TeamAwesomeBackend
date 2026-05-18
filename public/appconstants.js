export const AppConstants = {
  // Use same machine as the page when opened via `node server` (http://localhost:3000).
  baseUrl:
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "http://localhost:3000",
  // baseUrl: "https://teamawesomebackend-sgsc.onrender.com",
  // baseUrl: "https://environmental-antonetta-bilalparray-82a778b4.koyeb.app",
};
