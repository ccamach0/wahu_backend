import fs from 'fs';
import pkg from 'pg';

const { Pool } = pkg;

const connectionString = "postgresql://neondb_owner:npg_NW5p9LyPTuSc@ep-dark-rain-am4l3wib-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const pool = new Pool({ 
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔄 Aplicando esquema completo...');
    const sql = fs.readFileSync('./migration_clean.sql', 'utf8');
    await client.query(sql);
    console.log('✅ Esquema completo aplicado exitosamente');
    
    // Verificar
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    console.log('\n✨ Tablas creadas:');
    tables.rows.forEach(row => console.log('  •', row.tablename));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
