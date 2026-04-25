import { Pool } from 'pg';

const LOCAL_DB = 'postgresql://postgres:postgres@localhost:5432/wahu_db';
const NEON_DB = 'postgresql://neondb_owner:npg_NW5p9LyPTuSc@ep-dark-rain-am4l3wib-pooler.c-5.us-east-1.aws.neon.tech/wahu?sslmode=require&channel_binding=require';

const localPool = new Pool({ connectionString: LOCAL_DB });
const neonPool = new Pool({ connectionString: NEON_DB, ssl: { rejectUnauthorized: false } });

async function syncTables() {
  try {
    console.log('📤 Sincronizando tablas de clan a Neon...\n');

    const tables = [
      'clan_posts',
      'clan_post_comments',
      'clan_gallery',
      'clan_gallery_comments',
      'clan_chat_messages',
      'clan_join_requests'
    ];

    for (const table of tables) {
      console.log(`⏳ Procesando ${table}...`);
      
      const data = await localPool.query(`SELECT * FROM ${table}`);
      console.log(`   - Encontrados ${data.rows.length} registros`);

      if (data.rows.length > 0) {
        const columns = Object.keys(data.rows[0]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
        const columnList = columns.join(',');
        
        for (const row of data.rows) {
          const values = columns.map(col => row[col]);
          try {
            await neonPool.query(
              `INSERT INTO ${table} (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
              values
            );
          } catch (e) {
            console.warn(`   ⚠ Error insertando en Neon: ${e.message}`);
          }
        }
      }
      
      console.log(`   ✅ ${table} sincronizada\n`);
    }

    console.log('✅ Sincronización completada!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

syncTables();
