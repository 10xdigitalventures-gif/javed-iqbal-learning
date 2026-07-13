import type { Role } from "./types";

// Human-friendly, trackable member code derived deterministically from the
// user's database id. 1:1 with the real id (which is what URLs, activity logs
// and support tickets key off), but shorter and role-prefixed for display in
// the admin panel. No storage/migration needed.
const PREFIX: Record<Role, string> = {
  ADMIN: "ADM",
  SUPPORT: "SUP",
  TENANT_ADMIN: "TEN",
  CONSULTANT: "CON",
  CLIENT: "CLT",
};

export function memberCode(role: Role, id: string): string {
  const prefix = PREFIX[role] || "USR";
  // Last 8 chars of the cuid, uppercased — stable and unique per user.
  const tail = id
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-8)
    .toUpperCase();
  return `${prefix}-${tail}`;
}
