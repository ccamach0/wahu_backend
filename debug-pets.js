#!/usr/bin/env node

import { Pool } from 'pg';

const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/wahu_db' });

async function debugPets() {
  try {
    console.log('🔍 Verificando mascotas...\n');

    const result = await pool.query(
      `SELECT id, name, username FROM pets ORDER BY created_at DESC LIMIT 10`
    );

    console.log('Mascotas encontradas:');
    result.rows.forEach(pet => {
      console.log(`  ${pet.username}: name="${pet.name}", id=${pet.id}`);
    });

    console.log('\n📊 Verificando publicaciones en el perfil de mhhg...\n');

    // Primero obtén el companion_id
    const companionResult = await pool.query(
      `SELECT id FROM companions WHERE username = 'christopher_gcamachov'`
    );

    if (companionResult.rows.length === 0) {
      console.log('❌ No se encontró el compañero christopher_gcamachov');
      return;
    }

    const companion_id = companionResult.rows[0].id;
    console.log(`Companion ID: ${companion_id}\n`);

    const posts = await pool.query(`
      SELECT
        p.id,
        p.pet_id,
        p.content,
        p.created_at,
        pet.name as pet_name,
        pet.username as pet_username,
        comp.name as companion_name,
        comp.username as companion_username
      FROM companion_posts p
      JOIN pets pet ON pet.id = p.pet_id
      JOIN companions comp ON comp.id = pet.companion_id
      WHERE p.companion_id = $1
      ORDER BY p.created_at DESC
      LIMIT 10
    `, [companion_id]);

    console.log('Publicaciones encontradas:');
    posts.rows.forEach(post => {
      console.log(`  Content: "${post.content}"`);
      console.log(`  Pet: ${post.pet_username} (name="${post.pet_name}", id=${post.pet_id})`);
      console.log(`  Companion: ${post.companion_username}`);
      console.log('');
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

debugPets();
