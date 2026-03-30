"use client";

import { useEffect, useRef, useState } from "react";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState("");
  const [liveBanner, setLiveBanner] = useState("");

  const previousUnreadRef = useRef(0);
  const previousTopIdRef = useRef(null);
  const pollIntervalRef = useRef(null);

  async function fetchFeedbacks(showLoading = false) {
    if (!secret) return;

    if (showLoading) setLoading(true);

    try {
      const res = await fetch("/api/admin-feedback", {
        headers: {
          "x-admin-secret": secret,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        setAuthenticated(false);
        setFeedbacks([]);
        setUnreadCount(0);
        setLiveBanner("");
        return;
      }

      const data = await res.json();
      const items = Array.isArray(data.data) ? data.data : [];
      const nextUnread = Number(data.unreadCount || 0);

      setAuthenticated(true);
      setFeedbacks(items);
      setUnreadCount(nextUnread);

      if (items.length > 0) {
        const newest = items[0];
        const newestId = newest.id;

        const hasNewUnread =
          previousUnreadRef.current > 0
            ? nextUnread > previousUnreadRef.current
            : nextUnread > 0 && previousTopIdRef.current && previousTopIdRef.current !== newestId;

        if (hasNewUnread) {
          const message = newest.message || "Sinulle tuli uusi palaute.";
          setLiveBanner(`Uusi palaute: ${message}`);

          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            try {
              new Notification("Uusi palaute Scorecasterissa", {
                body: message,
              });
            } catch (err) {
              console.error("notification error:", err);
            }
          }
        }

        previousTopIdRef.current = newestId;
      }

      previousUnreadRef.current = nextUnread;
    } catch (error) {
      console.error(error);
      setAuthenticated(false);
      setLiveBanner("");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function markAsRead(id) {
    try {
      const res = await fetch("/api/admin-feedback/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setFeedbacks((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, is_read: true } : item
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        previousUnreadRef.current = Math.max(0, previousUnreadRef.current - 1);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function markAllAsRead() {
    const unreadItems = feedbacks.filter((item) => !item.is_read);

    for (const item of unreadItems) {
      await markAsRead(item.id);
    }
  }

  async function enableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationStatus("Selain ei tue ilmoituksia.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        setNotificationStatus("Ilmoitukset sallittu.");
      } else if (permission === "denied") {
        setNotificationStatus("Ilmoitukset estetty selaimessa.");
      } else {
        setNotificationStatus("Ilmoituksia ei sallittu.");
      }
    } catch (error) {
      console.error(error);
      setNotificationStatus("Ilmoitusten sallinta epäonnistui.");
    }
  }

  function logout() {
    setAuthenticated(false);
    setFeedbacks([]);
    setUnreadCount(0);
    setLiveBanner("");
    setSecret("");
    previousUnreadRef.current = 0;
    previousTopIdRef.current = null;

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }

  useEffect(() => {
    if (!authenticated || !secret) return;

    fetchFeedbacks(true);

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(() => {
      fetchFeedbacks(false);
    }, 10000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [authenticated, secret]);

  function handleLogin() {
    previousUnreadRef.current = 0;
    previousTopIdRef.current = null;
    fetchFeedbacks(true);
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Admin</h1>

        <div style={styles.card}>
          <label style={styles.label}>Admin secret</label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            style={styles.input}
            placeholder="Syötä ADMIN_SECRET"
          />

          <div style={styles.buttonRow}>
            <button style={styles.button} onClick={handleLogin}>
              Kirjaudu / Päivitä
            </button>

            <button style={styles.secondaryButton} onClick={enableNotifications}>
              Salli ilmoitukset
            </button>

            {authenticated && (
              <button style={styles.secondaryButton} onClick={logout}>
                Kirjaudu ulos
              </button>
            )}

            {authenticated && unreadCount > 0 && (
              <button style={styles.secondaryButton} onClick={markAllAsRead}>
                Merkitse kaikki luetuiksi
              </button>
            )}
          </div>

          {notificationStatus ? (
            <div style={styles.notificationInfo}>{notificationStatus}</div>
          ) : null}
        </div>

        {liveBanner ? <div style={styles.liveBanner}>🔔 {liveBanner}</div> : null}

        {authenticated && (
          <div style={styles.badgeCard}>
            <div>
              <div style={styles.badgeTitle}>Uusia palautteita</div>
              <div style={styles.badgeSub}>Päivittyy automaattisesti 10 sek välein</div>
            </div>
            <div style={styles.badgeValue}>{unreadCount}</div>
          </div>
        )}

        {loading && <p style={styles.muted}>Ladataan...</p>}

        {!authenticated && !loading && (
          <p style={styles.muted}>
            Syötä admin secret ja paina Kirjaudu / Päivitä.
          </p>
        )}

        {authenticated && feedbacks.length === 0 && (
          <p style={styles.muted}>Ei palautteita</p>
        )}

        <div style={styles.list}>
          {feedbacks.map((item) => (
            <div
              key={item.id}
              style={{
                ...styles.feedbackCard,
                border: item.is_read ? "1px solid #334155" : "2px solid #22c55e",
              }}
            >
              <div style={styles.feedbackTop}>
                <div style={styles.feedbackMeta}>
                  {item.created_at
                    ? new Date(item.created_at).toLocaleString("fi-FI")
                    : "-"}
                </div>
                <div
                  style={{
                    ...styles.readState,
                    color: item.is_read ? "#94a3b8" : "#22c55e",
                  }}
                >
                  {item.is_read ? "Luettu" : "Uusi"}
                </div>
              </div>

              <div style={styles.message}>{item.message}</div>

              <div style={styles.metaLine}>
                <strong>Laji:</strong> {item.selected_group || "-"}
              </div>
              <div style={styles.metaLine}>
                <strong>Liiga:</strong> {item.selected_sport_key || "-"}
              </div>
              <div style={styles.metaLine}>
                <strong>Ottelu:</strong> {item.selected_game || "-"}
              </div>
              <div style={styles.metaLine}>
                <strong>Bankroll:</strong> {item.bankroll ?? "-"}
              </div>

              {!item.is_read && (
                <button
                  style={styles.readButton}
                  onClick={() => markAsRead(item.id)}
                >
                  Merkitse luetuksi
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#020617",
    color: "#fff",
    padding: 20,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
  },
  title: {
    fontSize: 36,
    fontWeight: 900,
    marginBottom: 20,
  },
  card: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  badgeCard: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  badgeTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  badgeSub: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
  },
  badgeValue: {
    fontSize: 32,
    fontWeight: 900,
    color: "#22c55e",
  },
  liveBanner: {
    background: "#14532d",
    border: "1px solid #22c55e",
    color: "#dcfce7",
    padding: "12px 14px",
    borderRadius: 14,
    marginBottom: 20,
    fontWeight: 700,
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontWeight: 700,
    color: "#cbd5e1",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #334155",
    background: "#0b1730",
    color: "#fff",
    fontSize: 16,
    boxSizing: "border-box",
  },
  buttonRow: {
    display: "flex",
    gap: 10,
    marginTop: 14,
    flexWrap: "wrap",
  },
  button: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "none",
    background: "#16a34a",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  notificationInfo: {
    marginTop: 12,
    color: "#cbd5e1",
    fontSize: 14,
  },
  muted: {
    color: "#94a3b8",
  },
  list: {
    display: "grid",
    gap: 14,
  },
  feedbackCard: {
    background: "#0f172a",
    borderRadius: 18,
    padding: 16,
  },
  feedbackTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  feedbackMeta: {
    color: "#94a3b8",
    fontSize: 14,
  },
  readState: {
    fontWeight: 800,
  },
  message: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 12,
    whiteSpace: "pre-wrap",
  },
  metaLine: {
    color: "#cbd5e1",
    marginBottom: 6,
  },
  readButton: {
    marginTop: 12,
    padding: "10px 14px",
    borderRadius: 10,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
};
