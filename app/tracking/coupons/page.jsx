"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../components/LanguageProvider";
import { EmptyState, MetricTile, PageHero, SectionHeader } from "../../components/ProductUI";

function payloadOf(response) {
  return response.json().catch(() => ({}));
}

function normalizeBet(bet = {}) {
  return {
    id: bet.id,
    match: bet.match || [bet.home_team, bet.away_team].filter(Boolean).join(" – ") || "Paper pick",
    selection: bet.label || "—",
    odds: Number(bet.odds || 0),
    market: bet.market || "h2h",
    sport: bet.sport || null,
    league: bet.league || null,
    bookmaker: bet.bookmaker || null,
    edge: bet.edge,
    ev: bet.ev,
    confidence: bet.confidence,
    commenceTime: bet.commence_time || null,
    status: bet.status || "open",
    createdAt: bet.created_at || null
  };
}

function statusClasses(status) {
  if (status === "won") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-200";
  if (status === "lost") return "border-rose-300/30 bg-rose-300/10 text-rose-200";
  if (status === "push") return "border-sky-300/30 bg-sky-300/10 text-sky-200";
  return "border-amber-300/30 bg-amber-300/10 text-amber-200";
}

export default function PaperCouponsPage() {
  const { tr, locale } = useLanguage();
  const [bets, setBets] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [stake, setStake] = useState("10");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [signedOut, setSignedOut] = useState(false);

  const currency = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }), [locale]);
  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 }), [locale]);
  const percent = (value) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)} %` : "—";
  const money = (value) => currency.format(Number(value || 0));

  const statusLabel = (status) => status === "won"
    ? tr({ fi: "Oikein", en: "Won", es: "Acertado" })
    : status === "lost"
      ? tr({ fi: "Ei osunut", en: "Lost", es: "Fallado" })
      : status === "push"
        ? tr({ fi: "Palautus", en: "Push", es: "Nulo" })
        : tr({ fi: "Avoin", en: "Open", es: "Abierto" });

  const couponStatusLabel = (status) => status === "won"
    ? tr({ fi: "Voitto", en: "Won", es: "Ganado" })
    : status === "lost"
      ? tr({ fi: "Ei osunut", en: "Lost", es: "Fallado" })
      : status === "push"
        ? tr({ fi: "Palautus", en: "Push", es: "Nulo" })
        : tr({ fi: "Avoin", en: "Open", es: "Abierto" });

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [betsResponse, couponsResponse] = await Promise.all([
        fetch("/api/cloud/bets", { cache: "no-store" }),
        fetch("/api/cloud/slips", { cache: "no-store" })
      ]);
      if (betsResponse.status === 401 || couponsResponse.status === 401) {
        setSignedOut(true);
        setBets([]);
        setCoupons([]);
        return;
      }
      const [betsPayload, couponsPayload] = await Promise.all([payloadOf(betsResponse), payloadOf(couponsResponse)]);
      if (!betsResponse.ok || betsPayload.ok === false) throw new Error(betsPayload.error || "Paper picks could not be loaded");
      if (!couponsResponse.ok || couponsPayload.ok === false) throw new Error(couponsPayload.error || "Paper coupons could not be loaded");
      setSignedOut(false);
      setBets((betsPayload.data || []).map(normalizeBet));
      setCoupons(couponsPayload.data || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Paper coupons could not be loaded");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openBets = useMemo(() => bets.filter((bet) => bet.status === "open" && bet.odds > 1).slice(0, 80), [bets]);
  const selectedBets = useMemo(() => selectedIds.map((id) => openBets.find((bet) => bet.id === id)).filter(Boolean), [selectedIds, openBets]);
  const totalOdds = useMemo(() => selectedBets.reduce((product, bet) => product * Number(bet.odds || 1), 1), [selectedBets]);
  const parsedStake = Number(String(stake).replace(",", "."));
  const potentialReturn = Number.isFinite(parsedStake) && parsedStake > 0 ? parsedStake * totalOdds : 0;

  const summary = useMemo(() => {
    const open = coupons.filter((coupon) => coupon.status === "open").length;
    const won = coupons.filter((coupon) => coupon.status === "won").length;
    const lost = coupons.filter((coupon) => coupon.status === "lost").length;
    const result = coupons.reduce((sum, coupon) => coupon.status === "open" ? sum : sum + Number(coupon.currentProfit || 0), 0);
    return { open, won, lost, result };
  }, [coupons]);

  function toggleBet(bet) {
    setMessage("");
    setError("");
    setSelectedIds((current) => {
      if (current.includes(bet.id)) return current.filter((id) => id !== bet.id);
      if (current.length >= 20) return current;
      const duplicateMatch = current.some((id) => openBets.find((candidate) => candidate.id === id)?.match === bet.match);
      if (duplicateMatch) {
        setError(tr({
          fi: "Yhdelle ottelulle voi olla kupongissa vain yksi valinta.",
          en: "A coupon can contain only one selection from the same match.",
          es: "Un cupón solo puede contener una selección del mismo partido."
        }));
        return current;
      }
      return [...current, bet.id];
    });
  }

  async function createCoupon() {
    if (selectedIds.length < 2) {
      setError(tr({ fi: "Valitse vähintään kaksi avointa paperikohdetta.", en: "Select at least two open paper picks.", es: "Selecciona al menos dos pronósticos abiertos." }));
      return;
    }
    if (!Number.isFinite(parsedStake) || parsedStake < 0.1) {
      setError(tr({ fi: "Anna kelvollinen paperipanos.", en: "Enter a valid paper stake.", es: "Introduce un importe simulado válido." }));
      return;
    }

    setBusy("create");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/cloud/slips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betIds: selectedIds, stake: parsedStake })
      });
      const payload = await payloadOf(response);
      if (!response.ok || payload.ok === false) {
        const limitText = payload.maxPaperStake ? ` (${money(payload.maxPaperStake)})` : "";
        throw new Error(`${payload.error || "Paper coupon could not be created"}${limitText}`);
      }
      setSelectedIds([]);
      setMessage(tr({ fi: "Paperikuponki luotiin. Tulokset päivittyvät samoista varmennetuista paperikohteista.", en: "Paper coupon created. Results follow the same verified paper picks.", es: "Cupón simulado creado. Los resultados siguen los mismos pronósticos verificados." }));
      await load({ silent: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Paper coupon could not be created");
    } finally {
      setBusy("");
    }
  }

  async function deleteCoupon(id) {
    if (!window.confirm(tr({ fi: "Poistetaanko tämä paperikuponki? Yksittäisiä paperikohteita ei poisteta.", en: "Delete this paper coupon? The underlying single paper picks are kept.", es: "¿Eliminar este cupón simulado? Los pronósticos individuales se conservarán." }))) return;
    setBusy(id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/cloud/slips", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const payload = await payloadOf(response);
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Paper coupon could not be deleted");
      setCoupons((current) => current.filter((coupon) => coupon.id !== id));
      setMessage(tr({ fi: "Paperikuponki poistettiin.", en: "Paper coupon deleted.", es: "Cupón simulado eliminado." }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Paper coupon could not be deleted");
    } finally {
      setBusy("");
    }
  }

  const heroAside = (
    <div className="grid grid-cols-2 gap-2">
      <MetricTile compact label={tr({ fi: "Avoinna", en: "Open", es: "Abiertos" })} value={summary.open} tone="yellow" />
      <MetricTile compact label={tr({ fi: "Voitot", en: "Wins", es: "Ganados" })} value={summary.won} tone="green" />
      <MetricTile compact label={tr({ fi: "Ei osunut", en: "Lost", es: "Fallados" })} value={summary.lost} tone="red" />
      <MetricTile compact label={tr({ fi: "Paperitulos", en: "Paper result", es: "Resultado" })} value={money(summary.result)} tone={summary.result >= 0 ? "green" : "red"} />
    </div>
  );

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow={tr({ fi: "Paperikupongit", en: "Paper coupons", es: "Cupones simulados" })}
        title={tr({ fi: "Yhdistelmäkuponki kuten kuvassasi — mutta Scorecasterin analytiikalla", en: "Accumulator tickets with Scorecaster analytics", es: "Cupones combinados con analítica de Scorecaster" })}
        description={tr({
          fi: "Yhdistä tilillesi jo tallennettuja paperikohteita, näe kokonaiskerroin ja seuraa jokaisen kohteen tilaa Oikein / Avoin / Ei osunut. Kuponki ei aseta oikean rahan vetoa.",
          en: "Combine existing paper picks, see combined odds and follow each leg as Won / Open / Lost. Coupons never place real-money bets.",
          es: "Combina pronósticos simulados, consulta la cuota total y sigue cada selección. Los cupones nunca realizan apuestas con dinero real."
        })}
        actions={<><Link href="/events" className="sc-button-primary">{tr({ fi: "Lisää paperikohteita", en: "Add paper picks", es: "Añadir pronósticos" })}</Link><button type="button" onClick={() => void load()} disabled={loading || busy !== ""} className="sc-button-secondary disabled:opacity-50">{tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}</button></>}
        aside={heroAside}
      />

      <div className="rounded-2xl border border-sky-300/25 bg-sky-300/10 p-4 text-sm leading-6 text-sky-100">
        <strong>{tr({ fi: "PAPER ONLY", en: "PAPER ONLY", es: "SOLO SIMULACIÓN" })}.</strong> {tr({ fi: "Kokonaiskerroin kasvaa nopeasti, mutta se ei tee kupongista automaattisesti hyvää. Yksikin hävinnyt kohde kaataa yhdistelmän.", en: "Combined odds grow quickly, but that does not automatically make a coupon good. One losing leg loses the accumulator.", es: "La cuota combinada crece rápido, pero eso no convierte el cupón automáticamente en bueno. Una selección fallada pierde la combinada." })}
      </div>

      {error ? <div role="alert" className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">{error}</div> : null}
      {message ? <div aria-live="polite" className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100">{message}</div> : null}

      {signedOut ? (
        <EmptyState
          title={tr({ fi: "Kirjaudu kupongit käyttöön", en: "Sign in to use coupons", es: "Inicia sesión para usar cupones" })}
          description={tr({ fi: "Kupongit käyttävät suojattuja käyttäjäkohtaisia paperikohteita.", en: "Coupons use your protected account-backed paper picks.", es: "Los cupones usan tus pronósticos protegidos." })}
          actionHref="/login"
          actionLabel={tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}
        />
      ) : (
        <>
          <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 shadow-xl md:p-6">
            <SectionHeader
              eyebrow={tr({ fi: "Uusi kuponki", en: "New coupon", es: "Nuevo cupón" })}
              title={tr({ fi: "Valitse 2–20 avointa kohdetta", en: "Choose 2–20 open picks", es: "Elige 2–20 pronósticos abiertos" })}
              description={tr({ fi: "Samasta ottelusta voi olla vain yksi valinta. Kerroin ja mahdollinen paperipalautus lasketaan heti.", en: "Only one selection per match is allowed. Combined odds and potential paper return update instantly.", es: "Solo se permite una selección por partido. La cuota y el retorno se calculan al instante." })}
            />

            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_260px]">
              <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {loading ? <div className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" /> : openBets.length === 0 ? <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5 text-sm text-[var(--sc-muted)]">{tr({ fi: "Avoimia paperikohteita ei ole. Lisää ensin kohde Ottelut-näkymästä.", en: "There are no open paper picks. Add one from Matches first.", es: "No hay pronósticos abiertos. Añade uno desde Partidos." })}</div> : openBets.map((bet) => {
                  const selected = selectedIds.includes(bet.id);
                  const duplicateMatch = !selected && selectedBets.some((candidate) => candidate.match === bet.match);
                  return (
                    <button
                      type="button"
                      key={bet.id}
                      onClick={() => toggleBet(bet)}
                      disabled={duplicateMatch || (!selected && selectedIds.length >= 20)}
                      className={`w-full rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)]" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] hover:border-[var(--sc-brand-border)]"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-black text-[var(--sc-text)]">{bet.match}</div>
                          <div className="mt-1 text-sm text-[var(--sc-text-secondary)]"><strong>{bet.selection}</strong> @ {number.format(bet.odds)}</div>
                          <div className="mt-1 truncate text-xs text-[var(--sc-faint)]">{[bet.league, bet.market, bet.bookmaker].filter(Boolean).join(" · ") || "Paper pick"}</div>
                        </div>
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-black ${selected ? "border-[var(--sc-brand-border)] bg-[var(--sc-brand)] text-[var(--sc-brand-ink)]" : "border-[var(--sc-border)] text-[var(--sc-muted)]"}`}>{selected ? "✓" : "+"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <aside className="h-fit rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 lg:sticky lg:top-24">
                <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{tr({ fi: "Kuponki", en: "Coupon", es: "Cupón" })}</div>
                <div className="mt-3 flex items-end justify-between gap-3"><span className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Kohteita", en: "Legs", es: "Selecciones" })}</span><strong className="text-lg text-[var(--sc-text)]">{selectedIds.length}</strong></div>
                <div className="mt-2 flex items-end justify-between gap-3"><span className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Kokonaiskerroin", en: "Combined odds", es: "Cuota total" })}</span><strong className="text-lg text-[var(--sc-text)]">{selectedIds.length ? number.format(totalOdds) : "—"}</strong></div>
                <label className="mt-4 block text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{tr({ fi: "Paperipanos", en: "Paper stake", es: "Importe simulado" })}<input value={stake} onChange={(event) => setStake(event.target.value)} inputMode="decimal" className="mt-2 w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-bg)] px-3 py-3 text-lg font-black text-[var(--sc-text)]" /></label>
                <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3"><div className="text-xs font-bold text-emerald-200">{tr({ fi: "Mahdollinen paperipalautus", en: "Potential paper return", es: "Retorno simulado potencial" })}</div><div className="mt-1 text-2xl font-black text-emerald-100">{money(potentialReturn)}</div></div>
                <button type="button" onClick={() => void createCoupon()} disabled={busy !== "" || selectedIds.length < 2} className="sc-button-primary mt-4 w-full justify-center disabled:opacity-40">{busy === "create" ? tr({ fi: "Luodaan…", en: "Creating…", es: "Creando…" }) : tr({ fi: "Luo paperikuponki", en: "Create paper coupon", es: "Crear cupón simulado" })}</button>
              </aside>
            </div>
          </section>

          <section>
            <SectionHeader
              eyebrow={tr({ fi: "Kuponkihistoria", en: "Coupon history", es: "Historial de cupones" })}
              title={tr({ fi: "Oikein, avoin vai ei osunut", en: "Won, open or lost", es: "Acertado, abierto o fallado" })}
              description={tr({ fi: "Tila tulee samoista paperikohteista kuin My Picksissä. Kupongin rivejä ei tarvitse ratkaista erikseen.", en: "Leg status comes from the same paper picks shown in My Picks. Coupon legs do not need separate settlement.", es: "El estado procede de los mismos pronósticos de Mis apuestas. No hay que resolver las selecciones por separado." })}
            />

            {loading ? <div className="mt-5 h-52 animate-pulse rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)]" /> : coupons.length === 0 ? (
              <div className="mt-5"><EmptyState title={tr({ fi: "Ei vielä paperikuponkeja", en: "No paper coupons yet", es: "Aún no hay cupones simulados" })} description={tr({ fi: "Valitse vähintään kaksi avointa paperikohdetta yllä ja luo ensimmäinen yhdistelmä.", en: "Choose at least two open paper picks above to create the first accumulator.", es: "Elige al menos dos pronósticos abiertos para crear la primera combinada." })} /></div>
            ) : (
              <div className="mt-5 space-y-5">
                {coupons.map((coupon) => (
                  <article key={coupon.id} className="overflow-hidden rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] shadow-xl">
                    <header className="border-b border-[var(--sc-border)] p-5 md:p-6">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClasses(coupon.status)}`}>{couponStatusLabel(coupon.status)}</span>
                            <span className="text-xs text-[var(--sc-faint)]">{coupon.createdAt ? new Date(coupon.createdAt).toLocaleString(locale) : "—"}</span>
                          </div>
                          <h2 className="mt-3 text-xl font-black text-[var(--sc-text)]">{tr({ fi: `${coupon.legs?.length || 0} kohteen yhdistelmä`, en: `${coupon.legs?.length || 0}-leg accumulator`, es: `Combinada de ${coupon.legs?.length || 0} selecciones` })}</h2>
                        </div>
                        <button type="button" onClick={() => void deleteCoupon(coupon.id)} disabled={busy !== ""} className="sc-button-ghost shrink-0 disabled:opacity-40">{busy === coupon.id ? tr({ fi: "Poistetaan…", en: "Deleting…", es: "Eliminando…" }) : tr({ fi: "Poista kuponki", en: "Delete coupon", es: "Eliminar cupón" })}</button>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                        <MetricTile compact label={tr({ fi: "Paperipanos", en: "Paper stake", es: "Importe" })} value={money(coupon.stake)} tone="purple" />
                        <MetricTile compact label={tr({ fi: "Kokonaiskerroin", en: "Combined odds", es: "Cuota total" })} value={number.format(Number(coupon.totalOdds || 1))} tone="blue" />
                        <MetricTile compact label={tr({ fi: "Mahd. palautus", en: "Potential return", es: "Retorno potencial" })} value={money(coupon.potentialReturn)} tone="green" />
                        <MetricTile compact label={coupon.status === "open" ? tr({ fi: "Jos kaikki osuvat", en: "If all win", es: "Si todas aciertan" }) : tr({ fi: "Paperitulos", en: "Paper result", es: "Resultado" })} value={coupon.status === "open" ? money(coupon.potentialProfit) : money(coupon.currentProfit)} tone={coupon.status === "lost" ? "red" : "green"} />
                      </div>
                    </header>

                    <div className="divide-y divide-[var(--sc-border)]">
                      {(coupon.legs || []).map((leg, index) => (
                        <div key={leg.id || `${coupon.id}-${index}`} className="grid gap-3 p-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center md:p-5">
                          <div className="text-sm font-black text-[var(--sc-faint)]">{index + 1}.</div>
                          <div className="min-w-0">
                            <div className="font-black text-[var(--sc-text)]">{leg.match}</div>
                            <div className="mt-1 text-xs text-[var(--sc-faint)]">{[leg.league, leg.market].filter(Boolean).join(" · ") || "Paper pick"}</div>
                            <div className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-lg border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] px-2.5 py-1 text-sm font-black text-[var(--sc-text)]">{leg.selection}</span><span className="rounded-lg border border-[var(--sc-border)] px-2.5 py-1 text-sm font-black text-[var(--sc-text-secondary)]">{number.format(Number(leg.odds || 0))}</span></div>
                            <details className="mt-3 text-xs text-[var(--sc-muted)]"><summary className="cursor-pointer font-bold">{tr({ fi: "Scorecaster-data", en: "Scorecaster data", es: "Datos de Scorecaster" })}</summary><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1"><span>Edge {percent(leg.edge)}</span><span>EV {percent(leg.ev)}</span><span>{tr({ fi: "Varmuus", en: "Confidence", es: "Confianza" })} {percent(leg.confidence)}</span>{leg.commenceTime ? <span>{new Date(leg.commenceTime).toLocaleString(locale)}</span> : null}</div></details>
                          </div>
                          <div className={`justify-self-start rounded-full border px-3 py-1 text-sm font-black sm:justify-self-end ${statusClasses(leg.status)}`}>{leg.status === "won" ? "✓ " : ""}{statusLabel(leg.status)}</div>
                        </div>
                      ))}
                    </div>

                    {coupon.warnings?.length ? <div className="border-t border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">{coupon.warnings.join(" ")}</div> : null}
                    <footer className="border-t border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-5 py-3 text-xs text-[var(--sc-faint)]">{tr({ fi: "Scorecaster-paperikuponki", en: "Scorecaster paper coupon", es: "Cupón simulado Scorecaster" })} · {coupon.id}</footer>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
