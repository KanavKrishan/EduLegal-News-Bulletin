import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { POLL_MS, fetchNotices, refreshNotices } from "./api.js";

const SOURCES = [
  { id: "all", label: "All sources" },
  { id: "nta", label: "NTA HQ" },
  { id: "ugcnet", label: "UGC-NET" },
  { id: "nba", label: "NBA" },
  { id: "aicte", label: "AICTE" }
];

const WINDOWS = [
  { id: "any", label: "Any time" },
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" }
];

const BOOKMARK_KEY = "nta-desk-bookmarks";
const PAGE_SIZE = 24;

const LINKS = [
  { href: "https://nta.ac.in/", label: "nta.ac.in" },
  { href: "https://ugcnet.nta.nic.in/", label: "UGC-NET portal" },
  { href: "https://www.nbaind.org/", label: "nbaind.org" },
  { href: "https://www.nbaind.org/Home/latest", label: "NBA latest" },
  { href: "https://www.aicte.gov.in/", label: "aicte.gov.in" },
  { href: "https://www.aicte.gov.in/bulletins/annoucement", label: "AICTE notifications" },
  { href: "https://www.aicte.gov.in/bulletins/circulars", label: "AICTE notices" },
  { href: "https://nta.ac.in/Download/Notice/Examcalendar.pdf", label: "Exam calendar" },
  { href: "https://exams.nta.nic.in/", label: "Exam logins" }
];

function loadBookmarks() {
  try {
    return new Set(JSON.parse(localStorage.getItem(BOOKMARK_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function formatWhen(value) {
  if (!value) return "Date on source site";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function relativeWhen(value) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  return "";
}

function categoryLabel(category, source) {
  if (category === "nta-notice") return "Notice";
  if (category === "nta-alert") return "Live update";
  if (category === "public-notice") return "Public notice";
  if (category === "latest-news") return "Latest news";
  if (category === "news-events") return "News & events";
  if (category === "important") return "Candidate activity";
  if (category === "nba-latest") return "Latest @NBA";
  if (category === "aicte-announcement") return "Announcement";
  if (category === "aicte-circular") return "Circular";
  if (category === "aicte-advertisement") return "Advertisement";
  if (category === "aicte-notice") return "Notice";
  if (source === "nba") return "NBA";
  if (source === "aicte") return "AICTE";
  return source === "nta" ? "NTA" : "UGC-NET";
}

function sourceLabel(source) {
  if (source === "nta") return "NTA HQ";
  if (source === "nba") return "NBA";
  if (source === "aicte") return "AICTE";
  return "UGC-NET";
}

export default function App() {
  const [notices, setNotices] = useState([]);
  const [meta, setMeta] = useState({ exams: [], sources: {}, newCount: 0, count: 0 });
  const [source, setSource] = useState("nta");
  const [exam, setExam] = useState("all");
  const [windowDays, setWindowDays] = useState("any");
  const [query, setQuery] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("Loading notices…");
  const [scraping, setScraping] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [bookmarks, setBookmarks] = useState(loadBookmarks);
  const searchRef = useRef(null);

  const applyPayload = useCallback((data) => {
    setNotices(data.notices || []);
    setMeta({
      exams: data.exams || [],
      sources: data.sources || {},
      newCount: data.newCount || 0,
      count: data.count || 0
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await fetchNotices();
      applyPayload(data);
      setLastChecked(new Date());
      setError("");
      setStatus(
        data.count
          ? `${data.count} items from NTA, UGC-NET, NBA, and AICTE`
          : "Waiting for the first scrape…"
      );
    } catch (err) {
      setError(err.message);
      setStatus("Backend is not reachable yet");
    }
  }, [applyPayload]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...bookmarks]));
  }, [bookmarks]);

  async function onRefresh() {
    setScraping(true);
    try {
      const data = await refreshNotices();
      applyPayload(data);
      setLastChecked(new Date());
      setError("");
      setStatus(
        data.created
          ? `${data.created} new item${data.created === 1 ? "" : "s"} just landed`
          : `Checked official sites — ${data.scanned || 0} items scanned, nothing new`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setScraping(false);
    }
  }

  function toggleBookmark(id) {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyNotice(notice) {
    const text = `${notice.headline}\n${notice.sourceUrl}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(notice.id);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      setError("Could not copy to clipboard");
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cutoff =
      windowDays === "any"
        ? 0
        : Date.now() - Number(windowDays) * 86400000;

    return notices.filter((item) => {
      if (source !== "all" && item.source !== source) return false;
      if (exam !== "all" && item.exam !== exam) return false;
      if (savedOnly && !bookmarks.has(item.id)) return false;
      if (newOnly && !item.isNew) return false;
      if (cutoff) {
        const stamp = item.postedAt || item.firstSeenAt;
        if (!stamp || new Date(stamp).getTime() < cutoff) return false;
      }
      if (q) {
        const hay = `${item.headline} ${item.originalTitle} ${item.exam}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notices, source, exam, savedOnly, newOnly, query, windowDays, bookmarks]);

  useEffect(() => {
    setPage(1);
  }, [source, exam, savedOnly, newOnly, query, windowDays]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const paged = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const newest = visible[0];
  const exams = useMemo(() => {
    const counts = {};
    for (const item of notices) {
      if (source !== "all" && item.source !== source) continue;
      counts[item.exam] = (counts[item.exam] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [notices, source]);

  const nbaBoard = useMemo(
    () => notices.filter((item) => item.source === "nba").slice(0, 8),
    [notices]
  );
  const aicteNotifications = useMemo(
    () =>
      notices
        .filter((item) => item.source === "aicte" && item.category === "aicte-announcement")
        .slice(0, 8),
    [notices]
  );
  const aicteNotices = useMemo(
    () =>
      notices
        .filter(
          (item) =>
            item.source === "aicte" &&
            (item.category === "aicte-circular" ||
              item.category === "aicte-notice" ||
              item.category === "aicte-advertisement")
        )
        .slice(0, 8),
    [notices]
  );

  return (
    <div className="shell">
      <div className="glow" aria-hidden="true" />
      <header className="topbar">
        <div className="brand">
          <span className="mark">NTA</span>
          <div>
            <p className="kicker">Unofficial desk · public pages only</p>
            <h1>Notices, in one scan</h1>
          </div>
        </div>
        <p className="lede">
          Headlines from{" "}
          <a href="https://nta.ac.in/" target="_blank" rel="noreferrer">
            nta.ac.in
          </a>
          ,{" "}
          <a href="https://ugcnet.nta.nic.in/" target="_blank" rel="noreferrer">
            UGC-NET
          </a>
          ,{" "}
          <a href="https://www.nbaind.org/" target="_blank" rel="noreferrer">
            NBA
          </a>
          , and{" "}
          <a href="https://www.aicte.gov.in/" target="_blank" rel="noreferrer">
            AICTE
          </a>
          . Open the official PDF or portal for anything that matters.
        </p>
        <div className="stats">
          <article>
            <strong>{meta.sources.nta || 0}</strong>
            <span>NTA HQ notices</span>
          </article>
          <article>
            <strong>{meta.sources.ugcnet || 0}</strong>
            <span>UGC-NET items</span>
          </article>
          <article>
            <strong>{meta.sources.nba || 0}</strong>
            <span>NBA notices</span>
          </article>
          <article>
            <strong>{meta.sources.aicte || 0}</strong>
            <span>AICTE notices</span>
          </article>
          <article>
            <strong>{meta.newCount || 0}</strong>
            <span>New in 48 hours</span>
          </article>
          <article>
            <strong>{bookmarks.size}</strong>
            <span>Saved for later</span>
          </article>
        </div>
        <div className="toolbar">
          <button type="button" className="primary" onClick={onRefresh} disabled={scraping}>
            {scraping ? "Checking official sites…" : "Check for new notices"}
          </button>
          <label className="search">
            <span className="sr-only">Search notices</span>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exam, keyword, or title  (press /)"
            />
          </label>
          <span className="meta">
            {lastChecked
              ? `Last checked ${lastChecked.toLocaleTimeString("en-IN")}`
              : "Not checked yet"}
            <span aria-hidden="true"> · </span>
            Auto every 30s
          </span>
        </div>
        <p className={`status ${error ? "error" : ""}`}>{error || status}</p>
        <nav className="quick" aria-label="Official links">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      {newest ? (
        <section className="lead" aria-label="Latest headline">
          <div className="lead-meta">
            {newest.isNew ? <span className="badge">New</span> : null}
            <span className={`pill source ${newest.source}`}>{sourceLabel(newest.source)}</span>
            <span className="pill exam">{newest.exam}</span>
            <span className="pill">{categoryLabel(newest.category, newest.source)}</span>
          </div>
          <h2>
            <a href={newest.sourceUrl} target="_blank" rel="noreferrer">
              {newest.headline}
            </a>
          </h2>
          <p className="original">{newest.originalTitle}</p>
          <p className="when">
            {formatWhen(newest.postedAt)}
            {relativeWhen(newest.postedAt) ? ` · ${relativeWhen(newest.postedAt)}` : ""}
            {newest.isPdf ? " · PDF" : ""}
          </p>
        </section>
      ) : (
        <section className="lead empty">
          <h2>No matching notices</h2>
          <p>
            Start the backend so it can scrape official sites, or clear a filter. Press
            “Check for new notices” after the API is up.
          </p>
        </section>
      )}

      <section className="boards" aria-label="NBA notices">
        <header className="boards-head">
          <p className="kicker">Accreditation</p>
          <h2>NBA notices</h2>
          <p>
            Public notifications scraped from{" "}
            <a href="https://www.nbaind.org/Home/latest" target="_blank" rel="noreferrer">
              Latest @NBA
            </a>
            .
          </p>
        </header>
        <div className="board-grid">
          <article className="board">
            <div className="board-title">
              <h3>NBA</h3>
              <span>{meta.sources.nba || 0} stored</span>
            </div>
            {nbaBoard.length ? (
              <ol>
                {nbaBoard.map((notice) => (
                  <li key={notice.id}>
                    <time>{formatWhen(notice.postedAt)}</time>
                    <a href={notice.sourceUrl} target="_blank" rel="noreferrer">
                      {notice.headline}
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="board-empty">No NBA notices yet. Run a refresh after the backend is up.</p>
            )}
            <a className="board-more" href="https://www.nbaind.org/Home/latest" target="_blank" rel="noreferrer">
              Open NBA latest
            </a>
          </article>
        </div>
      </section>

      <section className="boards" aria-label="AICTE notifications and notices">
        <header className="boards-head">
          <p className="kicker">Technical education</p>
          <h2>AICTE notifications and notices</h2>
          <p>
            Scraped from the official bulletins on{" "}
            <a href="https://www.aicte.gov.in/" target="_blank" rel="noreferrer">
              aicte.gov.in
            </a>
            : announcements (notifications), circulars, and public notices.
          </p>
        </header>
        <div className="board-grid">
          <article className="board">
            <div className="board-title">
              <h3>Notifications</h3>
              <span>{aicteNotifications.length} shown</span>
            </div>
            {aicteNotifications.length ? (
              <ol>
                {aicteNotifications.map((notice) => (
                  <li key={notice.id}>
                    <time>{formatWhen(notice.postedAt)}</time>
                    <a href={notice.sourceUrl} target="_blank" rel="noreferrer">
                      {notice.headline}
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="board-empty">
                No AICTE notifications yet. Run a refresh after the backend is up.
              </p>
            )}
            <a
              className="board-more"
              href="https://www.aicte.gov.in/bulletins/annoucement"
              target="_blank"
              rel="noreferrer"
            >
              Open announcements
            </a>
          </article>
          <article className="board">
            <div className="board-title">
              <h3>Notices</h3>
              <span>{aicteNotices.length} shown</span>
            </div>
            {aicteNotices.length ? (
              <ol>
                {aicteNotices.map((notice) => (
                  <li key={notice.id}>
                    <time>
                      {categoryLabel(notice.category, notice.source)}
                      {notice.postedAt ? ` · ${formatWhen(notice.postedAt)}` : ""}
                    </time>
                    <a href={notice.sourceUrl} target="_blank" rel="noreferrer">
                      {notice.headline}
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="board-empty">
                No AICTE circulars or public notices yet. Run a refresh after the backend is up.
              </p>
            )}
            <a
              className="board-more"
              href="https://www.aicte.gov.in/bulletins/circulars"
              target="_blank"
              rel="noreferrer"
            >
              Open circulars
            </a>
          </article>
        </div>
      </section>

      <section className="controls" aria-label="Filters">
        <div className="chips" role="tablist">
          {SOURCES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={source === item.id ? "active" : ""}
              onClick={() => setSource(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="chips">
          {WINDOWS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={windowDays === item.id ? "active" : ""}
              onClick={() => setWindowDays(item.id)}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            className={newOnly ? "active" : ""}
            onClick={() => setNewOnly((v) => !v)}
          >
            New only
          </button>
          <button
            type="button"
            className={savedOnly ? "active" : ""}
            onClick={() => setSavedOnly((v) => !v)}
          >
            Saved
          </button>
        </div>
        <div className="chips exams">
          <button
            type="button"
            className={exam === "all" ? "active" : ""}
            onClick={() => setExam("all")}
          >
            All exams
          </button>
          {exams.map((item) => (
            <button
              key={item.name}
              type="button"
              className={exam === item.name ? "active" : ""}
              onClick={() => setExam(item.name)}
            >
              {item.name}
              <em>{item.count}</em>
            </button>
          ))}
        </div>
      </section>

      <p className="count-line">
        Showing {visible.length} of {notices.length}
        {query ? ` · “${query}”` : ""}
      </p>

      <ol className="feed">
        {paged.map((notice) => {
          const saved = bookmarks.has(notice.id);
          return (
            <li key={notice.id} className={notice.isNew ? "is-new" : ""}>
              <div className="row-top">
                <span className={`pill source ${notice.source}`}>{sourceLabel(notice.source)}</span>
                <span className="pill exam">{notice.exam}</span>
                {notice.isNew ? <span className="dot">New</span> : null}
                <time>
                  {formatWhen(notice.postedAt)}
                  {relativeWhen(notice.postedAt) ? ` · ${relativeWhen(notice.postedAt)}` : ""}
                </time>
              </div>
              <a className="headline" href={notice.sourceUrl} target="_blank" rel="noreferrer">
                {notice.headline}
              </a>
              <p className="original">{notice.originalTitle}</p>
              <div className="actions">
                <a href={notice.sourceUrl} target="_blank" rel="noreferrer">
                  {notice.isPdf ? "Open PDF" : "Open source"}
                </a>
                <button type="button" onClick={() => toggleBookmark(notice.id)}>
                  {saved ? "Saved" : "Save"}
                </button>
                <button type="button" onClick={() => copyNotice(notice)}>
                  {copied === notice.id ? "Copied" : "Copy link"}
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {pageCount > 1 ? (
        <div className="pager">
          <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            disabled={page === pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}

      <footer>
        Official documents stay on NTA, NBA, and AICTE websites. This desk only lists
        public titles so you can notice what changed. Press <kbd>/</kbd> to search.
      </footer>
    </div>
  );
}
