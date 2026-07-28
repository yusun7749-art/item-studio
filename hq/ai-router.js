(() => {
  'use strict';
  const KEY='haven_ai_router_v1';
  const DEFAULTS={
    strategy:'balanced',
    providers:{
      openai:{enabled:true,label:'OpenAI',models:['gpt-5','gpt-5-mini'],cost:70,speed:82,quality:92},
      anthropic:{enabled:true,label:'Claude',models:['claude-sonnet','claude-haiku'],cost:76,speed:74,quality:91},
      google:{enabled:true,label:'Gemini',models:['gemini-pro','gemini-flash'],cost:58,speed:90,quality:86},
      image:{enabled:false,label:'Image AI',models:['image-gen'],cost:80,speed:60,quality:90},
      video:{enabled:false,label:'Video AI',models:['video-gen'],cost:95,speed:35,quality:88}
    },
    routes:[],stats:{decisions:0,fallbacks:0,byProvider:{}}
  };
  const load=()=>{try{return {...structuredClone(DEFAULTS),...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return structuredClone(DEFAULTS)}};
  let state=load();
  const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
  const now=()=>new Date().toISOString();
  const uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`.toUpperCase();
  const taskType=({mission={},task={}})=>{const text=`${mission.title||''} ${task.employeeId||''} ${task.input||''}`.toLowerCase();if(/image|이미지|썸네일|디자인/.test(text))return'IMAGE';if(/video|영상|쇼츠|릴스/.test(text))return'VIDEO';if(/code|개발|html|css|javascript|python|프로그램/.test(text))return'CODE';if(/research|시장조사|분석|조사/.test(text))return'RESEARCH';if(/copy|카피|글|콘텐츠|대본/.test(text))return'WRITING';if(/qa|검수|정책|법률/.test(text))return'QA';return'GENERAL'};
  const fit=(type,key,p)=>{const base={openai:80,anthropic:78,google:76,image:20,video:20}[key]||50;const bonus={CODE:{openai:18,anthropic:10,google:8},RESEARCH:{google:16,anthropic:12,openai:10},WRITING:{anthropic:18,openai:14,google:8},QA:{openai:15,anthropic:15,google:10},IMAGE:{image:80},VIDEO:{video:80},GENERAL:{openai:12,anthropic:10,google:10}}[type]?.[key]||0;const strategy=state.strategy==='quality'?p.quality*.35:state.strategy==='speed'?p.speed*.35:state.strategy==='cost'?(100-p.cost)*.35:(p.quality+p.speed+(100-p.cost))/9;return base+bonus+strategy};
  function select(payload){const type=taskType(payload);const ranked=Object.entries(state.providers).filter(([,p])=>p.enabled).map(([key,p])=>({provider:key,label:p.label,model:p.models[0]||'',score:Math.round(fit(type,key,p)),cost:p.cost,speed:p.speed,quality:p.quality})).sort((a,b)=>b.score-a.score);const chosen=ranked[0]||{provider:'rule',label:'Rule Engine',model:'fallback',score:0};const route={id:uid('ROUTE'),at:now(),type,missionId:payload.mission?.id||'',taskId:payload.task?.id||'',chosen,alternatives:ranked.slice(1,3),strategy:state.strategy};state.routes.unshift(route);state.routes=state.routes.slice(0,300);state.stats.decisions++;state.stats.byProvider[chosen.provider]=(state.stats.byProvider[chosen.provider]||0)+1;save();return route}
  function markFallback(){state.stats.fallbacks++;save()}
  function updateProvider(key,patch){if(!state.providers[key])throw new Error('Unknown provider');state.providers[key]={...state.providers[key],...patch};save();return state.providers[key]}
  function setStrategy(value){if(!['balanced','quality','speed','cost'].includes(value))throw new Error('Invalid strategy');state.strategy=value;save()}
  function summary(){return{strategy:state.strategy,enabled:Object.values(state.providers).filter(x=>x.enabled).length,decisions:state.stats.decisions,fallbacks:state.stats.fallbacks,last:state.routes[0]||null}}
  window.HavenAIRouter={select,markFallback,updateProvider,setStrategy,getState:()=>state,summary};
})();