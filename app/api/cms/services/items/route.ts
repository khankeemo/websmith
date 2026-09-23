// FILE: app/api/cms/services/items/route.ts
// PURPOSE: Admin creation and retrieval of CMS Service items (subcategories)

import { apiHandler, json, jsonBody, forbidden, serialize } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, request }) => {
  const url = new URL(request.url);
  const categoryId = url.searchParams.get("categoryId");
  const query: Record<string, any> = {};
  if (categoryId) query.categoryId = categoryId;

  const items = await db.collection("cms_services").find(query).sort({ displayOrder: 1, name: 1 }).toArray();
  return json({ data: serialize(items) });
});

export const POST = apiHandler(
  async ({ db, request, user }) => {
    if (user.role !== "admin") throw forbidden();

    const body = await jsonBody(request);
    const name = String(body.name || "").trim();
    const categoryId = String(body.categoryId || "").trim();

    if (!name || !categoryId) {
      return json({ success: false, message: "Service name and category are required" }, { status: 400 });
    }

    const slug = (body.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")) || "service";

    const newItem = {
      categoryId,
      categoryName: body.categoryName || "",
      name,
      slug,
      icon: body.icon || "Code2",
      shortDescription: body.shortDescription || "",
      description: body.description || "",
      deliverables: Array.isArray(body.deliverables) ? body.deliverables : [],
      techStack: Array.isArray(body.techStack) ? body.techStack : [],
      displayOrder: Number(body.displayOrder) || 0,
      isActive: body.isActive !== false,
      showInMenu: body.showInMenu !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = await db.collection("cms_services").insertOne(newItem);
    return json({ data: { ...newItem, _id: res.insertedId.toString() } }, { status: 201 });
  },
  { auth: "required" }
);
