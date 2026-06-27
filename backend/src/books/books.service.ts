import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Paginated, parsePagination, buildOrderBy } from "../common/list-query";
import { readFileSync, unlinkSync } from "fs";
import { randomUUID } from "crypto";
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
type ImportJob = {
  id: string;
  bookId: string;
  status: "running" | "done" | "error";
  page: number;
  totalPages: number;
  phase: string;
  result?: { created: number; pages: number | null };
  error?: string;
  startedAt: number;
  finishedAt?: number;
};

@Injectable()
export class BooksService {
  constructor(private prisma: PrismaService) {}

  // In-memory PDF import jobs. OCR can take several minutes, so import-pdf
  // returns a jobId immediately and the heavy work runs in the background; the
  // admin UI polls getImportJob() for progress. Single-process store, which is
  // fine for a single API instance.
  private importJobs = new Map<string, ImportJob>();

  // Start a background PDF import and return its id right away so the HTTP
  // request finishes instantly (no gateway 504 even for long OCR runs).
  startImportJob(
    bookId: string,
    filePath: string,
    opts: { replace?: boolean; ocr?: boolean } = {},
  ): { jobId: string } {
    const id = randomUUID();
    const job: ImportJob = {
      id,
      bookId,
      status: "running",
      page: 0,
      totalPages: 0,
      phase: opts.ocr ? "Starting OCR" : "Extracting text",
      startedAt: Date.now(),
    };
    this.importJobs.set(id, job);
    this.pruneImportJobs();
    // Fire and forget: do NOT await, so the request returns immediately.
    void this.importPdfChapters(bookId, filePath, opts, (p) => {
      job.page = p.page;
      job.totalPages = p.totalPages;
      job.phase = p.phase;
    })
      .then((result) => {
        job.status = "done";
        job.result = { created: result.created, pages: result.pages };
        job.finishedAt = Date.now();
      })
      .catch((e: any) => {
        job.status = "error";
        job.error = e?.message || "PDF import failed";
        job.finishedAt = Date.now();
      })
      .finally(() => {
        try {
          unlinkSync(filePath);
        } catch {
          // best-effort temp cleanup
        }
      });
    return { jobId: id };
  }

  getImportJob(jobId: string): ImportJob {
    const job = this.importJobs.get(jobId);
    if (!job) throw new NotFoundException("Import job not found or expired");
    return job;
  }

  // Drop finished jobs older than an hour so the map can't grow forever.
  private pruneImportJobs() {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [jid, j] of this.importJobs) {
      if (j.finishedAt && j.finishedAt < cutoff) this.importJobs.delete(jid);
    }
  }

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

  // Paginated / searchable / sortable list for the admin library table.
  async listBooksPaged(opts: {
    q?: string;
    categoryId?: string;
    status?: string; // "published" | "draft"
    page?: string | number;
    pageSize?: string | number;
    sort?: string;
    order?: string;
  }): Promise<Paginated<any>> {
    const where: any = {};
    if (opts.status === "published") where.isPublished = true;
    if (opts.status === "draft") where.isPublished = false;
    if (opts.categoryId) where.categoryId = opts.categoryId;
    const term = (opts.q || "").trim();
    if (term) {
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { author: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ];
    }

    const orderBy = buildOrderBy(
      opts.sort,
      opts.order,
      { title: "title", price: "price", createdAt: "createdAt" },
      { createdAt: "desc" },
    );
    const { page, pageSize, skip, take } = parsePagination(
      opts.page,
      opts.pageSize,
    );

    const [rows, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        include: { category: true },
        orderBy,
        skip,
        take,
      }),
      this.prisma.book.count({ where }),
    ]);
    return { rows, total, page, pageSize };
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
            titleUrdu: true,
            isFree: true,
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
        titleUrdu: dto.titleUrdu ?? null,
        descriptionUrdu: dto.descriptionUrdu ?? null,
        contentKeyUrdu: dto.contentKeyUrdu ?? null,
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

  // ---- Book Content (Admin) ----
  async setBookContent(bookId: string, content: string) {
    return this.prisma.book.update({
      where: { id: bookId },
      data: { contentKey: content },
    });
  }

  async setChapterContent(chapterId: string, content: string) {
    return this.prisma.chapter.update({
      where: { id: chapterId },
      data: { contentKey: content },
    });
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
        // Only touch the secondary-language / free fields when the caller
        // actually sends them, so partial saves (e.g. audio upload) never wipe
        // an existing Urdu edition or free flag.
        ...(dto.titleUrdu !== undefined
          ? { titleUrdu: dto.titleUrdu || null }
          : {}),
        ...(dto.contentKeyUrdu !== undefined
          ? { contentKeyUrdu: dto.contentKeyUrdu || null }
          : {}),
        ...(dto.isFree !== undefined ? { isFree: dto.isFree } : {}),
      },
      create: {
        bookId,
        index: dto.index,
        title: dto.title,
        contentKey: dto.contentKey ?? null,
        pageStart: dto.pageStart ?? null,
        pageEnd: dto.pageEnd ?? null,
        titleUrdu: dto.titleUrdu || null,
        contentKeyUrdu: dto.contentKeyUrdu || null,
        isFree: dto.isFree ?? false,
      },
    });
  }

  async deleteChapter(id: string) {
    await this.prisma.chapter.delete({ where: { id } });
    return { ok: true };
  }

  // Admin-only chapter list that INCLUDES contentKey (reader-facing getBook
  // deliberately hides it). Powers the admin chapter editor.
  async listChaptersAdmin(bookId: string) {
    await this.getBook(bookId);
    return this.prisma.chapter.findMany({
      where: { bookId },
      orderBy: { index: "asc" },
    });
  }

  // Reassign chapter indexes to match the given order. Two-phase update inside
  // a transaction avoids tripping the @@unique([bookId, index]) constraint
  // while the indexes are being shuffled.
  async reorderChapters(bookId: string, orderedIds: string[]) {
    await this.getBook(bookId);
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.chapter.update({
          where: { id: orderedIds[i] },
          data: { index: 1000 + i },
        });
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.chapter.update({
          where: { id: orderedIds[i] },
          data: { index: i },
        });
      }
    });
    return this.listChaptersAdmin(bookId);
  }

  // ---- PDF import -> auto chapters (admin) ----
  // Extract the text from an uploaded PDF and split it into chapters as a
  // starting point the admin can rename/reorder/edit afterwards. The mobile app
  // never renders the PDF itself - we only keep the extracted text per chapter.
  async importPdfChapters(
    bookId: string,
    filePath: string,
    opts: { replace?: boolean; ocr?: boolean } = {},
    onProgress?: (p: {
      page: number;
      totalPages: number;
      phase: string;
    }) => void,
  ) {
    await this.getBook(bookId);

    let text = "";
    let numpages = 0;

    // 1) Fast path: pull the embedded text layer with pdf-parse. Skipped when
    // the admin forces OCR (scanned books, or PDFs built with non-Unicode
    // "InPage / legacy Noori Nastaleeq" Urdu fonts whose text layer extracts as
    // gibberish like "240\u00aa\u00e5\u00c5Z\u00edZzgZ8wOX20").
    if (!opts.ocr) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
        b: Buffer,
        o?: any,
      ) => Promise<{ text: string; numpages: number }>;
      try {
        const buf = readFileSync(filePath);
        const parsed = await pdfParse(buf);
        text = parsed.text || "";
        numpages = parsed.numpages || 0;
      } catch {
        // Fall through to OCR rather than failing outright.
        text = "";
      }
    }

    // 2) OCR fallback: forced, or the extracted text is empty / unreadable
    // gibberish. Renders each page to an image and runs Tesseract (Urdu+English
    // by default) so we recover real Unicode text.
    if (opts.ocr || !this.looksLikeReadableText(text)) {
      if (!this.ocrAvailable())
        throw new BadRequestException(
          "This PDF needs OCR (it looks scanned or uses a non-Unicode Urdu font), " +
            "but the OCR engine isn't installed on the server. Install Tesseract " +
            "with the Urdu language pack (tesseract-ocr + the 'urd' traineddata), " +
            "then import again.",
        );
      const ocr = await this.ocrPdfToText(filePath, onProgress);
      text = ocr.text;
      numpages = numpages || ocr.pages;
    }
    onProgress?.({ page: 0, totalPages: 0, phase: "Saving chapters" });

    const sections = this.splitTextIntoChapters(text);
    if (!sections.length)
      throw new BadRequestException(
        "No readable text found in this PDF, even after OCR. The scan quality may " +
          "be too low, or the Urdu language pack may be missing on the server.",
      );

    if (opts.replace !== false) {
      await this.prisma.chapter.deleteMany({ where: { bookId } });
    }
    const offset =
      opts.replace === false
        ? ((
            await this.prisma.chapter.aggregate({
              where: { bookId },
              _max: { index: true },
            })
          )._max.index ?? -1) + 1
        : 0;

    for (let i = 0; i < sections.length; i++) {
      await this.prisma.chapter.create({
        data: {
          bookId,
          index: offset + i,
          title: sections[i].title,
          contentKey: sections[i].content,
        },
      });
    }
    if (numpages) {
      await this.prisma.book.update({
        where: { id: bookId },
        data: { pageCount: numpages },
      });
    }
    return {
      created: sections.length,
      pages: numpages || null,
      chapters: await this.listChaptersAdmin(bookId),
    };
  }

  // True when extracted text reads like real prose (Latin or Urdu Unicode) and
  // not legacy-font gibberish. Used to decide whether we must fall back to OCR.
  private looksLikeReadableText(text: string): boolean {
    const t = (text || "").trim();
    if (t.length < 40) return false;
    // Real Urdu/Arabic Unicode present -> definitely readable.
    const urdu = (t.match(/[\u0600-\u06FF]/g) || []).length;
    if (urdu > t.length * 0.04) return true;
    // Otherwise it should read like normal Latin prose: enough whitespace and
    // few "weird" accented/symbol chars. Legacy InPage extraction produces
    // tokens like "240\u00aa\u00e5\u00c5Z\u00edZzgZ8wOX20" -> very high weird
    // ratio and very low whitespace ratio.
    const spaces = (t.match(/\s/g) || []).length;
    const weird = (t.match(/[^\t\n\r\x20-\x7E\u0600-\u06FF]/g) || []).length;
    return spaces / t.length > 0.08 && weird / t.length < 0.08;
  }

  // OCR is ALWAYS available now: the app ships a bundled WASM engine
  // (tesseract.js + pdf-to-img) that needs NO system install and runs directly
  // on Windows, macOS and Linux after `npm install`. This stays true so the
  // import flow never refuses; the work happens in ocrPdfToText().
  private ocrAvailable(): boolean {
    return true;
  }

  // Whether the fast NATIVE pipeline (poppler `pdftoppm` + `tesseract` binary)
  // is installed. Optional speed-up only; when missing we fall back to WASM.
  private systemOcrAvailable(): boolean {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { execFileSync } = require("child_process");
      execFileSync("tesseract", ["--version"], { stdio: "ignore" });
      execFileSync("pdftoppm", ["-v"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  // OCR dispatcher: prefer the fast native pipeline when those binaries are
  // installed, otherwise use the bundled cross-platform WASM engine so OCR runs
  // directly with no system packages.
  private async ocrPdfToText(
    filePath: string,
    onProgress?: (p: {
      page: number;
      totalPages: number;
      phase: string;
    }) => void,
  ): Promise<{ text: string; pages: number }> {
    if (this.systemOcrAvailable()) {
      try {
        return await this.ocrPdfToTextNative(filePath, onProgress);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(
          `Native OCR failed, falling back to bundled WASM OCR: ${(e as Error).message}`,
        );
      }
    }
    return this.ocrPdfToTextWasm(filePath, onProgress);
  }

  // Bundled WASM OCR (no system install). pdf-to-img (pdfjs + @napi-rs/canvas,
  // prebuilt binaries) renders each page to a PNG, then tesseract.js
  // (WebAssembly) reads it. Works on Windows/macOS/Linux. Urdu+English by
  // default (OCR_LANG); render scale via OCR_SCALE (default 2). On first run
  // tesseract.js downloads the language data once (needs internet). NOTE: WASM
  // OCR is slow for large books - test on a small PDF first and raise your
  // server/proxy request timeout for big ones.
  private async ocrPdfToTextWasm(
    filePath: string,
    onProgress?: (p: {
      page: number;
      totalPages: number;
      phase: string;
    }) => void,
  ): Promise<{ text: string; pages: number }> {
    const lang = process.env.OCR_LANG || "urd+eng";
    const scale = Number(process.env.OCR_SCALE || 2);
    const langs = lang
      .split("+")
      .map((l) => l.trim())
      .filter(Boolean);
    // pdf-to-img is ESM-only; load it via a REAL dynamic import from CommonJS
    // (a plain import() would be down-leveled to require() by the TS compiler
    // and fail on an ESM-only package).
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const dynamicImport = new Function("s", "return import(s)") as (
      s: string,
    ) => Promise<any>;
    const { pdf } = await dynamicImport("pdf-to-img");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createWorker } = require("tesseract.js");
    const worker = await createWorker(langs);
    try {
      const document = await pdf(filePath, { scale });
      const total = Number((document as any).length) || 0;
      onProgress?.({ page: 0, totalPages: total, phase: "Rendering pages" });
      const parts: string[] = [];
      let pages = 0;
      for await (const image of document) {
        pages++;
        const {
          data: { text: pageText },
        } = await worker.recognize(image);
        if (pageText && pageText.trim()) parts.push(pageText.trim());
        onProgress?.({
          page: pages,
          totalPages: total || pages,
          phase: "Reading text (OCR)",
        });
      }
      return { text: parts.join("\n\n"), pages };
    } finally {
      try {
        await worker.terminate();
      } catch {
        // best-effort worker shutdown
      }
    }
  }

  // Fast NATIVE pipeline (poppler + tesseract system binaries). Used only when
  // those tools are installed; see the ocrPdfToText() dispatcher.
  private async ocrPdfToTextNative(
    filePath: string,
    onProgress?: (p: {
      page: number;
      totalPages: number;
      phase: string;
    }) => void,
  ): Promise<{ text: string; pages: number }> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { execFileSync } = require("child_process");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const os = require("os");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("path");

    const lang = process.env.OCR_LANG || "urd+eng";
    const dpi = String(process.env.OCR_DPI || 300);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-ocr-"));
    try {
      // 1) PDF -> page-N.png images.
      execFileSync(
        "pdftoppm",
        ["-r", dpi, "-png", filePath, path.join(dir, "page")],
        { stdio: "ignore", maxBuffer: 1024 * 1024 * 64 },
      );
      const images: string[] = fs
        .readdirSync(dir)
        .filter((f: string) => f.toLowerCase().endsWith(".png"))
        .sort();

      // 2) OCR each page in order.
      onProgress?.({
        page: 0,
        totalPages: images.length,
        phase: "Reading text (OCR)",
      });
      const parts: string[] = [];
      let done = 0;
      for (const img of images) {
        const out = execFileSync(
          "tesseract",
          [path.join(dir, img), "stdout", "-l", lang, "--psm", "6"],
          { encoding: "utf8", maxBuffer: 1024 * 1024 * 64 },
        ) as string;
        if (out && out.trim()) parts.push(out.trim());
        done++;
        onProgress?.({
          page: done,
          totalPages: images.length,
          phase: "Reading text (OCR)",
        });
      }
      return { text: parts.join("\n\n"), pages: images.length };
    } finally {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort temp cleanup
      }
    }
  }

  // Heuristic splitter: prefer real chapter headings; otherwise fall back to
  // fixed-size text chunks. Either way the admin can adjust afterwards.
  private splitTextIntoChapters(
    raw: string,
  ): Array<{ title: string; content: string }> {
    const text = raw
      .replace(/\r\n/g, "\n")
      .replace(/\u0000/g, "")
      .trim();
    if (!text) return [];

    const lines = text.split("\n");
    const headingRe =
      /^\s*(chapter\s+[0-9ivxlcdm]+|chapter\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)|part\s+[0-9ivxlcdm]+|unit\s+\d+|lesson\s+\d+|section\s+\d+)\b.*$/i;
    const numberedRe = /^\s*\d{1,3}[.)]\s+\S.{0,80}$/;

    const chapters: Array<{ title: string; content: string[] }> = [];
    const maxChapters = 300;
    for (const line of lines) {
      const trimmed = line.trim();
      const isHeading =
        trimmed.length > 0 &&
        trimmed.length <= 90 &&
        (headingRe.test(trimmed) || numberedRe.test(trimmed));
      if (isHeading && chapters.length < maxChapters) {
        chapters.push({ title: trimmed.slice(0, 90), content: [] });
      } else if (chapters.length) {
        chapters[chapters.length - 1].content.push(line);
      } else {
        chapters.push({ title: "Introduction", content: [line] });
      }
    }

    const cleaned = chapters
      .map((c) => ({ title: c.title, content: c.content.join("\n").trim() }))
      .filter((c) => c.content.length > 0);

    if (cleaned.length >= 2) return cleaned;

    // Fallback: no usable headings - chunk the whole text by size at paragraph
    // boundaries so each chapter is a manageable block.
    const chunkChars = Number(process.env.PDF_CHAPTER_CHUNK_CHARS || 6000);
    const paragraphs = text.split(/\n\s*\n/);
    const out: Array<{ title: string; content: string }> = [];
    let buf = "";
    for (const p of paragraphs) {
      if (buf && buf.length + p.length > chunkChars) {
        out.push({ title: `Section ${out.length + 1}`, content: buf.trim() });
        buf = "";
      }
      buf += (buf ? "\n\n" : "") + p;
    }
    if (buf.trim())
      out.push({ title: `Section ${out.length + 1}`, content: buf.trim() });
    return out;
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
