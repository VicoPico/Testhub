-- Ensure GIN index for tag searches exists (idempotent)
DROP INDEX IF EXISTS "TestCase_tags_gin_idx";
CREATE INDEX IF NOT EXISTS "TestCase_tags_gin_idx" ON "TestCase" USING GIN ("tags");
