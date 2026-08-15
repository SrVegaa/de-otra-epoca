import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm';
const URL='https://bgfauwszjpmztgpcoobq.supabase.co',KEY='sb_publishable_E4GqF4Hj5GGYfmG7-Wor6Q_0QgjYND0',EMAIL='abelardoadrian@gmail.com',sb=createClient(URL,KEY);
const login=document.querySelector('#admin-login'),area=document.querySelector('#admin-area'),storyList=document.querySelector('#admin-list'),commentList=document.querySelector('#comment-list'),status=document.querySelector('#admin-status');
function message(t){status.textContent=t}
function label(value){return value==='pending'?'Pendiente':value==='approved'?'Publicado':'Rechazado'}
async function load(){
 message('Cargando aportes…');
 const[storiesResult,commentsResult]=await Promise.all([sb.from('stories').select('*').order('created_at',{ascending:false}),sb.from('comments').select('*').order('created_at',{ascending:false})]);
 if(storiesResult.error||commentsResult.error){message('No se pudieron cargar todos los aportes.');return}
 renderStories(storiesResult.data);renderComments(commentsResult.data);message('');
}
function renderStories(items){
 storyList.innerHTML='';document.querySelector('#story-count').textContent='('+items.filter(x=>x.status==='pending').length+' pendientes)';
 if(!items.length){storyList.innerHTML='<p class="comment-empty">Todavía no hay historias recibidas.</p>';return}
 items.forEach(s=>{const card=document.createElement('article');card.className='admin-card';
 const h=document.createElement('h3');h.textContent=s.title;const meta=document.createElement('p');meta.className='admin-meta';meta.textContent=(s.author_name||'Anónimo')+' · '+s.author_email+' · '+label(s.status);
 const body=document.createElement('textarea');body.value=s.body;const actions=buttons((next,b)=>reviewStory(s,body.value,next,b));card.append(h,meta,body,actions);storyList.appendChild(card)});
}
function renderComments(items){
 commentList.innerHTML='';document.querySelector('#comment-count').textContent='('+items.filter(x=>x.status==='pending').length+' pendientes)';
 if(!items.length){commentList.innerHTML='<p class="comment-empty">Todavía no hay comentarios recibidos.</p>';return}
 items.forEach(c=>{const card=document.createElement('article');card.className='admin-card';
 const h=document.createElement('h3');h.textContent='Comentario en: '+c.story_slug.replaceAll('-',' ');const meta=document.createElement('p');meta.className='admin-meta';meta.textContent=(c.author_name||'Anónimo')+' · '+c.author_email+' · '+label(c.status);
 const body=document.createElement('textarea');body.value=c.body;body.className='comment-review-text';const actions=buttons((next,b)=>reviewComment(c,body.value,next,b));card.append(h,meta,body,actions);commentList.appendChild(card)});
}
function buttons(handler){const actions=document.createElement('div');actions.className='admin-actions';[['approved','Aprobar y publicar'],['rejected','Rechazar']].forEach(([next,text])=>{const b=document.createElement('button');b.textContent=text;b.onclick=()=>handler(next,b);actions.appendChild(b)});return actions}
async function reviewStory(s,edited,next,button){button.disabled=true;message('Guardando historia…');try{
 const paths=s.photo_paths||[];if(next==='approved'&&paths.length){for(const path of paths){const{error}=await sb.storage.from('story-submissions').copy(path,path,{destinationBucket:'story-published'});if(error&&!String(error.message).includes('already'))throw error}}
 const{error}=await sb.from('stories').update({body:edited,status:next,reviewed_at:new Date().toISOString(),published_at:next==='approved'?new Date().toISOString():null}).eq('id',s.id);if(error)throw error;message(next==='approved'?'Historia publicada.':'Historia rechazada.');await load();
}catch(e){message('No se pudo guardar: '+e.message)}finally{button.disabled=false}}
async function reviewComment(c,edited,next,button){button.disabled=true;message('Guardando comentario…');try{
 const{error}=await sb.from('comments').update({body:edited,status:next,reviewed_at:new Date().toISOString(),published_at:next==='approved'?new Date().toISOString():null}).eq('id',c.id);if(error)throw error;message(next==='approved'?'Comentario publicado.':'Comentario rechazado.');await load();
}catch(e){message('No se pudo guardar: '+e.message)}finally{button.disabled=false}}
document.querySelector('#password-login').onsubmit=async e=>{e.preventDefault();const st=document.querySelector('#login-status'),password=document.querySelector('#login-password').value;st.className='form-status show ok';st.textContent='Ingresando…';const{error}=await sb.auth.signInWithPassword({email:EMAIL,password});st.className='form-status show '+(error?'error':'ok');st.textContent=error?'La contraseña no es correcta o todavía no fue creada.':'Acceso correcto.'};
document.querySelector('#email-access').onclick=async()=>{const st=document.querySelector('#email-status'),button=document.querySelector('#email-access');button.disabled=true;st.className='form-status show ok';st.textContent='Solicitando el enlace…';const{error}=await sb.auth.signInWithOtp({email:EMAIL,options:{shouldCreateUser:false,emailRedirectTo:'https://srvegaa.github.io/de-otra-epoca/admin.html'}});st.className='form-status show '+(error?'error':'ok');st.textContent=error?(String(error.message).includes('rate limit')?'Supabase alcanzó el límite de correos. Esperá una hora antes de volver a intentar.':'No se pudo enviar el enlace.'):'Revisá tu correo. Usá solamente el mensaje más nuevo.';setTimeout(()=>button.disabled=false,60000)};
document.querySelector('#password-form').onsubmit=async e=>{e.preventDefault();const st=document.querySelector('#password-status'),a=document.querySelector('#new-password').value,b=document.querySelector('#repeat-password').value;if(a!==b){st.className='form-status show error';st.textContent='Las dos contraseñas no coinciden.';return}st.className='form-status show ok';st.textContent='Guardando…';const{error}=await sb.auth.updateUser({password:a});st.className='form-status show '+(error?'error':'ok');st.textContent=error?('No se pudo guardar: '+error.message):'Contraseña guardada. Desde ahora entrarás sin correos.';if(!error)e.target.reset()};
document.querySelector('#refresh-all').onclick=load;document.querySelector('#logout').onclick=()=>sb.auth.signOut();
async function session(){const{data}=await sb.auth.getSession();const ok=data.session?.user?.email===EMAIL;login.hidden=ok;area.hidden=!ok;if(ok)load()}
sb.auth.onAuthStateChange(()=>session());session();