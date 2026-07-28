(() => {
  'use strict';

  const MEMORY_KEY = 'haven_company_memory_v1';
  const QUEUE_KEY = 'haven_company_queue_v1';

  const RULES = [
    { words:['애드센스','승인','색인','콘텐츠','SEO','savingio'], division:'Savingio', intent:'CONTENT_GROWTH', project:'Savingio Growth', departments:['research','planning','copy','production','qa'], revenue:'MEDIUM' },
    { words:['상품','쿠팡','판매','쇼츠','아이템','item'], division:'ITEM Studio', intent:'PRODUCT_REVENUE', project:'ITEM Studio Revenue Lab', departments:['research','planning','copy','production','qa'], revenue:'HIGH' },
    { words:['해외','외국인','태국','인도네시아','번역','여행'], division:'공통 본부', intent:'GLOBAL_EXPANSION', project:'HAVEN Global Lab', departments:['research','planning','copy','production','qa'], revenue:'MEDIUM' },
    { words:['자동화','프로그램','시스템','어드민','hq','개발'], division:'공통 본부', intent:'SYSTEM_BUILD', project:'HAVEN Company OS', departments:['ceo','planning','production','qa'], revenue:'INDIRECT' }
  ];

  const read = (key, fallback) => {
    try { return Object.assign(fallback, JSON.parse(localStorage.getItem(key) || '{}')); }
    catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const now = () => new Date().toISOString();
  const uid = p => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`.toUpperCase();

  let memory = read(MEMORY_KEY, { version:1, patterns:[], outcomes:[], decisions:[] });
  let queue = read(QUEUE_KEY, { version:1, jobs:[] });

  function scoreRule(text, rule) {
    const lower = text.toLowerCase();
    return rule.words.reduce((score, word) => score + (lower.includes(word.toLowerCase()) ? 1 : 0), 0);
  }

  function inferPriority(text, requested='높음') {
    if (/긴급|오늘|즉시|바로|지금/.test(text)) return '긴급';
    if (/나중|천천히|보류/.test(text)) return '보통';
    return requested || '높음';
  }

  function estimateRevenue(intent, text) {
    const base = { PRODUCT_REVENUE:75, CONTENT_GROWTH:55, GLOBAL_EXPANSION:48, SYSTEM_BUILD:35, GENERAL:30 }[intent] || 30;
    const urgency = /오늘|이번 주|바로|판매|수익|매출/.test(text) ? 10 : 0;
    const confidence = Math.min(95, base + urgency);
    return {
      confidence,
      grade: confidence >= 70 ? 'HIGH' : confidence >= 45 ? 'MEDIUM' : 'LOW',
      reason: intent === 'PRODUCT_REVENUE' ? '구매 전환과 직접 연결되는 미션' : intent === 'CONTENT_GROWTH' ? '검색 유입과 광고 승인·수익 기반을 강화하는 미션' : intent === 'GLOBAL_EXPANSION' ? '신시장 검증이 필요한 확장 미션' : intent === 'SYSTEM_BUILD' ? '직접 매출보다 반복 작업 제거 효과가 큰 기반 미션' : '수익 연결 조건을 추가 확인해야 하는 일반 미션'
    };
  }

  function analyze(input) {
    const text = String(input.title || '').trim();
    const ranked = RULES.map(rule => ({ rule, score:scoreRule(text, rule) })).sort((a,b) => b.score-a.score);
    const winner = ranked[0]?.score > 0 ? ranked[0].rule : null;
    const intent = winner?.intent || 'GENERAL';
    const division = input.division && input.division !== '자동 판단' ? input.division : (winner?.division || '공통 본부');
    const priority = inferPriority(text, input.priority);
    const revenue = estimateRevenue(intent, text);
    const risk = /저작권|법률|의료|보험|투자|개인정보/.test(text) ? 'HIGH' : /해외|결제|광고/.test(text) ? 'MEDIUM' : 'LOW';
    const decision = {
      id:uid('DEC'),
      at:now(),
      original:text,
      intent,
      division,
      projectName:input.projectName || winner?.project || `${division} Operations`,
      priority,
      departments:winner?.departments || ['ceo','research','planning','copy','production','qa'],
      revenue,
      risk,
      approvalRequired:true,
      successCriteria:[
        '요청 목적과 산출물이 일치할 것',
        '근거·정책·저작권 위험을 QA에서 확인할 것',
        '대표 승인 전 외부 배포하지 않을 것'
      ],
      summary:`${division}의 ${intent} 미션으로 분류했습니다. 우선순위는 ${priority}, 수익 가능성은 ${revenue.grade}, 위험도는 ${risk}입니다.`
    };
    memory.decisions.unshift(decision);
    memory.decisions = memory.decisions.slice(0,200);
    write(MEMORY_KEY, memory);
    return decision;
  }

  function enqueue(mission) {
    const priorityWeight = { '긴급':3, '높음':2, '보통':1 }[mission.priority] || 1;
    const job = { id:uid('JOB'), missionId:mission.id, title:mission.title, priority:mission.priority, weight:priorityWeight, status:'QUEUED', createdAt:now(), startedAt:null, completedAt:null };
    queue.jobs.push(job);
    queue.jobs.sort((a,b) => b.weight-a.weight || new Date(a.createdAt)-new Date(b.createdAt));
    write(QUEUE_KEY, queue);
    return job;
  }

  function markJob(missionId, status) {
    const job = queue.jobs.find(x => x.missionId === missionId && !['COMPLETED','FAILED'].includes(x.status));
    if (!job) return;
    job.status = status;
    if (status === 'RUNNING' && !job.startedAt) job.startedAt = now();
    if (['COMPLETED','FAILED'].includes(status)) job.completedAt = now();
    write(QUEUE_KEY, queue);
  }

  function rememberOutcome({ missionId, title, status, score=0, note='' }) {
    const outcome = { id:uid('MEM'), missionId, title, status, score, note, at:now() };
    memory.outcomes.unshift(outcome);
    memory.outcomes = memory.outcomes.slice(0,300);
    if (status === 'APPROVED') {
      memory.patterns.unshift({ id:uid('PAT'), sourceMissionId:missionId, title, score, learnedAt:now(), rule:'승인된 구조와 QA 기준을 유사 미션에 우선 적용' });
      memory.patterns = memory.patterns.slice(0,100);
    }
    write(MEMORY_KEY, memory);
    return outcome;
  }

  const getMemory = () => memory;
  const getQueue = () => queue;
  const clearBrain = () => {
    memory = { version:1, patterns:[], outcomes:[], decisions:[] };
    queue = { version:1, jobs:[] };
    write(MEMORY_KEY, memory);
    write(QUEUE_KEY, queue);
  };

  window.HavenCompanyBrain = { analyze, enqueue, markJob, rememberOutcome, getMemory, getQueue, clearBrain };
})();