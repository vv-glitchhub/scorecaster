"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

const number = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";
const percent = (value, digits = 1) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";

function eventTitle(event, fallback) {
  const payload = event?.payload || event?.latestPayload || {};
  const home = event?.homeTeam || event?.home_team || payload.homeTeam || payload.home_team;
  const away = event?.awayTeam || event?.away_team || payload.awayTeam || payload.away_team;
  if (home && away) return `${home} – ${away}`;
  return event?.name || event?.title || fallback || "Ottelu";
}

function eventMeta(event) {
  return [event?.sport, event?.league].filter(Boolean).join(" · ") || "Scorecaster AI";
}

function readStored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

export default function FeedClient() {
  const { tr, locale } = useLanguage();
  const [data, setData] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentStatus, setCommentStatus] = useState({});
  const [drafts, setDrafts] = useState({});
  const [liked, setLiked] = useState([]);
  const [saved, setSaved] = useState([]);
  const [sort, setSort] = useState("latest");
  const [deletingCommentId, setDeletingCommentId] = useState("");
  const [expandedComments, setExpandedComments] = useState([]);

  async function loadFeed({ silent = false } = {}) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [feedResponse, commentsResponse] = await Promise.all([
        fetch("/api/scorecaster-app?hours=72&limit=3000", { cache: "no-store" }),
        fetch("/api/community/comments?limit=200", { cache: "no-store" })
      ]);
      const feedPayload = await feedResponse.json();
      const commentsPayload = await commentsResponse.json().catch(() => ({ comments: [] }));
      if (!feedResponse.ok) throw new Error(feedPayload.error || "AI Feed unavailable");
      setData(feedPayload);
      if (commentsResponse.ok) setComments(commentsPayload.comments || []);
    } catch (cause) {
      setError(cause?.message || "AI Feed unavailable");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    setLiked(readStored("scorecaster-feed-liked", []));
    setSaved(readStored("scorecaster-feed-saved", []));
    void loadFeed();
    const timer = window.setInterval(() => loadFeed({ silent: true }), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const eventMap = useMemo(() => new Map((data?.events || []).map((event) => [event.eventId, event])), [data]);
  const commentsByEvent = useMemo(() => comments.reduce((result, comment) => {
    const key = comment.event_id;
    if (!result[key]) result[key] = [];
    result[key].push(comment);
    return result;
  }, {}), [comments]);

  const posts = useMemo(() => {
    const source = data?.controlCenter?.dailyTop3 || [];
    const mapped = source.map((pick, index) => {
      const event = eventMap.get(pick.eventId) || {};
      const eventComments = commentsByEvent[pick.eventId] || [];
      const createdAt = event?.observedAt || event?.updatedAt || data?.generatedAt || new Date().toISOString();
      return {
        ...pick,
        rank: index + 1,
        title: eventTitle(event, pick.eventId),
        meta: eventMeta(event),
        createdAt,
        commentCount: eventComments.length,
        localScore: (liked.includes(pick.eventId) ? 10 : 0) + eventComments.length * 2 + Number(pick.score || 0)
      };
    });
    return [...mapped].sort((a, b) => sort === "trending"
      ? b.localScore - a.localScore
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data, eventMap, commentsByEvent, liked, sort]);

  function toggleStored(eventId, state, setState, key) {
    const next = state.includes(eventId) ? state.filter((id) => id !== eventId) : [...state, eventId];
    setState(next);
    localStorage.setItem(key, JSON.stringify(next));
  }

  function toggleCommentExpansion(eventId) {
    setExpandedComments((current) => current.includes(eventId)
      ? current.filter((id) => id !== eventId)
      : [...current, eventId]);
  }

  async function submitComment(eventId) {
    const message = String(drafts[eventId] || "").trim();
    if (message.length < 2) return;
    setCommentStatus((current) => ({ ...current, [eventId]: tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) }));

    try {
      const response = await fetch("/api/community/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, message })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Comment failed");
      setComments((current) => [payload.comment, ...current]);
      setDrafts((current) => ({ ...current, [eventId]: "" }));
      setCommentStatus((current) => ({ ...current, [eventId]: tr({ fi: "Kommentti julkaistu", en: "Comment published", es: "Comentario publicado" }) }));
    } catch (cause) {
      setCommentStatus((current) => ({ ...current, [eventId]: cause?.message || "Comment failed" }));
    }
  }

  async function deleteComment(comment) {
    const confirmed = window.confirm(tr({
      fi: "Poistetaanko oma kommenttisi pysyvästi?",
      en: "Delete your comment permanently?",
      es: "¿Eliminar tu comentario permanentemente?"
    }));
    if (!confirmed) return;

    setDeletingCommentId(comment.id);
    setCommentStatus((current) => ({ ...current, [comment.event_id]: tr({ fi: "Poistetaan…", en: "Deleting…", es: "Eliminando…" }) }));

    try {
      const response = await fetch("/api/community/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: comment.id })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Comment could not be deleted");
      setComments((current) => current.filter((item) => item.id !== payload.deletedId));
      setCommentStatus((current) => ({ ...current, [comment.event_id]: tr({ fi: "Kommentti poistettu", en: "Comment deleted", es: "Comentario eliminado" }) }));
    } catch (cause) {
      setCommentStatus((current) => ({ ...current, [comment.event_id]: cause?.message || "Comment could not be deleted" }));
    } finally {
      setDeletingCommentId("");
    }
  }

  const updated = data?.generatedAt ? new Date(data.generatedAt).toLocaleString(locale) : "–";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-[2rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">AI Feed</div>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--sc-text)] sm:text-4xl">{tr({ fi: "AI julkaisee kiinnostavimmat ottelut tähän.", en: "AI publishes the most interesting matches here.", es: "La IA publica aquí los partidos más interesantes." })}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--sc-muted)]">{tr({ fi: "Syöte päivittyy automaattisesti minuutin välein. Tykkää, tallenna ja keskustele muiden käyttäjien kanssa.", en: "The feed refreshes automatically every minute. Like, save and discuss the analysis with other users.", es: "El feed se actualiza cada minuto. Reacciona, guarda y comenta con otros usuarios." })}</p>
          </div>
          <div className="shrink-0 text-xs text-[var(--sc-muted)]">{tr({ fi: "Päivitetty", en: "Updated", es: "Actualizado" })}<br /><span className="font-black text-[var(--sc-text)]">{updated}</span></div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={() => setSort("latest")} className={`rounded-full px-4 py-2 text-xs font-black ${sort === "latest" ? "bg-[var(--sc-brand)] text-[var(--sc-brand-ink)]" : "border border-[var(--sc-border)] text-[var(--sc-muted)]"}`}>{tr({ fi: "Uusimmat", en: "Latest", es: "Últimos" })}</button>
          <button type="button" onClick={() => setSort("trending")} className={`rounded-full px-4 py-2 text-xs font-black ${sort === "trending" ? "bg-[var(--sc-brand)] text-[var(--sc-brand-ink)]" : "border border-[var(--sc-border)] text-[var(--sc-muted)]"}`}>{tr({ fi: "Nousussa", en: "Trending", es: "Tendencias" })}</button>
          <button type="button" onClick={() => loadFeed()} className="rounded-full border border-[var(--sc-border)] px-4 py-2 text-xs font-black text-[var(--sc-muted)]">{tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}</button>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-sm text-red-100">{error}</div>}
      {loading && <div className="space-y-4">{[1, 2, 3].map((item) => <div key={item} className="h-80 animate-pulse rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)]" />)}</div>}
      {!loading && !posts.length && <div className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-10 text-center text-[var(--sc-muted)]">{tr({ fi: "AI ei ole vielä julkaissut uusia kohteita.", en: "AI has not published new picks yet.", es: "La IA aún no ha publicado pronósticos." })}</div>}

      <div className="space-y-5">
        {posts.map((post) => {
          const postComments = commentsByEvent[post.eventId] || [];
          const isLiked = liked.includes(post.eventId);
          const isSaved = saved.includes(post.eventId);
          const commentsExpanded = expandedComments.includes(post.eventId);
          const visibleComments = commentsExpanded ? postComments : postComments.slice(0, 5);
          const draftLength = String(drafts[post.eventId] || "").length;

          return (
            <article key={post.eventId} className="overflow-hidden rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)]">
              <div className="p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] text-lg font-black text-[var(--sc-text)]">AI</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--sc-muted)]"><span className="font-black text-[var(--sc-text)]">Scorecaster AI</span><span>·</span><span>{new Date(post.createdAt).toLocaleString(locale)}</span><span>·</span><span>{post.meta}</span></div>
                    <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-[var(--sc-text)]">{post.title}</h2>
                    <div className="mt-3 inline-flex rounded-full border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] px-3 py-1 text-xs font-black text-[var(--sc-text)]">{post.decision || "SKIP"}</div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-[var(--sc-surface-soft)] p-4 text-sm leading-7 text-[var(--sc-text-secondary)]">
                  {tr({ fi: `Malli nosti ottelun sijalle ${post.rank}. AI-pisteet ovat ${number(post.score, 0)}/100, arvioitu mallietu ${percent(post.edge)} ja datan laatu ${percent(post.quality)}.`, en: `The model ranked this match #${post.rank}. AI score is ${number(post.score, 0)}/100, estimated edge ${percent(post.edge)} and data quality ${percent(post.quality)}.`, es: `El modelo clasificó este partido #${post.rank}. Puntuación IA ${number(post.score, 0)}/100, ventaja estimada ${percent(post.edge)} y calidad de datos ${percent(post.quality)}.` })}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-[var(--sc-border)] p-3 text-center"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">AI</div><div className="mt-1 text-lg font-black text-[var(--sc-text)]">{number(post.score, 0)}</div></div>
                  <div className="rounded-2xl border border-[var(--sc-border)] p-3 text-center"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">Edge</div><div className="mt-1 text-lg font-black text-[var(--sc-text)]">{percent(post.edge)}</div></div>
                  <div className="rounded-2xl border border-[var(--sc-border)] p-3 text-center"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">{tr({ fi: "Kerroin", en: "Odds", es: "Cuota" })}</div><div className="mt-1 text-lg font-black text-[var(--sc-text)]">{number(post.bestOdds)}</div></div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--sc-border)] pt-4">
                  <button type="button" onClick={() => toggleStored(post.eventId, liked, setLiked, "scorecaster-feed-liked")} className={`rounded-xl px-4 py-2 text-sm font-black ${isLiked ? "bg-[var(--sc-brand-soft)] text-[var(--sc-text)]" : "text-[var(--sc-muted)] hover:bg-[var(--sc-surface-soft)]"}`}>{isLiked ? "♥" : "♡"} {tr({ fi: "Tykkää", en: "Like", es: "Me gusta" })}</button>
                  <button type="button" onClick={() => toggleStored(post.eventId, saved, setSaved, "scorecaster-feed-saved")} className={`rounded-xl px-4 py-2 text-sm font-black ${isSaved ? "bg-[var(--sc-brand-soft)] text-[var(--sc-text)]" : "text-[var(--sc-muted)] hover:bg-[var(--sc-surface-soft)]"}`}>{isSaved ? "★" : "☆"} {tr({ fi: "Tallenna", en: "Save", es: "Guardar" })}</button>
                  <Link href={`/events?eventId=${encodeURIComponent(post.eventId)}`} className="rounded-xl px-4 py-2 text-sm font-black text-[var(--sc-brand)] hover:bg-[var(--sc-brand-soft)]">{tr({ fi: "Syväanalyysi", en: "Deep analysis", es: "Análisis completo" })}</Link>
                  <div className="ml-auto rounded-xl px-3 py-2 text-sm font-bold text-[var(--sc-muted)]">{postComments.length} {tr({ fi: "kommenttia", en: "comments", es: "comentarios" })}</div>
                </div>
              </div>

              <div className="border-t border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5 sm:p-6">
                <div className="space-y-3">
                  {visibleComments.map((comment) => (
                    <div key={comment.id} className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-[var(--sc-text)]">{comment.author_name}</div>
                          <div className="mt-1 text-[10px] text-[var(--sc-faint)]">{new Date(comment.created_at).toLocaleString(locale)}</div>
                        </div>
                        {comment.ownedByViewer && (
                          <button
                            type="button"
                            disabled={deletingCommentId === comment.id}
                            onClick={() => deleteComment(comment)}
                            className="rounded-lg px-2 py-1 text-[11px] font-black text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            {deletingCommentId === comment.id
                              ? tr({ fi: "Poistetaan…", en: "Deleting…", es: "Eliminando…" })
                              : tr({ fi: "Poista", en: "Delete", es: "Eliminar" })}
                          </button>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--sc-text-secondary)]">{comment.message}</p>
                    </div>
                  ))}
                </div>

                {postComments.length > 5 && (
                  <button type="button" onClick={() => toggleCommentExpansion(post.eventId)} className="mt-3 text-xs font-black text-[var(--sc-brand)] hover:underline">
                    {commentsExpanded
                      ? tr({ fi: "Näytä vähemmän", en: "Show fewer", es: "Mostrar menos" })
                      : tr({ fi: `Näytä kaikki ${postComments.length} kommenttia`, en: `Show all ${postComments.length} comments`, es: `Mostrar los ${postComments.length} comentarios` })}
                  </button>
                )}

                <div className="mt-4 flex gap-2">
                  <input value={drafts[post.eventId] || ""} onChange={(event) => setDrafts((current) => ({ ...current, [post.eventId]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") void submitComment(post.eventId); }} maxLength={500} placeholder={tr({ fi: "Kirjoita kommentti…", en: "Write a comment…", es: "Escribe un comentario…" })} className="min-w-0 flex-1 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] px-4 py-3 text-sm text-[var(--sc-text)] outline-none focus:border-[var(--sc-brand-border)]" />
                  <button type="button" disabled={draftLength < 2} onClick={() => submitComment(post.eventId)} className="rounded-xl bg-[var(--sc-brand)] px-4 py-3 text-sm font-black text-[var(--sc-brand-ink)] disabled:cursor-not-allowed disabled:opacity-40">{tr({ fi: "Lähetä", en: "Send", es: "Enviar" })}</button>
                </div>
                <div className="mt-2 flex items-start justify-between gap-3 text-[11px] text-[var(--sc-faint)]">
                  <span>{tr({ fi: "Linkit ja sähköpostiosoitteet eivät ole sallittuja.", en: "Links and email addresses are not allowed.", es: "No se permiten enlaces ni correos electrónicos." })}</span>
                  <span className="shrink-0">{draftLength}/500</span>
                </div>
                {commentStatus[post.eventId] && <div className="mt-2 text-xs text-[var(--sc-muted)]">{commentStatus[post.eventId]} {commentStatus[post.eventId].toLowerCase().includes("auth") && <Link href="/profile" className="font-black text-[var(--sc-brand)]">{tr({ fi: "Kirjaudu profiilissa", en: "Sign in from Profile", es: "Inicia sesión en Perfil" })}</Link>}</div>}
              </div>
            </article>
          );
        })}
      </div>

      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-xs leading-6 text-[var(--sc-muted)]">{tr({ fi: "AI Feed ei ole vedonlyöntineuvo eikä lupaus tuotosta. Julkaisut ovat paper-only-analyysiä. Kommentoi asiallisesti äläkä julkaise henkilötietoja.", en: "AI Feed is not betting advice or a promise of returns. Posts are paper-only analysis. Keep comments respectful and do not publish personal information.", es: "AI Feed no es asesoramiento ni una promesa de ganancias. Las publicaciones son análisis simulados. Comenta con respeto y no publiques datos personales." })}</div>
    </div>
  );
}
