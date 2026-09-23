// FILE: app/api/projects/public/testimonials/route.ts
// PURPOSE: Public API for published testimonials from project feedback

import { apiHandler, json } from "@/lib/server/api";

export const GET = apiHandler(async ({ db }) => {
  const testimonials: any[] = [];
  try {
    const projects = await db.collection("projects").find({ published: true }).toArray();
    for (const p of projects) {
      for (const f of p.feedback ?? []) {
        if (f.publishedAsTestimonial === true) {
          testimonials.push({
            _id: f._id?.toString() ?? `${p._id.toString()}-${testimonials.length}`,
            projectId: p._id.toString(),
            projectName: p.name,
            name: f.authorName || f.clientName || "Client",
            clientName: f.clientName || f.authorName || "Client",
            company: f.company || p.clientCompany || p.client || "Enterprise Client",
            quote: f.comment || f.quote || "",
            comment: f.comment || f.quote || "",
            rating: Number(f.rating) || 5,
            date: f.date || "",
          });
        }
      }
    }
    return json({ data: testimonials });
  } catch (error) {
    console.warn("Public testimonials read warning (returning empty list):", error instanceof Error ? error.message : error);
    return json({ data: testimonials });
  }
});
