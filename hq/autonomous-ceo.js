(() => {
  'use strict';
  const KEY='haven_autonomous_ceo_v1';
  const now=()=>new Date().toISOString();
  const uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`.toUpperCase();
  const read=()=>{try{return Object.assign(seed(),JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{return seed()}};
  const seed=()=>({version:1,settings:{enabled:false,autoCreate:false,maxDailyMissions:3,lastCycleAt:null},proposals:[],cycles:[]});
  let state=read();
  const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
  const safeNum=v=>Math.max(0,Number(v)||0);

  function companySnapshot(){
    const company=window.HavenEngine?.getState?.()||{missions:[],approvals:[]};
    const finance=window.HavenFinance?.summary?.()||{businesses:[],goal:0,revenue:0,cost:0,profit:0,achievement:0,roi:0};
    const businesses=window.HavenCompanyBrain?.businessScores?.()||[];
    return {company,finance,businesses,at:now()};
  }

  function buildIdeas(snapshot=companySnapshot()){
    const pending=(snapshot.company.approvals||[]).filter(x=>x.status==='PENDING').length;
    const active=(snapshot.company.missions||[]).filter(x=>['QUEUED','RUNNING'].includes(x.status)).length;
    const financeByName=Object.fromEntries((snapshot.finance.businesses||[]).map(x=>[x.division,x]));
    const ranked=(snapshot.businesses||[]).slice().sort((a,b)=>b.score-a.score);
    const ideas=[];
    ranked.forEach((b,index)=>{
      const f=financeByName[b.name]||{};
      const gap=Math.max(0,safeNum(f.goal)-safeNum(f.revenue));
      const roi=safeNum(f.roi);
      let title,reason,priority='보통';
      if(b.name==='Savingio'){
        title=gap>0?'Savingio 수익 목표 격차를 줄일 검색 유입형 콘텐츠 후보 3개 조사':'Savingio 고성과 콘텐츠 확장 후보와 내부링크 개선안 조사';
        reason=gap>0?`월 목표 대비 ${Math.round(gap).toLocaleString()}원 격차가 있습니다.`:'현재 성과를 유지하면서 확장 가능한 주제를 찾습니다.';
      }else if(b.name==='ITEM Studio'){
        title=roi>=100?'ITEM Studio 고ROI 상품 후보와 쇼츠 전환 실험 기획':'ITEM Studio 판매 후보 5개와 저비용 검증 계획 수립';
        reason=roi>=100?`현재 ROI ${roi}%로 확장 검토 가치가 있습니다.`:'수익 데이터가 부족해 작은 실험부터 검증합니다.';
      }else{
        title='HAVEN 공통 자동화에서 가장 많은 반복 시간을 줄일 개선 과제 선정';
        reason='직접 매출보다 운영비와 반복 작업 감소 효과를 검증합니다.';
      }
      if(index===0)priority='높음';
      ideas.push({id:uid('PROP'),title,division:b.name,priority,reason,score:b.score,estimatedImpact:Math.max(100000,Math.round((gap||b.monthlyCapacity*.15)/10000)*10000),risk:'LOW',status:'PROPOSED',createdAt:now(),missionId:''});
    });
    if(pending>0)ideas.unshift({id:uid('PROP'),title:`대표 승인 대기 ${pending}건 우선 검토`,division:'공통 본부',priority:'긴급',reason:'승인 대기가 다음 실행과 수익 반영을 막고 있습니다.',score:100,estimatedImpact:0,risk:'LOW',status:'ADVISORY',createdAt:now(),missionId:''});
    if(active>=state.settings.maxDailyMissions)ideas.forEach(x=>{if(x.status==='PROPOSED')x.status='HOLD'});
    return ideas;
  }

  function runCycle({createMissions=state.settings.autoCreate}={}){
    const snapshot=companySnapshot();
    const ideas=buildIdeas(snapshot);
    const created=[];
    state.proposals.unshift(...ideas);
    state.proposals=state.proposals.slice(0,100);
    if(createMissions&&window.HavenEngine){
      ideas.filter(x=>x.status==='PROPOSED').slice(0,state.settings.maxDailyMissions).forEach(p=>{
        const mission=window.HavenEngine.createMission({title:p.title,division:p.division,priority:p.priority,projectName:'Autonomous CEO Initiatives'});
        p.status='MISSION_CREATED';p.missionId=mission.id;created.push(mission.id);
      });
    }
    const cycle={id:uid('CYCLE'),at:now(),proposalCount:ideas.length,missionCount:created.length,createdMissionIds:created,metrics:{pendingApprovals:(snapshot.company.approvals||[]).filter(x=>x.status==='PENDING').length,activeMissions:(snapshot.company.missions||[]).filter(x=>['QUEUED','RUNNING'].includes(x.status)).length,revenue:snapshot.finance.revenue||0,profit:snapshot.finance.profit||0,roi:snapshot.finance.roi||0}};
    state.cycles.unshift(cycle);state.cycles=state.cycles.slice(0,60);state.settings.lastCycleAt=cycle.at;save();return cycle;
  }

  function approveProposal(id){
    const p=state.proposals.find(x=>x.id===id);if(!p||p.missionId||!window.HavenEngine)return null;
    const mission=window.HavenEngine.createMission({title:p.title,division:p.division,priority:p.priority,projectName:'Autonomous CEO Initiatives'});
    p.status='MISSION_CREATED';p.missionId=mission.id;save();return mission;
  }
  function rejectProposal(id,note=''){const p=state.proposals.find(x=>x.id===id);if(p){p.status='REJECTED';p.note=note;p.decidedAt=now();save()}return p}
  function setSettings(next={}){state.settings={...state.settings,...next,maxDailyMissions:Math.max(1,Math.min(10,Number(next.maxDailyMissions??state.settings.maxDailyMissions)||3))};save();return state.settings}
  function summary(){return{enabled:state.settings.enabled,autoCreate:state.settings.autoCreate,lastCycleAt:state.settings.lastCycleAt,totalCycles:state.cycles.length,openProposals:state.proposals.filter(x=>['PROPOSED','HOLD','ADVISORY'].includes(x.status)).length,createdMissions:state.proposals.filter(x=>x.status==='MISSION_CREATED').length}}
  function clear(){state=seed();save()}
  window.HavenAutonomousCEO={runCycle,buildIdeas,approveProposal,rejectProposal,setSettings,getState:()=>state,summary,clear};
})();