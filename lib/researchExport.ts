import * as XLSX from "xlsx";
import { getD1 } from "@/db";
/** Source-backed records scoped to the teacher's course; stable pseudonyms join sheets. */
export async function appendResearchSheets(workbook:XLSX.WorkBook,courseId:number){
  const db=await getD1();
  const sheets=[
    ['워밍업_버전',`SELECT v.*,ro.id AS learner_id FROM algorithm_versions v JOIN warmup_submissions s ON s.id=v.submission_id LEFT JOIN roster ro ON ro.course_id=v.course_id AND ro.student_key=s.student_key WHERE v.course_id=?`],
    ['동료_배정평가',`SELECT a.*,author.id AS learner_id,reviewer.id AS reviewer_learner_id FROM algorithm_review_assignments a JOIN algorithm_versions v ON v.id=a.version_id JOIN warmup_submissions s ON s.id=v.submission_id LEFT JOIN roster author ON author.course_id=v.course_id AND author.student_key=s.student_key LEFT JOIN roster reviewer ON reviewer.course_id=v.course_id AND reviewer.student_key=a.reviewer_key WHERE v.course_id=?`],
    ['JEV_해석실행',`SELECT f.*,v.submission_id,v.revision FROM algorithm_ai_feedback f JOIN algorithm_versions v ON v.id=f.version_id WHERE v.course_id=?`],
    ['학생_해석확인',`SELECT n.*,v.submission_id,v.revision FROM algorithm_interpretation_notes n JOIN algorithm_versions v ON v.id=n.version_id WHERE v.course_id=?`],
    ['학생_해석확인이력',`SELECT n.*,v.submission_id,v.revision FROM algorithm_observations n JOIN algorithm_versions v ON v.id=n.version_id WHERE v.course_id=?`],
    ['수정_예외개방',`SELECT o.* FROM algorithm_revision_overrides o JOIN warmup_submissions s ON s.id=o.submission_id JOIN warmup_rounds r ON r.id=s.round_id WHERE r.course_id=?`],
    ['워밍업_라운드',`SELECT * FROM warmup_rounds WHERE course_id=?`],
  ];
  const interpretations:Record<string,unknown>[]=[],trials:Record<string,unknown>[]=[],trace:Record<string,unknown>[]=[];
  for(const [name,query] of sheets){const rows=(await db.prepare(query).bind(courseId).all()).results.map(r=>{const {result,...safe}=r;
    delete safe.reviewer_key;delete safe.student_key;delete safe.token;
    if(typeof result==='string'){try{const data=JSON.parse(result);Object.assign(safe,{caseSetVersion:data.caseSetVersion,model:data.model,promptVersion:data.promptVersion,kind:data.kind});for(const p of data.interpretations??[])interpretations.push({feedback_id:r.id,version_id:r.version_id,...p});for(const [i,t] of (data.trials??[]).entries()){const {trace:steps,...trial}=t;trials.push({feedback_id:r.id,version_id:r.version_id,case_index:i,...Object.fromEntries(Object.entries(trial).map(([k,v])=>[k,Array.isArray(v)?JSON.stringify(v):v])),numbers:JSON.stringify(t.numbers)});for(const [j,step] of (steps??[]).entries())trace.push({feedback_id:r.id,version_id:r.version_id,case_index:i,tick:j,...step});}}catch{Object.assign(safe,{error:'저장된 응답 해석 실패'});}}
    return safe;});XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(rows),name);}
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(interpretations),'JEV_명령해석');
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(trials),'JEV_테스트');
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(trace),'JEV_실행단계');
  const identities=(await db.prepare(`SELECT ro.id AS learner_id,s.id AS submission_id,s.round_id,ro.school,s.student_id,s.student_name,s.student_key FROM warmup_submissions s JOIN warmup_rounds r ON r.id=s.round_id LEFT JOIN roster ro ON ro.course_id=r.course_id AND ro.student_key=s.student_key WHERE r.course_id=?`).bind(courseId).all()).results;
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(identities),'교사용_신원매핑');
}
