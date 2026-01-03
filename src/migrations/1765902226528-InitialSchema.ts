import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1765902226528 implements MigrationInterface {
  name = 'InitialSchema1765902226528';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_addresses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "street_address" character varying(255) NOT NULL, "city" character varying(100) NOT NULL, "postal_code" character varying(20) NOT NULL, "country" character varying(100) NOT NULL DEFAULT 'Bulgaria', "is_primary" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8abbeb5e3239ff7877088ffc25b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7a5100ce0548ef27a6f1533a5c" ON "user_addresses" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_user_type_enum" AS ENUM('reader', 'author')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying(50), "email" character varying(255) NOT NULL, "password_hash" character varying(255), "google_id" character varying(255), "first_name" character varying(100) NOT NULL, "last_name" character varying(100) NOT NULL, "user_type" "public"."users_user_type_enum" NOT NULL, "birth_date" date, "bio" text, "avatar_url" character varying(500), "is_verified" boolean NOT NULL DEFAULT false, "email_verified" boolean NOT NULL DEFAULT false, "email_verification_token" character varying(255), "password_reset_token" character varying(255), "password_reset_expires" TIMESTAMP, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_login" TIMESTAMP, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0bd5012aeb82628e07f6a1be53" ON "users" ("google_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "genres" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "description" text, "color_code" character varying(7), "icon" character varying(50), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_f105f8230a83b86a346427de94d" UNIQUE ("name"), CONSTRAINT "PK_80ecd718f0f00dde5d77a9be842" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_genre_preferences" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "genre_id" integer NOT NULL, CONSTRAINT "UQ_b3a7254f2aa98b5fd33eda98912" UNIQUE ("user_id", "genre_id"), CONSTRAINT "PK_c473a15a8f4ed6b6482fadd3f2a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_profiles_activity_privacy_enum" AS ENUM('public', 'friends', 'private')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_profiles_profile_privacy_enum" AS ENUM('public', 'friends', 'private')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_profiles_reading_list_privacy_enum" AS ENUM('public', 'friends', 'private')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_profiles_reviews_privacy_enum" AS ENUM('public', 'friends', 'private')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "social_media" jsonb, "activity_privacy" "public"."user_profiles_activity_privacy_enum" NOT NULL DEFAULT 'friends', "profile_privacy" "public"."user_profiles_profile_privacy_enum" NOT NULL DEFAULT 'friends', "reading_list_privacy" "public"."user_profiles_reading_list_privacy_enum" NOT NULL DEFAULT 'friends', "reviews_privacy" "public"."user_profiles_reviews_privacy_enum" NOT NULL DEFAULT 'public', "notifications_enabled" boolean NOT NULL DEFAULT true, "email_notifications" boolean NOT NULL DEFAULT true, "notification_preferences" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_6ca9503d77ae39b4b5a6cc3ba88" UNIQUE ("user_id"), CONSTRAINT "REL_6ca9503d77ae39b4b5a6cc3ba8" UNIQUE ("user_id"), CONSTRAINT "PK_1ec6662219f4605723f1e41b6cb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "series" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "author_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "description" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e725676647382eb54540d7128ba" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_70e33b61f2eba7ca6c5727494d" ON "series" ("author_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "book_genres" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "book_id" uuid NOT NULL, "genre_id" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_afd20a2f22d0efc47c5f80e14a5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_dc2d072b9d76acb4c5f2a4c55e" ON "book_genres" ("book_id", "genre_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."books_age_rating_enum" AS ENUM('all', '13+', '16+', '18+')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."books_distribution_type_enum" AS ENUM('physical', 'digital', 'both')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."books_selection_method_enum" AS ENUM('author_selects', 'first_come', 'lottery')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."books_status_enum" AS ENUM('draft', 'active', 'in_progress', 'completed', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TABLE "books" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "author_id" uuid NOT NULL, "title" character varying(255) NOT NULL, "short_description" character varying(500), "full_description" text, "cover_image_url" character varying(500), "page_count" integer, "age_rating" "public"."books_age_rating_enum" NOT NULL DEFAULT 'all', "distribution_type" "public"."books_distribution_type_enum" NOT NULL, "file_url" character varying(500), "file_size" bigint, "file_type" character varying(100), "total_copies" integer NOT NULL DEFAULT '1', "available_copies" integer NOT NULL DEFAULT '1', "application_deadline" TIMESTAMP NOT NULL, "review_deadline" TIMESTAMP, "selection_criteria" text, "selection_method" "public"."books_selection_method_enum" NOT NULL DEFAULT 'author_selects', "status" "public"."books_status_enum" NOT NULL DEFAULT 'draft', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "published_at" TIMESTAMP, "series_id" uuid, "series_order" integer, CONSTRAINT "PK_f3f2f25a099d24e12545b70b022" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1056dbee4616479f7d562c562d" ON "books" ("author_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."applications_status_enum" AS ENUM('pending', 'approved', 'rejected', 'withdrawn')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."applications_reading_status_enum" AS ENUM('not_started', 'currently_reading', 'for_review', 'reviewed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "applications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "book_id" uuid NOT NULL, "reader_id" uuid NOT NULL, "status" "public"."applications_status_enum" NOT NULL DEFAULT 'pending', "application_message" text, "author_notes" text, "applied_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "responded_at" TIMESTAMP, "copy_sent_at" TIMESTAMP, "copy_received_at" TIMESTAMP, "review_submitted_at" TIMESTAMP, "reading_status" "public"."applications_reading_status_enum" NOT NULL DEFAULT 'not_started', "reading_started_at" TIMESTAMP, "reading_completed_at" TIMESTAMP, "responded_by" uuid, CONSTRAINT "PK_938c0a27255637bde919591888f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_98c9162d3e5950df4652ea0ae1" ON "applications" ("book_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bb9ca2b6684359d7d39bb5e87f" ON "applications" ("reader_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8ee114cee92e995a9e75c05cfb" ON "applications" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e9c14cc5926d8471dea9e5db42" ON "applications" ("reading_status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_237f131f2f58df824924679e26" ON "applications" ("book_id", "reader_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_activities_activity_type_enum" AS ENUM('book_applied', 'book_approved', 'book_rejected', 'review_posted', 'book_started', 'book_completed', 'book_published', 'profile_updated')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_activities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "activity_type" "public"."user_activities_activity_type_enum" NOT NULL, "book_id" uuid, "application_id" uuid, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1245d4d2cf04ba7743f2924d951" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bd789c573f3fd7da3b22f724fd" ON "user_activities" ("user_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reviews_review_type_enum" AS ENUM('link', 'text')`,
    );
    await queryRunner.query(
      `CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "application_id" uuid NOT NULL, "rating" integer NOT NULL, "review_type" "public"."reviews_review_type_enum" NOT NULL, "review_content" text, "review_urls" text array, "is_public" boolean NOT NULL DEFAULT true, "is_featured" boolean NOT NULL DEFAULT false, "word_count" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_414daf69b1c74f190324c9069a" ON "reviews" ("application_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dab3e2726fcbb9678a6fffd353" ON "reviews" ("is_public") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a3f93b7e51709ce8e8ea1d4e68" ON "reviews" ("is_featured") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('friend_request_received', 'friend_request_accepted', 'friend_request_declined', 'application_approved', 'application_rejected', 'review_deadline_reminder', 'author_book_published')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "title" character varying(255) NOT NULL, "body" text NOT NULL, "is_read" boolean NOT NULL DEFAULT false, "read_at" TIMESTAMP WITH TIME ZONE, "data" jsonb, "book_id" uuid, "application_id" uuid, "related_user_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9a8a82462cab47c73d25f49261" ON "notifications" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_310667f935698fcd8cb319113a" ON "notifications" ("user_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_af08fad7c04bb85403970afdc1" ON "notifications" ("user_id", "is_read") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."friends_status_enum" AS ENUM('pending', 'accepted', 'blocked')`,
    );
    await queryRunner.query(
      `CREATE TABLE "friends" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "requester_id" uuid NOT NULL, "addressee_id" uuid NOT NULL, "status" "public"."friends_status_enum" NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_65e1b06a9f379ee5255054021e1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5ddffcfd5c5c2be9f675d0fc2a" ON "friends" ("requester_id", "addressee_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "device_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token" text NOT NULL, "device_type" character varying(50), "device_id" character varying(255), "app_version" character varying(50), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_84700be257607cfb1f9dc2e52c3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_17e1f528b993c6d55def4cf5be" ON "device_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a070dfec1c8f06cd29b854169f" ON "device_tokens" ("user_id", "token") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."verification_codes_type_enum" AS ENUM('email_verification', 'password_reset')`,
    );
    await queryRunner.query(
      `CREATE TABLE "verification_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "code" character varying(6) NOT NULL, "type" "public"."verification_codes_type_enum" NOT NULL, "is_used" boolean NOT NULL DEFAULT false, "used_at" TIMESTAMP, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires_at" TIMESTAMP NOT NULL, CONSTRAINT "PK_18741b6b8bf1680dbf5057421d7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0a53c41a810420ee446082ce6c" ON "verification_codes" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bb0f37096d5704cf8424fbd922" ON "verification_codes" ("code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "author_follows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "follower_id" uuid NOT NULL, "author_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_99100ca12e2d21dca76b9eba7ef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1686fb911d18bfb50ebc5a499c" ON "author_follows" ("follower_id", "author_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "family_id" uuid NOT NULL, "replaced_by_token_id" uuid, "revoked_at" TIMESTAMP, "expires_at" TIMESTAMP NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ip" character varying(100), "user_agent" character varying(500), "device_name" character varying(200), CONSTRAINT "PK_df6893d2063a4ea7bbf1eda31e5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f795ad14f31838e3ddc663ee15" ON "auth_refresh_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_95e0bce05491b0dee2f28ffd11" ON "auth_refresh_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_044c20745eff448cbd0738cc4e" ON "auth_refresh_tokens" ("family_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user_addresses" ADD CONSTRAINT "FK_7a5100ce0548ef27a6f1533a5ce" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_genre_preferences" ADD CONSTRAINT "FK_5d7ef64b33abac7c1ecf93a505a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_genre_preferences" ADD CONSTRAINT "FK_ac487ee36cc58bfeed3d2514190" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_profiles" ADD CONSTRAINT "FK_6ca9503d77ae39b4b5a6cc3ba88" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_genres" ADD CONSTRAINT "FK_dc378b8311ff85f0dd38f163090" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_genres" ADD CONSTRAINT "FK_43ff7d87d7506e768ca6491a1dd" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "books" ADD CONSTRAINT "FK_1056dbee4616479f7d562c562df" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "books" ADD CONSTRAINT "FK_f020780ac748c90aba37a9a1bce" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" ADD CONSTRAINT "FK_98c9162d3e5950df4652ea0ae1c" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" ADD CONSTRAINT "FK_bb9ca2b6684359d7d39bb5e87f8" FOREIGN KEY ("reader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" ADD CONSTRAINT "FK_dccb424ddec53e04f3dc8871c8f" FOREIGN KEY ("responded_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_activities" ADD CONSTRAINT "FK_a283f37e08edf5e37d38b375eec" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_activities" ADD CONSTRAINT "FK_ee7469b9953414ca32818430f5c" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_activities" ADD CONSTRAINT "FK_ca62db83736e1953982b2351aad" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_414daf69b1c74f190324c9069ac" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_53d203dc777d52cfc4104b5b6ec" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_dd75186e413a1f6e0d1ef8e1214" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_e9e4444e24f0577125255c492a2" FOREIGN KEY ("related_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "friends" ADD CONSTRAINT "FK_890c2646c24c98422c19969b199" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "friends" ADD CONSTRAINT "FK_73ad976f51c428dc6f9fcd3941c" FOREIGN KEY ("addressee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" ADD CONSTRAINT "FK_17e1f528b993c6d55def4cf5bea" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "verification_codes" ADD CONSTRAINT "FK_0a53c41a810420ee446082ce6c6" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "author_follows" ADD CONSTRAINT "FK_2d0d4db4f16a9e6bb9c4ea93223" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "author_follows" ADD CONSTRAINT "FK_7be9100bae58cfad92d50d8d7ee" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_refresh_tokens" ADD CONSTRAINT "FK_f795ad14f31838e3ddc663ee150" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_refresh_tokens" DROP CONSTRAINT "FK_f795ad14f31838e3ddc663ee150"`,
    );
    await queryRunner.query(
      `ALTER TABLE "author_follows" DROP CONSTRAINT "FK_7be9100bae58cfad92d50d8d7ee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "author_follows" DROP CONSTRAINT "FK_2d0d4db4f16a9e6bb9c4ea93223"`,
    );
    await queryRunner.query(
      `ALTER TABLE "verification_codes" DROP CONSTRAINT "FK_0a53c41a810420ee446082ce6c6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" DROP CONSTRAINT "FK_17e1f528b993c6d55def4cf5bea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "friends" DROP CONSTRAINT "FK_73ad976f51c428dc6f9fcd3941c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "friends" DROP CONSTRAINT "FK_890c2646c24c98422c19969b199"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_e9e4444e24f0577125255c492a2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_dd75186e413a1f6e0d1ef8e1214"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_53d203dc777d52cfc4104b5b6ec"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_414daf69b1c74f190324c9069ac"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_activities" DROP CONSTRAINT "FK_ca62db83736e1953982b2351aad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_activities" DROP CONSTRAINT "FK_ee7469b9953414ca32818430f5c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_activities" DROP CONSTRAINT "FK_a283f37e08edf5e37d38b375eec"`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" DROP CONSTRAINT "FK_dccb424ddec53e04f3dc8871c8f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" DROP CONSTRAINT "FK_bb9ca2b6684359d7d39bb5e87f8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" DROP CONSTRAINT "FK_98c9162d3e5950df4652ea0ae1c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "books" DROP CONSTRAINT "FK_f020780ac748c90aba37a9a1bce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "books" DROP CONSTRAINT "FK_1056dbee4616479f7d562c562df"`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_genres" DROP CONSTRAINT "FK_43ff7d87d7506e768ca6491a1dd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_genres" DROP CONSTRAINT "FK_dc378b8311ff85f0dd38f163090"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_profiles" DROP CONSTRAINT "FK_6ca9503d77ae39b4b5a6cc3ba88"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_genre_preferences" DROP CONSTRAINT "FK_ac487ee36cc58bfeed3d2514190"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_genre_preferences" DROP CONSTRAINT "FK_5d7ef64b33abac7c1ecf93a505a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_addresses" DROP CONSTRAINT "FK_7a5100ce0548ef27a6f1533a5ce"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_044c20745eff448cbd0738cc4e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_95e0bce05491b0dee2f28ffd11"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f795ad14f31838e3ddc663ee15"`,
    );
    await queryRunner.query(`DROP TABLE "auth_refresh_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1686fb911d18bfb50ebc5a499c"`,
    );
    await queryRunner.query(`DROP TABLE "author_follows"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bb0f37096d5704cf8424fbd922"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0a53c41a810420ee446082ce6c"`,
    );
    await queryRunner.query(`DROP TABLE "verification_codes"`);
    await queryRunner.query(
      `DROP TYPE "public"."verification_codes_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a070dfec1c8f06cd29b854169f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_17e1f528b993c6d55def4cf5be"`,
    );
    await queryRunner.query(`DROP TABLE "device_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5ddffcfd5c5c2be9f675d0fc2a"`,
    );
    await queryRunner.query(`DROP TABLE "friends"`);
    await queryRunner.query(`DROP TYPE "public"."friends_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_af08fad7c04bb85403970afdc1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_310667f935698fcd8cb319113a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9a8a82462cab47c73d25f49261"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a3f93b7e51709ce8e8ea1d4e68"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dab3e2726fcbb9678a6fffd353"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_414daf69b1c74f190324c9069a"`,
    );
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(`DROP TYPE "public"."reviews_review_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bd789c573f3fd7da3b22f724fd"`,
    );
    await queryRunner.query(`DROP TABLE "user_activities"`);
    await queryRunner.query(
      `DROP TYPE "public"."user_activities_activity_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_237f131f2f58df824924679e26"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e9c14cc5926d8471dea9e5db42"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8ee114cee92e995a9e75c05cfb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bb9ca2b6684359d7d39bb5e87f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_98c9162d3e5950df4652ea0ae1"`,
    );
    await queryRunner.query(`DROP TABLE "applications"`);
    await queryRunner.query(
      `DROP TYPE "public"."applications_reading_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."applications_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1056dbee4616479f7d562c562d"`,
    );
    await queryRunner.query(`DROP TABLE "books"`);
    await queryRunner.query(`DROP TYPE "public"."books_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."books_selection_method_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."books_distribution_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."books_age_rating_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dc2d072b9d76acb4c5f2a4c55e"`,
    );
    await queryRunner.query(`DROP TABLE "book_genres"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_70e33b61f2eba7ca6c5727494d"`,
    );
    await queryRunner.query(`DROP TABLE "series"`);
    await queryRunner.query(`DROP TABLE "user_profiles"`);
    await queryRunner.query(
      `DROP TYPE "public"."user_profiles_reviews_privacy_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."user_profiles_reading_list_privacy_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."user_profiles_profile_privacy_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."user_profiles_activity_privacy_enum"`,
    );
    await queryRunner.query(`DROP TABLE "user_genre_preferences"`);
    await queryRunner.query(`DROP TABLE "genres"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0bd5012aeb82628e07f6a1be53"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fe0bb3f6520ee0469504521e71"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_user_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7a5100ce0548ef27a6f1533a5c"`,
    );
    await queryRunner.query(`DROP TABLE "user_addresses"`);
  }
}
