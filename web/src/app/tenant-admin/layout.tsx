import { Shell } from "@/components/shell";

export default function TenantAdminLayout({ children }: { children: React.ReactNode }) {
  return <Shell role="TENANT_ADMIN">{children}</Shell>;
}
