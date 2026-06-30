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
import {
  Pager,
  buildQuery,
  useDebounced,
  type Paged,
} from "@/components/list-controls";
import { PageHeader } from "@/components/shell";

type Course = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  coverUrl?: string;
  price: number;
  currency: string;
  isPublished: boolean;
  _count?: { lessons: number; enrollments: number };
};

export default function CoursesAdminPage() {
  const [data, setData] = useState<Paged<Course> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    price: 0,
    isPublished: true,
  });

  // Search / filter / sort / pagination state.
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  function load() {
    const query = buildQuery({
      q: debouncedQ,
      status,
      sort,
      order,
      page,
      pageSize,
    });
    setLoading(true);
    api<Paged<Course>>(`/courses/admin/paged${query}`)
      .then((d) => setData(d))
      .catch(() => setData({ rows: [], total: 0, page: 1, pageSize }))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, sort, order, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, sort, order]);

  async function createCourse(e: React.FormEvent) {
    e.preventDefault();
    await api("/courses", { method: "POST", body: form });
    setShowForm(false);
    setForm({
      title: "",
      slug: "",
      description: "",
      price: 0,
      isPublished: true,
    });
    load();
  }

  async function removeCourse(id: string) {
    if (!confirm("Delete this course?")) return;
    await api(`/courses/${id}`, { method: "DELETE" });
    load();
  }

  const courses = data?.rows ?? [];

  return (
    <div>
      <PageHeader
        title="Courses"
        subtitle="Create and manage learning courses"
        action={
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" />
            {showForm ? "Cancel" : "New Course"}
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={createCourse} className="space-y-4">
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
            </div>
            <Textarea
              label="Description"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <div className="flex items-end gap-4">
              <Input
                label="Price (PKR)"
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: +e.target.value })}
              />
              <label className="flex items-center gap-2 pb-2 text-sm font-medium text-slate-700">
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
            <Button type="submit">Create Course</Button>
          </form>
        </Card>
      )}

      <Card className="mb-6">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            label="Search"
            placeholder="Title or description"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
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
            <option value="createdAt">Date created</option>
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

      {loading && !data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Card key={c.id}>
                {c.coverUrl ? (
                  <img
                    src={c.coverUrl}
                    alt={c.title}
                    className="mb-3 h-36 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="mb-3 flex h-36 w-full items-center justify-center rounded-lg bg-brand/10">
                    <BookOpen className="h-8 w-8 text-brand" />
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-950">{c.title}</h3>
                    <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                      {c.description || "No description"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge color={c.isPublished ? "green" : "slate"}>
                        {c.isPublished ? "Published" : "Draft"}
                      </Badge>
                      <Badge color="blue">
                        {c._count?.lessons ?? 0} lessons
                      </Badge>
                      <Badge color="amber">
                        {c._count?.enrollments ?? 0} members
                      </Badge>
                    </div>
                  </div>
                  <span className="ml-2 text-lg font-bold text-brand">
                    Rs {c.price}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <a href={`/admin/courses/${c.id}`}>
                    <Button variant="outline">
                      <BookOpen className="h-4 w-4" />
                      Manage
                    </Button>
                  </a>
                  <Button variant="danger" onClick={() => removeCourse(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          {courses.length === 0 ? (
            <Card>
              <p className="py-6 text-center text-slate-400">
                No courses match your filters
              </p>
            </Card>
          ) : null}
          {data ? (
            <Pager
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPage={setPage}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
