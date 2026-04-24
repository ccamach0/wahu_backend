#!/usr/bin/env node

/**
 * Script para ejecutar migraciones contra Neon
 * Uso: node scripts/migrate.js [migration-file]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationFile = process.argv[2] || '../migration_incremental.sql';
const filePath = path.resolve(__dirname, migrationFile);

if (!fs.existsSync(filePath)) {
  console.error(`❌ Error: Archivo no encontrado: ${filePath}`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL no está definida en las variables de ambiente');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔄 Iniciando migración...');
    console.log(`📄 Archivo: ${migrationFile}`);

    const sql = fs.readFileSync(filePath, 'utf8');

    // Ejecutar la migración
    await client.query(sql);

    console.log('✅ Migración completada exitosamente');

    // Verificación
    console.log('\n📊 Verificando cambios...');

    const cardColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'cards' AND column_name IN (
        'card_type', 'value1_name', 'value1_value', 'value2_name', 'value2_value', 'like_count'
      )
      ORDER BY ordinal_position
    `);

    const tables = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE tablename IN ('card_likes', 'pet_tags')
      ORDER BY tablename
    `);

    const indexes = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename IN ('card_likes', 'pet_tags')
      ORDER BY indexname
    `);

    console.log('\n✨ Columnas nuevas en cards:');
    cardColumns.rows.forEach((row) => {
      console.log(`  • ${row.column_name} (${row.data_type})`);
    });

    console.log('\n✨ Tablas nuevas:');
    tables.rows.forEach((row) => {
      console.log(`  • ${row.tablename}`);
    });

    console.log('\n✨ Índices nuevos:');
    indexes.rows.forEach((row) => {
      console.log(`  • ${row.indexname}`);
    });

    console.log('\n🎉 ¡Migración completada y verificada!');
  } catch (error) {
    console.error('❌ Error durante la migración:');
    console.error(error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
