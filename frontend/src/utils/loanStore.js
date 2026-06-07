// ─────────────────────────────────────────────────────────────────────────────
// loanStore.js  —  all loan records live in localStorage under "bodacredit_loans"
// and all rider profiles live under "bodacredit_riders"
// ─────────────────────────────────────────────────────────────────────────────

const LOANS_KEY   = "bodacredit_loans";
const RIDERS_KEY  = "bodacredit_riders";

// ── LOANS ────────────────────────────────────────────────────────────────────

export function getAllLoans() {
  try {
    return JSON.parse(localStorage.getItem(LOANS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveLoan(loanRecord) {
  const loans = getAllLoans();
  loans.unshift(loanRecord); // newest first
  localStorage.setItem(LOANS_KEY, JSON.stringify(loans));
}

export function deleteLoan(rider_id) {
  const loans = getAllLoans().filter((l) => l.rider_id !== rider_id);
  localStorage.setItem(LOANS_KEY, JSON.stringify(loans));
}

// ── RIDERS ───────────────────────────────────────────────────────────────────
// Keyed by phone_number so returning riders are recognised

export function getAllRiders() {
  try {
    return JSON.parse(localStorage.getItem(RIDERS_KEY) || "{}");
  } catch {
    return {};
  }
}

// loanStore.js — change RIDERS_KEY lookups from phone to national_id
export function getRiderByID(national_id) {
  if (!national_id || national_id.trim().length < 6) return null;
  const riders = getAllRiders();
  return riders[national_id.trim()] ?? null;
}

export function saveRiderProfile(national_id, profile) {
  if (!national_id || national_id.trim().length < 6) return;
  const riders = getAllRiders();
  riders[national_id.trim()] = { ...profile, last_updated: new Date().toISOString() };
  localStorage.setItem(RIDERS_KEY, JSON.stringify(riders));
}

