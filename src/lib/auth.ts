// Simple hardcoded authentication for internal use
// No database storage - credentials are hardcoded

export type UserRole = 'admin' | 'user';

export interface User {
  username: string;
  role: UserRole;
}

// Hardcoded credentials
const CREDENTIALS: Record<string, { password: string; role: UserRole }> = {
  admin: { password: 'admin123', role: 'admin' },
  user: { password: 'user123', role: 'user' },
};

// Routes accessible by each role
export const ROLE_ACCESS: Record<UserRole, string[]> = {
  admin: ['/', '/pos', '/invoices', '/inventory', '/customers', '/employees', '/reports', '/sms'],
  user: ['/pos', '/invoices', '/inventory', '/customers', '/sms'],
};

// Default redirect for each role after login
export const DEFAULT_ROUTE: Record<UserRole, string> = {
  admin: '/',
  user: '/pos',
};

/**
 * Validate credentials and return user if valid
 */
export function validateCredentials(username: string, password: string): User | null {
  const cred = CREDENTIALS[username.toLowerCase()];
  if (cred && cred.password === password) {
    return { username: username.toLowerCase(), role: cred.role };
  }
  return null;
}

/**
 * Check if a user role can access a given path
 */
export function canAccessRoute(role: UserRole, path: string): boolean {
  const allowedRoutes = ROLE_ACCESS[role];
  // Check if path starts with any allowed route
  return allowedRoutes.some(route => {
    if (route === '/') return path === '/';
    return path === route || path.startsWith(route + '/');
  });
}

// Session storage key
export const AUTH_STORAGE_KEY = 'mahesh_auto_auth';
