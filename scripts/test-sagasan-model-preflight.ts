import {
  getConfiguredModel,
  preflightOpenAiModelAccess,
} from "../src/lib/sagasanAgent";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY?.trim() || null;
  const allowLivePreflight =
    process.env.SAGASAN_ENABLE_MODEL_PREFLIGHT?.trim().toLowerCase() === "true";

  if (!apiKey) {
    console.log("Sagasan model preflight skipped: OPENAI_API_KEY is missing.");
    process.exit(0);
  }

  if (!allowLivePreflight) {
    console.log(
      "Sagasan model preflight skipped: set SAGASAN_ENABLE_MODEL_PREFLIGHT=true to run it with a real key.",
    );
    process.exit(0);
  }

  const result = await preflightOpenAiModelAccess({
    apiKey,
    model: getConfiguredModel(),
    baseUrl: process.env.OPENAI_BASE_URL || null,
  });

  console.log(
    JSON.stringify(
      {
        status: result.status,
        model: result.model,
        message: result.message,
      },
      null,
      2,
    ),
  );

  if (result.status !== "ok") {
    process.exit(1);
  }
}

void main();
