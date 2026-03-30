// Shared CRM auth helpers — include this in every CRM page

export function getToken() {
  return localStorage.getItem('crm_token');
}

export function requireAuth() {
  if (!getToken()) {
    window.location.href = '/crm/login.html';
  }
}

export function logout() {
  localStorage.removeItem('crm_token');
  window.location.href = '/crm/login.html';
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    logout();
    return;
  }
  return res;
}
