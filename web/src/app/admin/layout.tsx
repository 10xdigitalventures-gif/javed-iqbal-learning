import { Shell } from "@/components/shell";
import type { Role } from "@/lib/types";

// The admin portal is shared by full ADMINs and limited SUPPORT staff. Access
// to individual actions is still enforced per-endpoint on the backend.
const ADMIN_PORTAL_ROLES: Role[] = ["ADMIN", "SUPPORT"];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Shell role={ADMIN_PORTAL_ROLES}>{children}</Shell>;
}
