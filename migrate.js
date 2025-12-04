import { pool } from './server/db.js';

async function runMigration() {
    try {
        console.log('Running migration to add brief_type, project_name, and submission_metadata fields...');

        // Add new columns to jobs table
        await pool.query(`
      ALTER TABLE jobs 
      ADD COLUMN IF NOT EXISTS brief_type TEXT,
      ADD COLUMN IF NOT EXISTS project_name TEXT,
      ADD COLUMN IF NOT EXISTS submission_metadata JSONB;
    `);

        console.log('✓ Columns added successfully');

        // Create index for better performance
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_brief_type ON jobs(brief_type);
    `);

        console.log('✓ Index created successfully');

        // Update existing jobs to have briefType based on existing data
        await pool.query(`
      UPDATE jobs 
      SET brief_type = CASE 
        WHEN brief_file_id IS NOT NULL THEN 'pdf'
        WHEN prompt_text IS NOT NULL THEN 'text_prompt'
        ELSE 'unknown'
      END
      WHERE brief_type IS NULL;
    `);

        console.log('✓ Existing jobs updated');

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

        console.log('✓ Column comments added');
        console.log('');
        console.log('🎉 Migration completed successfully!');
        console.log('The multi-method brief submission system is now ready to use.');

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
