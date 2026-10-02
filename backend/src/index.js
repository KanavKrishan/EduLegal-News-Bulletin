import "dotenv/config";

import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import cron from "node-cron";
import express from "express";

import { connectDb } from "./config/db.js";
import { noticesRouter } from "./routes/notices.js";
import { scrapeNta } from "./services/scraper.js";

const app = express();

const port = Number(process.env.PORT) || 5000;

const origin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

// --------------------------------------------------
// Find frontend/dist
// --------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendDist = path.resolve(__dirname, "../../frontend/dist");

console.log("Frontend dist path:", frontendDist);

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(
  cors({
    origin,
    credentials: true,
  }),
);

app.use(express.json());

// --------------------------------------------------
// API Routes
// --------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "nta-desk",
  });
});

app.use("/api/notices", noticesRouter);

// --------------------------------------------------
// Serve React frontend
// --------------------------------------------------

app.use(express.static(frontendDist));

// React Router fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

// --------------------------------------------------
// Start server FIRST
// --------------------------------------------------

app.listen(port, "0.0.0.0", () => {
  console.log(`Backend listening on port ${port}`);
});

// --------------------------------------------------
// Database + Scraper
// --------------------------------------------------

async function startServices() {
  try {
    await connectDb();

    const minutes = Math.max(
      1,
      Number(process.env.SCRAPE_INTERVAL_MINUTES) || 10,
    );

    console.log(
      `Refreshing NTA, UGC-NET, NBA, and AICTE notices every ${minutes} minutes`,
    );

    // Scheduled scraping
    cron.schedule(`*/${minutes} * * * *`, async () => {
      console.log("Starting scheduled scrape...");

      try {
        const result = await scrapeNta();

        if (!result.skipped) {
          console.log(
            `Scrape complete: scanned ${result.scanned}, new ${result.created}`,
          );

          console.log("Sources:", result.sources);
        }
      } catch (error) {
        console.error("Scheduled scrape failed:", error.message);
      }
    });

    // Initial scrape
    scrapeNta()
      .then((result) => {
        if (!result.skipped) {
          console.log(
            `Initial scrape complete: scanned ${result.scanned}, new ${result.created}`,
          );

          console.log("Sources:", result.sources);
        }
      })
      .catch((error) => {
        console.error("Initial scrape failed:", error.message);
      });
  } catch (error) {
    console.error("Failed to initialize services:", error);
  }
}

startServices();
