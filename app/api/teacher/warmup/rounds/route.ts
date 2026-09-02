import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { ValidationError, validateRoundPrompt, validateRoundTitle } from "@/lib/validation";
import { createWarmupRound, listWarmupRoundsForCourse } from "@/lib/warmupStore";
import { getOrCreateDefaultCourse } from "@/lib/store";

export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const course = await getOrCreateDefaultCourse();
  const rounds = await listWarmupRoundsForCourse(course.id);
  return Response.json({ rounds });
}

export async function POST(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const body = (await request.json().catch(() => ({}))) as { title?: string; prompt?: string };
  let title: string;
  let prompt: string;
  try {
    title = validateRoundTitle(body.title);
    prompt = validateRoundPrompt(body.prompt);
  } catch (error) {
    if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }

  const course = await getOrCreateDefaultCourse();
  const round = await createWarmupRound(course.id, title, prompt);
  return Response.json({ round });
}
