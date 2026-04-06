import { Readable } from "stream";
import { v2 as cloudinary } from "cloudinary";

let configured = false;

/**
 * Call once at startup. Returns true if Cloudinary is ready (listing images go to the cloud).
 * If false, use local disk under /uploads as before.
 */
export function configureCloudinary(): boolean {
  const url = process.env.CLOUDINARY_URL?.trim();
  if (url?.startsWith("cloudinary://")) {
    const rest = url.replace("cloudinary://", "");
    const at = rest.lastIndexOf("@");
    if (at <= 0) return false;
    const cloud_name = rest.slice(at + 1);
    const keySecret = rest.slice(0, at);
    const colon = keySecret.indexOf(":");
    if (colon <= 0) return false;
    const api_key = keySecret.slice(0, colon);
    const api_secret = keySecret.slice(colon + 1);
    cloudinary.config({ cloud_name, api_key, api_secret });
    configured = true;
    console.log("[config] Listing images: Cloudinary (folder: %s)", uploadFolder());
    return true;
  }

  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (cloud_name && api_key && api_secret) {
    cloudinary.config({ cloud_name, api_key, api_secret });
    configured = true;
    console.log("[config] Listing images: Cloudinary (folder: %s)", uploadFolder());
    return true;
  }

  console.log("[config] Listing images: local disk (./uploads)");
  return false;
}

export function isCloudinaryEnabled(): boolean {
  return configured;
}

function uploadFolder(): string {
  return (process.env.CLOUDINARY_FOLDER || "reseller/listings").replace(/^\/+|\/+$/g, "");
}

/** Upload one image buffer to Cloudinary; returns HTTPS URL for storing in MongoDB. */
export function uploadImageBuffer(buffer: Buffer, _mimetype: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: uploadFolder(),
        resource_type: "image",
        overwrite: true,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result?.secure_url) {
          reject(new Error("Cloudinary upload returned no URL"));
          return;
        }
        resolve(result.secure_url);
      },
    );
    Readable.from(buffer).pipe(uploadStream);
  });
}
