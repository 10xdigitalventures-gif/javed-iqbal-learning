"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";

type Book = {
  id: string;
  title: string;
  slug: string;
  author: string;
  description?: string;
  coverUrl?: string;
  price: number;
  isPublished: boolean;
  isFeatured: boolean;
  contentKey?: string | null;
};

export default function EbooksAdminPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    author: "Prof. Dr. Javed Iqbal",
    description: "",
    coverUrl: "",
    price: 0,
    hardCopyPrice: 0,
    allowHardCopy: false,
    accessType: "LIFETIME",
    isFeatured: false,
    isPublished: true,
    categoryId: "",
    pageCount: 0,
    contentKey: "",
  });

  useEffect(() => {
    Promise.all([
      api<Book[]>("/books/all"),
      api<any[]>("/categories").catch(() => []),
    ])
      .then(([b, c]) => {
        setBooks(Array.isArray(b) ? b : []);
        setCategories(Array.isArray(c) ? c : []);
      })
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setForm({
      title: "", slug: "", author: "Prof. Dr. Javed Iqbal", description: "",
      coverUrl: "", price: 0, hardCopyPrice: 0, allowHardCopy: false,
      accessType: "LIFETIME", isFeatured: false, isPublished: true,
      categoryId: "", pageCount: 0, contentKey: "",
    });
    setEditing(null);
  }

  async function saveBook(e: React.FormEvent) {
    e.preventDefault();
    const body: any = { ...form, pageCount: Number(form.pageCount) };
    if (editing) {
      await api(`/books/${editing.id}`, { method: "PATCH", body });
    } else {
      await api("/books", { method: "POST", body });
    }
    resetForm();
    setShowForm(false);
    const d = await api<Book[]>("/books/all");
    setBooks(Array.isArray(d) ? d : []);
  }

  async function removeBook(id: string) {
    if (!confirm("Delete this e-book?")) return;
    await api(`/books/${id}`, { method: "DELETE" });
    setBooks(books.filter((b) => b.id !== id));
  }

  function editBook(b: Book) {
    setEditing(b);
    setForm({
      title: b.title || "",
      slug: b.slug || "",
      author: b.author || "Prof. Dr. Javed Iqbal",
      description: b.description || "",
      coverUrl: b.coverUrl || "",
      price: b.price || 0,
      hardCopyPrice: (b as any).hardCopyPrice || 0,
      allowHardCopy: (b as any).allowHardCopy || false,
      accessType: (b as any).accessType || "LIFETIME",
      isFeatured: b.isFeatured || false,
      isPublished: b.isPublished || false,
      categoryId: (b as any).categoryId || "",
      pageCount: (b as any).pageCount || 0,
      contentKey: b.contentKey || "",
    });
    setShowForm(true);
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="E-Books"
        subtitle="Upload and manage e-book content"
        action={
          <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
            <Plus className="h-4 w-4" />
            {showForm ? "Cancel" : "New E-Book"}
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={saveBook} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              <Input label="Slug (optional)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              <Input label="Author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
              <Input label="Cover Image URL" value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} />
              <Input label="Digital Price (PKR)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} />
              <Input label="Hard Copy Price (PKR)" type="number" value={form.hardCopyPrice} onChange={(e) => setForm({ ...form, hardCopyPrice: +e.target.value })} />
              <Input label="Page Count" type="number" value={form.pageCount} onChange={(e) => setForm({ ...form, pageCount: +e.target.value })} />
              <Select label="Category" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">No category</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Textarea
              label="Full E-Book Text Content"
              rows={10}
              placeholder="Paste the entire book text. Each line break becomes a paragraph in the reader. This content is encrypted and delivered securely."
              value={form.contentKey}
              onChange={(e) => setForm({ ...form, contentKey: e.target.value })}
            />
            <div className="flex flex-wrap gap-4">
              <Select label="Access Type" value={form.accessType} onChange={(e) => setForm({ ...form, accessType: e.target.value })}>
                <option value="LIFETIME">Lifetime (one-time purchase)</option>
                <option value="SUBSCRIPTION">Subscription</option>
              </Select>
              <label className="flex items-end pb-2 gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={form.allowHardCopy} onChange={(e) => setForm({ ...form, allowHardCopy: e.target.checked })} />
                Allow Hard Copy
              </label>
              <label className="flex items-end pb-2 gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
                Featured
              </label>
              <label className="flex items-end pb-2 gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
                Published
              </label>
            </div>
            <Button type="submit">{editing ? "Update E-Book" : "Create E-Book"}</Button>
          </form>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {books.map((b) => (
          <Card key={b.id}>
            <div className="flex gap-3">
              {b.coverUrl ? (
                <img src={b.coverUrl} alt="" className="h-20 w-16 rounded object-cover" />
              ) : (
                <div className="flex h-20 w-16 items-center justify-center rounded bg-brand-light">
                  <BookOpen className="h-6 w-6 text-brand" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-bold text-slate-950">{b.title}</h3>
                <p className="text-xs text-slate-500">{b.author}</p>
                <div className="mt-1 flex gap-2">
                  <Badge color="blue">Rs {b.price}</Badge>
                  <Badge color={b.isPublished ? "green" : "slate"}>{b.isPublished ? "Published" : "Draft"}</Badge>
                  {b.contentKey && <Badge color="amber">Has content</Badge>}
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={() => editBook(b)}>Edit</Button>
              <Button variant="danger" onClick={() => removeBook(b.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
        {books.length === 0 && (
          <p className="text-sm text-slate-500">No e-books yet. Create one above.</p>
        )}
      </div>
    </div>
  );
}
