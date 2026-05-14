import { requireInternalApiKey } from "@/sms-engine/internalApiAuth";
import { internalError, internalOk } from "@/sms-engine/internalRoute";
import { markOpportunityInterest } from "@/sms-engine/internalSagaApi";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ opportunityId: string }> },
) {
  const unauthorized = await requireInternalApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const { opportunityId } = await params;
    return internalOk(
      await markOpportunityInterest(opportunityId, await request.json()),
    );
  } catch (error) {
    return internalError(error);
  }
}
