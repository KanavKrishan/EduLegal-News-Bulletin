import { Router } from "express";
import { listNotices, storageMode } from "../config/db.js";
import { scrapeNta } from "../services/scraper.js";

export const noticesRouter = Router();

const NEW_WINDOW_MS = 1000 * 60 * 60 * 48;

function shape(notice) {
  const firstSeen = new Date(notice.firstSeenAt);
  const sourceUrl = notice.sourceUrl || "";
  return {
    id: notice._id || notice.fingerprint,
    headline: notice.headline,
    originalTitle: notice.originalTitle,
    sourceUrl,
    source: notice.source || "ugcnet",
    exam: notice.exam || "General",
    category: notice.category,
    isPdf: /\.pdf($|\?)/i.test(sourceUrl),
    postedAt: notice.postedAt ? new Date(notice.postedAt) : null,
    firstSeenAt: firstSeen,
    isNew: Date.now() - firstSeen.getTime() < NEW_WINDOW_MS
  };
}

function payload(notices, extra = {}) {
  const exams = [...new Set(notices.map((n) => n.exam).filter(Boolean))].sort();
  return {
    count: notices.length,
    storage: storageMode(),
    exams,
    newCount: notices.filter((n) => n.isNew).length,
    sources: {
      ugcnet: notices.filter((n) => n.source === "ugcnet").length,
      nta: notices.filter((n) => n.source === "nta").length,
      nba: notices.filter((n) => n.source === "nba").length,
      aicte: notices.filter((n) => n.source === "aicte").length
    },
    notices,
    ...extra
  };
}

noticesRouter.get("/", async (_req, res) => {
  const notices = (await listNotices()).map(shape);
  res.json(payload(notices));
});

noticesRouter.post("/refresh", async (_req, res) => {
  try {
    const result = await scrapeNta();
    const notices = (await listNotices()).map(shape);
    res.json(payload(notices, result));
  } catch (err) {
    res.status(502).json({
      error: "Could not scrape official websites",
      detail: err.message
    });
  }
});
