import type { MetadataRoute } from "next";

const siteUrl = "https://www.blanklogo.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const publicRoutes = [
    "/",
    "/pricing",
    "/privacy",
    "/terms",
    "/remove/sora",
    "/remove/tiktok",
    "/remove/runway",
    "/remove/pika",
    "/remove/kling",
    "/remove/luma",
  ];

  return publicRoutes.map((route) => ({ url: `${siteUrl}${route}` }));
}
