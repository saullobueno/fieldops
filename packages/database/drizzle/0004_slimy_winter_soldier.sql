ALTER TYPE "public"."audit_action" ADD VALUE 'revoke';--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "revoked_at" timestamp with time zone;