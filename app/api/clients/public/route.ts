import { apiHandler, json } from "@/lib/server/api";

export const GET = apiHandler(async ({ db }) => {
  try {
    const clients = await db.collection("users").find({ role: "client", published: true }).sort({ name: 1 }).toArray();
    const data = clients.map((c) => ({
      _id: c._id.toString(),
      name: c.name,
      email: c.email,
      phone: c.phone ?? "",
      company: c.company ?? "",
      address: c.address ?? "",
      status: c.status ?? "active",
      customId: c.customId,
    }));
    return json({ data });
  } catch (error) {
    console.warn("Public clients read warning (returning empty list):", error instanceof Error ? error.message : error);
    return json({ data: [] });
  }
});
