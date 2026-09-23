// FILE: app/api/cms/services/categories/route.ts
// PURPOSE: Public & Admin API for CMS Service Categories with auto-seeding and nested subcategories

import { apiHandler, json, jsonBody, forbidden, serialize } from "@/lib/server/api";
import { SEED_SERVICE_CATEGORIES } from "@/lib/cms/types";

export const GET = apiHandler(async ({ db, request }) => {
  const url = new URL(request.url);
  const isAdmin = url.searchParams.get("admin") === "true";
  const menuOnly = url.searchParams.get("menuOnly") === "true";

  const catCollection = db.collection("cms_service_categories");
  const itemCollection = db.collection("cms_services");

  const catCount = await catCollection.countDocuments({});

  if (catCount === 0) {
    for (const catSeed of SEED_SERVICE_CATEGORIES) {
      const catDoc = {
        name: catSeed.name,
        slug: catSeed.slug,
        icon: catSeed.icon,
        description: catSeed.description,
        badge: catSeed.badge,
        displayOrder: catSeed.displayOrder,
        isActive: catSeed.isActive,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const catRes = await catCollection.insertOne(catDoc);
      const categoryId = catRes.insertedId.toString();

      for (const svc of catSeed.services) {
        await itemCollection.insertOne({
          categoryId,
          categoryName: catSeed.name,
          name: svc.name,
          slug: svc.slug,
          icon: svc.icon,
          shortDescription: svc.shortDescription,
          description: svc.description,
          deliverables: svc.deliverables,
          techStack: svc.techStack,
          displayOrder: svc.displayOrder,
          isActive: svc.isActive,
          showInMenu: svc.showInMenu,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  const catQuery = isAdmin ? {} : { isActive: { $ne: false } };
  const categories = await catCollection.find(catQuery).sort({ displayOrder: 1, name: 1 }).toArray();

  let itemQuery: Record<string, any> = {};
  if (!isAdmin) {
    itemQuery.isActive = { $ne: false };
    if (menuOnly) {
      itemQuery.showInMenu = { $ne: false };
    }
  }

  const allServices = await itemCollection.find(itemQuery).sort({ displayOrder: 1, name: 1 }).toArray();

  // Attach services to their respective categories
  const categoriesWithServices = categories.map((cat) => {
    const catId = cat._id.toString();
    const services = allServices
      .filter((s) => s.categoryId === catId || s.categoryId === cat.slug)
      .map((s) => ({ ...s, _id: s._id.toString() }));
    return {
      ...cat,
      _id: catId,
      services,
    };
  });

  return json({ data: serialize(categoriesWithServices) });
});

export const POST = apiHandler(
  async ({ db, request, user }) => {
    if (user.role !== "admin") throw forbidden();

    const body = await jsonBody(request);
    const name = String(body.name || "").trim();
    if (!name) {
      return json({ success: false, message: "Category name is required" }, { status: 400 });
    }

    const slug = (body.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")) || "category";

    const newCategory = {
      name,
      slug,
      icon: body.icon || "Code2",
      description: body.description || "",
      badge: body.badge || "",
      displayOrder: Number(body.displayOrder) || 0,
      isActive: body.isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = await db.collection("cms_service_categories").insertOne(newCategory);
    return json({ data: { ...newCategory, _id: res.insertedId.toString(), services: [] } }, { status: 201 });
  },
  { auth: "required" }
);
