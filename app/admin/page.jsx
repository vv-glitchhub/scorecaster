"use client";

import { useEffect, useRef, useState } from "react";

const SESSION_DURATION_MS = 60 * 60 * 1000;

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState("");
  const [liveBanner, setLiveBanner] = useState("");
  const [authError, setAuthError] = useState("");

  const previousUnreadRef = useRef(0);
  const previousTopIdRef = useRef(null);
  const pollIntervalRef = useRef(null);

  function clearAdminSession() {
    localStorage.removeItem("admin_auth");
    localStorage.removeItem("admin_auth_expires_at");
  }

  function saveAdminSession() {
    localStorage.setItem("admin_auth", "true");
    localStorage.setItem(
      "admin_auth_expires_at",
      String(Date.now() + SESSION_DURATION_MS)
    );
  }

  function hasValidSession() {
    const auth = localStorage.getItem("admin_auth");
    const expiresAtRaw = localStorage.getItem("admin_auth_expires_at");
    const expiresAt = Number(expiresAtRaw);

    if (auth !== "true") return false;
    if (!Number.isFinite(expiresAt)) return false;
    if (Date.now() > expiresAt) return false;

    return true;
  }

  function logout() {
    clearAdminSession();
    setIsAdmin(false);
    setAuthenticated(false);
    setFeedbacks([]);
    setUnreadCount(0);
    setLiveBanner("");
    setSecret("");
    setAuthError("");
    previousUnreadRef.current = 0;
    previousTopIdRef.current = null;

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }

  async function fetchFeedbacks(showLoading = false) {
    if (!secret || !isAdmin) return;

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
        setAuthError("Väärä admin secret tai pääsy evätty.");
        clearAdminSession();
        setIsAdmin(false);
        return;
      }

      const data = await res.json();
      const items = Array.isArray(data.data) ? data.data : [];
      const nextUnread = Number(data.unreadCount || 0);

      setAuthenticated(true);
      setFeedbacks(items);
      setUnreadCount(nextUnread);
      setAuthError("");

      if (items.length > 0) {
        const newest = items[0];
        const newestId = newest.id;

        const hasNewUnread =
          previousUnreadRef.current > 0
            ? nextUnread > previousUnreadRef.current
            : nextUnread > 0 &&
              previousTopIdRef.current &&
              previousTopIdRef.current !== newestId;

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
      setAuthError("Palautteiden haku epäonnistui.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function handleLogin() {
    if (!secret.trim()) {
      setAuthError("Syötä admin secret.");
      return;
    }

    setLoading(true);
    setAuthError("");
    setLiveBanner("");

    try {
      const res = await fetch("/api/admin-feedback", {
        headers: {
          "x-admin-secret": secret.trim(),
        },
        cache: "no-store",
      });

      if (!res.ok) {
        clearAdminSession();
        setIsAdmin(false);
        setAuthenticated(false);
        setFeedbacks([]);
        setUnreadCount(0);
        setAuthError("Väärä admin secret.");
        return;
      }

      const data = await res.json();
      const items = Array.isArray(data.data) ? data.data : [];

      saveAdminSession();
      setIsAdmin(true);
      setAuthenticated(true);
      setFeedbacks(items);
      setUnreadCount(Number(data.unreadCount || 0));
      setAuthError("");

      previousUnreadRef.current = Number(data.unreadCount || 0);
      previousTopIdRef.current = items[0]?.id || null;
    } catch (error) {
      console.error(error);
      clearAdminSession();
      setIsAdmin(false);
      setAuthenticated(false);
      setAuthError("Kirjautuminen epäonnistui.");
    } finally {
      setLoading(false);
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
      // eslint-disable-next-line no-await-in-loop
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

  useEffect(() => {
    const valid = hasValidSession();
    setIsAdmin(valid);

    if (!valid) {
      clearAdminSession();
    }
  }, []);

  useEffect(() => {
    if (!isAdmin || !secret) return;

    fetchFeedbacks(true);

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(() => {
      if (!hasValidSession()) {
        logout();
        return;
      }
      fetchFeedbacks(false);
    }, 10000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isAdmin, secret]);

  useEffect(() => {
    if (!isAdmin) return;

    const expiresAt = Number(localStorage.getItem("admin_auth_expires_at"));

    if (!Number.isFinite(expiresAt)) {
      logout();
      return;
    }

    const timeoutMs = expiresAt - Date.now();

    if (timeoutMs <= 0) {
      logout();
      return;
    }

    const timeout = setTimeout(() => {
      logout();
    }, timeoutMs);

    return () => clearTimeout(timeout);
  }, [isAdmin]);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Admin</h1>

        <div style={styles.card}>
          <label style={styles.label}>Admin secret</label>

          <div style={styles.secretWrap}>
            <input
              type={showSecret ? "text" : "text"}
              name="admin_access_code"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
              style={styles.input}
              placeholder="Syötä ADMIN_SECRET"
            />

            <button
              type="button"
              onClick={() => setShowSecret((prev) => !prev)}
              style={styles.eyeButton}
            >
              {showSecret ? "Piilota" : "Näytä"}
            </button>
          </div>

          <div style={styles.buttonRow}>
            <button style={styles.button} onClick={handleLogin} disabled={loading}>
              {loading ? "Ladataan..." : "Kirjaudu / Päivitä"}
            </button>

            <button
              style={styles.secondaryButton}
              onClick={enableNotifications}
              type="button"
            >
              Salli ilmoitukset
            </button>

            {isAdmin && (
              <button style={styles.secondaryButton} onClick={logout} type="button">
                Kirjaudu ulos
              </button>
            )}

            {authenticated && unreadCount > 0 && (
              <button
                style={styles.secondaryButton}
                onClick={markAllAsRead}
                type="button"
              >
                Merkitse kaikki luetuiksi
              </button>
            )}
          </div>

          {notificationStatus ? (
            <div style={styles.notificationInfo}>{notificationStatus}</div>
          ) : null}

          {authError ? <div style={styles.errorText}>{authError}</div> : null}
        </div>

        {!isAdmin && !loading && (
          <p style={styles.muted}>
            Syötä admin secret ja paina Kirjaudu / Päivitä.
          </p>
        )}

        {liveBanner ? <div style={styles.liveBanner}>🔔 {liveBanner}</div> : null}

        {authenticated && (
          <div style={styles.badgeCard}>
            <div>
              <div style={styles.badgeTitle}>Uusia palautteita</div>
              <div style={styles.badgeSub}>
                Päivittyy automaattisesti 10 sek välein
              </div>
            </div>
            <div style={styles.badgeValue}>{unreadCount}</div>
          </div>
        )}

        {authenticated && feedbacks.length === 0 && (
          <p style={styles.muted}>Ei palautteita</p>
        )}

        <div style={styles.list}>
          {authenticated &&
            feedbacks.map((item) => (
              <div
                key={item.id}
                style={{
                  ...styles.feedbackCard,
                  border: item.is_read
                    ? "1px solid #334155"
                    : "2px solid #22c55e",
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
                    type="button"
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
  secretWrap: {
    position: "relative",
  },
  input: {
    width: "100%",
    padding: "12px 92px 12px 14px",
    borderRadius: 12,
    border: "1px solid #334155",
    background: "#0b1730",
    color: "#ffffff",
    fontSize: 16,
    boxSizing: "border-box",
  },
  eyeButton: {
    position: "absolute",
    top: "50%",
    right: 10,
    transform: "translateY(-50%)",
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#fff",
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
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
  errorText: {
    marginTop: 12,
    color: "#fca5a5",
    fontSize: 14,
    fontWeight: 700,
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
