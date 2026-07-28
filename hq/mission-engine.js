(() => {
  'use strict';
  const KEY='haven_ai_company_v5';
  const loadScript=(src,ready)=>new Promise(resolve=>{
    if(ready()){resolve(true);return}
    const script=document.createElement('script');script.src=src;script.onload=()=>resolve(true);script.onerror=()=>resolve(false);document.head.appendChild(script);
  });
  const connectorReady=loadScript('ai-connector.js',()=>Boolean(window.HavenAIConnector));
  const brainReady=loadScript('company-brain.js',()=>Boolean(window.HavenCompanyBrain));
  const PIPELINE=[
    {id:'ceo',name:'CEO·PM',tool:'AI CEO Connector'},
    {id:'research',name:'시장조사팀',tool:'AI Research Connector'},
    {id:'planning',name:'상품기획팀',tool:'AI Planning Connector'},
    {id:'copy',name:'카피팀',tool:'AI Copy Connector'},
    {id:'production',name:'제작본부',tool:'AI Production Connector'},
    {id:'qa',name:'QA·감사실',tool:'AI Policy Connector'}
  ];
  const uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`.toUpperCase();
  const now=()=>new Date().toISOString();
  const safe=v=>String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const seed=()=>({version:5,projects:[],missions:[],tasks:[],approvals:[],logs:[],settings:{autoAdvance:true,executionMode:'AUTO',brainEnabled:true}});
  let state;
  try{state=Object.assign(seed(),JSON.parse(localStorage.getItem(KEY)||localStorage.getItem('haven_ai_company_v4')||localStorage.getItem('haven_ai_company_v3')||'{}'));state.version=5}catch{state=seed()}
  const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
  const log=(type,message,missionId='')=>{state.logs.unshift({id:uid('LOG'),type,message,missionId,at:now()});state.logs=state.logs.slice(0,300)};
  const projectFor=(division,name)=>{let p=state.projects.find(x=>x.division===division&&x.name===name);if(!p){p={id:uid('PRJ'),division,name,status:'ACTIVE',createdAt:now(),updatedAt:now()};state.projects.unshift(p);log('PROJECT',`${name} 프로젝트를 생성했습니다.`)}return p};
  const ruleOutput=(stage,m)=>({
    ceo:`Company Brain 판단\n- 목표: ${m.title}\n- 의도: ${m.brain?.intent||'GENERAL'}\n- 사업부: ${m.division}\n- 우선순위: ${m.priority}\n- 수익 가능성: ${m.brain?.revenue?.grade||'미분석'}\n- 위험도: ${m.brain?.risk||'LOW'}\n- 완료 조건: 조사·기획·제작·QA를 거쳐 대표 승인센터에 전달`,
    research:`시장조사 브리프\n- 핵심 수요: 실생활 문제를 즉시 해결하는 주제\n- 검증 항목: 검색 의도, 경쟁 강도, 계절성, 구매 연결성\n- 다음 전달: 상품기획팀이 후보와 메시지를 구체화`,
    planning:`실행 기획서\n- 대상 사업부: ${m.division}\n- 산출물: 핵심 제안 1개, 콘텐츠 패키지 1개, CTA 1개\n- 제한: 과장·저작권·정책 위험 표현 금지`,
    copy:`카피 초안\nHOOK: 지금 놓치면 계속 불편한 이유\nBODY: 문제 → 해결 → 근거 → 행동 순서\nCTA: 결과를 확인하고 다음 제작 단계로 이동`,
    production:`제작 패키지\n- ITEM Studio 입력용 상품/주제 요약\n- 20초 쇼츠 장면 구성\n- 제목·설명·해시태그 초안\n- 제작 화면 연결 준비 완료`,
    qa:`QA 결과\n- 구조 검사: PASS\n- 과장 표현 검사: PASS\n- 저작권 위험 검사: PASS\n- 필수 정보 누락 검사: PASS\n- 대표 승인 권고: 승인 가능`
  }[stage]||'');
  const defaultDecision=({title,division,priority,projectName})=>({intent:'GENERAL',division,priority,projectName:projectName||division,revenue:{grade:'UNKNOWN',confidence:0},risk:'LOW',departments:PIPELINE.map(x=>x.id),summary:'Company Brain 준비 중이므로 기본 설정을 사용했습니다.',original:title});
  const createMission=({title,division,priority,projectName})=>{
    const brain=window.HavenCompanyBrain;
    const decision=brain?brain.analyze({title,division,priority,projectName}):defaultDecision({title,division,priority,projectName});
    const project=projectFor(decision.division||division,decision.projectName||projectName||division);
    const mission={id:uid('MISSION'),projectId:project.id,title,division:decision.division||division,priority:decision.priority||priority,status:'QUEUED',stageIndex:0,progress:0,executionMode:'PENDING',brain:decision,createdAt:now(),updatedAt:now()};
    state.missions.unshift(mission);
    PIPELINE.forEach((s,i)=>state.tasks.push({id:uid('TASK'),missionId:mission.id,employeeId:s.id,employee:s.name,tool:s.tool,order:i,status:i===0?'INBOX':'WAITING',input:i===0?`${title}\n\n${decision.summary}`:'이전 부서 결과 대기',output:'',executionMode:'PENDING',provider:'',model:'',error:'',createdAt:now(),updatedAt:now()}));
    brain?.enqueue(mission);
    log('BRAIN',decision.summary,mission.id);
    log('CEO',`대표 지시를 ${mission.id}로 등록했습니다.`,mission.id);
    save();return mission
  };
  async function executeTask(m,task,tasks){
    const previous=tasks[task.order-1]?.output||'';
    task.status='RUNNING';task.updatedAt=now();save();log(task.employee,`${task.id} AI 실행을 시작했습니다.`,m.id);
    await Promise.all([connectorReady,brainReady]);
    if(!m.brain&&window.HavenCompanyBrain){m.brain=window.HavenCompanyBrain.analyze({title:m.title,division:m.division,priority:m.priority,projectName:state.projects.find(p=>p.id===m.projectId)?.name});log('BRAIN',m.brain.summary,m.id)}
    window.HavenCompanyBrain?.markJob(m.id,'RUNNING');
    const connector=window.HavenAIConnector;
    const result=connector?await connector.execute({mission:m,task,previousOutput:previous}):{ok:false,error:'Connector unavailable'};
    if(result.ok){task.output=result.output;task.executionMode='AI';task.provider=result.provider||'';task.model=result.model||'';task.error='';m.executionMode='AI';log(task.employee,`${task.id}를 ${task.provider}${task.model?' · '+task.model:''}로 완료했습니다.`,m.id)}
    else{task.output=ruleOutput(task.employeeId,m);task.executionMode='RULE';task.error=result.error||'AI unavailable';if(m.executionMode!=='AI')m.executionMode='RULE';log('FALLBACK',`${task.employee} AI 호출 실패로 규칙 엔진을 사용했습니다: ${task.error}`,m.id)}
    task.status='DONE';task.updatedAt=now();
    const next=tasks[task.order+1];
    if(next){next.status='INBOX';next.input=task.output;next.updatedAt=now();m.stageIndex=next.order;m.status='RUNNING';m.progress=Math.round((task.order+1)/tasks.length*100);log(next.employee,`${m.id}가 Inbox에 도착했습니다.`,m.id)}
    else{m.status='APPROVAL';m.progress=100;m.stageIndex=tasks.length;state.approvals.unshift({id:uid('APR'),missionId:m.id,status:'PENDING',requestedAt:now(),decidedAt:null,note:''});window.HavenCompanyBrain?.markJob(m.id,'COMPLETED');log('APPROVAL',`${m.id}가 대표 승인센터에 도착했습니다.`,m.id)}
    m.updatedAt=now();save();return m;
  }
  const runAll=async(missionId,onStep)=>{let m=state.missions.find(x=>x.id===missionId);if(!m)return;while(!['APPROVAL','APPROVED','REJECTED'].includes(m.status)){const tasks=state.tasks.filter(x=>x.missionId===missionId).sort((a,b)=>a.order-b.order);const active=tasks.find(x=>x.status==='INBOX');if(!active)break;onStep?.(m,active);m=await executeTask(m,active,tasks);onStep?.(m,null);await new Promise(r=>setTimeout(r,120))}};
  const decide=(approvalId,decision,note='')=>{const a=state.approvals.find(x=>x.id===approvalId);if(!a)return;const m=state.missions.find(x=>x.id===a.missionId);a.status=decision;a.note=note;a.decidedAt=now();if(decision==='APPROVED'){m.status='APPROVED';window.HavenCompanyBrain?.rememberOutcome({missionId:m.id,title:m.title,status:'APPROVED',score:100,note});log('CEO',`${m.id}를 승인했습니다.`,m.id)}else{m.status='REJECTED';window.HavenCompanyBrain?.rememberOutcome({missionId:m.id,title:m.title,status:'REJECTED',score:40,note});const qa=state.tasks.find(x=>x.missionId===m.id&&x.employeeId==='qa');if(qa){qa.status='INBOX';qa.input=`대표 수정 요청: ${note||'내용 보완 후 재검수'}`;qa.output='';qa.executionMode='PENDING'}m.stageIndex=5;m.progress=83;log('CEO',`${m.id}를 수정 요청으로 반려했습니다.`,m.id)}m.updatedAt=now();save()};
  const rerunRejected=async(missionId,onStep)=>{const m=state.missions.find(x=>x.id===missionId);if(!m||m.status!=='REJECTED')return;m.status='RUNNING';const old=state.approvals.find(a=>a.missionId===missionId&&a.status==='REJECTED');if(old)old.status='REVISION_RUNNING';save();await runAll(missionId,onStep)};
  const reset=()=>{state=seed();save()};
  const exportData=()=>new Blob([JSON.stringify({company:state,brain:window.HavenCompanyBrain?.getMemory?.()||null,queue:window.HavenCompanyBrain?.getQueue?.()||null},null,2)],{type:'application/json'});
  window.HavenEngine={PIPELINE,getState:()=>state,createMission,runAll,decide,rerunRejected,reset,save,exportData,safe};
})();