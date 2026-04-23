const endpoint = process.env.R2_ENDPOINT;
const bucketName = process.env.R2_BUCKET_NAME;
const publicUrl = process.env.R2_PUBLIC_URL;
const accountId = process.env.R2_ACCOUNT_ID;
const token = process.env.R2_ACCESS_KEY_ID;

export async function uploadToR2(buffer, filename, folder = 'images') {
  const key = `${folder}/${Date.now()}-${filename}`;
  const url = `${endpoint}/${bucketName}/${key}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'image/jpeg',
      },
      body: buffer,
    });

    if (!response.ok) {
      throw new Error(`R2 upload failed: ${response.statusText}`);
    }

    return `${publicUrl}/${key}`;
  } catch (error) {
    console.error('Error uploading to R2:', error);
    throw error;
  }
}

export async function deleteFromR2(url) {
  if (!url) return;

  try {
    const key = url.replace(`${publicUrl}/`, '');
    const deleteUrl = `${endpoint}/${bucketName}/${key}`;

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      console.error(`Error deleting from R2: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting from R2:', error);
  }
}
