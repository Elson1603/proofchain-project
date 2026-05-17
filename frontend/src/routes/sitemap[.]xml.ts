import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://id-preview--4a4ec6cd-4441-4373-a0fb-684396269a44.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/auth", changefreq: "weekly", priority: "0.8" },
          { path: "/developers", changefreq: "weekly", priority: "0.8" },
          { path: "/project-details", changefreq: "weekly", priority: "0.8" },
          { path: "/freelancer/dashboard", changefreq: "daily", priority: "0.7" },
          { path: "/freelancer/submit-work", changefreq: "daily", priority: "0.7" },
          { path: "/freelancer/nft-certificates", changefreq: "daily", priority: "0.7" },
          { path: "/freelancer/earnings", changefreq: "daily", priority: "0.7" },
          { path: "/client/dashboard", changefreq: "daily", priority: "0.7" },
          { path: "/client/approval-workflow", changefreq: "daily", priority: "0.7" },
        ];

        const urls = entries.map((entry) =>
          [
            "  <url>",
            `    <loc>${BASE_URL}${entry.path}</loc>`,
            entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
            entry.priority ? `    <priority>${entry.priority}</priority>` : null,
            "  </url>",
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls,
          "</urlset>",
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
