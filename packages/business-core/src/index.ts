export const permissions = {
  'pos:create': 'Create sales',
  'pos:view': 'View POS',
  'products:view': 'View products',
  'products:create': 'Create products',
  'reports:view': 'View reports',
} as const;

export function checkPermission(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes('*')) return true;
  return userPermissions.some(
    (p) => p === required || (p.endsWith(':*') && required.startsWith(p.replace(':*', '')))
  );
}
