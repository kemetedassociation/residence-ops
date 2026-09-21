export async function httpJson(url, { method = "GET", headers = {}, json, form } = {}) {
  const init = { method, headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(15000) };
  if (json !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(json);
  } else if (form) {
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = new URLSearchParams(form).toString();
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = typeof data === "object" && data ? data.detail || data.message || data.error_description || data.title : "";
    const err = new Error(`HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const euros = (cents) => (cents / 100).toFixed(2);
