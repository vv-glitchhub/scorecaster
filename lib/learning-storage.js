import { supabaseAdmin } from "./supabase-admin";
import { buildLearningRecord, summarizeLearningRecords, buildAdaptiveWeights } from "./learning-engine-v1";

const TABLE_NAME = "learning_records";

export async function saveLearningRecord({ pick, result = null, clv = null }) {
  const record = buildLearningRecord({ pick, result, clv });

  if (!supabaseAdmin) {
    return {
      ok: true,
      mode: "memory_only",
      table: TABLE_NAME,
      record,
      warning: "Supabase admin client is not configured. Record was not persisted."
    };
  }

  const { data, error } = await supabaseAdmin
    .from(TABLE_NAME)
    .insert(record)
    .select()
    .single();

  if (error) {
    return {
      ok: false,
      mode: "supabase_error",
      table: TABLE_NAME,
      error: error.message,
      record
    };
  }

  return {
    ok: true,
    mode: "persisted",
    table: TABLE_NAME,
    record: data
  };
}

export async function loadLearningRecords({ limit = 250 } = {}) {
  if (!supabaseAdmin) {
    return {
      ok: true,
      mode: "memory_only",
      table: TABLE_NAME,
      records: [],
      summary: summarizeLearningRecords([]),
      adaptiveWeights: buildAdaptiveWeights([]),
      warning: "Supabase admin client is not configured."
    };
  }

  const { data, error } = await supabaseAdmin
    .from(TABLE_NAME)
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      ok: false,
      mode: "supabase_error",
      table: TABLE_NAME,
      records: [],
      summary: summarizeLearningRecords([]),
      adaptiveWeights: buildAdaptiveWeights([]),
      error: error.message
    };
  }

  const records = Array.isArray(data) ? data : [];

  return {
    ok: true,
    mode: "persisted",
    table: TABLE_NAME,
    records,
    summary: summarizeLearningRecords(records),
    adaptiveWeights: buildAdaptiveWeights(records)
  };
}
