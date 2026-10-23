const BASE = import.meta.env.VITE_API_URL;

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = new Error(`Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const fetchApplications = () => request("/applications");

export const saveApplicationApi = (app) =>
  request("/applications", { method: "POST", body: JSON.stringify(app) });

export const overrideApplicationApi = (id, officer_decision) =>
  request(`/applications/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ officer_decision }),
  });

// Returns null when the rider is not found
export const fetchRider = async (nationalId) => {
  try {
    return await request(`/riders/${nationalId}`);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
};