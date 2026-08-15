import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm';
const URL='https://bgfauwszjpmztgpcoobq.supabase.co',KEY='sb_publishable_E4GqF4Hj5GGYfmG7-Wor6Q_0QgjYND0',EMAIL='abelardoadrian@gmail.com',sb=createClient(URL,KEY);
const login=document.querySelector('#admin-login'),area=document.querySelector('#admin-area'),list=document.querySelector('#admin-list'),status=document.querySelector('#admin-status');
function message(t){status.textContent=t}
async function load(){
 message('Cargando…'); const{data,error}=await sb.from('stories').select('*').order('created_at',{ascending:false}); if(error){message('No se pudieron cargar las historias.');return}
 list.innerHTML=''; message(data.length?'':'Todavía no hay historias recibidas.');
 data.forEach(s=>{const card=document.createElement('article');card.className='admin-card';
 const h=document.createElement('h2');h.textContent=s.title;
 const meta=document.createElement('p');meta.className='admin-meta';meta.textContent=(s.author_name||'Anónimo')+' · '+s.author_email+' · Estado: '+s.status;
 const body=document.createElement('textarea');body.value=s.body;
 const actions=document.createElement('div');actions.className='admin-actions';
 ['approved','rejected'].forEach(next=>{const b=document.createElement('button');b.textContent=next==='approved'?'Aprobar y publicar':'Rechazar';b.onclick=()=>review(s,body.value,next,b);actions.appendChild(b)});
 card.append(h,meta,body,actions);list.appendChild(card)});
}
async function review(s,edited,next,button){button.disabled=true;message('Guardando…');try{
 let paths=s.photo_paths||[];
 if(next==='approved'&&paths.length){for(const path of paths){const{error}=await sb.storage.from('story-submissions').copy(path,path,{destinationBucket:'story-published'});if(error&&!String(error.message).includes('already'))throw error}}
 const patch={body:edited,status:next,reviewed_at:new Date().toISOString(),published_at:next==='approved'?new Date().toISOString():null};
 const{error}=await sb.from('stories').update(patch).eq('id',s.id);if(error)throw error;message(next==='approved'?'Historia publicada.':'Historia rechazada.');await load();
}catch(e){message('No se pudo guardar: '+e.message)}finally{button.disabled=false}}
document.querySelector('#login-form').onsubmit=async e=>{e.preventDefault();const st=document.querySelector('#login-status');st.className='form-status show ok';st.textContent='Enviando acceso…';const{error}=await sb.auth.signInWithOtp({email:EMAIL,options:{emailRedirectTo:location.href}});st.className='form-status show '+(error?'error':'ok');st.textContent=error?'No se pudo enviar el acceso.':'Revisá tu correo y abrí el enlace seguro.'};
document.querySelector('#refresh-stories').onclick=load;document.querySelector('#logout').onclick=()=>sb.auth.signOut();
async function session(){const{data}=await sb.auth.getSession();const ok=data.session?.user?.email===EMAIL;login.hidden=ok;area.hidden=!ok;if(ok)load()}
sb.auth.onAuthStateChange(()=>session());session();