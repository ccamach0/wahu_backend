#!/usr/bin/env node

import { Pool } from 'pg';

const NEON_DB = 'postgresql://neondb_owner:npg_NW5p9LyPTuSc@ep-dark-rain-am4l3wib-pooler.c-5.us-east-1.aws.neon.tech/wahu?sslmode=require&channel_binding=require';

const pool = new Pool({ connectionString: NEON_DB, ssl: { rejectUnauthorized: false } });

async function createTables() {
  try {
    console.log('🔄 Creando tablas faltantes en Neon...\n');

    // Create pet_tags table
    console.log('📊 Creando tabla pet_tags...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pet_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
        tag_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(pet_id, tag_name)
      )
    `);
    console.log('  ✓ Tabla pet_tags creada');

    // Create pet_gallery table
    console.log('📊 Creando tabla pet_gallery...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pet_gallery (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
        image_url VARCHAR(500) NOT NULL,
        "order" INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ Tabla pet_gallery creada');

    // Create companion_gallery table
    console.log('📊 Creando tabla companion_gallery...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS companion_gallery (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        companion_id UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
        image_url VARCHAR(500) NOT NULL,
        "order" INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ Tabla companion_gallery creada');

    // Create clan_memberships table
    console.log('📊 Creando tabla clan_memberships...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clan_memberships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clan_id UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(clan_id, pet_id)
      )
    `);
    console.log('  ✓ Tabla clan_memberships creada');

    // Create pet_hydrant_toggle table
    console.log('📊 Creando tabla pet_hydrant_toggle...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pet_hydrant_toggle (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
        active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(pet_id)
      )
    `);
    console.log('  ✓ Tabla pet_hydrant_toggle creada');

    console.log('\n✅ TODAS LAS TABLAS CREADAS EXITOSAMENTE');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createTables();
