/**
 * Role-based access control.
 * Permissions are checked server-side on every request — never trusted from the client.
 */
export const ROLES = ['user', 'support', 'finance', 'moderator', 'admin', 'superadmin'];

export const PERMISSIONS = {
  'dashboard.view': ['admin', 'superadmin', 'moderator', 'finance', 'support'],
  'users.view': ['admin', 'superadmin', 'moderator', 'support'],
  'users.edit': ['admin', 'superadmin'],
  'users.status': ['admin', 'superadmin', 'moderator'],
  'users.verify': ['admin', 'superadmin'],
  // Support/Moderation can action an account status; profile editing stays with admins.
  'moderation.users': ['admin', 'superadmin', 'moderator'],
  'support.inbox': ['admin', 'superadmin', 'support', 'moderator'],
  'users.roles': ['superadmin'],
  'listings.view': ['admin', 'superadmin', 'moderator', 'support'],
  'listings.moderate': ['admin', 'superadmin', 'moderator'],
  'listings.edit': ['admin', 'superadmin'],
  'listings.delete': ['admin', 'superadmin', 'moderator'],
  'stores.view': ['admin', 'superadmin', 'moderator', 'support'],
  'stores.moderate': ['admin', 'superadmin', 'moderator'],
  'stores.verify': ['admin', 'superadmin'],
  'reports.view': ['admin', 'superadmin', 'moderator', 'support'],
  'reports.handle': ['admin', 'superadmin', 'moderator'],
  'finance.view': ['admin', 'superadmin', 'finance'],
  'finance.manage': ['admin', 'superadmin'],
  'plans.manage': ['admin', 'superadmin'],
  'coupons.manage': ['admin', 'superadmin', 'finance'],
  'platform.content': ['admin', 'superadmin'],
  'platform.geo': ['admin', 'superadmin'],
  'platform.categories': ['admin', 'superadmin'],
  'platform.settings': ['admin', 'superadmin'],
  'platform.notifications': ['admin', 'superadmin', 'support'],
  'audit.view': ['admin', 'superadmin'],
  'staff.manage': ['superadmin'],
};

const ROLE_RANK = { user: 0, support: 1, finance: 1, moderator: 2, admin: 3, superadmin: 4 };

export function permissionsFor(user) {
  if (!user) return new Set();
  const role = ROLES.includes(user.role) ? user.role : 'user';
  const set = new Set();
  for (const [perm, roles] of Object.entries(PERMISSIONS)) {
    if (roles.includes(role)) set.add(perm);
    if (Array.isArray(user.extra_permissions) && user.extra_permissions.includes(perm)) set.add(perm);
  }
  return set;
}

export function can(user, permission) {
  if (!user) return false;
  return permissionsFor(user).has(permission);
}

export function isStaff(user) {
  return !!user && user.role !== 'user';
}

/** Nobody may grant a role at or above their own rank (superadmin is unique-ish but still guarded). */
export function canAssignRole(actor, targetRole) {
  if (!actor || actor.role !== 'superadmin') return false;
  return ROLE_RANK[targetRole] !== undefined && targetRole !== 'superadmin';
}

export function roleRank(role) {
  return ROLE_RANK[role] ?? -1;
}
