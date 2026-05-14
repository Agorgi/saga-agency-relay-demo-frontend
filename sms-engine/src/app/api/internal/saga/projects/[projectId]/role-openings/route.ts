import { requireInternalApiKey } from "@/lib/internalApiAuth";
import { internalError, internalOk } from "@/lib/internalRoute";
import { createOrUpdateRoleOpenings } from "@/lib/internalSagaApi";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const unauthorized = await requireInternalApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const { projectId } = await params;
    const result = await createOrUpdateRoleOpenings(
      projectId,
      await request.json(),
    );
    return internalOk(result);
  } catch (error) {
    return internalError(error);
  }
}
