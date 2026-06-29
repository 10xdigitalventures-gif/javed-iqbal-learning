import { ForbiddenException } from "@nestjs/common";
import { Role } from "@prisma/client";

export type AuthUser = {
  userId: string;
  email: string;
  role: Role;
  // Set when the JWT carries a device id (mobile). Used for device management
  // and concurrent-device enforcement.
  deviceRowId?: string;
};

export function isAdmin(user: AuthUser) {
  return user.role === Role.ADMIN;
}

export function isConsultant(user: AuthUser) {
  return user.role === Role.CONSULTANT;
}

export function isClient(user: AuthUser) {
  return user.role === Role.CLIENT;
}

// Ensure the acting user is one of the two participants (or an admin).
export function assertParticipant(
  user: AuthUser,
  clientId: string,
  consultantId: string,
) {
  if (isAdmin(user)) return;
  if (user.userId === clientId || user.userId === consultantId) return;
  throw new ForbiddenException("You are not a participant in this conversation");
}
