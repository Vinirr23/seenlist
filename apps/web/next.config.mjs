/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org" }],
  },
  transpilePackages: ["@seenlist/ui", "@seenlist/types", "@seenlist/utils", "@seenlist/hooks", "@seenlist/config"],
};

export default nextConfig;
