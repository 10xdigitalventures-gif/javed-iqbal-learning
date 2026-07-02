import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LibraryService } from "../library/library.service";
import { HawwaChatDto } from "./dto";

// Hawwa \u2014 the in-reader AI study companion. Answers are grounded in the actual
// chapter text the reader is entitled to (via LibraryService) and fall back to a
// friendly study assistant when no book context is available.
//
// The AI engine is admin-configurable (Settings -> Hawwa AI provider). Env keys
// are persisted in the DB and mirrored into process.env by SettingsService:
//   AI_PROVIDER   "openai" | "openrouter" | "gemini"  (default "openai")
//   AI_API_KEY    provider API key (required for real answers)
//   AI_MODEL      model id (sensible per-provider default otherwise)
//   AI_BASE_URL   optional base URL override
// Legacy OPENAI_* keys are still honoured as a fallback. The assistant name and
// personality come from the public platform settings (aiName / aiPersonality)
// so the admin can rename Hawwa without a rebuild.
@Injectable()
export class AiService {
  private readonly logger = new Logger("Hawwa");

  constructor(
    private readonly library: LibraryService,
    private readonly prisma: PrismaService,
  ) {}

  private get provider() {
    return (process.env.AI_PROVIDER || "openai").toLowerCase().trim();
  }
  private get apiKey() {
    return process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
  }
  private get model() {
    if (process.env.AI_MODEL) return process.env.AI_MODEL;
    if (process.env.OPENAI_MODEL) return process.env.OPENAI_MODEL;
    if (this.provider === "gemini") return "gemini-1.5-flash";
    if (this.provider === "openrouter") return "openai/gpt-4o-mini";
    return "gpt-4o-mini";
  }
  private get baseUrl() {
    const def =
      this.provider === "openrouter"
        ? "https://openrouter.ai/api/v1"
        : this.provider === "gemini"
          ? "https://generativelanguage.googleapis.com/v1beta"
          : "https://api.openai.com/v1";
    return (
      process.env.AI_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      def
    ).replace(/\/$/, "");
  }

  private async config() {
    try {
      const rows = await this.prisma.platformSetting.findMany({
        where: { key: { in: ["aiName", "aiPersonality", "aiEnabled"] } },
      });
      const map: Record<string, string> = {};
      for (const r of rows) map[r.key] = r.value;
      return {
        name: (map.aiName || "Hawwa").trim() || "Hawwa",
        personality: (map.aiPersonality || "").trim(),
        enabled: map.aiEnabled !== "false",
      };
    } catch {
      return { name: "Hawwa", personality: "", enabled: true };
    }
  }

  async hawwa(userId: string, dto: HawwaChatDto) {
    const [context, cfg] = await Promise.all([
      this.buildContext(userId, dto),
      this.config(),
    ]);

    if (!cfg.enabled || !this.apiKey) {
      return {
        reply: this.fallbackReply(dto, cfg.name),
        grounded: !!context,
        degraded: true,
        name: cfg.name,
      };
    }

    const system = this.systemPrompt(
      context,
      cfg.name,
      cfg.personality,
      dto.chapterTitle,
    );

    try {
      const reply =
        this.provider === "gemini"
          ? await this.callGemini(system, dto.messages)
          : await this.callOpenAiCompatible(system, dto.messages);
      if (!reply) {
        return {
          reply: this.fallbackReply(dto, cfg.name),
          grounded: !!context,
          degraded: true,
          name: cfg.name,
        };
      }
      return { reply, grounded: !!context, degraded: false, name: cfg.name };
    } catch (e: any) {
      this.logger.warn("Hawwa request failed: " + (e?.message || e));
      return {
        reply: this.fallbackReply(dto, cfg.name),
        grounded: !!context,
        degraded: true,
        name: cfg.name,
      };
    }
  }

  // OpenAI and OpenRouter share the Chat Completions request/response shape.
  private async callOpenAiCompatible(
    system: string,
    history: HawwaChatDto["messages"],
  ): Promise<string | null> {
    const messages = [
      { role: "system", content: system },
      ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    ];
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + this.apiKey,
    };
    if (this.provider === "openrouter") {
      headers["HTTP-Referer"] = "https://app.profdrjaved.com";
      headers["X-Title"] = "Prof. Dr. Javed Iqbal Learning";
    }
    const res = await fetch(this.baseUrl + "/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        temperature: 0.4,
        max_tokens: 600,
        messages,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      this.logger.warn("Hawwa provider error " + res.status + ": " + text);
      return null;
    }
    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  }

  // Google Gemini (Generative Language API) uses a different shape.
  private async callGemini(
    system: string,
    history: HawwaChatDto["messages"],
  ): Promise<string | null> {
    const contents = history.slice(-10).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const url =
      this.baseUrl +
      "/models/" +
      encodeURIComponent(this.model) +
      ":generateContent?key=" +
      encodeURIComponent(this.apiKey);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      this.logger.warn("Hawwa Gemini error " + res.status + ": " + text);
      return null;
    }
    const data: any = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const out = parts
      .map((p: any) => p?.text || "")
      .join("")
      .trim();
    return out || null;
  }

  // Pull the actual chapter text the reader is allowed to see. Any failure
  // (no access, no book) silently degrades to no grounding.
  private async buildContext(
    userId: string,
    dto: HawwaChatDto,
  ): Promise<string | null> {
    if (!dto.bookId) return null;
    try {
      const content: any = await this.library.getSecureContent(
        userId,
        dto.bookId,
        dto.chapterId,
      );
      const text: string = content?.content || "";
      if (!text) return null;
      return text.slice(0, 6000);
    } catch {
      return null;
    }
  }

  private systemPrompt(
    context: string | null,
    name: string,
    personality: string,
    chapterTitle?: string,
  ) {
    const persona = personality ? " Personality to embody: " + personality : "";
    const base =
      "You are " +
      name +
      ", a warm, encouraging reading and study companion inside the Prof. " +
      "Dr. Javed Iqbal Learning App." +
      persona +
      " Help the reader understand what they are reading: explain ideas " +
      "simply, summarise, define terms, answer questions, and suggest " +
      "reflection points. Be concise and friendly. If the reader writes in " +
      "Roman Urdu or Urdu, reply in the same style. Never invent facts about " +
      "the book beyond the provided excerpt; if unsure, say so.";
    if (context) {
      return (
        base +
        '\n\nThe reader is currently on the chapter titled "' +
        (chapterTitle || "this chapter") +
        '". Use the following excerpt as your primary source of truth when ' +
        'answering questions about the current reading:\n\n"""\n' +
        context +
        '\n"""'
      );
    }
    return (
      base +
      "\n\nNo specific book excerpt is available right now, so act as a general " +
      "study companion and answer from general knowledge."
    );
  }

  private fallbackReply(dto: HawwaChatDto, name: string) {
    const last = [...dto.messages].reverse().find((m) => m.role === "user");
    const q = (last?.content || "").trim();
    const intro =
      "Salam! Main " +
      name +
      " hoon, aap ki reading companion. " +
      "(AI provider abhi configure nahi hai, is liye main detailed jawab nahi " +
      "de pa rahi.)";
    if (!q)
      return intro + " Aap is chapter ke baare me kuch bhi pooch sakte hain.";
    return (
      intro +
      ' Aap ne poocha: "' +
      q.slice(0, 160) +
      '". Jaise hi admin AI provider set karein ge, main is chapter ke ' +
      "mutabiq tafseeli jawab dena shuru kar dungi."
    );
  }
}
