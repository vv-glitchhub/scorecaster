import Link from "next/link";
import AutonomousAgentClient from "./AutonomousAgentClient";

export const metadata = {
  title: "Autonomous Scorecaster V13 | Scorecaster",
  description: "V12 Mission Control combined with V13 candidate governance, safety cooldowns, decision audits and native emergency controls."
};

export default function AutonomousAgentPage() {
  return (
    <div className="space-y-7">
      <section className="rounded-[1.5rem] border border-purple-300/25 bg-purple-300/10 p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-200">Autonomous Scorecaster V13</div>
          <h2 className="mt-1 text-xl font-black text-[var(--sc-text)]">Mission Control + Governance</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--sc-muted)]">V12 Mission Control näyttää autonomiatilan, circuit breakerit ja mallidriftin. V13 lisää jokaisen ehdokkaan data-, provider-, incident-, CLV-, drawdown- ja riskiauditoinnin, adaptiivisen cooldownin sekä hätäpysäytyksen.</p>
        </div>
        <Link href="/mission-control" className="sc-button-primary mt-4 shrink-0 sm:mt-0">Avaa Mission Control</Link>
      </section>
      <AutonomousAgentClient />
    </div>
  );
}
