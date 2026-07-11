/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      // TASK-067 — ilustração de personagem de anime (Jikan/MyAnimeList, lib/anime/jikan.ts)
      { protocol: "https", hostname: "cdn.myanimelist.net" },
    ],
  },
  transpilePackages: ["@seenlist/ui", "@seenlist/types", "@seenlist/utils", "@seenlist/hooks", "@seenlist/config"],
};

export default nextConfig;
