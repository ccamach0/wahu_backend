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
    console.log('🔄 Aplicando migración incremental...');
    const sql = fs.readFileSync('./migration_incremental.sql', 'utf8');
    await client.query(sql);
    console.log('✅ Migración incremental aplicada exitosamente');
    
    // Verificar columnas nuevas
    const columns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'cards' 
      AND column_name IN ('card_type', 'value1_name', 'value1_value', 'value2_name', 'value2_value', 'like_count')
      ORDER BY column_name
    `);
    
    console.log('\n✨ Columnas nuevas en cards:');
    columns.rows.forEach(row => console.log('  •', row.column_name, '-', row.data_type));
    
    // Verificar índices
    const indexes = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename IN ('card_likes', 'pet_tags')
      ORDER BY indexname
    `);
    
    console.log('\n✨ Índices nuevos:');
    indexes.rows.forEach(row => console.log('  •', row.indexname));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
