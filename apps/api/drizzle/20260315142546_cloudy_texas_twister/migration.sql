CREATE TABLE "shares" (
	"id" uuid PRIMARY KEY,
	"fileName" varchar NOT NULL,
	"mimeType" varchar NOT NULL,
	"size" integer NOT NULL,
	"storageKey" varchar NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "expires_at_index" ON "shares" ("expiresAt");