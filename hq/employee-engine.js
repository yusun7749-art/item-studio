(() => {
  'use strict';
  const KEY='haven_employee_ai_v1';
  const now=()=>new Date().toISOString();
  const uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`.toUpperCase();
  const seedEmployees=()=>[
    {id:'CEO-01',name:'CEO-01',department:'CEO',role:'대표 지시 해석·의사결정',skills:['strategy','general'],model:'Router Auto',status:'IDLE',activeTaskId:'',completed:0,failed:0,totalMs:0,qualityTotal:0,qualityCount:0,cost:0,lastActiveAt:null},
    {id:'RESEARCH-01',name:'Research-01',department:'연구본부',role:'시장·검색·경쟁 조사',skills:['research','market','seo'],model:'Gemini',status:'IDLE',activeTaskId:'',completed:0,failed:0,totalMs:0,qualityTotal:0,qualityCount:0,cost:0,lastActiveAt:null},
    {id:'PLANNER-01',name:'Planner-01',department:'기획본부',role:'실행 구조·사업 기획',skills:['planning','strategy'],model:'Claude',status:'IDLE',activeTaskId:'',completed:0,failed:0,totalMs:0,qualityTotal:0,qualityCount:0,cost:0,lastActiveAt:null},
    {id:'WRITER-01',name:'Writer-01',department:'콘텐츠본부',role:'본문·카피 작성',skills:['copy','writing','seo'],model:'OpenAI',status:'IDLE',activeTaskId:'',completed:0,failed:0,totalMs:0,qualityTotal:0,qualityCount:0,cost:0,lastActiveAt:null},
    {id:'PRODUCTION-01',name:'Production-01',department:'제작본부',role:'콘텐츠 패키지 제작',skills:['production','image','video'],model:'Router Auto',status:'IDLE',activeTaskId:'',completed:0,failed:0,totalMs:0,qualityTotal:0,qualityCount:0,cost:0,lastActiveAt:null},
    {id:'QA-01',name:'QA-01',department:'QA본부',role:'품질·정책·위험 검수',skills:['qa','policy','legal'],model:'Claude',status:'IDLE',activeTaskId:'',completed:0,failed:0,totalMs:0,qualityTotal:0,qualityCount:0,cost:0,lastActiveAt:null}
  ];
  const seed=()=>({version:1,employees:seedEmployees(),assignments:[],events:[]});
  let state;
  try{state=Object.assign(seed(),JSON.parse(localStorage.getItem(KEY)||'{}'));state.version=1;if(!Array.isArray(state.employees)||!state.employees.length)state.employees=seedEmployees();state.assignments||=[];state.events||=[]}catch{state=seed()}
  const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
  const skillForStage=stage=>({ceo:'strategy',research:'research',planning:'planning',copy:'copy',production:'production',qa:'qa'}[stage]||'general');
  const averageQuality=e=>e.qualityCount?Math.round(e.qualityTotal/e.qualityCount):0;
  const averageMs=e=>e.completed?Math.round(e.totalMs/e.completed):0;
  function scoreEmployee(e,skill){
    const skillScore=e.skills.includes(skill)?45:e.skills.includes('general')?15:0;
    const availability=e.status==='IDLE'?25:e.status==='WORKING'?-20:0;
    const quality=averageQuality(e)*.2;
    const reliability=(e.completed+e.failed)?(e.completed/(e.completed+e.failed))*10:5;
    const speed=averageMs(e)?Math.max(0,15-Math.min(15,averageMs(e)/6000)):10;
    return Math.round(skillScore+availability+quality+reliability+speed);
  }
  function assign(task,mission={}){
    const skill=skillForStage(task.employeeId);
    const ranked=state.employees.map(e=>({employee:e,score:scoreEmployee(e,skill)})).sort((a,b)=>b.score-a.score);
    const picked=ranked[0]?.employee;
    if(!picked)return null;
    picked.status='WORKING';picked.activeTaskId=task.id;picked.lastActiveAt=now();
    const assignment={id:uid('ASN'),taskId:task.id,missionId:mission.id||task.missionId||'',employeeId:picked.id,employeeName:picked.name,skill,score:ranked[0].score,status:'WORKING',startedAt:now(),completedAt:null,durationMs:0,provider:'',model:'',success:null,quality:null,error:''};
    state.assignments.unshift(assignment);state.assignments=state.assignments.slice(0,500);state.events.unshift({id:uid('EVT'),type:'ASSIGNED',message:`${task.id} → ${picked.name}`,at:now()});state.events=state.events.slice(0,300);save();return assignment;
  }
  function complete(taskId,{ok=true,quality=ok?90:35,provider='',model='',error='',cost=0}={}){
    const a=state.assignments.find(x=>x.taskId===taskId&&x.status==='WORKING');if(!a)return null;
    const e=state.employees.find(x=>x.id===a.employeeId);const end=Date.now();const duration=Math.max(0,end-new Date(a.startedAt).getTime());
    a.status=ok?'DONE':'FAILED';a.completedAt=now();a.durationMs=duration;a.provider=provider;a.model=model;a.success=ok;a.quality=quality;a.error=error;
    if(e){e.status='IDLE';e.activeTaskId='';e.lastActiveAt=now();e.totalMs+=duration;e.cost+=Number(cost)||0;e.qualityTotal+=quality;e.qualityCount+=1;if(ok)e.completed+=1;else e.failed+=1;if(model)e.model=model}
    state.events.unshift({id:uid('EVT'),type:ok?'COMPLETED':'FAILED',message:`${a.employeeName} · ${taskId}`,at:now()});state.events=state.events.slice(0,300);save();return a;
  }
  function setStatus(employeeId,status){const e=state.employees.find(x=>x.id===employeeId);if(e){e.status=status;e.lastActiveAt=now();save()}return e}
  function addEmployee(input){const e={id:input.id||uid('EMP'),name:input.name||'New Employee',department:input.department||'공통 본부',role:input.role||'일반 업무',skills:Array.isArray(input.skills)?input.skills:['general'],model:input.model||'Router Auto',status:'IDLE',activeTaskId:'',completed:0,failed:0,totalMs:0,qualityTotal:0,qualityCount:0,cost:0,lastActiveAt:null};state.employees.push(e);save();return e}
  function summary(){const es=state.employees;return{total:es.length,working:es.filter(x=>x.status==='WORKING').length,idle:es.filter(x=>x.status==='IDLE').length,completed:es.reduce((s,x)=>s+x.completed,0),failed:es.reduce((s,x)=>s+x.failed,0),averageQuality:es.reduce((s,x)=>s+averageQuality(x),0)/(es.length||1)}}
  window.HavenEmployeeAI={getState:()=>state,assign,complete,setStatus,addEmployee,summary,averageQuality,averageMs,save};
})();