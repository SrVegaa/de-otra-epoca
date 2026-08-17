import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm';
const ADMIN_ID='f5de4699-d26e-4b10-9c75-fea1dcb44c52',URL='https://bgfauwszjpmztgpcoobq.supabase.co',KEY='sb_publishable_E4GqF4Hj5GGYfmG7-Wor6Q_0QgjYND0',EMAIL='abelardoadrian@gmail.com',sb=createClient(URL,KEY);
const login=document.querySelector('#admin-login'),shell=document.querySelector('#admin-shell'),area=document.querySelector('#admin-area'),storyList=document.querySelector('#admin-list'),commentList=document.querySelector('#comment-list'),status=document.querySelector('#admin-status');
function message(t){status.textContent=t;status.classList.toggle('show',Boolean(t))}
function label(value){return value==='pending'?'Pendiente':value==='approved'?'Publicado':'Rechazado'}
function date(value){if(!value)return'';return new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value))}
async function load(){
 message('Actualizando el panel…');
 const[storiesResult,commentsResult,visitsResult]=await Promise.all([sb.from('stories').select('*').order('created_at',{ascending:false}),sb.from('comments').select('*').order('created_at',{ascending:false}),sb.rpc('get_admin_visit_stats')]);
 if(storiesResult.error||commentsResult.error){message('No se pudieron cargar todos los aportes.');return}
 renderStories(storiesResult.data);renderComments(commentsResult.data);
 const storyPending=storiesResult.data.filter(x=>x.status==='pending').length,commentPending=commentsResult.data.filter(x=>x.status==='pending').length;
 document.querySelector('#story-pending-stat').textContent=storyPending;
 document.querySelector('#comment-pending-stat').textContent=commentPending;
 document.querySelector('#total-stat').textContent=storiesResult.data.length+commentsResult.data.length;
 renderVisitStats(visitsResult.error?null:visitsResult.data);
 message('');
}
function renderVisitStats(stats){
 const ids=['visit-total-stat','visit-today-stat','visit-week-stat','page-view-stat'],values=stats?[stats.total,stats.today,stats.last_7_days,stats.page_views]:['—','—','—','—'];
 ids.forEach((id,i)=>document.querySelector('#'+id).textContent=typeof values[i]==='number'?values[i].toLocaleString('es-AR'):values[i]);
 const list=document.querySelector('#top-pages-list');list.replaceChildren();
 if(!stats){const p=document.createElement('p');p.className='admin-empty';p.textContent='No se pudieron cargar las estadísticas.';list.append(p);return}
 const pages=Array.isArray(stats.top_pages)?stats.top_pages:[];
 if(!pages.length){const p=document.createElement('p');p.className='admin-empty';p.textContent='Las visitas comenzarán a aparecer aquí.';list.append(p);return}
 const max=Math.max(...pages.map(p=>Number(p.views)||0),1);
 pages.forEach(page=>{const row=document.createElement('div');row.className='admin-page-row';const label=document.createElement('span');const path=String(page.path||'/');label.textContent=path==='/'?'Portada':decodeURIComponent(path).split('/').pop().replace('.html','').replaceAll('-',' ');const track=document.createElement('span');track.className='admin-page-track';const bar=document.createElement('i');bar.style.width=Math.max(8,Math.round((Number(page.views)||0)/max*100))+'%';track.append(bar);const value=document.createElement('strong');value.textContent=(Number(page.views)||0).toLocaleString('es-AR');row.append(label,track,value);list.append(row)})
}

function meta(author,email,state,created){
 const row=document.createElement('div');row.className='admin-card-meta';
 const person=document.createElement('span');person.textContent=(author||'Anónimo')+' · '+email+(created?' · '+date(created):'');
 const badge=document.createElement('span');badge.className='admin-status-badge '+state;badge.textContent=label(state);
 row.append(person,badge);return row
}
function renderStories(items){
 storyList.innerHTML='';const pending=items.filter(x=>x.status==='pending').length;
 document.querySelector('#story-count').textContent=pending+' pendiente'+(pending===1?'':'s');
 if(!items.length){storyList.innerHTML='<p class="admin-empty">Todavía no hay historias recibidas.</p>';return}
 items.forEach(s=>{const card=document.createElement('article');card.className='admin-card status-'+s.status;
 const top=document.createElement('div');top.className='admin-card-title';const h=document.createElement('h3');h.textContent=s.title;const kind=document.createElement('small');kind.textContent='HISTORIA';top.append(h,kind);
 const body=document.createElement('textarea');body.value=s.body;body.setAttribute('aria-label','Texto de '+s.title);
 const actions=buttons((next,b)=>reviewStory(s,body.value,next,b),s.status);card.append(top,meta(s.author_name,s.author_email,s.status,s.created_at),body,actions);storyList.appendChild(card)});
}
function renderComments(items){
 commentList.innerHTML='';const pending=items.filter(x=>x.status==='pending').length;
 document.querySelector('#comment-count').textContent=pending+' pendiente'+(pending===1?'':'s');
 if(!items.length){commentList.innerHTML='<p class="admin-empty">Todavía no hay comentarios recibidos.</p>';return}
 items.forEach(c=>{const card=document.createElement('article');card.className='admin-card status-'+c.status;
 const top=document.createElement('div');top.className='admin-card-title';const h=document.createElement('h3');h.textContent='Comentario en: '+c.story_slug.replaceAll('-',' ');const kind=document.createElement('small');kind.textContent='COMENTARIO';top.append(h,kind);
 const body=document.createElement('textarea');body.value=c.body;body.className='comment-review-text';
 const actions=buttons((next,b)=>reviewComment(c,body.value,next,b),c.status);card.append(top,meta(c.author_name,c.author_email,c.status,c.created_at),body,actions);commentList.appendChild(card)});
}
function buttons(handler,current){const actions=document.createElement('div');actions.className='admin-actions';[['approved','✓ Aprobar y publicar'],['rejected','× Rechazar']].forEach(([next,text])=>{const b=document.createElement('button');b.textContent=text;b.className=next==='approved'?'approve':'reject';if(current===next)b.classList.add('selected');b.onclick=()=>handler(next,b);actions.appendChild(b)});return actions}
async function reviewStory(s,edited,next,button){button.disabled=true;message('Guardando historia…');try{
 const paths=s.photo_paths||[];if(next==='approved'&&paths.length){for(const path of paths){const{error}=await sb.storage.from('story-submissions').copy(path,path,{destinationBucket:'story-published'});if(error&&!String(error.message).includes('already'))throw error}}
 const{error}=await sb.from('stories').update({body:edited,status:next,reviewed_at:new Date().toISOString(),published_at:next==='approved'?new Date().toISOString():null}).eq('id',s.id);if(error)throw error;message(next==='approved'?'Historia publicada.':'Historia rechazada.');await load();
}catch(e){message('No se pudo guardar: '+e.message)}finally{button.disabled=false}}
async function reviewComment(c,edited,next,button){button.disabled=true;message('Guardando comentario…');try{
 const{error}=await sb.from('comments').update({body:edited,status:next,reviewed_at:new Date().toISOString(),published_at:next==='approved'?new Date().toISOString():null}).eq('id',c.id);if(error)throw error;message(next==='approved'?'Comentario publicado.':'Comentario rechazado.');await load();
}catch(e){message('No se pudo guardar: '+e.message)}finally{button.disabled=false}}
document.querySelector('#password-login').onsubmit=async e=>{
  e.preventDefault();
  const status=document.querySelector('#login-status');
  const email=document.querySelector('#login-user').value.trim().toLowerCase();
  const password=document.querySelector('#login-password').value;
  status.className='form-status'; status.textContent='Ingresando…';
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  const allowed=!error&&data.user?.id===ADMIN_ID;
  if(!allowed&&data.user) await sb.auth.signOut();
  status.className='form-status '+(allowed?'is-success':'is-error');
  status.textContent=allowed?'Acceso correcto.':'Usuario o contraseña incorrectos.';
};
document.querySelector('#password-form').onsubmit=async e=>{e.preventDefault();const st=document.querySelector('#password-status'),a=document.querySelector('#new-password').value,b=document.querySelector('#repeat-password').value;if(a!==b){st.className='form-status show error';st.textContent='Las dos contraseñas no coinciden.';return}st.className='form-status show ok';st.textContent='Guardando…';const{error}=await sb.auth.updateUser({password:a});st.className='form-status show '+(error?'error':'ok');st.textContent=error?('No se pudo guardar: '+error.message):'Contraseña guardada. Desde ahora entrarás sin correos.';if(!error)e.target.reset()};
document.querySelector('#refresh-all').onclick=load;document.querySelector('#logout').onclick=()=>sb.auth.signOut();
let sessionRun=0;
async function session(){
  const run=++sessionRun;
  const {data,error}=await sb.auth.getUser();
  if(run!==sessionRun) return;
  const ok=!error&&data.user?.id===ADMIN_ID;
  login.hidden=ok;
  shell.hidden=!ok;
  area.hidden=!ok;
  if(ok) load();
  else if(data.user) await sb.auth.signOut();
}
sb.auth.onAuthStateChange(()=>setTimeout(session,0));
session();
