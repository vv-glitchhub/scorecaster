import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [packageJson, appJson, screen, copy] = await Promise.all([
  readFile(path.join(root, "package.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "app.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "src/screens/WatchlistScreen.tsx"), "utf8"),
  readFile(path.join(root, "src/lib/alert-inbox-copy.ts"), "utf8")
]);

const failures = [];
function check(condition, message) { if (!condition) failures.push(message); }

check(!packageJson.dependencies?.["expo-notifications"], "Alert Inbox V2 must not add expo-notifications");
check(!(appJson.expo?.android?.permissions || []).includes("android.permission.POST_NOTIFICATIONS"), "Alert Inbox V2 must not request Android notification permission");
check(/\/api\/cloud\/alerts/.test(screen), "Native Watchlist must load the protected Alert Inbox API");
check(/minimumSeverity/.test(screen), "Native Alert Inbox must expose bounded severity preferences");
check(/markAllRead: true/.test(screen), "Native Alert Inbox must expose mark-all-read");
check(/method: "DELETE"|"DELETE"/.test(screen), "Native Alert Inbox must expose soft dismissal");
check(/decision_changed/.test(copy) && /price_moved/.test(copy) && /market_unavailable/.test(copy), "Native structured alerts must be localized from known event types");
check(/does not request device notification permission/.test(screen), "Native V2 copy must state that device notification permission is not requested");

if (failures.length) {
  console.error("Alert Inbox V2 mobile audit failed:");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log("Alert Inbox V2 mobile boundary checks passed.");
}
