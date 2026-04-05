import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import authRoutes from "./routes/auth";
import listingRoutes from "./routes/listings";
import billingRoutes from "./routes/billing";
import metaRoutes from "./routes/meta";

const app = express();

const VERCEL_PREVIEW_RE = /^https:\/\/client-reseller-[a-z0-9-]+\.vercel\.app$/;

function isAllowedOrigin(origin: string): boolean {
  // Explicit origins from CLIENT_URL env var
  const raw = process.env.CLIENT_URL || "http://localhost:5173";
  const explicit = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (explicit.includes(origin)) return true;

  // Allow all Vercel preview deployments for this project
  if (VERCEL_PREVIEW_RE.test(origin)) return true;

  // Allow localhost in any port for local dev
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;

  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Render health checks)
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) return callback(null, true);
      callback(new Error(`CORS: origin not allowed — ${origin}`));
    },
    credentials: true,
    maxAge: 86400,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

const uploadsPath = path.join(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsPath));

app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api", metaRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

export default app;
