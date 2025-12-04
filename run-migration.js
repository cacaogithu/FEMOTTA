/**
 * Standalone migration script
 * Run with: DATABASE_URL="your_url" node run-migration.js
 */
import pkg from 'pg';
const { Pool } = pkg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_FigytvZk5b0W@ep-rapid-mountain-aht92s8x.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({ connectionString: DATABASE_URL });

async function runMigration() {
    try {
        console.log('[Migration] Connecting to database...');

        // Add new columns to jobs table
        await pool.query(`
      ALTER TABLE jobs 
      ADD COLUMN IF NOT EXISTS brief_type TEXT,
      ADD COLUMN IF NOT EXISTS project_name TEXT,
      ADD COLUMN IF NOT EXISTS submission_metadata JSONB;
    `);

        console.log('[Migration] ✓ Columns added successfully');

        // Create index for better performance
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_brief_type ON jobs(brief_type);
    `);

        console.log('[Migration] ✓ Index created successfully');

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

        console.log(`[Migration] ✓ Updated ${result.rowCount} existing jobs with brief_type`);

        // Add column comments
        await pool.query(`
      COMMENT ON COLUMN jobs.brief_type IS 'Type of brief submission: pdf, docx, structured_form, pdf_with_images, text_prompt';
    `);

        await pool.query(`
      COMMENT ON COLUMN jobs.project_name IS 'User-provided project name for organization';
    `);

        await pool.query(`
      COMMENT ON COLUMN jobs.submission_metadata IS 'Additional metadata about the submission method and user preferences';
    `);

        console.log('[Migration] ✓ Column comments added');
        console.log('');
        console.log('🎉 Migration completed successfully!');
        console.log('The multi-method brief submission system is now ready to use.');

    } catch (error) {
        console.error('[Migration] Error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
