import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { Notice } from "../models/Notice.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../../data/notices.json");

let useFileStore = false;
const memory = new Map();

async function ensureDataFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf8");
  }
}

async function loadFileStore() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const rows = JSON.parse(raw);
  memory.clear();
  for (const row of rows) memory.set(row.fingerprint, row);
}

async function persistFileStore() {
  await ensureDataFile();
  const rows = [...memory.values()].sort(
    (a, b) => new Date(b.firstSeenAt) - new Date(a.firstSeenAt)
  );
  await fs.writeFile(DATA_FILE, JSON.stringify(rows, null, 2), "utf8");
}

export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    useFileStore = true;
    await loadFileStore();
    console.warn("No MONGODB_URI set. Using local JSON storage.");
    return { mode: "file" };
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
    useFileStore = false;
    console.log("Connected to MongoDB");
    return { mode: "mongo" };
  } catch (err) {
    useFileStore = true;
    await loadFileStore();
    console.warn(
      `MongoDB unavailable (${err.message}). Falling back to local JSON storage.`
    );
    return { mode: "file" };
  }
}

export function storageMode() {
  return useFileStore ? "file" : "mongo";
}

function applyUpdate(existing, doc, isoDates) {
  existing.headline = doc.headline;
  existing.originalTitle = doc.originalTitle;
  existing.category = doc.category;
  if (doc.source) existing.source = doc.source;
  if (doc.exam) existing.exam = doc.exam;
  if (doc.postedAt) existing.postedAt = doc.postedAt;
  existing.lastSeenAt = isoDates ? new Date().toISOString() : new Date();
}

export async function upsertNotice(doc, opts = {}) {
  if (useFileStore) {
    const existing = memory.get(doc.fingerprint);
    if (existing) {
      applyUpdate(existing, doc, true);
      memory.set(doc.fingerprint, existing);
      if (!opts.skipPersist) await persistFileStore();
      return { created: false, notice: existing };
    }

    const notice = {
      source: "ugcnet",
      exam: "General",
      ...doc,
      _id: doc.fingerprint,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    };
    memory.set(doc.fingerprint, notice);
    if (!opts.skipPersist) await persistFileStore();
    return { created: true, notice };
  }

  const existing = await Notice.findOne({ fingerprint: doc.fingerprint });
  if (existing) {
    applyUpdate(existing, doc, false);
    await existing.save();
    return { created: false, notice: existing.toObject() };
  }

  const created = await Notice.create(doc);
  return { created: true, notice: created.toObject() };
}

export async function upsertNotices(docs) {
  let created = 0;
  for (const doc of docs) {
    const result = await upsertNotice(doc, { skipPersist: true });
    if (result.created) created += 1;
  }
  if (useFileStore) await persistFileStore();
  return { created };
}

function byNewest(a, b) {
  const postedA = a.postedAt ? new Date(a.postedAt).getTime() : 0;
  const postedB = b.postedAt ? new Date(b.postedAt).getTime() : 0;
  if (postedA !== postedB) return postedB - postedA;
  return new Date(b.firstSeenAt) - new Date(a.firstSeenAt);
}

function normalize(row) {
  return {
    ...row,
    source: row.source || "ugcnet",
    exam: row.exam || "General"
  };
}

export async function listNotices() {
  if (useFileStore) {
    return [...memory.values()].map(normalize).sort(byNewest);
  }

  return (await Notice.find().lean()).map(normalize).sort(byNewest);
}
