"use client";

// Branded invoice / receipt generator for the client Payments screen.
// Produces a self-contained, print-optimised HTML document styled to the
// Dr. Javed Iqbal brand guideline (orange #FF9100 accent, near-black #0F0F0F,
// light grey #F0F0F0, Inter typeface) and opens it in a print window so the
// user can "Save as PDF" or print. No external/runtime dependencies.

export type DocPayment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  kind: string;
  gateway?: string;
  reference?: string | null;
  invoiceNo?: string | null;
  receiptNo?: string | null;
  createdAt: string;
  itemName?: string | null;
};

export type DocBusiness = {
  name: string;
  supportEmail?: string;
  website?: string;
};

export type DocCustomer = {
  name?: string;
  email?: string;
  phone?: string;
};

const BRAND = {
  orange: "#FF9100",
  black: "#0F0F0F",
  grey: "#F0F0F0",
  white: "#FFFFFF",
};

const GATEWAY_LABEL: Record<string, string> = {
  gopayfast: "PayFast",
  whop: "Whop",
  bank_transfer: "Bank transfer",
  cod: "Cash on delivery",
  mock: "Test gateway",
};

function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(amount: number, currency: string): string {
  return `${esc(currency)} ${Number(amount || 0).toLocaleString()}`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function gatewayLabel(g?: string): string {
  if (!g) return "\u2014";
  return GATEWAY_LABEL[g] || g;
}

// Shared document shell. `kind` decides the heading + which blocks show.
function buildHtml(
  kind: "invoice" | "receipt",
  payment: DocPayment,
  business: DocBusiness,
  customer: DocCustomer,
): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const logo = `${origin}/brand/logo-light.png`;
  const isReceipt = kind === "receipt";
  const title = isReceipt ? "RECEIPT" : "INVOICE";
  const docNo = isReceipt
    ? payment.receiptNo ||
      payment.invoiceNo ||
      payment.id.slice(0, 10).toUpperCase()
    : payment.invoiceNo || payment.id.slice(0, 10).toUpperCase();
  const paid = payment.status === "PAID";
  const statusColor = paid
    ? "#16A34A"
    : payment.status === "FAILED"
      ? "#DC2626"
      : BRAND.orange;

  const paymentRows = isReceipt
    ? `
      <tr><td>Receipt no</td><td>${esc(payment.receiptNo || docNo)}</td></tr>
      <tr><td>Invoice no</td><td>${esc(payment.invoiceNo || "\u2014")}</td></tr>
      <tr><td>Payment method</td><td>${esc(gatewayLabel(payment.gateway))}</td></tr>
      <tr><td>Transaction reference</td><td>${esc(payment.reference || "\u2014")}</td></tr>
      <tr><td>Paid on</td><td>${esc(fmtDate(payment.createdAt))}</td></tr>`
    : `
      <tr><td>Issue date</td><td>${esc(fmtDate(payment.createdAt))}</td></tr>
      <tr><td>Payment method</td><td>${esc(gatewayLabel(payment.gateway))}</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} ${esc(docNo)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: ${BRAND.grey}; }
body {
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: ${BRAND.black};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.sheet {
  max-width: 780px;
  margin: 24px auto;
  background: ${BRAND.white};
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(15,15,15,0.10);
}
.header {
  background: ${BRAND.black};
  color: ${BRAND.white};
  padding: 28px 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.header img { height: 42px; width: auto; display: block; }
.header .doc-title {
  text-align: right;
}
.header .doc-title h1 {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 3px;
  color: ${BRAND.orange};
}
.header .doc-title p { font-size: 12px; color: #C9C9C9; margin-top: 2px; }
.accent { height: 5px; background: ${BRAND.orange}; }
.body { padding: 32px 36px; }
.grid {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 28px;
}
.grid h3 {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #8A8A8A;
  margin-bottom: 8px;
}
.grid p { font-size: 14px; line-height: 1.5; }
.grid .name { font-weight: 700; font-size: 15px; }
.status-pill {
  display: inline-block;
  padding: 5px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #fff;
  background: ${statusColor};
}
table.items {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
}
table.items th {
  text-align: left;
  background: ${BRAND.grey};
  color: #4B4B4B;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 12px 14px;
}
table.items th.right, table.items td.right { text-align: right; }
table.items td {
  padding: 16px 14px;
  border-bottom: 1px solid ${BRAND.grey};
  font-size: 14px;
}
.totals {
  margin-top: 18px;
  margin-left: auto;
  width: 280px;
}
.totals table { width: 100%; border-collapse: collapse; }
.totals td { padding: 8px 14px; font-size: 14px; }
.totals tr.grand td {
  border-top: 2px solid ${BRAND.black};
  font-weight: 800;
  font-size: 17px;
  padding-top: 12px;
}
.totals tr.grand td.right { color: ${BRAND.orange}; }
.meta {
  margin-top: 30px;
  border: 1px solid ${BRAND.grey};
  border-radius: 12px;
  overflow: hidden;
}
.meta table { width: 100%; border-collapse: collapse; }
.meta td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid ${BRAND.grey}; }
.meta tr:last-child td { border-bottom: none; }
.meta td:first-child { color: #8A8A8A; width: 45%; }
.meta td:last-child { font-weight: 600; text-align: right; }
.footer {
  padding: 22px 36px 30px;
  border-top: 1px solid ${BRAND.grey};
  color: #8A8A8A;
  font-size: 12px;
  text-align: center;
  line-height: 1.6;
}
.footer strong { color: ${BRAND.black}; }
.print-hint {
  text-align: center;
  margin: 16px auto 0;
  max-width: 780px;
}
.print-hint button {
  background: ${BRAND.orange};
  color: #fff;
  border: none;
  border-radius: 999px;
  padding: 12px 28px;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
}
@media print {
  html, body { background: #fff; }
  .sheet { margin: 0; box-shadow: none; border-radius: 0; max-width: none; }
  .print-hint { display: none; }
}
</style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <img src="${logo}" alt="${esc(business.name)}" onerror="this.style.display='none'" />
      <div class="doc-title">
        <h1>${title}</h1>
        <p>#${esc(docNo)}</p>
      </div>
    </div>
    <div class="accent"></div>
    <div class="body">
      <div class="grid">
        <div>
          <h3>From</h3>
          <p class="name">${esc(business.name)}</p>
          ${business.supportEmail ? `<p>${esc(business.supportEmail)}</p>` : ""}
          ${business.website ? `<p>${esc(business.website)}</p>` : ""}
        </div>
        <div>
          <h3>Billed to</h3>
          <p class="name">${esc(customer.name || "\u2014")}</p>
          ${customer.email ? `<p>${esc(customer.email)}</p>` : ""}
          ${customer.phone ? `<p>${esc(customer.phone)}</p>` : ""}
        </div>
        <div style="text-align:right">
          <h3>Status</h3>
          <span class="status-pill">${esc(payment.status)}</span>
        </div>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th>Description</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${esc(payment.itemName || "Purchase")}</td>
            <td class="right">${money(payment.amount, payment.currency)}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <table>
          <tr><td>Subtotal</td><td class="right">${money(payment.amount, payment.currency)}</td></tr>
          <tr class="grand"><td>Total</td><td class="right">${money(payment.amount, payment.currency)}</td></tr>
        </table>
      </div>

      <div class="meta">
        <table>${paymentRows}</table>
      </div>
    </div>
    <div class="footer">
      ${
        isReceipt
          ? paid
            ? "This is an official receipt confirming your payment. Thank you!"
            : "This document reflects the current payment status."
          : "Thank you for your purchase. Please retain this invoice for your records."
      }<br />
      <strong>${esc(business.name)}</strong>${business.supportEmail ? ` \u00b7 ${esc(business.supportEmail)}` : ""}
    </div>
  </div>
  <div class="print-hint">
    <button onclick="window.print()">Download / Print</button>
  </div>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 400); });</script>
</body>
</html>`;
}

function openDocument(html: string) {
  const win = window.open("", "_blank");
  if (!win) {
    // Popup blocked \u2014 fall back to a Blob download of the HTML document.
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "document.html";
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export function downloadInvoice(
  payment: DocPayment,
  business: DocBusiness,
  customer: DocCustomer,
) {
  openDocument(buildHtml("invoice", payment, business, customer));
}

export function downloadReceipt(
  payment: DocPayment,
  business: DocBusiness,
  customer: DocCustomer,
) {
  openDocument(buildHtml("receipt", payment, business, customer));
}
