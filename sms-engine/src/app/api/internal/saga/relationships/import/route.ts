import { requireInternalApiKey } from "@/sms-engine/internalApiAuth";
import { internalError, internalOk } from "@/sms-engine/internalRoute";
import { importRelationshipEdges } from "@/sms-engine/internalSagaApi";

export async function POST(request: Request) {
  const unauthorized = await requireInternalApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await importRelationshipEdges(await request.json());
    return internalOk({
      count: result.length,
      ids: result.map((edge) => edge.id),
    });
  } catch (error) {
    return internalError(error);
  }
}
