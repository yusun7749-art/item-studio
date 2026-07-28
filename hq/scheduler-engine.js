(() => {
  'use strict';
  const SCHEDULE_KEY='haven_company_schedules_v1';
  const QUEUE_KEY='haven_company_queue_v2';
  const now=()=>new Date();
  const iso=d=>d.toISOString();
  const uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`.toUpperCase();
  const read=(key,fallback)=>{try{return Object.assign(fallback,JSON.parse(localStorage.getItem(key)||'{}'))}catch{return fallback}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  let state=read(SCHEDULE_KEY,{version:1,items:[],runs:[]}); state.items||=[]; state.runs||=[];

  function nextRun(frequency,time='09:00',from=now()){
    const [h,m]=time.split(':').map(Number); const d=new Date(from); d.setHours(h||0,m||0,0,0);
    if(d<=from)d.setDate(d.getDate()+1);
    if(frequency==='WEEKLY')d.setDate(d.getDate()+((8-d.getDay())%7));
    if(frequency==='MONTHLY'){d.setMonth(d.getMonth()+1,1)}
    return iso(d);
  }

  function add({title,division='공통 본부',priority='보통',frequency='DAILY',time='09:00',enabled=true}){
    const item={id:uid('SCH'),title:String(title||'').trim(),division,priority,frequency,time,enabled,nextRunAt:nextRun(frequency,time),lastRunAt:null,createdAt:iso(now()),updatedAt:iso(now())};
    if(!item.title)throw new Error('일정 제목이 필요합니다.');
    state.items.unshift(item); save(); return item;
  }
  function save(){write(SCHEDULE_KEY,state)}
  function remove(id){state.items=state.items.filter(x=>x.id!==id);save()}
  function toggle(id){const x=state.items.find(v=>v.id===id);if(x){x.enabled=!x.enabled;x.updatedAt=iso(now());save()}return x}
  function enqueue(item){
    const queue=read(QUEUE_KEY,{version:2,jobs:[]}); queue.jobs||=[];
    const weight={'긴급':3,'높음':2,'보통':1}[item.priority]||1;
    const job={id:uid('JOB'),missionId:'',scheduleId:item.id,title:item.title,division:item.division,priority:item.priority,weight,status:'QUEUED',attempts:0,source:'SCHEDULER',createdAt:iso(now()),startedAt:null,completedAt:null};
    queue.jobs.push(job); queue.jobs.sort((a,b)=>(b.weight||0)-(a.weight||0)||new Date(a.createdAt)-new Date(b.createdAt)); write(QUEUE_KEY,queue);
    item.lastRunAt=iso(now()); item.nextRunAt=nextRun(item.frequency,item.time,now()); item.updatedAt=iso(now());
    state.runs.unshift({id:uid('RUN'),scheduleId:item.id,jobId:job.id,title:item.title,at:item.lastRunAt,status:'QUEUED'}); state.runs=state.runs.slice(0,200); save(); return job;
  }
  function runDue(at=now()){const due=state.items.filter(x=>x.enabled&&new Date(x.nextRunAt)<=at);return due.map(enqueue)}
  function runNow(id){const item=state.items.find(x=>x.id===id);if(!item)throw new Error('일정을 찾을 수 없습니다.');return enqueue(item)}
  function getState(){return state}
  function summary(){return{total:state.items.length,enabled:state.items.filter(x=>x.enabled).length,due:state.items.filter(x=>x.enabled&&new Date(x.nextRunAt)<=now()).length,runs:state.runs.length}}
  function clear(){state={version:1,items:[],runs:[]};save()}
  window.HavenScheduler={add,remove,toggle,runDue,runNow,getState,summary,clear};
})();