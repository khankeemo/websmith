// FILE: app/api/cms/industries/route.ts
// PURPOSE: Public & Admin API for CMS Industries with auto-seeding

import { apiHandler, json, jsonBody, forbidden, serialize } from "@/lib/server/api";
import { SEED_INDUSTRIES, CmsIndustry } from "@/lib/cms/types";

export const GET = apiHandler(async ({ db, request }) => {
  const url = new URL(request.url);
  const isAdmin = url.searchParams.get("admin") === "true";

  const collection = db.collection("cms_industries");
  const count = await collection.countDocuments({});

  if (count === 0) {
    for (const item of SEED_INDUSTRIES) {
      await collection.insertOne({
        ...item,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  const query = isAdmin ? {} : { isActive: { $ne: false } };
  const items = await collection.find(query).sort({ displayOrder: 1, name: 1 }).toArray();

  return json({ data: serialize(items) });
});

export const POST = apiHandler(
  async ({ db, request, user }) => {
    if (user.role !== "admin") throw forbidden();

    const body = await jsonBody(request);
    const name = String(body.name || "").trim();
    if (!name) {
      return json({ success: false, message: "Industry name is required" }, { status: 400 });
    }

    const slug = (body.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")) || "industry";

    const newIndustry: Omit<CmsIndustry, "_id"> = {
      name,
      slug,
      icon: body.icon || "Landmark",
      shortDescription: body.shortDescription || "",
      badge: body.badge || "",
      headline: body.headline || "",
      description: body.description || "",
      stats: Array.isArray(body.stats) ? body.stats : [],
      challenges: Array.isArray(body.challenges) ? body.challenges : [],
      architecture: Array.isArray(body.architecture) ? body.architecture : [],
      techStack: Array.isArray(body.techStack) ? body.techStack : [],
      caseStudy: body.caseStudy || undefined,
      displayOrder: Number(body.displayOrder) || 0,
      isActive: body.isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = await db.collection("cms_industries").insertOne(newIndustry);
    return json({ data: { ...newIndustry, _id: res.insertedId.toString() } }, { status: 201 });
  },
  { auth: "required" }
);
