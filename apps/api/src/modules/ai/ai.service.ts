import { Effect, Layer, Context } from 'effect';
import type { DropMetadata, DropType } from '@dropthing/shared';
import { AiError } from '@dropthing/shared';

type AiServiceShape = {
  readonly enrichDrop: (content: string, type: DropType) => Effect.Effect<DropMetadata, AiError>;
};

export class AiService extends Context.Service<AiService, AiServiceShape>()(
  '@dropthing/AiService'
) {
  static layer(apiKey: string | undefined) {
    const enrichDrop = Effect.fn('AiService.enrichDrop')(function* (
      content: string,
      type: DropType
    ) {
      const truncated = content.length > 2000 ? content.slice(0, 2000) + '\n...' : content;

      const result = yield* Effect.tryPromise({
        try: async () => {
          const [{ createGroq }, { generateText }] = await Promise.all([
            import('@ai-sdk/groq'),
            import('ai'),
          ]);
          const groq = createGroq({ apiKey: apiKey ?? '' });
          return generateText({
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
          });
        },
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

    return Layer.succeed(AiService, { enrichDrop });
  }
}
