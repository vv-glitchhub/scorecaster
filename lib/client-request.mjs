export class RequestError extends Error {
  constructor(message, status = 0, code = "unavailable") {
    super(message); this.name = "RequestError"; this.status = status; this.code = code;
  }
}

// No response cache or automatic retries: a write may already have reached the server.
export async function fetchJson(url, { timeoutMs = 55000, signal, ...options } = {}) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await fetch(url, { ...options, cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.ok === false) throw new RequestError("Request could not be completed", response.status, payload?.errorCode || "unavailable");
  return payload;
}

export function requestErrorText(error, tr) {
  if (error?.status === 401) return tr({ fi: "Kirjaudu sisään jatkaaksesi. Palaat sen jälkeen tähän näkymään.", en: "Sign in to continue. You will return to this view afterwards.", es: "Inicia sesión para continuar. Volverás a esta vista después." });
  if (error?.status === 429) return tr({ fi: "Pyyntöjä on nyt paljon. Odota hetki ja yritä uudelleen.", en: "Too many requests. Wait a moment and try again.", es: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo." });
  if (error?.name === "TimeoutError") return tr({ fi: "Lataus kesti liian kauan. Tarkista yhteys ja yritä uudelleen.", en: "Loading timed out. Check your connection and try again.", es: "La carga tardó demasiado. Comprueba tu conexión e inténtalo de nuevo." });
  if (error?.status === 404) return tr({ fi: "Ottelu ei ole enää saatavilla nykyisessä markkinadatassa. Palaa ottelulistaan tai yritä päivittää.", en: "This event is no longer in the current market data. Return to matches or try refreshing.", es: "El evento ya no está en los datos actuales. Vuelve a los partidos o actualiza." });
  if (error?.status === 409) return tr({ fi: "Kohteen tiedot muuttuivat. Päivitä ottelun analyysi ennen tallennusta.", en: "The selection changed. Refresh the match analysis before saving.", es: "La selección cambió. Actualiza el análisis antes de guardar." });
  return tr({ fi: "Tietoja ei voitu hakea. Yritä uudelleen hetken kuluttua.", en: "The data could not be loaded. Please try again shortly.", es: "No se pudieron cargar los datos. Vuelve a intentarlo en un momento." });
}
