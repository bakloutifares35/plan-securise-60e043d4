const COMPLETE_PREFIX = "resillia:onboarding:v1:";
const SKIPPED_PREFIX = "resillia:onboarding-skipped:";
const memoryCompleted = new Set<string>();
const memorySkipped = new Set<string>();

export function hasDismissedOnboarding(userId: string) {
  if (memoryCompleted.has(userId) || memorySkipped.has(userId)) return true;
  try {
    if (window.localStorage.getItem(`${COMPLETE_PREFIX}${userId}`) === "complete") return true;
  } catch { /* Le stockage local peut être bloqué par le navigateur. */ }
  try { if (window.sessionStorage.getItem(`${SKIPPED_PREFIX}${userId}`) === "skipped") return true; } catch { /* Le contrôle Auth reste indépendant de ce stockage. */ }
  return false;
}

export function completeOnboarding(userId: string) {
  memoryCompleted.add(userId);
  try { window.localStorage.setItem(`${COMPLETE_PREFIX}${userId}`, "complete"); } catch { /* Access reste protégé côté serveur. */ }
}

export function skipOnboardingForSession(userId: string) {
  memorySkipped.add(userId);
  try { window.sessionStorage.setItem(`${SKIPPED_PREFIX}${userId}`, "skipped"); } catch { /* Skip limité à cette session mémoire. */ }
}
