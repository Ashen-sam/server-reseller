import { v2 as cloudinary } from "cloudinary";
import { normalizeEnvString } from "../utils/envString";

let configured = false;

/**
 * Call once at startup. Returns true if Cloudinary is ready (listing images go to the cloud).
 * If false, use local disk under /uploads as before.
 */
export function configureCloudinary(): boolean {
  const url = normalizeEnvString(process.env.CLOUDINARY_URL);
  const cloud_name = normalizeEnvString(process.env.CLOUDINARY_CLOUD_NAME);
  const api_key = normalizeEnvString(process.env.CLOUDINARY_API_KEY);
  const api_secret = normalizeEnvString(process.env.CLOUDINARY_API_SECRET);

  if (url) {
    process.env.CLOUDINARY_URL = url;
  }

  if (!url && !(cloud_name && api_key && api_secret)) {
    console.log("[config] Listing images: local disk (./uploads)");
    return false;
  }

  try {
    if (url) {
      cloudinary.config(true);
    } else {
      cloudinary.config({
        cloud_name: cloud_name!,
        api_key: api_key!,
        api_secret: api_secret!,
      });
    }
  } catch (e) {
    console.error("[config] Cloudinary configuration failed:", e);
    return false;
  }

  const cfg = cloudinary.config() as {
    cloud_name?: string;
    api_key?: string;
    api_secret?: string;
  };
  if (cfg.cloud_name && cfg.api_key && cfg.api_secret) {
    configured = true;
    console.log("[config] Listing images: Cloudinary (folder: %s)", uploadFolder());
    return true;
  }

  console.warn("[config] Cloudinary env incomplete; using local disk");
  return false;
}

export function isCloudinaryEnabled(): boolean {
  return configured;
}

function uploadFolder(): string {
  return (process.env.CLOUDINARY_FOLDER || "reseller/listings").replace(/^\/+|\/+$/g, "");
}

function cloudinaryErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as Error).message === "string") {
    return (err as Error).message;
  }
  return "Upload failed";
}

/** Upload one image buffer to Cloudinary; returns HTTPS URL for storing in MongoDB. */
export function uploadImageBuffer(buffer: Buffer, mimetype: string): Promise<string> {
  if (!buffer?.length) {
    return Promise.reject(new Error("Empty image buffer"));
  }
  const mt = mimetype && /^image\//i.test(mimetype) ? mimetype : "image/jpeg";
  const dataUri = `data:${mt};base64,${buffer.toString("base64")}`;

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      dataUri,
      {
        folder: uploadFolder(),
        resource_type: "image",
        overwrite: true,
      },
      (error: unknown, result?: { secure_url?: string }) => {
        if (error) {
          reject(new Error(cloudinaryErrorMessage(error)));
          return;
        }
        if (!result?.secure_url) {
          reject(new Error("Cloudinary upload returned no URL"));
          return;
        }
        resolve(result.secure_url);
      },
    );
  });
}
