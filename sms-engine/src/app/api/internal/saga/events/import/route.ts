import { importSagaEvent } from "@/sms-engine/internalSagaApi";
import { requireInternalApiKey } from "@/sms-engine/internalApiAuth";
import { internalError, internalOk } from "@/sms-engine/internalRoute";

export async function POST(request: Request) {
  const unauthorized = await requireInternalApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await importSagaEvent(await request.json());
    return internalOk(result);
  } catch (error) {
    return internalError(error);
  }
}
