#!/usr/bin/env node

/**
 * Script para sincronizar datos de BD local a Neon
 * Uso: DATABASE_URL_LOCAL=... DATABASE_URL_NEON=... node sync-to-neon.js
 */

import { Pool } from 'pg';

const LOCAL_DB = process.env.DATABASE_URL_LOCAL || 'postgresql://postgres:postgres@localhost:5432/wahu_db';
const NEON_DB = process.env.DATABASE_URL_NEON;

if (!NEON_DB) {
  console.error('❌ Error: DATABASE_URL_NEON no está definida');
  console.error('Uso: DATABASE_URL_NEON="tu_url" node sync-to-neon.js');
  process.exit(1);
}

const localPool = new Pool({ connectionString: LOCAL_DB });
const neonPool = new Pool({ connectionString: NEON_DB, ssl: { rejectUnauthorized: false } });

const TABLES = [
  'companions',
  'pets',
  'pet_cards',
  'cards',
  'pet_tags',
  'friendships',
  'clan_memberships',
  'clans',
  'pet_posts',
  'pet_post_comments',
  'companion_posts',
  'companion_post_comments',
  'companion_gallery_images',
  'companion_gallery_comments',
  'pet_gallery_images',
  'pet_gallery_comments',
  'pet_hydrant_toggle'
];

async function syncTable(tableName) {
  try {
    console.log(`\n📊 Sincronizando tabla: ${tableName}...`);

    // Obtener datos de BD local
    const localResult = await localPool.query(`SELECT * FROM ${tableName}`);
    const rows = localResult.rows;

    if (rows.length === 0) {
      console.log(`  ✓ Tabla vacía (0 registros)`);
      return;
    }

    // Limpiar tabla en Neon
    await neonPool.query(`TRUNCATE TABLE ${tableName} CASCADE`);
    console.log(`  ✓ Tabla limpiada`);

    // Obtener columnas
    const columnsResult = await neonPool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = $1 ORDER BY ordinal_position
    `, [tableName]);

    const columns = columnsResult.rows.map(r => r.column_name);

    // Insertar datos
    let inserted = 0;
    for (const row of rows) {
      const values = columns.map(col => row[col]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
      const query = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;

      try {
        await neonPool.query(query, values);
        inserted++;
      } catch (err) {
        console.error(`    ⚠ Error insertando fila en ${tableName}:`, err.message);
      }
    }

    console.log(`  ✓ Insertados ${inserted}/${rows.length} registros`);

  } catch (err) {
    console.error(`  ❌ Error sincronizando ${tableName}:`, err.message);
  }
}

async function main() {
  try {
    console.log('🔄 SINCRONIZANDO BASE DE DATOS LOCAL A NEON');
    console.log('==========================================');
    console.log(`Local DB: ${LOCAL_DB}`);
    console.log(`Neon DB:  ${NEON_DB}`);

    // Verificar conexiones
    console.log('\n🔗 Verificando conexiones...');
    await localPool.query('SELECT 1');
    console.log('  ✓ Conexión a BD local OK');

    await neonPool.query('SELECT 1');
    console.log('  ✓ Conexión a Neon OK');

    // Sincronizar tablas
    for (const table of TABLES) {
      try {
        await syncTable(table);
      } catch (err) {
        console.error(`Error en tabla ${table}:`, err.message);
      }
    }

    console.log('\n✅ SINCRONIZACIÓN COMPLETADA');
    console.log('==========================================\n');

  } catch (err) {
    console.error('❌ Error fatal:', err.message);
    process.exit(1);
  } finally {
    await localPool.end();
    await neonPool.end();
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
