import { Injectable, Logger } from "@nestjs/common";
import { LibraryService } from "../library/library.service";
import { HawwaChatDto } from "./dto";

// Hawwa — the in-reader AI study companion. It answers questions about the book
// the reader currently has open, grounded in the actual chapter text the user is
// entitled to (fetched via the entitlement-checked LibraryService), and falls
// back to a friendly study assistant when no book context is available.
//
// Provider: OpenAI-compatible Chat Completions API. Configure via env:
//   OPENAI_API_KEY   (required to enable real answers)
//   OPENAI_MODEL     (default "gpt-4o-mini")
//   OPENAI_BASE_URL  (default "https://api.openai.com/v1")
// When no key is set the endpoint still responds (graceful degraded mode) so
// the app never crashes in environments without an AI provider configured.
@Injectable()
export class AiService {
  private readonly logger = new Logger("Hawwa");

  constructor(private readonly library: LibraryService) {}

  private get apiKey() {
    return process.env.OPENAI_API_KEY || "";
  }
  private get model() {
    return process.env.OPENAI_MODEL || "gpt-4o-mini";
  }
  private get baseUrl() {
    return (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    );
  }

  async hawwa(userId: string, dto: HawwaChatDto) {
    const context = await this.buildContext(userId, dto);
    const system = this.systemPrompt(context, dto.chapterTitle);

    if (!this.apiKey) {
      return {
        reply: this.fallbackReply(dto),
        grounded: !!context,
        degraded: true,
      };
    }

    const messages = [
      { role: "system", content: system },
      ...dto.messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    try {
      const res = await fetch(this.baseUrl + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + this.apiKey,
        },
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
        return { reply: this.fallbackReply(dto), grounded: !!context, degraded: true };
      }
      const data: any = await res.json();
      const reply =
        data?.choices?.[0]?.message?.content?.trim() || this.fallbackReply(dto);
      return { reply, grounded: !!context, degraded: false };
    } catch (e: any) {
      this.logger.warn("Hawwa request failed: " + (e?.message || e));
      return { reply: this.fallbackReply(dto), grounded: !!context, degraded: true };
    }
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
      // Keep the context bounded so we stay within the model window.
      return text.slice(0, 6000);
    } catch {
      return null;
    }
  }

  private systemPrompt(context: string | null, chapterTitle?: string) {
    const base =
      "You are Hawwa, a warm, encouraging reading and study companion inside " +
      "the Prof. Dr. Javed Iqbal Learning App. Help the reader understand what " +
      "they are reading: explain ideas simply, summarise, define terms, answer " +
      "questions, and suggest reflection points. Be concise and friendly. If the " +
      "reader writes in Roman Urdu or Urdu, reply in the same style. Never invent " +
      "facts about the book beyond the provided excerpt; if unsure, say so.";
    if (context) {
      return (
        base +
        "\n\nThe reader is currently on the chapter titled \"" +
        (chapterTitle || "this chapter") +
        "\". Use the following excerpt as your primary source of truth when " +
        "answering questions about the current reading:\n\n\"\"\"\n" +
        context +
        "\n\"\"\""
      );
    }
    return (
      base +
      "\n\nNo specific book excerpt is available right now, so act as a general " +
      "study companion and answer from general knowledge."
    );
  }

  private fallbackReply(dto: HawwaChatDto) {
    const last = [...dto.messages].reverse().find((m) => m.role === "user");
    const q = (last?.content || "").trim();
    const intro =
      "Salam! Main Hawwa hoon, aap ki reading companion. " +
      "(AI provider abhi configure nahi hai, is liye main detailed jawab nahi " +
      "de pa rahi.)";
    if (!q) return intro + " Aap is chapter ke baare me kuch bhi pooch sakte hain.";
    return (
      intro +
      " Aap ne poocha: \"" +
      q.slice(0, 160) +
      "\". Jaise hi admin OPENAI_API_KEY set karein ge, main is chapter ke " +
      "mutabiq tafseeli jawab dena shuru kar dungi."
    );
  }
}
