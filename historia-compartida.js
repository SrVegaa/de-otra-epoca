const URL='https://bgfauwszjpmztgpcoobq.supabase.co',KEY='sb_publishable_E4GqF4Hj5GGYfmG7-Wor6Q_0QgjYND0',headers={apikey:KEY,Authorization:'Bearer '+KEY};
const id=new URLSearchParams(location.search).get('id');
const title=document.querySelector('#shared-title'),author=document.querySelector('#shared-author'),body=document.querySelector('#shared-body'),photos=document.querySelector('#shared-photos');
(async()=>{try{
 if(!id)throw new Error();
 const r=await fetch(URL+'/rest/v1/stories?id=eq.'+encodeURIComponent(id)+'&status=eq.approved&select=title,body,author_mode,author_name,photo_paths',{headers});
 if(!r.ok)throw new Error(); const [s]=await r.json(); if(!s)throw new Error();
 document.title=s.title+' — De Otra Época'; title.textContent=s.title;
 author.textContent='Autor: '+(s.author_mode==='anonymous'||!s.author_name?'Anónimo':s.author_name);
 s.body.split(/\n+/).filter(Boolean).forEach(t=>{const p=document.createElement('p');p.textContent=t;body.appendChild(p)});
 (s.photo_paths||[]).forEach(path=>{const img=document.createElement('img');img.src=URL+'/storage/v1/object/public/story-published/'+path;img.alt='Fotografía de '+s.title;img.loading='lazy';photos.appendChild(img)});
}catch{title.textContent='Esta historia no está disponible';body.textContent='Puede estar pendiente de revisión o haber sido retirada.'}})();