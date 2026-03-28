import { Effect, Layer, ServiceMap } from 'effect';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import type { DropMetadata, DropType } from '@dropthing/shared';
import { AiError } from '@dropthing/shared';

type AiServiceShape = {
  readonly enrichDrop: (content: string, type: DropType) => Effect.Effect<DropMetadata, AiError>;
};

export class AiService extends ServiceMap.Service<AiService, AiServiceShape>()(
  '@dropthing/AiService'
) {
  static readonly layer = Layer.effect(
    AiService,
    Effect.gen(function* () {
      const groq = yield* Effect.try({
        try: () => createGroq({ apiKey: process.env.GROQ_API_KEY! }),
        catch: (error) => new AiError({ message: 'Failed to create Groq client', error }),
      });

      const enrichDrop = Effect.fn('AiService.enrichDrop')(function* (
        content: string,
        type: DropType
      ) {
        const truncated = content.length > 2000 ? content.slice(0, 2000) + '\n...' : content;

        const result = yield* Effect.tryPromise({
          try: () =>
            generateText({
              model: groq('llama-3.3-70b-versatile'),
              system: `You analyze content shared on a pastebin-like service.
Respond with ONLY a valid JSON object, no other text.
JSON schema:
{
  "title": "descriptive title summarizing what the content does or is about, max 50 chars, in the same language as the content",
  "language": "programming language name if code, omit if plain text"
}
"title" is required. "language" is optional — only include it for code, not plain text.
For the title: don't just name the technology or framework — describe the purpose or functionality. For example, prefer "Validation schemas for file sharing API" over "Effect Schema". For plain text, summarize the topic or intent.
For the language: be precise. Use exact CodeMirror language names. Pay attention to type annotations, generics, interfaces, and imports to distinguish TypeScript from JavaScript, TSX from JSX, etc. If the code has type annotations (: string, <T>, interface, type), it is TypeScript, not JavaScript.`,
              prompt: `Content type: ${type}\n\nContent:\n${truncated}`,
            }),
          catch: (error) => {
            const msg = error instanceof Error ? error.message : String(error);
            return new AiError({ message: msg, error });
          },
        });

        const parsed = yield* Effect.try({
          try: () => JSON.parse(result.text) as DropMetadata,
          catch: (error) => new AiError({ message: 'Failed to parse AI response', error }),
        });

        return parsed;
      });

      return { enrichDrop };
    })
  );
}
