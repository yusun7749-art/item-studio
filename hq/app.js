const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const departments=[
{name:'CEO 리나',role:'목표를 실행 계획으로 변환',score:96},
{name:'시장조사팀',role:'상품·수요·경쟁 기회 조사',score:92},
{name:'상품기획팀',role:'판매 상품과 수익 구조 설계',score:89},
{name:'콘텐츠팀',role:'대본·글·상세페이지 제작',score:94},
{name:'디자인·영상팀',role:'이미지·쇼츠·썸네일 제작',score:91},
{name:'QA 본부',role:'사실·후킹·링크·정책 검수',score:98},
{name:'배포·홍보팀',role:'채널별 발행과 반응 관리',score:87},
{name:'데이터·학습팀',role:'성과 분석과 다음 전략 개선',score:93}
];
const steps=['목표 접수','전략 수립','제작','QA','배포','학습'];
let state=JSON.parse(localStorage.getItem('haven-hq-state')||'null')||{goal:'Savingio와 ITEM Studio의 수익 기회를 조사하고 오늘 실행할 작업을 만들어라.',project:'ITEM Studio',tasks:[],run:0};
function save(){localStorage.setItem('haven-hq-state',JSON.stringify(state))}
function time(){return new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}
function renderEmployees(){const box=$('#employees');box.innerHTML=departments.map(d=>`<article class="card employee"><span class="status-dot"></span><h3>${d.name}</h3><p>${d.role}</p><div class="score">성과지수 ${d.score}점</div></article>`).join('')}
function addFeed(title,text){const item=document.createElement('div');item.className='feed-item';item.innerHTML=`<strong>${title}</strong><span>${time()} · ${text}</span>`;$('#feed').prepend(item)}
function setStep(index){$$('.step').forEach((el,i)=>{el.classList.toggle('done',i<index);el.classList.toggle('active',i===index)})}
function renderTasks(){const box=$('#taskList');if(!state.tasks.length){box.innerHTML='<div class="feed-item"><strong>아직 실행 중인 프로젝트가 없습니다.</strong><span>대표 목표를 입력하고 업무 시작을 누르세요.</span></div>';return}box.innerHTML=state.tasks.map(t=>`<div class="task"><div><strong>${t.title}</strong><small>${t.owner} · ${t.note}</small></div><span class="pill ${t.status==='PASS'?'pass':t.status==='대기'?'wait':''}">${t.status}</span><button class="secondary" onclick="advanceTask('${t.id}')">다음 단계</button></div>`).join('')}
function buildTasks(goal,project){const key=goal.slice(0,28);return[
{id:crypto.randomUUID(),title:`${project} 시장 기회 조사`,owner:'시장조사팀',note:`목표: ${key}`,status:'진행 중'},
{id:crypto.randomUUID(),title:'수익 상품·콘텐츠 패키지 설계',owner:'상품기획팀',note:'조사 결과를 판매 가능한 실행안으로 변환',status:'대기'},
{id:crypto.randomUUID(),title:'콘텐츠·쇼츠 제작본 생성',owner:'콘텐츠·영상팀',note:'대본, 썸네일, 영상 프롬프트 생성',status:'대기'},
{id:crypto.randomUUID(),title:'정책·품질·링크 검수',owner:'QA 본부',note:'문제 발견 시 제작팀 자동 반려',status:'대기'},
{id:crypto.randomUUID(),title:'채널 배포 및 성과 수집',owner:'배포·데이터팀',note:'승인된 결과만 발행 준비',status:'대기'}]}
function startRun(){const goal=$('#goal').value.trim();const project=$('#project').value;if(!goal){addFeed('CEO','목표가 비어 있어 업무를 시작하지 않았습니다.');return}state.goal=goal;state.project=project;state.run++;state.tasks=buildTasks(goal,project);save();renderTasks();setStep(0);$('#currentGoal').textContent=goal;$('#activeProjects').textContent='1';$('#workingStaff').textContent='8 / 8';addFeed('CEO 리나',`${project} 목표를 접수하고 5개 작업으로 분해했습니다.`);let i=0;const messages=['시장조사팀에 수요·경쟁 조사를 배정했습니다.','상품기획팀이 수익 구조 초안을 준비합니다.','콘텐츠·영상팀에 제작 대기열을 만들었습니다.','QA 기준표를 적용했습니다.','배포팀은 QA PASS 결과만 받도록 잠갔습니다.','학습팀이 성과 기록을 준비했습니다.'];const timer=setInterval(()=>{setStep(i);addFeed(steps[i],messages[i]);i++;if(i===steps.length){clearInterval(timer);setStep(5);$('#systemState').textContent='운영 중';}},420)}
function advanceTask(id){const order=['대기','진행 중','QA','PASS'];const task=state.tasks.find(t=>t.id===id);if(!task)return;let idx=order.indexOf(task.status);task.status=order[Math.min(idx+1,order.length-1)];if(task.status==='PASS')task.note='검수 완료 · 다음 부서 인계 가능';save();renderTasks();const passed=state.tasks.filter(t=>t.status==='PASS').length;$('#qaPass').textContent=`${passed} / ${state.tasks.length}`;addFeed(task.owner,`${task.title} 상태가 ${task.status}(으)로 변경되었습니다.`)}
function resetHQ(){state.tasks=[];save();renderTasks();setStep(-1);$('#activeProjects').textContent='0';$('#workingStaff').textContent='0 / 8';$('#qaPass').textContent='0 / 0';$('#systemState').textContent='대기';addFeed('System','실행 대기열을 초기화했습니다.')}
window.advanceTask=advanceTask;$('#startBtn').addEventListener('click',startRun);$('#resetBtn').addEventListener('click',resetHQ);$('#goal').value=state.goal;$('#project').value=state.project;$('#currentGoal').textContent=state.goal;renderEmployees();renderTasks();setStep(-1);addFeed('System','HAVEN AI Headquarters가 준비되었습니다.');