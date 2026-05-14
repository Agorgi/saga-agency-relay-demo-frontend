import { requireInternalApiKey } from "@/lib/internalApiAuth";
import { internalError, internalOk } from "@/lib/internalRoute";
import { upsertSagaUser } from "@/lib/internalSagaApi";

export async function POST(request: Request) {
  const unauthorized = await requireInternalApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await upsertSagaUser(await request.json());
    return internalOk(result);
  } catch (error) {
    return internalError(error);
  }
}
