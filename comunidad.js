const SUPABASE_URL = 'https://bgfauwszjpmztgpcoobq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_E4GqF4Hj5GGYfmG7-Wor6Q_0QgjYND0';
const API = `${SUPABASE_URL}/rest/v1`;
const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };

function setStatus(el, message, type) {
  if (!el) return;
  el.textContent = message;
  el.className = `form-status show ${type}`;
}

async function uploadPhotos(files) {
  const paths = [];
  const submissionId = crypto.randomUUID();
  for (const [index, file] of [...files].slice(0, 3).entries()) {
    if (file.size > 5 * 1024 * 1024) throw new Error('Cada foto debe pesar menos de 5 MB.');
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Las fotos deben ser JPG, PNG o WebP.');
    const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${submissionId}/${Date.now()}-${index}.${ext}`;
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/story-submissions/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': file.type, 'x-upsert': 'false' },
      body: file
    });
    if (!response.ok) throw new Error('No se pudo subir una de las fotos.');
    paths.push(path);
  }
  return paths;
}

const storyForm = document.querySelector('#story-form');
if (storyForm) {
  const status = document.querySelector('#story-status');
  const photos = document.querySelector('#photos');
  const preview = document.querySelector('#photo-preview');
  photos?.addEventListener('change', () => {
    preview.innerHTML = '';
    [...photos.files].slice(0,3).forEach(file => { const chip=document.createElement('span'); chip.textContent=file.name; preview.appendChild(chip); });
  });
  storyForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = storyForm.querySelector('button');
    button.disabled = true;
    setStatus(status, 'Enviando tu recuerdo…', 'ok');
    try {
      const data = new FormData(storyForm);
      const title = String(data.get('title') || '').trim();
      const body = String(data.get('body') || '').trim();
      const email = String(data.get('email') || '').trim();
      const name = String(data.get('name') || '').trim();
      const authorMode = String(data.get('author_mode') || 'name');
      if (title.length < 3 || body.length < 80 || !email) throw new Error('Completá el título, una historia de al menos 80 caracteres y un correo de contacto.');
      const photoPaths = await uploadPhotos(photos?.files || []);
      const response = await fetch(`${API}/stories`, { method:'POST', headers:{...headers, Prefer:'return=minimal'}, body:JSON.stringify({ title, body, author_email:email, author_name:name || null, author_mode:authorMode, photo_paths:photoPaths, consent:true, status:'pending' }) });
      if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.message || 'No pudimos guardar la historia. Probá nuevamente.'); }
      storyForm.reset(); preview.innerHTML='';
      setStatus(status, '¡Recibida! Tu historia quedó pendiente de revisión. No se publicará hasta ser aprobada.', 'ok');
    } catch (error) { setStatus(status, error.message || 'Ocurrió un error al enviar.', 'error'); }
    finally { button.disabled = false; }
  });
}

async function loadComments(slug, list) {
  try {
    const response = await fetch(`${API}/comments?story_slug=eq.${encodeURIComponent(slug)}&status=eq.approved&published_at=not.is.null&select=author_name,body,published_at&order=published_at.asc`, { headers });
    if (!response.ok) throw new Error();
    const comments = await response.json();
    list.innerHTML = '';
    if (!comments.length) { list.innerHTML = '<p class="comment-empty">Todavía no hay comentarios publicados. Podés ser el primero en dejar uno.</p>'; return; }
    comments.forEach(comment => {
      const card=document.createElement('article'); card.className='comment-card';
      const strong=document.createElement('strong'); strong.textContent=comment.author_name?.trim() || 'Un lector de otra época';
      const p=document.createElement('p'); p.textContent=comment.body;
      card.append(strong,p); list.appendChild(card);
    });
  } catch { list.innerHTML='<p class="comment-empty">No pudimos cargar los comentarios en este momento.</p>'; }
}

document.querySelectorAll('[data-comments]').forEach(box => {
  const slug=box.dataset.comments; const list=box.querySelector('.comments-list'); const form=box.querySelector('.comment-form'); const status=box.querySelector('.form-status');
  loadComments(slug,list);
  form?.addEventListener('submit', async event => {
    event.preventDefault(); const data=new FormData(form); const body=String(data.get('body')||'').trim(); const email=String(data.get('email')||'').trim(); const name=String(data.get('name')||'').trim();
    try {
      if(body.length<2 || !email) throw new Error('Escribí tu comentario y un correo de contacto.');
      const response=await fetch(`${API}/comments`,{method:'POST',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({story_slug:slug,author_name:name||null,author_email:email,body,status:'pending'})});
      if(!response.ok) throw new Error('No pudimos guardar el comentario.');
      form.reset(); setStatus(status,'Comentario recibido. Quedó pendiente de revisión antes de publicarse.','ok');
    } catch(error){setStatus(status,error.message||'Ocurrió un error.','error');}
  });
});
