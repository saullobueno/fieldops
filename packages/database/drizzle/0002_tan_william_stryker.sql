ALTER TABLE "technician_profiles" ADD COLUMN "current_latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "technician_profiles" ADD COLUMN "current_longitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "technician_profiles" ADD COLUMN "location_updated_at" timestamp with time zone;