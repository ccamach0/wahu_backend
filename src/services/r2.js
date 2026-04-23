const endpoint = process.env.R2_ENDPOINT;
const bucketName = process.env.R2_BUCKET_NAME;
const publicUrl = process.env.R2_PUBLIC_URL;
const accountId = process.env.R2_ACCOUNT_ID;
const token = process.env.R2_ACCESS_KEY_ID;

export async function uploadToR2(buffer, filename, folder = 'images') {
  const key = `${folder}/${Date.now()}-${filename}`;
  const url = `${endpoint}/${bucketName}/${key}`;

  console.log(`[R2] Uploading to: ${url}`);
  console.log(`[R2] Token present: ${token ? 'yes' : 'no'}`);
  console.log(`[R2] Buffer size: ${buffer.length} bytes`);

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'image/jpeg',
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      },
      body: buffer,
    });

    console.log(`[R2] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const text = await response.text();
      console.log(`[R2] Error response: ${text}`);
      throw new Error(`R2 upload failed: ${response.statusText} - ${text}`);
    }

    return `${publicUrl}/${key}`;
  } catch (error) {
    console.error('Error uploading to R2:', error.message);
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
