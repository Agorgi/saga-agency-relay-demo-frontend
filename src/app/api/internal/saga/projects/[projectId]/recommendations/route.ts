import { requireInternalApiKey } from "@/sms-engine/internalApiAuth";
import { internalError, internalOk } from "@/sms-engine/internalRoute";
import { recommendationsForProject } from "@/sms-engine/internalSagaApi";

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
