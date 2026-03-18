CREATE TABLE "drops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"fileName" varchar NOT NULL,
	"mimeType" varchar NOT NULL,
	"size" integer NOT NULL,
	"storageKey" varchar NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp DEFAULT now() + interval '1 week' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "expires_at_index" ON "drops" ("expiresAt");