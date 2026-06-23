import { Shell } from "@/components/shell";

export default function ConsultantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Shell role="CONSULTANT">{children}</Shell>;
}
