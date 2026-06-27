// Shared helpers for admin list endpoints: search, sort, and pagination.
// Keeps the response shape consistent across modules:
//   { rows, total, page, pageSize }

export type Paginated<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
};

// Clamp incoming page / pageSize (which arrive as strings via @Query) into
// safe bounds and compute Prisma skip/take.
export function parsePagination(
  page?: string | number,
  pageSize?: string | number,
  defaultSize = 20,
  maxSize = 100,
) {
  const p = Math.max(1, Math.floor(Number(page) || 1));
  const sizeRaw = Math.floor(Number(pageSize) || defaultSize);
  const size = Math.min(maxSize, Math.max(1, sizeRaw));
  return { page: p, pageSize: size, skip: (p - 1) * size, take: size };
}

// Build a Prisma orderBy from a client-supplied sort key, restricted to an
// allow-list mapping (key -> prisma field). Falls back when key is unknown.
export function buildOrderBy(
  sort: string | undefined,
  order: string | undefined,
  allowed: Record<string, string>,
  fallback: Record<string, "asc" | "desc"> = { createdAt: "desc" },
): Record<string, "asc" | "desc"> {
  const dir: "asc" | "desc" = order === "asc" ? "asc" : "desc";
  if (sort && allowed[sort]) {
    return { [allowed[sort]]: dir };
  }
  return fallback;
}

// Case-insensitive "contains" OR filter across multiple string fields.
// Returns undefined when there is no query so callers can spread it safely.
export function searchOr(
  q: string | undefined,
  fields: string[],
): { OR: Array<Record<string, any>> } | undefined {
  const term = (q || "").trim();
  if (!term) return undefined;
  return {
    OR: fields.map((f) => ({
      [f]: { contains: term, mode: "insensitive" },
    })),
  };
}
