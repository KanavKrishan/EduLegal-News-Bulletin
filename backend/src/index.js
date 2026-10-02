import "dotenv/config";

import cors from "cors";
import cron from "node-cron";
import express from "express";

import { connectDb } from "./config/db.js";
import { noticesRouter } from "./routes/notices.js";
import { scrapeNta } from "./services/scraper.js";

const app = express();

// Render provides PORT automatically
const port = Number(process.env.PORT) || 5000;

// Frontend URL for CORS
const origin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

// Middleware
app.use(
  cors({
    origin,
    credentials: true,
  }),
);

app.use(express.json());

// Root route
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "NTA Desk backend is running",
  });
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "nta-desk",
  });
});

// Notices API
app.use("/api/notices", noticesRouter);

// Scraper
async function refreshQuietly() {
  try {
    const result = await scrapeNta();

    if (!result.skipped) {
      console.log(
        `Scrape complete: scanned ${result.scanned}, new ${result.created}`,
      );
    }
  } catch (err) {
    console.error("Scheduled scrape failed:", err.message);
  }
}

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDb();

    // Scraping interval
    const minutes = Math.max(
      1,
      Number(process.env.SCRAPE_INTERVAL_MINUTES) || 10,
    );

    // Run scraper every X minutes
    cron.schedule(`*/${minutes} * * * *`, refreshQuietly);

    // Run once immediately after deployment
    await refreshQuietly();

    // Start Express
    app.listen(port, "0.0.0.0", () => {
      console.log(`Backend listening on port ${port}`);
      console.log(
        `Refreshing NTA, UGC-NET, NBA, and AICTE notices every ${minutes} minutes`,
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
