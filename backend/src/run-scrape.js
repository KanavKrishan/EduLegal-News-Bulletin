import "dotenv/config";
import { connectDb } from "./config/db.js";
import { scrapeNta } from "./services/scraper.js";

await connectDb();
const result = await scrapeNta();
console.log(result);
process.exit(0);
