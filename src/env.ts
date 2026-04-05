import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const root = process.cwd();
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(examplePath)) {
  // Only load .env.example if env vars aren't already set (i.e. local dev only)
  if (!process.env.MONGODB_URI && !process.env.JWT_SECRET) {
    console.warn(
      "[config] No .env file found — loading variables from .env.example. Create a .env file for local secrets.",
    );
    dotenv.config({ path: examplePath });
  } else {
    console.log(
      "[config] Running with environment variables from system (Render/production).",
    );
  }
} else {
  dotenv.config();
}
