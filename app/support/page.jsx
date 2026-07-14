import Link from "next/link";

export const metadata = {
  title: "Support | Scorecaster",
  description: "Scorecaster support, account, privacy and security help."
};

const supportItems = [
  {
    title: "Application support",
    body: "For reproducible application problems, open a GitHub issue with the device model, operating-system version, Scorecaster version and the steps that caused the problem. Never include passwords, access tokens, API keys, private paper-bet history or other personal information in a public issue.",
    href: "https://github.com/vv-glitchhub/scorecaster/issues/new",
    label: "Open a support issue"
  },
  {
    title: "Account and data controls",
    body: "Signed-in users can export their Scorecaster account data and permanently delete their account from the Profile and privacy screen. Account deletion removes the authentication account and associated cloud rows when the production deletion service is configured.",
    href: "/profile",
    label: "Open account controls"
  },
  {
    title: "Security reports",
    body: "Do not publish exploitable security details, credentials or personal data in a public issue. Use GitHub private vulnerability reporting for this repository when available. Include only the minimum technical information required to reproduce the problem.",
    href: "https://github.com/vv-glitchhub/scorecaster/security/advisories/new",
    label: "Report privately on GitHub"
  }
];

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8">
        <div className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Scorecaster support</div>
        <h1 className="text-3xl font-black text-white md:text-4xl">Help, account and security support</h1>
        <p className="mt-4 max-w-3xl leading-7 text-slate-300">
          Scorecaster provides sports analysis, risk controls and paper tracking only. It does not accept deposits, hold money, connect to bookmaker accounts or place real-money bets.
        </p>
      </section>

      {supportItems.map((item) => (
        <section key={item.title} className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-black text-white">{item.title}</h2>
          <p className="mt-3 leading-7 text-slate-300">{item.body}</p>
          <Link
            href={item.href}
            className="mt-4 inline-flex rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950"
          >
            {item.label}
          </Link>
        </section>
      ))}

      <section className="rounded-3xl border border-amber-300/20 bg-amber-300/[0.06] p-6">
        <h2 className="text-xl font-black text-white">Urgent account concern</h2>
        <p className="mt-3 leading-7 text-slate-300">
          Sign out, change the password through the authentication flow and revoke the affected session. Never send a password, recovery link, access token or payment information to support. Scorecaster does not need payment information for any support request.
        </p>
      </section>

      <div className="flex flex-wrap gap-3 pb-6">
        <Link href="/privacy" className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white">Privacy</Link>
        <Link href="/terms" className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white">Terms</Link>
        <Link href="/responsible-use" className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white">Responsible use</Link>
        <Link href="/security" className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white">Security</Link>
      </div>
    </div>
  );
}
