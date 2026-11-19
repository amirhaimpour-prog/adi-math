// Thin fetch wrapper. All errors carry a Hebrew message from the server.
async function request(method, url, body, { form } = {}) {
  const opts = { method, credentials: 'same-origin', headers: { 'X-Requested-With': 'adi-math' } };
  if (form) opts.body = form;
  else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let resp;
  try {
    resp = await fetch(url, opts);
  } catch {
    throw new Error('אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.');
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data.error || `שגיאה (${resp.status})`);
    err.status = resp.status;
    if (resp.status === 401) window.dispatchEvent(new CustomEvent('auth:expired'));
    throw err;
  }
  return data;
}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b) => request('POST', u, b ?? {}),
  put: (u, b) => request('PUT', u, b ?? {}),
  patch: (u, b) => request('PATCH', u, b ?? {}),
  del: (u) => request('DELETE', u),
  form: (u, formData) => request('POST', u, undefined, { form: formData }),
};
