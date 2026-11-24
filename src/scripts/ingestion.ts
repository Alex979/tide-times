import { createDb } from "#/db";
import { populateTidePredictions } from "#/ingestion/tide-predictions";
import { getPlatformProxy } from "wrangler";

const isRemote = process.argv.includes("--remote");
console.log(`Target D1: ${isRemote ? "REMOTE (prod)" : "local"}`);

const { env, dispose } = await getPlatformProxy<Env>({
  environment: isRemote ? "remote" : undefined,
  remoteBindings: isRemote,
});

try {
    const db = createDb(env.tide_times);
    await populateTidePredictions(db);
} finally {
    await dispose();
}
