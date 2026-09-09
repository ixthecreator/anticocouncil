(() => {
  'use strict';
  const main = document.getElementById('main');
  const overviewHTML = main.innerHTML;
  const dialog = document.getElementById('dialog');
  const storageKey = 'antico-ui-preview-v1';
  const seed = { attendance: false, votes: {}, tasks: {
    t1: { status: '进行中', note: '已整理选题方向，正在确认作者与交稿时间。' },
    t2: { status: '未开始', note: '待收到场地可用日期。' },
    t3: { status: '进行中', note: '已完成资料清点，剩余文件正在整理。' },
    t4: { status: '已完成', note: '已提交并归档。' },
    t5: { status: '已完成', note: '报名名单已确认。' },
    t6: { status: '已完成', note: '会议纪要已完成复核。' }
  }};
  const proposals = [
    {id:'p1',title:'关于秋季公共阅读沙龙的举办提案',group:'活动组',author:'周宁',status:'表决中',due:'9 月 9 日 21:00',code:'P-026',summary:'拟于九月下旬举办一期公共阅读沙龙，以“我们如何共同生活”为主题，邀请成员与新朋友围绕公共空间、日常协作展开讨论。',plan:['活动时间暂定 9 月 26 日 14:00–16:30，场地由活动组确认。','采用导读、分组讨论与共同记录三部分，计划开放 24 个名额。','活动组负责报名与现场协调，编辑组整理会后文字记录。'],counts:{agree:7,disagree:1,abstain:1}},
    {id:'p2',title:'九月编辑专题与稿件排期',group:'编辑组',author:'林澈',status:'表决中',due:'9 月 11 日 18:00',code:'P-027',summary:'本月拟围绕“协作的日常”组织三篇文章，结合成员实践、公共阅读与活动记录，形成持续更新的议会栏目。',plan:['9 月 15 日前确认三篇文章的选题与作者。','9 月 20 日前提交初稿，9 月 24 日完成交叉审阅。','每篇文章由一位编辑负责统筹，发布前取得作者确认。'],counts:{agree:5,disagree:0,abstain:2}},
    {id:'p3',title:'议会资料库分类与归档规范',group:'秘书组',author:'许言',status:'待讨论',due:'本次例会讨论',code:'P-028',summary:'建议统一会议文件与活动资料的命名、分类和归档方式，帮助成员更容易找到记录，并保留决议与执行事项之间的关联。',plan:['按会议、议题、活动与组织资料四类整理。','文件名称使用日期、主题与版本号。','已确认的纪要保留修订记录。'],counts:{agree:0,disagree:0,abstain:0}}
  ];
  const tasks = [
    {id:'t1',code:'E-018',title:'提交九月编辑专题排期初稿，并确认各篇稿件的负责编辑、作者与最终交付时间',owner:'林澈',group:'编辑组',due:'2026-09-09',displayDue:'9 月 9 日',source:'第 17 次例会 · 决议 02',description:'整理九月的选题、负责编辑与稿件截止日期，提交下一轮讨论。'},
    {id:'t2',code:'E-019',title:'确认秋季沙龙场地与时间',owner:'周宁',group:'活动组',due:'2026-09-14',displayDue:'9 月 14 日',source:'第 17 次例会 · 决议 01',description:'联系候选场地并确认容量、可用时段与使用条件，提交场地建议。'},
    {id:'t3',code:'E-020',title:'整理八月活动资料与附件',owner:'许言',group:'秘书组',due:'2026-09-12',displayDue:'9 月 12 日',source:'第 17 次例会 · 决议 03',description:'整理活动文字记录与资料附件，按活动日期归档。'},
    {id:'t4',code:'E-015',title:'完成七月资料目录校对',owner:'陈禾',group:'秘书组',due:'2026-09-03',displayDue:'9 月 3 日',source:'第 16 次例会',description:'复核资料标题、作者与日期，修正缺失信息。'},
    {id:'t5',code:'E-016',title:'确认阅读小组报名名单',owner:'周宁',group:'活动组',due:'2026-09-04',displayDue:'9 月 4 日',source:'第 16 次例会',description:'核对报名与参与信息，形成最终名单。'},
    {id:'t6',code:'E-017',title:'复核八月工作会议纪要',owner:'林澈',group:'编辑组',due:'2026-09-05',displayDue:'9 月 5 日',source:'第 17 次例会',description:'完成会议纪要的文字与决议核对。'}
  ];
  const meetings = [
    {id:'m18',title:'九月工作例会',number:'18',date:'2026-09-09',month:'9',day:'09',weekday:'星期三',time:'19:30–21:00',place:'线上会议',status:'待开始',description:'秋季沙龙安排、九月编辑计划与资料归档。'},
    {id:'m19',title:'九月中期工作例会',number:'19',date:'2026-09-16',month:'9',day:'16',weekday:'星期三',time:'19:30–21:00',place:'线上会议',status:'筹备中',description:'跟进编辑进展与秋季活动准备。'},
    {id:'m17',title:'八月工作回顾与九月安排',number:'17',date:'2026-09-02',month:'9',day:'02',weekday:'星期三',time:'19:30–21:00',place:'线上会议',status:'已归档',description:'八月工作回顾、活动安排与会后执行分工。'}
  ];
  const records = [
    {id:'r17',title:'八月工作回顾与九月安排',date:'2026-09-02',number:'17',attendees:'11 / 12',summary:'会议回顾八月活动与编辑工作，确认九月的主要安排，并明确三项会后执行事项。',decisions:['开展秋季公共阅读沙龙的筹备工作，由活动组负责提出具体方案。','编辑组提交九月编辑专题排期初稿，并确认各篇稿件的负责编辑、作者与最终交付时间，明确选题、作者与交稿时间。','秘书组完成八月活动资料清点，补齐记录与附件。']},
    {id:'r16',title:'八月公共阅读与资料整理',date:'2026-08-26',number:'16',attendees:'10 / 12',summary:'会议讨论阅读小组的参与安排，并确认资料目录校对与记录复核工作。',decisions:['完成阅读小组报名名单核对。','完成七月资料目录校对。']},
    {id:'r15',title:'八月编辑工作例会',date:'2026-08-19',number:'15',attendees:'12 / 12',summary:'会议交流稿件进展与编辑协作情况，确定下一阶段的交叉审阅安排。',decisions:['为每篇稿件安排一名交叉审阅成员。','统一作者简介与文章日期格式。']}
  ];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state = structuredClone(seed), storageWarning = '';
  try {
    const raw = localStorage.getItem(storageKey);
    if(raw) {
      const saved = JSON.parse(raw);
      if(typeof saved.attendance !== 'boolean' || !saved.votes || !saved.tasks) throw new Error('invalid');
      for(const [key,vote] of Object.entries(saved.votes)) {
        if(!['p1','p2'].includes(key) || !['agree','disagree','abstain'].includes(vote.choice) || typeof vote.reason !== 'string') throw new Error('invalid');
      }
      for(const id of Object.keys(seed.tasks)) {
        if(!saved.tasks[id] || !['未开始','进行中','已完成'].includes(saved.tasks[id].status) || typeof saved.tasks[id].note !== 'string') throw new Error('invalid');
      }
      state = saved;
    }
  } catch { storageWarning = '无法读取本地记录，当前显示初始示例。原存储尚未修改；如需继续保存，请先重置示例。'; }
  const statusColor = s => ({'表决中':'blue','待开始':'purple','筹备中':'grey','待讨论':'grey','已归档':'green','已完成':'green','进行中':'blue','未开始':'grey'}[s] || 'grey');
  const tag = (label,color=statusColor(label)) => `<span class="tag ${color}">${esc(label)}</span>`;
  const completed = () => tasks.filter(t=>state.tasks[t.id].status==='已完成').length;
  function notify(message) { const box=document.getElementById('notice');box.textContent=message;box.classList.add('visible');clearTimeout(notify.timer);notify.timer=setTimeout(()=>box.classList.remove('visible'),4800); }
  function commit(next) {
    if(storageWarning) throw new Error(storageWarning);
    try { localStorage.setItem(storageKey,JSON.stringify(next)); } catch { throw new Error('无法保存到此浏览器。请检查浏览器是否允许本地存储后重试，当前修改尚未保存。'); }
    state=next;
  }
  function setAttendance(value) {
    if(typeof value !== 'boolean') throw new Error('签到状态必须为 true 或 false。');
    const next=structuredClone(state);next.attendance=value;commit(next);render(false);notify(value?'已完成本次例会签到。':'已撤销本次例会签到。');
    return {meetingId:'m18',attended:state.attendance};
  }
  function shell(title,eyebrow,description,content,parent) {
    return `<div class="breadcrumb"><a href="#overview">成员工作台</a><span>/</span>${parent?`<a href="#${parent.route}">${parent.title}</a><span>/</span>`:''}${esc(title)}</div><div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${esc(title)}</h1>${description?`<p class="lead">${esc(description)}</p>`:''}</div></div>${content}`;
  }
  function summary(rows) {return `<dl class="summary-list">${rows.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`).join('')}</dl>`;}
  function showOverview() {
    let html=overviewHTML;
    const needs=[];
    if(!state.votes.p1) needs.push(`<a class="action-item" href="#proposal/p1"><span class="action-heading"><strong>参与沙龙提案表决</strong>${tag('今日截止','amber')}</span><span class="meta">请在 21:00 前提交意见</span></a>`);
    if(state.tasks.t1.status!=='已完成') needs.push(`<a class="action-item" href="#task/t1"><span class="action-heading"><strong>提交九月编辑专题排期初稿，并确认各篇稿件的负责编辑、作者与最终交付时间</strong>${tag('今日截止','amber')}</span><span class="meta">执行事项 E-018 · 编辑组</span></a>`);
    if(!state.attendance) needs.push(`<a class="action-item" href="#meeting/m18"><strong>完成本次例会签到</strong><span class="meta">九月工作例会 · 19:30 开始</span></a>`);
    html=html.replace(/<section class="action-panel">[\s\S]*?<\/section>/,`<section class="action-panel"><div class="section-title"><h2>需要我处理</h2><span class="number-label">${String(needs.length).padStart(2,'0')}</span></div>${needs.join('')||'<p class="empty-small">当前待办已处理。你可以继续查阅会议议程与其他议题。</p>'}</section>`);
    html=html.replace('3 / 6 已完成',`${completed()} / 6 已完成`).replace('width:50%',`width:${completed()/6*100}%`);
    if(state.attendance) html=html.replace('查看议程与签到','查看议程 · 已签到');
    return html;
  }
  function showMeetings() {
    return shell('例会与议程','MEETINGS & AGENDAS','查看近期例会、参与签到，或回顾已经结束的会议。',`<div class="list-layout"><aside class="filter-panel"><h2>筛选会议</h2><label for="meeting-filter">会议范围</label><select id="meeting-filter"><option value="upcoming">近期会议</option><option value="all">全部会议</option><option value="archived">已归档</option></select><div class="inset-note">示例日程以 2026 年 9 月 9 日为基准。</div></aside><section><div class="results-heading"><h2>会议日程</h2><span id="meeting-count" class="muted"></span></div><div id="meeting-results"></div></section></div>`);
  }
  function meetingResults(filter='upcoming') {
    const list=meetings.filter(m=>filter==='all'||(filter==='archived'?m.status==='已归档':m.status!=='已归档'));
    document.getElementById('meeting-count').textContent=`${list.length} 场会议`;
    document.getElementById('meeting-results').innerHTML=list.map(m=>`<article class="meeting-list-item"><div class="date-block"><span>${m.month} 月</span><strong>${m.day}</strong><small>${m.weekday}</small></div><div class="grow"><div class="item-heading"><p class="meta">第 ${m.number} 次例会 · 2026 年度</p>${tag(m.status)}</div><h2><a href="#${m.id==='m17'?'record/r17':`meeting/${m.id}`}">${m.title}</a></h2><p class="meeting-meta">${m.time} · ${m.place}</p><p class="muted">${m.description}</p></div></article>`).join('');
  }
  function showMeeting(id) {
    const m=meetings.find(m=>m.id===id);if(!m) return notFound();if(id==='m17')return showRecord('r17');
    const isCurrent=id==='m18';
    return shell(m.title,'MEETING '+m.number,`2026 年 ${m.month} 月 ${m.day} 日 · ${m.weekday} · ${m.time}`,`<div class="detail-layout"><article><div class="section-bar"><h2>会议资料</h2>${tag(m.status)}</div>${summary([['会议编号',`AC-2026-${m.number}`],['会议地点',m.place],['主持人','陈禾'],['记录人','许言'],['参与成员',`12 名成员${isCurrent?` · ${8+Number(state.attendance)} 人已签到`:''}`]])}<section class="section"><h2>本次议程</h2>${isCurrent?`<ol class="agenda"><li><span class="agenda-time">19:30</span><div><h3>签到与上次执行事项回顾</h3><p>确认出席情况，汇报尚未完成的执行事项。</p><a href="#tasks">查阅执行督办</a></div></li>${proposals.map((p,i)=>`<li><span class="agenda-time">${['19:40','20:10','20:40'][i]}</span><div><h3><a href="#proposal/${p.id}">${p.title}</a></h3><p>${p.group}汇报 · ${p.status}</p></div></li>`).join('')}<li><span class="agenda-time">20:55</span><div><h3>确认决议与执行分工</h3><p>确认负责人、截止日期与下一次汇报安排。</p></div></li></ol>`:'<div class="inset-note">议程正在筹备中，确认后将显示在此处。</div>'}</section></article><aside><section class="action-panel"><h2>我的参会状态</h2>${isCurrent?`${tag(state.attendance?'已签到':'未签到',state.attendance?'green':'grey')}<p class="spaced muted">以示例成员「林澈」参与本次会议。</p><button class="button ${state.attendance?'secondary':''}" data-action="attendance">${state.attendance?'撤销签到':'确认签到'}</button>`:'<p class="muted">本次会议尚未开放签到。</p>'}</section><section class="section side-section"><h2>相关记录</h2><a href="#record/r17">第 17 次例会纪要</a><p class="spaced muted">讨论前可查阅上次会议已确认的决定与执行分工。</p></section></aside></div>`,{title:'例会与议程',route:'meetings'});
  }
  function showProposals() {
    return shell('议题与表决','PROPOSALS & DECISIONS','了解议题背景，表达意见，并保留决定的依据。',`<div class="toolbar"><label for="proposal-filter">议题状态</label><select id="proposal-filter"><option value="all">全部议题</option><option value="表决中">表决中</option><option value="待讨论">待讨论</option><option value="mine">我已投票</option></select><span id="proposal-count" class="muted"></span></div><div id="proposal-results"></div>`);
  }
  function proposalResults(filter='all') {
    const list=proposals.filter(p=>filter==='all'||(filter==='mine'?Boolean(state.votes[p.id]):p.status===filter));
    document.getElementById('proposal-count').textContent=`${list.length} 项议题`;
    document.getElementById('proposal-results').innerHTML=list.length?list.map(p=>`<article class="proposal-item"><div class="item-heading"><span class="meta">${p.code} · ${p.group}</span><div>${tag(p.status)} ${state.votes[p.id]?tag('我已投票','green'):''}</div></div><h2><a href="#proposal/${p.id}">${p.title}</a></h2><p>${p.summary}</p><div class="proposal-foot"><span>提案人：${p.author}</span><span>${p.status==='表决中'?'截止：':''}${p.due}</span><a href="#proposal/${p.id}">查看议题 <span aria-hidden="true">→</span></a></div></article>`).join(''):'<div class="empty-state"><h2>暂无符合条件的议题</h2><p>选择其他状态，或先参与一项议题的表决。</p></div>';
  }
  function voteResults(p) {
    const my=state.votes[p.id];const entries=[['agree','赞成'],['disagree','反对'],['abstain','弃权']];
    const total=Object.values(p.counts).reduce((a,b)=>a+b,0)+(my?1:0);
    return `<p class="muted">${total} / 12 名成员已投票</p><div class="vote-results">${entries.map(([key,label])=>{const n=p.counts[key]+Number(my?.choice===key);return `<div><div class="vote-count"><span>${label}</span><strong>${n} 票</strong></div><div class="vote-track ${key}"><span style="width:${n/12*100}%"></span></div></div>`}).join('')}</div><p class="meta">未投票：${12-total} 人。当前统计不是最终决议。</p>`;
  }
  function showProposal(id) {
    const p=proposals.find(p=>p.id===id);if(!p)return notFound();const vote=state.votes[id];
    return shell(p.title,p.code+' / '+p.group,'',`<div class="detail-layout"><article><div class="section-bar"><h2>议题概要</h2>${tag(p.status)}</div>${summary([['提案人',p.author],['所属会议','<a href="#meeting/m18">第 18 次例会 · 九月工作例会</a>'],[p.status==='表决中'?'表决截止':'安排',p.due]])}<section class="section prose"><h2>提案背景</h2><p>${p.summary}</p><h2>拟议安排</h2><ol>${p.plan.map(t=>`<li>${t}</li>`).join('')}</ol></section>${p.status==='表决中'?`<section class="section ballot"><h2>我的表决</h2><p class="muted">每位成员计一票。在示例中重新提交将替换你的上一票。</p><form id="vote-form" data-id="${p.id}" novalidate><div id="form-errors"></div><fieldset><legend>你是否赞成这项提案？</legend><div id="choice-error"></div><div class="radio-options">${[['agree','赞成'],['disagree','反对'],['abstain','弃权']].map(([key,label])=>`<label><input type="radio" name="choice" value="${key}" ${vote?.choice===key?'checked':''}><span>${label}</span></label>`).join('')}</div></fieldset><label for="vote-reason">意见说明 <span class="optional">（选填）</span></label><textarea id="vote-reason" name="reason" rows="3" maxlength="500" placeholder="说明你的考虑，供其他成员参考">${esc(vote?.reason||'')}</textarea><p class="field-hint">最多 500 字。意见仅用于当前本地试作。</p><div class="form-actions"><button class="button" type="submit">${vote?'更新我的表决':'提交表决'}</button>${vote?tag('已提交','green'):''}</div></form></section>`:'<div class="inset-note spaced">此议题仍在讨论阶段，尚未开放表决。</div>'}</article><aside><section class="action-panel"><h2>${p.status==='表决中'?'当前表决情况':'讨论安排'}</h2>${p.status==='表决中'?voteResults(p):'<p>请在本次例会中交流分类方式与归档规范，形成具体方案后再提交表决。</p>'}</section><section class="section side-section"><h2>决定之后</h2><p class="muted">通过的议题需明确负责人、完成期限与验收方式，再进入执行督办。</p><a href="#tasks">查看当前执行事项</a></section></aside></div>`,{title:'议题与表决',route:'proposals'});
  }
  function showTasks() {
    return shell('执行督办','FOLLOW-UP & ACCOUNTABILITY','从会议决定到具体行动，持续记录责任与进展。',`<div class="stat-strip"><div><strong>${6-completed()}</strong><span>待完成事项</span></div><div><strong>${tasks.filter(t=>t.owner==='林澈'&&state.tasks[t.id].status!=='已完成').length}</strong><span>由我负责</span></div><div><strong>${completed()}</strong><span>本月已完成</span></div></div><div class="toolbar"><label for="task-filter">查看事项</label><select id="task-filter"><option value="open">待完成</option><option value="mine">由我负责</option><option value="done">已完成</option><option value="all">全部事项</option></select><span id="task-count" class="muted"></span></div><div id="task-results"></div>`);
  }
  function taskResults(filter='open') {
    const list=tasks.filter(t=>filter==='all'||(filter==='mine'?t.owner==='林澈':filter==='done'?state.tasks[t.id].status==='已完成':state.tasks[t.id].status!=='已完成'));
    document.getElementById('task-count').textContent=`${list.length} 项事项`;
    document.getElementById('task-results').innerHTML=list.length?`<div class="table-wrap"><table><caption class="sr-only">执行事项及负责人、完成期限与状态</caption><thead><tr><th scope="col">执行事项</th><th scope="col">负责人</th><th scope="col">截止日期</th><th scope="col">状态</th><th scope="col"><span class="sr-only">操作</span></th></tr></thead><tbody>${list.map(t=>`<tr><th scope="row"><a href="#task/${t.id}">${t.title}</a><span class="meta">${t.code} · ${t.group}</span></th><td>${t.owner}${t.owner==='林澈'?'<span class="mine-label">我</span>':''}</td><td>${t.displayDue}</td><td>${tag(state.tasks[t.id].status)}</td><td><a class="nowrap" href="#task/${t.id}">${t.owner==='林澈'?'更新进展':'查看详情'}</a></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><h2>此范围内没有执行事项</h2><p>你可以切换为全部事项，查看已完成的工作。</p></div>';
  }
  function showTask(id) {
    const t=tasks.find(t=>t.id===id);if(!t)return notFound();const s=state.tasks[id],mine=t.owner==='林澈';
    return shell(t.title,t.code+' / '+t.group,'',`<div class="detail-layout"><article><div class="section-bar"><h2>事项资料</h2>${tag(s.status)}</div>${summary([['负责人',`${t.owner}${mine?'（我）':''}`],['完成期限',t.due.replaceAll('-',' / ')],['来源会议',`<a href="#record/${id==='t4'||id==='t5'?'r16':'r17'}">${t.source}</a>`]])}<section class="section prose"><h2>需要完成的工作</h2><p>${t.description}</p></section><section class="section"><h2>最近进展</h2><div class="inset-note">${esc(s.note)}</div></section>${mine?`<section class="section"><h2>更新进展</h2><form id="task-form" data-id="${id}" novalidate><div id="form-errors"></div><label for="task-status">办理状态</label><select id="task-status" name="status">${['未开始','进行中','已完成'].map(x=>`<option ${s.status===x?'selected':''}>${x}</option>`).join('')}</select><label class="spaced" for="task-note">进展说明</label><p class="field-hint">请写明已经完成的工作或下一步安排，最多 1,000 字。</p><div id="note-error"></div><textarea id="task-note" name="note" rows="4" maxlength="1000">${esc(s.note)}</textarea><div class="form-actions"><button class="button" type="submit">保存进展</button><a href="#tasks">返回事项列表</a></div></form></section>`:''}</article><aside><section class="action-panel"><h2>责任与交接</h2><p class="muted">${mine?'你是此事项的负责人，可以更新状态和办理进展。':'此事项由 '+t.owner+' 负责，当前示例成员可查阅其进展。'}</p><p class="muted">完成后请记录交付内容，便于下一次例会确认。</p></section></aside></div>`,{title:'执行督办',route:'tasks'});
  }
  function showArchive() {
    return shell('纪要档案','RECORDS & PUBLICATIONS','查阅已确认的会议记录、决议与执行分工。',`<div class="list-layout"><aside class="filter-panel"><h2>查找纪要</h2><form id="archive-form"><label for="archive-query">标题关键词</label><input id="archive-query" name="query" type="search" placeholder="例如：编辑"><label for="archive-month" class="spaced">会议月份</label><select id="archive-month" name="month"><option value="all">全部月份</option><option value="2026-09">2026 年 9 月</option><option value="2026-08">2026 年 8 月</option></select><button class="button spaced" type="submit">应用筛选</button></form></aside><section><div class="results-heading"><h2>会议纪要</h2><span id="archive-count" class="muted"></span></div><div id="archive-results"></div></section></div>`);
  }
  function archiveResults(query='',month='all') {
    const list=records.filter(r=>(month==='all'||r.date.startsWith(month))&&r.title.toLowerCase().includes(query.trim().toLowerCase()));
    document.getElementById('archive-count').textContent=`${list.length} 份纪要`;
    document.getElementById('archive-results').innerHTML=list.length?list.map(r=>`<article class="record-item"><p class="meta">${r.date.replaceAll('-',' / ')} · 第 ${r.number} 次例会</p><h2><a href="#record/${r.id}">${r.title}</a></h2><p>${r.summary}</p><div class="record-foot">${tag('已归档')}<span class="meta">会议纪要 · ${r.decisions.length} 项决议</span><a href="#record/${r.id}">阅读纪要 <span aria-hidden="true">→</span></a></div></article>`).join(''):'<div class="empty-state"><h2>未找到相关纪要</h2><p>试试更短的关键词，或选择全部月份。</p></div>';
  }
  function showRecord(id) {
    const r=records.find(r=>r.id===id);if(!r)return notFound();
    return shell(r.title,'MEETING RECORD / '+r.number,'',`<div class="detail-layout"><article class="record-document"><div class="section-bar"><h2>会议纪要</h2>${tag('已归档')}</div>${summary([['会议编号',`AC-2026-${r.number}`],['会议日期',r.date],['出席情况',r.attendees+' 名成员'],['记录与复核','许言记录 · 陈禾复核'],['文档版本','v1.0 · 示例记录']])}<section class="section prose"><h2>一、会议概况</h2><p>${r.summary}</p><h2>二、确认的决议</h2><ol>${r.decisions.map(x=>`<li>${x}</li>`).join('')}</ol><h2>三、后续安排</h2><p>各负责人按确认的分工推进，并在下一次例会前更新执行事项。需要调整的事项应说明原因后再次讨论。</p></section><div class="document-end">会议记录结束 · AC-2026-${r.number}</div></article><aside><section class="action-panel"><h2>文档操作</h2><button class="button secondary" data-action="download" data-id="${id}">下载纪要 .md <span aria-hidden="true">↓</span></button><p class="spaced muted">下载可编辑的 Markdown 文本，包含会议资料与全部决议。</p></section><section class="section side-section"><h2>相关工作</h2><a href="#tasks">查看会后执行事项</a></section></aside></div>`,{title:'纪要档案',route:'archive'});
  }
  function notFound(){return shell('未找到此页面','PAGE NOT FOUND','这个页面可能已变更。',`<a class="button" href="#overview">返回议会概览</a>`);}
  function render(moveFocus=true) {
    const [page,id]=(location.hash.slice(1)||'overview').split('/');
    const current={meeting:'meetings',proposal:'proposals',task:'tasks',record:'archive'}[page]||page;
    document.querySelectorAll('[data-route]').forEach(a=>{if(a.dataset.route===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    const views={overview:showOverview,meetings:showMeetings,meeting:()=>showMeeting(id),proposals:showProposals,proposal:()=>showProposal(id),tasks:showTasks,task:()=>showTask(id),archive:showArchive,record:()=>showRecord(id)};
    main.innerHTML=(views[page]||notFound)();
    if(storageWarning)main.insertAdjacentHTML('afterbegin',`<div class="error-summary" role="alert"><h2>本地记录未加载</h2><p>${esc(storageWarning)}</p></div>`);
    if(page==='meetings')meetingResults();if(page==='proposals')proposalResults();if(page==='tasks')taskResults();if(page==='archive')archiveResults();
    document.title=`${main.querySelector('h1')?.textContent||'安提柯议会'} · 新 UI 试用区 · 安提柯议会`;
    if(moveFocus){main.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  }
  function openDialog(content){document.getElementById('dialog-content').innerHTML=`<button class="dialog-close" data-action="close" aria-label="关闭对话框">×</button>${content}`;dialog.setAttribute('aria-labelledby','dialog-title');dialog.showModal();}
  function formError(form,message,target) {
    const errors=form.querySelector('#form-errors');
    errors.innerHTML=`<div class="error-summary" role="alert" tabindex="-1"><h2>请检查以下内容</h2>${target?`<a href="#${target}" data-error-target="${target}">${esc(message)}</a>`:`<p>${esc(message)}</p>`}</div>`;
    errors.querySelector('.error-summary').focus();
  }
  function downloadRecord(id) {
    const r=records.find(r=>r.id===id);if(!r)return;
    const text=`# ${r.title}\n\n> 安提柯议会 · 本地 UI 试作示例\n\n会议编号：AC-2026-${r.number}\n\n日期：${r.date}\n\n出席：${r.attendees}\n\n## 会议概况\n\n${r.summary}\n\n## 确认的决议\n\n${r.decisions.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\n## 后续安排\n\n各负责人按确认的分工推进，并在下一次例会前更新执行事项。\n`;
    const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`AC-2026-${r.number}-会议纪要.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);notify('已生成示例纪要下载文件。');
  }
  const searchEntries=[...meetings.map(m=>({title:m.title,type:'会议',url:m.id==='m17'?'record/r17':`meeting/${m.id}`})),...proposals.map(p=>({title:p.title,type:'议题',url:`proposal/${p.id}`})),...tasks.map(t=>({title:t.title,type:'执行事项',url:`task/${t.id}`})),...records.map(r=>({title:r.title,type:'纪要',url:`record/${r.id}`}))];
  function searchResults(query) {
    const text=query.trim().toLowerCase();const matches=text?searchEntries.filter(e=>e.title.toLowerCase().includes(text)):[];
    document.getElementById('search-results').innerHTML=text?`<p class="meta">找到 ${matches.length} 项结果</p>${matches.map(e=>`<a class="search-result" href="#${e.url}" data-action="search-result"><span class="tag grey">${e.type}</span><strong>${e.title}</strong></a>`).join('')}${matches.length?'':'<p class="spaced muted">没有匹配的记录，试试“沙龙”或“编辑”。</p>'}`:'<p class="muted">输入关键词，搜索会议、议题、执行事项与纪要。</p>';
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('.skip-link')){event.preventDefault();main.focus();main.scrollIntoView({block:'start'});return;}
    const errorLink=event.target.closest('[data-error-target]');if(errorLink){event.preventDefault();document.getElementById(errorLink.dataset.errorTarget)?.focus();return;}
    const button=event.target.closest('[data-action]');if(!button)return;
    const action=button.dataset.action;
    try {
      if(action==='attendance')setAttendance(!state.attendance);
      if(action==='download')downloadRecord(button.dataset.id);
      if(action==='close'||action==='search-result')dialog.close();
      if(action==='account')openDialog(`<h2 id="dialog-title">当前示例成员</h2>${summary([['姓名','林澈'],['应用角色','普通成员'],['工作组','编辑组'],['数据位置','当前浏览器']])}<p class="muted">这是 UI 试作中的演示身份，不涉及真实账号登录。</p><button class="button" data-action="close">返回工作台</button>`);
      if(action==='guide')openDialog(`<h2 id="dialog-title">新 UI 试用区使用说明</h2><ol class="guide-list"><li>在「例会与议程」中打开九月工作例会，完成签到。</li><li>在「议题与表决」中选择意见并提交，可再次提交修改表决。</li><li>在「执行督办」中更新由林澈负责的事项。</li><li>在「纪要档案」中筛选、阅读并下载会议纪要。</li></ol><p class="muted">所有姓名与业务记录均为示例。数据只保存在当前浏览器；刷新后保留，可通过「重置示例」恢复初始状态。</p><p class="muted">本试作覆盖会议工作流程，原项目的活动、库存、资料库、成员审批及登录功能尚未接入。</p><button class="button" data-action="close">开始体验</button>`);
      if(action==='reset')openDialog(`<h2 id="dialog-title">重置本地示例？</h2><p>将清除此试作中保存的签到、表决和进展，恢复初始示例记录。</p><div class="form-actions"><button class="button danger" data-action="confirm-reset">重置示例数据</button><button class="text-button" data-action="close">取消</button></div>`);
      if(action==='confirm-reset'){localStorage.removeItem(storageKey);state=structuredClone(seed);storageWarning='';dialog.close();render(false);notify('已恢复初始示例。');}
      if(action==='search'){openDialog(`<h2 id="dialog-title">搜索议会记录</h2><label for="global-search">关键词</label><input type="search" id="global-search" placeholder="例如：沙龙、编辑、资料" autocomplete="off"><div id="search-results" class="spaced" aria-live="polite"></div>`);searchResults('');document.getElementById('global-search').focus();}
    }catch(err){notify(err.message);}
  });
  document.addEventListener('change',event=>{
    const el=event.target;
    if(el.id==='meeting-filter')meetingResults(el.value);
    if(el.id==='proposal-filter')proposalResults(el.value);
    if(el.id==='task-filter')taskResults(el.value);
  });
  document.addEventListener('input',event=>{if(event.target.id==='global-search')searchResults(event.target.value);});
  document.addEventListener('submit',event=>{
    const form=event.target;if(!['vote-form','task-form','archive-form'].includes(form.id))return;event.preventDefault();
    const data=new FormData(form);
    if(form.id==='archive-form'){archiveResults(data.get('query'),data.get('month'));return;}
    try {
      const next=structuredClone(state);
      if(form.id==='vote-form') {
        const choice=data.get('choice');
        if(!['agree','disagree','abstain'].includes(choice)) {
          const first=form.querySelector('input[name=choice]');first.id='vote-first';first.setAttribute('aria-describedby','choice-error');
          form.querySelector('#choice-error').innerHTML='<p class="field-error">请选择表决意见</p>';formError(form,'请选择表决意见','vote-first');return;
        }
        next.votes[form.dataset.id]={choice,reason:String(data.get('reason')||'').trim().slice(0,500)};commit(next);render(false);notify('你的表决已保存到本地示例。');
      } else {
        if(tasks.find(t=>t.id===form.dataset.id)?.owner!=='林澈')throw new Error('只能更新当前示例成员负责的事项。');
        const note=String(data.get('note')||'').trim();
        if(!note){form.querySelector('#note-error').innerHTML='<p class="field-error">请填写办理进展</p>';form.querySelector('#task-note').setAttribute('aria-describedby','note-error');formError(form,'请填写办理进展','task-note');return;}
        if(!['未开始','进行中','已完成'].includes(data.get('status')))throw new Error('请选择有效的办理状态。');
        next.tasks[form.dataset.id]={status:data.get('status'),note:note.slice(0,1000)};commit(next);render(false);notify('办理进展已保存，议会概览已同步更新。');
      }
    }catch(err){formError(form,err.message);}
  });
  window.addEventListener('hashchange',()=>{if(dialog.open)dialog.close();render();});
  render(false);
  const context=document.modelContext;
  if(context?.registerTool){
    const lifecycle=new AbortController();
    const tools=[
      {name:'read_demo_workspace',title:'查看本地议会示例',description:'读取此本地 UI 试作的签到、表决和任务状态，不读取真实议会数据。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||Object.keys(input).length)throw new Error('此工具不接受参数。');return {route:location.hash||'#overview',state:structuredClone(state)};}},
      {name:'set_demo_attendance',title:'设置本地示例签到',description:'以示例成员林澈签到或撤销签到，仅更新此浏览器中第 18 次例会的演示记录。',inputSchema:{type:'object',properties:{attended:{type:'boolean'}},required:['attended'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||Object.keys(input).some(k=>k!=='attended'))throw new Error('只接受 attended 参数。');return setAttendance(input.attended);}},
      {name:'navigate_demo_workspace',title:'打开本地工作台栏目',description:'打开此试作的概览、例会、表决、督办或档案栏目，不修改业务数据。',inputSchema:{type:'object',properties:{section:{type:'string',enum:['overview','meetings','proposals','tasks','archive']}},required:['section'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||Object.keys(input).some(k=>k!=='section')||!['overview','meetings','proposals','tasks','archive'].includes(input.section))throw new Error('无效的栏目。');history.replaceState(null,'',`#${input.section}`);render();return {section:input.section};}}
    ];
    for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
    window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
})();
