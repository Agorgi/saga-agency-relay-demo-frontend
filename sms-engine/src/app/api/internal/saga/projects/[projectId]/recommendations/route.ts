import { requireInternalApiKey } from "@/lib/internalApiAuth";
import { internalError, internalOk } from "@/lib/internalRoute";
import { recommendationsForProject } from "@/lib/internalSagaApi";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const unauthorized = await requireInternalApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const { projectId } = await params;
    return internalOk(await recommendationsForProject(projectId));
  } catch (error) {
    return internalError(error);
  }
}
