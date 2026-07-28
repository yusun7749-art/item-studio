(() => {
  'use strict';
  const KEY='haven_ai_connector_v2';
  const defaults={endpoint:'',accessToken:'',mode:'auto'};
  const load=()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||localStorage.getItem('haven_ai_connector_v1')||'{}')}}catch{return {...defaults}}};
  let config=load();
  const routerReady=new Promise(resolve=>{if(window.HavenAIRouter){resolve(true);return}const s=document.createElement('script');s.src='ai-router.js';s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.head.appendChild(s)});
  const save=next=>{config={...config,...next};localStorage.setItem(KEY,JSON.stringify(config));return config};
  const configured=()=>Boolean(config.endpoint&&/^https:\/\//.test(config.endpoint));
  async function execute({mission,task,previousOutput}){
    await routerReady;
    const route=window.HavenAIRouter?.select({mission,task})||null;
    if(!configured()){window.HavenAIRouter?.markFallback();return {ok:false,mode:'RULE',error:'AI API endpoint is not configured',route}};
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),90000);
    try{
      const response=await fetch(config.endpoint.replace(/\/$/,'')+'/v1/execute',{
        method:'POST',
        headers:{'content-type':'application/json',...(config.accessToken?{'x-haven-token':config.accessToken}:{})},
        body:JSON.stringify({mission:{id:mission.id,title:mission.title,division:mission.division,priority:mission.priority},task:{id:task.id,employeeId:task.employeeId,employee:task.employee,tool:task.tool,input:task.input},routing:route?{type:route.type,provider:route.chosen.provider,model:route.chosen.model,strategy:route.strategy,alternatives:route.alternatives}:null,previousOutput:previousOutput||'',requestedAt:new Date().toISOString()}),
        signal:controller.signal
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
      if(!data.output)throw new Error('AI response output is empty');
      return {ok:true,mode:data.mode||'AI',provider:data.provider||route?.chosen.provider||'unknown',model:data.model||route?.chosen.model||'',output:String(data.output),usage:data.usage||null,route};
    }catch(error){window.HavenAIRouter?.markFallback();return {ok:false,mode:'RULE',error:error.name==='AbortError'?'AI request timeout':error.message,route}}
    finally{clearTimeout(timer)}
  }
  async function health(){if(!configured())return {ok:false,status:'NOT_CONFIGURED'};try{const r=await fetch(config.endpoint.replace(/\/$/,'')+'/health',{headers:config.accessToken?{'x-haven-token':config.accessToken}:{}});return r.ok?await r.json():{ok:false,status:`HTTP_${r.status}`}}catch(error){return {ok:false,status:'OFFLINE',error:error.message}}
  window.HavenAIConnector={getConfig:()=>({...config}),save,configured,execute,health};
})();