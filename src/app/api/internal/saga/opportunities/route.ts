import { requireInternalApiKey } from "@/sms-engine/internalApiAuth";
import { internalError, internalOk } from "@/sms-engine/internalRoute";
import { listActiveOpportunities } from "@/sms-engine/internalSagaApi";

export async function GET(request: Request) {
  const unauthorized = await requireInternalApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(request.url);
    return internalOk(await listActiveOpportunities(url.searchParams));
  } catch (error) {
    return internalError(error);
  }
}
