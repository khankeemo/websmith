import { parseObjectId, notFound, getMongoUri, MongoClient } from "@/lib/server/api";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let client: MongoClient | null = null;
  try {
    const objectId = parseObjectId(id);
    client = new MongoClient(getMongoUri());
    await client.connect();
    const doc = await client.db("WSD").collection("uploads").findOne({ _id: objectId });
    if (!doc || typeof doc.data !== "string") throw notFound("File not found");
    const buffer = Buffer.from(doc.data, "base64");
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": doc.contentType || "application/octet-stream",
        "Content-Length": String(buffer.length),
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.name || "file")}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    if (client) { try { await client.close(); } catch {} }
    if (error instanceof Error && "status" in error) {
      const status = (error as any).status;
      return new Response(JSON.stringify({ success: false, error: error.message }), { status, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ success: false, error: "An unexpected error occurred" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
