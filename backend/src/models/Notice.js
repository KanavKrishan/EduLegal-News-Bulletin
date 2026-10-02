import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema(
  {
    fingerprint: { type: String, required: true, unique: true, index: true },
    headline: { type: String, required: true },
    originalTitle: { type: String, required: true },
    sourceUrl: { type: String, required: true },
    source: {
      type: String,
      enum: ["ugcnet", "nta", "nba", "aicte"],
      default: "ugcnet",
      index: true
    },
    exam: { type: String, default: "General" },
    category: {
      type: String,
      enum: [
        "public-notice",
        "latest-news",
        "news-events",
        "important",
        "nta-notice",
        "nta-alert",
        "nba-latest",
        "aicte-announcement",
        "aicte-circular",
        "aicte-advertisement",
        "aicte-notice"
      ],
      default: "public-notice"
    },
    postedAt: { type: Date, default: null },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

noticeSchema.index({ firstSeenAt: -1 });
noticeSchema.index({ postedAt: -1 });

export const Notice = mongoose.model("Notice", noticeSchema);
