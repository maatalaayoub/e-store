/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

// Content Security Policy.
// `script-src 'unsafe-inline' 'unsafe-eval'` is needed in dev because Next's
// HMR + React Refresh runtime use eval / inline scripts. In prod we drop
// 'unsafe-eval' but keep 'unsafe-inline' (Next still emits inline bootstrap).
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.telegram.org https://get.geojs.io https://open.er-api.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), interest-cohort=()' },
  { key: 'Content-Security-Policy', value: CSP },
  // HSTS only meaningful over HTTPS; browsers ignore it on plain localhost.
  ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }] : []),
];

const nextConfig = {
  reactCompiler: true,
  // isomorphic-dompurify → jsdom has native bindings that webpack cannot bundle.
  // Tell Next.js to require() them from node_modules at runtime instead.
  serverExternalPackages: ['isomorphic-dompurify', 'jsdom'],
  allowedDevOrigins: [
    'localhost',
    '192.168.8.102',
    '192.168.8.102:3000',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
    ];
  },
};

export default nextConfig;
