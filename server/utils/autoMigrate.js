/**
 * Auto-migration script for adding brief submission fields
 * This runs once on server startup to ensure new fields exist
 */
import { pool } from '../db.js';

let migrationRun = false;

export async function runStartupMigration() {
  // Only run once per server lifetime
  if (migrationRun) return;

  try {
    console.log('[Migration] Checking for required database schema updates...');

    // Add new columns to jobs table if they don't exist
    await pool.query(`
      ALTER TABLE jobs 
      ADD COLUMN IF NOT EXISTS brief_type TEXT,
      ADD COLUMN IF NOT EXISTS project_name TEXT,
      ADD COLUMN IF NOT EXISTS submission_metadata JSONB;
    `);

    // Create index for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_brief_type ON jobs(brief_type);
    `);

    // Update existing jobs to have briefType based on existing data
    const result = await pool.query(`
      UPDATE jobs 
      SET brief_type = CASE 
        WHEN brief_file_id IS NOT NULL THEN 'pdf'
        WHEN prompt_text IS NOT NULL THEN 'text_prompt'
        ELSE 'unknown'
      END
      WHERE brief_type IS NULL
      RETURNING id;
    `);

    if (result.rowCount > 0) {
      console.log(`[Migration] ✓ Updated ${result.rowCount} existing jobs with brief_type`);
    }

    console.log('[Migration] ✓ Database schema is up to date');
    console.log('[Migration] Multi-method brief submission system ready!');

    migrationRun = true;

  } catch (error) {
    // Don't crash the server if migration fails
    console.error('[Migration] Warning: Could not run database migration:', error.message);
    console.error('[Migration] The multi-method brief submission may not work until migration is applied');
  }
}
