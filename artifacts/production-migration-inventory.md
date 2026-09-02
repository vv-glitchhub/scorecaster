# Scorecaster production migration inventory

Generated: 2026-09-02T16:46:49.767Z

> Repository analysis is automatic. Production status is manual evidence and is never inferred from file presence.

- Configured migrations: 44
- Discovered migration files: 44
- Applied with evidence: 44
- Unverified: 0
- Repository complete: true
- Production verified: true

| # | Migration | Repository | Production | Static risk signal | SHA-256 |
|---:|---|---|---|---|---|
| 1 | `supabase/scorecaster_schema.sql` | present | applied | non-destructive detected | `149416fdddedd673abb670dba291df4a8791b7ba23b0655bb1ff5d2cb730bdee` |
| 2 | `supabase/scorecaster_auth_cloud.sql` | present | applied | manual review | `de627d0f8044c1d0f68308023f93073a42582c0c7401956fbfb62c88cf08820b` |
| 3 | `supabase/scorecaster_community_feed_v1.sql` | present | applied | manual review | `59214b8c84ef9cbdb17ffd3790fff362144755dbc6bb2a13c4981c69e6b72ad5` |
| 4 | `supabase/scorecaster_paper_risk_limits.sql` | present | applied | manual review | `8dd2070216e446eeffbccc56f0676356e5fcfb33c9911c8f044d6dbed956ec84` |
| 5 | `supabase/scorecaster_api_rate_limits.sql` | present | applied | manual review | `66bd58e75fba65461097db29f85a295a9d137fc1daf9a9ce817a606134342de0` |
| 6 | `supabase/scorecaster_watchlist_alerts.sql` | present | applied | manual review | `aee5e2979a6e94641f144c767fffde8e95d2ffb5aaeb8a4cc6425214fa371c97` |
| 7 | `supabase/scorecaster_market_timeline.sql` | present | applied | policy replacement | `7b9cc57338250553dd97f630b257775a19a7540adf3d4acd71bb81f3ddf74ac9` |
| 8 | `supabase/scorecaster_alert_inbox.sql` | present | applied | manual review | `f0af1640ba93da3cb92905e373c2ca563b8b3a6a81bb9256917932648aaafc49` |
| 9 | `supabase/scorecaster_notification_registry.sql` | present | applied | manual review | `7e7f28c89635a14225f54284cbbec6e06e9629968baf40c9c5d9ec7ecf8e1b5a` |
| 10 | `supabase/scorecaster_notification_delivery.sql` | present | applied | manual review | `20b4e1d47e8fc3ea59bf59e58b59341dca93bbc56746d33c52cfafb693cfaa14` |
| 11 | `supabase/scorecaster_watchlist_monitor.sql` | present | applied | manual review | `29825cef1e4475eac5221b6c37be5f59567921ceabb18055ac4d9982cb267b64` |
| 12 | `supabase/scorecaster_decision_diagnostics.sql` | present | applied | manual review | `4f27316c16515251fb15a4b924d96654411443808d69c656f4481a90ae93e853` |
| 13 | `supabase/scorecaster_agent_decision_signing_vault.sql` | present | applied | non-destructive detected | `459738f7eb7c44a818ef7725a857eac9b199a842734ff71841f09491b0794cdc` |
| 14 | `supabase/scorecaster_collector_v1.sql` | present | applied | non-destructive detected | `a004bd8b8a777f6c6c23a76b8291182978691f7030dc80293000491b16e926c7` |
| 15 | `supabase/scorecaster_ai_intelligence_v1.sql` | present | applied | non-destructive detected | `ab555fc7070f1b5314c65f1b1640a53c9e2db1e1da6cc8c410339338e3738589` |
| 16 | `supabase/scorecaster_unified_data.sql` | present | applied | manual review | `6bb650102c9067cb74dfe272dfd60e0fb2c173b8b85e6e6b70945ffe136986b6` |
| 17 | `supabase/scorecaster_sports_analytics.sql` | present | applied | non-destructive detected | `99288d4f01a6f86daa835a191e16198c50d15f4081ea0297fa381518d31da516` |
| 18 | `supabase/scorecaster_settlement_monitor.sql` | present | applied | manual review | `aafac6e9db33dec900255188ba777f2db122195f47422348123613319b4ce4b4` |
| 19 | `supabase/scorecaster_autonomous_agent.sql` | present | applied | manual review | `0467473ba79d9441b9033984c8220dd99ccfa92ce960ca8f3968622dc12780fe` |
| 20 | `supabase/scorecaster_autonomous_agent_v2.sql` | present | applied | manual review | `1c8f0256e30861b94b438ec38b0472004766d990368124797ad2ce5663385dcb` |
| 21 | `supabase/scorecaster_autonomous_v13_hard_caps.sql` | present | applied | manual review | `bf201fb48a55ddafb40f145a2bcff4796f2247ddca015b0cc67feff92400682f` |
| 22 | `supabase/scorecaster_autonomous_agent_risk_profile_v1.sql` | present | applied | manual review | `5c6b2698ff29e1268d73b5cfde1c5a7ac1de8d868ca6090467d5c367a481cf5e` |
| 23 | `supabase/scorecaster_shadow_learning_v1.sql` | present | applied | manual review | `86d62a9d6b9bdb234da2d6242b51c389db34ec8c09920fe247a755584260b16c` |
| 24 | `supabase/scorecaster_shadow_candidate_observations_v1.sql` | present | applied | manual review | `f5d1a708978eefa32860ee5167d1685c4a8b7102e879f198766b5770696d42ac` |
| 25 | `supabase/scorecaster_shadow_candidate_settlement_batch_v1.sql` | present | applied | non-destructive detected | `2d625a0f0d9ca580209d0adbd64ebe98e138b084cf26f8981986e2e8b7fb8e6f` |
| 26 | `supabase/scorecaster_shadow_candidate_trigger_safety_v1.sql` | present | applied | manual review | `91bc84c97fa49453523c4de7aec2000b0a14005a5863ad1381a00cca32a0368b` |
| 27 | `supabase/scorecaster_shadow_candidate_settlement_batch_v1_fix.sql` | present | applied | non-destructive detected | `e767345a772673f00f9f94789d59605b7c387b9006e0fa44e8a7f2bcf2ada1ab` |
| 28 | `supabase/scorecaster_shadow_candidate_function_acl_v1.sql` | present | applied | non-destructive detected | `be5b8daeb8c9d1c226dd1dd2805ce5b6ffe8e27374ec3e15c750cd2faffd994c` |
| 29 | `supabase/scorecaster_shadow_candidate_settlement_performance_v2.sql` | present | applied | non-destructive detected | `59029f841350571af0b90eadac175af7566e0e8f77a771822b0ffc9208997bef` |
| 30 | `supabase/scorecaster_self_data_engine_v1.sql` | present | applied | non-destructive detected | `1c89f18e1441b25e120eb0e6e1e40df0f3894ab679e520c208374a94cd399171` |
| 31 | `supabase/scorecaster_intelligence_core_v1.sql` | present | applied | non-destructive detected | `fef34a12fd1bf7a79c568f4c654997a4888eac24f98c078547d1c2d19898db7b` |
| 32 | `supabase/scorecaster_event_identity_map_v1.sql` | present | applied | non-destructive detected | `f7a214fb32cc19655d1620782e837ca7313d24969c0ec54d3fb313e1ab7c1f31` |
| 33 | `supabase/scorecaster_openfootball_bootstrap_v1.sql` | present | applied | non-destructive detected | `ebff9742dd5d8ed8db25c671a372a6c242685ec41ce9f4792394bffd37f814e7` |
| 34 | `supabase/scorecaster_event_identity_refresh_v1.sql` | present | applied | manual review | `3b59dc7074efba883a7cda09216ee843deab7da0ad54a49ac1c3c72ee5702c66` |
| 35 | `supabase/scorecaster_outcome_chronology_fix_v1.sql` | present | applied | manual review | `f3d888c5a23ddc18973a5f2ac7fb65d7ffe35a33514d84b67ba844fb45de0e4c` |
| 36 | `supabase/scorecaster_own_model_scheduler_v1.sql` | present | applied | non-destructive detected | `7494e69dd08152fdff96cc761670ce1427e835436fc98e8c078f3f7a914a3d33` |
| 37 | `supabase/scorecaster_own_football_ml_v1.sql` | present | applied | non-destructive detected | `cd2465db8bb0d15e2e65ad9e0069b7fea0ecd872a2c6f592f617b43db55a7c1e` |
| 38 | `supabase/scorecaster_own_decision_engine_v1.sql` | present | applied | non-destructive detected | `63fe6c866acffe1d6431c920877165ee279956533e36eaa87bb0bc962989601a` |
| 39 | `supabase/scorecaster_owned_intelligence_triggers_v1.sql` | present | applied | non-destructive detected | `72c737e0dc56b762840f6d3b4f954e0a72cf39dfd0cf7cddb47ed4466f8d6c4d` |
| 40 | `supabase/scorecaster_model_registry_status_v2.sql` | present | applied | non-destructive detected | `52994af86fa3e97490d2b46329414eae011a551dee1d0814169fd4a7566052ca` |
| 41 | `supabase/scorecaster_authenticated_rpc_boundaries_v1.sql` | present | applied | non-destructive detected | `e3111c0050d8bfa6130981f0c634de4cee875ae148811a4d8b64bf3ace00d3d4` |
| 42 | `supabase/scorecaster_pg_net_extension_schema_v1.sql` | present | applied | non-destructive detected | `aad4fa37a885a4bd14c6b07e2b3aadd6f821c36498e61b2cdbb2eb0296948975` |
| 43 | `supabase/scorecaster_fk_index_hardening_v1.sql` | present | applied | non-destructive detected | `49569c5057512fc4c6a0f08a7b434fd8c521314f3370d7a14a7c2d04abb8ea58` |
| 44 | `supabase/scorecaster_autonomous_audit_performance_v1.sql` | present | applied | non-destructive detected | `ae83a6873f3d03330b90c220d8e8bc18629be0ba8118204175554be25b7557c4` |

Untracked files: none
Missing files: none
Status validation failures: none
