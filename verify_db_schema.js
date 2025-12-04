import { pool } from './server/db.js';

async function checkColumns() {
    try {
        const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'brands' AND column_name IN ('gemini_api_key', 'preferred_image_api');
    `);

        console.log('Found columns:', result.rows.map(r => r.column_name));

        if (result.rows.length === 2) {
            console.log('SUCCESS: Schema changes are present in the database.');
        } else {
            console.log('FAILURE: Schema changes are MISSING from the database.');
            console.log('Found:', result.rows.length, 'expected 2');
        }
    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        await pool.end();
    }
}

checkColumns();
