import { veikkausOddsConfiguration } from "../../../lib/veikkaus-odds-provider.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const configuration = veikkausOddsConfiguration(process.env);

  return Response.json(
    {
      ok: true,
      provider: "Veikkaus Market Lens V1",
      bookmaker: configuration.bookmaker,
      sourceId: configuration.sourceId,
      source: configuration.source,
      sourceTerms: configuration.sourceTerms,
      configured: configuration.configured,
      enabled: configuration.enabled,
      commercialUseAllowed: configuration.commercialUseAllowed,
      production: configuration.production,
      rightsSatisfied: configuration.rightsSatisfied,
      active: configuration.active,
      mode: configuration.mode,
      paperOnly: true,
      realMoneyBetting: false,
      capabilities: {
        priceComparison: true,
        h2h: true,
        spreads: true,
        totals: true,
        bookmakerLogin: false,
        betslipSubmission: false,
        deposits: false,
        withdrawals: false,
        paymentData: false,
        realMoneyExecution: false
      },
      timestamp: new Date().toISOString()
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow"
      }
    }
  );
}
