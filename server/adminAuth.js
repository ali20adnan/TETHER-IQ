/** Admin API auth disabled — all admin routes are open. */

export function getAdminLoginSecret() {
  return '';
}

export function readAdminLoginAttempt(req) {
  return '';
}

export function checkAdminLogin() {
  return true;
}