export const ROLES = {
  OWNER: 'Owner',
  OPERATOR: 'Operator',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: readonly Role[] = [ROLES.OWNER, ROLES.OPERATOR];
