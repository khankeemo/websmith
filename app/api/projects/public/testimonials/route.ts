import { apiHandler, json } from "@/lib/server/api";

export const GET = apiHandler(async ({ db }) => {
  const projects = await db.collection("projects").find({ published: true }).toArray();
  const testimonials: any[] = [];
  for (const p of projects) {
    for (const f of p.feedback ?? []) {
      if (f.publishedAsTestimonial === true) {
        testimonials.push({
          _id: f._id?.toString() ?? `${p._id.toString()}-${testimonials.length}`,
          projectId: p._id.toString(),
          projectName: p.name,
          rating: f.rating,
          comment: f.comment,
          date: f.date,
          clientName: f.clientName,
        });
      }
    }
  }
  return json({ data: testimonials });
});
