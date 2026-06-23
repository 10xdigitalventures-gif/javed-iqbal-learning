// Human-friendly label for a payment gateway key.
export function GatewayLabel(key: string): string {
  const labels: Record<string, string> = {
    gopayfast: "GoPayFast",
    whop: "Whop",
    mock: "Test (dev)",
  };
  return labels[key] || key;
}
