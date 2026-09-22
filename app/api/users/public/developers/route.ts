import { apiHandler, json, serialize } from "@/lib/server/api";

export const GET = apiHandler(async ({ db }) => {
  try {
    const developers = await db
      .collection("users")
      .find({ role: "developer", published: true })
      .sort({ name: 1 })
      .toArray();
    const data = developers.map((u) => ({
      _id: u._id.toString(),
      name: u.name,
      email: u.email,
      phone: u.phone ?? "",
      company: u.company ?? "",
      headline: u.headline ?? "",
      bio: u.bio ?? "",
      skills: u.skills ?? [],
      experienceYears: u.experienceYears ?? 0,
      status: u.status ?? "active",
      joinedAt: u.joinedAt ?? null,
      avatar: u.avatar ?? "",
      published: u.published ?? true,
    }));
    return json({ data });
  } catch (error) {
    console.warn("Public developers read warning (returning empty list):", error instanceof Error ? error.message : error);
    return json({ data: [] });
  }
});
