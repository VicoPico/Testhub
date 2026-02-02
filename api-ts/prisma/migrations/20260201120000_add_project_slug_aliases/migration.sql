-- CreateTable
CREATE TABLE "ProjectSlugAlias" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSlugAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSlugAlias_slug_key" ON "ProjectSlugAlias"("slug");

-- CreateIndex
CREATE INDEX "ProjectSlugAlias_projectId_idx" ON "ProjectSlugAlias"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectSlugAlias" ADD CONSTRAINT "ProjectSlugAlias_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
