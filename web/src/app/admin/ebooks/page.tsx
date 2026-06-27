"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Plus,
  Trash2,
  FileText,
  Music,
  ChevronUp,
  ChevronDown,
  Save,
  Loader2,
} from "lucide-react";
import { api, uploadFile, API_URL, getToken } from "@/lib/api";
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
import {
  Pager,
  buildQuery,
  useDebounced,
  type Paged,
} from "@/components/list-controls";

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

type AdminChapter = {
  id: string;
  index: number;
  title: string;
  contentKey?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
};

// Uploaded media keys look like "media/123-456.m4a" or "123-456.m4a"; book text
// content is long free text. Treat short, single-line, extension-ending values
// as media (audio) keys so the editor shows a player chip instead of raw text.
function isMediaKey(v?: string | null): boolean {
  if (!v) return false;
  const t = v.trim();
  return t.length < 200 && !t.includes("\n") && /\.[a-z0-9]{2,4}$/i.test(t);
}

function ChapterManager({ bookId }: { bookId: string }) {
  const [chapters, setChapters] = useState<AdminChapter[]>([]);
  // When true, the next PDF import runs through server-side OCR (for scanned or
  // non-Unicode Urdu PDFs) instead of fast text extraction.
  const importOcrRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const d = await api<AdminChapter[]>(`/books/${bookId}/chapters/admin`);
      setChapters(
        Array.isArray(d) ? [...d].sort((a, b) => a.index - b.index) : [],
      );
    } catch (e: any) {
      setError(e.message || "Failed to load chapters");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  function patchLocal(id: string, patch: Partial<AdminChapter>) {
    setChapters((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function addChapter() {
    setError(null);
    try {
      await api(`/books/${bookId}/chapters`, {
        method: "POST",
        body: {
          index: chapters.length,
          title: `Chapter ${chapters.length + 1}`,
          contentKey: "",
        },
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function saveChapter(c: AdminChapter) {
    setBusyId(c.id);
    setError(null);
    try {
      await api(`/books/${bookId}/chapters`, {
        method: "POST",
        body: {
          index: c.index,
          title: c.title || "Untitled",
          contentKey: c.contentKey || "",
        },
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function removeChapter(c: AdminChapter) {
    if (!confirm(`Delete "${c.title}"?`)) return;
    try {
      await api(`/chapters/${c.id}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function move(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= chapters.length) return;
    const order = [...chapters];
    const [item] = order.splice(idx, 1);
    order.splice(next, 0, item);
    setChapters(order.map((c, i) => ({ ...c, index: i })));
    try {
      await api(`/books/${bookId}/chapters/reorder`, {
        method: "PUT",
        body: { chapterIds: order.map((c) => c.id) },
      });
      await load();
    } catch (e: any) {
      setError(e.message);
      await load();
    }
  }

  async function uploadChapterAudio(c: AdminChapter, file: File) {
    setBusyId(c.id);
    setError(null);
    try {
      const res = await uploadFile(file);
      patchLocal(c.id, { contentKey: res.key });
      await api(`/books/${bookId}/chapters`, {
        method: "POST",
        body: {
          index: c.index,
          title: c.title || "Untitled",
          contentKey: res.key,
        },
      });
      await load();
    } catch (e: any) {
      setError(e.message || "Audio upload failed");
    } finally {
      setBusyId(null);
    }
  }

  async function importPdf(file: File, replace: boolean, ocr = false) {
    setImporting(true);
    setImportMsg(null);
    setError(null);
    try {
      const token = getToken();
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `${API_URL}/books/${bookId}/import-pdf?replace=${replace}&ocr=${ocr}`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        },
      );
      if (!res.ok) {
        let m = "PDF import failed";
        try {
          const j = await res.json();
          m = Array.isArray(j.message) ? j.message.join(", ") : j.message || m;
        } catch {
          // ignore json parse error
        }
        throw new Error(m);
      }
      const data = await res.json();
      setImportMsg(
        `Imported ${data.created} chapter(s) from ${
          data.pages ?? "?"
        } pages. Now rename, reorder or edit each one below as you like.`,
      );
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-slate-950">Chapters</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={addChapter}>
            <Plus className="h-4 w-4" /> Add Chapter
          </Button>
          <Button
            variant="outline"
            onClick={() => pdfInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Import PDF (auto chapters)
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              importOcrRef.current = true;
              pdfInputRef.current?.click();
            }}
            disabled={importing}
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Import PDF (Urdu OCR)
          </Button>
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const ocr = importOcrRef.current;
              importOcrRef.current = false;
              const replace =
                chapters.length === 0 ||
                confirm(
                  "Replace existing chapters with the PDF content? Click Cancel to append instead.",
                );
              importPdf(f, replace, ocr);
            }}
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Upload a PDF to auto-split it into chapters, then rename, reorder or
        edit each one. For audiobooks, upload an audio file per chapter — it is
        compressed automatically on the server.
      </p>
      {importMsg && (
        <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {importMsg}
        </p>
      )}
      <div className="mt-2">
        <ErrorText message={error} />
      </div>

      {loading ? (
        <Spinner />
      ) : chapters.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No chapters yet. Add one manually or import a PDF.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {chapters.map((c, idx) => {
            const audio = isMediaKey(c.contentKey);
            return (
              <div
                key={c.id}
                className="rounded-lg border border-slate-200 p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">
                    #{idx + 1}
                  </span>
                  <input
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    value={c.title}
                    onChange={(e) =>
                      patchLocal(c.id, { title: e.target.value })
                    }
                    placeholder="Chapter title"
                  />
                  <Button
                    variant="ghost"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => move(idx, 1)}
                    disabled={idx === chapters.length - 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>

                {audio ? (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-brand-light px-3 py-2 text-sm text-brand-dark">
                    <Music className="h-4 w-4" />
                    <span className="flex-1 truncate">
                      Audio file: {c.contentKey}
                    </span>
                    <button
                      type="button"
                      className="text-xs underline"
                      onClick={() => patchLocal(c.id, { contentKey: "" })}
                    >
                      Switch to text
                    </button>
                  </div>
                ) : (
                  <Textarea
                    className="mt-3"
                    rows={6}
                    placeholder="Chapter text. Each line break becomes a paragraph in the reader."
                    value={c.contentKey || ""}
                    onChange={(e) =>
                      patchLocal(c.id, { contentKey: e.target.value })
                    }
                  />
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => saveChapter(c)}
                    disabled={busyId === c.id}
                  >
                    {busyId === c.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
                    <Music className="h-4 w-4" />
                    {audio ? "Replace audio" : "Upload audio"}
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadChapterAudio(c, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <Button variant="danger" onClick={() => removeChapter(c)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default function EbooksAdminPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 12 });
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search / filter / sort / pagination state.
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [bookAudioBusy, setBookAudioBusy] = useState(false);
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

  function loadBooks() {
    const query = buildQuery({
      q: debouncedQ,
      status,
      categoryId,
      sort,
      order,
      page,
      pageSize,
    });
    return api<Paged<Book>>(`/books/all/paged${query}`)
      .then((d) => {
        setBooks(Array.isArray(d.rows) ? d.rows : []);
        setMeta({ total: d.total, page: d.page, pageSize: d.pageSize });
      })
      .catch(() => setBooks([]));
  }

  useEffect(() => {
    api<any[]>("/categories")
      .then((c) => setCategories(Array.isArray(c) ? c : []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    loadBooks().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, categoryId, sort, order, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, categoryId, sort, order]);

  function resetForm() {
    setForm({
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
    setEditing(null);
  }

  async function saveBook(e: React.FormEvent) {
    e.preventDefault();
    const body: any = { ...form, pageCount: Number(form.pageCount) };
    if (editing) {
      await api(`/books/${editing.id}`, { method: "PATCH", body });
    } else {
      const created = await api<Book>("/books", { method: "POST", body });
      // Keep the form open in edit mode so the admin can immediately manage
      // chapters / import a PDF for the freshly created book.
      if (created?.id) setEditing(created);
    }
    await loadBooks();
  }

  async function removeBook(id: string) {
    if (!confirm("Delete this e-book?")) return;
    await api(`/books/${id}`, { method: "DELETE" });
    await loadBooks();
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

  async function uploadBookAudio(file: File) {
    setBookAudioBusy(true);
    try {
      const res = await uploadFile(file);
      setForm((f) => ({ ...f, contentKey: res.key }));
    } catch (e: any) {
      alert(e.message || "Upload failed");
    } finally {
      setBookAudioBusy(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="E-Books"
        subtitle="Upload and manage e-book content"
        action={
          <Button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
          >
            <Plus className="h-4 w-4" />
            {showForm ? "Cancel" : "New E-Book"}
          </Button>
        }
      />

      {showForm && (
        <>
          <Card className="mb-4">
            <form onSubmit={saveBook} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
                <Input
                  label="Slug (optional)"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
                <Input
                  label="Author"
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                />
                <Input
                  label="Cover Image URL"
                  value={form.coverUrl}
                  onChange={(e) =>
                    setForm({ ...form, coverUrl: e.target.value })
                  }
                />
                <Input
                  label="Digital Price (PKR)"
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: +e.target.value })}
                />
                <Input
                  label="Hard Copy Price (PKR)"
                  type="number"
                  value={form.hardCopyPrice}
                  onChange={(e) =>
                    setForm({ ...form, hardCopyPrice: +e.target.value })
                  }
                />
                <Input
                  label="Page Count"
                  type="number"
                  value={form.pageCount}
                  onChange={(e) =>
                    setForm({ ...form, pageCount: +e.target.value })
                  }
                />
                <Select
                  label="Category"
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm({ ...form, categoryId: e.target.value })
                  }
                >
                  <option value="">No category</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Textarea
                label="Description"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />

              {isMediaKey(form.contentKey) ? (
                <div className="flex items-center gap-2 rounded-lg bg-brand-light px-3 py-2 text-sm text-brand-dark">
                  <Music className="h-4 w-4" />
                  <span className="flex-1 truncate">
                    Single-file audiobook: {form.contentKey}
                  </span>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => setForm({ ...form, contentKey: "" })}
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <Textarea
                  label="Full E-Book Text Content (single-file books only)"
                  rows={8}
                  placeholder="Paste the entire book text here, OR leave this empty and use per-chapter content / PDF import below. Each line break becomes a paragraph in the reader."
                  value={form.contentKey}
                  onChange={(e) =>
                    setForm({ ...form, contentKey: e.target.value })
                  }
                />
              )}

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
                  {bookAudioBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Music className="h-4 w-4" />
                  )}
                  Upload single-file audiobook
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadBookAudio(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="text-xs text-slate-500">
                  Tip: for multi-chapter books or audiobooks, save first and use
                  the chapter editor below.
                </span>
              </div>

              <div className="flex flex-wrap gap-4">
                <Select
                  label="Access Type"
                  value={form.accessType}
                  onChange={(e) =>
                    setForm({ ...form, accessType: e.target.value })
                  }
                >
                  <option value="LIFETIME">Lifetime (one-time purchase)</option>
                  <option value="SUBSCRIPTION">Subscription</option>
                </Select>
                <label className="flex items-end gap-2 pb-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.allowHardCopy}
                    onChange={(e) =>
                      setForm({ ...form, allowHardCopy: e.target.checked })
                    }
                  />
                  Allow Hard Copy
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) =>
                      setForm({ ...form, isFeatured: e.target.checked })
                    }
                  />
                  Featured
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={(e) =>
                      setForm({ ...form, isPublished: e.target.checked })
                    }
                  />
                  Published
                </label>
              </div>
              <div className="flex gap-2">
                <Button type="submit">
                  {editing ? "Update E-Book" : "Create E-Book"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                >
                  Close
                </Button>
              </div>
            </form>
          </Card>

          {editing ? (
            <ChapterManager bookId={editing.id} />
          ) : (
            <p className="mb-6 text-sm text-slate-500">
              Save the e-book first to add chapters, import a PDF, or upload
              audiobook files.
            </p>
          )}
        </>
      )}

      <Card className="mt-6">
        <div className="grid gap-3 md:grid-cols-5">
          <Input
            label="Search"
            placeholder="Title or author"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select
            label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </Select>
          <Select
            label="Sort by"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="createdAt">Date added</option>
            <option value="title">Title</option>
            <option value="price">Price</option>
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

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {books.map((b) => (
          <Card key={b.id}>
            <div className="flex gap-3">
              {b.coverUrl ? (
                <img
                  src={b.coverUrl}
                  alt=""
                  className="h-20 w-16 rounded object-cover"
                />
              ) : (
                <div className="flex h-20 w-16 items-center justify-center rounded bg-brand-light">
                  <BookOpen className="h-6 w-6 text-brand" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-bold text-slate-950">{b.title}</h3>
                <p className="text-xs text-slate-500">{b.author}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge color="blue">Rs {b.price}</Badge>
                  <Badge color={b.isPublished ? "green" : "slate"}>
                    {b.isPublished ? "Published" : "Draft"}
                  </Badge>
                  {b.contentKey && <Badge color="amber">Has content</Badge>}
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={() => editBook(b)}>
                Edit & Chapters
              </Button>
              <Button variant="danger" onClick={() => removeBook(b.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
        {books.length === 0 && (
          <p className="text-sm text-slate-500">
            No e-books match your filters.
          </p>
        )}
      </div>

      <Pager
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        onPage={setPage}
      />
    </div>
  );
}
