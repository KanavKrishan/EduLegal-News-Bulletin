const POLL_MS = 30_000;

export async function fetchNotices() {
  const res = await fetch("/api/notices");
  if (!res.ok) throw new Error("Could not load notices");
  return res.json();
}

export async function refreshNotices() {
  const res = await fetch("/api/notices/refresh", { method: "POST" });
  if (!res.ok) throw new Error("Could not refresh official notices");
  return res.json();
}

export { POLL_MS };
