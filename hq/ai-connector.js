(() => {
  'use strict';
  const KEY='haven_ai_connector_v1';
  const defaults={endpoint:'',accessToken:'',mode:'auto'};
  const load=()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...defaults}}};
  let config=load();
  const save=next=>{config={...config,...next};localStorage.setItem(KEY,JSON.stringify(config));return config};
  const configured=()=>Boolean(config.endpoint&&/^https:\/\//.test(config.endpoint));
  async function execute({mission,task,previousOutput}){
    if(!configured())return {ok:false,mode:'RULE',error:'AI API endpoint is not configured'};
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),90000);
    try{
      const response=await fetch(config.endpoint.replace(/\/$/,'')+'/v1/execute',{
        method:'POST',
        headers:{'content-type':'application/json',...(config.accessToken?{'x-haven-token':config.accessToken}:{})},
        body:JSON.stringify({mission:{id:mission.id,title:mission.title,division:mission.division,priority:mission.priority},task:{id:task.id,employeeId:task.employeeId,employee:task.employee,tool:task.tool,input:task.input},previousOutput:previousOutput||'',requestedAt:new Date().toISOString()}),
        signal:controller.signal
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
      if(!data.output)throw new Error('AI response output is empty');
      return {ok:true,mode:data.mode||'AI',provider:data.provider||'unknown',model:data.model||'',output:String(data.output),usage:data.usage||null};
    }catch(error){return {ok:false,mode:'RULE',error:error.name==='AbortError'?'AI request timeout':error.message}}
    finally{clearTimeout(timer)}
  }
  async function health(){
    if(!configured())return {ok:false,status:'NOT_CONFIGURED'};
    try{const r=await fetch(config.endpoint.replace(/\/$/,'')+'/health',{headers:config.accessToken?{'x-haven-token':config.accessToken}:{}});return r.ok?await r.json():{ok:false,status:`HTTP_${r.status}`}}catch(error){return {ok:false,status:'OFFLINE',error:error.message}}
  }
  window.HavenAIConnector={getConfig:()=>({...config}),save,configured,execute,health};
})();