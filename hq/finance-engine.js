(() => {
  'use strict';
  const KEY='haven_finance_center_v1';
  const uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`.toUpperCase();
  const now=()=>new Date().toISOString();
  const monthKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const seed=()=>({version:1,settings:{currency:'KRW'},businesses:{'Savingio':{goal:5000000},'ITEM Studio':{goal:3000000},'공통 본부':{goal:1000000}},missions:[],transactions:[]});
  let state;
  try{state=Object.assign(seed(),JSON.parse(localStorage.getItem(KEY)||'{}'));state.businesses={...seed().businesses,...(state.businesses||{})};state.missions ||= [];state.transactions ||= []}catch{state=seed()}
  const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
  const num=v=>Math.max(0,Number(v)||0);
  const estimateRevenue=m=>{const grade=m?.brain?.revenue?.grade||'LOW';const base={HIGH:350000,MEDIUM:180000,LOW:70000,INDIRECT:30000,UNKNOWN:50000}[grade]||50000;const priority={'긴급':1.25,'높음':1.1,'보통':1}[m.priority]||1;return Math.round(base*priority)};
  const ensureMission=m=>{let row=state.missions.find(x=>x.missionId===m.id);if(!row){row={id:uid('FIN'),missionId:m.id,title:m.title,division:m.division||'공통 본부',status:m.status||'QUEUED',estimatedRevenue:estimateRevenue(m),actualRevenue:0,cost:0,roi:0,taskCount:0,startedAt:m.createdAt||now(),completedAt:null,updatedAt:now()};state.missions.unshift(row);save()}return row};
  function recordTask(m,task,result={}){const row=ensureMission(m);const cost=num(result.cost ?? result.usage?.cost ?? 0);row.cost+=cost;row.taskCount+=1;row.status=m.status||row.status;row.updatedAt=now();row.roi=row.cost>0?Math.round(((row.actualRevenue-row.cost)/row.cost)*100):0;state.transactions.unshift({id:uid('TX'),missionId:m.id,division:row.division,type:'COST',amount:cost,employeeId:task.assignedEmployeeId||'',employeeName:task.assignedEmployeeName||task.employee||'',provider:result.provider||task.provider||'',model:result.model||task.model||'',at:now()});state.transactions=state.transactions.slice(0,2000);save();return row}
  function closeMission(m,{status='APPROVED',actualRevenue}={}){const row=ensureMission(m);row.status=status;row.completedAt=now();row.updatedAt=now();if(status==='APPROVED')row.actualRevenue=num(actualRevenue ?? row.estimatedRevenue);row.roi=row.cost>0?Math.round(((row.actualRevenue-row.cost)/row.cost)*100):(row.actualRevenue>0?9999:0);if(row.actualRevenue>0)state.transactions.unshift({id:uid('TX'),missionId:m.id,division:row.division,type:'REVENUE',amount:row.actualRevenue,at:now()});save();return row}
  function setBusinessGoal(division,goal){state.businesses[division]={...(state.businesses[division]||{}),goal:num(goal)};save();return state.businesses[division]}
  function addTransaction({division='공통 본부',type='REVENUE',amount=0,note=''}){const tx={id:uid('TX'),missionId:'',division,type,amount:num(amount),note,at:now()};state.transactions.unshift(tx);save();return tx}
  function summary(month=monthKey()){
    const inMonth=x=>String(x.at||x.completedAt||x.updatedAt||'').startsWith(month);
    const tx=state.transactions.filter(inMonth);
    const revenue=tx.filter(x=>x.type==='REVENUE').reduce((s,x)=>s+x.amount,0);
    const cost=tx.filter(x=>x.type==='COST').reduce((s,x)=>s+x.amount,0);
    const goal=Object.values(state.businesses).reduce((s,x)=>s+num(x.goal),0);
    const businesses=Object.keys(state.businesses).map(division=>{const items=tx.filter(x=>x.division===division);const r=items.filter(x=>x.type==='REVENUE').reduce((s,x)=>s+x.amount,0);const c=items.filter(x=>x.type==='COST').reduce((s,x)=>s+x.amount,0);const g=num(state.businesses[division].goal);const missions=state.missions.filter(x=>x.division===division);return{division,goal:g,revenue:r,cost:c,profit:r-c,achievement:g?Math.round(r/g*100):0,roi:c?Math.round((r-c)/c*100):(r?9999:0),missions:missions.length}});
    return{month,goal,revenue,cost,profit:revenue-cost,achievement:goal?Math.round(revenue/goal*100):0,roi:cost?Math.round((revenue-cost)/cost*100):(revenue?9999:0),businesses,missions:state.missions.length};
  }
  const recommendations=()=>summary().businesses.map(x=>({...x,action:x.roi>=300?'투자 확대':x.roi>=80?'유지·최적화':x.revenue===0?'수익 검증 필요':'비용 축소'})).sort((a,b)=>b.roi-a.roi);
  const clear=()=>{state=seed();save()};
  window.HavenFinance={getState:()=>state,ensureMission,recordTask,closeMission,setBusinessGoal,addTransaction,summary,recommendations,clear,monthKey};
})();