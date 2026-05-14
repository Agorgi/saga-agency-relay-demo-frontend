import type { z } from "zod";

export type FallbackProviderResult<T> = {
  ok: true;
  data: T;
  provider: "fallback";
  rawText: null;
};

export async function runFallbackProvider<T extends z.ZodType>({
  schema,
  fallback,
}: {
  schema: T;
  fallback: z.infer<T>;
}): Promise<FallbackProviderResult<z.infer<T>>> {
  return {
    ok: true,
    data: schema.parse(fallback),
    provider: "fallback",
    rawText: null,
  };
}
