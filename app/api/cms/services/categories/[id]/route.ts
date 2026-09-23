// FILE: app/api/cms/services/categories/[id]/route.ts
// PURPOSE: Admin update and deletion of individual CMS Service Category

import { apiHandler, json, jsonBody, forbidden, notFound, parseObjectId, serialize } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, params }) => {
  const { id } = params;
  const doc = await db.collection("cms_service_categories").findOne({ _id: parseObjectId(id) });
  if (!doc) throw notFound("Service category not found");
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
    if (body.description !== undefined) updateData.description = body.description;
    if (body.badge !== undefined) updateData.badge = body.badge;
    if (body.displayOrder !== undefined) updateData.displayOrder = Number(body.displayOrder);
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);

    const res = await db.collection("cms_service_categories").updateOne(
      { _id: parseObjectId(id) },
      { $set: updateData }
    );

    if (res.matchedCount === 0) throw notFound("Service category not found");

    // If name changed, update cached categoryName in child services
    if (updateData.name) {
      await db.collection("cms_services").updateMany(
        { categoryId: id },
        { $set: { categoryName: updateData.name } }
      );
    }

    const updated = await db.collection("cms_service_categories").findOne({ _id: parseObjectId(id) });
    return json({ data: serialize(updated) });
  },
  { auth: "required" }
);

export const DELETE = apiHandler(
  async ({ db, params, user }) => {
    if (user.role !== "admin") throw forbidden();
    const { id } = params;
    const res = await db.collection("cms_service_categories").deleteOne({ _id: parseObjectId(id) });
    if (res.deletedCount === 0) throw notFound("Service category not found");

    // Delete subservices under this category
    await db.collection("cms_services").deleteMany({ categoryId: id });

    return json({ message: "Category and its subcategories deleted successfully" });
  },
  { auth: "required" }
);
