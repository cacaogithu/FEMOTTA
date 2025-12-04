-- Migration: Add brief submission method tracking fields to jobs table
-- Date: 2025-12-03

ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS brief_type TEXT,
ADD COLUMN IF NOT EXISTS project_name TEXT,
ADD COLUMN IF NOT EXISTS submission_metadata JSONB;

-- Add index for brief_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_jobs_brief_type ON jobs(brief_type);

-- Update existing jobs to have briefType based on existing data
UPDATE jobs 
SET brief_type = CASE 
  WHEN brief_file_id IS NOT NULL THEN 'pdf'
  WHEN prompt_text IS NOT NULL THEN 'text_prompt'
  ELSE 'unknown'
END
WHERE brief_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN jobs.brief_type IS 'Type of brief submission: pdf, docx, structured_form, pdf_with_images, text_prompt';
COMMENT ON COLUMN jobs.project_name IS 'User-provided project name for organization';
COMMENT ON COLUMN jobs.submission_metadata IS 'Additional metadata about the submission method and user preferences';
