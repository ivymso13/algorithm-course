import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { getOrCreateDefaultCourse, getStage2Active, teacherDashboard } from "@/lib/store";
import { getOpenWarmupRoundWithSubmitters } from "@/lib/warmupStore";

export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  try {
    const course = await getOrCreateDefaultCourse();
    const [students, stage2Active, openWarmupRound] = await Promise.all([
      teacherDashboard(course.id),
      getStage2Active(course.id),
      getOpenWarmupRoundWithSubmitters(course.id),
    ]);
    return Response.json({
      students,
      stage2Active,
      openWarmupRound,
      course: { code: course.code, name: course.name, retentionDays: course.retentionDays },
    });
  } catch (error) {
    console.error("teacher dashboard failed", error);
    return Response.json({ error: "학생 명단을 불러오지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
