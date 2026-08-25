import { getStage2Active } from "@/lib/store";

export async function GET() {
  const stage2Active = await getStage2Active();
  return Response.json({ stage2Active });
}
