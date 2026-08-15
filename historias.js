const SUPABASE_URL='https://bgfauwszjpmztgpcoobq.supabase.co';
const SUPABASE_KEY='sb_publishable_E4GqF4Hj5GGYfmG7-Wor6Q_0QgjYND0';
const headers={apikey:SUPABASE_KEY};
const list=document.querySelector('#stories-list');
const search=document.querySelector('#story-search');
function applyFilter(){
  const q=(search?.value||'').toLocaleLowerCase('es');
  document.querySelectorAll('.contents-card').forEach(card=>{
    card.hidden=!card.textContent.toLocaleLowerCase('es').includes(q);
  });
}
search?.addEventListener('input',applyFilter);
(async()=>{
  try{
    const r=await fetch(SUPABASE_URL+'/rest/v1/stories?status=eq.approved&select=id,title,excerpt,author_mode,author_name,published_at&order=published_at.desc',{headers});
    if(!r.ok) throw new Error();
    const stories=await r.json();
    stories.forEach((story,i)=>{
      const a=document.createElement('a'); a.className='contents-card community-story';
      a.href='historia-compartida.html?id='+encodeURIComponent(story.id);
      const number=document.createElement('span'); number.className='contents-number'; number.textContent='LECTOR '+String(i+1).padStart(2,'0');
      const text=document.createElement('span'); text.className='contents-main';
      const title=document.createElement('strong'); title.textContent=story.title;
      const author=document.createElement('small'); author.textContent='Autor: '+(story.author_mode==='anonymous'||!story.author_name?'Anónimo':story.author_name);
      text.append(title,author);
      const excerpt=document.createElement('em'); excerpt.textContent=story.excerpt||'Un recuerdo compartido por un lector.';
      a.append(number,text,excerpt); list.appendChild(a);
    });
    applyFilter();
  }catch{
    const p=document.querySelector('#stories-message'); if(p)p.textContent='Las historias de lectores volverán a estar disponibles en unos minutos.';
  }
})();