-- Add GIN index for tag searches
CREATE INDEX IF NOT EXISTS "TestCase_tags_gin_idx" ON "TestCase" USING GIN ("tags");
