ALTER TABLE "drops" ADD COLUMN "type" varchar NOT NULL DEFAULT 'text';--> statement-breakpoint
ALTER TABLE "drops" ADD COLUMN "content" text;--> statement-breakpoint
ALTER TABLE "drops" ALTER COLUMN "fileName" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "drops" ALTER COLUMN "mimeType" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "drops" ALTER COLUMN "size" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "drops" ALTER COLUMN "storageKey" DROP NOT NULL;