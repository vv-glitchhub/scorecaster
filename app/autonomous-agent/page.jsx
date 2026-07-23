import Link from "next/link";
import AutonomousAgentClient from "./AutonomousAgentClient";

export const metadata = {
  title: "Autonomous Scorecaster V12 | Scorecaster",
  description: "Configure the opt-in autonomous paper agent and open its V12 Mission Control cockpit."
};

export default function AutonomousAgentPage() {
  return (
    <div className="space-y-7">
      <section className="rounded-[1.5rem] border border-purple-300/25 bg-purple-300/10 p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-200">Autonomous Scorecaster V12</div>
          <h2 className="mt-1 text-xl font-black text-[var(--sc-text)]">Mission Control</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--sc-muted)]">Autonomiatila, circuit breakerit, drawdown, CLV, mallidrift, provider-valmius, nykyiset ehdokkaat ja worker-ajot yhdessä auditoitavassa näkymässä.</p>
        </div>
        <Link href="/mission-control" className="sc-button-primary mt-4 shrink-0 sm:mt-0">Avaa Mission Control</Link>
      </section>
      <AutonomousAgentClient />
    </div>
  );
}
