#!/usr/bin/env node

import { Pool } from 'pg';

const NEON_DB = 'postgresql://neondb_owner:npg_NW5p9LyPTuSc@ep-dark-rain-am4l3wib-pooler.c-5.us-east-1.aws.neon.tech/wahu?sslmode=require&channel_binding=require';

const pool = new Pool({ connectionString: NEON_DB, ssl: { rejectUnauthorized: false } });

async function debugNeon() {
  try {
    console.log('🔍 Verificando mascotas en Neon...\n');

    const pets = await pool.query(
      `SELECT id, name, username FROM pets ORDER BY created_at DESC LIMIT 10`
    );

    console.log('Mascotas encontradas:');
    pets.rows.forEach(pet => {
      console.log(`  ${pet.username}: name="${pet.name}", id=${pet.id}`);
    });

    console.log('\n📊 Verificando publicaciones en Neon (en el perfil de mhhg)...\n');

    // Buscar por el pet_id de mhhg (hgm username)
    const mhhgPet = pets.rows.find(p => p.username === 'hgm');

    if (!mhhgPet) {
      console.log('❌ No se encontró mhhg');
      return;
    }

    console.log(`Mascota: ${mhhgPet.username} (name="${mhhgPet.name}", id=${mhhgPet.id})\n`);

    // Buscar publicaciones en el perfil de esa mascota
    const petPosts = await pool.query(`
      SELECT
        p.id,
        p.pet_id,
        p.content,
        p.sent_as_owner,
        p.created_at,
        pet.name as pet_name,
        pet.username as pet_username,
        comp.name as companion_name,
        comp.username as companion_username
      FROM pet_posts p
      JOIN pets pet ON pet.id = p.pet_id
      JOIN companions comp ON comp.id = pet.companion_id
      WHERE p.pet_id = $1
      ORDER BY p.created_at DESC
      LIMIT 10
    `, [mhhgPet.id]);

    if (petPosts.rows.length === 0) {
      console.log('❌ No hay publicaciones en el perfil de mhhg');
      return;
    }

    console.log(`✓ Publicaciones encontradas (${petPosts.rows.length}):`);
    petPosts.rows.forEach((post, i) => {
      console.log(`\n${i + 1}. Content: "${post.content.substring(0, 50)}..."`);
      console.log(`   Pet: ${post.pet_username} (name="${post.pet_name}", id=${post.pet_id})`);
      console.log(`   Sent as owner: ${post.sent_as_owner}`);
      console.log(`   Created: ${post.created_at}`);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

debugNeon();
