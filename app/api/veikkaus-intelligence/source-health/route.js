import { jsonResponse } from "../../../../lib/api-security";
import { veikkausDiscoveryStatus } from "../../../../lib/veikkaus-data-adapter-v1.mjs";

export const dynamic = "force-dynamic";

export function GET() {
  const status = veikkausDiscoveryStatus();
  return jsonResponse({
    ok: true,
    service: "veikkaus-data-adapter-discovery",
    status,
    redaction: {
      credentialsReturned: false,
      cookiesReturned: false,
      rawPayloadReturned: false,
      requestUrlReturned: false,
      accountContextReturned: false,
    },
    note: status.collectionAllowed
      ? "Rights and endpoint gates are satisfied."
      : "Discovery only. Production collection remains fail-closed until source, terms and permitted use are verified.",
  }, 200, null, {
    "Cache-Control": "no-store",
  });
}
