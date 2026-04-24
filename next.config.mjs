/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: [
    'localhost',
    '192.168.8.102',
    '192.168.8.102:3000'
  ],
};

export default nextConfig;
