"use client";

import React from "react";
import clsx from "clsx";

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  className,
  disabled,
  ...props
}: {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    outline: "border border-slate-300 bg-white hover:bg-slate-50",
    ghost: "hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  return (
    <button
      className={clsx(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-medium outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

export function Input({
  label,
  className,
  ...props
}: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </span>
      ) : null}
      <input
        className={clsx(
          "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition duration-200 focus:border-brand focus:ring-2 focus:ring-brand/20",
          className,
        )}
        {...props}
      />
    </label>
  );
}

export function Textarea({
  label,
  className,
  ...props
}: { label?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </span>
      ) : null}
      <textarea
        className={clsx(
          "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition duration-200 focus:border-brand focus:ring-2 focus:ring-brand/20",
          className,
        )}
        {...props}
      />
    </label>
  );
}

export function Select({
  label,
  className,
  children,
  ...props
}: { label?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </span>
      ) : null}
      <select
        className={clsx(
          "w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition duration-200 focus:border-brand focus:ring-2 focus:ring-brand/20",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export type BadgeColor = "slate" | "green" | "red" | "blue" | "amber";

export function Badge({
  children,
  color = "slate",
}: {
  children: React.ReactNode;
  // Accept the known BadgeColor literals for autocomplete, but also tolerate a
  // plain string coming from status->color maps (falls back to "slate").
  color?: BadgeColor | (string & {});
}) {
  const colors: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-brand-light text-brand-dark",
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        colors[color] || colors.slate,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
    </div>
  );
}

export function ErrorText({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}
