/**
 * Port: AIService
 *
 * Generative AI capabilities (copy generation, review, structure suggestions).
 * Today implemented via `lib/adapters/ai-sdk/` with Vercel AI Gateway routing to Claude.
 */

export interface GenerateCopyOptions {
  tone?: "formal" | "friendly" | "urgent";
  maxLength?: number;
  language?: "es" | "en";
}

export interface ReviewResult {
  issues: string[];
  suggestions: string[];
  /** 0-10 quality estimate. */
  score: number;
}

export interface AIService {
  generateCopy(prompt: string, options?: GenerateCopyOptions): Promise<string>;
  reviewNotification(input: {
    subject: string;
    body: string;
    type?: "email" | "sms" | "push";
  }): Promise<ReviewResult>;
}
