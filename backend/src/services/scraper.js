import crypto from "node:crypto";
import axios from "axios";
import * as cheerio from "cheerio";

import { upsertNotices } from "../config/db.js";

import {
  summarizeHeadline,
  extractPostedDate,
  decodeEntities,
  detectExam,
} from "./summarize.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const NTA_ORIGIN = "https://nta.ac.in";
const NBA_ORIGIN = "https://www.nbaind.org";
const AICTE_ORIGIN = "https://www.aicte.gov.in";

let scraping = false;

function fingerprint(url, title) {
  return crypto
    .createHash("sha1")
    .update(`${url}|${title}`.toLowerCase())
    .digest("hex");
}

const REQUEST_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/json",
  "Accept-Language": "en-IN,en;q=0.9",
};

async function fetchHtml(url) {
  const { data } = await axios.get(url, {
    headers: REQUEST_HEADERS,
    timeout: 25000,
  });

  return data;
}

async function fetchJson(url) {
  const { data } = await axios.get(url, {
    headers: {
      ...REQUEST_HEADERS,
      Accept: "application/json, text/plain, */*",
    },
    timeout: 25000,
  });

  return data;
}

function absUrl(href, origin) {
  if (!href) return "";

  try {
    return new URL(href, origin).href;
  } catch {
    return href;
  }
}

function parseFlexibleDate(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const text = String(value).trim();

  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (iso) {
    const date = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00.000Z`);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);

  if (dmy) {
    const date = new Date(
      `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(
        2,
        "0",
      )}T12:00:00.000Z`,
    );

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const parsed = new Date(text);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pushItem(bucket, item) {
  if (!item.title || !item.sourceUrl) return;

  if (item.title.toLowerCase().includes("no post to display")) {
    return;
  }

  if (/examcalendar\.pdf$/i.test(item.sourceUrl)) {
    return;
  }

  if (/^read more$/i.test(item.title)) {
    return;
  }

  if (/^(click here|read more)$/i.test(item.title)) {
    return;
  }

  if (item.sourceUrl === "#" || item.sourceUrl.endsWith("#")) {
    return;
  }

  const key = fingerprint(item.sourceUrl, item.title);

  if (bucket.has(key)) {
    return;
  }

  bucket.set(key, item);
}

/* =========================================================
   UGC-NET
========================================================= */

function scrapeUgcHome(html) {
  const $ = cheerio.load(html);
  const found = new Map();

  $("#whats-new .gen-list li a").each((_, el) => {
    const title = decodeEntities($(el).text());
    const sourceUrl = $(el).attr("href");

    pushItem(found, {
      title,
      sourceUrl,
      category: "public-notice",
      source: "ugcnet",
    });
  });

  $("#forms .gen-list li a").each((_, el) => {
    const title = decodeEntities($(el).text());
    const sourceUrl = $(el).attr("href");

    pushItem(found, {
      title,
      sourceUrl,
      category: "news-events",
      source: "ugcnet",
    });
  });

  $(".newsticker ul.slides li")
    .not(".clone")
    .find("a")
    .each((_, el) => {
      const title = decodeEntities($(el).text());
      const sourceUrl = $(el).attr("href");

      pushItem(found, {
        title,
        sourceUrl,
        category: "latest-news",
        source: "ugcnet",
      });
    });

  $("h2")
    .filter((_, el) => /candidate activity/i.test($(el).text()))
    .first()
    .closest(".gen-list")
    .find("ul li a")
    .each((_, el) => {
      const title = decodeEntities($(el).text());
      const sourceUrl = $(el).attr("href");

      pushItem(found, {
        title,
        sourceUrl,
        category: "important",
        source: "ugcnet",
      });
    });

  return [...found.values()];
}

function scrapeArchiveTable(html, category = "public-notice") {
  const $ = cheerio.load(html);
  const found = new Map();

  $("table.doc-table tbody tr").each((_, row) => {
    const link = $(row).find("td").first().find("a").first();

    const title = decodeEntities(link.text());
    const sourceUrl = link.attr("href");
    const dateText = decodeEntities($(row).find("td").eq(1).text());

    pushItem(found, {
      title,
      sourceUrl,
      category,
      source: "ugcnet",
      dateText,
    });
  });

  return [...found.values()];
}

/* =========================================================
   NTA
========================================================= */

function scrapeNtaHq(html) {
  const $ = cheerio.load(html);
  const found = new Map();

  $("#govtUpdateContent .govt-update-item").each((_, el) => {
    const link = $(el).find("a").first();

    const title = decodeEntities(
      $(el)
        .clone()
        .find("a")
        .remove()
        .end()
        .text()
        .replace(/^NEW\s*/i, ""),
    );

    const sourceUrl = absUrl(link.attr("href"), NTA_ORIGIN);

    pushItem(found, {
      title,
      sourceUrl,
      category: "nta-alert",
      source: "nta",
    });
  });

  $(".latestPart p, .box-part-home-latest p").each((_, el) => {
    const content = $(el).find("content").first();
    const link = $(el).find("a[href]").first();

    const title = decodeEntities(
      content.length
        ? content.text()
        : $(el).clone().find("a, i, img").remove().end().text(),
    );

    const sourceUrl = absUrl(link.attr("href"), NTA_ORIGIN);

    pushItem(found, {
      title,
      sourceUrl,
      category: "nta-notice",
      source: "nta",
    });
  });

  return [...found.values()];
}

/* =========================================================
   NBA
========================================================= */

function scrapeNbaLatestHtml(html) {
  const $ = cheerio.load(html);
  const found = new Map();

  $(".right-sidebar ol li").each((_, el) => {
    const link = $(el).find("a[href]").first();

    const title = decodeEntities(link.text());

    const sourceUrl = absUrl(link.attr("href"), NBA_ORIGIN);

    const dateText = decodeEntities(
      $(el)
        .clone()
        .find("a, br")
        .remove()
        .end()
        .text()
        .replace(/published on/i, ""),
    );

    pushItem(found, {
      title,
      sourceUrl,
      category: "nba-latest",
      source: "nba",
      dateText,
    });
  });

  return [...found.values()];
}

function scrapeNbaNewsJson(payload) {
  const found = new Map();

  const rows = Array.isArray(payload?.UL) ? payload.UL : [];

  for (const row of rows) {
    const title = decodeEntities(row.Details || row.details || "");

    const sourceUrl = absUrl(
      row.UploadPath || row.uploadPath || "",
      NBA_ORIGIN,
    );

    pushItem(found, {
      title,
      sourceUrl,
      category: "nba-latest",
      source: "nba",
      dateText: row.PublishDate || row.CreatedDate || "",
    });
  }

  return [...found.values()];
}

/* =========================================================
   AICTE
========================================================= */

function aicteCategory(label) {
  const t = String(label || "").toLowerCase();

  if (t.includes("circular")) {
    return "aicte-circular";
  }

  if (t.includes("advert")) {
    return "aicte-advertisement";
  }

  if (t.includes("announce") || t.includes("notif")) {
    return "aicte-announcement";
  }

  return "aicte-notice";
}

function pickAicteSourceUrl($, root, fallbackUrl) {
  const hrefs = $(root)
    .find("a[href]")
    .toArray()
    .map((el) => String($(el).attr("href") || "").trim())
    .filter((href) => href && href !== "#");

  const pdf = hrefs.find((href) => /\.pdf($|\?)/i.test(href));

  return absUrl(pdf || hrefs[0] || fallbackUrl, AICTE_ORIGIN);
}

function pushAicteItem(bucket, item) {
  if (!item.title) return;

  const { fallbackUrl, ...rest } = item;

  const sourceUrl = rest.sourceUrl || fallbackUrl;

  if (!sourceUrl) return;

  pushItem(bucket, {
    ...rest,
    sourceUrl,
    source: "aicte",
  });
}

function scrapeAicteHome(html, fallbackUrl = `${AICTE_ORIGIN}/`) {
  const $ = cheerio.load(html);
  const found = new Map();

  $(".noticeMainContainer .noticeItem").each((_, col) => {
    const label = decodeEntities($(col).find(".columnTitle").first().text());

    const category = aicteCategory(label);

    $(col)
      .find(".marqueeItem")
      .each((__, item) => {
        const title = decodeEntities(
          $(item).find(".marqueeDetails a, .marqueeDetails p").first().text(),
        );

        const dateAttr = $(item).find("time").attr("datetime");

        const dateText = decodeEntities($(item).find("time").text());

        pushAicteItem(found, {
          title,
          sourceUrl: pickAicteSourceUrl($, item, fallbackUrl),
          fallbackUrl,
          category,
          dateText: dateAttr || dateText,
        });
      });
  });

  return [...found.values()];
}

function scrapeAicteBulletinList(html, category, fallbackUrl) {
  const $ = cheerio.load(html);
  const found = new Map();

  $(".view-bulletin-advertisement-view .advertisementListItem").each(
    (_, el) => {
      const title = decodeEntities($(el).find(".titleText").first().text());

      const dateAttr = $(el).find("time").attr("datetime");

      const dateText = decodeEntities($(el).find("time").text());

      const resolvedCategory =
        category === "aicte-advertisement" && /\bnotice\b/i.test(title)
          ? "aicte-notice"
          : category;

      pushAicteItem(found, {
        title,
        sourceUrl: pickAicteSourceUrl($, el, fallbackUrl),
        fallbackUrl,
        category: resolvedCategory,
        dateText: dateAttr || dateText,
      });
    },
  );

  return [...found.values()];
}

/*
 * AICTE currently returns HTTP 403 to automated
 * requests from the deployed server.
 *
 * We intentionally make only ONE request per
 * AICTE page instead of requesting page=1 as well.
 *
 * A 403 is treated as a temporary unavailable
 * source and does not stop the rest of the scraper.
 */
async function fetchAicteBulletinPages(baseUrl) {
  try {
    const html = await fetchHtml(baseUrl);

    return html ? [html] : [];
  } catch (err) {
    if (err.response?.status === 403) {
      console.warn(`AICTE blocked request (403): ${baseUrl}`);
    } else {
      console.warn(`AICTE request failed: ${baseUrl} - ${err.message}`);
    }

    return [];
  }
}

/* =========================================================
   DOCUMENT CONVERSION
========================================================= */

function toDoc(item) {
  const originalTitle = item.title;

  const postedAt =
    parseFlexibleDate(item.dateText) ||
    extractPostedDate(item.sourceUrl, originalTitle);

  return {
    fingerprint: fingerprint(item.sourceUrl, originalTitle),

    headline: summarizeHeadline(originalTitle),

    originalTitle,

    sourceUrl: item.sourceUrl,

    source: item.source || "ugcnet",

    exam: detectExam(originalTitle, item.source),

    category: item.category,

    postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : null,
  };
}

function countBySource(items) {
  return {
    ugcnet: items.filter((i) => i.source === "ugcnet").length,

    nta: items.filter((i) => i.source === "nta").length,

    nba: items.filter((i) => i.source === "nba").length,

    aicte: items.filter((i) => i.source === "aicte").length,
  };
}

/* =========================================================
   MAIN SCRAPER
========================================================= */

export async function scrapeNta() {
  if (scraping) {
    return {
      skipped: true,
      created: 0,
      scanned: 0,
    };
  }

  scraping = true;

  try {
    const homeUrl = process.env.SOURCE_HOME || "https://ugcnet.nta.nic.in/";

    const archiveUrl =
      process.env.SOURCE_NOTICES_2026 ||
      "https://ugcnet.nta.nic.in/document-category/public-notices-2026/";

    const ntaHqUrl = process.env.SOURCE_NTA_HQ || NTA_ORIGIN;

    const nbaNewsUrl =
      process.env.SOURCE_NBA_NEWS || `${NBA_ORIGIN}/Home/LatestNewsFetch`;

    const nbaLatestUrl =
      process.env.SOURCE_NBA_LATEST || `${NBA_ORIGIN}/Home/latest`;

    const aicteUrl = process.env.SOURCE_AICTE || `${AICTE_ORIGIN}/`;

    const aicteAnnounceUrl =
      process.env.SOURCE_AICTE_ANNOUNCEMENTS ||
      `${AICTE_ORIGIN}/bulletins/annoucement`;

    const aicteCircularsUrl =
      process.env.SOURCE_AICTE_CIRCULARS ||
      `${AICTE_ORIGIN}/bulletins/circulars`;

    const aicteAdsUrl =
      process.env.SOURCE_AICTE_ADVERTISEMENTS ||
      `${AICTE_ORIGIN}/bulletins/advertisements`;

    const [
      homeHtml,
      archiveHtml,
      ntaHtml,
      nbaJson,
      nbaLatestHtml,

      aicteHtml,

      aicteAnnouncePages,
      aicteCircularPages,
      aicteAdsPages,
    ] = await Promise.all([
      /* UGC-NET */
      fetchHtml(homeUrl).catch((err) => {
        console.error("UGC-NET home scrape failed:", err.message);

        return null;
      }),

      /* UGC-NET archive */
      fetchHtml(archiveUrl).catch(() => null),

      /* NTA HQ */
      fetchHtml(ntaHqUrl).catch((err) => {
        console.error("NTA HQ scrape failed:", err.message);

        return null;
      }),

      /* NBA JSON API */
      fetchJson(nbaNewsUrl).catch((err) => {
        console.error("NBA news API scrape failed:", err.message);

        return null;
      }),

      /* NBA latest page */
      fetchHtml(nbaLatestUrl).catch((err) => {
        console.error("NBA latest page scrape failed:", err.message);

        return null;
      }),

      /* AICTE home */
      fetchHtml(aicteUrl).catch((err) => {
        if (err.response?.status === 403) {
          console.warn("AICTE home blocked request (403)");
        } else {
          console.warn(`AICTE home request failed: ${err.message}`);
        }

        return null;
      }),

      /* AICTE announcements */
      fetchAicteBulletinPages(aicteAnnounceUrl),

      /* AICTE circulars */
      fetchAicteBulletinPages(aicteCircularsUrl),

      /* AICTE advertisements */
      fetchAicteBulletinPages(aicteAdsUrl),
    ]);

    /* =====================================================
       PARSE EVERYTHING
    ===================================================== */

    const items = [
      /* UGC-NET */
      ...(homeHtml ? scrapeUgcHome(homeHtml) : []),

      ...(archiveHtml ? scrapeArchiveTable(archiveHtml, "public-notice") : []),

      /* NTA */
      ...(ntaHtml ? scrapeNtaHq(ntaHtml) : []),

      /* NBA */
      ...(nbaJson ? scrapeNbaNewsJson(nbaJson) : []),

      ...(nbaLatestHtml ? scrapeNbaLatestHtml(nbaLatestHtml) : []),

      /* AICTE */
      ...(aicteHtml ? scrapeAicteHome(aicteHtml, aicteUrl) : []),

      ...aicteAnnouncePages.flatMap((html) =>
        scrapeAicteBulletinList(html, "aicte-announcement", aicteAnnounceUrl),
      ),

      ...aicteCircularPages.flatMap((html) =>
        scrapeAicteBulletinList(html, "aicte-circular", aicteCircularsUrl),
      ),

      ...aicteAdsPages.flatMap((html) =>
        scrapeAicteBulletinList(html, "aicte-advertisement", aicteAdsUrl),
      ),
    ];

    /* =====================================================
       SAVE TO DATABASE
    ===================================================== */

    const docs = items.map(toDoc);

    const { created } = await upsertNotices(docs);

    return {
      skipped: false,
      scanned: items.length,
      created,
      sources: countBySource(items),
      scrapedAt: new Date().toISOString(),
    };
  } finally {
    scraping = false;
  }
}
