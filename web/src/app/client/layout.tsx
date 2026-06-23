import { Shell } from "@/components/shell";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Shell role="CLIENT">{children}</Shell>;
}
