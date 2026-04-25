import fs from 'fs';
import pkg from 'pg';

const { Pool } = pkg;

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔄 Aplicando esquema completo...');
    const sql = fs.readFileSync('./migration_clean.sql', 'utf8');
    await client.query(sql);
    console.log('✅ Esquema completo aplicado exitosamente');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
