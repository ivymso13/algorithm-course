import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { buildExportWorkbook } from "@/lib/xlsxExport";

export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const bytes = await buildExportWorkbook();
  const filename = `algorithm-class-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`;

  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
