import {COIN_PROBLEM,isCoinProblemStatement} from '@/lib/coinChangeProblem';

/** Old rounds keep their stored prompt; only its presentation is normalized. */
export function ProblemStatement({prompt,className='',fallbackClassName='text-xs sm:text-sm leading-relaxed'}:{prompt:string;className?:string;fallbackClassName?:string}){
 if(!isCoinProblemStatement(prompt))return <p className={`whitespace-pre-wrap text-slate-700 ${fallbackClassName} ${className}`}>{prompt}</p>;
 const heading='mb-3 border-b border-slate-200 pb-2 text-base font-bold text-slate-900';
 return <div className={`space-y-7 text-sm leading-7 text-slate-800 ${className}`}>
  <section><h2 className={heading}>문제</h2><div className="space-y-3">{COIN_PROBLEM.paragraphs.map(text=><p key={text}>{text}</p>)}</div></section>
  <section><h2 className={heading}>입력</h2><p>{COIN_PROBLEM.input}</p></section>
  <section><h2 className={heading}>출력</h2><p>{COIN_PROBLEM.output}</p></section>
  <section><h2 className={heading}>제한</h2><ul className="list-disc space-y-1 pl-5">{COIN_PROBLEM.limits.map(text=><li key={text}>{text}</li>)}</ul></section>
  <div className="grid gap-5 sm:grid-cols-2"><section><h2 className={heading}>예제 입력 1</h2><pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm">{COIN_PROBLEM.example.input}</pre></section><section><h2 className={heading}>예제 출력 1</h2><pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm">{COIN_PROBLEM.example.output}</pre></section></div>
 </div>;
}
