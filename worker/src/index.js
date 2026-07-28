const json=(data,status=200,origin='*')=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=UTF-8','access-control-allow-origin':origin,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,x-haven-token','cache-control':'no-store'}});

const roles={
  ceo:'당신은 HAVEN AI 회사의 CEO·PM입니다. 대표 지시를 실행 가능한 단계, 완료 조건, 위험요소로 분해하세요.',
  research:'당신은 시장조사팀입니다. 확인되지 않은 수치나 사실을 꾸며내지 말고, 수요·검색의도·경쟁·계절성·수익 연결 가능성을 구조적으로 조사하세요.',
  planning:'당신은 상품기획팀입니다. 전달받은 조사 결과를 대상 고객, 문제, 가치제안, 산출물, CTA, 금지사항이 포함된 실행 기획서로 바꾸세요.',
  copy:'당신은 카피팀입니다. 과장 없이 후킹, 본문 흐름, 제목, 설명, CTA 초안을 한국어로 작성하세요.',
  production:'당신은 제작본부입니다. ITEM Studio 또는 Savingio에서 바로 사용할 수 있도록 장면·콘텐츠 구조·필수 입력값·제작 체크리스트를 만드세요.',
  qa:'당신은 QA·감사실입니다. 구조, 사실성, 과장, 저작권, 정책, 누락을 검사하고 PASS 또는 FIX와 구체적인 수정사항을 출력하세요.'
};

function buildInput(body){
  const role=roles[body?.task?.employeeId]||roles.ceo;
  return `${role}\n\n[대표 지시]\n${body?.mission?.title||''}\n\n[사업부]\n${body?.mission?.division||''}\n\n[우선순위]\n${body?.mission?.priority||''}\n\n[현재 업무 입력]\n${body?.task?.input||''}\n\n[이전 부서 결과]\n${body?.previousOutput||''}\n\n결과는 다음 부서가 바로 사용할 수 있는 명확한 한국어 업무 문서로 작성하세요.`;
}

async function callOpenAI(env,input){
  if(!env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY secret is missing');
  const model=env.OPENAI_MODEL||'gpt-5-mini';
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'authorization':`Bearer ${env.OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model,input,max_output_tokens:1800})});
  const data=await response.json();
  if(!response.ok)throw new Error(data?.error?.message||`OpenAI HTTP ${response.status}`);
  const output=data.output_text||data.output?.flatMap(x=>x.content||[]).map(x=>x.text||'').join('\n')||'';
  return {output,provider:'openai',model,usage:data.usage||null};
}

export default {
  async fetch(request,env){
    const origin=env.ALLOWED_ORIGIN||'*';
    if(request.method==='OPTIONS')return json({ok:true},204,origin);
    const url=new URL(request.url);
    if(url.pathname==='/health')return json({ok:true,status:'READY',provider:env.AI_PROVIDER||'openai',model:env.OPENAI_MODEL||'gpt-5-mini'},200,origin);
    if(url.pathname!=='/v1/execute'||request.method!=='POST')return json({ok:false,error:'Not found'},404,origin);
    if(env.HAVEN_ACCESS_TOKEN&&request.headers.get('x-haven-token')!==env.HAVEN_ACCESS_TOKEN)return json({ok:false,error:'Unauthorized'},401,origin);
    try{
      const body=await request.json();
      if(!body?.mission?.title||!body?.task?.employeeId)return json({ok:false,error:'Invalid mission or task payload'},400,origin);
      const result=await callOpenAI(env,buildInput(body));
      return json({ok:true,mode:'AI',...result,completedAt:new Date().toISOString()},200,origin);
    }catch(error){return json({ok:false,error:error.message||'Execution failed'},500,origin)}
  }
};