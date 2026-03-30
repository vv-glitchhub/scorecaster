"use client";

import { useEffect, useRef, useState } from "react";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const previousTopIdRef = useRef(null);

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
        return;
      }

      const data = await res.json();
      const items = Array.isArray(data.data) ? data.data : [];

      setAuthenticated(true);
      setFeedbacks(items);
      setUnreadCount(data.unreadCount || 0);

      if (items.length > 0) {
        const newestId = items[0].id;

        if (
          previousTopIdRef.current &&
          previousTopIdRef.current !== newestId &&
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          new Notification("Uusi palaute Scorecasterissa", {
            body: items[0].message || "Sinulle tuli uusi palaute.",
          });
        }

        previousTopIdRef.current = newestId;
      }
    } catch (error) {
      console.error(error);
      setAuthenticated(false);
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
      }
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("scorecaster_admin_secret");
    if (saved) {
      setSecret(saved);
    }
  }, []);

  useEffect(() => {
    if (!secret) return;

    localStorage.setItem("scorecaster_admin_secret", secret);
    fetchFeedbacks(true);

    const interval = setInterval(() => {
      fetchFeedbacks(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [secret]);

  async function enableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    await Notification.requestPermission();
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
          />

          <div style={styles.buttonRow}>
            <button style={styles.button} onClick={() => fetchFeedbacks(true)}>
              Kirjaudu / Päivitä
            </button>

            <button style={styles.secondaryButton} onClick={enableNotifications}>
              Salli ilmoitukset
            </button>
          </div>
        </div>

        {authenticated && (
          <div style={styles.badgeCard}>
            <div style={styles.badgeTitle}>Uusia palautteita</div>
            <div style={styles.badgeValue}>{unreadCount}</div>
          </div>
        )}

        {loading && <p style={styles.muted}>Ladataan...</p>}

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
                <div style={styles.readState}>
                  {item.is_read ? "Luettu" : "Uusi"}
                </div>
              </div>

              <div style={styles.message}>{item.message}</div>

              <div style={styles.metaLine}>
                Laji: {item.selected_group || "-"}
              </div>
              <div style={styles.metaLine}>
                Liiga: {item.selected_sport_key || "-"}
              </div>
              <div style={styles.metaLine}>
                Ottelu: {item.selected_game || "-"}
              </div>
              <div style={styles.metaLine}>
                Bankroll: {item.bankroll ?? "-"}
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
  },
  badgeTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  badgeValue: {
    fontSize: 32,
    fontWeight: 900,
    color: "#22c55e",
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
