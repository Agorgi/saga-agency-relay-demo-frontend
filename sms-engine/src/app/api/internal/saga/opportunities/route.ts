import { requireInternalApiKey } from "@/lib/internalApiAuth";
import { internalError, internalOk } from "@/lib/internalRoute";
import { listActiveOpportunities } from "@/lib/internalSagaApi";

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
