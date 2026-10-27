import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm';
const ADMIN_ID='f5de4699-d26e-4b10-9c75-fea1dcb44c52',URL='https://bgfauwszjpmztgpcoobq.supabase.co',KEY='sb_publishable_E4GqF4Hj5GGYfmG7-Wor6Q_0QgjYND0',EMAIL='abelardoadrian@gmail.com',sb=createClient(URL,KEY,{global:{fetch:(input,init={})=>fetch(input,{...init,cache:'no-store'})}});
const login=document.querySelector('#admin-login'),shell=document.querySelector('#admin-shell'),area=document.querySelector('#admin-area'),storyList=document.querySelector('#admin-list'),commentList=document.querySelector('#comment-list'),postcardList=document.querySelector('#postcard-list'),status=document.querySelector('#admin-status'),officialForm=document.querySelector('#official-story-form'),officialList=document.querySelector('#official-list');
function message(t){status.textContent=t;status.classList.toggle('show',Boolean(t))}
function label(value){return value==='pending'?'Pendiente':value==='approved'?'Publicado':'Rechazado'}
function date(value){if(!value)return'';return new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value))}
async function load(){
 message('Actualizando el panel…');
 const[storiesResult,commentsResult,postcardsResult,visitsResult]=await Promise.all([sb.from('stories').select('*').order('created_at',{ascending:false}),sb.from('comments').select('*').order('created_at',{ascending:false}),sb.from('postcards').select('*').order('created_at',{ascending:false}),sb.rpc('get_admin_visit_stats')]);
 if(storiesResult.error||commentsResult.error||postcardsResult.error){const error=storiesResult.error||commentsResult.error||postcardsResult.error;message(`No se pudieron cargar los aportes: ${error.message}`);return}
 await renderOfficialStories(storiesResult.data.filter(x=>x.source_kind==='official'));await renderStories(storiesResult.data.filter(x=>x.source_kind!=='official'));renderComments(commentsResult.data);await renderPostcards(postcardsResult.data);
 const storyPending=storiesResult.data.filter(x=>x.status==='pending').length,commentPending=commentsResult.data.filter(x=>x.status==='pending').length;
 document.querySelector('#story-pending-stat').textContent=storyPending;
 document.querySelector('#comment-pending-stat').textContent=commentPending;
 document.querySelector('#postcard-pending-stat').textContent=postcardsResult.data.filter(x=>x.status==='pending').length;
 document.querySelector('#total-stat').textContent=storiesResult.data.length+commentsResult.data.length+postcardsResult.data.length;
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
async function storyPhotos(story){
 const paths=story.photo_paths||[];if(!paths.length)return null;
 const strip=document.createElement('div');strip.className='admin-photo-strip';
 const bucket=story.status==='approved'?'story-published':'story-submissions';
 for(const [index,path] of paths.entries()){
  let url='';
  if(bucket==='story-published'){url=sb.storage.from(bucket).getPublicUrl(path).data.publicUrl}
  else{const signed=await sb.storage.from(bucket).createSignedUrl(path,600);url=signed.data?.signedUrl||''}
  if(!url)continue;
  const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');
  img.src=url;img.alt='Foto '+(index+1)+' de '+story.title;img.loading='lazy';caption.textContent='Foto '+(index+1);
  figure.append(img,caption);strip.append(figure);
 }
 return strip.childElementCount?strip:null
}
async function renderOfficialStories(items){
 officialList.replaceChildren();
 if(!items.length){officialList.innerHTML='<p class="admin-empty">Todavía no cargaste historias desde este apartado.</p>';return}
 items.sort((a,b)=>(a.story_number||999)-(b.story_number||999));
 for(const s of items){const card=document.createElement('article');card.className='admin-card status-'+s.status;const top=document.createElement('div');top.className='admin-card-title';const h=document.createElement('h3');h.textContent=s.title;const kind=document.createElement('small');kind.textContent='HISTORIA '+String(s.story_number||'').padStart(2,'0');top.append(h,kind);card.append(top);const preview=await storyPhotos(s);if(preview)card.append(preview);officialList.append(card)}
}
async function renderStories(items){
 storyList.innerHTML='';const pending=items.filter(x=>x.status==='pending').length;
 document.querySelector('#story-count').textContent=pending+' pendiente'+(pending===1?'':'s');
 if(!items.length){storyList.innerHTML='<p class="admin-empty">Todavía no hay historias recibidas.</p>';return}
 for(const s of items){const card=document.createElement('article');card.className='admin-card status-'+s.status;
 const top=document.createElement('div');top.className='admin-card-title';const h=document.createElement('h3');h.textContent=s.title;const kind=document.createElement('small');kind.textContent='HISTORIA DE LECTOR';top.append(h,kind);
 const body=document.createElement('textarea');body.value=s.body;body.setAttribute('aria-label','Texto de '+s.title);
 const preview=await storyPhotos(s);const actions=buttons((next,b)=>reviewStory(s,body.value,next,b),s.status);card.append(top,meta(s.author_name,s.author_email,s.status,s.created_at),body);if(preview)card.append(preview);card.append(actions);storyList.appendChild(card)}
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
async function renderPostcards(items){
 postcardList.replaceChildren();
 const pending=items.filter(x=>x.status==='pending').length;
 document.querySelector('#postcard-count').textContent=pending+' pendiente'+(pending===1?'':'s');
 if(!items.length){const empty=document.createElement('p');empty.className='admin-empty';empty.textContent='Todavía no hay postales recibidas.';postcardList.append(empty);return}
 for(const p of items){
  const card=document.createElement('article');card.className='admin-card status-'+p.status+' postcard-admin-card';
  const top=document.createElement('div');top.className='admin-card-title';const h=document.createElement('h3');h.textContent=p.display_name||'Postal sin nombre';const kind=document.createElement('small');kind.textContent='POSTAL · '+label(p.status).toUpperCase();top.append(h,kind);
  const metaLine=document.createElement('p');metaLine.className='admin-card-meta';metaLine.textContent='Recibida el '+date(p.created_at)+(p.approximate_year?' · Año aproximado: '+p.approximate_year:'');
  const image=document.createElement('img');image.className='postcard-admin-image';image.alt='Fotografía enviada por '+(p.display_name||'un visitante');image.loading='lazy';
  if(p.status==='approved'&&p.published_image_path) image.src=sb.storage.from('postcards-published').getPublicUrl(p.published_image_path).data.publicUrl;
  else {const signed=await sb.storage.from('postcards-pending').createSignedUrl(p.image_path,600);image.src=signed.data?.signedUrl||''}
  const fields=document.createElement('div');fields.className='postcard-admin-fields';
  const name=document.createElement('input');name.value=p.display_name||'';name.maxLength=60;name.setAttribute('aria-label','Nombre o apodo');
  const year=document.createElement('input');year.type='number';year.min='1900';year.max='2100';year.placeholder='Año aproximado';year.value=p.approximate_year||'';year.setAttribute('aria-label','Año aproximado');
  const body=document.createElement('textarea');body.value=p.description||'';body.maxLength=200;body.setAttribute('aria-label','Descripción de la postal');
  fields.append(name,year,body);
  const actions=document.createElement('div');actions.className='admin-actions postcard-admin-actions';
  const save=document.createElement('button');save.className='approve';save.textContent='Guardar cambios';save.onclick=()=>postcardAction(p.id,'edit',{display_name:name.value,approximate_year:year.value,description:body.value},save);
  const approve=document.createElement('button');approve.className='approve';approve.textContent=p.status==='approved'?'Publicada':'✓ Aprobar y publicar';approve.disabled=p.status==='approved';approve.onclick=()=>postcardAction(p.id,'approve',{},approve);
  const reject=document.createElement('button');reject.className='reject';reject.textContent=p.status==='rejected'?'Rechazada':'× Rechazar';reject.disabled=p.status==='rejected';reject.onclick=()=>postcardAction(p.id,'reject',{},reject);
  const remove=document.createElement('button');remove.className='reject';remove.textContent='Eliminar postal';remove.onclick=()=>{if(confirm('¿Eliminar esta fotografía y su descripción? Esta acción no se puede deshacer.'))postcardAction(p.id,'delete',{},remove)};
  actions.append(save,approve,reject,remove);card.append(top,metaLine,image,fields,actions);postcardList.append(card);
 }
}
async function postcardAction(id,action,fields,button){
 button.disabled=true;message(action==='delete'?'Eliminando postal…':'Guardando postal…');
 try{const{data,error}=await sb.functions.invoke('postcards',{body:{action,id,...fields}});if(error||!data?.ok){let detail=data?.error||error?.message||'No se pudo guardar la postal.';try{if(error?.context instanceof Response){const body=await error.context.clone().json();detail=body?.error||detail}}catch{}throw new Error(detail)}await load();message(action==='approve'?'Postal aprobada y publicada.':action==='reject'?'Postal rechazada.':action==='delete'?'Postal eliminada.':'Cambios guardados.')}catch(e){message('No se pudo guardar: '+e.message)}finally{button.disabled=false}
}
function buttons(handler,current){const actions=document.createElement('div');actions.className='admin-actions';[['approved','✓ Aprobar y publicar'],['rejected','× Rechazar']].forEach(([next,text])=>{const b=document.createElement('button');b.textContent=text;b.className=next==='approved'?'approve':'reject';if(current===next)b.classList.add('selected');b.onclick=()=>handler(next,b);actions.appendChild(b)});return actions}
async function reviewStory(s,edited,next,button){
 button.disabled=true;message('Guardando historia…');
 try{
  const paths=s.photo_paths||[];
  if(next==='approved'&&paths.length){
   for(const path of paths){
    const{error}=await sb.storage.from('story-submissions').copy(path,path,{destinationBucket:'story-published'});
    if(error&&!String(error.message).toLowerCase().includes('already'))throw error
   }
  }
  const{error}=await sb.from('stories').update({body:edited,status:next,reviewed_at:new Date().toISOString(),published_at:next==='approved'?new Date().toISOString():null}).eq('id',s.id);
  if(error)throw error;
  let cleanupError=null;
  if(next==='approved'&&paths.length){
   const removed=await sb.storage.from('story-submissions').remove(paths);
   cleanupError=removed.error
  }
  await load();
  message(cleanupError?'Historia publicada, pero no se pudieron eliminar todas las copias pendientes: '+cleanupError.message:next==='approved'?'Historia publicada y copias pendientes eliminadas.':'Historia rechazada.');
 }catch(e){message('No se pudo guardar: '+e.message)}finally{button.disabled=false}
}
async function reviewComment(c,edited,next,button){button.disabled=true;message('Guardando comentario…');try{
 const{error}=await sb.from('comments').update({body:edited,status:next,reviewed_at:new Date().toISOString(),published_at:next==='approved'?new Date().toISOString():null}).eq('id',c.id);if(error)throw error;message(next==='approved'?'Comentario publicado.':'Comentario rechazado.');await load();
}catch(e){message('No se pudo guardar: '+e.message)}finally{button.disabled=false}}

const officialPhotos=document.querySelector('#official-photos'),officialPhotoPreview=document.querySelector('#official-photo-preview');
officialPhotos?.addEventListener('change',()=>{officialPhotoPreview.replaceChildren();[...officialPhotos.files].slice(0,3).forEach(file=>{const chip=document.createElement('span');chip.textContent=file.name;officialPhotoPreview.append(chip)})});
function officialStatus(text,type){const el=document.querySelector('#official-story-status');el.textContent=text;el.className='form-status show '+type}
function slugify(text){return text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
officialForm.onsubmit=async event=>{
 event.preventDefault();const button=officialForm.querySelector('button[type="submit"]');button.disabled=true;officialStatus('Publicando historia…','ok');
 try{
  const formData=new FormData(officialForm),title=String(formData.get('title')||'').trim(),body=String(formData.get('body')||'').trim(),excerpt=String(formData.get('excerpt')||'').trim();
  if(title.length<3||body.length<80)throw new Error('Completá el título y una historia de al menos 80 caracteres.');
  const files=[...(officialPhotos.files||[])].slice(0,3),folder='official/'+crypto.randomUUID(),paths=[];
  for(const [index,file] of files.entries()){
   if(file.size>5*1024*1024)throw new Error('Cada foto debe pesar menos de 5 MB.');
   if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Las fotos deben ser JPG, PNG o WebP.');
   const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const path=folder+'/'+Date.now()+'-'+index+'.'+ext;
   const uploaded=await sb.storage.from('story-published').upload(path,file,{contentType:file.type,upsert:false});if(uploaded.error)throw uploaded.error;paths.push(path)
  }
  const latest=await sb.from('stories').select('story_number').eq('source_kind','official').order('story_number',{ascending:false}).limit(1).maybeSingle();if(latest.error)throw latest.error;
  const number=(latest.data?.story_number||5)+1,now=new Date().toISOString();
  const inserted=await sb.from('stories').insert({title,body,excerpt:excerpt||null,author_mode:'name',author_name:'A. Vega',author_email:EMAIL,photo_paths:paths,consent:true,status:'approved',slug:slugify(title),source_kind:'official',story_number:number,reviewed_at:now,published_at:now});if(inserted.error)throw inserted.error;
  officialForm.reset();officialPhotoPreview.replaceChildren();officialStatus('Historia '+String(number).padStart(2,'0')+' publicada.','ok');await load();
 }catch(error){officialStatus('No se pudo publicar: '+error.message,'error')}finally{button.disabled=false}
};

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
