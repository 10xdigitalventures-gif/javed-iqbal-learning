// Permission scopes for admin-portal staff (the SUPPORT role). ADMIN users
// implicitly hold every scope; SUPPORT users only hold the scopes listed on
// their user record. This lets us grant e.g. reply/assign while withholding
// destructive actions like delete.
export const SUPPORT_SCOPES = {
  VIEW: "support:view",
  REPLY: "support:reply",
  ASSIGN: "support:assign",
  STATUS: "support:status",
  DELETE: "support:delete",
} as const;

export type SupportScope = (typeof SUPPORT_SCOPES)[keyof typeof SUPPORT_SCOPES];

export const ALL_SUPPORT_SCOPES: string[] = Object.values(SUPPORT_SCOPES);

// Default scope set applied to a newly created support agent: everything
// except the destructive delete scope.
export const DEFAULT_SUPPORT_AGENT_SCOPES: string[] = [
  SUPPORT_SCOPES.VIEW,
  SUPPORT_SCOPES.REPLY,
  SUPPORT_SCOPES.ASSIGN,
  SUPPORT_SCOPES.STATUS,
];
