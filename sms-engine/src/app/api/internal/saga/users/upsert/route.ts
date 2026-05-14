import { requireInternalApiKey } from "@/sms-engine/internalApiAuth";
import { internalError, internalOk } from "@/sms-engine/internalRoute";
import { upsertSagaUser } from "@/sms-engine/internalSagaApi";

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
