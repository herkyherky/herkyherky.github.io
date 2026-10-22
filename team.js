(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const copy = value => JSON.parse(JSON.stringify(value));
  const today = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const hours = value => Number((value / 60).toFixed(1));
  const KEY = 'acm-team-records-v1';
  const fallback = JSON.parse($('#team-default-data').textContent);
  let published = copy(fallback), data = copy(fallback), draft = false, storedDraft = null, loadMessage = '';
  let selectedMember = data.members[0]?.id || '', selectedContest = '', selectedMonth = today().slice(0,7), selectedDay = today(), activeTab = 'contests', editorTab = 'daily', editingContest = '', editingMember = '';
  const dialog = $('#records');
  const allowedURL = value => {try {const url=new URL(value);return ['https:','http:'].includes(url.protocol) ? url.href : '';}catch {return '';}};
  const int = (value, label, max=1000000) => {const n=Number(value);if(value === '' || value === null || !Number.isInteger(n) || n<0 || n>max)throw new Error(label+'须为 0–'+max+' 的整数');return n;};
  const decimal = (value,label,max=1000000000) => {const n=Number(value);if(value === '' || value === null || !Number.isFinite(n)||n<0||n>max)throw new Error(label+'须为有效的非负数');return n;};
  const text = (value,label,max=6000) => {if(typeof value !== 'string'||value.length>max)throw new Error(label+'格式不正确或过长');return value;};
  const validDate = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  const uid = prefix => prefix+'-'+(crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2));
  function validate(input) {
    if(!input || input.schemaVersion!==1 || !Array.isArray(input.members)||!Array.isArray(input.contests)||!Array.isArray(input.daily))throw new Error('需要 schemaVersion 为 1，包含 members、contests、daily 的完整数据文件');
    if(input.members.length>200||input.contests.length>5000||input.daily.length>100000)throw new Error('数据规模超出支持范围');
    const memberIDs=new Set(),contestIDs=new Set(),dailyKeys=new Set();
    const cleaned={schemaVersion:1,updatedAt:text(input.updatedAt||today(),'更新时间',100),members:[],contests:[],daily:[]};
    for(const m of input.members){
      const id=text(m.id,'成员 ID',120),name=text(m.name,'姓名',80).trim();
      if(!id||!name||memberIDs.has(id))throw new Error('成员 ID 和姓名不能为空，ID 不能重复');memberIDs.add(id);
      const accounts={};for(const key of ['codeforces','luogu','nowcoder','leetcode','other'])if(m.accounts?.[key])accounts[key]=text(m.accounts[key],'平台账号',300).trim();
      cleaned.members.push({id,name,role:text(m.role||'队员','职责',80),grade:text(m.grade||'','年级',80),bio:text(m.bio||'','个人简介',2000),accounts});
    }
    for(const c of input.contests){
      const id=text(c.id,'比赛 ID',120),title=text(c.title,'比赛名称',200).trim();
      if(!id||!title||contestIDs.has(id)||!validDate(c.date))throw new Error('比赛 ID / 名称 / 日期不正确，或 ID 重复');contestIDs.add(id);
      if(!['ICPC','SCORE','OFFICIAL'].includes(c.format)||!Array.isArray(c.results))throw new Error('比赛计分规则或榜单格式不正确');
      const resultIDs=new Set(),results=c.results.map(r=>{
        if(!memberIDs.has(r.memberId)||resultIDs.has(r.memberId))throw new Error('榜单成员不存在，或同一成员重复');resultIDs.add(r.memberId);
        const rank=r.officialRank===null||r.officialRank===undefined||r.officialRank===''?null:int(r.officialRank,'名次');
        if(c.format==='OFFICIAL'&&(rank===null||rank<1))throw new Error('按官方名次记录时，每名参赛者须填写大于 0 的名次');
        return {memberId:r.memberId,solved:int(r.solved,'比赛 AC'),score:decimal(r.score,'比赛得分'),penalty:decimal(r.penalty,'罚时'),officialRank:rank,review:text(r.review||'','比赛复盘',6000)};
      });
      const url=text(c.url||'','比赛链接',2000);if(url&&!allowedURL(url))throw new Error('比赛链接须为 http 或 https URL');
      cleaned.contests.push({id,title,date:c.date,platform:text(c.platform||'','比赛平台',100),format:c.format,url,notes:text(c.notes||'','场次说明',6000),results});
    }
    for(const d of input.daily){
      if(!memberIDs.has(d.memberId)||!validDate(d.date))throw new Error('日报成员或日期无效');const key=d.memberId+'|'+d.date;
      if(dailyKeys.has(key))throw new Error('同一成员同一天只能有一份日报，请合并后再导入');dailyKeys.add(key);
      const solved=int(d.practiceSolved,'日常 AC'),submitted=int(d.submitted,'提交次数');if(submitted<solved)throw new Error('日常提交次数不能少于日常 AC 数');
      cleaned.daily.push({id:text(d.id||uid('day'),'日报 ID',150),memberId:d.memberId,date:d.date,minutes:int(d.minutes,'当日训练分钟',1440),practiceSolved:solved,submitted,topics:text(d.topics||'','训练专题',1000),problems:text(d.problems||'','题目清单',10000),output:text(d.output||'','产出',10000),review:text(d.review||'','复盘',10000)});
    }
    return cleaned;
  }
  function member(id){return data.members.find(m=>m.id===id);}
  function personName(id){return member(id)?.name || '未录入成员';}
  function metric(value,label){return '<div class="metric-card"><strong>'+esc(value)+'</strong><span>'+esc(label)+'</span></div>';}
  function empty(title,description,editor){return '<div class="record-empty"><span class="empty-symbol">[ — ]</span><h3>'+esc(title)+'</h3><p>'+esc(description)+'</p>'+(editor?'<button class="btn" data-edit-type="'+esc(editor)+'">录入第一份记录 <b>↗</b></button>':'')+'</div>';}
  function recordsFor(id,month){return data.daily.filter(d=>d.memberId===id && (!month || d.date.startsWith(month)));}
  function contestsFor(id,month){return data.contests.filter(c=>(!month || c.date.startsWith(month))&&c.results.some(r=>r.memberId===id));}
  function dayInfo(id,date){const daily=data.daily.find(d=>d.memberId===id&&d.date===date);const contests=contestsFor(id).filter(c=>c.date===date);return {daily,contests,contestAC:contests.reduce((n,c)=>n+c.results.find(r=>r.memberId===id).solved,0)};}
  function sum(rows,key){return rows.reduce((n,row)=>n+row[key],0);}
  function setStatus(message,error=false){const target=$('#editor-status');if(target){target.textContent=message;target.classList.toggle('error',error);}}
  function save(next){next.updatedAt=new Date().toISOString();const cleaned=validate(next);const packet={baseUpdatedAt:published.updatedAt,data:cleaned};try{localStorage.setItem(KEY,JSON.stringify(packet));}catch{throw new Error('当前浏览器无法保存草稿，请检查存储权限或空间；本次修改尚未保存');}storedDraft=packet;data=cleaned;draft=true;renderAll();}
  function status(){const badge=$('#data-state');badge.textContent=draft?'本机草稿 · 尚未公开发布':loadMessage?'离线 · 仅内置资料':'公开数据 · '+(published.updatedAt||'待更新').slice(0,10);badge.classList.toggle('draft',draft);}
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
    root.innerHTML='<div class="records-heading"><div><h2>竞赛情况</h2><p>逐场回看模拟训练：解题、得分、排名与复盘，都有记录。</p></div><button class="btn" data-edit-type="contests">录入场次 ↗</button></div><div class="metric-grid">'+metric(contests.length,'已记录模拟赛')+metric(people.size,'已有参赛记录的成员')+metric(sum(contests.flatMap(c=>c.results),'solved'),'比赛 AC · 按参赛记录累计')+metric(contests.length?contests[0].date.slice(5):'—','最近一场模拟赛')+'</div>';
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
    root.innerHTML='<div class="records-heading"><div><h2>个人训练档案</h2><p>按成员、按月份、具体到每一天。未记录的日期保留空白，不视作训练量为零。</p></div><button class="btn" data-edit-type="daily">录入日报 ↗</button></div>';
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
    if(!d&&!contests.length){target.innerHTML+='<p>这一天尚未录入训练或比赛数据。</p><button class="btn" data-daily-date="'+esc(selectedDay)+'" style="font-size:11px;padding:10px 15px">补充这一天的日报 ↗</button>';return;}
    target.innerHTML+='<div class="day-stats"><span>训练时长 <b>'+(d?d.minutes+'m':'—')+'</b></span><span>日常 AC <b>'+(d?d.practiceSolved:'—')+'</b></span><span>比赛 AC <b>'+(contests.length?contestAC:'—')+'</b></span></div>';
    if(d){target.innerHTML+='<h4>训练专题</h4><p>'+esc(d.topics||'待补充')+'</p><h4>题目清单 / 刷题记录</h4>'+(d.problems?problemList(d.problems):'<p>题目清单待补充。</p>')+'<h4>训练产出</h4><p>'+esc(d.output||'待补充')+'</p><h4>复盘与下一步</h4><p>'+esc(d.review||'待补充')+'</p>';}
    else target.innerHTML+='<p style="margin-top:20px">当天仅有比赛成绩，尚未填写训练日报；日常刷题量与训练时长未知。</p>';
    if(contests.length)target.innerHTML+='<h4>当天竞赛 · '+contests.length+' 场</h4>'+contests.map(c=>{const result=sortedResults(c).find(r=>r.memberId===selectedMember);return '<p><button class="text-button" data-contest="'+esc(c.id)+'" style="color:var(--accent)">'+esc(c.title)+' ↗</button><br>名次 '+result.rank+' · AC '+result.solved+' · 得分 '+result.score+' · 罚时 '+result.penalty+'</p><p>'+esc(result.review||'比赛复盘待补充。')+'</p>';}).join('');
    target.innerHTML+='<button class="btn" data-daily-date="'+esc(selectedDay)+'" style="font-size:11px;padding:10px 15px;margin-top:16px">'+(d?'修改':'补充')+'当天日报 ↗</button>';
  }
  function renderEditor(){
    const root=$('#view-editor');
    root.innerHTML='<div class="records-heading"><div><h2>数据维护</h2><p>真实记录，统一发布。只有负责人上传后的数据才对所有访客生效。</p></div></div><div class="draft-banner"><strong>'+(draft?'正在预览本机草稿，尚未公开。':'当前查看公开版。录入只会保存到本机草稿。')+'</strong><br>草稿不会自动同步到其他人的设备。导出 team-data.json 后，由负责人上传至网站仓库，Pages 发布后全员共享。'+(loadMessage?'<br>'+esc(loadMessage):'')+'</div><div class="editor-tabs"><button class="editor-tab" data-editor="daily" aria-pressed="'+(editorTab==='daily')+'">每日训练</button><button class="editor-tab" data-editor="contests" aria-pressed="'+(editorTab==='contests')+'">竞赛榜单</button><button class="editor-tab" data-editor="members" aria-pressed="'+(editorTab==='members')+'">成员资料</button><button class="editor-tab" data-editor="transfer" aria-pressed="'+(editorTab==='transfer')+'">导入与发布</button></div><div id="editor-form-area"></div><p id="editor-status" class="form-status" role="status" aria-live="polite"></p>';
    if(editorTab==='daily')dailyForm();else if(editorTab==='contests')contestForm();else if(editorTab==='members')memberForm();else transferForm();
  }
  function memberOptions(value){return data.members.map(m=>'<option value="'+esc(m.id)+'" '+(m.id===value?'selected':'')+'>'+esc(m.name)+'</option>').join('');}
  function dailyForm(date=selectedDay){
    const root=$('#editor-form-area');if(!data.members.length){root.innerHTML=empty('先添加成员','每日训练记录需要关联到具体成员。','members');return;}
    const d=data.daily.find(d=>d.memberId===selectedMember&&d.date===date);
    root.innerHTML='<form id="daily-form" class="editor-form"><h3>每日训练记录</h3><div class="field-grid"><label>成员 *<select name="memberId" required>'+memberOptions(selectedMember)+'</select></label><label>训练日期 *<input name="date" type="date" value="'+esc(date)+'" required></label><label>当日训练总时长（分钟）*<input name="minutes" type="number" min="0" max="1440" step="1" value="'+(d?.minutes??'')+'" placeholder="例：120" required><span class="field-help">包含比赛时段，一天的总时长只记一次。</span></label><label>日常独立 AC 题数（不含比赛）*<input name="practiceSolved" type="number" min="0" step="1" value="'+(d?.practiceSolved??'')+'" required placeholder="没有刷题时填 0"><span class="field-help">按独立题目计数，同一道题重复通过不重复累计。</span></label><label>日常提交次数（不含比赛）*<input name="submitted" type="number" min="0" step="1" value="'+(d?.submitted??'')+'" required></label><label>训练专题<input name="topics" maxlength="1000" value="'+esc(d?.topics||'')+'" placeholder="例：二分、前缀和"></label><label class="wide">题目清单 / 题号 / 链接<textarea name="problems" maxlength="10000" placeholder="每行一题，可填平台题号或完整链接">'+esc(d?.problems||'')+'</textarea></label><label class="wide">当天的具体产出<textarea name="output" maxlength="10000" placeholder="完成了哪些题、题解、代码或专题总结">'+esc(d?.output||'')+'</textarea></label><label class="wide">复盘与下一步<textarea name="review" maxlength="10000" placeholder="遇到的瓶颈、错误原因、下次训练计划">'+esc(d?.review||'')+'</textarea></label></div><div class="form-actions"><button class="btn primary" type="submit">保存本机草稿 <b>↗</b></button><span class="safety-input-notice">相同成员 + 日期会更新原日报；不会新增重复记录。</span></div></form>';
  }
  function contestForm(){
    const root=$('#editor-form-area');if(!data.members.length){root.innerHTML=empty('先添加成员','录入成员后才能填写个人竞赛成绩。','members');return;}
    const c=data.contests.find(c=>c.id===editingContest);
    root.innerHTML='<form id="contest-form" class="editor-form"><h3>'+(c?'编辑场次':'新建模拟训练场次')+'</h3><div class="field-grid"><label>场次名称 *<input name="title" maxlength="200" required value="'+esc(c?.title||'')+'" placeholder="例：第 1 周模拟训练"></label><label>比赛日期 *<input name="date" type="date" required value="'+esc(c?.date||today())+'"></label><label>平台<input name="platform" maxlength="100" value="'+esc(c?.platform||'')+'" placeholder="Codeforces / 牛客 / 希冀 OJ / 其他"></label><label>排名规则 *<select name="format"><option value="ICPC" '+(c?.format==='ICPC'?'selected':'')+'>ICPC：AC 优先，再比罚时</option><option value="SCORE" '+(c?.format==='SCORE'?'selected':'')+'>积分制：得分优先，再比罚时</option><option value="OFFICIAL" '+(c?.format==='OFFICIAL'?'selected':'')+'>按录入的官方名次展示</option></select></label><label class="wide">比赛原始链接<input name="url" type="url" value="'+esc(c?.url||'')+'" placeholder="https://..."></label><label class="wide">场次说明 / 训练主题<textarea name="notes" maxlength="6000">'+esc(c?.notes||'')+'</textarea></label></div><div class="contest-result-editor"><h3 style="font-size:15px;margin-bottom:12px">个人成绩表</h3><p class="record-small">勾选已参加且有成绩记录的成员。未勾选表示没有本场成绩记录，不等于缺勤。CF 等赛事可直接使用官方名次；罚时和得分按原赛制填写。</p><div class="table-wrap"><table class="record-table"><thead><tr><th>录入</th><th>成员</th><th>AC</th><th>得分</th><th>罚时</th><th>官方名次</th><th>个人复盘 / 产出</th></tr></thead><tbody>'+data.members.map(m=>{const r=c?.results.find(r=>r.memberId===m.id);return '<tr data-result-member="'+esc(m.id)+'"><td><input type="checkbox" data-result-field="included" aria-label="录入 '+esc(m.name)+' 的成绩" '+(r?'checked':'')+'></td><td>'+esc(m.name)+'</td><td><input type="number" min="0" step="1" data-result-field="solved" aria-label="'+esc(m.name)+' AC" value="'+(r?.solved??0)+'"></td><td><input type="number" min="0" step="any" data-result-field="score" aria-label="'+esc(m.name)+' 得分" value="'+(r?.score??0)+'"></td><td><input type="number" min="0" step="any" data-result-field="penalty" aria-label="'+esc(m.name)+' 罚时" value="'+(r?.penalty??0)+'"></td><td><input type="number" min="1" step="1" data-result-field="officialRank" aria-label="'+esc(m.name)+' 官方名次" value="'+(r?.officialRank??'')+'"></td><td><input class="review-input" data-result-field="review" aria-label="'+esc(m.name)+' 复盘" maxlength="6000" value="'+esc(r?.review||'')+'"></td></tr>';}).join('')+'</tbody></table></div></div><div class="form-actions"><button class="btn primary" type="submit">保存本机草稿 <b>↗</b></button>'+(c?'<button class="btn" type="button" data-new-contest>新建其他场次</button>':'')+'</div></form><div class="manage-list">'+[...data.contests].sort((a,b)=>b.date.localeCompare(a.date)).map(c=>'<div class="manage-row"><div>'+esc(c.title)+'<small>'+esc(c.date)+' · '+c.results.length+' 人已录入成绩</small></div><button class="text-button" data-edit-contest="'+esc(c.id)+'">编辑 ↗</button></div>').join('')+'</div>';
  }
  function memberForm(){
    const root=$('#editor-form-area'),m=data.members.find(m=>m.id===editingMember);
    root.innerHTML='<form id="member-form" class="editor-form"><h3>'+(m?'编辑成员资料':'添加成员')+'</h3><div class="field-grid"><label>姓名 / 公开昵称 *<input name="name" maxlength="80" required value="'+esc(m?.name||'')+'"></label><label>队内职责<input name="role" maxlength="80" value="'+esc(m?.role||'队员')+'"></label><label>年级<input name="grade" maxlength="80" value="'+esc(m?.grade||'')+'" placeholder="可选"></label><label>Codeforces 账号<input name="codeforces" maxlength="300" value="'+esc(m?.accounts?.codeforces||'')+'" placeholder="账号或完整主页 URL"></label><label>洛谷 UID / 主页<input name="luogu" maxlength="300" value="'+esc(m?.accounts?.luogu||'')+'"></label><label>牛客 UID / 主页<input name="nowcoder" maxlength="300" value="'+esc(m?.accounts?.nowcoder||'')+'"></label><label>力扣账号 / 主页<input name="leetcode" maxlength="300" value="'+esc(m?.accounts?.leetcode||'')+'"></label><label>其他平台主页<input name="other" type="url" value="'+esc(m?.accounts?.other||'')+'" placeholder="https://..."></label><label class="wide">个人简介 / 算法方向<textarea name="bio" maxlength="2000">'+esc(m?.bio||'')+'</textarea></label></div><div class="form-actions"><button class="btn primary" type="submit">保存本机草稿 <b>↗</b></button>'+(m?'<button class="btn" type="button" data-new-member>添加其他成员</button>':'')+'</div><p class="record-small">只填写用于公开展示的资料；不要录入学号、联系方式、课程成绩等私人信息。成员 ID 自动生成，编辑姓名不会丢失历史训练记录。</p></form><div class="manage-list">'+data.members.map(m=>'<div class="manage-row"><div>'+esc(m.name)+'<small>'+esc(m.role)+' · '+esc(m.grade||'年级待补充')+'</small></div><button class="text-button" data-edit-member="'+esc(m.id)+'">编辑 ↗</button></div>').join('')+'</div>';
  }
  function transferForm(){
    $('#editor-form-area').innerHTML='<div class="transfer-panel"><h3>统一发布，所有人查看同一份数据</h3><p>站点公开读取 <span class="accent mono">team-data.json</span>。本机修改先作为草稿预览，导出并更新网站仓库后才会公开；这个页面本身不会直接修改 GitHub 仓库。</p><div class="transfer-actions"><button class="btn primary" id="export-json">导出待发布数据 ↓</button><button class="btn" id="export-csv">导出逐日明细 CSV ↓</button><button class="btn" id="restore-public">查看公开版</button>'+(storedDraft?'<button class="btn" id="resume-draft">继续本机草稿</button>':'')+'</div>'+(storedDraft&&storedDraft.baseUpdatedAt!==published.updatedAt?'<p class="text-note accent">本机草稿基于较早的公开版。导出发布前，请先核对最新公开数据，避免覆盖他人的更新。</p>':'')+'<div class="transfer-steps"><h3 style="font-size:15px">负责人发布步骤</h3><p>1. 录入成员、每日训练与比赛成绩，检查榜单和个人档案。<br>2. 点击“导出待发布数据”，得到 <code>team-data.json</code>。<br>3. 在网站仓库中使用 <code>Add file → Upload files</code>，上传替换同名文件，提交到 <code>main</code>。<br>4. 等待 GitHub Pages 部署完成后刷新网站；其他访客会看到新版。</p><a class="btn" href="https://github.com/herkyherky/herkyherky.github.io/upload/main" target="_blank" rel="noopener noreferrer" style="font-size:11px">打开专用仓库上传页 ↗</a></div><div class="import-box"><label for="import-file">导入完整数据文件 · 只保存为本机草稿</label><input id="import-file" type="file" accept="application/json,.json" style="margin-top:15px"><p class="text-note">导入会替换当前本机草稿。先导出已有草稿可保留备份；不会影响当前已公开的数据。</p><label for="import-json">或粘贴 JSON</label><textarea id="import-json" placeholder="粘贴包含 members、contests、daily 的完整 JSON"></textarea><button class="btn" id="import-paste" style="font-size:11px;margin-top:15px">检查并导入本机草稿 ↗</button></div></div>';
  }
  function renderAll(){status();renderPreviews();renderContests();renderProfile();renderEditor();}
  function switchTab(tab){activeTab=tab;$$('.records-tab',dialog).forEach(b=>{const active=b.dataset.recordTab===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});$$('.records-view',dialog).forEach(v=>v.hidden=v.id!=='view-'+tab);$('.records-content').scrollTop=0;}
  let oldOverflow='';function open(tab='contests',memberID){if($('.menu-toggle').getAttribute('aria-expanded')==='true')$('.menu-toggle').click();if(memberID){selectedMember=memberID;renderProfile();}if(!dialog.open){oldOverflow=document.body.style.overflow;dialog.showModal();document.body.style.overflow='hidden';}switchTab(tab);}
  function edit(type,date){editorTab=type;if(date)selectedDay=date;renderEditor();switchTab('editor');}
  function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function exportCSV(){
    const rows=[['日期','姓名','职责','训练分钟','日常AC','日常提交','比赛场次','比赛AC','专题','题目清单','产出','复盘']];
    data.members.forEach(m=>{const dates=[...new Set([...recordsFor(m.id).map(d=>d.date),...contestsFor(m.id).map(c=>c.date)])].sort();dates.forEach(date=>{const {daily:d,contests,contestAC}=dayInfo(m.id,date);rows.push([date,m.name,m.role,d?.minutes??'',d?.practiceSolved??'',d?.submitted??'',contests.map(c=>c.title).join(' / '),contests.length?contestAC:'',d?.topics||'',d?.problems||'',d?.output||'',d?.review||'']);});});
    const safe=value=>{let s=String(value);if(/^[\t\r\n ]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};download('\uFEFF'+rows.map(row=>row.map(safe).join(',')).join('\r\n'),'ACM-逐日训练明细.csv','text/csv;charset=utf-8');
  }
  function importJSON(raw){const next=validate(JSON.parse(raw));if(!confirm('导入会替换当前本机草稿（公开数据不变）。确认已备份需要保留的草稿？'))return;save(next);setStatus('数据格式检查通过，已保存为本机草稿。导出并发布后才会对所有人更新。');}
  document.addEventListener('click',event=>{
    const b=event.target.closest('button,[data-records]');if(!b)return;
    if(b.hasAttribute('data-records')){open(b.dataset.records);return;}
    if(b.hasAttribute('data-profile')){open('members',b.dataset.profile);return;}
    if(b.hasAttribute('data-record-tab')){switchTab(b.dataset.recordTab);return;}
    if(b.hasAttribute('data-edit-type')){if(!dialog.open)open('editor');edit(b.dataset.editType);return;}
    if(b.hasAttribute('data-editor')){editorTab=b.dataset.editor;renderEditor();return;}
    if(b.hasAttribute('data-day')){selectedDay=b.dataset.day;renderCalendar();renderDay();if(b.classList.contains('day-jump'))$('#day-detail').scrollIntoView({block:'nearest'});return;}
    if(b.hasAttribute('data-daily-date')){edit('daily',b.dataset.dailyDate);return;}
    if(b.hasAttribute('data-contest')){selectedContest=b.dataset.contest;renderContests();switchTab('contests');return;}
    if(b.hasAttribute('data-edit-contest')){editingContest=b.dataset.editContest;contestForm();setStatus('');return;}
    if(b.hasAttribute('data-new-contest')){editingContest='';contestForm();setStatus('');return;}
    if(b.hasAttribute('data-edit-member')){editingMember=b.dataset.editMember;memberForm();setStatus('');return;}
    if(b.hasAttribute('data-new-member')){editingMember='';memberForm();setStatus('');return;}
    if(b.id==='export-json'){download(JSON.stringify(data,null,2)+'\n','team-data.json','application/json;charset=utf-8');setStatus(draft?'已导出本机草稿；请上传到专用仓库发布。':'已导出当前公开版。');}
    if(b.id==='export-csv')exportCSV();
    if(b.id==='restore-public'){data=copy(published);draft=false;renderAll();setStatus('已切回公开版；本机草稿仍保留，可随时继续。');}
    if(b.id==='resume-draft'&&storedDraft){data=validate(storedDraft.data);draft=true;renderAll();setStatus('已恢复本机草稿。');}
    if(b.id==='import-paste'){try{importJSON($('#import-json').value);}catch(error){setStatus('导入失败：'+error.message,true);}}
  });
  dialog.addEventListener('keydown',event=>{if(!event.target.classList.contains('records-tab')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=$$('.records-tab',dialog),i=tabs.indexOf(event.target),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;switchTab(tabs[next].dataset.recordTab);tabs[next].focus();});
  dialog.addEventListener('change',async event=>{
    const el=event.target;
    if(el.id==='contest-picker'){selectedContest=el.value;renderContests();}
    if(el.id==='member-picker'){selectedMember=el.value;renderProfile();}
    if(el.id==='month-picker'){if(/^\d{4}-(0[1-9]|1[0-2])$/.test(el.value)){selectedMonth=el.value;renderProfile();}}
    if(el.closest('#daily-form')&&['memberId','date'].includes(el.name)){const form=$('#daily-form'),id=form.elements.memberId.value,date=form.elements.date.value;if(validDate(date)){selectedMember=id;selectedDay=date;dailyForm(date);}}
    if(el.id==='import-file'&&el.files[0]){try{if(el.files[0].size>20*1024*1024)throw new Error('文件大于 20 MB');importJSON(await el.files[0].text());}catch(error){setStatus('导入失败：'+error.message,true);}}
  });
  dialog.addEventListener('submit',event=>{
    event.preventDefault();const form=event.target,f=new FormData(form),next=copy(data);
    try{
      if(form.id==='daily-form'){
        const memberId=f.get('memberId'),date=f.get('date'),existing=next.daily.find(d=>d.memberId===memberId&&d.date===date);
        const record={id:existing?.id||uid('day'),memberId,date,minutes:int(f.get('minutes'),'训练分钟',1440),practiceSolved:int(f.get('practiceSolved'),'日常 AC'),submitted:int(f.get('submitted'),'日常提交'),topics:f.get('topics'),problems:f.get('problems'),output:f.get('output'),review:f.get('review')};
        if(existing)next.daily[next.daily.indexOf(existing)]=record;else next.daily.push(record);selectedMember=memberId;selectedDay=date;selectedMonth=date.slice(0,7);save(next);setStatus('日报已保存为本机草稿。可在个人档案按日期查看；公开发布请使用“导入与发布”。');
      }
      if(form.id==='member-form'){
        const id=editingMember||uid('member'),record={id,name:f.get('name').trim(),role:f.get('role').trim()||'队员',grade:f.get('grade').trim(),bio:f.get('bio').trim(),accounts:{}};
        for(const key of ['codeforces','luogu','nowcoder','leetcode','other'])if(f.get(key).trim())record.accounts[key]=f.get(key).trim();
        const i=next.members.findIndex(m=>m.id===id);if(i<0)next.members.push(record);else next.members[i]=record;editingMember=id;selectedMember=id;save(next);setStatus('成员资料已保存为本机草稿；历史日报与竞赛记录仍关联同一成员。');
      }
      if(form.id==='contest-form'){
        const id=editingContest||uid('contest'),results=[];
        $$('[data-result-member]',form).forEach(row=>{if(!$('[data-result-field="included"]',row).checked)return;const value=name=>$('[data-result-field="'+name+'"]',row).value;results.push({memberId:row.dataset.resultMember,solved:int(value('solved'),'比赛 AC'),score:decimal(value('score'),'得分'),penalty:decimal(value('penalty'),'罚时'),officialRank:value('officialRank')===''?null:int(value('officialRank'),'官方名次'),review:value('review')});});
        const record={id,title:f.get('title').trim(),date:f.get('date'),platform:f.get('platform').trim(),format:f.get('format'),url:f.get('url').trim(),notes:f.get('notes'),results};const i=next.contests.findIndex(c=>c.id===id);if(i<0)next.contests.push(record);else next.contests[i]=record;editingContest=id;selectedContest=id;save(next);setStatus('场次与榜单已保存为本机草稿；按所选规则生成名次，并同步到成员当天的竞赛记录。');
      }
    }catch(error){setStatus(error.message,true);}
  });
  $('.records-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{document.body.style.overflow=oldOverflow;});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  // Hide the complete top bar while moving downward; restore on upward movement or focus.
  const header=$('header');let previousY=scrollY,travel=0,direction=0,scrollQueued=false;
  function navScroll(){const y=scrollY,delta=y-previousY,current=Math.sign(delta);if(current&&current!==direction)travel=0;if(current){travel+=Math.abs(delta);direction=current;}const menuOpen=$('.menu-toggle').getAttribute('aria-expanded')==='true';if(y<85||menuOpen){header.classList.remove('nav-hidden');document.documentElement.classList.remove('nav-away');}else if(travel>15){const hide=direction>0;header.classList.toggle('nav-hidden',hide);document.documentElement.classList.toggle('nav-away',hide);}previousY=y;scrollQueued=false;}
  addEventListener('scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(navScroll);}},{passive:true});header.addEventListener('focusin',()=>{header.classList.remove('nav-hidden');document.documentElement.classList.remove('nav-away');});
  // Public data remains the default view. A local draft is only resumed deliberately.
  renderAll();
  fetch('team-data.json',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('公开数据加载失败');return response.json();}).then(raw=>{published=validate(raw);if(!draft)data=copy(published);renderAll();}).catch(()=>{loadMessage='暂时未能取得最新公开数据，当前仅显示页面内置的成员信息；请联网后刷新。';status();renderEditor();});
  try{const saved=localStorage.getItem(KEY);if(saved){const packet=JSON.parse(saved);storedDraft={baseUpdatedAt:packet.baseUpdatedAt,data:validate(packet.data)};renderEditor();}}catch{}
})();
