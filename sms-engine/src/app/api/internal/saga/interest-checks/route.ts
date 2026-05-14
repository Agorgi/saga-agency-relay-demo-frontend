import { requireInternalApiKey } from "@/lib/internalApiAuth";
import { internalError, internalOk } from "@/lib/internalRoute";
import { createInternalInterestCheck } from "@/lib/internalSagaApi";

export async function POST(request: Request) {
  const unauthorized = await requireInternalApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await createInternalInterestCheck(await request.json());
    return internalOk(result, 201);
  } catch (error) {
    return internalError(error);
  }
}
