import { requireInternalApiKey } from "@/lib/internalApiAuth";
import { internalError, internalOk } from "@/lib/internalRoute";
import { recordInterestCheckInterest } from "@/lib/internalSagaApi";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireInternalApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    return internalOk(await recordInterestCheckInterest(id, await request.json()));
  } catch (error) {
    return internalError(error);
  }
}
