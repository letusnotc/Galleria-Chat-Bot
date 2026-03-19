// Cloudinary upload helper (SIGNED upload via backend).
// Uses server/.env Cloudinary keys to generate a signature so the API secret is never in the app.

import { apiRequest } from './api';

function getUploadUrl(cloudName) {
  return `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
}

async function getSignedUploadParams({ folder }) {
  const data = await apiRequest('/api/cloudinary/sign', { method: 'POST', body: { folder } });
  const { cloudName, apiKey, timestamp, signature } = data ?? {};
  if (!cloudName || !apiKey || !timestamp || !signature) {
    throw new Error('Cloudinary signing failed');
  }
  return { cloudName, apiKey, timestamp, signature, folder: data.folder };
}

export async function uploadImageSigned({ uri, folder = 'chatbot-gallery', onProgress }) {
  if (!uri) throw new Error('Missing image uri');

  const { cloudName, apiKey, timestamp, signature } = await getSignedUploadParams({ folder });

  const form = new FormData();
  form.append('file', {
    uri,
    name: `upload_${Date.now()}.jpg`,
    type: 'image/jpeg',
  });
  form.append('api_key', String(apiKey));
  form.append('timestamp', String(timestamp));
  form.append('signature', String(signature));
  form.append('folder', String(folder));

  onProgress?.({ sent: 0, total: 0 });

  const res = await fetch(getUploadUrl(cloudName), {
    method: 'POST',
    body: form,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed (${res.status}): ${text || res.statusText}`);
  }

  const json = await res.json();
  if (!json?.secure_url) throw new Error('Upload succeeded but secure_url missing');
  return json.secure_url;
}

export async function uploadImagesSigned({ uris, onItemComplete, folder }) {
  const urls = [];
  for (let i = 0; i < uris.length; i += 1) {
    const uri = uris[i];
    const secureUrl = await uploadImageSigned({ uri, folder });
    urls.push(secureUrl);
    onItemComplete?.({ index: i, total: uris.length, secureUrl });
  }
  return urls;
}

