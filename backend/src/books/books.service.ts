import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateBookDto,
  CreateBundleDto,
  CreateCategoryDto,
  CreateChapterDto,
  UpdateBookDto,
  UpdateBundleDto,
  UpdateCategoryDto,
} from "./dto";

// Catalog (books, bundles, categories) + admin CRUD. Content bytes are never
// served here — only metadata and a chapter outline. Protected content is
// delivered through LibraryService after an entitlement check.
@Injectable()
export class BooksService {
  constructor(private prisma: PrismaService) {}

  private slugify(input: string) {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80);
  }

  private async uniqueSlug(
    base: string,
    model: "book" | "bundle",
  ): Promise<string> {
    const root = this.slugify(base) || "item";
    let slug = root;
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing =
        model === "book"
          ? await this.prisma.book.findUnique({ where: { slug } })
          : await this.prisma.bundle.findUnique({ where: { slug } });
      if (!existing) return slug;
      slug = `${root}-${++n}`;
    }
  }

  // ---- Categories ----
  listCategories() {
    return this.prisma.bookCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    return this.prisma.bookCategory.create({
      data: {
        name: dto.name,
        slug: dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name),
        icon: dto.icon ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    return this.prisma.bookCategory.update({ where: { id }, data: { ...dto } });
  }

  async deleteCategory(id: string) {
    await this.prisma.bookCategory.delete({ where: { id } });
    return { ok: true };
  }

  // ---- Books ----
  listBooks(opts: {
    categoryId?: string;
    featured?: boolean;
    q?: string;
    includeUnpublished?: boolean;
  }) {
    const where: any = {};
    if (!opts.includeUnpublished) where.isPublished = true;
    if (opts.categoryId) where.categoryId = opts.categoryId;
    if (opts.featured) where.isFeatured = true;
    if (opts.q)
      where.OR = [
        { title: { contains: opts.q, mode: "insensitive" } },
        { author: { contains: opts.q, mode: "insensitive" } },
        { description: { contains: opts.q, mode: "insensitive" } },
      ];
    return this.prisma.book.findMany({
      where,
      include: { category: true },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    });
  }

  async getBook(idOrSlug: string) {
    const book = await this.prisma.book.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        category: true,
        chapters: {
          orderBy: { index: "asc" },
          select: {
            id: true,
            index: true,
            title: true,
            pageStart: true,
            pageEnd: true,
          },
        },
      },
    });
    if (!book) throw new NotFoundException("Book not found");
    return book;
  }

  // A short, freely viewable sample. Never returns the protected contentKey.
  async preview(idOrSlug: string) {
    const book = await this.getBook(idOrSlug);
    return {
      bookId: book.id,
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl,
      hasPreview: !!book.previewContentKey,
      previewContentKey: book.previewContentKey,
      chapters: book.chapters.slice(0, 3),
    };
  }

  async createBook(dto: CreateBookDto) {
    return this.prisma.book.create({
      data: {
        title: dto.title,
        slug: await this.uniqueSlug(dto.slug || dto.title, "book"),
        author: dto.author ?? "Prof. Dr. Javed Iqbal",
        description: dto.description ?? null,
        coverUrl: dto.coverUrl ?? null,
        language: dto.language ?? "en",
        pageCount: dto.pageCount ?? null,
        categoryId: dto.categoryId ?? null,
        price: dto.price ?? 0,
        currency: dto.currency ?? "PKR",
        hardCopyPrice: dto.hardCopyPrice ?? null,
        allowHardCopy: dto.allowHardCopy ?? false,
        accessType: dto.accessType ?? "LIFETIME",
        isFeatured: dto.isFeatured ?? false,
        isPublished: dto.isPublished ?? true,
        contentKey: dto.contentKey ?? null,
        previewContentKey: dto.previewContentKey ?? null,
      },
    });
  }

  async updateBook(id: string, dto: UpdateBookDto) {
    await this.getBook(id);
    const { slug, ...rest } = dto as any;
    return this.prisma.book.update({ where: { id }, data: { ...rest } });
  }

  async deleteBook(id: string) {
    await this.prisma.book.delete({ where: { id } });
    return { ok: true };
  }

  // ---- Chapters (admin) ----
  async upsertChapter(bookId: string, dto: CreateChapterDto) {
    await this.getBook(bookId);
    return this.prisma.chapter.upsert({
      where: { bookId_index: { bookId, index: dto.index } },
      update: {
        title: dto.title,
        contentKey: dto.contentKey ?? null,
        pageStart: dto.pageStart ?? null,
        pageEnd: dto.pageEnd ?? null,
      },
      create: {
        bookId,
        index: dto.index,
        title: dto.title,
        contentKey: dto.contentKey ?? null,
        pageStart: dto.pageStart ?? null,
        pageEnd: dto.pageEnd ?? null,
      },
    });
  }

  async deleteChapter(id: string) {
    await this.prisma.chapter.delete({ where: { id } });
    return { ok: true };
  }

  // ---- Bundles ----
  listBundles(opts: { featured?: boolean; includeUnpublished?: boolean }) {
    const where: any = {};
    if (!opts.includeUnpublished) where.isPublished = true;
    if (opts.featured) where.isFeatured = true;
    return this.prisma.bundle.findMany({
      where,
      include: {
        items: {
          include: {
            book: {
              select: { id: true, title: true, coverUrl: true, price: true },
            },
          },
        },
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    });
  }

  async getBundle(idOrSlug: string) {
    const bundle = await this.prisma.bundle.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        items: { include: { book: { include: { category: true } } } },
      },
    });
    if (!bundle) throw new NotFoundException("Bundle not found");
    return bundle;
  }

  async createBundle(dto: CreateBundleDto) {
    const bundle = await this.prisma.bundle.create({
      data: {
        title: dto.title,
        slug: await this.uniqueSlug(dto.slug || dto.title, "bundle"),
        description: dto.description ?? null,
        coverUrl: dto.coverUrl ?? null,
        price: dto.price ?? 0,
        currency: dto.currency ?? "PKR",
        isFeatured: dto.isFeatured ?? false,
        isPublished: dto.isPublished ?? true,
      },
    });
    if (dto.bookIds?.length) await this.setBundleItems(bundle.id, dto.bookIds);
    return this.getBundle(bundle.id);
  }

  async updateBundle(id: string, dto: UpdateBundleDto) {
    await this.getBundle(id);
    const { bookIds, slug, ...rest } = dto as any;
    await this.prisma.bundle.update({ where: { id }, data: { ...rest } });
    if (bookIds) await this.setBundleItems(id, bookIds);
    return this.getBundle(id);
  }

  private async setBundleItems(bundleId: string, bookIds: string[]) {
    if (!Array.isArray(bookIds))
      throw new BadRequestException("bookIds must be an array");
    await this.prisma.bundleItem.deleteMany({ where: { bundleId } });
    const unique = Array.from(new Set(bookIds));
    for (const bookId of unique) {
      await this.prisma.bundleItem.create({ data: { bundleId, bookId } });
    }
  }

  async deleteBundle(id: string) {
    await this.prisma.bundleItem.deleteMany({ where: { bundleId: id } });
    await this.prisma.bundle.delete({ where: { id } });
    return { ok: true };
  }
}
