"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Input,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { OfferManager } from "@/components/offer-manager";

type Bundle = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  price: number;
  currency: string;
  isFeatured: boolean;
  isPublished: boolean;
  items?: { book: { id: string; title: string } }[];
};

const EMPTY = {
  title: "",
  description: "",
  price: 0,
  currency: "PKR",
  isFeatured: false,
  isPublished: true,
  bookIds: [] as string[],
};

export default function AdminBundles() {
  const [list, setList] = useState<Bundle[] | null>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [offersFor, setOffersFor] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setList(await api<Bundle[]>("/books/bundles/all"));
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    api<any>("/books/all/paged?pageSize=500")
      .then((d) => setBooks(Array.isArray(d?.rows) ? d.rows : []))
      .catch(() => setBooks([]));
  }, []);

  function startNew() {
    setError(null);
    setEditingId(null);
    setForm({ ...EMPTY });
    setShow(true);
  }

  function startEdit(b: Bundle) {
    setError(null);
    setEditingId(b.id);
    setForm({
      title: b.title,
      description: b.description || "",
      price: b.price,
      currency: b.currency,
      isFeatured: b.isFeatured,
      isPublished: b.isPublished,
      bookIds: (b.items || []).map((i) => i.book.id),
    });
    setShow(true);
  }

  function toggleBook(id: string) {
    setForm((f) => ({
      ...f,
      bookIds: f.bookIds.includes(id)
        ? f.bookIds.filter((x) => x !== id)
        : [...f.bookIds, id],
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        title: form.title,
        description: form.description || null,
        price: Number(form.price) || 0,
        currency: form.currency || "PKR",
        isFeatured: form.isFeatured,
        isPublished: form.isPublished,
        bookIds: form.bookIds,
      };
      if (editingId) {
        await api(`/books/bundles/${editingId}`, { method: "PATCH", body });
      } else {
        await api("/books/bundles", { method: "POST", body });
      }
      setShow(false);
      setEditingId(null);
      setForm({ ...EMPTY });
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this bundle? This also removes its offers.")) return;
    await api(`/books/bundles/${id}`, { method: "DELETE" });
    load();
  }

  if (!list) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Bundles"
        subtitle="Group books into bundles and set purchasable offers"
        action={<Button onClick={startNew}>Add bundle</Button>}
      />
      <ErrorText message={error} />

      {show ? (
        <Card className="mb-4">
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <Input
              label="Price"
              type="number"
              value={String(form.price)}
              onChange={(e) =>
                setForm({ ...form, price: Number(e.target.value) })
              }
            />
            <Select
              label="Published"
              value={form.isPublished ? "true" : "false"}
              onChange={(e) =>
                setForm({ ...form, isPublished: e.target.value === "true" })
              }
            >
              <option value="true">Published</option>
              <option value="false">Draft</option>
            </Select>
            <Select
              label="Featured"
              value={form.isFeatured ? "true" : "false"}
              onChange={(e) =>
                setForm({ ...form, isFeatured: e.target.value === "true" })
              }
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </Select>
            <div className="col-span-2">
              <Textarea
                label="Description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="col-span-2">
              <p className="mb-1 text-sm font-medium text-slate-700">
                Books in this bundle
              </p>
              <div className="max-h-48 overflow-auto rounded-xl border border-slate-200 p-2">
                {books.length === 0 ? (
                  <p className="text-sm text-slate-500">No books found.</p>
                ) : (
                  books.map((b: any) => (
                    <label
                      key={b.id}
                      className="flex items-center gap-2 py-1 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={form.bookIds.includes(b.id)}
                        onChange={() => toggleBook(b.id)}
                      />
                      {b.title}
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="col-span-2 flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy
                  ? "Saving..."
                  : editingId
                    ? "Save bundle"
                    : "Create bundle"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShow(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {list.map((b) => (
          <Card key={b.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  <Package className="h-4 w-4 text-brand" /> {b.title}
                </p>
                <p className="text-sm text-slate-500">
                  {(b.items || []).length} book(s)
                </p>
              </div>
              <Badge color={b.isPublished ? "green" : "slate"}>
                {b.currency} {b.price}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => startEdit(b)}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                variant="outline"
                onClick={() => setOffersFor((v) => (v === b.id ? null : b.id))}
              >
                {offersFor === b.id ? "Hide offers" : "Manage offers"}
              </Button>
              <Button variant="danger" onClick={() => remove(b.id)}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
            </div>
            {offersFor === b.id ? (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <OfferManager
                  parentId={b.id}
                  parentKey="bundleId"
                  listUrl={`/books/bundles/${b.id}/offers`}
                  createUrl="/books/bundle-offers"
                  mutateBase="/books/bundle-offers"
                  label="Bundle offers"
                  hint="Sell this bundle at different prices / access windows."
                />
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
