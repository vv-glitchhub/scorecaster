import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export async function saveBetToCloud(pick) {
  const supabase = createSupabaseBrowserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "Not logged in",
    };
  }

  const payload = {
    user_id: user.id,

    label: pick.label || "",
    market: pick.market || "",
    bookmaker: pick.bookmaker || "",

    sport: pick.match?.sport_key || "",
    league: pick.match?.sport_title || "",

    home_team: pick.match?.home_team || "",
    away_team: pick.match?.away_team || "",

    odds: Number(pick.odds || 0),
    stake: Number(pick.stake || 0),
    edge: Number(pick.edge || 0),
    ev: Number(pick.ev || 0),

    raw_pick: pick,
  };

  const { data, error } = await supabase
    .from("bets")
    .insert(payload)
    .select()
    .single();

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  return {
    ok: true,
    bet: data,
  };
}

export async function fetchCloudBets() {
  const supabase = createSupabaseBrowserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("bets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return [];

  return data || [];
}
