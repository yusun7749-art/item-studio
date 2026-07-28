(() => {
  'use strict';

  const MEMORY_KEY='haven_company_memory_v2';
  const QUEUE_KEY='haven_company_queue_v2';
  const GOAL_KEY='haven_company_goals_v1';
  const LEGACY_MEMORY='haven_company_memory_v1';
  const LEGACY_QUEUE='haven_company_queue_v1';

  const RULES=[
    {words:['애드센스','승인','색인','콘텐츠','seo','savingio'],division:'Savingio',intent:'CONTENT_GROWTH',project:'Savingio Growth',departments:['research','planning','copy','production','qa'],revenue:'MEDIUM'},
    {words:['상품','쿠팡','판매','쇼츠','아이템','item'],division:'ITEM Studio',intent:'PRODUCT_REVENUE',project:'ITEM Studio Revenue Lab',departments:['research','planning','copy','production','qa'],revenue:'HIGH'},
    {words:['해외','외국인','태국','인도네시아','번역','여행'],division:'공통 본부',intent:'GLOBAL_EXPANSION',project:'HAVEN Global Lab',departments:['research','planning','copy','production','qa'],revenue:'MEDIUM'},
    {words:['자동화','프로그램','시스템','어드민','hq','개발'],division:'공통 본부',intent:'SYSTEM_BUILD',project:'HAVEN Company OS',departments:['ceo','planning','production','qa'],revenue:'INDIRECT'}
  ];

  const BUSINESSES={
    'Savingio':{revenue:72,speed:58,difficulty:45,risk:28,monthlyCapacity:1800000},
    'ITEM Studio':{revenue:78,speed:76,difficulty:54,risk:35,monthlyCapacity:2400000},
    '공통 본부':{revenue:42,speed:40,difficulty:72,risk:38,monthlyCapacity:700000}
  };

  const read=(key,fallback,legacy='')=>{try{return Object.assign(fallback,JSON.parse(localStorage.getItem(key)||localStorage.getItem(legacy)||'{}'))}catch{return fallback}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  const now=()=>new Date().toISOString();
  const uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`.toUpperCase();
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

  let memory=read(MEMORY_KEY,{version:2,patterns:[],outcomes:[],decisions:[],reports:[]},LEGACY_MEMORY); memory.version=2; memory.reports ||= [];
  let queue=read(QUEUE_KEY,{version:2,jobs:[]},LEGACY_QUEUE); queue.version=2;
  let goals=read(GOAL_KEY,{version:1,items:[]});

  function scoreRule(text,rule){const lower=text.toLowerCase();return rule.words.reduce((s,w)=>s+(lower.includes(w.toLowerCase())?1:0),0)}
  function inferPriority(text,requested='높음'){if(/긴급|오늘|즉시|바로|지금/.test(text))return'긴급';if(/나중|천천히|보류/.test(text))return'보통';return requested||'높음'}
  function estimateRevenue(intent,text){const base={PRODUCT_REVENUE:75,CONTENT_GROWTH:55,GLOBAL_EXPANSION:48,SYSTEM_BUILD:35,GENERAL:30}[intent]||30;const urgency=/오늘|이번 주|바로|판매|수익|매출/.test(text)?10:0;const confidence=clamp(base+urgency,0,95);return{confidence,grade:confidence>=70?'HIGH':confidence>=45?'MEDIUM':'LOW',reason:intent==='PRODUCT_REVENUE'?'구매 전환과 직접 연결되는 미션':intent==='CONTENT_GROWTH'?'검색 유입과 광고 승인·수익 기반을 강화하는 미션':intent==='GLOBAL_EXPANSION'?'신시장 검증이 필요한 확장 미션':intent==='SYSTEM_BUILD'?'직접 매출보다 반복 작업 제거 효과가 큰 기반 미션':'수익 연결 조건을 추가 확인해야 하는 일반 미션'}}

  function analyze(input){
    const text=String(input.title||'').trim();
    const ranked=RULES.map(rule=>({rule,score:scoreRule(text,rule)})).sort((a,b)=>b.score-a.score);
    const winner=ranked[0]?.score>0?ranked[0].rule:null;
    const intent=winner?.intent||'GENERAL';
    const division=input.division&&input.division!=='자동 판단'?input.division:(winner?.division||'공통 본부');
    const priority=inferPriority(text,input.priority);
    const revenue=estimateRevenue(intent,text);
    const risk=/저작권|법률|의료|보험|투자|개인정보/.test(text)?'HIGH':/해외|결제|광고/.test(text)?'MEDIUM':'LOW';
    const history=memory.outcomes.filter(x=>x.division===division||text.includes(x.title||'')).slice(0,20);
    const successRate=history.length?Math.round(history.filter(x=>x.status==='APPROVED').length/history.length*100):null;
    const decision={id:uid('DEC'),at:now(),original:text,intent,division,projectName:input.projectName||winner?.project||`${division} Operations`,priority,departments:winner?.departments||['ceo','research','planning','copy','production','qa'],revenue,risk,history:{samples:history.length,successRate},approvalRequired:true,successCriteria:['요청 목적과 산출물이 일치할 것','근거·정책·저작권 위험을 QA에서 확인할 것','대표 승인 전 외부 배포하지 않을 것'],summary:`${division}의 ${intent} 미션으로 분류했습니다. 우선순위 ${priority}, 수익 가능성 ${revenue.grade}, 위험도 ${risk}${successRate===null?'':`, 과거 승인률 ${successRate}%`}입니다.`};
    memory.decisions.unshift(decision); memory.decisions=memory.decisions.slice(0,300); write(MEMORY_KEY,memory); return decision;
  }

  function enqueue(mission){const weight={'긴급':3,'높음':2,'보통':1}[mission.priority]||1;const job={id:uid('JOB'),missionId:mission.id,title:mission.title,division:mission.division,priority:mission.priority,weight,status:'QUEUED',attempts:0,createdAt:now(),startedAt:null,completedAt:null};queue.jobs.push(job);queue.jobs.sort((a,b)=>b.weight-a.weight||new Date(a.createdAt)-new Date(b.createdAt));write(QUEUE_KEY,queue);return job}
  function nextJob(){return queue.jobs.find(x=>['QUEUED','RETRY'].includes(x.status))||null}
  function markJob(missionId,status,error=''){const job=queue.jobs.find(x=>x.missionId===missionId&&!['COMPLETED','FAILED'].includes(x.status));if(!job)return;if(status==='RUNNING'){job.attempts=(job.attempts||0)+1;if(!job.startedAt)job.startedAt=now()}job.status=status;job.error=error;if(['COMPLETED','FAILED'].includes(status))job.completedAt=now();write(QUEUE_KEY,queue)}
  function retryFailed(maxAttempts=3){queue.jobs.filter(x=>x.status==='FAILED'&&(x.attempts||0)<maxAttempts).forEach(x=>{x.status='RETRY';x.error=''});write(QUEUE_KEY,queue)}

  function rememberOutcome({missionId,title,status,score=0,note='',division=''}){const outcome={id:uid('MEM'),missionId,title,status,score,note,division,at:now()};memory.outcomes.unshift(outcome);memory.outcomes=memory.outcomes.slice(0,500);if(status==='APPROVED'){memory.patterns.unshift({id:uid('PAT'),sourceMissionId:missionId,title,division,score,learnedAt:now(),rule:'승인된 구조와 QA 기준을 유사 미션에 우선 적용'});memory.patterns=memory.patterns.slice(0,150)}write(MEMORY_KEY,memory);return outcome}

  function setRevenueGoal(amount,label='월 수익 목표'){const value=Math.max(0,Number(amount)||0);const goal={id:uid('GOAL'),label,target:value,status:'ACTIVE',createdAt:now(),updatedAt:now()};goals.items.unshift(goal);goals.items=goals.items.slice(0,24);write(GOAL_KEY,goals);return goal}
  function activeGoal(){return goals.items.find(x=>x.status==='ACTIVE')||null}
  function completeGoal(id){const g=goals.items.find(x=>x.id===id);if(g){g.status='COMPLETED';g.updatedAt=now();write(GOAL_KEY,goals)}}

  function businessScores(){return Object.entries(BUSINESSES).map(([name,b])=>{const outcomes=memory.outcomes.filter(x=>x.division===name);const approval=outcomes.length?Math.round(outcomes.filter(x=>x.status==='APPROVED').length/outcomes.length*100):50;const score=Math.round(b.revenue*.35+b.speed*.25+(100-b.difficulty)*.15+(100-b.risk)*.10+approval*.15);return{name,...b,approvalRate:approval,score}}).sort((a,b)=>b.score-a.score)}

  function buildRevenuePlan(target,current=0){const gap=Math.max(0,(Number(target)||0)-(Number(current)||0));const scores=businessScores();const total=scores.reduce((s,x)=>s+x.score,0)||1;let assigned=0;const allocations=scores.map((x,i)=>{const amount=i===scores.length-1?Math.max(0,gap-assigned):Math.round(gap*(x.score/total)/10000)*10000;assigned+=amount;return{division:x.name,score:x.score,amount,capacity:x.monthlyCapacity,feasible:amount<=x.monthlyCapacity,action:x.name==='Savingio'?'승인 품질·검색 유입·수익형 콘텐츠 강화':x.name==='ITEM Studio'?'판매 후보 발굴·쇼츠 패키지·전환 테스트':'공통 자동화와 해외 실험으로 신규 수익원 검증'}});return{id:uid('PLAN'),target:Number(target)||0,current:Number(current)||0,gap,allocations,createdAt:now()}}

  function createCEOReport(companyState={}){const missions=companyState.missions||[];const approvals=companyState.approvals||[];const approved=missions.filter(x=>x.status==='APPROVED').length;const rejected=missions.filter(x=>x.status==='REJECTED').length;const pending=approvals.filter(x=>x.status==='PENDING').length;const queued=queue.jobs.filter(x=>['QUEUED','RETRY','RUNNING'].includes(x.status)).length;const goal=activeGoal();const report={id:uid('REPORT'),at:now(),goal,metrics:{missions:missions.length,approved,rejected,pending,queued,approvalRate:missions.length?Math.round(approved/missions.length*100):0},recommendations:[]};if(pending)report.recommendations.push(`대표 승인 대기 ${pending}건을 먼저 확인하세요.`);if(queued)report.recommendations.push(`Job Queue ${queued}건이 실행 대기 중입니다.`);if(!missions.length)report.recommendations.push('첫 수익 미션을 등록해 Company Brain 학습을 시작하세요.');if(goal)report.revenuePlan=buildRevenuePlan(goal.target,0);report.businesses=businessScores();memory.reports.unshift(report);memory.reports=memory.reports.slice(0,60);write(MEMORY_KEY,memory);return report}

  const getMemory=()=>memory,getQueue=()=>queue,getGoals=()=>goals;
  function clearBrain(){memory={version:2,patterns:[],outcomes:[],decisions:[],reports:[]};queue={version:2,jobs:[]};goals={version:1,items:[]};write(MEMORY_KEY,memory);write(QUEUE_KEY,queue);write(GOAL_KEY,goals)}

  window.HavenCompanyBrain={analyze,enqueue,nextJob,markJob,retryFailed,rememberOutcome,setRevenueGoal,activeGoal,completeGoal,businessScores,buildRevenuePlan,createCEOReport,getMemory,getQueue,getGoals,clearBrain};
})();