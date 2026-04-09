import express from "express";
import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import path from "path";
import authRoutes from "./routes/auth";
import listingRoutes from "./routes/listings";
import billingRoutes from "./routes/billing";
import metaRoutes from "./routes/meta";
import adminRoutes from "./routes/admin";

const app = express();
// Correct client IP / secure cookies when behind Render / Cloudflare
app.set("trust proxy", 1);

const VERCEL_PREVIEW_RE = /^https:\/\/client-reseller-[a-z0-9-]+\.vercel\.app$/;

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://client-reseller.vercel.app",
];

function isAllowedOrigin(origin: string): boolean {
  const raw = process.env.CLIENT_URL?.trim();
  const explicit = raw
    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_CORS_ORIGINS;
  if (explicit.includes(origin)) return true;

  // Allow all Vercel preview deployments for this project
  if (VERCEL_PREVIEW_RE.test(origin)) return true;

  // Allow localhost in any port for local dev
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;

  return false;
}

app.use(
  cors({
    // With credentials: true, Allow-Origin must be the request origin string — never "*".
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, false);
      }
      if (isAllowedOrigin(origin)) {
        return callback(null, origin);
      }
      callback(new Error(`CORS: origin not allowed — ${origin}`));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

const uploadsPath = path.join(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsPath));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api", metaRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Each image must be 5MB or smaller."
        : err.message;
    res.status(400).json({ message });
    return;
  }
  console.error("[express]", err);
  res.status(500).json({ message: "Internal server error" });
});

export default app;
