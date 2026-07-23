import Link from "next/link";
import AutonomousAgentClient from "./AutonomousAgentClient";
import AutonomousV121Panel from "./AutonomousV121Panel";

export const metadata = {
  title: "Autonomous Intelligence V12.1 | Scorecaster",
  description: "Configure the opt-in autonomous paper agent, persistent learning gates and V12 Mission Control cockpit."
};

export default function AutonomousAgentPage() {
  return (
    <div className="space-y-7">
      <section className="rounded-[1.5rem] border border-purple-300/25 bg-purple-300/10 p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-200">Autonomous Intelligence V12.1</div>
          <h2 className="mt-1 text-xl font-black text-[var(--sc-text)]">Mission Control + persistent learning</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--sc-muted)]">Daily Governor, circuit breakerit, drawdown, ROI, CLV, Brier, provider-terveys, pysyvä champion–challenger ja adaptiivinen ajastus yhdessä paper-only-järjestelmässä.</p>
        </div>
        <Link href="/mission-control" className="sc-button-primary mt-4 shrink-0 sm:mt-0">Avaa Mission Control</Link>
      </section>
      <AutonomousAgentClient />
      <AutonomousV121Panel />
    </div>
  );
}
