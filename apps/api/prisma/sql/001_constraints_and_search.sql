-- NUR — constraint, trigger, dan index yang tidak bisa dinyatakan di schema.prisma.
-- Cara pakai: lihat apps/api/prisma/README.md (bagian "Migration pertama").
--
-- PERHATIAN DRIFT: Prisma Migrate tidak mengenal index ekspresi/partial/trigram di bawah.
-- Setiap kali membuat migration baru, periksa migration.sql yang dihasilkan. Jika berisi
-- DROP INDEX untuk index berawalan "idx_custom_", hapus baris tersebut sebelum menerapkan.
-- CHECK constraint dan trigger tidak dibaca Prisma sehingga aman dari masalah ini.

-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ------------------------------------------------------------
-- Identity
-- ------------------------------------------------------------
ALTER TABLE users
  ADD CONSTRAINT users_email_lowercase CHECK (email = lower(email));

ALTER TABLE user_settings
  ADD CONSTRAINT user_settings_font_size_range CHECK (arabic_font_size BETWEEN 16 AND 96),
  ADD CONSTRAINT user_settings_audio_speed_range CHECK (audio_speed BETWEEN 0.50 AND 2.00),
  ADD CONSTRAINT user_settings_version_positive CHECK (version >= 1);

ALTER TABLE auth_sessions
  ADD CONSTRAINT auth_sessions_expiry_after_creation CHECK (expires_at > created_at);

ALTER TABLE refresh_tokens
  ADD CONSTRAINT refresh_tokens_expiry_after_creation CHECK (expires_at > created_at),
  ADD CONSTRAINT refresh_tokens_not_self_replaced CHECK (replaced_by_id IS NULL OR replaced_by_id <> id);

ALTER TABLE user_tokens
  ADD CONSTRAINT user_tokens_expiry_after_creation CHECK (expires_at > created_at);

-- ------------------------------------------------------------
-- Quran
-- ------------------------------------------------------------
ALTER TABLE surahs
  ADD CONSTRAINT surah_number_range CHECK (number BETWEEN 1 AND 114),
  ADD CONSTRAINT surah_total_verses_positive CHECK (total_verses > 0);

ALTER TABLE verses
  ADD CONSTRAINT verse_number_positive CHECK (verse_number > 0),
  ADD CONSTRAINT verse_global_number_range CHECK (global_number BETWEEN 1 AND 6236),
  ADD CONSTRAINT page_number_valid CHECK (page_number BETWEEN 1 AND 604),
  ADD CONSTRAINT juz_number_valid CHECK (juz_number BETWEEN 1 AND 30),
  ADD CONSTRAINT hizb_number_valid CHECK (hizb_number IS NULL OR hizb_number BETWEEN 1 AND 60);

ALTER TABLE juzs
  ADD CONSTRAINT juz_number_range CHECK (number BETWEEN 1 AND 30),
  ADD CONSTRAINT juz_verses_positive CHECK (start_verse > 0 AND end_verse > 0);

-- ------------------------------------------------------------
-- Personal Quran data
-- ------------------------------------------------------------
ALTER TABLE bookmarks
  ADD CONSTRAINT bookmarks_version_positive CHECK (version >= 1);

ALTER TABLE reading_progress
  ADD CONSTRAINT reading_progress_page_valid CHECK (last_page BETWEEN 1 AND 604),
  ADD CONSTRAINT reading_progress_version_positive CHECK (version >= 1);

-- ------------------------------------------------------------
-- Audio
-- ------------------------------------------------------------
ALTER TABLE audio_assets
  ADD CONSTRAINT audio_assets_size_positive CHECK (file_size > 0),
  ADD CONSTRAINT audio_assets_duration_positive CHECK (duration_ms > 0),
  ADD CONSTRAINT audio_assets_checksum_sha256 CHECK (checksum ~ '^[0-9a-f]{64}$');

ALTER TABLE audio_segments
  ADD CONSTRAINT valid_audio_segment CHECK (start_ms >= 0 AND end_ms > start_ms);

ALTER TABLE audio_playlists
  ADD CONSTRAINT audio_playlists_version_positive CHECK (version >= 1);

ALTER TABLE audio_playlist_items
  ADD CONSTRAINT audio_playlist_items_position_nonnegative CHECK (position >= 0);

-- ------------------------------------------------------------
-- Prayer & Qibla
-- ------------------------------------------------------------
ALTER TABLE prayer_methods
  ADD CONSTRAINT prayer_methods_fajr_angle_range CHECK (fajr_angle BETWEEN 0 AND 30),
  ADD CONSTRAINT prayer_methods_isha_angle_range CHECK (isha_angle IS NULL OR isha_angle BETWEEN 0 AND 30),
  ADD CONSTRAINT prayer_methods_isha_rule_present CHECK (isha_angle IS NOT NULL OR isha_interval_minutes IS NOT NULL),
  ADD CONSTRAINT prayer_methods_isha_interval_range CHECK (isha_interval_minutes IS NULL OR isha_interval_minutes BETWEEN 1 AND 180),
  ADD CONSTRAINT prayer_methods_asr_factor_range CHECK (asr_factor BETWEEN 1 AND 2);

ALTER TABLE prayer_locations
  ADD CONSTRAINT latitude_valid CHECK (latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT longitude_valid CHECK (longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT prayer_locations_version_positive CHECK (version >= 1);

-- Menit lokal sejak tengah malam pada prayer_date. Rentang sampai 2 hari untuk kasus melewati tengah malam.
ALTER TABLE prayer_times
  ADD CONSTRAINT prayer_times_minutes_range CHECK (
        (fajr_minutes    IS NULL OR fajr_minutes    BETWEEN 0 AND 2879)
    AND (sunrise_minutes IS NULL OR sunrise_minutes BETWEEN 0 AND 2879)
    AND dhuhr_minutes BETWEEN 0 AND 2879
    AND (asr_minutes     IS NULL OR asr_minutes     BETWEEN 0 AND 2879)
    AND (maghrib_minutes IS NULL OR maghrib_minutes BETWEEN 0 AND 2879)
    AND (isha_minutes    IS NULL OR isha_minutes    BETWEEN 0 AND 2879)
  );

ALTER TABLE prayer_adjustments
  ADD CONSTRAINT prayer_adjustments_minutes_range CHECK (minutes BETWEEN -120 AND 120),
  ADD CONSTRAINT prayer_adjustments_version_positive CHECK (version >= 1);

ALTER TABLE qibla_calibrations
  ADD CONSTRAINT qibla_bearing_range CHECK (qibla_bearing >= 0 AND qibla_bearing < 360),
  ADD CONSTRAINT magnetic_heading_range CHECK (magnetic_heading IS NULL OR (magnetic_heading >= 0 AND magnetic_heading < 360));

-- Maksimal satu lokasi default aktif per pengguna.
CREATE UNIQUE INDEX idx_custom_prayer_locations_one_default
  ON prayer_locations (user_id)
  WHERE is_default AND deleted_at IS NULL;

-- ------------------------------------------------------------
-- Hijri
-- ------------------------------------------------------------
ALTER TABLE hijri_dates
  ADD CONSTRAINT hijri_dates_valid CHECK (hijri_day BETWEEN 1 AND 30 AND hijri_month BETWEEN 1 AND 12 AND hijri_year > 0);

ALTER TABLE islamic_events
  ADD CONSTRAINT islamic_events_valid CHECK (hijri_day BETWEEN 1 AND 30 AND hijri_month BETWEEN 1 AND 12);

ALTER TABLE hijri_adjustments
  ADD CONSTRAINT hijri_adjustments_valid CHECK (hijri_month BETWEEN 1 AND 12 AND hijri_year > 0 AND adjustment_days BETWEEN -2 AND 2);

-- ------------------------------------------------------------
-- Zakat
-- ------------------------------------------------------------
ALTER TABLE zakat_rules
  ADD CONSTRAINT zakat_rules_rate_range CHECK (rate >= 0 AND rate <= 1);

ALTER TABLE zakat_calculations
  ADD CONSTRAINT zakat_amount_nonnegative CHECK (
        total_assets >= 0
    AND deductible_debt >= 0
    AND net_assets >= 0
    AND nisab_value >= 0
    AND payable_amount >= 0
  ),
  ADD CONSTRAINT zakat_not_eligible_zero_payable CHECK (eligible OR payable_amount = 0),
  ADD CONSTRAINT zakat_currency_iso CHECK (currency ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT zakat_calculations_version_positive CHECK (version >= 1);

ALTER TABLE zakat_calculation_items
  ADD CONSTRAINT zakat_items_amount_nonnegative CHECK (amount >= 0);

-- ------------------------------------------------------------
-- Islamic knowledge
-- ------------------------------------------------------------
ALTER TABLE asmaul_husna
  ADD CONSTRAINT asmaul_husna_number_range CHECK (number BETWEEN 1 AND 99);


ALTER TABLE dhikr_items
  ADD CONSTRAINT dhikr_items_recommended_positive CHECK (recommended_count > 0);

ALTER TABLE dhikr_sessions
  ADD CONSTRAINT dhikr_sessions_counts_valid CHECK (count >= 0 AND target_count > 0),
  ADD CONSTRAINT dhikr_sessions_completion_order CHECK (completed_at IS NULL OR completed_at >= started_at),
  ADD CONSTRAINT dhikr_sessions_version_positive CHECK (version >= 1);

ALTER TABLE hadiths
  ADD CONSTRAINT hadiths_number_positive CHECK (number > 0);

ALTER TABLE user_favorites
  ADD CONSTRAINT user_favorites_version_positive CHECK (version >= 1);

-- ------------------------------------------------------------
-- Dataset & approval workflow
-- ------------------------------------------------------------
ALTER TABLE dataset_versions
  ADD CONSTRAINT dataset_versions_checksum_sha256 CHECK (checksum ~ '^[0-9a-f]{64}$'),
  -- Dataset hanya boleh PUBLISHED setelah disetujui.
  ADD CONSTRAINT dataset_versions_published_requires_approval CHECK (
    status <> 'PUBLISHED' OR (approved_by_id IS NOT NULL AND approved_at IS NOT NULL)
  );

ALTER TABLE content_revisions
  ADD CONSTRAINT content_revisions_reviewer_not_author CHECK (reviewer_id IS NULL OR reviewer_id <> author_id),
  ADD CONSTRAINT content_revisions_published_requires_review CHECK (
    status <> 'PUBLISHED' OR (reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL AND published_at IS NOT NULL)
  ),
  ADD CONSTRAINT content_revisions_entity_id_for_change CHECK (action = 'CREATE' OR entity_id IS NOT NULL);

-- Audit log append-only.
CREATE FUNCTION nur_block_audit_log_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_logs is append-only';
END;
$$;

CREATE TRIGGER admin_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON admin_audit_logs
  FOR EACH ROW EXECUTE FUNCTION nur_block_audit_log_mutation();

-- ------------------------------------------------------------
-- Sync
-- ------------------------------------------------------------
ALTER TABLE sync_changes
  ADD CONSTRAINT sync_changes_versions_valid CHECK (
        (base_version IS NULL OR base_version >= 1)
    AND (result_version IS NULL OR result_version >= 1)
    AND (status <> 'APPLIED' OR result_version IS NOT NULL)
  );

-- ------------------------------------------------------------
-- Search (section 4.3)
-- Query harus memakai ekspresi yang sama persis agar index terpakai, contoh:
--   WHERE to_tsvector('indonesian', translation_text) @@ websearch_to_tsquery('indonesian', $1)
--   WHERE text_normalized % $1   (atau ILIKE '%' || $1 || '%')
-- ------------------------------------------------------------
CREATE INDEX idx_custom_verses_text_normalized_trgm
  ON verses USING GIN (text_normalized gin_trgm_ops);

CREATE INDEX idx_custom_verse_translations_fts_id
  ON verse_translations USING GIN (to_tsvector('indonesian', translation_text));

CREATE INDEX idx_custom_surahs_name_latin_trgm
  ON surahs USING GIN (lower(name_latin) gin_trgm_ops);
