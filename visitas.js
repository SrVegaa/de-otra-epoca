const VISIT_URL='https://bgfauwszjpmztgpcoobq.supabase.co';
const VISIT_KEY='sb_publishable_E4GqF4Hj5GGYfmG7-Wor6Q_0QgjYND0';

function visitorId(){
  const key='deotraepoca_visitante';
  try{
    let id=localStorage.getItem(key);
    if(!id){
      id=crypto.randomUUID();
      localStorage.setItem(key,id);
    }
    return id;
  }catch{
    return crypto.randomUUID();
  }
}

async function registerVisit(){
  const counter=document.querySelector('[data-visit-count]');
  try{
    const response=await fetch(`${VISIT_URL}/rest/v1/rpc/record_site_visit`,{
      method:'POST',
      headers:{apikey:VISIT_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({p_visitor_id:visitorId(),p_page_path:location.pathname})
    });
    if(!response.ok)throw new Error();
    const total=await response.json();
    if(counter){
      counter.textContent=`Este rincón ya recibió ${Number(total).toLocaleString('es-AR')} visitas.`;
      counter.hidden=false;
    }
  }catch{
    if(counter)counter.hidden=true;
  }
}
registerVisit();
