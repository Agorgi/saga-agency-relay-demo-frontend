import { requireInternalApiKey } from "@/sms-engine/internalApiAuth";
import { internalError, internalOk } from "@/sms-engine/internalRoute";
import { createInternalInterestCheck } from "@/sms-engine/internalSagaApi";

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
