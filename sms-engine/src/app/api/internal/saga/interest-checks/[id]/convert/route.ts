import { requireInternalApiKey } from "@/sms-engine/internalApiAuth";
import { internalError, internalOk } from "@/sms-engine/internalRoute";
import { convertInternalInterestCheck } from "@/sms-engine/internalSagaApi";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireInternalApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    return internalOk(await convertInternalInterestCheck(id));
  } catch (error) {
    return internalError(error);
  }
}
