"use client";

import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import {
  getAgentReports,
  deleteAgentReport,
  clearAgentReports
} from "../../lib/report-storage";
import { reportToMarkdown } from "../../lib/agent-report-engine";

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    setReports(getAgentReports());
  }

  function removeReport(id) {
    deleteAgentReport(id);
    refresh();
  }

  function clearAll() {
    clearAgentReports();
    refresh();
  }

  async function copyReport(report) {
    await navigator.clipboard.writeText(reportToMarkdown(report));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-sm text-purple-300">
          Agent Report Center
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Saved Agent Reports
        </h1>

        <p className="mt-3 text-slate-300">
          Tallenna ja tarkastele agentin peli- ja päätösraportteja myöhemmin.
        </p>

        {reports.length > 0 && (
          <button
            onClick={clearAll}
            className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 font-bold text-red-300 hover:bg-red-400/20"
          >
            Clear Reports
          </button>
        )}
      </section>

      <Panel title="Reports" subtitle="Agent analysis history">
        <div className="space-y-4">
          {reports.length === 0 && (
            <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
              Ei tallennettuja raportteja vielä.
            </div>
          )}

          {reports.map((report) => {
            const expanded = expandedId === report.id;

            return (
              <div
                key={report.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xl font-black">{report.match}</div>

                    <div className="mt-2 text-sm text-slate-400">
                      {report.selection} @ {report.market?.odds}
                    </div>

                    <div className="mt-1 text-sm text-purple-300">
                      Decision: {report.decision?.action}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      Saved:{" "}
                      {report.savedAt
                        ? new Date(report.savedAt).toLocaleString("fi-FI")
                        : "Unknown"}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setExpandedId(expanded ? null : report.id)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-bold text-slate-300 hover:bg-white/10"
                    >
                      {expanded ? "Hide" : "Open"}
                    </button>

                    <button
                      onClick={() => copyReport(report)}
                      className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2 font-bold text-sky-300 hover:bg-sky-400/20"
                    >
                      Copy
                    </button>

                    <button
                      onClick={() => removeReport(report.id)}
                      className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 font-bold text-red-300 hover:bg-red-400/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {expanded && (
                  <pre className="mt-5 whitespace-pre-wrap rounded-xl border border-white/10 bg-slate-950 p-4 text-xs text-slate-300">
                    {reportToMarkdown(report)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
