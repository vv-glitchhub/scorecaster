import AnalyticsClient from "./AnalyticsClient";

async function getJson(path) {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const response = await fetch(`${siteUrl}${path}`, { cache: "no-store" });
    return await response.json();
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export default async function AnalyticsPage() {
  const [learning, clv, agent] = await Promise.all([
    getJson("/api/learning-summary"),
    getJson("/api/clv-tracker"),
    getJson("/api/agent-v9")
  ]);

  return <AnalyticsClient learning={learning} clv={clv} agent={agent} />;
}
