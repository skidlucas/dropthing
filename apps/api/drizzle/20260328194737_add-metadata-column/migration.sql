ALTER TABLE "drops" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "drops" ALTER COLUMN "type" SET DEFAULT 'text';