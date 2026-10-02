const PREFIXES = [
  /^public notice\s+(regarding|for|:)\s+/i,
  /^notice\s+(regarding|for|:)\s+/i
];

const TRAILING = [
  /\s*[–—-]\s*reg\.?$/i,
  /\s+reg\.?$/i,
  /\s+\.?$/
];

function decodeEntities(text) {
  return text
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(raw) {
  let t = decodeEntities(raw);
  for (const re of PREFIXES) t = t.replace(re, "");
  for (const re of TRAILING) t = t.replace(re, "");
  return t.replace(/\s+/g, " ").trim();
}

function ruleHeadline(title) {
  const t = title.toLowerCase();

  if (/e-certificates?/.test(t) && /june 2026/.test(t)) {
    return "e-Certificates now available for UGC-NET June 2026";
  }
  if (/declaration of results/.test(t) && /3 subjects/.test(t)) {
    return "Results declared for 3 UGC-NET June 2026 re-exam subjects";
  }
  if (/declaration of results/.test(t)) {
    return "UGC-NET results have been declared";
  }
  if (/cut[\s-]?off/.test(t) && /re-exam/.test(t)) {
    return "Category-wise cut-off marks released for June 2026 re-exam";
  }
  if (/cut[\s-]?off/.test(t)) {
    return "Category-wise cut-off marks released";
  }
  if (/final answer keys?/.test(t) && /3 subjects/.test(t)) {
    return "Final answer keys out for 3 UGC-NET June 2026 subjects";
  }
  if (/final answer keys?/.test(t)) {
    return "Final answer keys published";
  }
  if (/challenge/.test(t) && /provisional answer/.test(t)) {
    return "Provisional answer keys open for challenge";
  }
  if (/advisory/.test(t) && /delhi/.test(t) && /re-exam/.test(t)) {
    return "Advisory for candidates at the Delhi re-exam centre";
  }
  if (/admit card/.test(t) && /re-exam/.test(t)) {
    return "Admit cards released for UGC-NET June 2026 re-exam";
  }
  if (/admit card/.test(t)) {
    return "Admit cards have been released";
  }
  if (/allotment of (re-)?examination city|advance intimation/.test(t) && /re-exam/.test(t)) {
    return "Re-exam city allotment intimated to applicants";
  }
  if (/allotment of examination city|advance intimation/.test(t)) {
    return "Exam city allotment intimated to applicants";
  }
  if (/scribe/.test(t)) {
    return "Portal open to submit scribe details for PwD/PwBD candidates";
  }
  if (/score card/.test(t)) {
    return "UGC-NET June 2026 score cards (re-exam) are live";
  }
  if (/correction/.test(t) && /application/.test(t)) {
    return "Application form correction window is open";
  }
  if (/extension of last date/.test(t)) {
    return "Last date to apply has been extended";
  }
  if (/fake|ai-generated|altered/.test(t) && /neet/.test(t)) {
    return "Warning: fake or AI-generated NEET documents circulating";
  }
  if (/exam calendar/.test(t)) {
    return "NTA examination calendar has been published";
  }
  if (/relocation of nta office/.test(t)) {
    return "NTA office has relocated";
  }

  return null;
}

export function summarizeHeadline(rawTitle) {
  const cleaned = cleanTitle(rawTitle);
  const ruled = ruleHeadline(cleaned);
  if (ruled) return ruled;

  if (cleaned.length <= 92) return cleaned;
  const cut = cleaned.slice(0, 89);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

const EXAM_PATTERNS = [
  { exam: "CSIR-NET", re: /csir/i },
  { exam: "UGC-NET", re: /ugc[\s-]?net|ugcnet/i },
  { exam: "NEET", re: /\bneet\b/i },
  { exam: "JEE", re: /\bjee\b/i },
  { exam: "CUET-UG", re: /cuet\s*\(?\s*ug/i },
  { exam: "CUET-PG", re: /cuet\s*\(?\s*pg/i },
  { exam: "CUET", re: /\bcuet\b/i },
  { exam: "AIAPGET", re: /aiapget|ayush/i },
  { exam: "ICAR", re: /\bicar\b|aieea|aice/i },
  { exam: "SWAYAM", re: /swayam/i },
  { exam: "CMAT", re: /\bcmat\b/i },
  { exam: "AISSEE", re: /aissee|sainik/i },
  { exam: "NCET", re: /\bncet\b/i },
  { exam: "NIFTEE", re: /niftee|nift/i },
  { exam: "NCHM-JEE", re: /nchm/i },
  { exam: "NTET", re: /\bntet\b/i },
  { exam: "RMS CET", re: /rms\s*cet|rashtriya military school/i },
  { exam: "RIMCEE", re: /rimcee|rashtriya indian military/i },
  { exam: "GAT-B", re: /gat[\s-]?b|\bbet\b/i },
  { exam: "NITTT", re: /nittt/i },
  { exam: "GPAT", re: /\bgpat\b/i },
  { exam: "JIPMAT", re: /jipmat/i },
  { exam: "NSSNET", re: /nssnet|navayug/i },
  { exam: "ATAL", re: /\batal\b/i },
  { exam: "Scholarship", re: /pragati|saksham|swanath|scholarship scheme/i }
];

export function detectExam(title, source) {
  const t = String(title || "");
  for (const row of EXAM_PATTERNS) {
    if (row.re.test(t)) return row.exam;
  }
  if (source === "nba") return "Accreditation";
  if (source === "aicte") return "AICTE";
  return "General";
}

export function extractPostedDate(url, title) {
  const fromNotice = String(url).match(/Notice_(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/i);
  if (fromNotice) {
    const [, y, m, d, hh = "12", mm = "00"] = fromNotice;
    const date = new Date(`${y}-${m}-${d}T${hh}:${mm}:00.000Z`);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const fromFile = String(url).match(/\/(\d{4})\/(\d{2})\/(\d{8})/);
  if (fromFile) {
    const stamp = fromFile[3];
    const y = stamp.slice(0, 4);
    const m = stamp.slice(4, 6);
    const d = stamp.slice(6, 8);
    const date = new Date(`${y}-${m}-${d}T12:00:00.000Z`);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const fromTitle = String(title).match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)[,\s]+(\d{4})/i
  );
  if (fromTitle) {
    return new Date(`${fromTitle[2]} ${fromTitle[1]}, ${fromTitle[3]}`);
  }

  const dmy = String(title).match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
  if (dmy) {
    const date = new Date(
      `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}T12:00:00.000Z`
    );
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

export { decodeEntities, cleanTitle };
