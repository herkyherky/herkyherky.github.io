(() => {
 'use strict';
 const base=window.ACM_CONFIG?.apiBase;
 if(!base)return;
 let pending=false,planURL='';
 function plan(text){
  const article=document.querySelector('.reader-article'),toc=document.querySelector('.reader-toc');if(!article||!toc)return;
  article.replaceChildren();toc.replaceChildren();let section=0;const intro=document.createElement('div');intro.className='original-intro';article.append(intro);
  text.split(/\n\s*\n/).forEach(block=>{block=block.trim();if(!block)return;if(/^[一二三四五六七八九十]+、/.test(block)){section++;const h=document.createElement('h2');h.id='original-'+section;h.textContent=block;article.append(h);const a=document.createElement('a');a.href='#'+h.id;a.textContent=block;a.addEventListener('click',e=>{e.preventDefault();h.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});});toc.append(a);}else if(/^（[一二三四五六七八九十]+）/.test(block)){const h=document.createElement('h3');h.textContent=block;article.append(h);}else{const p=document.createElement('p');p.textContent=block;(section?article:intro).append(p);}});
  const link=document.getElementById('download-source');if(link){if(planURL)URL.revokeObjectURL(planURL);planURL=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));link.href=planURL;link.download='智数学院算法集训队管理方案.txt';}
 }
 function apply(state){
  if(!state?.content||!state.data||typeof state.plan!=='string')throw new Error('数据格式错误');
  window.ACM_STATE=state;
  document.querySelectorAll('[data-cms]').forEach(el=>{const value=state.content[el.dataset.cms];if(typeof value==='string')el.textContent=value;});
  document.querySelectorAll('[data-site-name]').forEach(el=>el.textContent=state.content['site.name']);
  if(location.pathname.includes('recruitment'))document.title='纳新报名 · '+state.content['site.name'];else document.title=state.content['site.name']+' · 从思考，到突破';
  plan(state.plan);window.dispatchEvent(new CustomEvent('acm:state'));document.documentElement.dataset.contentState='live';
 }
 async function refresh(){if(pending)return;pending=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const response=await fetch(base+'/api/public',{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('公开数据暂不可用');apply(await response.json());}catch{document.documentElement.dataset.contentState='offline';const badge=document.getElementById('data-state');if(badge)badge.textContent='暂未取得最新公开记录';}finally{clearTimeout(timer);pending=false;}}
 refresh();addEventListener('focus',refresh);
})();
