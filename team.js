(() => {
 'use strict';
 const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const hours=v=>Number((v/60).toFixed(1));
 const allowedURL=v=>{try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
 let data=JSON.parse($('#team-default-data').textContent),selectedMember=data.members[0]?.id||'',selectedContest='',selectedMonth=today().slice(0,7),selectedDay=today();
 const dialog=$('#records');
  function member(id){return data.members.find(m=>m.id===id);}
  function personName(id){return member(id)?.name || '未录入成员';}
  function metric(value,label){return '<div class="metric-card"><strong>'+esc(value)+'</strong><span>'+esc(label)+'</span></div>';}
  function empty(title,description){return '<div class="record-empty"><span class="empty-symbol">[ — ]</span><h3>'+esc(title)+'</h3><p>'+esc(description)+'</p></div>';}
  function recordsFor(id,month){return data.daily.filter(d=>d.memberId===id && (!month || d.date.startsWith(month)));}
  function contestsFor(id,month){return data.contests.filter(c=>(!month || c.date.startsWith(month))&&c.results.some(r=>r.memberId===id));}
  function dayInfo(id,date){const daily=data.daily.find(d=>d.memberId===id&&d.date===date);const contests=contestsFor(id).filter(c=>c.date===date);return {daily,contests,contestAC:contests.reduce((n,c)=>n+c.results.find(r=>r.memberId===id).solved,0)};}
  function sum(rows,key){return rows.reduce((n,row)=>n+row[key],0);}
 function status(){const badge=$('#data-state');badge.textContent=window.ACM_STATE?'公开记录 · '+window.ACM_STATE.updatedAt.slice(0,10):'正在读取公开记录';}
  function sortedResults(contest){
    const results=contest.results.map(r=>({...r}));
    const compare=contest.format==='ICPC'?(a,b)=>b.solved-a.solved||a.penalty-b.penalty:contest.format==='SCORE'?(a,b)=>b.score-a.score||a.penalty-b.penalty:(a,b)=>a.officialRank-b.officialRank;
    results.sort((a,b)=>compare(a,b)||personName(a.memberId).localeCompare(personName(b.memberId),'zh-CN'));
    results.forEach((r,i)=>{r.rank=contest.format==='OFFICIAL'?r.officialRank:i>0&&compare(r,results[i-1])===0?results[i-1].rank:i+1;});return results;
  }
  function renderPreviews(){
    $('#public-record-count').textContent=data.contests.length;
    $('#public-daily-count').textContent=data.daily.length;
    $('#public-member-count').textContent=data.members.length;
    const latest=[...data.contests].sort((a,b)=>b.date.localeCompare(a.date))[0];
    $('#contest-preview').innerHTML=latest?'<span class="record-tag">LATEST SESSION / '+esc(latest.date)+'</span><h3>'+esc(latest.title)+'</h3><p>'+esc(latest.platform||'内部模拟赛')+' · 已录入 '+latest.results.length+' 人成绩 · 点击查看场次榜单与复盘</p>':'<span class="record-tag">READY FOR THE FIRST SESSION</span><h3>等待第一场模拟赛记录</h3><p>每场独立榜单，保留解题、得分、罚时与复盘。真实数据录入后在此展示。</p>';
    $('#member-preview').innerHTML=data.members.length?data.members.slice(0,6).map((m,i)=>'<button data-profile="'+esc(m.id)+'"><small>'+String(i+1).padStart(2,'0')+' / MEMBER</small><strong>'+esc(m.name)+'</strong><p>'+esc(m.role)+' · '+recordsFor(m.id).length+' 天日报 · '+contestsFor(m.id).length+' 场竞赛</p></button>').join(''):empty('成员资料待录入','添加成员后即可建立每天的训练档案。','members');
  }
  function renderContests(){
    const root=$('#view-contests');const contests=[...data.contests].sort((a,b)=>b.date.localeCompare(a.date));if(!contests.some(c=>c.id===selectedContest))selectedContest=contests[0]?.id||'';
    const selected=contests.find(c=>c.id===selectedContest);
    const people=new Set(contests.flatMap(c=>c.results.map(r=>r.memberId)));
    root.innerHTML='<div class="records-heading"><div><h2>竞赛情况</h2><p>逐场回看模拟训练：解题、得分、排名与复盘，都有记录。</p></div></div><div class="metric-grid">'+metric(contests.length,'已记录模拟赛')+metric(people.size,'已有参赛记录的成员')+metric(sum(contests.flatMap(c=>c.results),'solved'),'比赛 AC · 按参赛记录累计')+metric(contests.length?contests[0].date.slice(5):'—','最近一场模拟赛')+'</div>';
    if(!selected){root.innerHTML+=empty('暂无已录入的模拟赛','尚未提供真实比赛数据。录入比赛场次及成员成绩后，这里会生成对应榜单。','contests');return;}
    root.innerHTML+='<div class="record-toolbar"><label>选择模拟训练场次<select id="contest-picker">'+contests.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===selectedContest?'selected':'')+'>'+esc(c.date+' · '+c.title)+'</option>').join('')+'</select></label></div>';
    const rule={ICPC:'AC 数优先，罚时越少越靠前；同分同罚时并列',SCORE:'得分优先，罚时越少越靠前；同分同罚时并列',OFFICIAL:'按录入的官方名次展示，不重新计算'}[selected.format];
    root.innerHTML+='<div class="contest-description"><div class="contest-meta"><span>'+esc(selected.date)+'</span><span>'+esc(selected.platform||'内部赛')+'</span><span>'+selected.results.length+' 人已录入成绩</span>'+(selected.url?'<a href="'+esc(allowedURL(selected.url))+'" target="_blank" rel="noopener noreferrer">原始比赛 ↗</a>':'')+'</div><h3>'+esc(selected.title)+'</h3><p>'+esc(selected.notes||'本场暂无补充说明。')+'</p></div><p class="table-caption">排名规则：'+rule+'。成员姓名可进入个人档案。</p>';
    root.innerHTML+=selected.results.length?'<div class="table-wrap"><table class="record-table"><thead><tr><th>名次</th><th>成员</th><th>比赛 AC</th><th>得分</th><th>罚时</th><th>训练复盘 / 产出</th></tr></thead><tbody>'+sortedResults(selected).map(r=>'<tr><td class="place">'+r.rank+'</td><td><button class="member-jump" data-profile="'+esc(r.memberId)+'">'+esc(personName(r.memberId))+' ↗</button></td><td class="num">'+r.solved+'</td><td class="num">'+r.score+'</td><td class="num">'+r.penalty+'</td><td class="review-cell">'+esc(r.review||'待补充')+'</td></tr>').join('')+'</tbody></table></div><p class="record-small">罚时单位沿用本场赛事的官方口径，不跨场比较。比赛 AC 与日常刷题 AC 分开统计；并列名次采用 1、1、3 的方式显示。</p>':empty('本场榜单待录入','场次已建立，尚无个人成绩。','contests');
  }
  function accountLinks(m){
    const builders={codeforces:['Codeforces',v=>'https://codeforces.com/profile/'+encodeURIComponent(v)],luogu:['洛谷',v=>'https://www.luogu.com.cn/user/'+encodeURIComponent(v)],nowcoder:['牛客',v=>'https://www.nowcoder.com/profile/'+encodeURIComponent(v)],leetcode:['力扣',v=>'https://leetcode.cn/u/'+encodeURIComponent(v)+'/'],other:['其他平台',v=>allowedURL(v)]};
    return Object.entries(m.accounts||{}).map(([k,v])=>{const builder=builders[k];if(!builder)return '';const url=allowedURL(v)||builder[1](v);return url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(builder[0])+' ↗</a>':'';}).join('');
  }
  function renderProfile(){
    const root=$('#view-members');if(!data.members.some(m=>m.id===selectedMember))selectedMember=data.members[0]?.id||'';
    root.innerHTML='<div class="records-heading"><div><h2>个人训练档案</h2><p>按成员、按月份、具体到每一天。未记录的日期保留空白，不视作训练量为零。</p></div></div>';
    if(!selectedMember){root.innerHTML+=empty('成员资料待录入','先添加成员，再建立每日训练记录。','members');return;}
    const m=member(selectedMember),rows=recordsFor(m.id,selectedMonth),contests=contestsFor(m.id,selectedMonth);
    const monthResults=contests.map(c=>c.results.find(r=>r.memberId===m.id));
    root.innerHTML+='<div class="record-toolbar member-filter"><label>查看成员<select id="member-picker">'+data.members.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===m.id?'selected':'')+'>'+esc(x.name+' · '+x.role)+'</option>').join('')+'</select></label></div><div class="profile-layout"><aside class="profile-sidebar"><div class="profile-avatar">'+esc(m.name.slice(0,1))+'</div><h3>'+esc(m.name)+'</h3><span class="profile-role">'+esc(m.role+(m.grade?' / '+m.grade:''))+'</span><p class="bio">'+esc(m.bio||'个人简介与训练方向待补充。')+'</p><div class="accounts">'+accountLinks(m)+'</div>'+(Object.keys(m.accounts||{}).length?'':'<p class="record-small">平台账号尚未录入。</p>')+'</aside><div class="profile-main"><div class="metric-grid">'+metric(rows.length?hours(sum(rows,'minutes'))+'h':'—','本月训练时长 · 以日报为准')+metric(rows.length?sum(rows,'practiceSolved'):'—','本月日常 AC · 不含比赛')+metric(contests.length,'本月参赛场次')+metric(monthResults.length?sum(monthResults,'solved'):'—','本月比赛 AC · 单独统计')+'</div><div class="month-strip"><h3>每日训练日历</h3><label>查看月份<input id="month-picker" type="month" value="'+esc(selectedMonth)+'" aria-label="查看月份"></label></div><div class="calendar" aria-label="每日训练日历"></div><p class="record-small">点击任一天查看刷题、竞赛和产出详情。训练时长填写当天总投入，包含比赛时段；比赛时长不会再次叠加。</p><div id="day-detail" class="day-detail"></div></div></div><div class="profile-log"><h3 style="font-size:16px">本月逐日记录</h3><div class="table-wrap"><table class="record-table"><thead><tr><th>日期</th><th>记录状态</th><th>训练时长</th><th>日常 AC / 提交</th><th>比赛 AC / 场次</th><th>产出摘要</th></tr></thead><tbody id="daily-table"></tbody></table></div></div>';
    renderCalendar();renderDay();
  }
  function monthDates(){if(!/^\d{4}-\d{2}$/.test(selectedMonth))return [];const [year,month]=selectedMonth.split('-').map(Number),count=new Date(Date.UTC(year,month,0)).getUTCDate();return Array.from({length:count},(_,i)=>selectedMonth+'-'+String(i+1).padStart(2,'0'));}
  function renderCalendar(){
    const dates=monthDates();if(!dates.length)return;
    if(!selectedDay.startsWith(selectedMonth))selectedDay=dates.includes(today())?today():dates[0];
    const offset=(new Date(dates[0]+'T00:00:00Z').getUTCDay()+6)%7;
    $('.calendar').innerHTML=['一','二','三','四','五','六','日'].map(d=>'<div class="weekday">'+d+'</div>').join('')+'<div class="empty-day"></div>'.repeat(offset)+dates.map(date=>{const info=dayInfo(selectedMember,date),record=info.daily||info.contests.length;return '<button class="calendar-day '+(record?'has-record ':'')+(date===selectedDay?'selected':'')+'" data-day="'+date+'" aria-pressed="'+(date===selectedDay)+'" aria-label="'+date+' '+(info.daily?'日常 AC '+info.daily.practiceSolved:info.contests.length?'仅竞赛记录':'未记录')+'"><strong>'+Number(date.slice(-2))+'</strong><span>'+(info.daily?info.daily.practiceSolved+' AC':info.contests.length?'有竞赛':'未记录')+'</span></button>';}).join('');
    $('#daily-table').innerHTML=dates.map(date=>{const {daily:d,contests,contestAC}=dayInfo(selectedMember,date);return '<tr><td><button class="day-jump" data-day="'+date+'">'+date.slice(5)+' ↗</button></td><td><span class="status-label '+(!d&&!contests.length?'missing':'')+'">'+(d?'已填日报':contests.length?'仅竞赛记录':'未记录')+'</span></td><td class="num">'+(d?d.minutes+' 分钟':'—')+'</td><td class="num">'+(d?d.practiceSolved+' / '+d.submitted:'—')+'</td><td class="num">'+(contests.length?contestAC+' / '+contests.length:'—')+'</td><td class="review-cell">'+esc(d?.output||'—')+'</td></tr>';}).join('');
  }
  function problemList(value){return value.split('\n').filter(Boolean).map(line=>{const url=allowedURL(line.trim());return '<p>'+(url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(line)+' ↗</a>':esc(line))+'</p>';}).join('');}
  function renderDay(){
    const target=$('#day-detail');if(!target)return;const {daily:d,contests,contestAC}=dayInfo(selectedMember,selectedDay);
    target.innerHTML='<h3>'+esc(selectedDay)+' <span class="dim">/ '+esc(personName(selectedMember))+'</span></h3>';
    if(!d&&!contests.length){target.innerHTML+='<p>这一天尚未录入训练或比赛数据。</p>';return;}
    target.innerHTML+='<div class="day-stats"><span>训练时长 <b>'+(d?d.minutes+'m':'—')+'</b></span><span>日常 AC <b>'+(d?d.practiceSolved:'—')+'</b></span><span>比赛 AC <b>'+(contests.length?contestAC:'—')+'</b></span></div>';
    if(d){target.innerHTML+='<h4>训练专题</h4><p>'+esc(d.topics||'待补充')+'</p><h4>题目清单 / 刷题记录</h4>'+(d.problems?problemList(d.problems):'<p>题目清单待补充。</p>')+'<h4>训练产出</h4><p>'+esc(d.output||'待补充')+'</p><h4>复盘与下一步</h4><p>'+esc(d.review||'待补充')+'</p>';}
    else target.innerHTML+='<p style="margin-top:20px">当天仅有比赛成绩，尚未填写训练日报；日常刷题量与训练时长未知。</p>';
    if(contests.length)target.innerHTML+='<h4>当天竞赛 · '+contests.length+' 场</h4>'+contests.map(c=>{const result=sortedResults(c).find(r=>r.memberId===selectedMember);return '<p><button class="text-button" data-contest="'+esc(c.id)+'" style="color:var(--accent)">'+esc(c.title)+' ↗</button><br>名次 '+result.rank+' · AC '+result.solved+' · 得分 '+result.score+' · 罚时 '+result.penalty+'</p><p>'+esc(result.review||'比赛复盘待补充。')+'</p>';}).join('');
    target.innerHTML+='';
  }

 function renderAll(){status();renderPreviews();renderContests();renderProfile();}
 function switchTab(tab){$$('.records-tab',dialog).forEach(b=>{const active=b.dataset.recordTab===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});$$('.records-view',dialog).forEach(v=>v.hidden=v.id!=='view-'+tab);$('.records-content').scrollTop=0;}
 let oldOverflow='';function open(tab='contests',id){if(!['contests','members'].includes(tab))return;if($('.menu-toggle').getAttribute('aria-expanded')==='true')$('.menu-toggle').click();if(id){selectedMember=id;renderProfile();}if(!dialog.open){oldOverflow=document.body.style.overflow;dialog.showModal();document.body.style.overflow='hidden';}switchTab(tab);}
 document.addEventListener('click',event=>{const b=event.target.closest('button,[data-records]');if(!b)return;if(b.hasAttribute('data-records'))open(b.dataset.records);if(b.hasAttribute('data-profile'))open('members',b.dataset.profile);if(b.hasAttribute('data-record-tab'))switchTab(b.dataset.recordTab);if(b.hasAttribute('data-day')){selectedDay=b.dataset.day;renderCalendar();renderDay();if(b.classList.contains('day-jump'))$('#day-detail').scrollIntoView({block:'nearest'});}if(b.hasAttribute('data-contest')){selectedContest=b.dataset.contest;renderContests();switchTab('contests');}});
 dialog.addEventListener('change',event=>{const el=event.target;if(el.id==='contest-picker'){selectedContest=el.value;renderContests();}if(el.id==='member-picker'){selectedMember=el.value;renderProfile();}if(el.id==='month-picker'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(el.value)){selectedMonth=el.value;renderProfile();}});
 dialog.addEventListener('keydown',event=>{if(!event.target.classList.contains('records-tab')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=$$('.records-tab',dialog),i=tabs.indexOf(event.target),n=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;switchTab(tabs[n].dataset.recordTab);tabs[n].focus();});
 $('.records-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{document.body.style.overflow=oldOverflow;});
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  // Hide the complete top bar while moving downward; restore on upward movement or focus.
  const header=$('header');let previousY=scrollY,travel=0,direction=0,scrollQueued=false;
  function navScroll(){const y=scrollY,delta=y-previousY,current=Math.sign(delta);if(current&&current!==direction)travel=0;if(current){travel+=Math.abs(delta);direction=current;}const menuOpen=$('.menu-toggle').getAttribute('aria-expanded')==='true';if(y<85||menuOpen){header.classList.remove('nav-hidden');document.documentElement.classList.remove('nav-away');}else if(travel>15){const hide=direction>0;header.classList.toggle('nav-hidden',hide);document.documentElement.classList.toggle('nav-away',hide);}previousY=y;scrollQueued=false;}
  addEventListener('scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(navScroll);}},{passive:true});header.addEventListener('focusin',()=>{header.classList.remove('nav-hidden');document.documentElement.classList.remove('nav-away');});

 addEventListener('acm:state',()=>{data=window.ACM_STATE.data;renderAll();});
 renderAll();if(window.ACM_STATE){data=window.ACM_STATE.data;renderAll();}
})();
