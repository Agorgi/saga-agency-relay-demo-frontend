import { requireInternalApiKey } from "@/lib/internalApiAuth";
import { internalError, internalOk } from "@/lib/internalRoute";
import { importRelationshipEdges } from "@/lib/internalSagaApi";

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
