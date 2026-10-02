import "dotenv/config";
import cors from "cors";
import cron from "node-cron";
import express from "express";
import { connectDb } from "./config/db.js";
import { noticesRouter } from "./routes/notices.js";
import { scrapeNta } from "./services/scraper.js";

const app = express();
const port = Number(process.env.PORT) || 5000;
const origin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(cors({ origin }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "nta-desk" });
});

app.use("/api/notices", noticesRouter);

async function refreshQuietly() {
  try {
    const result = await scrapeNta();
    if (!result.skipped) {
      console.log(
        `Scrape complete: scanned ${result.scanned}, new ${result.created}`
      );
    }
  } catch (err) {
    console.error("Scheduled scrape failed:", err.message);
  }
}

await connectDb();

const minutes = Math.max(1, Number(process.env.SCRAPE_INTERVAL_MINUTES) || 10);
cron.schedule(`*/${minutes} * * * *`, refreshQuietly);

refreshQuietly();

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  console.log(`Refreshing NTA, UGC-NET, NBA, and AICTE notices every ${minutes} minutes`);
});
