const DEFAULT_BASE_URL = 'http://192.168.0.105:4000';


export function getApiBaseUrl() {
  // Expo supports runtime env vars prefixed with EXPO_PUBLIC_
  // Example: EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:4000
  return String(process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

export async function apiRequest(path, { method = 'GET', token, body } = {}) {
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;

  const headers = {
    Accept: 'application/json',
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (body != null) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const text = await res.text().catch(() => '');
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const message =
      json?.error ||
      json?.message ||
      (text && text.length < 200 ? text : null) ||
      `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = json;
    throw err;
  }

  return json;
}

