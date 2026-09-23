// FILE: app/api/cms/services/items/[id]/route.ts
// PURPOSE: Admin update and deletion of individual CMS Service item

import { apiHandler, json, jsonBody, forbidden, notFound, parseObjectId, serialize } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, params }) => {
  const { id } = params;
  const doc = await db.collection("cms_services").findOne({ _id: parseObjectId(id) });
  if (!doc) throw notFound("Service not found");
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
    if (body.categoryId !== undefined) updateData.categoryId = String(body.categoryId).trim();
    if (body.categoryName !== undefined) updateData.categoryName = body.categoryName;
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.shortDescription !== undefined) updateData.shortDescription = body.shortDescription;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.deliverables !== undefined) updateData.deliverables = body.deliverables;
    if (body.techStack !== undefined) updateData.techStack = body.techStack;
    if (body.displayOrder !== undefined) updateData.displayOrder = Number(body.displayOrder);
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);
    if (body.showInMenu !== undefined) updateData.showInMenu = Boolean(body.showInMenu);

    const res = await db.collection("cms_services").updateOne(
      { _id: parseObjectId(id) },
      { $set: updateData }
    );

    if (res.matchedCount === 0) throw notFound("Service not found");

    const updated = await db.collection("cms_services").findOne({ _id: parseObjectId(id) });
    return json({ data: serialize(updated) });
  },
  { auth: "required" }
);

export const DELETE = apiHandler(
  async ({ db, params, user }) => {
    if (user.role !== "admin") throw forbidden();
    const { id } = params;
    const res = await db.collection("cms_services").deleteOne({ _id: parseObjectId(id) });
    if (res.deletedCount === 0) throw notFound("Service not found");
    return json({ message: "Service deleted successfully" });
  },
  { auth: "required" }
);
