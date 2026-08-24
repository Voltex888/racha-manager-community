const RARITY_BG_DB='racha-manager-rarity-backgrounds-v7';
const RARITY_BG_STORE='backgrounds';
const RARITY_BG_TIERS=['none','bronze','silver','gold','prismatic','collector','goat','cosmic'];
const RARITY_BG_CONTEXTS=['player','ranking','record','month','month-current','month-achievement','month-header','month-player','profile','profile-main'];
const rarityBgCache=new Map();
function openRarityBgDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(RARITY_BG_DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(RARITY_BG_STORE))req.result.createObjectStore(RARITY_BG_STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function rarityBgPutLocal(k,v){try{const db=await openRarityBgDb();return await new Promise((res,rej)=>{const tx=db.transaction(RARITY_BG_STORE,'readwrite');tx.objectStore(RARITY_BG_STORE).put(v,k);tx.oncomplete=()=>{db.close();res()};tx.onerror=()=>rej(tx.error)})}catch(error){console.warn('Cache local de fundos indisponível:',error)}}
async function rarityBgGetLocal(k){try{const db=await openRarityBgDb();return await new Promise((res,rej)=>{const q=db.transaction(RARITY_BG_STORE,'readonly').objectStore(RARITY_BG_STORE).get(k);q.onsuccess=()=>{const v=q.result||null;db.close();res(v)};q.onerror=()=>rej(q.error)})}catch(error){console.warn('Cache local de fundos indisponível:',error);return null}}
async function rarityBgDeleteLocal(k){try{const db=await openRarityBgDb();return await new Promise((res,rej)=>{const tx=db.transaction(RARITY_BG_STORE,'readwrite');tx.objectStore(RARITY_BG_STORE).delete(k);tx.oncomplete=()=>{db.close();res()};tx.onerror=()=>rej(tx.error)})}catch(error){console.warn('Cache local de fundos indisponível:',error)}}
function rarityBgSerializableMap(){const out={};for(const [k,v] of rarityBgCache.entries()){if(!v)continue;out[k]={url:String(v.url||''),storagePath:String(v.storagePath||''),storageProvider:String(v.storageProvider||''),version:Number(v.version)||0,scaleX:Number(v.scaleX||100),scaleY:Number(v.scaleY||100),posX:Number(v.posX??50),posY:Number(v.posY??50),opacity:Number(v.opacity??.85)}}return out}
async function persistRarityBgRemote(){if(!auth.currentUser)throw new Error('Entre como organizador para salvar fundos.');const map=rarityBgSerializableMap();loadedRarityBackgrounds=map;await withFirebaseTimeout(setDoc(dataDocRef,{rarityBackgrounds:map},{merge:true}),12000,'salvamento dos fundos')}
function rarityBgSupabasePath(setting){return normalizeSupabaseMediaPath(setting?.storagePath || setting?.url || '')}
function rarityBgPathStillReferenced(path){
  const normalized=normalizeSupabaseMediaPath(path);if(!normalized)return false;
  return [...rarityBgCache.values()].some(setting=>rarityBgSupabasePath(setting)===normalized);
}
async function cleanupPreviousRarityBackground(previous,current){
  const oldSupabasePath=rarityBgSupabasePath(previous),newSupabasePath=rarityBgSupabasePath(current);
  if(oldSupabasePath && oldSupabasePath!==newSupabasePath && !rarityBgPathStillReferenced(oldSupabasePath)){
    await deleteSupabaseMediaObjectBestEffort(oldSupabasePath,'fundo antigo');
    return;
  }
  if(previous?.storagePath && !oldSupabasePath && previous?.storageProvider!=='supabase' && !String(previous?.url||'').includes('.supabase.co/storage/')){
    deleteObject(storageRef(storage,previous.storagePath)).catch(error=>console.warn('Não foi possível remover o fundo legado do Firebase Storage:',error));
  }
}
async function rarityBgPut(k,v){
  const previous=rarityBgCache.get(k)||await rarityBgGetLocal(k);
  const clean={...v,dataUrl:'',version:Number(v.version)||Date.now()};
  rarityBgCache.set(k,clean);
  await rarityBgPutLocal(k,clean);
  try{await persistRarityBgRemote()}
  catch(error){
    if(previous){rarityBgCache.set(k,previous);await rarityBgPutLocal(k,previous)}
    else{rarityBgCache.delete(k);await rarityBgDeleteLocal(k)}
    throw error;
  }
  await cleanupPreviousRarityBackground(previous,clean);
  return clean;
}
async function rarityBgGet(k){if(rarityBgCache.has(k))return rarityBgCache.get(k);const local=await rarityBgGetLocal(k);if(local){rarityBgCache.set(k,local);return local}return null}
async function rarityBgDelete(k){
  const previous=rarityBgCache.get(k)||await rarityBgGetLocal(k);
  rarityBgCache.delete(k);await rarityBgDeleteLocal(k);
  try{await persistRarityBgRemote()}
  catch(error){if(previous){rarityBgCache.set(k,previous);await rarityBgPutLocal(k,previous)}throw error}
  await cleanupPreviousRarityBackground(previous,null);
}
function rarityBgKey(tier,context){return `${tier}:${context}`}
function fileToDataUrl(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result||''));r.onerror=()=>rej(r.error);r.readAsDataURL(file)})}

async function uploadRarityBackgroundToSupabase(file,tier,context){
  if(!file)throw new Error('Arquivo de fundo inválido.');
  const version=Date.now();
  const safeTier=String(tier||'none').replace(/[^a-zA-Z0-9_-]/g,'_');
  const safeContext=String(context||'player').replace(/[^a-zA-Z0-9_-]/g,'_');
  const rawName=String(file.name||'fundo').replace(/[^a-zA-Z0-9._-]+/g,'_');
  const dot=rawName.lastIndexOf('.');
  const ext=dot>0?rawName.slice(dot+1).toLowerCase():(String(file.type||'').includes('webp')?'webp':String(file.type||'').includes('jpeg')?'jpg':'png');
  const base=dot>0?rawName.slice(0,dot):rawName;
  const path=`rachas/${activeRachaId}/backgrounds/${safeTier}/${safeContext}/${version}_${base}.${ext}`;
  const encodedPath=path.split('/').map(encodeURIComponent).join('/');
  const uploadUrl=`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(SUPABASE_MEDIA_BUCKET)}/${encodedPath}`;
  let response;
  try{
    response=await withFirebaseTimeout(fetch(uploadUrl,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':file.type||'image/png','x-upsert':'false','cache-control':'3600'},body:file}),45000,'envio do fundo ao Supabase');
  }catch(error){
    throw new Error(`Falha de rede ao enviar o fundo para o Supabase: ${error?.message||error}`);
  }
  let bodyText='';
  try{bodyText=await response.text()}catch(_){}
  if(!response.ok){
    let detail=bodyText;
    try{const parsed=JSON.parse(bodyText);detail=parsed.message||parsed.error||parsed.code||bodyText}catch(_){}
    throw new Error(`Supabase Storage recusou o fundo (${response.status}${detail?`: ${detail}`:''}).`);
  }
  const publicUrl=`${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(SUPABASE_MEDIA_BUCKET)}/${encodedPath}`;
  return{url:publicUrl,storagePath:path,storageProvider:'supabase',version};
}
function rarityBgClassSet(el){
  const set=new Set();
  let node=el;
  for(let depth=0;node&&depth<4;depth++,node=node.parentElement){
    if(node.classList) node.classList.forEach(c=>set.add(c));
  }
  return set;
}
function conqueredRarityTier(el){
  const c=rarityBgClassSet(el);
  if(c.has('is-cosmic')||c.has('pd-summary-cosmic')||c.has('ranking-patent-cosmic')||c.has('record-card-cosmic')||c.has('card-cosmic')||c.has('tier-cosmic')) return 'cosmic';
  if(c.has('is-platinum')||c.has('pd-summary-platinum')||c.has('ranking-patent-platinum')||c.has('record-card-platinum')||c.has('card-platinum')||c.has('tier-platinum')) return 'collector';
  if(c.has('is-goat')||c.has('pd-summary-goat')||c.has('ranking-patent-goat')||c.has('record-card-goat')||c.has('card-goat')||c.has('tier-goat')) return 'goat';
  if(c.has('is-prismatic')||c.has('pd-summary-prismatic')||c.has('ranking-patent-prismatic')||c.has('record-card-prismatic')||c.has('card-prismatic')||c.has('tier-prismatic')) return 'prismatic';
  if(c.has('is-achievement-silver')||c.has('closed-podium-silver')||c.has('ranking-patent-silver')||c.has('record-card-silver')||c.has('card-silver')||c.has('medal-silver')||c.has('tier-silver')) return 'silver';
  if(c.has('is-achievement-bronze')||c.has('closed-podium-bronze')||c.has('ranking-patent-bronze')||c.has('record-card-bronze')||c.has('card-bronze')||c.has('medal-bronze')||c.has('tier-bronze')) return 'bronze';
  if(c.has('is-reigning')||c.has('pd-summary-titled')||c.has('ranking-patent-gold')||c.has('record-card-gold')||c.has('record-racha')||c.has('record-card-title')||c.has('card-gold')||c.has('tier-normal')||c.has('tier-mvp')||c.has('tier-artilheiro')||c.has('tier-garcom')) return 'gold';
  return 'none';
}
function rarityBgElements(tier,context){
  let candidates=[];
  if(context==='player') candidates=[...document.querySelectorAll('.player-card')];
  else if(context==='ranking') candidates=[...document.querySelectorAll('table.stat-table tbody tr')];
  else if(context==='record') candidates=[...document.querySelectorAll('.record-card,.record-achievement-row')];
  else if(context==='profile') candidates=[...document.querySelectorAll('.pd-summary,.current-title-block,.goat-block,.cosmic-block,.platinum-block')];
  else if(context==='profile-main') candidates=[...document.querySelectorAll('.pd-summary')];
  else if(context==='month') candidates=[...document.querySelectorAll('.mini-award-card,.podium-award-card')];
  else if(context==='month-current') candidates=[...document.querySelectorAll('.podium-status-block.is-current')];
  else if(context==='month-achievement') candidates=[...document.querySelectorAll('.podium-status-block.is-achievement')];
  else if(context==='month-header') candidates=[...document.querySelectorAll('.podium-award-head')];
  else if(context==='month-player') candidates=[...document.querySelectorAll('.podium-award-player,.mini-award-player')];
  return candidates.filter(el=>conqueredRarityTier(el)===tier);
}
function isRarityBgMobile(){return window.matchMedia?.('(max-width: 760px)').matches||window.innerWidth<=760}
function applyRarityBgToElement(el,setting){
  const o=Math.max(0,Math.min(1,Number(setting.opacity??.85)));
  const src=cacheBustRemoteUrl(setting.url||setting.dataUrl||'',setting.version);
  if(!src)return;
  const mobile=isRarityBgMobile();
  el.dataset.rarityCustomBg='1';
  el.dataset.rarityBgFit=mobile?'fill':'custom';
  el.style.setProperty('background-image',`linear-gradient(rgba(0,0,0,${1-o}),rgba(0,0,0,${1-o})),url(${JSON.stringify(src)})`,'important');
  if(mobile){
    el.style.setProperty('background-size','100% 100%,100% 100%','important');
    el.style.setProperty('background-position','center center,center center','important');
    el.style.setProperty('background-repeat','no-repeat,no-repeat','important');
    el.style.setProperty('background-origin','padding-box,padding-box','important');
    el.style.setProperty('background-clip','padding-box,padding-box','important');
  }else{
    el.style.setProperty('background-size',`100% 100%,${Number(setting.scaleX||100)}% ${Number(setting.scaleY||100)}%`,'important');
    el.style.setProperty('background-position',`center,${Number(setting.posX??50)}% ${Number(setting.posY??50)}%`,'important');
    el.style.setProperty('background-repeat','no-repeat,no-repeat','important');
    el.style.removeProperty('background-origin');
    el.style.removeProperty('background-clip');
  }
  if(el.matches('tr'))el.querySelectorAll('td').forEach(td=>td.style.setProperty('background','transparent','important'));
}
function clearRarityBgFromDom(){document.querySelectorAll('[data-rarity-custom-bg="1"]').forEach(el=>{el.removeAttribute('data-rarity-custom-bg');el.removeAttribute('data-rarity-bg-fit');['background-image','background-size','background-position','background-repeat','background-origin','background-clip'].forEach(p=>el.style.removeProperty(p));});}
async function preloadRarityBgCache(){
  let remote=(loadedRarityBackgrounds&&typeof loadedRarityBackgrounds==='object')?loadedRarityBackgrounds:{};
  if(!Object.keys(remote).length){
    const started=Date.now();
    while(!appDataLoaded && Date.now()-started<12000) await new Promise(r=>setTimeout(r,100));
    remote=(loadedRarityBackgrounds&&typeof loadedRarityBackgrounds==='object')?loadedRarityBackgrounds:{};
  }
  if(!Object.keys(remote).length){
    try{
      const snap=await withFirebaseTimeout(getDoc(dataDocRef),12000,'carregamento dos fundos');
      remote=snap.exists()?(snap.data().rarityBackgrounds||{}):{};
      loadedRarityBackgrounds=firestoreSafe(remote);
    }catch(error){console.warn('Fundos remotos não puderam ser carregados:',error)}
  }
  Object.entries(remote).forEach(([k,v])=>{
    if(v&&/^https?:\/\//i.test(String(v.url||''))){
      rarityBgCache.set(k,{...v,dataUrl:''});
      rarityBgPutLocal(k,{...v,dataUrl:''}).catch(()=>{});
    }
  });
  for(const t of RARITY_BG_TIERS)for(const c of RARITY_BG_CONTEXTS){
    const k=rarityBgKey(t,c);
    if(rarityBgCache.has(k))continue;
    const v=await rarityBgGetLocal(k);
    if(v)rarityBgCache.set(k,v);
  }
}
function applyAllRarityBackgroundsSync(){clearRarityBgFromDom();const entries=[...rarityBgCache.entries()].sort(([a],[b])=>{const ca=a.split(':')[1],cb=b.split(':')[1];return (ca==='profile-main'?1:0)-(cb==='profile-main'?1:0)});for(const [key,setting] of entries){const [tier,context]=key.split(':');rarityBgElements(tier,context).forEach(el=>applyRarityBgToElement(el,setting));}}
let rarityBgTimer=null;function scheduleRarityBgApply(){clearTimeout(rarityBgTimer);rarityBgTimer=setTimeout(()=>requestAnimationFrame(applyAllRarityBackgroundsSync),25)}
const rarityBgObserver=new MutationObserver(scheduleRarityBgApply);rarityBgObserver.observe(document.body,{childList:true,subtree:true});
window.addEventListener('resize',scheduleRarityBgApply,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(scheduleRarityBgApply,120),{passive:true});
function rarityBgSelection(){return{tier:$('rarityBgTier')?.value||'none',context:$('rarityBgContext')?.value||'player'}}
function setRarityBgStatus(t,type=''){$('rarityBgStatus').textContent=t;$('rarityBgStatus').className='rarity-bg-status'+(type?' '+type:'')}
function updateRarityPreviewShape(){const c=rarityBgSelection().context==='all'?'player':rarityBgSelection().context;const p=$('rarityBgPreview');p.className='rarity-bg-preview preview-'+c;const map={player:['Prévia real: card vertical','CARD DO ELENCO'],ranking:['Prévia real: linha horizontal','1º  JOGADOR                            125 PTS'],record:['Prévia real: recorde','RECORDE'],month:['Prévia real: mês encerrado','MÊS ENCERRADO'],'month-current':['Prévia: bloco Em andamento','EM ANDAMENTO'],'month-achievement':['Prévia: bloco Conquista oficial','CONQUISTA OFICIAL'],'month-header':['Prévia: cabeçalho','MVP OURO'],'month-player':['Prévia: área do jogador','JOGADOR'],profile:['Prévia: todos os blocos do perfil','PERFIL COMPLETO'],'profile-main':['Prévia: somente o card principal','CARD PRINCIPAL DO PERFIL']};$('rarityBgPreviewLabel').textContent=map[c]?.[0]||'Prévia';$('rarityBgPreviewContent').textContent=map[c]?.[1]||'PRÉVIA'}
function applyRarityPreview(src){const p=$('rarityBgPreview'),o=Number($('rarityBgOpacity').value)/100;if(src){p.style.setProperty('background-image',`linear-gradient(rgba(0,0,0,${1-o}),rgba(0,0,0,${1-o})),url(${JSON.stringify(src)})`,'important');if(isRarityBgMobile()){p.style.setProperty('background-size','100% 100%,100% 100%','important');p.style.setProperty('background-position','center center,center center','important')}else{p.style.setProperty('background-size',`100% 100%,${$('rarityBgScaleX').value}% ${$('rarityBgScaleY').value}%`,'important');p.style.setProperty('background-position',`center,${$('rarityBgPosX').value}% ${$('rarityBgPosY').value}%`,'important')}p.style.setProperty('background-repeat','no-repeat,no-repeat','important')}else{['background-image','background-size','background-position','background-repeat'].forEach(x=>p.style.removeProperty(x))}['ScaleX','ScaleY','PosX','PosY','Opacity'].forEach(k=>{const el=$('rarityBg'+k+'Value'),inp=$('rarityBg'+k);if(el&&inp)el.textContent=inp.value+'%'});updateRarityPreviewShape()}
async function previewRarityBg(){try{const f=$('rarityBgFile').files?.[0],u=$('rarityBgUrl').value.trim();const src=f?await fileToDataUrl(f):u;applyRarityPreview(src);if(src)setRarityBgStatus('Prévia carregada. Clique em Salvar fundo.','ok')}catch(e){setRarityBgStatus('Falha ao abrir a imagem: '+e.message,'error')}}
async function loadRarityBgEditor(){updateRarityPreviewShape();const {tier,context}=rarityBgSelection();const c=context==='all'?'player':context;const s=await rarityBgGet(rarityBgKey(tier,c));$('rarityBgFile').value='';if(!s){$('rarityBgUrl').value='';applyRarityPreview('');setRarityBgStatus('Nenhum fundo salvo para esta combinação.');return}$('rarityBgUrl').value=s.url||'';$('rarityBgScaleX').value=s.scaleX||100;$('rarityBgScaleY').value=s.scaleY||100;$('rarityBgPosX').value=s.posX??50;$('rarityBgPosY').value=s.posY??50;$('rarityBgOpacity').value=Math.round((s.opacity??.85)*100);applyRarityPreview(cacheBustRemoteUrl(s.url||s.dataUrl||'',s.version));setRarityBgStatus('Fundo salvo para esta combinação.','ok')}
async function renderRarityBgSaved(){const box=$('rarityBgSaved');if(!box)return;const names={none:'Sem conquista/raridade',bronze:'Bronze',silver:'Prata',gold:'Ouro',prismatic:'Prismática',collector:'Colecionador',goat:'GOAT',cosmic:'Cosmic'};const contexts={player:'Elenco',ranking:'Ranking',record:'Recordes',month:'Mês',profile:'Perfil completo','profile-main':'Card principal'};let html='';for(const t of RARITY_BG_TIERS)for(const c of ['player','ranking','record','month','profile','profile-main']){const has=rarityBgCache.has(rarityBgKey(t,c));html+=`<button type="button" class="${has?'has-bg':''}" data-bg-open="${t}|${c}"><span>${names[t]}</span><small>${contexts[c]} ${has?'✓':''}</small></button>`}box.innerHTML=html;box.querySelectorAll('[data-bg-open]').forEach(b=>b.onclick=()=>{const[t,c]=b.dataset.bgOpen.split('|');$('rarityBgTier').value=t;$('rarityBgContext').value=c;loadRarityBgEditor()})}
['rarityBgTier','rarityBgContext'].forEach(id=>$(id)?.addEventListener('change',loadRarityBgEditor));['rarityBgScaleX','rarityBgScaleY','rarityBgPosX','rarityBgPosY','rarityBgOpacity'].forEach(id=>$(id)?.addEventListener('input',previewRarityBg));$('rarityBgFile')?.addEventListener('change',previewRarityBg);$('rarityBgUrl')?.addEventListener('input',previewRarityBg);
$('btnSaveRarityBg')?.addEventListener('click',async()=>{
  if(!requireAdmin())return;
  try{
    const {tier,context}=rarityBgSelection(),f=$('rarityBgFile').files?.[0],u=$('rarityBgUrl').value.trim();
    if(!f&&!u){showToast('Escolha uma imagem.');return}
    setRarityBgStatus('Enviando fundo para a nuvem...');
    let url=u,storagePath='',storageProvider='',version=Date.now();
    if(f){
      const uploaded=await uploadRarityBackgroundToSupabase(f,tier,context);
      url=uploaded.url;
      storagePath=uploaded.storagePath;
      storageProvider=uploaded.storageProvider;
      version=uploaded.version;
    }else if(/^https?:\/\//i.test(url)){
      storageProvider=url.includes('.supabase.co/storage/')?'supabase':'external';
    }
    const setting={url,storagePath,storageProvider,version,scaleX:Number($('rarityBgScaleX').value),scaleY:Number($('rarityBgScaleY').value),posX:Number($('rarityBgPosX').value),posY:Number($('rarityBgPosY').value),opacity:Number($('rarityBgOpacity').value)/100};
    const contexts=context==='all'?RARITY_BG_CONTEXTS:[context];
    for(const c of contexts)await rarityBgPut(rarityBgKey(tier,c),setting);
    applyAllRarityBackgroundsSync();await renderRarityBgSaved();applyRarityPreview(cacheBustRemoteUrl(url,version));
    setRarityBgStatus('Fundo salvo na nuvem e aplicado em todos os dispositivos.','ok');
    showToast(tier==='none'?'Fundo de “Sem conquista/raridade” salvo na nuvem.':'Fundo personalizado salvo na nuvem.');
  }catch(e){setRarityBgStatus('Erro ao salvar: '+e.message,'error')}
});
$('btnLoadRarityBg')?.addEventListener('click',loadRarityBgEditor);$('btnRemoveRarityBg')?.addEventListener('click',async()=>{if(!requireAdmin())return;const {tier,context}=rarityBgSelection();const contexts=context==='all'?RARITY_BG_CONTEXTS:[context];for(const c of contexts)await rarityBgDelete(rarityBgKey(tier,c));applyAllRarityBackgroundsSync();await loadRarityBgEditor();await renderRarityBgSaved();showToast('Fundo removido.')});
(()=>{let dragging=false,lastX=0,lastY=0;const p=$('rarityBgPreview');if(!p)return;p.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;p.setPointerCapture(e.pointerId)});p.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;$('rarityBgPosX').value=Math.max(-50,Math.min(150,Number($('rarityBgPosX').value)+dx/p.clientWidth*100));$('rarityBgPosY').value=Math.max(-50,Math.min(150,Number($('rarityBgPosY').value)+dy/p.clientHeight*100));previewRarityBg()});p.addEventListener('pointerup',()=>dragging=false);p.addEventListener('pointercancel',()=>dragging=false)})();
async function recoverLegacyRarityBackgroundsIfNeeded(){
  if(Object.keys(loadedRarityBackgrounds||{}).length || !rarityBgCache.size) return false;
  if(!auth.currentUser) return false;
  const hasRemoteUrls=[...rarityBgCache.values()].some(v=>/^https?:\/\//i.test(String(v?.url||'')));
  if(!hasRemoteUrls) return false;
  try{
    await persistRarityBgRemote();
    console.info('Metadados dos fundos recuperados do cache local e republicados no Firestore.');
    return true;
  }catch(error){
    console.warn('Não foi possível recuperar os metadados locais dos fundos:',error);
    return false;
  }
}
async function initializeRarityBackgrounds(){
  await preloadRarityBgCache();
  await recoverLegacyRarityBackgroundsIfNeeded();
  if(!Object.keys(loadedRarityBackgrounds||{}).length && rarityBgCache.size){
    setTimeout(()=>recoverLegacyRarityBackgroundsIfNeeded(),1800);
  }
  applyAllRarityBackgroundsSync();
  await loadRarityBgEditor();
  await renderRarityBgSaved();
  setTimeout(applyAllRarityBackgroundsSync,250);
  setTimeout(applyAllRarityBackgroundsSync,1000);
}
setTimeout(initializeRarityBackgrounds,50);


initializeMultiRacha();
