import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";

export const PATCH = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const feedbackId = parseObjectId(params.feedbackId);
  const body = await jsonBody(request);
  const project = await db.collection("projects").findOne({ _id: id });
  if (!project) throw notFound("Project not found");
  const feedback = (project.feedback ?? []) as any[];
  const entry = feedback.find((f) => f._id?.toString() === feedbackId.toString());
  if (!entry) throw notFound("Feedback not found");
  entry.publishedAsTestimonial = body.published === true;
  entry.testimonialPublishedAt = entry.publishedAsTestimonial ? new Date() : null;
  const result = await db.collection("projects").findOneAndUpdate(
    { _id: id },
    { $set: { feedback, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return json({ data: result.feedback ?? [] });
}, { auth: "required" });
