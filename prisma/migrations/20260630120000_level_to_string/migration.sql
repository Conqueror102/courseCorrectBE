-- Convert Course.level from the "Level" enum to free-text String.
-- Existing rows store the mapped DB values ('100'..'500'); remap them to the
-- 'L_100'..'L_500' form the application sends so old and new data stay consistent.
ALTER TABLE "Course" ALTER COLUMN "level" TYPE TEXT USING (
  CASE "level"::TEXT
    WHEN '100' THEN 'L_100'
    WHEN '200' THEN 'L_200'
    WHEN '300' THEN 'L_300'
    WHEN '400' THEN 'L_400'
    WHEN '500' THEN 'L_500'
    ELSE "level"::TEXT
  END
);

-- The enum type is no longer used by any column.
DROP TYPE "Level";
