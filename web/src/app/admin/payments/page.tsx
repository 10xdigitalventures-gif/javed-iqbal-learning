"use client";

import { useEffect, useState } from "react";
import { api, signMedia } from "@/lib/api";
import { Badge, Card, Input, Select, Spinner } from "@/components/ui";
import {
  Pager,
  buildQuery,
  useDebounced,
  type Paged,
} from "@/components/list-controls";
import { PageHeader } from "@/components/shell";

type Payment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  kind: string;
  gateway?: string;
  proofKey?: string;
  senderName?: string;
  senderRef?: string;
  manualNote?: string;
  invoiceNo?: string;
  createdAt: string;
  user?: { name: string; email: string };
  purchase?: { package?: { name: string } };
};

type Order = {
  id: string;
  kind: string;
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
  user?: { name: string; email: string };
  book?: { title: string };
  bundle?: { title: string };
  plan?: { name: string };
};

const color: Record<string, any> = {
  PAID: "green",
  PENDING: "amber",
  FAILED: "red",
  CANCELLED: "slate",
  REFUNDED: "slate",
};

// Human friendly status label (PAID reads as "Succeeded" for orders).
const statusLabel: Record<string, string> = {
  PAID: "Succeeded",
  PENDING: "Pending",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

// Pretty names for the payment gateways shown in the Transactions tab.
const gatewayLabel: Record<string, string> = {
  gopayfast: "PayFast",
  payfast: "PayFast",
  whop: "Whop",
  mock: "Test checkout",
};

function tabCls(active: boolean) {
  return (
    "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors " +
    (active
      ? "border-orange-500 text-orange-600"
      : "border-transparent text-slate-500 hover:text-slate-700")
  );
}

function productName(o: Order) {
  return o.book?.title || o.bundle?.title || o.plan?.name || o.kind;
}

export default function AdminPayments() {
  const [tab, setTab] = useState<
    "orders" | "transactions" | "bank" | "hardcopy"
  >("orders");

  return (
    <div>
      <PageHeader title="Payments" subtitle="Orders and gateway transactions" />

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        <button
          className={tabCls(tab === "orders")}
          onClick={() => setTab("orders")}
        >
          Orders
        </button>
        <button
          className={tabCls(tab === "transactions")}
          onClick={() => setTab("transactions")}
        >
          Transactions
        </button>
        <button
          className={tabCls(tab === "bank")}
          onClick={() => setTab("bank")}
        >
          Bank transfers
        </button>
        <button
          className={tabCls(tab === "hardcopy")}
          onClick={() => setTab("hardcopy")}
        >
          Hard Copy
        </button>
      </div>

      {tab === "orders" ? (
        <OrdersTab />
      ) : tab === "transactions" ? (
        <TransactionsTab />
      ) : tab === "bank" ? (
        <BankTransfersTab />
      ) : (
        <HardCopyTab />
      )}
    </div>
  );
}

function OrdersTab() {
  const [data, setData] = useState<Paged<Order> | null>(null);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    const query = buildQuery({
      q: debouncedQ,
      status,
      sort,
      order,
      page,
      pageSize,
    });
    api<Paged<Order>>(`/orders/all/paged${query}`)
      .then(setData)
      .catch(() => setData({ rows: [], total: 0, page: 1, pageSize }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, sort, order, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, sort, order]);

  const rows = data?.rows ?? [];

  return (
    <div>
      <Card className="mb-3">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            label="Search"
            placeholder="Client, product..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="PAID">Succeeded</option>
            <option value="PENDING">Pending</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </Select>
          <Select
            label="Sort by"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="createdAt">Date</option>
            <option value="amount">Amount</option>
            <option value="status">Status</option>
          </Select>
          <Select
            label="Order"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </Select>
        </div>
      </Card>

      {!data ? (
        <Spinner />
      ) : (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">
                        {o.user?.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {o.user?.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">{productName(o)}</td>
                    <td className="px-4 py-3 text-slate-500">{o.kind}</td>
                    <td className="px-4 py-3">
                      {o.currency} {o.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={color[o.status]}>
                        {statusLabel[o.status] || o.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      No orders in this view
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Card>
          <Pager
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}

function TransactionsTab() {
  const [data, setData] = useState<Paged<Payment> | null>(null);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [status, setStatus] = useState("");
  const [gateway, setGateway] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    // channel=online keeps manual / bank-transfer methods out of this tab.
    const query = buildQuery({
      channel: "online",
      q: debouncedQ,
      status,
      gateway,
      sort,
      order,
      page,
      pageSize,
    });
    api<Paged<Payment>>(`/payments/all/paged${query}`)
      .then(setData)
      .catch(() => setData({ rows: [], total: 0, page: 1, pageSize }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, gateway, sort, order, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, gateway, sort, order]);

  const rows = data?.rows ?? [];

  return (
    <div>
      <Card className="mb-3">
        <div className="grid gap-3 md:grid-cols-5">
          <Input
            label="Search"
            placeholder="Invoice, client..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select
            label="Gateway"
            value={gateway}
            onChange={(e) => setGateway(e.target.value)}
          >
            <option value="">All gateways</option>
            <option value="gopayfast">PayFast</option>
            <option value="whop">Whop</option>
            <option value="mock">Test checkout</option>
          </Select>
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="PAID">Succeeded</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </Select>
          <Select
            label="Sort by"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="createdAt">Date</option>
            <option value="amount">Amount</option>
            <option value="status">Status</option>
          </Select>
          <Select
            label="Order"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </Select>
        </div>
      </Card>

      {!data ? (
        <Spinner />
      ) : (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Gateway</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Kind</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">
                      {p.invoiceNo}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">
                        {p.user?.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {p.user?.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color="slate">
                        {gatewayLabel[(p.gateway || "").toLowerCase()] ||
                          p.gateway ||
                          "Gateway"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {p.currency} {p.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{p.kind}</td>
                    <td className="px-4 py-3">
                      <Badge color={color[p.status]}>{p.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      No gateway transactions yet
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Card>
          <Pager
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}

function BankTransfersTab() {
  const [data, setData] = useState<Paged<Payment> | null>(null);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [preview, setPreview] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    const query = buildQuery({
      channel: "bank",
      q: debouncedQ,
      status,
      sort,
      order,
      page,
      pageSize,
    });
    api<Paged<Payment>>(`/payments/all/paged${query}`)
      .then(setData)
      .catch(() => setData({ rows: [], total: 0, page: 1, pageSize }));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, sort, order, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, sort, order]);

  async function viewReceipt(key?: string) {
    if (!key) return;
    setPreviewBusy(true);
    setError(null);
    try {
      const url = await signMedia(key);
      setPreview(url);
    } catch {
      setError("Could not load the receipt image.");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function accept(id: string) {
    if (!confirm("Mark this bank transfer as verified and grant access?"))
      return;
    setBusyId(id);
    setError(null);
    try {
      await api("/payments/" + id + "/verify", { method: "POST" });
      load();
    } catch (e: any) {
      setError(e?.message || "Could not verify the payment.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason = prompt("Reason for rejecting (optional):") || undefined;
    setBusyId(id);
    setError(null);
    try {
      await api("/payments/" + id + "/reject", {
        method: "POST",
        body: { reason },
      });
      load();
    } catch (e: any) {
      setError(e?.message || "Could not reject the payment.");
    } finally {
      setBusyId(null);
    }
  }

  const rows = data?.rows ?? [];

  return (
    <div>
      {error ? (
        <p className="mb-3 text-sm font-medium text-red-600">{error}</p>
      ) : null}

      <Card className="mb-3">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            label="Search"
            placeholder="Client, sender, ref..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Verified</option>
            <option value="FAILED">Rejected</option>
          </Select>
          <Select
            label="Sort by"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="createdAt">Date</option>
            <option value="amount">Amount</option>
            <option value="status">Status</option>
          </Select>
          <Select
            label="Order"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </Select>
        </div>
      </Card>

      {!data ? (
        <Spinner />
      ) : (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Sender / Ref</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Receipt</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 align-top"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">
                        {p.user?.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {p.user?.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.currency} {p.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">
                        {p.senderName || "\u2014"}
                      </div>
                      <div className="font-mono text-xs text-slate-400">
                        {p.senderRef || ""}
                      </div>
                    </td>
                    <td className="max-w-[200px] px-4 py-3 text-xs text-slate-500">
                      {p.manualNote || "\u2014"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={color[p.status]}>{p.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {p.proofKey ? (
                        <button
                          onClick={() => viewReceipt(p.proofKey)}
                          disabled={previewBusy}
                          className="text-xs font-semibold text-orange-600 hover:underline disabled:opacity-50"
                        >
                          View receipt
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">
                          No receipt
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.status === "PENDING" ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => accept(p.id)}
                            disabled={busyId === p.id}
                            className="rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => reject(p.id)}
                            disabled={busyId === p.id}
                            className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          No action needed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      No bank transfers yet
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Card>
          <Pager
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={setPage}
          />
        </>
      )}

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="max-h-[85vh] max-w-2xl overflow-auto rounded-lg bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Transfer receipt"
              className="max-h-[80vh] w-auto rounded"
            />
            <p className="py-2 text-center text-xs text-slate-400">
              Click anywhere to close
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const hcPayLabel: Record<string, string> = {
  payfast: "PayFast",
  whop: "Whop",
  bank_transfer: "Bank Transfer",
  cod: "Cash on Delivery",
};

const hcStatusColor: Record<string, any> = {
  PENDING: "amber",
  PROCESSING: "blue",
  SHIPPED: "blue",
  DELIVERED: "green",
  CANCELLED: "slate",
};

const HC_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

type HardCopyOrder = {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  quantity: number;
  status: string;
  paymentMethod?: string;
  createdAt: string;
  user?: { name: string; email: string };
  book?: { title: string };
};

function HardCopyTab() {
  const [rows, setRows] = useState<HardCopyOrder[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api<HardCopyOrder[]>("/hardcopy-orders/all")
      .then(setRows)
      .catch(() => setRows([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function changeStatus(id: string, status: string) {
    setBusyId(id);
    setError(null);
    try {
      await api("/hardcopy-orders/" + id + "/status", {
        method: "PATCH",
        body: { status },
      });
      load();
    } catch (e: any) {
      setError(e?.message || "Could not update the order.");
    } finally {
      setBusyId(null);
    }
  }

  const list = rows ?? [];

  return (
    <div>
      {error ? (
        <p className="mb-3 text-sm font-medium text-red-600">{error}</p>
      ) : null}

      {!rows ? (
        <Spinner />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Book</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Delivery</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{o.name}</div>
                    <div className="text-xs text-slate-400">{o.phone}</div>
                    {o.user?.email ? (
                      <div className="text-xs text-slate-400">
                        {o.user.email}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{o.book?.title || "\u2014"}</td>
                  <td className="px-4 py-3">{o.quantity}</td>
                  <td className="max-w-[220px] px-4 py-3 text-xs text-slate-500">
                    {o.address}, {o.city}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color="slate">
                      {hcPayLabel[o.paymentMethod || "cod"] ||
                        o.paymentMethod ||
                        "Cash on Delivery"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="mb-1">
                      <Badge color={hcStatusColor[o.status] || "slate"}>
                        {o.status}
                      </Badge>
                    </div>
                    <select
                      value={o.status}
                      disabled={busyId === o.id}
                      onChange={(e) => changeStatus(o.id, e.target.value)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs disabled:opacity-50"
                    >
                      {HC_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {list.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No hard copy orders yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
