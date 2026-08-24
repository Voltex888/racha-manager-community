onAuthStateChanged(auth, (user)=>{
  isAdmin = !!user && ['owner','organizer','assistant'].includes(activeRachaRole);
  organizerEmail = user ? user.email : '';
  updateAuthUI();
  renderAll();
});
function updateAuthUI(){
  document.querySelectorAll('.admin-only').forEach(el=> el.classList.toggle('is-hidden', !isAdmin));
  $('roundLoginNotice').style.display = isAdmin ? 'none' : '';
  $('roundCreateWrap').style.display = isAdmin ? '' : 'none';
  $('btnOpenLogin').style.display = auth.currentUser ? 'none' : '';
  $('btnChangePassword').style.display = auth.currentUser ? '' : 'none';
  $('btnLogout').style.display = auth.currentUser ? '' : 'none';
  $('authLabel').innerHTML = isAdmin
    ? `<b>${activeRachaName}</b> · ${roleLabel(activeRachaRole)} — ${organizerEmail}`
    : (auth.currentUser ? `<b>${activeRachaName}</b> · jogador — ${organizerEmail}` : 'Entre para acessar seus rachas.');
}
function requireAdmin(){
  if(isAdmin) return true;
  showToast('Entre como organizador para alterar esta parte.');
  return false;
}
$('btnOpenLogin').addEventListener('click', ()=>{
  $('loginEmail').value = ''; $('loginPassword').value = '';
  $('loginError').style.display = 'none';
  $('loginOverlay').classList.add('active');
});
$('btnLoginCancel').addEventListener('click', ()=> $('loginOverlay').classList.remove('active'));
$('btnForgotOfficialPassword').addEventListener('click', ()=>{
  $('loginOverlay').classList.remove('active');
  $('resetOfficialEmail').value=$('loginEmail').value.trim();
  $('resetPasswordError').style.display='none';
  $('resetPasswordOverlay').classList.add('active');
});
$('btnResetPasswordCancel').addEventListener('click', ()=> $('resetPasswordOverlay').classList.remove('active'));
$('btnResetPasswordSubmit').addEventListener('click', async ()=>{
  const email=$('resetOfficialEmail').value.trim(),button=$('btnResetPasswordSubmit');
  $('resetPasswordError').style.display='none';
  if(!email){$('resetPasswordError').textContent='Digite seu e-mail.';$('resetPasswordError').style.display='block';return}
  try{
    button.disabled=true;button.textContent='Enviando...';
    await sendPasswordResetEmail(auth,email);
    $('resetPasswordOverlay').classList.remove('active');
    showToast('Link enviado. Confira também a caixa de spam.');
  }catch(e){
    const map={'auth/invalid-email':'Digite um e-mail válido.','auth/too-many-requests':'Muitas solicitações. Aguarde um pouco e tente novamente.','auth/network-request-failed':'Falha de conexão. Confira sua internet.'};
    $('resetPasswordError').textContent=map[e.code]||'Não foi possível enviar o link de recuperação.';
    $('resetPasswordError').style.display='block';
  }finally{button.disabled=false;button.textContent='Enviar link'}
});
$('btnChangePassword').addEventListener('click', ()=>{
  $('currentOfficialPassword').value='';$('newOfficialPassword').value='';$('confirmOfficialPassword').value='';
  $('changePasswordError').style.display='none';
  $('changePasswordOverlay').classList.add('active');
});
$('btnChangePasswordCancel').addEventListener('click', ()=> $('changePasswordOverlay').classList.remove('active'));
$('btnChangePasswordSubmit').addEventListener('click', async ()=>{
  const current=$('currentOfficialPassword').value,next=$('newOfficialPassword').value,confirmation=$('confirmOfficialPassword').value,button=$('btnChangePasswordSubmit'),user=auth.currentUser;
  $('changePasswordError').style.display='none';
  const fail=message=>{$('changePasswordError').textContent=message;$('changePasswordError').style.display='block'};
  if(!user)return fail('Entre novamente como organizador.');
  if(!current)return fail('Digite a senha atual.');
  if(next.length<6)return fail('A nova senha precisa ter pelo menos 6 caracteres.');
  if(next!==confirmation)return fail('As novas senhas não são iguais.');
  if(current===next)return fail('Escolha uma senha diferente da atual.');
  try{
    button.disabled=true;button.textContent='Salvando...';
    const credential=makeEmailCredential(user.email,current);
    await reauthenticateWithCredential(user,credential);
    await updatePassword(user,next);
    $('changePasswordOverlay').classList.remove('active');
    showToast('Senha alterada com sucesso.');
  }catch(e){
    const map={'auth/invalid-credential':'A senha atual está incorreta.','auth/wrong-password':'A senha atual está incorreta.','auth/weak-password':'A nova senha é muito fraca.','auth/requires-recent-login':'Confirme novamente sua senha atual.','auth/too-many-requests':'Muitas tentativas. Aguarde um pouco.','auth/network-request-failed':'Falha de conexão. Confira sua internet.'};
    fail(map[e.code]||`Não foi possível trocar a senha (${e.code||'erro desconhecido'}).`);
  }finally{button.disabled=false;button.textContent='Salvar nova senha'}
});
$('btnLoginSubmit').addEventListener('click', async ()=>{
  const email = $('loginEmail').value.trim();
  const pass = $('loginPassword').value.trim();
  try{
    await signInWithEmailAndPassword(auth, email, pass);
    $('loginOverlay').classList.remove('active');
    showToast('Conectado como organizador!');
  }catch(e){
    console.error('Erro de login:', e.code, e.message);
    const map = {
      'auth/invalid-email': 'E-mail inválido (confira se digitou certo).',
      'auth/user-not-found': 'Não existe organizador cadastrado com esse e-mail.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/too-many-requests': 'Muitas tentativas erradas seguidas. Espere um pouco e tente de novo.',
      'auth/network-request-failed': 'Falha de conexão com o Firebase. Confira sua internet.',
      'auth/operation-not-allowed': 'O login por e-mail/senha não está ativado nesse projeto Firebase.',
      'auth/configuration-not-found': 'O login por e-mail/senha não está ativado nesse projeto Firebase.',
      'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'A apiKey no firebaseConfig do código está errada.',
    };
    $('loginError').textContent = map[e.code] || `Erro (${e.code || 'desconhecido'}): ${e.message}`;
    $('loginError').style.display = 'block';
  }
});
$('btnLogout').addEventListener('click', async ()=>{
  await signOut(auth);
  showToast('Você saiu do modo organizador.');
});


function seedRound1FromScreenshots(){
  if(!players.length) return false;
  const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
  const realLincolin=players.find(player=>[player.nickname,player.name].some(value=>key(value)==='lincolin'));
  if(realLincolin){
    const duplicateIds=players.filter(player=>player.id!==realLincolin.id&&[player.nickname,player.name].some(value=>key(value)==='lincoln')).map(player=>player.id);
    const replaceIds=list=>(list||[]).map(id=>duplicateIds.includes(id)?realLincolin.id:id);
    const migratePlan=plan=>(plan?.slots||[]).forEach(slot=>{
      slot.attendance=[...new Set(replaceIds(slot.attendance))];slot.captains=[...new Set(replaceIds(slot.captains))];
      slot.listedPlayers=[...new Set(replaceIds(slot.listedPlayers))];slot.justifiedAbsences=[...new Set(replaceIds(slot.justifiedAbsences))];
      slot.reserves=[...new Set(replaceIds(slot.reserves))];slot.teams=(slot.teams||[]).map(team=>[...new Set(replaceIds(team))]);
      slot.substitutePools=(slot.substitutePools||[]).map(pool=>(pool||[]).map(item=>typeof item==='string'?(duplicateIds.includes(item)?realLincolin.id:item):({...item,id:duplicateIds.includes(item?.id)?realLincolin.id:item?.id})));
    });
    const migrateKeyedStats=object=>duplicateIds.forEach(id=>{if(!object?.[id])return;if(!object[realLincolin.id])object[realLincolin.id]=object[id];delete object[id]});
    rounds.forEach(round=>{migrateKeyedStats(round.entries);migrateKeyedStats(round.absences);migrateKeyedStats(round.simulatorStats?.players);migrateKeyedStats(round.simulatorStats?.goalkeepers);(round.simulatorStats?.teams||[]).forEach(team=>migrateKeyedStats(team.playerStats));migratePlan(round.teamPlan)});
    (publishedTeamPlans||[]).forEach(item=>migratePlan(item.teamPlan));migratePlan(teamPlanner);
    players=players.filter(player=>!duplicateIds.includes(player.id));
  }
  const aliases={
    adicelino:['adicelino'], caio:['caio'], emerson:['emerson'], erick:['erick'], guilherme:['guilherme'],
    henrique:['henrique'], jonasb:['jonasb','jonas b','jonasb.'], jose:['jose','josé'], lincoln:['lincoln','lincolin'],
    mkevyn:['mkevyn','m kevyn','m.kevyn','m. kevyn'], neguim:['neguim'], pedrim:['pedrim'], pele:['pele','pelé'],
    ruan:['ruan'], samuel:['samuel'], thiago:['thiago'], gabigol:['gabigol']
  };
  const byAlias={};
  players.forEach(p=>{
    const candidates=[p.nickname,p.name].filter(Boolean).map(key);
    Object.entries(aliases).forEach(([alias,vals])=>{
      if(vals.map(key).some(v=>candidates.includes(v))) byAlias[alias]=p.id;
    });
  });
  const required=['adicelino','caio','emerson','erick','guilherme','henrique','jonasb','jose','lincoln','mkevyn','neguim','pedrim','pele','ruan','samuel','thiago'];
  const displayNames={adicelino:'Adicelino',caio:'Caio',emerson:'Emerson',erick:'Erick',guilherme:'Guilherme',henrique:'Henrique',jonasb:'Jonas B.',jose:'José',lincoln:'Lincoln',mkevyn:'M. Kevyn',neguim:'Neguim',pedrim:'Pedrim',pele:'Pelé',ruan:'Ruan',samuel:'Samuel',thiago:'Thiago'};
  const missing=required.filter(a=>!byAlias[a]);
  missing.forEach(alias=>{
    const nickname=displayNames[alias]||alias;
    const p={id:uid(),name:nickname,nickname,photo:'',role:'normal',isCaptain:false,chute:50,passe:50,contato:50,drible:50,marcacao:50,velocidade:50};
    players.push(normalizePlayer(p));
    byAlias[alias]=p.id;
  });

  const stats={
    adicelino:[2,1,'7'], caio:[6,2,'10'], emerson:[3,0,'7'], erick:[5,0,'8.5'], guilherme:[1,5,'9'],
    henrique:[6,2,'10'], jonasb:[0,3,'7'], jose:[2,3,'8'], lincoln:[4,3,'9.5'], mkevyn:[4,5,'10'],
    neguim:[3,0,'7'], pedrim:[1,4,'8.5'], pele:[2,1,'7'], ruan:[0,0,'5'], samuel:[2,3,'8'], thiago:[1,3,'7.5']
  };
  const entries={};
  Object.entries(stats).forEach(([alias,[goals,assists,rating]])=>{
    entries[byAlias[alias]]={goals:String(goals),assists:String(assists),rating:String(rating)};
  });
  const attendance=required.map(a=>byAlias[a]);
  const team=(...names)=>names.map(a=>byAlias[a]).filter(Boolean);

  const slot1={
    id:'round1-slot-1', label:'08:00 às 09:30', attendance:[...attendance], listedPlayers:[...attendance], justifiedAbsences:[], reserves:[],
    captains:team('lincoln','pedrim'),
    teams:[
      team('lincoln','jose','pedrim','samuel'),
      team('caio','ruan','mkevyn','neguim'),
      team('erick','pele','guilherme','jonasb'),
      team('henrique','emerson','thiago','adicelino')
    ]
  };
  const slot2={
    id:'round1-slot-2', label:'09:30 às 11:00', attendance:[...attendance], listedPlayers:[...attendance], justifiedAbsences:[], reserves:[],
    captains:team('jonasb','lincoln','pedrim'),
    teams:[
      team('pedrim','samuel','neguim','jonasb'),
      team('pele','mkevyn','lincoln','caio'),
      team('jose','henrique','erick','guilherme'),
      team('thiago','adicelino','ruan','emerson')
    ]
  };
  const teamPlan=normalizeTeamPlanner({teamCount:4,playersPerTeam:4,slots:[slot1,slot2]});

  const existingByLabel=rounds.find(r=>key(r.label)==='rodada1');
  const existingSeeded=rounds.find(r=>r && String(r.seedTag||'').startsWith('screenshots-round1-'));
  let round=existingByLabel || existingSeeded || null;
  const fallbackDate='2026-07-25';
  const seededRound={
    id:round?.id || uid(),
    label:'Rodada 1',
    date:fallbackDate,
    entries,
    teamPlan,
    absences:{},
    seedTag:'screenshots-round1-v5'
  };
  if(round){
    Object.assign(round,seededRound);
  }else{
    rounds.push(seededRound);
    round=seededRound;
  }
  rounds = rounds.filter(r=>r===round || !(key(r?.label)==='rodada1' || String(r?.seedTag||'').startsWith('screenshots-round1-')));
  round.date='2026-07-25';
  round.label='Rodada 1';
  round.entries=entries;
  round.teamPlan=teamPlan;
  round.absences={};
  round.seedTag='screenshots-round1-v5';

  publishedTeamPlans=publishedTeamPlans.filter(plan=>plan.date!==fallbackDate);
  round1PhotoSeedVersion=5;
  return true;
}
function withFirebaseTimeout(promise,ms,label){
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`Tempo limite do Firebase excedido (${label})`)),ms)});
  return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));
}
async function loadAll(){
  try{
    if(!dataDocRef) throw new Error('Selecione um racha antes de carregar os dados.');
    const snap = await withFirebaseTimeout(firestorePersistenceReady.then(()=>getDoc(dataDocRef)),12000,'carregamento');
    if(snap.exists()){
      const d = snap.data();
      loadedRarityBackgrounds = firestoreSafe(d.rarityBackgrounds || {});
      players = (d.players || []).map(normalizePlayer);
      musicLibrary = Array.isArray(d.musicLibrary) ? d.musicLibrary.filter(m=>m && m.id && (m.url || m.source==='file')).map(m=>({id:m.id,title:String(m.title||'Música sem nome').slice(0,120),url:m.url?String(m.url):'',source:m.source==='file'?'file':(m.source==='cloud'?'cloud':'url'),fileName:m.fileName?String(m.fileName):'',storagePath:m.storagePath?String(m.storagePath):'',storageProvider:m.storageProvider?String(m.storageProvider):(String(m.url||'').includes('.supabase.co/storage/')?'supabase':''),version:Number(m.version)||0})) : [];
      musicPlaylists = Array.isArray(d.musicPlaylists) ? d.musicPlaylists.filter(p=>p && p.id).map(p=>({id:p.id,name:String(p.name||'Playlist').slice(0,80),songIds:Array.isArray(p.songIds)?p.songIds.filter(id=>musicLibrary.some(m=>m.id===id)):[]})) : [];
      activeMusicPlaylistId = musicPlaylists.some(p=>p.id===d.activeMusicPlaylistId) ? d.activeMusicPlaylistId : (musicPlaylists[0]?.id || null);
      musicSettings = {...musicSettings,...(d.musicSettings||{})};
      playerAttributePresetVersion = Number(d.playerAttributePresetVersion)||0;
      playerCardHeight = Math.max(320,Math.min(680,Number(d.playerCardHeight)||440));
      const storedBottomReach = Number(d.playerCardBottomShadowReach);
      const legacyBottomStart = Number(d.playerCardBottomShadowStart);
      playerCardBottomShadowReach = Number.isFinite(storedBottomReach)
        ? Math.max(0,Math.min(100,storedBottomReach))
        : Math.max(0,Math.min(100,100-(Number.isFinite(legacyBottomStart) ? legacyBottomStart : 72)));
      playerCardOvrShadowReach = Math.max(45,Math.min(100,Number(d.playerCardOvrShadowReach)||100));
      playerCardOvrShadowWidth = Math.max(45,Math.min(220,Number(d.playerCardOvrShadowWidth)||80));
      monthClosedCardHeight = Math.max(300,Math.min(700,Number(d.monthClosedCardHeight)||340));
      monthClosedCardWidth = Math.max(220,Math.min(900,Number(d.monthClosedCardWidth)||900));
      monthClosedPhotoWidth = Math.max(160,Math.min(440,Number(d.monthClosedPhotoWidth)||300));
      monthClosedContentOffset = Math.max(0,Math.min(220,Number(d.monthClosedContentOffset)||78));
      monthClosedShadow = Math.max(0,Math.min(100,Number(d.monthClosedShadow ?? 86)));
      savedMonthClosedAppearance = {height:monthClosedCardHeight,width:monthClosedCardWidth,photoWidth:monthClosedPhotoWidth,contentOffset:monthClosedContentOffset,shadow:monthClosedShadow};
      savedCardPhotoPreset = d.cardPhotoPreset || null;
      savedMonthPhotoPreset = d.monthPhotoPreset || null;
      savedBonusRulesPreset = d.bonusRulesPreset || null;
      bonusRules = {...DEFAULT_BONUS_RULES,...(d.bonusRules||{})};
      applyPlayerAttributePresets();
      teamPlanner = normalizeTeamPlanner(d.teamPlanner);
      publishedTeamPlans = normalizePublishedTeamPlans(d.publishedTeamPlans);
      rounds = d.rounds || [];
      round1PhotoSeedVersion = Number(d.round1PhotoSeedVersion)||0;
      periodStart = d.periodStart || null;
      monthStartDay = d.monthStartDay || 1;
      manualTrophyAdjustments = d.manualTrophyAdjustments || {};
      if(d.months){
        months = d.months;
      } else if(d.trophyAwards){
        const groups = {};
        (d.trophyAwards||[]).forEach(a=>{
          const key = a.periodStart+'|'+a.periodEnd;
          if(!groups[key]) groups[key] = { startDate:a.periodStart, endDate:a.periodEnd };
        });
        months = Object.values(groups)
          .sort((a,b)=> a.startDate.localeCompare(b.startDate))
          .map(g=> ({ id: uid(), label: monthLabel(computePeriodMonthKey(g.startDate,g.endDate)), startDate:g.startDate, endDate:g.endDate, closedAt:g.endDate }));
      } else if(d.trophies){
        manualTrophyAdjustments = {};
        Object.entries(d.trophies).forEach(([pid,t])=>{
          manualTrophyAdjustments[pid] = { mvp:t.mvp||0, artilheiro:t.artilheiro||0, garcom:t.garcom||0 };
        });
        months = [];
      }
      applyDomainData(d.domainsV25||{});
    }
    await restoreMissingPlayerPhotos();
  }catch(e){
    console.error(e);
    showToast('Não consegui carregar os dados da nuvem. O site foi iniciado para você tentar novamente.');
  }
  savedPlayerCardAppearance = {height:playerCardHeight,bottomShadowReach:playerCardBottomShadowReach,ovrShadowReach:playerCardOvrShadowReach,ovrShadowWidth:playerCardOvrShadowWidth};
  applyMusicSettings();
  if(!periodStart) periodStart = new Date().toISOString();
  initializeDomainSnapshots();
  markLoaded();
  $('headerSub').textContent = players.length ? `${players.length} jogador(es) cadastrado(s)` : 'Comece cadastrando o elenco do racha';
  renderAll();
  appDataLoaded=true;
  setTimeout(startMusicOnSiteEntry,0);
}

function dataUrlToBlob(dataUrl){
  const parts=String(dataUrl||'').split(',');
  if(parts.length<2) throw new Error('Imagem inválida.');
  const mime=(parts[0].match(/data:([^;]+)/)||[])[1] || 'image/jpeg';
  const bytes=atob(parts[1]);
  const arr=new Uint8Array(bytes.length);
  for(let i=0;i<bytes.length;i++) arr[i]=bytes.charCodeAt(i);
  return new Blob([arr],{type:mime});
}

function cacheBustRemoteUrl(url,version){
  const src=String(url||'');
  if(!/^https?:\/\//i.test(src)) return src;
  const v=Number(version)||0;
  if(!v) return src;
  try{
    const u=new URL(src);
    u.searchParams.set('rmv',String(v));
    return u.toString();
  }catch(_){
    return src+(src.includes('?')?'&':'?')+'rmv='+encodeURIComponent(String(v));
  }
}

async function uploadPlayerPhotoToCloud(player,dataUrl){
  if(!player?.id) throw new Error('Jogador inválido para upload de foto.');
  const previousPath=normalizeSupabaseMediaPath(player.photoStoragePath || player.photo || '');
  if(typeof dataUrl!=='string' || !dataUrl.startsWith('data:image/')) throw new Error('A nova foto não está em um formato válido.');

  const blob=dataUrlToBlob(dataUrl);
  const mime=String(blob.type||'image/jpeg').toLowerCase();
  const ext=mime.includes('png')?'png':mime.includes('webp')?'webp':'jpg';
  const version=Date.now();
  const safePlayerId=String(player.id).replace(/[^a-zA-Z0-9_-]/g,'_');
  const path=`rachas/${activeRachaId}/players/${safePlayerId}/${version}.${ext}`;
  const encodedPath=path.split('/').map(encodeURIComponent).join('/');
  const uploadUrl=`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(SUPABASE_MEDIA_BUCKET)}/${encodedPath}`;

  let response;
  try{
    response=await withFirebaseTimeout(fetch(uploadUrl,{
      method:'POST',
      headers:{
        apikey:SUPABASE_PUBLISHABLE_KEY,
        'Content-Type':mime,
        'x-upsert':'false',
        'cache-control':'3600'
      },
      body:blob
    }),45000,'envio da foto ao Supabase');
  }catch(error){
    throw new Error(`Falha de rede ao enviar a foto para o Supabase: ${error?.message||error}`);
  }

  let bodyText='';
  try{bodyText=await response.text()}catch(_){}
  if(!response.ok){
    let detail=bodyText;
    try{const parsed=JSON.parse(bodyText);detail=parsed.message||parsed.error||parsed.code||bodyText}catch(_){}
    throw new Error(`Supabase Storage recusou a foto (${response.status}${detail?`: ${detail}`:''}).`);
  }

  const publicUrl=`${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(SUPABASE_MEDIA_BUCKET)}/${encodedPath}`;
  if(!/^https?:\/\//i.test(publicUrl)) throw new Error('O Supabase não gerou uma URL pública válida para a foto.');

  player.photoVersion=version;
  player.photoStoragePath=path;
  player.photoStorageProvider='supabase';
  player.photo=cacheBustRemoteUrl(publicUrl,version);
  if(previousPath && previousPath!==path) player._photoCleanupPath=previousPath;
  delete player.photoLocalFallback;
  await removeLocalPlayerPhoto(player.id).catch(()=>{});
  return player.photo;
}

async function ensurePlayerPhotosInCloud(){
  const pending=players.filter(p=>typeof p?.photo==='string' && p.photo.startsWith('data:image/'));
  for(const p of pending) await uploadPlayerPhotoToCloud(p,p.photo);
}
function openPlayerPhotosDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open('racha-manager-player-photos',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('photos'))request.result.createObjectStore('photos')};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function saveLocalPlayerPhoto(playerId,dataUrl){const db=await openPlayerPhotosDb();await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put(dataUrl,playerId);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}
async function getLocalPlayerPhoto(playerId){const db=await openPlayerPhotosDb();const value=await new Promise((resolve,reject)=>{const request=db.transaction('photos','readonly').objectStore('photos').get(playerId);request.onsuccess=()=>resolve(request.result||'');request.onerror=()=>reject(request.error)});db.close();return value}
async function removeLocalPlayerPhoto(playerId){const db=await openPlayerPhotosDb();await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').delete(playerId);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}
async function restoreMissingPlayerPhotos(){
  const localFallbacks={henrique:'Henrique.png',mkevyn:'M. Kevyn.png',pele:'Pelé.png',jonasb:'Jonas B.png'};
  const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  for(const player of players){
    if(player.photoStoragePath && (player.photoStorageProvider==='supabase' || String(player.photoStoragePath).includes('/players/') || String(player.photoStoragePath).startsWith('players/'))){
      const encodedPath=String(player.photoStoragePath).split('/').map(encodeURIComponent).join('/');
      const remote=`${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(SUPABASE_MEDIA_BUCKET)}/${encodedPath}`;
      player.photo=cacheBustRemoteUrl(remote,player.photoVersion);
      player.photoStorageProvider='supabase';
      delete player.photoLocalFallback;
      continue;
    }

    if(/^https?:\/\//i.test(String(player.photo||''))){
      player.photo=cacheBustRemoteUrl(player.photo,player.photoVersion);
      delete player.photoLocalFallback;
      continue;
    }

    if(player.photoStoragePath){
      try{
        const remote=await withFirebaseTimeout(getDownloadURL(storageRef(storage,player.photoStoragePath)),8000,'recuperação da foto legada');
        player.photo=cacheBustRemoteUrl(remote,player.photoVersion);
        delete player.photoLocalFallback;
        continue;
      }catch(error){console.warn(`Foto legada de ${player.nickname||player.name} não recuperada:`,error)}
    }

    if(typeof player.photo==='string' && player.photo.startsWith('data:image/')){
      player.photoLocalFallback=true;
      try{await saveLocalPlayerPhoto(player.id,player.photo)}catch(error){console.warn('Foto local não pôde ser armazenada:',error)}
      continue;
    }
    try{const localPhoto=await getLocalPlayerPhoto(player.id);if(localPhoto){player.photo=localPhoto;player.photoLocalFallback=true;continue}}catch(error){console.warn('Foto local não pôde ser lida:',error)}
    const local=localFallbacks[key(player.nickname)||key(player.name)];
    if(local){player.photo=local;player.photoLocalFallback=true}
  }
}

function firestoreSafe(value){
  if(Array.isArray(value)) return value.filter(item=>item!==undefined).map(firestoreSafe);
  if(value && typeof value==='object'){
    const out={};
    Object.entries(value).forEach(([k,v])=>{ if(v!==undefined) out[k]=firestoreSafe(v); });
    return out;
  }
  return value;
}
function firebaseSafeRound(round){
  const safe=firestoreSafe({...round});
  if(round?.teamPlan)safe.teamPlan=firebaseSafeTeamPlanner(round.teamPlan);
  return safe;
}
function normalizeRoundFromFirebase(round){
  return round?.teamPlan?{...round,teamPlan:normalizeTeamPlanner(round.teamPlan)}:round;
}

const domainQueues=new Map();
const domainSnapshots={players:{},playerOrder:[],rounds:{},roundOrder:[]};
const domainReady={players:false,rounds:false};
const DOMAIN_SAVE_DEBOUNCE_MS=180;
const DOMAIN_SAVE_TIMEOUT_MS=12000;
let domainSaveError=false;
const stableJson=value=>JSON.stringify(value===undefined?null:value);
const objectById=list=>Object.fromEntries((list||[]).filter(x=>x&&x.id).map(x=>[x.id,x]));
function firebaseSafePlayer(player){
  const copy=firestoreSafe({...player});
  delete copy._photoCleanupPath;
  if(typeof copy.photo==='string'&&copy.photo.startsWith('data:')) delete copy.photo;
  if(copy.photoLocalFallback){delete copy.photo;delete copy.photoLocalFallback}
  return copy;
}
function initializeDomainSnapshots(){
  domainSnapshots.players=Object.fromEntries(players.map(p=>[p.id,firebaseSafePlayer(p)]));
  domainSnapshots.playerOrder=players.map(p=>p.id);
  domainSnapshots.rounds=Object.fromEntries(rounds.map(round=>[round.id,firebaseSafeRound(round)]));
  domainSnapshots.roundOrder=rounds.map(r=>r.id);
}
function pendingDomainSaves(){
  let count=0;domainQueues.forEach(q=>{if(q.timer||q.running||Object.keys(q.patch).length)count++});return count;
}
function queueDomainPatch(domain,patch,delay=DOMAIN_SAVE_DEBOUNCE_MS){
  if(!auth.currentUser){markSaveError('Entre como organizador para salvar.');return Promise.resolve(false)}
  let q=domainQueues.get(domain);
  if(!q){q={patch:{},timer:null,running:false,waiters:[]};domainQueues.set(domain,q)}
  Object.assign(q.patch,patch);
  if(q.timer)clearTimeout(q.timer);
  q.timer=setTimeout(()=>flushDomain(domain),delay);
  markSaving();
  return new Promise(resolve=>q.waiters.push(resolve));
}
function domainPatchAsNestedObject(patch){
  const nested={};
  Object.entries(patch||{}).forEach(([path,value])=>{
    const parts=String(path).split('.').filter(Boolean);
    if(!parts.length)return;
    let target=nested;
    parts.forEach((part,index)=>{
      if(index===parts.length-1)target[part]=value;
      else{
        if(!target[part]||typeof target[part]!=='object'||Array.isArray(target[part]))target[part]={};
        target=target[part];
      }
    });
  });
  return nested;
}
function buildCompactCloudDocument(){
  const safePlayers=players.map(firebaseSafePlayer);
  const safeRounds=rounds.map(firebaseSafeRound);
  return firestoreSafe({
    schemaVersion:30,
    compactedAt:new Date().toISOString(),
    rarityBackgrounds:(typeof rarityBgSerializableMap==='function' ? rarityBgSerializableMap() : loadedRarityBackgrounds),
    domainsV25:{
      players:{dataJson:JSON.stringify(safePlayers)},
      rounds:{dataJson:JSON.stringify(safeRounds),round1PhotoSeedVersion},
      month:{dataJson:JSON.stringify({periodStart,months:firestoreSafe(months),manualTrophyAdjustments:firestoreSafe(manualTrophyAdjustments),monthStartDay})},
      planner:{teamPlannerJson:JSON.stringify(firebaseSafeTeamPlanner(teamPlanner)),publishedTeamPlansJson:JSON.stringify(firebaseSafePublishedTeamPlans(publishedTeamPlans))},
      bonus:{bonusRules:firestoreSafe(bonusRules),bonusRulesPreset:firestoreSafe(savedBonusRulesPreset)},
      personalization:{playerAttributePresetVersion,playerCardHeight,playerCardBottomShadowReach,playerCardOvrShadowReach,playerCardOvrShadowWidth,monthClosedCardHeight,monthClosedCardWidth,monthClosedPhotoWidth,monthClosedContentOffset,monthClosedShadow,cardPhotoPreset:firestoreSafe(savedCardPhotoPreset),monthPhotoPreset:firestoreSafe(savedMonthPhotoPreset)},
      music:{dataJson:JSON.stringify({musicLibrary:firestoreSafe(musicLibrary),musicPlaylists:firestoreSafe(musicPlaylists),activeMusicPlaylistId,musicSettings:firestoreSafe(musicSettings)})}
    }
  });
}
let compactWriteChain=Promise.resolve();
function writeCompactCloudDocument(label){
  const run=async()=>{
    await ensurePlayerPhotosInCloud();
    const compactDocument=buildCompactCloudDocument();
    const compactBytes=new Blob([JSON.stringify(compactDocument)]).size;
    if(compactBytes>950000)throw Object.assign(new Error(`Dados compactados excedem o limite seguro (${compactBytes} bytes).`),{code:'document-too-large'});
    return withFirebaseTimeout(setDoc(dataDocRef,compactDocument),DOMAIN_SAVE_TIMEOUT_MS,label);
  };
  compactWriteChain=compactWriteChain.catch(()=>{}).then(run);
  return compactWriteChain;
}
async function flushDomain(domain){
  const q=domainQueues.get(domain);if(!q)return;
  q.timer=null;if(q.running)return;
  const patch=q.patch;q.patch={};const batchWaiters=q.waiters;q.waiters=[];
  if(!Object.keys(patch).length){batchWaiters.forEach(resolve=>resolve(true));if(!pendingDomainSaves())markSaved();return}
  q.running=true;
  try{
    await writeCompactCloudDocument(`salvamento de ${domain}`);
    domainSaveError=false;
    batchWaiters.forEach(resolve=>resolve(true));
  }catch(e){
    let finalError=e;
    if(domain==='planner'){
      try{
        await writeCompactCloudDocument('recuperação da escala');
        domainSaveError=false;q.patch={};
        const recoveredWaiters=[...batchWaiters,...q.waiters.splice(0)];recoveredWaiters.forEach(resolve=>resolve(true));
        return;
      }catch(recoveryError){finalError=recoveryError}
    }
    console.error(`Falha ao salvar ${domain}:`,finalError);
    q.patch={...patch,...q.patch};batchWaiters.forEach(resolve=>resolve(false));domainSaveError=true;
    const errorCode=String(finalError?.code||'').replace(/^firestore\//,'');
    markSaveError(`Não foi possível salvar agora${errorCode?` (${errorCode})`:''}. Tentando novamente.`);
  }finally{
    q.running=false;
    if(Object.keys(q.patch).length&&!q.timer)q.timer=setTimeout(()=>flushDomain(domain),domainSaveError?1800:0);
    if(!pendingDomainSaves()&&!domainSaveError)markSaved();
  }
}
function diffEntityDomain(currentList,snapshotKey,orderKey,domain,sanitize=x=>firestoreSafe(x)){
  const current=Object.fromEntries((currentList||[]).map(item=>[item.id,sanitize(item)]));
  const previous=domainSnapshots[snapshotKey]||{},patch={};
  Object.entries(current).forEach(([id,item])=>{if(!domainReady[domain]||stableJson(item)!==stableJson(previous[id]))patch[`items.${id}`]=item});
  Object.keys(previous).forEach(id=>{if(!current[id])patch[`items.${id}`]=deleteField()});
  const order=currentList.map(item=>item.id);
  if(!domainReady[domain]||stableJson(order)!==stableJson(domainSnapshots[orderKey]))patch.order=order;
  domainSnapshots[snapshotKey]=JSON.parse(JSON.stringify(current));domainSnapshots[orderKey]=[...order];
  if(Object.keys(patch).length){domainReady[domain]=true;return queueDomainPatch(domain,patch)}
  return Promise.resolve(true);
}
async function savePlayers(){
  if(!auth.currentUser){markSaveError('Entre como organizador para salvar.');return false}
  lastPlayerPhotoSavedLocally=false;
  const pendingPhotoPlayerId=(hasPendingPlayerPhotoUpload&&pendingPlayerPhotoPlayerId)?pendingPlayerPhotoPlayerId:null;
  if(pendingPhotoPlayerId){
    const player=players.find(p=>p.id===pendingPhotoPlayerId);
    try{
      if(!player) throw new Error('Jogador da nova foto não foi encontrado.');
      if(typeof player.photo==='string'&&player.photo.startsWith('data:image/')){
        await uploadPlayerPhotoToCloud(player,player.photo);
      }else if(!/^https?:\/\//i.test(String(player.photo||''))){
        throw new Error('A nova foto não está disponível para envio ao Supabase Storage.');
      }
    }catch(e){
      console.error('A foto nova não foi sincronizada com o Supabase Storage:',e);
      try{if(player?.photo&&String(player.photo).startsWith('data:image/'))await saveLocalPlayerPhoto(player.id,player.photo)}catch(localError){console.warn('Nem o preview local pôde ser preservado:',localError)}
      const detail=String(e?.message||e||'Erro desconhecido');
      markSaveError('A foto não foi salva no Supabase. Tente novamente.');
      showToast(`A foto não foi salva no Supabase: ${detail}`);
      return false;
    }
  }

  const safePlayers=players.map(firebaseSafePlayer);
  const saved=await queueDomainPatch('players',{dataJson:JSON.stringify(safePlayers)});
  if(saved){
    domainSnapshots.players=Object.fromEntries(safePlayers.map(p=>[p.id,p]));
    domainSnapshots.playerOrder=safePlayers.map(p=>p.id);
    domainReady.players=true;
    const cleanupJobs=players.filter(p=>p._photoCleanupPath).map(async p=>{
      const oldPath=p._photoCleanupPath; delete p._photoCleanupPath;
      await deleteSupabaseMediaObjectBestEffort(oldPath,`foto antiga de ${p.nickname||p.name||p.id}`);
    });
    if(cleanupJobs.length) Promise.all(cleanupJobs).catch(()=>{});
    if(pendingPhotoPlayerId){
      hasPendingPlayerPhotoUpload=false;
      pendingPlayerPhotoPlayerId=null;
    }
  }
  return saved;
}

async function saveRounds(){
  const safeRounds=rounds.map(firebaseSafeRound);
  const roundData=queueDomainPatch('rounds',{dataJson:JSON.stringify(safeRounds),round1PhotoSeedVersion});
  const result=(await Promise.all([roundData,savePlanner()])).every(Boolean);
  if(result){round2NeedsCloudRecovery=false;domainReady.rounds=true;domainSnapshots.rounds=Object.fromEntries(safeRounds.map(r=>[r.id,r]));domainSnapshots.roundOrder=safeRounds.map(r=>r.id)}
  return result;
}
function savePlanner(){return queueDomainPatch('planner',{teamPlannerJson:JSON.stringify(firebaseSafeTeamPlanner(teamPlanner)),publishedTeamPlansJson:JSON.stringify(firebaseSafePublishedTeamPlans(publishedTeamPlans))},450)}
function saveMonth(){return queueDomainPatch('month',{dataJson:JSON.stringify({periodStart,months:firestoreSafe(months),manualTrophyAdjustments:firestoreSafe(manualTrophyAdjustments),monthStartDay})})}
function saveBonus(){return queueDomainPatch('bonus',{bonusRules:firestoreSafe(bonusRules),bonusRulesPreset:firestoreSafe(savedBonusRulesPreset)})}
function savePersonalization(){return queueDomainPatch('personalization',{playerAttributePresetVersion,playerCardHeight,playerCardBottomShadowReach,playerCardOvrShadowReach,playerCardOvrShadowWidth,monthClosedCardHeight,monthClosedCardWidth,monthClosedPhotoWidth,monthClosedContentOffset,monthClosedShadow,cardPhotoPreset:firestoreSafe(savedCardPhotoPreset),monthPhotoPreset:firestoreSafe(savedMonthPhotoPreset)})}
function saveMusicDomain(){return queueDomainPatch('music',{dataJson:JSON.stringify({musicLibrary:firestoreSafe(musicLibrary),musicPlaylists:firestoreSafe(musicPlaylists),activeMusicPlaylistId,musicSettings:firestoreSafe(musicSettings)})},320)}
async function persist(){const playerResult=await savePlayers();const results=await Promise.all([saveRounds(),saveMonth(),saveBonus(),savePersonalization(),saveMusicDomain()]);return playerResult!==false&&results.every(Boolean)}
function savePeriodStart(){return saveMonth()}
function saveTrophies(){return saveMonth()}
function applyDomainData(domains){
  const pd=domains.players;
  if(typeof pd?.dataJson==='string'){try{players=JSON.parse(pd.dataJson).map(normalizePlayer);domainReady.players=true}catch(e){console.error('Jogadores salvos não puderam ser lidos:',e)}}
  else if(pd?.items){domainReady.players=true;const legacy=objectById(players),order=Array.isArray(pd.order)?pd.order:Object.keys(pd.items);players=order.map(id=>pd.items[id]?normalizePlayer({...legacy[id],...pd.items[id]}):null).filter(Boolean)}
  const rd=domains.rounds;
  if(typeof rd?.dataJson==='string'){try{rounds=JSON.parse(rd.dataJson).map(normalizeRoundFromFirebase);domainReady.rounds=true}catch(e){console.error('Rodadas salvas não puderam ser lidas:',e)}round1PhotoSeedVersion=Number(rd.round1PhotoSeedVersion??round1PhotoSeedVersion)||0}
  else if(rd?.items){domainReady.rounds=true;const order=Array.isArray(rd.order)?rd.order:Object.keys(rd.items);rounds=order.map(id=>rd.items[id]?normalizeRoundFromFirebase(rd.items[id]):null).filter(Boolean);round1PhotoSeedVersion=Number(rd.round1PhotoSeedVersion??round1PhotoSeedVersion)||0}
  const md=domains.month;if(md){let monthData=md;try{if(typeof md.dataJson==='string')monthData=JSON.parse(md.dataJson)}catch(e){console.error('Mês salvo não pôde ser lido:',e)}periodStart=monthData.periodStart??periodStart;months=monthData.months??months;manualTrophyAdjustments=monthData.manualTrophyAdjustments??manualTrophyAdjustments;monthStartDay=monthData.monthStartDay??monthStartDay}
  const plan=domains.planner;if(plan){
    let storedPlanner=plan.teamPlanner,storedPublished=plan.publishedTeamPlans;
    try{if(typeof plan.teamPlannerJson==='string')storedPlanner=JSON.parse(plan.teamPlannerJson)}catch(e){console.warn('Escala salva em texto não pôde ser lida; usando a cópia anterior.',e)}
    try{if(typeof plan.publishedTeamPlansJson==='string')storedPublished=JSON.parse(plan.publishedTeamPlansJson)}catch(e){console.warn('Publicações salvas em texto não puderam ser lidas; usando a cópia anterior.',e)}
    teamPlanner=normalizeTeamPlanner(storedPlanner??teamPlanner);
    publishedTeamPlans=storedPublished?normalizePublishedTeamPlans(storedPublished):publishedTeamPlans;
  }
  const bonus=domains.bonus;if(bonus){bonusRules={...DEFAULT_BONUS_RULES,...(bonus.bonusRules||bonusRules)};savedBonusRulesPreset=bonus.bonusRulesPreset??savedBonusRulesPreset}
  const ui=domains.personalization;if(ui){playerAttributePresetVersion=Number(ui.playerAttributePresetVersion??playerAttributePresetVersion)||0;playerCardHeight=ui.playerCardHeight??playerCardHeight;playerCardBottomShadowReach=ui.playerCardBottomShadowReach??playerCardBottomShadowReach;playerCardOvrShadowReach=ui.playerCardOvrShadowReach??playerCardOvrShadowReach;playerCardOvrShadowWidth=ui.playerCardOvrShadowWidth??playerCardOvrShadowWidth;monthClosedCardHeight=ui.monthClosedCardHeight??monthClosedCardHeight;monthClosedCardWidth=ui.monthClosedCardWidth??monthClosedCardWidth;monthClosedPhotoWidth=ui.monthClosedPhotoWidth??monthClosedPhotoWidth;monthClosedContentOffset=ui.monthClosedContentOffset??monthClosedContentOffset;monthClosedShadow=ui.monthClosedShadow??monthClosedShadow;savedCardPhotoPreset=ui.cardPhotoPreset??savedCardPhotoPreset;savedMonthPhotoPreset=ui.monthPhotoPreset??savedMonthPhotoPreset}
  const music=domains.music;if(music){let musicData=music;try{if(typeof music.dataJson==='string')musicData=JSON.parse(music.dataJson)}catch(e){console.error('Biblioteca musical salva não pôde ser lida:',e)}musicLibrary=musicData.musicLibrary??musicLibrary;musicPlaylists=musicData.musicPlaylists??musicPlaylists;activeMusicPlaylistId=musicData.activeMusicPlaylistId??activeMusicPlaylistId;musicSettings={...musicSettings,...(musicData.musicSettings||{})}}
}


function markSaving(){
  const el = $('saveStatus');
  el.textContent = 'Salvando…';
  el.classList.add('show','pending');
}
function markSaved(){
  const el = $('saveStatus');
  const now = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  el.textContent = `✓ Salvo às ${now}`;
  el.classList.remove('pending');
  el.classList.add('show');
}
function markSaveError(message){
  const el=$('saveStatus');
  el.textContent=`⚠ ${message}`;
  el.classList.remove('pending');
  el.classList.add('show');
}
function markLoaded(){
  const el=$('saveStatus');
  el.textContent='✓ Dados carregados';
  el.classList.remove('pending');
  el.classList.add('show');
}

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function fmtDate(iso){ if(!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function initials(name){ return (name||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase(); }
function renderEntryTitleBadges(badges){
  const titles = {'⭐':'MVP atual','⚽':'Artilheiro atual','🎯':'Garçom atual','🐐':'GOAT conquistado ou tríplice coroa em disputa','🌌':'COSMIC conquistado','💠':'Colecionador conquistado','👑':'Título conquistado'};
  return badges.length ? `<span class="entry-title-badge">${badges.map(icon=>`<span class="entry-title-icon" title="${titles[icon]||'Título'}">${icon}</span>`).join('')}</span>` : '';
}

const PRISMATIC_RECORD_KEYS = new Set(['allTimeGoals','allTimeAssists','allTimeParticipacao','monthAvgRating']);
function isPrismaticRecord(key, item){
  if(!PRISMATIC_RECORD_KEYS.has(key)) return false;
  return key !== 'monthAvgRating' || Number(item?.value) === 10;
}
function hasPrismaticPerformance(playerId, records){
  const rec = records || computeRecords();
  return (rec.monthAvgRating||[]).some(item=>item.playerId===playerId && Number(item.value)===10);
}
function latestClosedMonth(){return months.length?[...months].sort((a,b)=>b.endDate.localeCompare(a.endDate))[0]:null}
function deriveMonthPrismaticPlayers(month){
  if(!month)return [];
  const totals=computeAllTotals(month.startDate,month.endDate);
  return players.filter(p=>{const t=totals[p.id];return t?.ratingCount&&Math.abs(t.ratingSum/t.ratingCount-10)<.0001}).map(p=>p.id);
}
function latestClosedSpecialPatentSets(){
  const latest=latestClosedMonth();
  const empty={prismatic:new Set(),cosmic:new Set(),collector:new Set(),month:null};
  if(!latest)return empty;
  const saved=latest.specialPatents||{};
  const prismatic=new Set(deriveMonthPrismaticPlayers(latest));
  let cosmic=new Set(months.flatMap(month=>Array.isArray(month.specialPatents?.cosmic)?month.specialPatents.cosmic:[]));
  let collector=new Set(months.flatMap(month=>Array.isArray(month.specialPatents?.collector)?month.specialPatents.collector:[]));
  if(!latest.specialPatents){
    const sets=computeSecretRecordSets(),key=computePeriodMonthKey(latest.startDate,latest.endDate);
    cosmic=new Set([
      ...cosmic,
      ...players.filter(p=>sets.cosmicMonthSet.has(p.id+'|'+key)).map(p=>p.id)
    ]);
    collector=new Set([...collector,...players.filter(p=>sets.platinumPlayerSet.has(p.id)).map(p=>p.id)]);
    latest.specialPatents={
      prismatic:[...prismatic],
      cosmic:[...cosmic],
      collector:[...collector]
    };
  }
  const liveCollectorSet=computeSecretRecordSets().platinumPlayerSet;
  const liveCosmicSet=computeSecretRecordSets().cosmicPlayerSet;
  players.forEach(player=>{if(liveCosmicSet.has(player.id)) cosmic.add(player.id)});
  players.forEach(player=>{if(liveCollectorSet.has(player.id)) collector.add(player.id)});
  return {prismatic,cosmic,collector,month:latest};
}
function hasReigningPrismaticPerformance(playerId){return latestClosedSpecialPatentSets().prismatic.has(playerId)}
function hasPrismaticPerformanceAtMonth(playerId, monthKey, records){
  if(!monthKey) return false;
  const rec=records || computeRecords();
  return (rec.monthAvgRating||[]).some(item=>item.playerId===playerId && item.monthKey===monthKey && Number(item.value)===10);
}
function isCurrentTitleContender(playerId){
  const current=computeCurrentPeriodStats();
  return !!(current && !isCurrentGoat(current,playerId) && ['mvp','artilheiro','garcom'].some(type=>isCurrentLeader(current,type,playerId)));
}
function createRankingPatentContext(){
  const latestClosed=months.length ? [...months].sort((a,b)=>b.endDate.localeCompare(a.endDate))[0] : null;
  return {
    latestKey: latestClosed ? computePeriodMonthKey(latestClosed.startDate,latestClosed.endDate) : '',
    secretSets:computeSecretRecordSets(),
    officialSpecial:latestClosedSpecialPatentSets(),
    reigning:computeReigningTitles(),
    current:computeCurrentPeriodStats(),
  };
}
function rankingPatentClass(playerId, context){
  const ctx=context || createRankingPatentContext();
  const rb=computeReigningBadgesFor(ctx.reigning,playerId);
  if(ctx.officialSpecial.cosmic.has(playerId)) return 'ranking-patent-cosmic';
  if(ctx.officialSpecial.collector.has(playerId)) return 'ranking-patent-platinum';
  if(rb.isGoat) return 'ranking-patent-goat';
  if(hasReigningPrismaticPerformance(playerId)) return 'ranking-patent-prismatic';
  if(rb.titles.length) return 'ranking-patent-gold';
  const closedPodiumMedal=playerClosedPodiumMedal(playerId);
  if(closedPodiumMedal==='silver') return 'ranking-patent-silver';
  if(closedPodiumMedal==='bronze') return 'ranking-patent-bronze';
  if(ctx.current && isCurrentGoat(ctx.current,playerId)) return 'ranking-patent-goat-current';
  const podiumMedal=playerCurrentPodiumMedal(playerId);
  if(podiumMedal==='gold') return 'ranking-patent-current-gold';
  if(podiumMedal==='silver') return 'ranking-patent-current-silver';
  if(podiumMedal==='bronze') return 'ranking-patent-current-bronze';
  return '';
}

const ROUND_RECORD_CATS = [
  {key:'roundGoals', label:'Mais gols em uma rodada', unit:'gols'},
  {key:'roundAssists', label:'Mais assistências em uma rodada', unit:'assist.'},
  {key:'roundParticipacao', label:'Maior G/A em uma rodada', unit:'G/A'},
  {key:'roundScore', label:'Maior pontuação em uma rodada', unit:'pts'},
];
const MONTH_RECORD_CATS = [
  {key:'monthGoals', label:'Mais gols em um mês', unit:'gols'},
  {key:'monthAssists', label:'Mais assistências em um mês', unit:'assist.'},
  {key:'monthParticipacao', label:'Maior G/A em um mês', unit:'G/A'},
  {key:'monthScore', label:'Maior pontuação em um mês', unit:'pts'},
  {key:'monthAvgRating', label:'Melhor performance em um mês (nota média)', unit:'nota'},
  {key:'monthRatingTen', label:'Mais vezes com nota 10 em um mês', unit:'x'},
];
const MAX_RECORD_CATS_IN_A_MONTH = ROUND_RECORD_CATS.length + MONTH_RECORD_CATS.length + 1;

function isRachaRecord(item, globalList){
  if(!item || !globalList || !globalList.length) return false;
  return globalList.some(g=>{
    if(g.playerId !== item.playerId) return false;
    if(item.monthKey!=null && g.monthKey!=null) return g.monthKey===item.monthKey;
    if(item.round && g.round) return g.round.id === item.round.id;
    return g.value === item.value;
  });
}

function isGoatInstance(playerId, item, tripleCrownSet){
  if(!item) return false;
  let mk = item.monthKey || item.monthKeyEnd;
  if(mk==null && item.round) mk = recordPeriodKeyForRound(item.round);
  if(mk==null) return false;
  return tripleCrownSet.has(playerId+'|'+mk);
}
function titleTierAtRecord(playerId, item){
  if(!item) return null;
  let month = item.round ? findClosedMonthForRound(item.round) : null;
  if(!month && item.monthKey){
    month = months.find(m=>computePeriodMonthKey(m.startDate,m.endDate)===item.monthKey) || null;
  }
  if(!month) return null;
  const winners = computeMonthWinners(month);
  if(winners.mvp===playerId) return 'mvp';
  if(winners.artilheiro===playerId) return 'artilheiro';
  if(winners.garcom===playerId) return 'garcom';
  return null;
}
function closedMonthForHistoricalItem(item){
  if(!item) return null;
  if(item.round) return findClosedMonthForRound(item.round);
  const mk=item.monthKey || item.monthKeyEnd || item.monthKeyStart;
  return mk ? (months.find(m=>computePeriodMonthKey(m.startDate,m.endDate)===mk) || null) : null;
}
function frozenSpecialTier(playerId,item){
  if(!item || !playerId) return null;
  if(item.month){
    if((item.month.specialPatents?.cosmic||[]).includes(playerId)) return 'cosmic';
    if((item.month.specialPatents?.collector||[]).includes(playerId)) return 'platinum';
    if(deriveMonthPrismaticPlayers(item.month).includes(playerId)) return 'prismatic';
  }
  const mk=item.monthKey || item.monthKeyEnd || item.monthKeyStart;
  const roundDate=item.round?.date;
  const exactStart=item.startDate || item.periodStart;
  const exactEnd=item.endDate || item.periodEnd;
  const candidates=months.filter(month=>{
    if(exactStart && exactEnd) return month.startDate===exactStart && month.endDate===exactEnd;
    if(roundDate) return roundDate>=month.startDate.slice(0,10) && roundDate<month.endDate.slice(0,10);
    return mk && computePeriodMonthKey(month.startDate,month.endDate)===mk;
  }).sort((a,b)=>(b.closedAt||b.endDate).localeCompare(a.closedAt||a.endDate));
  if(!candidates.length) return null;
  if(candidates.some(month=>(month.specialPatents?.cosmic||[]).includes(playerId))) return 'cosmic';
  if(candidates.some(month=>(month.specialPatents?.collector||[]).includes(playerId))) return 'platinum';
  if(candidates.some(month=>deriveMonthPrismaticPlayers(month).includes(playerId))) return 'prismatic';
  return null;
}
function frozenMonthHighestTier(month){
  if(!month) return null;
  const saved=month.specialPatents || {};
  if((saved.cosmic||[]).length) return 'cosmic';
  if((saved.collector||[]).length) return 'platinum';
  const prism=deriveMonthPrismaticPlayers(month);
  return prism.length ? 'prismatic' : null;
}
function recordListIsGoat(list, tripleCrownSet){
  if(!list || !list.length) return false;
  return list.every(item=> isGoatInstance(item.playerId, item, tripleCrownSet));
}
function personalListIsGoat(playerId, list, tripleCrownSet){
  if(!list || !list.length) return false;
  return list.every(item=> isGoatInstance(playerId, item, tripleCrownSet));
}
function renderBrokenRecordChip(b){
  const p = players.find(pp=>pp.id===b.playerId);
  const pname = p ? p.nickname : 'Jogador removido';
  const valStr = (b.unit==='pts' || b.unit==='nota') ? `${b.value.toFixed(1)} ${b.unit}` : `${b.value} ${b.unit}`;
  const cls = b.cosmic ? ' chip-cosmic' : (b.platinum ? ' chip-platinum' : (b.goat ? ' chip-goat' : (b.prismatic ? ' chip-prismatic' : '')));
  const icon = b.cosmic ? '🌌' : (b.platinum ? '💠' : (b.goat ? '🐐' : (b.prismatic ? '💎' : '🏆')));
  return `<div class="round-record-chip${cls}">${icon} ${b.label}: <b>${pname}</b> (${valStr})</div>`;
}
function brokenRecordsTier(broken, isGoat=false){
  if(broken.some(b=>b.cosmic)) return 'cosmic';
  if(broken.some(b=>b.platinum)) return 'platinum';
  if(isGoat || broken.some(b=>b.goat)) return 'goat';
  if(broken.some(b=>b.prismatic)) return 'prismatic';
  return 'gold';
}
function renderBrokenRecordCountBadge(broken, isGoat=false){
  if(!broken?.length) return '';
  const tier=brokenRecordsTier(broken,isGoat);
  const icon=tier==='cosmic'?'🌌':(tier==='platinum'?'💠':(tier==='goat'?'🐐':(tier==='prismatic'?'💎':'🏆')));
  const word=broken.length===1?'recorde quebrado':'recordes quebrados';
  return `<span class="record-count-badge tier-${tier}">${icon} ${broken.length} ${word}</span>`;
}
function renderCollapsibleBrokenRecords(broken, label='Recordes quebrados', isGoat=false){
  if(!broken?.length) return '';
  return `<details class="broken-records-details"><summary>${renderBrokenRecordCountBadge(broken,isGoat)}<span class="records-toggle-label">${label} · abrir</span></summary><div class="round-records">${broken.map(renderBrokenRecordChip).join('')}</div></details>`;
}

function computeSecretRecordSets(){
  const rec = computeRecords();
  const streaks = computeTitleStreaks();
  const brokenStats = computeMostRecordsBrokenStats();
  const secret = computeSecretRecords(rec, streaks, brokenStats);
  const cosmicMonthSet = createCosmicMonthSet(secret.mesPerfeito||[]);
  const platinumPlayerSet = createPlatinumPlayerSet(secret.colecionador);
  const cosmicPlayerSet = new Set([...cosmicMonthSet].map(k=> k.split('|')[0]));
  return { cosmicMonthSet, cosmicPlayerSet, platinumPlayerSet };
}
function createCosmicMonthSet(items){
  const set=new Set((items||[]).map(item=>item.playerId+'|'+item.monthKey));
  set.periodSet=new Set((items||[]).flatMap(item=>{
    const start=item.startDate || item.month?.startDate;
    const end=item.endDate || item.month?.endDate;
    return start&&end ? [item.playerId+'|'+start+'|'+end] : [];
  }));
  return set;
}
function createPlatinumPlayerSet(items){
  const set = new Set((items||[]).map(item=>item.playerId));
  set.sinceByPlayer = new Map((items||[]).map(item=>[item.playerId,item.monthKey]));
  return set;
}
function isCosmicInstance(playerId, item, cosmicMonthSet){
  if(!item) return false;
  const explicitStart=item.startDate || item.periodStart || item.month?.startDate;
  const explicitEnd=item.endDate || item.periodEnd || item.month?.endDate;
  if(explicitStart && explicitEnd && cosmicMonthSet.periodSet?.size){
    return cosmicMonthSet.periodSet.has(playerId+'|'+explicitStart+'|'+explicitEnd);
  }
  if(item.round?.date && cosmicMonthSet.periodSet?.size){
    const roundDate=item.round.date.slice(0,10);
    if(months.some(month=>roundDate>=month.startDate.slice(0,10) && roundDate<month.endDate.slice(0,10)
      && cosmicMonthSet.periodSet.has(playerId+'|'+month.startDate+'|'+month.endDate))) return true;
  }
  const closed=item.month || (item.round ? findClosedMonthForRound(item.round) : null);
  const start=closed?.startDate;
  const end=closed?.endDate;
  if(start && end && cosmicMonthSet.periodSet?.size){
    return cosmicMonthSet.periodSet.has(playerId+'|'+start+'|'+end);
  }
  let mk = item.monthKey || item.monthKeyEnd;
  if(mk==null && item.round) mk = recordPeriodKeyForRound(item.round);
  if(mk==null) return false;
  return cosmicMonthSet.has(playerId+'|'+mk);
}
function isPlatinumInstance(playerId, platinumPlayerSet, item){
  if(!platinumPlayerSet.has(playerId)) return false;
  const since = platinumPlayerSet.sinceByPlayer?.get(playerId);
  if(!since || !item) return true;
  let monthKey = item.monthKey || item.monthKeyEnd;
  if(!monthKey && item.round) monthKey = recordPeriodKeyForRound(item.round);
  return !monthKey || monthKey >= since;
}
function recordListSecretTier(list, sets){
  if(!list || !list.length) return null;
  if(list.some(item=> isCosmicInstance(item.playerId, item, sets.cosmicMonthSet))) return 'cosmic';
  if(list.some(item=> isPlatinumInstance(item.playerId, sets.platinumPlayerSet, item))) return 'platinum';
  return null;
}
function personalRecordSecretTier(playerId, list, sets){
  if(!list || !list.length) return null;
  if(list.every(item=> isCosmicInstance(playerId, item, sets.cosmicMonthSet))) return 'cosmic';
  if(list.some(item=>isPlatinumInstance(playerId, sets.platinumPlayerSet, item))) return 'platinum';
  return null;
}
function secretTierForLastMonth(playerId, monthKey, sets, period){
  const historicalItem={monthKey,startDate:period?.startDate,endDate:period?.endDate};
  const frozen=frozenSpecialTier(playerId,historicalItem);
  if(frozen==='cosmic') return frozen;
  if(isCosmicInstance(playerId, historicalItem, sets.cosmicMonthSet)) return 'cosmic';
  if(frozen==='platinum') return frozen;
  const closedCandidates=months.filter(month=>period?.startDate && period?.endDate
      ? month.startDate===period.startDate && month.endDate===period.endDate
      : computePeriodMonthKey(month.startDate,month.endDate)===monthKey)
    .sort((a,b)=>(b.closedAt||b.endDate).localeCompare(a.closedAt||a.endDate));
  const wasGoat=closedCandidates.some(month=>{
    const winners=computeMonthWinners(month);
    return winners.mvp===playerId && winners.artilheiro===playerId && winners.garcom===playerId;
  });
  if(wasGoat) return 'goat';
  if(isPlatinumInstance(playerId, sets.platinumPlayerSet, {monthKey})) return 'platinum';
  if(frozen) return frozen;
  return null;
}

const REIGNING_MVP_TITLE = 'Troféu MVP';
const REIGNING_ART_TITLE = 'Troféu Artilheiro';
const REIGNING_GAR_TITLE = 'Troféu Garçom';
const GOAT_TITLE = 'GOAT do mês';

let toastTimer = null;
function showToast(msg){
  let t = $('appToast');
  if(!t){ t = document.createElement('div'); t.id='appToast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove('show'), 2200);
}

function askConfirm(message){
  return new Promise(resolve=>{
    $('confirmMessage').textContent = message;
    $('confirmOverlay').classList.add('active');
    const yesBtn = $('btnConfirmYes'), noBtn = $('btnConfirmNo');
    const cleanup = (result)=>{
      $('confirmOverlay').classList.remove('active');
      yesBtn.removeEventListener('click', onYes);
      noBtn.removeEventListener('click', onNo);
      resolve(result);
    };
    const onYes = ()=>cleanup(true);
    const onNo = ()=>cleanup(false);
    yesBtn.addEventListener('click', onYes);
    noBtn.addEventListener('click', onNo);
  });
}

document.addEventListener('input', (e)=>{
  if(e.target.matches('input[type=number]')){
    if(e.target.value !== '' && Number(e.target.value) < 0){
      e.target.value = 0;
    }
  }
});
