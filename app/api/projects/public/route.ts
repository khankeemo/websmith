import { apiHandler, json } from "@/lib/server/api";

export const GET = apiHandler(async ({ db }) => {
  const projects = await db.collection("projects").find({ published: true }).sort({ createdAt: -1 }).limit(12).toArray();
  const data = projects.map((p) => ({
    _id: p._id.toString(),
    name: p.name,
    description: p.description,
    publicUrl: p.publicUrl,
    previewImage: p.previewImage,
    clientName: p.client,
    status: p.status,
    category: p.projectType ?? null,
  }));
  return json({ data });
});
