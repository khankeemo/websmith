// FILE: app/api/cms/industries/[id]/route.ts
// PURPOSE: Admin update and deletion of individual CMS Industry

import { apiHandler, json, jsonBody, forbidden, notFound, parseObjectId, serialize } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, params }) => {
  const { id } = params;
  const doc = await db.collection("cms_industries").findOne({ _id: parseObjectId(id) });
  if (!doc) throw notFound("Industry not found");
  return json({ data: serialize(doc) });
});

export const PUT = apiHandler(
  async ({ db, request, params, user }) => {
    if (user.role !== "admin") throw forbidden();
    const { id } = params;
    const body = await jsonBody(request);

    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.slug !== undefined) updateData.slug = String(body.slug).trim();
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.shortDescription !== undefined) updateData.shortDescription = body.shortDescription;
    if (body.badge !== undefined) updateData.badge = body.badge;
    if (body.headline !== undefined) updateData.headline = body.headline;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.stats !== undefined) updateData.stats = body.stats;
    if (body.challenges !== undefined) updateData.challenges = body.challenges;
    if (body.architecture !== undefined) updateData.architecture = body.architecture;
    if (body.techStack !== undefined) updateData.techStack = body.techStack;
    if (body.caseStudy !== undefined) updateData.caseStudy = body.caseStudy;
    if (body.displayOrder !== undefined) updateData.displayOrder = Number(body.displayOrder);
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);

    const res = await db.collection("cms_industries").updateOne(
      { _id: parseObjectId(id) },
      { $set: updateData }
    );

    if (res.matchedCount === 0) throw notFound("Industry not found");

    const updated = await db.collection("cms_industries").findOne({ _id: parseObjectId(id) });
    return json({ data: serialize(updated) });
  },
  { auth: "required" }
);

export const DELETE = apiHandler(
  async ({ db, params, user }) => {
    if (user.role !== "admin") throw forbidden();
    const { id } = params;
    const res = await db.collection("cms_industries").deleteOne({ _id: parseObjectId(id) });
    if (res.deletedCount === 0) throw notFound("Industry not found");
    return json({ message: "Industry deleted successfully" });
  },
  { auth: "required" }
);
