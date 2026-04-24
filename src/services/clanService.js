/**
 * Clan service utilities for checking permissions and managing clan-related operations
 */

/**
 * Check clan membership and role for a pet
 * @param {Pool} pool - Database pool
 * @param {string} clanId - Clan ID
 * @param {string} petId - Pet ID
 * @returns {Promise<{isMember: boolean, role: string|null}>} - Membership status and role
 */
export async function checkClanMemberRole(pool, clanId, petId) {
  try {
    const result = await pool.query(
      `SELECT role FROM clan_members WHERE clan_id = $1 AND pet_id = $2`,
      [clanId, petId]
    );

    if (result.rows.length === 0) {
      return { isMember: false, role: null };
    }

    return { isMember: true, role: result.rows[0].role };
  } catch (err) {
    console.error('Error checking clan member role:', err);
    return { isMember: false, role: null };
  }
}

/**
 * Check if member count is at max (100)
 * @param {Pool} pool - Database pool
 * @param {string} clanId - Clan ID
 * @returns {Promise<boolean>} - True if at max members
 */
export async function isClanAtMaxMembers(pool, clanId) {
  try {
    const result = await pool.query(
      `SELECT member_count FROM clans WHERE id = $1`,
      [clanId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    return result.rows[0].member_count >= 100;
  } catch (err) {
    console.error('Error checking clan member count:', err);
    return false;
  }
}

/**
 * Check if a pet can delete a post/comment (author, moderator, or admin)
 * @param {Pool} pool - Database pool
 * @param {string} clanId - Clan ID
 * @param {string} authorPetId - Author pet ID
 * @param {string} currentPetId - Current pet ID
 * @returns {Promise<boolean>} - True if can delete
 */
export async function canDeleteClanContent(pool, clanId, authorPetId, currentPetId) {
  try {
    // If author, can always delete
    if (authorPetId === currentPetId) {
      return true;
    }

    // Check if current pet is moderator or admin
    const { role } = await checkClanMemberRole(pool, clanId, currentPetId);

    // Moderators and admins can delete any content
    return role === 'moderator' || role === 'admin';
  } catch (err) {
    console.error('Error checking delete permission:', err);
    return false;
  }
}

/**
 * Get active pet for a companion (used for posting)
 * @param {Pool} pool - Database pool
 * @param {string} companionId - Companion ID
 * @returns {Promise<string|null>} - Active pet ID or null
 */
export async function getActivePet(pool, companionId) {
  try {
    // Try to get explicit active pet
    let result = await pool.query(
      `SELECT active_pet_id FROM companions WHERE id = $1`,
      [companionId]
    );

    if (result.rows[0]?.active_pet_id) {
      return result.rows[0].active_pet_id;
    }

    // Fallback to first pet
    result = await pool.query(
      `SELECT id FROM pets WHERE companion_id = $1 ORDER BY created_at LIMIT 1`,
      [companionId]
    );

    return result.rows[0]?.id || null;
  } catch (err) {
    console.error('Error getting active pet:', err);
    return null;
  }
}

/**
 * Get author info for clan post/comment
 * @param {Pool} pool - Database pool
 * @param {string} authorPetId - Author pet ID
 * @param {boolean} sentAsOwner - Whether sent as owner
 * @returns {Promise<object>} - Author info with name, avatar, username
 */
export async function getAuthorInfo(pool, authorPetId, sentAsOwner) {
  try {
    const result = await pool.query(
      `SELECT
        CASE WHEN $2::boolean THEN c.name ELSE p.name END AS author_name,
        CASE WHEN $2::boolean THEN c.avatar_url ELSE p.avatar_url END AS author_avatar,
        CASE WHEN $2::boolean THEN c.username ELSE p.username END AS author_username,
        CASE WHEN $2::boolean THEN NULL ELSE c.name END AS author_owner_name,
        CASE WHEN $2::boolean THEN NULL ELSE c.username END AS author_owner_username
      FROM pets p
      JOIN companions c ON c.id = p.companion_id
      WHERE p.id = $1`,
      [authorPetId, sentAsOwner]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (err) {
    console.error('Error getting author info:', err);
    return null;
  }
}
