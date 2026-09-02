import { getOrCreateDefaultCourse, getStage2Active } from "@/lib/store";

export async function GET() {
  const course = await getOrCreateDefaultCourse();
  const stage2Active = await getStage2Active(course.id);
  return Response.json({ stage2Active });
}
