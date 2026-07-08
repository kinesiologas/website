export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MODEL: 'model',
  USER: 'user',
};

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super administrador',
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.MODEL]: 'Modelo',
  [ROLES.USER]: 'Usuario',
};

export const ROLE_OPTIONS = [
  { value: ROLES.USER, label: ROLE_LABELS[ROLES.USER] },
  { value: ROLES.MODEL, label: ROLE_LABELS[ROLES.MODEL] },
  { value: ROLES.ADMIN, label: ROLE_LABELS[ROLES.ADMIN] },
  { value: ROLES.SUPER_ADMIN, label: ROLE_LABELS[ROLES.SUPER_ADMIN] },
];

export const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

export function hasRole(profile, roles) {
  return Boolean(profile?.active !== false && roles.includes(profile?.role));
}

export function getRoleHome(role) {
  if (role === ROLES.USER) {
    return '/admin/favoritos';
  }

  if (role === ROLES.MODEL) {
    return '/admin/mi-perfil';
  }

  return '/admin';
}
