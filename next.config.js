/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // In development, proxy /api/* to the local uvicorn server.
    // On Vercel, vercel.json rewrites handle routing before Next.js.
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/:path*",
          destination: "http://127.0.0.1:8001/api/:path*",
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;
