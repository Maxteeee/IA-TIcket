import { API_URL } from '../config/api';

async function request(path, options = {}) {
  if (!API_URL) {
    throw new Error('Configurá EXPO_PUBLIC_API_URL en frontend/.env y reiniciá Expo.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'La solicitud falló');
    return data;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) {
      throw new Error('No se pudo conectar al backend. Revisá la IP, el servidor y la red Wi-Fi.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function getItems() {
  return request('/items');
}

export function createItem(name) {
  return request('/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}
