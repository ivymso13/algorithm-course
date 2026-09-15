export type PeerAssignmentRow={id:number;submissionId:number;evaluatorStudentKey:string};

export function planBalancedReassignment(input:{absentStudentKey:string;participantStudentKeys:string[];assignments:PeerAssignmentRow[];completedSubmissionIds:Set<number>;authorBySubmission:Map<number,string>}){
  const pending=input.assignments.filter(row=>row.evaluatorStudentKey===input.absentStudentKey&&!input.completedSubmissionIds.has(row.submissionId));
  const working=input.assignments.map(row=>({...row}));
  const load=new Map(input.participantStudentKeys.map(key=>[key,working.filter(row=>row.evaluatorStudentKey===key).length]));
  const plans:{assignmentId:number;submissionId:number;toEvaluatorStudentKey:string}[]=[];
  const unresolved:number[]=[];
  for(const row of pending){
    const alreadyAssigned=new Set(working.filter(item=>item.submissionId===row.submissionId).map(item=>item.evaluatorStudentKey));
    const author=input.authorBySubmission.get(row.submissionId);
    const candidates=input.participantStudentKeys.filter(key=>key!==input.absentStudentKey&&key!==author&&!alreadyAssigned.has(key)).sort((a,b)=>(load.get(a)??0)-(load.get(b)??0)||a.localeCompare(b));
    const replacement=candidates[0];
    if(!replacement){unresolved.push(row.submissionId);continue;}
    plans.push({assignmentId:row.id,submissionId:row.submissionId,toEvaluatorStudentKey:replacement});
    const target=working.find(item=>item.id===row.id)!;
    target.evaluatorStudentKey=replacement;
    load.set(replacement,(load.get(replacement)??0)+1);
    load.set(input.absentStudentKey,Math.max(0,(load.get(input.absentStudentKey)??0)-1));
  }
  return {plans,unresolved,pendingCount:pending.length,loads:Object.fromEntries(load)};
}
