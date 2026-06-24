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
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    price: 0,
    isPublished: true,
  });

  useEffect(() => {
    api<Course[]>("/courses/admin")
      .then((d) => setCourses(Array.isArray(d) ? d : []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);

  async function createCourse(e: React.FormEvent) {
    e.preventDefault();
    await api("/courses", { method: "POST", body: form });
    setShowForm(false);
    setForm({ title: "", slug: "", description: "", price: 0, isPublished: true });
    const d = await api<Course[]>("/courses/admin");
    setCourses(Array.isArray(d) ? d : []);
  }

  async function removeCourse(id: string) {
    if (!confirm("Delete this course?")) return;
    await api(`/courses/${id}`, { method: "DELETE" });
    setCourses(courses.filter((c) => c.id !== id));
  }

  if (loading) return <Spinner />;

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
              <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              <Input label="Slug (optional)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </div>
            <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="flex items-end gap-4">
              <Input label="Price (PKR)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} />
              <label className="flex items-center gap-2 pb-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
                Published
              </label>
            </div>
            <Button type="submit">Create Course</Button>
          </form>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-bold text-slate-950">{c.title}</h3>
                <p className="mt-1 text-sm text-slate-500 line-clamp-2">{c.description || "No description"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge color={c.isPublished ? "green" : "slate"}>
                    {c.isPublished ? "Published" : "Draft"}
                  </Badge>
                  <Badge color="blue">{c._count?.lessons ?? 0} lessons</Badge>
                  <Badge color="amber">{c._count?.enrollments ?? 0} students</Badge>
                </div>
              </div>
              <span className="ml-2 text-lg font-bold text-brand">Rs {c.price}</span>
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
    </div>
  );
}
