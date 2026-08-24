import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || "").trim() : fallback;
}

function slug(value) {
  const clean = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/.test(clean)) throw new Error("--slug must be 2-63 lowercase letters, digits, _ or -");
  return clean;
}

const url = required("SUPABASE_URL");
const serviceRole = required("SUPABASE_SERVICE_ROLE_KEY");
const tenantSlug = slug(arg("slug"));
const tenantName = arg("name", tenantSlug).slice(0, 160);
const environment = arg("environment", "live") === "test" ? "test" : "live";
const label = arg("label", "default").slice(0, 120) || "default";
const rateLimit = Math.max(1, Math.min(600, Number.parseInt(arg("rate-limit", "60"), 10) || 60));
const scopes = [...new Set(arg("scopes", "recommendations:read,leagues:read").split(",").map((item) => item.trim()).filter(Boolean))];
const allowed = new Set(["recommendations:read", "leagues:read"]);
if (!scopes.length || scopes.some((scope) => !allowed.has(scope))) throw new Error("Unsupported --scopes value");

const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: tenant, error: tenantError } = await admin
  .from("scorecaster_enterprise_api_tenants")
  .upsert({ slug: tenantSlug, name: tenantName, status: "active", allowed_scopes: scopes, rate_limit_per_minute: rateLimit }, { onConflict: "slug" })
  .select("id,slug,name")
  .single();
if (tenantError) throw tenantError;

const prefix = `sc_${environment}_${randomBytes(6).toString("base64url")}`;
const rawKey = `${prefix}_${randomBytes(32).toString("base64url")}`;
const hash = createHash("sha256").update(rawKey, "utf8").digest("hex");
const { error: keyError } = await admin.from("scorecaster_enterprise_api_keys").insert({
  tenant_id: tenant.id,
  key_prefix: prefix,
  key_hash: hash,
  label,
  scopes,
  active: true
});
if (keyError) throw keyError;

console.log(JSON.stringify({
  ok: true,
  tenant: { slug: tenant.slug, name: tenant.name },
  key: rawKey,
  keyPrefix: prefix,
  scopes,
  warning: "This raw key is shown once. Store it in the client secret manager; Scorecaster stores only its SHA-256 hash."
}, null, 2));
