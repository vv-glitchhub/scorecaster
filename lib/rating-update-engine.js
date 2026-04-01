import { supabaseAdmin } from "./supabase-admin";
import { buildFootballPlayerRating } from "./player-ratings/football";
import { buildFootballTeamRating } from "./team-rating-builder";

function groupByTeam(players) {
  const map = new Map();

  for (const player of players) {
    const key = player.team || "Unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(player);
  }

  return map;
}

function smoothRating(oldValue, newValue, alpha = 0.2) {
  const oldNum = Number(oldValue || 0);
  const newNum = Number(newValue || 0);
  return oldNum * (1 - alpha) + newNum * alpha;
}

async function getExistingPlayerRatings(sport) {
  const { data, error } = await supabaseAdmin
    .from("player_ratings")
    .select("*")
    .eq("sport", sport);

  if (error) throw error;
  return data || [];
}

async function getExistingTeamRatings(sport) {
  const { data, error } = await supabaseAdmin
    .from("team_ratings")
    .select("*")
    .eq("sport", sport);

  if (error) throw error;
  return data || [];
}

export async function updateFootballRatingsFromStructuredPlayers(players, source = "structured_feed") {
  const sport = "football";

  const existingPlayers = await getExistingPlayerRatings(sport);
  const existingTeams = await getExistingTeamRatings(sport);

  const existingPlayerMap = new Map(
    existingPlayers.map((row) => [`${row.team}__${row.player_name}`, row])
  );

  const existingTeamMap = new Map(
    existingTeams.map((row) => [row.team, row])
  );

  const builtPlayers = players.map(buildFootballPlayerRating);

  const playerRows = builtPlayers.map((player) => {
    const key = `${player.team}__${player.name}`;
    const oldRow = existingPlayerMap.get(key);

    return {
      sport,
      team: player.team,
      player_name: player.name,
      position: player.position,
      attack: smoothRating(oldRow?.attack, player.attackComponent),
      possession: smoothRating(oldRow?.possession, player.possessionComponent),
      defense: smoothRating(oldRow?.defense, player.defenseComponent),
      form: smoothRating(oldRow?.form, player.formComponent),
      overall: smoothRating(oldRow?.overall, player.overall),
      source_match_count: Number(oldRow?.source_match_count || 0) + 1,
      updated_at: new Date().toISOString(),
    };
  });

  const grouped = groupByTeam(playerRows);

  const teamRows = [...grouped.entries()].map(([teamName, teamPlayers]) => {
    const oldTeam = existingTeamMap.get(teamName);
    const builtTeam = buildFootballTeamRating(teamPlayers, teamName);

    return {
      sport,
      team: teamName,
      attack: smoothRating(oldTeam?.attack, builtTeam.attack),
      control_rating: smoothRating(oldTeam?.control_rating, builtTeam.control),
      defense: smoothRating(oldTeam?.defense, builtTeam.defense),
      goalie: smoothRating(oldTeam?.goalie, builtTeam.goalie),
      form: smoothRating(oldTeam?.form, builtTeam.form),
      overall: smoothRating(oldTeam?.overall, builtTeam.overall),
      source_player_count: builtTeam.playerCount,
      updated_at: new Date().toISOString(),
    };
  });

  if (playerRows.length > 0) {
    const { error: playerError } = await supabaseAdmin
      .from("player_ratings")
      .upsert(playerRows, {
        onConflict: "sport,team,player_name",
      });

    if (playerError) throw playerError;
  }

  if (teamRows.length > 0) {
    const { error: teamError } = await supabaseAdmin
      .from("team_ratings")
      .upsert(teamRows, {
        onConflict: "sport,team",
      });

    if (teamError) throw teamError;
  }

  await supabaseAdmin.from("rating_update_logs").insert({
    sport,
    source,
    status: "success",
    message: "Football ratings updated",
    updated_players: playerRows.length,
    updated_teams: teamRows.length,
  });

  return {
    ok: true,
    updatedPlayers: playerRows.length,
    updatedTeams: teamRows.length,
  };
}
