-- CreateTable
CREATE TABLE "CourseOption" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseOption_type_value_key" ON "CourseOption"("type", "value");

-- Seed standard levels and sessions so the managed lists are not empty.
INSERT INTO "CourseOption" ("id", "type", "value") VALUES
    ('seed_level_l100', 'LEVEL', 'L_100'),
    ('seed_level_l200', 'LEVEL', 'L_200'),
    ('seed_level_l300', 'LEVEL', 'L_300'),
    ('seed_level_l400', 'LEVEL', 'L_400'),
    ('seed_level_l500', 'LEVEL', 'L_500'),
    ('seed_level_jupeb', 'LEVEL', 'JUPEB'),
    ('seed_session_2324', 'SESSION', '2023/2024'),
    ('seed_session_2425', 'SESSION', '2024/2025'),
    ('seed_session_2526', 'SESSION', '2025/2026')
ON CONFLICT ("type", "value") DO NOTHING;
