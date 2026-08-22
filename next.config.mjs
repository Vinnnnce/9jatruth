/** @type {import('next').NextConfig} */
const basePath = process.env.DEPLOY_BASE_PATH || '';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compiler: {
    // Strip console.log/debug in production (keep errors) for smaller, faster bundles
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "maps.googleapis.com" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Tree-shake barrel-export-heavy libs so only used icons/charts ship to the client
    optimizePackageImports: [
      "lucide-react",
      "react-icons",
      "recharts",
      "framer-motion",
      "date-fns",
      "@radix-ui/react-icons",
    ],
  },
  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com https://clerk.9jatruth.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.clerk.accounts.dev https://*.clerk.com https://clerk.9jatruth.com; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.moonshot.ai https://maps.googleapis.com https://maps.gstatic.com https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com https://clerk.9jatruth.com; frame-src 'self' https://www.google.com https://*.clerk.accounts.dev https://*.clerk.com https://clerk.9jatruth.com; worker-src 'self' blob:;" },
        ],
      },
    ];
  },
  // When deployed via deploy_website, the proxy serves the app under /port/5000/
  ...(basePath ? { basePath, assetPrefix: `${basePath}/` } : {}),
};

export default nextConfig;
