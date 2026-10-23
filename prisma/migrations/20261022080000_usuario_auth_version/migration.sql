-- Invalidate every previously issued JWT after password changes/resets.
ALTER TABLE "usuarios" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 1;
