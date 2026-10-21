import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/app",
        "/forgot-password",
        "/login",
        "/reset-password",
        "/signup",
      ],
    },
    sitemap: "https://www.blanklogo.app/sitemap.xml",
  };
}
