import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";

export const PUT = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const feedbackId = parseObjectId(params.feedbackId);
  const body = await jsonBody(request);
  const project = await db.collection("projects").findOne({ _id: id });
  if (!project) throw notFound("Project not found");
  const feedback = (project.feedback ?? []) as any[];
  const entryIndex = feedback.findIndex((f) => f._id?.toString() === feedbackId.toString());
  if (entryIndex === -1) throw notFound("Feedback not found");

  if (body.rating !== undefined) {
    const rating = Number(body.rating);
    if (rating >= 1 && rating <= 5) feedback[entryIndex].rating = rating;
  }
  if (typeof body.comment === "string") feedback[entryIndex].comment = body.comment.trim();
  if (typeof body.clientName === "string") feedback[entryIndex].clientName = body.clientName.trim();
  if (typeof body.authorName === "string") feedback[entryIndex].authorName = body.authorName.trim();
  if (typeof body.company === "string") feedback[entryIndex].company = body.company.trim();
  if (typeof body.publishedAsTestimonial === "boolean") {
    feedback[entryIndex].publishedAsTestimonial = body.publishedAsTestimonial;
    if (body.publishedAsTestimonial && !feedback[entryIndex].testimonialPublishedAt) {
      feedback[entryIndex].testimonialPublishedAt = new Date();
    }
  }

  const result = await db.collection("projects").findOneAndUpdate(
    { _id: id },
    { $set: { feedback, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return json({ data: result?.feedback ?? [] });
}, { auth: "required" });

export const DELETE = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const feedbackId = parseObjectId(params.feedbackId);
  const project = await db.collection("projects").findOne({ _id: id });
  if (!project) throw notFound("Project not found");
  const feedback = (project.feedback ?? []).filter((f: any) => f._id?.toString() !== feedbackId.toString());
  const result = await db.collection("projects").findOneAndUpdate(
    { _id: id },
    { $set: { feedback, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return json({ data: result?.feedback ?? [] });
}, { auth: "required" });
