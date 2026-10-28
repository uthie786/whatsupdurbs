/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Fonts read from disk by the story image route.
    outputFileTracingIncludes: {
      "/events/[slug]/story": ["./assets/fonts/**"],
    },
  },
};

export default nextConfig;
