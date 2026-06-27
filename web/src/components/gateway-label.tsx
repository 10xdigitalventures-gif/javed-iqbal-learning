// Human-friendly label for a payment gateway key.
export function GatewayLabel(key: string): string {
  const labels: Record<string, string> = {
    gopayfast: "PayFast \u2013 Card, wallet & bank (PKR)",
    whop: "Whop \u2013 Card, BNPL & Crypto (USD)",
    mock: "Test payment (sandbox)",
  };
  return labels[key] || key;
}
