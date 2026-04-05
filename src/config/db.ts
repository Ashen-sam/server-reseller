import mongoose from "mongoose";

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  console.log("[db] Connecting to MongoDB...");
  console.log("[db] URI starts with:", uri.substring(0, 30) + "...");

  try {
    await mongoose.connect(uri);
    console.log("[db] MongoDB connected successfully ✅");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      e &&
      typeof e === "object" &&
      "code" in e &&
      typeof (e as { code: unknown }).code === "number"
        ? (e as { code: number }).code
        : undefined;

    console.error("[db] MongoDB connection FAILED ❌");
    console.error("[db] Error message:", msg);
    console.error("[db] Error code:", code);

    const looksLocal = /127\.0\.0\.1|localhost/i.test(uri);
    if (looksLocal && /ECONNREFUSED|connect ECONNREFUSED/i.test(msg)) {
      console.error(
        `Cannot reach MongoDB at ${uri} — start Mongo locally or use Atlas.`,
      );
    }
    if (/bad auth|authentication failed/i.test(msg) || code === 8000) {
      console.error(
        `Atlas rejected the database username/password (bad auth). Check Database Access in Atlas.`,
      );
    }
    throw e;
  }
}
