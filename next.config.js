/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "media.discordapp.net" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "images.macrumors.com" },
      { protocol: "https", hostname: "store.storeimages.cdn-apple.com" },
      { protocol: "https", hostname: "fbi.cults3d.com" },
      { protocol: "https", hostname: "images.icon-icons.com" },
      { protocol: "https", hostname: "www.trafalgar.com" },
      { protocol: "https", hostname: "scontent-bcn1-1.cdninstagram.com" },
      { protocol: "https", hostname: "scontent-gru1-1.cdninstagram.com" },
      { protocol: "https", hostname: "instagram.fixc4-2.fna.fbcdn.net" },
    ],
  },
};

export default config;
