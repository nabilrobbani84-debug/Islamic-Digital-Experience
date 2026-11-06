-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "RevelationType" AS ENUM ('MAKKIYAH', 'MADANIYAH');

-- CreateEnum
CREATE TYPE "PrayerName" AS ENUM ('FAJR', 'SUNRISE', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA');

-- CreateEnum
CREATE TYPE "CalendarMethod" AS ENUM ('TABULAR', 'CUSTOM_HISAB');

-- CreateEnum
CREATE TYPE "ZakatType" AS ENUM ('FITRAH', 'MAAL', 'INCOME', 'TRADE', 'GOLD', 'SILVER', 'SAVINGS');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RevisionAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "FavoriteContentType" AS ENUM ('ASMAUL_HUSNA', 'DHIKR_ITEM', 'DAILY_DUA', 'HADITH', 'PRAYER_CONTENT');

-- CreateEnum
CREATE TYPE "SyncEntityType" AS ENUM ('BOOKMARK', 'READING_PROGRESS', 'READING_HISTORY', 'USER_SETTING', 'PRAYER_LOCATION', 'PRAYER_ADJUSTMENT', 'DHIKR_SESSION', 'ZAKAT_CALCULATION', 'USER_FAVORITE', 'AUDIO_PLAYLIST');

-- CreateEnum
CREATE TYPE "SyncOperation" AS ENUM ('UPSERT', 'DELETE');

-- CreateEnum
CREATE TYPE "SyncChangeStatus" AS ENUM ('APPLIED', 'CONFLICT', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "email_verified_at" TIMESTAMPTZ(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_name" VARCHAR(120),
    "user_agent" VARCHAR(512),
    "ip_address" INET,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" VARCHAR(60),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "replaced_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "theme" VARCHAR(20) NOT NULL DEFAULT 'dark',
    "arabic_font_size" INTEGER NOT NULL DEFAULT 32,
    "translation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "tafsir_enabled" BOOLEAN NOT NULL DEFAULT false,
    "audio_speed" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "reduced_motion" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surahs" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "name_arabic" TEXT NOT NULL,
    "name_latin" TEXT NOT NULL,
    "meaning" TEXT,
    "revelation_type" "RevelationType" NOT NULL,
    "total_verses" INTEGER NOT NULL,

    CONSTRAINT "surahs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verses" (
    "id" BIGSERIAL NOT NULL,
    "surah_id" INTEGER NOT NULL,
    "verse_number" INTEGER NOT NULL,
    "global_number" INTEGER NOT NULL,
    "text_uthmani" TEXT NOT NULL,
    "text_normalized" TEXT NOT NULL,
    "page_number" INTEGER NOT NULL,
    "juz_number" INTEGER NOT NULL,
    "hizb_number" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "juzs" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "start_surah_id" INTEGER NOT NULL,
    "start_verse" INTEGER NOT NULL,
    "end_surah_id" INTEGER NOT NULL,
    "end_verse" INTEGER NOT NULL,

    CONSTRAINT "juzs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "juz_verses" (
    "id" SERIAL NOT NULL,
    "juz_id" INTEGER NOT NULL,
    "verse_id" BIGINT NOT NULL,

    CONSTRAINT "juz_verses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quran_editions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL DEFAULT 'id',
    "source" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content_source_id" UUID,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "quran_editions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verse_translations" (
    "id" UUID NOT NULL,
    "verse_id" BIGINT NOT NULL,
    "edition_id" UUID NOT NULL,
    "translation_text" TEXT NOT NULL,

    CONSTRAINT "verse_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tafsir_sources" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL DEFAULT 'id',
    "reference" TEXT,
    "content_source_id" UUID,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "tafsir_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tafsir_contents" (
    "id" UUID NOT NULL,
    "verse_id" BIGINT NOT NULL,
    "source_id" UUID NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "tafsir_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "verse_id" BIGINT NOT NULL,
    "note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "surah_id" INTEGER NOT NULL,
    "verse_id" BIGINT NOT NULL,
    "last_page" INTEGER NOT NULL,
    "position_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "reading_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "verse_id" BIGINT NOT NULL,
    "read_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qaris" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "biography" TEXT,
    "country" TEXT,
    "photo_path" TEXT,
    "content_source_id" UUID,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "qaris_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_assets" (
    "id" UUID NOT NULL,
    "qari_id" UUID NOT NULL,
    "surah_id" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_format" VARCHAR(10) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "checksum" VARCHAR(128) NOT NULL,
    "duration_ms" INTEGER NOT NULL,

    CONSTRAINT "audio_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_segments" (
    "id" UUID NOT NULL,
    "audio_asset_id" UUID NOT NULL,
    "verse_id" BIGINT NOT NULL,
    "start_ms" INTEGER NOT NULL,
    "end_ms" INTEGER NOT NULL,

    CONSTRAINT "audio_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_playlists" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "audio_playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_playlist_items" (
    "id" UUID NOT NULL,
    "playlist_id" UUID NOT NULL,
    "audio_asset_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "audio_playlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prayer_methods" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" TEXT NOT NULL,
    "fajr_angle" DECIMAL(5,2) NOT NULL,
    "isha_angle" DECIMAL(5,2),
    "isha_interval_minutes" INTEGER,
    "asr_factor" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_source" TEXT,

    CONSTRAINT "prayer_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prayer_locations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "method_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "elevation" DECIMAL(8,2),
    "timezone" VARCHAR(64) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "prayer_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prayer_times" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "method_id" UUID NOT NULL,
    "prayer_date" DATE NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "fajr_minutes" INTEGER,
    "sunrise_minutes" INTEGER,
    "dhuhr_minutes" INTEGER NOT NULL,
    "asr_minutes" INTEGER,
    "maghrib_minutes" INTEGER,
    "isha_minutes" INTEGER,
    "high_latitude_rule" VARCHAR(40),
    "algorithm_version" VARCHAR(20) NOT NULL,
    "calculated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prayer_times_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prayer_adjustments" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "prayer_name" "PrayerName" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "prayer_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qibla_calibrations" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "qibla_bearing" DECIMAL(7,3) NOT NULL,
    "magnetic_heading" DECIMAL(7,3),
    "calibrated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qibla_calibrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hijri_dates" (
    "id" UUID NOT NULL,
    "gregorian_date" DATE NOT NULL,
    "hijri_day" INTEGER NOT NULL,
    "hijri_month" INTEGER NOT NULL,
    "hijri_year" INTEGER NOT NULL,
    "method" "CalendarMethod" NOT NULL,

    CONSTRAINT "hijri_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "islamic_events" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "hijri_month" INTEGER NOT NULL,
    "hijri_day" INTEGER NOT NULL,
    "description" TEXT,

    CONSTRAINT "islamic_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hijri_adjustments" (
    "id" UUID NOT NULL,
    "method" "CalendarMethod" NOT NULL,
    "hijri_year" INTEGER NOT NULL,
    "hijri_month" INTEGER NOT NULL,
    "adjustment_days" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "hijri_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zakat_rules" (
    "id" UUID NOT NULL,
    "type" "ZakatType" NOT NULL,
    "rate" DECIMAL(8,6) NOT NULL,
    "nisab_type" VARCHAR(40) NOT NULL,
    "requires_haul" BOOLEAN NOT NULL DEFAULT false,
    "rule_version" VARCHAR(20) NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "zakat_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zakat_calculations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rule_id" UUID,
    "type" "ZakatType" NOT NULL,
    "rule_version" VARCHAR(20) NOT NULL,
    "total_assets" DECIMAL(20,2) NOT NULL,
    "deductible_debt" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "net_assets" DECIMAL(20,2) NOT NULL,
    "nisab_value" DECIMAL(20,2) NOT NULL,
    "haul_completed" BOOLEAN NOT NULL DEFAULT false,
    "eligible" BOOLEAN NOT NULL,
    "payable_amount" DECIMAL(20,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
    "calculated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "zakat_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zakat_calculation_items" (
    "id" UUID NOT NULL,
    "calculation_id" UUID NOT NULL,
    "item_name" VARCHAR(120) NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,

    CONSTRAINT "zakat_calculation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asmaul_husna" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "arabic_name" TEXT NOT NULL,
    "transliteration" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "explanation" TEXT,
    "source" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "asmaul_husna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dhikr_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "dhikr_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dhikr_items" (
    "id" UUID NOT NULL,
    "category_id" INTEGER NOT NULL,
    "arabic_text" TEXT NOT NULL,
    "transliteration" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "recommended_count" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "dhikr_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dhikr_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "dhikr_item_id" UUID,
    "label" VARCHAR(120) NOT NULL DEFAULT 'Hitungan bebas',
    "count" INTEGER NOT NULL DEFAULT 0,
    "target_count" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "dhikr_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dua_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "dua_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_duas" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "arabic_text" TEXT NOT NULL,
    "transliteration" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "source" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "daily_duas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dua_category_map" (
    "id" UUID NOT NULL,
    "dua_id" UUID NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "dua_category_map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prayer_contents" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prayer_type" TEXT NOT NULL,
    "description" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "prayer_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prayer_content_variants" (
    "id" UUID NOT NULL,
    "prayer_content_id" UUID NOT NULL,
    "madhhab" TEXT,
    "arabic_text" TEXT NOT NULL,
    "transliteration" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "source" TEXT,

    CONSTRAINT "prayer_content_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hadith_collections" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "total_hadith" INTEGER NOT NULL,
    "source" TEXT,
    "content_source_id" UUID,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "hadith_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hadiths" (
    "id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "arabic_text" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "narrator" TEXT,
    "reference" TEXT,

    CONSTRAINT "hadiths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hadith_explanations" (
    "id" UUID NOT NULL,
    "hadith_id" UUID NOT NULL,
    "explanation" TEXT NOT NULL,
    "lessons" TEXT NOT NULL,
    "source" TEXT,

    CONSTRAINT "hadith_explanations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content_type" "FavoriteContentType" NOT NULL,
    "content_id" VARCHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "user_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_sources" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "publisher" TEXT,
    "license" TEXT,
    "attribution" TEXT,
    "url" TEXT,
    "license_verified_at" TIMESTAMPTZ(3),

    CONSTRAINT "content_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dataset_versions" (
    "id" UUID NOT NULL,
    "dataset_name" VARCHAR(80) NOT NULL,
    "version" VARCHAR(40) NOT NULL,
    "checksum" VARCHAR(128) NOT NULL,
    "record_count" INTEGER,
    "source" TEXT,
    "content_source_id" UUID,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "imported_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),

    CONSTRAINT "dataset_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_revisions" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" VARCHAR(64),
    "action" "RevisionAction" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "author_id" UUID NOT NULL,
    "reviewer_id" UUID,
    "review_note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "reviewed_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "content_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" VARCHAR(64),
    "metadata" JSONB,
    "ip_address" INET,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_changes" (
    "id" UUID NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID,
    "entity_type" "SyncEntityType" NOT NULL,
    "entity_id" VARCHAR(64) NOT NULL,
    "operation" "SyncOperation" NOT NULL,
    "payload" JSONB NOT NULL,
    "base_version" INTEGER,
    "result_version" INTEGER,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "status" "SyncChangeStatus" NOT NULL,
    "conflict_reason" VARCHAR(200),
    "client_created_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_revoked_at_idx" ON "auth_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_replaced_by_id_key" ON "refresh_tokens"("replaced_by_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_tokens_token_hash_key" ON "user_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "user_tokens_user_id_purpose_idx" ON "user_tokens"("user_id", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "surahs_number_key" ON "surahs"("number");

-- CreateIndex
CREATE UNIQUE INDEX "verses_global_number_key" ON "verses"("global_number");

-- CreateIndex
CREATE INDEX "verses_juz_number_idx" ON "verses"("juz_number");

-- CreateIndex
CREATE INDEX "verses_page_number_idx" ON "verses"("page_number");

-- CreateIndex
CREATE UNIQUE INDEX "verses_surah_id_verse_number_key" ON "verses"("surah_id", "verse_number");

-- CreateIndex
CREATE UNIQUE INDEX "juzs_number_key" ON "juzs"("number");

-- CreateIndex
CREATE UNIQUE INDEX "juz_verses_juz_id_verse_id_key" ON "juz_verses"("juz_id", "verse_id");

-- CreateIndex
CREATE UNIQUE INDEX "quran_editions_name_version_key" ON "quran_editions"("name", "version");

-- CreateIndex
CREATE INDEX "verse_translations_edition_id_idx" ON "verse_translations"("edition_id");

-- CreateIndex
CREATE UNIQUE INDEX "verse_translations_verse_id_edition_id_key" ON "verse_translations"("verse_id", "edition_id");

-- CreateIndex
CREATE UNIQUE INDEX "tafsir_contents_verse_id_source_id_key" ON "tafsir_contents"("verse_id", "source_id");

-- CreateIndex
CREATE INDEX "bookmarks_user_id_updated_at_idx" ON "bookmarks"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_user_id_verse_id_key" ON "bookmarks"("user_id", "verse_id");

-- CreateIndex
CREATE INDEX "reading_progress_user_id_updated_at_idx" ON "reading_progress"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "reading_progress_user_id_surah_id_key" ON "reading_progress"("user_id", "surah_id");

-- CreateIndex
CREATE INDEX "reading_history_user_id_read_at_idx" ON "reading_history"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "audio_assets_qari_id_surah_id_key" ON "audio_assets"("qari_id", "surah_id");

-- CreateIndex
CREATE UNIQUE INDEX "audio_segments_audio_asset_id_verse_id_key" ON "audio_segments"("audio_asset_id", "verse_id");

-- CreateIndex
CREATE INDEX "audio_playlists_user_id_updated_at_idx" ON "audio_playlists"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "audio_playlist_items_playlist_id_position_key" ON "audio_playlist_items"("playlist_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "prayer_methods_code_key" ON "prayer_methods"("code");

-- CreateIndex
CREATE INDEX "prayer_locations_user_id_updated_at_idx" ON "prayer_locations"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "prayer_times_location_id_method_id_prayer_date_key" ON "prayer_times"("location_id", "method_id", "prayer_date");

-- CreateIndex
CREATE UNIQUE INDEX "prayer_adjustments_location_id_prayer_name_key" ON "prayer_adjustments"("location_id", "prayer_name");

-- CreateIndex
CREATE INDEX "qibla_calibrations_location_id_calibrated_at_idx" ON "qibla_calibrations"("location_id", "calibrated_at");

-- CreateIndex
CREATE INDEX "hijri_dates_method_hijri_year_hijri_month_hijri_day_idx" ON "hijri_dates"("method", "hijri_year", "hijri_month", "hijri_day");

-- CreateIndex
CREATE UNIQUE INDEX "hijri_dates_gregorian_date_method_key" ON "hijri_dates"("gregorian_date", "method");

-- CreateIndex
CREATE INDEX "islamic_events_hijri_month_hijri_day_idx" ON "islamic_events"("hijri_month", "hijri_day");

-- CreateIndex
CREATE UNIQUE INDEX "hijri_adjustments_method_hijri_year_hijri_month_key" ON "hijri_adjustments"("method", "hijri_year", "hijri_month");

-- CreateIndex
CREATE UNIQUE INDEX "zakat_rules_type_rule_version_key" ON "zakat_rules"("type", "rule_version");

-- CreateIndex
CREATE INDEX "zakat_calculations_user_id_updated_at_idx" ON "zakat_calculations"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "zakat_calculation_items_calculation_id_idx" ON "zakat_calculation_items"("calculation_id");

-- CreateIndex
CREATE UNIQUE INDEX "asmaul_husna_number_key" ON "asmaul_husna"("number");

-- CreateIndex
CREATE INDEX "dhikr_items_category_id_idx" ON "dhikr_items"("category_id");

-- CreateIndex
CREATE INDEX "dhikr_sessions_user_id_updated_at_idx" ON "dhikr_sessions"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "dua_category_map_dua_id_category_id_key" ON "dua_category_map"("dua_id", "category_id");

-- CreateIndex
CREATE INDEX "prayer_content_variants_prayer_content_id_idx" ON "prayer_content_variants"("prayer_content_id");

-- CreateIndex
CREATE UNIQUE INDEX "hadiths_collection_id_number_key" ON "hadiths"("collection_id", "number");

-- CreateIndex
CREATE INDEX "hadith_explanations_hadith_id_idx" ON "hadith_explanations"("hadith_id");

-- CreateIndex
CREATE INDEX "user_favorites_user_id_updated_at_idx" ON "user_favorites"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_favorites_user_id_content_type_content_id_key" ON "user_favorites"("user_id", "content_type", "content_id");

-- CreateIndex
CREATE UNIQUE INDEX "dataset_versions_dataset_name_version_key" ON "dataset_versions"("dataset_name", "version");

-- CreateIndex
CREATE INDEX "content_revisions_status_created_at_idx" ON "content_revisions"("status", "created_at");

-- CreateIndex
CREATE INDEX "content_revisions_entity_type_entity_id_idx" ON "content_revisions"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actor_id_created_at_idx" ON "admin_audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_entity_type_entity_id_idx" ON "admin_audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "sync_changes_seq_key" ON "sync_changes"("seq");

-- CreateIndex
CREATE INDEX "sync_changes_user_id_seq_idx" ON "sync_changes"("user_id", "seq");

-- CreateIndex
CREATE INDEX "sync_changes_user_id_entity_type_entity_id_idx" ON "sync_changes"("user_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "sync_changes_user_id_idempotency_key_key" ON "sync_changes"("user_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verses" ADD CONSTRAINT "verses_surah_id_fkey" FOREIGN KEY ("surah_id") REFERENCES "surahs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "juzs" ADD CONSTRAINT "juzs_start_surah_id_fkey" FOREIGN KEY ("start_surah_id") REFERENCES "surahs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "juzs" ADD CONSTRAINT "juzs_end_surah_id_fkey" FOREIGN KEY ("end_surah_id") REFERENCES "surahs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "juz_verses" ADD CONSTRAINT "juz_verses_juz_id_fkey" FOREIGN KEY ("juz_id") REFERENCES "juzs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "juz_verses" ADD CONSTRAINT "juz_verses_verse_id_fkey" FOREIGN KEY ("verse_id") REFERENCES "verses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quran_editions" ADD CONSTRAINT "quran_editions_content_source_id_fkey" FOREIGN KEY ("content_source_id") REFERENCES "content_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verse_translations" ADD CONSTRAINT "verse_translations_verse_id_fkey" FOREIGN KEY ("verse_id") REFERENCES "verses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verse_translations" ADD CONSTRAINT "verse_translations_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "quran_editions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tafsir_sources" ADD CONSTRAINT "tafsir_sources_content_source_id_fkey" FOREIGN KEY ("content_source_id") REFERENCES "content_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tafsir_contents" ADD CONSTRAINT "tafsir_contents_verse_id_fkey" FOREIGN KEY ("verse_id") REFERENCES "verses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tafsir_contents" ADD CONSTRAINT "tafsir_contents_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "tafsir_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_verse_id_fkey" FOREIGN KEY ("verse_id") REFERENCES "verses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_surah_id_fkey" FOREIGN KEY ("surah_id") REFERENCES "surahs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_verse_id_fkey" FOREIGN KEY ("verse_id") REFERENCES "verses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_history" ADD CONSTRAINT "reading_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_history" ADD CONSTRAINT "reading_history_verse_id_fkey" FOREIGN KEY ("verse_id") REFERENCES "verses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qaris" ADD CONSTRAINT "qaris_content_source_id_fkey" FOREIGN KEY ("content_source_id") REFERENCES "content_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_assets" ADD CONSTRAINT "audio_assets_qari_id_fkey" FOREIGN KEY ("qari_id") REFERENCES "qaris"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_assets" ADD CONSTRAINT "audio_assets_surah_id_fkey" FOREIGN KEY ("surah_id") REFERENCES "surahs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_segments" ADD CONSTRAINT "audio_segments_audio_asset_id_fkey" FOREIGN KEY ("audio_asset_id") REFERENCES "audio_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_segments" ADD CONSTRAINT "audio_segments_verse_id_fkey" FOREIGN KEY ("verse_id") REFERENCES "verses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_playlists" ADD CONSTRAINT "audio_playlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_playlist_items" ADD CONSTRAINT "audio_playlist_items_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "audio_playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_playlist_items" ADD CONSTRAINT "audio_playlist_items_audio_asset_id_fkey" FOREIGN KEY ("audio_asset_id") REFERENCES "audio_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_locations" ADD CONSTRAINT "prayer_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_locations" ADD CONSTRAINT "prayer_locations_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "prayer_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_times" ADD CONSTRAINT "prayer_times_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "prayer_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_times" ADD CONSTRAINT "prayer_times_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "prayer_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_adjustments" ADD CONSTRAINT "prayer_adjustments_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "prayer_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qibla_calibrations" ADD CONSTRAINT "qibla_calibrations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "prayer_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakat_calculations" ADD CONSTRAINT "zakat_calculations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakat_calculations" ADD CONSTRAINT "zakat_calculations_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "zakat_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakat_calculation_items" ADD CONSTRAINT "zakat_calculation_items_calculation_id_fkey" FOREIGN KEY ("calculation_id") REFERENCES "zakat_calculations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dhikr_items" ADD CONSTRAINT "dhikr_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "dhikr_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dhikr_sessions" ADD CONSTRAINT "dhikr_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dhikr_sessions" ADD CONSTRAINT "dhikr_sessions_dhikr_item_id_fkey" FOREIGN KEY ("dhikr_item_id") REFERENCES "dhikr_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dua_category_map" ADD CONSTRAINT "dua_category_map_dua_id_fkey" FOREIGN KEY ("dua_id") REFERENCES "daily_duas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dua_category_map" ADD CONSTRAINT "dua_category_map_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "dua_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_content_variants" ADD CONSTRAINT "prayer_content_variants_prayer_content_id_fkey" FOREIGN KEY ("prayer_content_id") REFERENCES "prayer_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hadith_collections" ADD CONSTRAINT "hadith_collections_content_source_id_fkey" FOREIGN KEY ("content_source_id") REFERENCES "content_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hadiths" ADD CONSTRAINT "hadiths_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "hadith_collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hadith_explanations" ADD CONSTRAINT "hadith_explanations_hadith_id_fkey" FOREIGN KEY ("hadith_id") REFERENCES "hadiths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataset_versions" ADD CONSTRAINT "dataset_versions_content_source_id_fkey" FOREIGN KEY ("content_source_id") REFERENCES "content_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataset_versions" ADD CONSTRAINT "dataset_versions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_changes" ADD CONSTRAINT "sync_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_changes" ADD CONSTRAINT "sync_changes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

