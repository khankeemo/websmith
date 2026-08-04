import { apiHandler, json, badRequest } from "@/lib/server/api";

export const POST = apiHandler(async ({ db, request }) => {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) throw badRequest("No file provided");
  if (file.size > 5 * 1024 * 1024) {
    return json({ success: false, error: "File must be 5MB or smaller", message: "File must be 5MB or smaller" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const doc = {
    name: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
    data: buffer.toString("base64"),
    createdAt: new Date(),
  };
  const result = await db.collection("uploads").insertOne(doc);
  return json({ data: { url: `/api/uploads/${result.insertedId.toString()}`, type: file.type || "application/octet-stream" } }, { status: 201 });
}, { auth: "required" });
