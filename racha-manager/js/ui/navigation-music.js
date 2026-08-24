document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    $('view-'+btn.dataset.tab).classList.add('active');
    if(btn.dataset.tab==='rodada') renderRoundForm();
    if(btn.dataset.tab==='geral') renderGeral();
    if(btn.dataset.tab==='mes') renderMes();
    if(btn.dataset.tab==='musicas') renderMusic();
  });
});

const MUSIC_COLLAPSED_LIMIT=5;
let showAllMusicLibrary=false;
let showAllPlaylistSongs=false;
let musicShuffleState={signature:'',remaining:[]};
function openMusicFilesDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('racha-manager-music-files',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('files');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function saveLocalMusicFile(id,file){
  const db=await openMusicFilesDb();
  await new Promise((resolve,reject)=>{ const tx=db.transaction('files','readwrite'); tx.objectStore('files').put(file,id); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); });
  db.close();
}
async function removeLocalMusicFile(id){
  const db=await openMusicFilesDb();
  await new Promise((resolve,reject)=>{ const tx=db.transaction('files','readwrite'); tx.objectStore('files').delete(id); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); });
  db.close();
  if(musicObjectUrls.has(id)){ URL.revokeObjectURL(musicObjectUrls.get(id)); musicObjectUrls.delete(id); }
}

function safeMusicFileName(name){
  return String(name||'audio').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-120) || 'audio';
}
async function uploadMusicToCloud(id,file){
  if(!auth.currentUser) throw new Error('auth-required');
  if(!file) throw new Error('Arquivo de música inválido.');
  const version=Date.now();
  const safeId=String(id||'musica').replace(/[^a-zA-Z0-9_-]/g,'_');
  const path=`rachas/${activeRachaId}/music/${safeId}/${version}-${safeMusicFileName(file.name)}`;
  const encodedPath=path.split('/').map(encodeURIComponent).join('/');
  const uploadUrl=`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(SUPABASE_MEDIA_BUCKET)}/${encodedPath}`;
  let response;
  try{
    response=await withFirebaseTimeout(fetch(uploadUrl,{
      method:'POST',
      headers:{
        apikey:SUPABASE_PUBLISHABLE_KEY,
        'Content-Type':file.type||'audio/mpeg',
        'x-upsert':'false',
        'cache-control':'3600'
      },
      body:file
    }),60000,'envio da música ao Supabase');
  }catch(error){
    throw new Error(`Falha de rede ao enviar a música para o Supabase: ${error?.message||error}`);
  }
  let bodyText='';
  try{bodyText=await response.text()}catch(_){}
  if(!response.ok){
    let detail=bodyText;
    try{const parsed=JSON.parse(bodyText);detail=parsed.message||parsed.error||parsed.code||bodyText}catch(_){}
    throw new Error(`Supabase Storage recusou a música (${response.status}${detail?`: ${detail}`:''}).`);
  }
  const publicUrl=`${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(SUPABASE_MEDIA_BUCKET)}/${encodedPath}`;
  return {url:publicUrl,storagePath:path,storageProvider:'supabase',version};
}
async function addMusicOnlyOnThisDevice(id,title,file){
  await withFirebaseTimeout(saveLocalMusicFile(id,file),12000,'salvamento local da música');
  musicLibrary.push({id,title,url:'',source:'file',fileName:file.name,storagePath:''});
  return persistMusic();
}
async function removeCloudMusicFile(song){
  if(!song) return false;
  const supabasePath=normalizeSupabaseMediaPath(song.storagePath || song.url || '');
  if(supabasePath) return deleteSupabaseMediaObjectBestEffort(supabasePath,`música ${song.title||song.id||''}`);
  if(song.storagePath){
    try{ await deleteObject(storageRef(storage,song.storagePath)); return true }
    catch(err){ console.warn('Não foi possível remover o arquivo legado do Firebase Storage:',err); }
  }
  return false;
}
async function getMusicSource(song){
  if(song.url) return song.url;
  if(musicObjectUrls.has(song.id)) return musicObjectUrls.get(song.id);
  const db=await openMusicFilesDb();
  const file=await new Promise((resolve,reject)=>{ const request=db.transaction('files','readonly').objectStore('files').get(song.id); request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); });
  db.close();
  if(!file) return '';
  const source=URL.createObjectURL(file); musicObjectUrls.set(song.id,source); return source;
}
function musicEscape(value){
  return String(value ?? '').replace(/[&<>'"]/g,ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[ch]));
}
function getActiveMusicPlaylist(){ return musicPlaylists.find(p=>p.id===activeMusicPlaylistId) || null; }
function getMusicById(id){ return musicLibrary.find(m=>m.id===id) || null; }
function applyMusicSettings(){
  musicSettings.musicVolume=Math.max(0,Math.min(100,Number(musicSettings.musicVolume)||0));
  musicSettings.effectsVolume=Math.max(0,Math.min(100,Number(musicSettings.effectsVolume)||0));
  musicAudio.volume=musicSettings.musicVolume/100;
  musicAudio.muted=!!musicSettings.musicMuted;
  musicAudio.loop=false;
}
function musicSequence(playlist){
  return (playlist?.songIds || []).map(getMusicById).filter(Boolean);
}
function shuffledMusicIds(ids){
  const result=[...ids];
  for(let index=result.length-1;index>0;index--){
    const other=Math.floor(Math.random()*(index+1));
    [result[index],result[other]]=[result[other],result[index]];
  }
  return result;
}
function resetMusicShuffle(){ musicShuffleState={signature:'',remaining:[]}; }
function nextShuffledMusic(songs,playlist){
  const ids=songs.map(song=>song.id);
  const signature=`${playlist?.id||''}:${ids.join('|')}`;
  if(musicShuffleState.signature!==signature){
    musicShuffleState={signature,remaining:shuffledMusicIds(ids.filter(id=>id!==currentMusicId))};
  }
  if(!musicShuffleState.remaining.length){
    musicShuffleState.remaining=shuffledMusicIds(ids);
    if(ids.length>1 && musicShuffleState.remaining[0]===currentMusicId){
      const swapIndex=musicShuffleState.remaining.findIndex(id=>id!==currentMusicId);
      [musicShuffleState.remaining[0],musicShuffleState.remaining[swapIndex]]=[musicShuffleState.remaining[swapIndex],musicShuffleState.remaining[0]];
    }
  }
  return getMusicById(musicShuffleState.remaining.shift());
}
async function persistMusic(){ return saveMusicDomain(); }
async function playMusicById(id){
  const song=getMusicById(id);
  if(!song) return;
  const source=await getMusicSource(song);
  if(!source){ showToast('Essa música ainda está salva apenas em um aparelho. Entre como organizador e envie o arquivo para a nuvem.'); return; }
  currentMusicId=song.id;
  if(musicSettings.playMode==='shuffle'){
    const playlist=getActiveMusicPlaylist();
    const ids=musicSequence(playlist).map(item=>item.id);
    const signature=`${playlist?.id||''}:${ids.join('|')}`;
    if(musicShuffleState.signature!==signature) musicShuffleState={signature,remaining:shuffledMusicIds(ids.filter(id=>id!==song.id))};
    else musicShuffleState.remaining=musicShuffleState.remaining.filter(id=>id!==song.id);
  }
  if(musicAudio.src!==source) musicAudio.src=source;
  applyMusicSettings();
  try{ await musicAudio.play(); }
  catch(_){ if(!pendingMusicAutoStart) showToast('Não foi possível iniciar esta música. Tente tocar novamente.'); }
  renderMusic();
}
async function startMusicOnSiteEntry(){
  if(!musicSettings.autoStart) return;
  const songs=musicSequence(getActiveMusicPlaylist());
  if(!songs.length) return;
  const song=musicSettings.randomStart ? songs[Math.floor(Math.random()*songs.length)] : songs[0];
  if(musicSettings.playMode==='shuffle'){
    const playlist=getActiveMusicPlaylist();
    musicShuffleState={signature:`${playlist?.id||''}:${songs.map(item=>item.id).join('|')}`,remaining:shuffledMusicIds(songs.map(item=>item.id).filter(id=>id!==song.id))};
  }
  pendingMusicAutoStart=true;
  await playMusicById(song.id);
}
function resumePendingMusicOnInteraction(){
  if(!pendingMusicAutoStart) return;
  const song=getMusicById(currentMusicId);
  if(song) playMusicById(song.id);
}
function stepMusic(direction){
  const playlist=getActiveMusicPlaylist();
  const songs=musicSequence(playlist);
  if(!songs.length){ showToast('Adicione músicas à playlist primeiro.'); return; }
  let index=songs.findIndex(song=>song.id===currentMusicId);
  if(musicSettings.playMode==='shuffle'){
    const nextSong=nextShuffledMusic(songs,playlist);
    if(nextSong){ playMusicById(nextSong.id); return; }
  }else index=(index + direction + songs.length) % songs.length;
  playMusicById(songs[Math.max(0,index)]?.id || songs[0].id);
}
function renderMusic(){
  const library=$('musicLibraryList');
  const tabs=$('musicPlaylistTabs');
  const playlistList=$('musicPlaylistList');
  if(!library || !tabs || !playlistList) return;
  const playlist=getActiveMusicPlaylist();
  const canEdit=isAdmin;
  $('musicLoginNotice').style.display=canEdit?'none':'block';
  $('musicManageLibrary').style.display=canEdit?'block':'none';
  $('musicManagePlaylists').style.display=canEdit?'block':'none';
  ['musicTitleInput','musicFileInput','playlistNameInput','btnChooseMusicFile','btnAddMusic','btnCreatePlaylist'].forEach(id=>{ const el=$(id); if(el) el.disabled=!canEdit; });
  const visibleLibrary=showAllMusicLibrary ? musicLibrary : musicLibrary.slice(0,MUSIC_COLLAPSED_LIMIT);
  const libraryToggle=musicLibrary.length>MUSIC_COLLAPSED_LIMIT ? `<button type="button" class="btn btn-ghost btn-sm" data-music-toggle="library" style="width:100%;margin-top:8px;">${showAllMusicLibrary?'Mostrar menos':`Mostrar todas (${musicLibrary.length})`}</button>` : '';
  library.innerHTML=musicLibrary.length ? visibleLibrary.map(song=>`<div class="music-row"><button class="btn btn-ghost btn-sm" data-music-play="${song.id}">▶</button><b title="${musicEscape(song.title)}">${musicEscape(song.title)}</b><span class="music-url">${song.source==='file'?'somente neste aparelho':(song.source==='cloud'?'nuvem · todos os dispositivos':musicEscape(song.url))}</span>${canEdit?`<button class="btn btn-ghost btn-sm" data-music-add="${song.id}">+ playlist</button>${song.source==='file'?`<button class="btn btn-ghost btn-sm" data-music-relink="${song.id}">Enviar p/ todos</button>`:`<button class="btn btn-ghost btn-sm" data-music-relink="${song.id}">Trocar arquivo</button>`}<button class="btn btn-danger btn-sm" data-music-delete="${song.id}">×</button>`:''}</div>`).join('')+libraryToggle : '<div class="music-empty">Nenhuma música adicionada ainda.</div>';
  tabs.innerHTML=(musicPlaylists.map(p=>`<button type="button" class="music-playlist-tab ${p.id===activeMusicPlaylistId?'active':''}" data-playlist-select="${p.id}">${musicEscape(p.name)}</button>`).join('')) + (canEdit?'<button type="button" class="btn btn-danger btn-sm" id="btnDeletePlaylist">Excluir playlist</button>':'');
  const songs=musicSequence(playlist);
  const visibleSongs=showAllPlaylistSongs ? songs : songs.slice(0,MUSIC_COLLAPSED_LIMIT);
  const playlistToggle=songs.length>MUSIC_COLLAPSED_LIMIT ? `<button type="button" class="btn btn-ghost btn-sm" data-music-toggle="playlist" style="width:100%;margin-top:8px;">${showAllPlaylistSongs?'Mostrar menos':`Mostrar todas (${songs.length})`}</button>` : '';
  playlistList.innerHTML=playlist ? (songs.length ? visibleSongs.map((song,index)=>`<div class="music-row" draggable="${canEdit}" data-playlist-song="${song.id}"><span class="num">${index+1}</span><button class="btn btn-ghost btn-sm" data-music-play="${song.id}">▶</button><b>${musicEscape(song.title)}</b>${canEdit?`<button class="btn btn-danger btn-sm" data-music-remove="${song.id}">×</button>`:''}</div>`).join('')+playlistToggle : '<div class="music-empty">Esta playlist está vazia. Use “+ playlist” na biblioteca.</div>') : '<div class="music-empty">Crie uma playlist para montar a ordem das músicas.</div>';
  const current=getMusicById(currentMusicId);
  $('musicNowPlaying').innerHTML=current ? `🎵 Tocando: <b>${musicEscape(current.title)}</b>${musicAudio.paused?' <span class="section-sub">(pausada)</span>':''}` : 'Nenhuma música selecionada.';
  $('musicVolume').value=musicSettings.musicVolume; $('musicVolumeValue').textContent=`${musicSettings.musicVolume}%`; $('musicMuted').checked=!!musicSettings.musicMuted;
  $('effectsVolume').value=musicSettings.effectsVolume; $('effectsVolumeValue').textContent=`${musicSettings.effectsVolume}%`; $('effectsMuted').checked=!!musicSettings.effectsMuted;
  $('musicPlayMode').value=musicSettings.playMode || 'ordered';
  $('musicLoop').checked=musicSettings.loop!==false;
  $('musicAutoStart').checked=musicSettings.autoStart!==false;
  $('musicRandomStart').checked=musicSettings.randomStart!==false;
  playlistList.querySelectorAll('[draggable="true"]').forEach(row=>{
    row.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/plain',row.dataset.playlistSong); e.dataTransfer.effectAllowed='move'; });
    row.addEventListener('dragover',e=>{ e.preventDefault(); row.classList.add('drag-over'); });
    row.addEventListener('dragleave',()=>row.classList.remove('drag-over'));
    row.addEventListener('drop',async e=>{
      e.preventDefault(); row.classList.remove('drag-over');
      const from=e.dataTransfer.getData('text/plain'), to=row.dataset.playlistSong;
      if(!from || from===to || !playlist || !requireAdmin()) return;
      const fromIndex=playlist.songIds.indexOf(from), toIndex=playlist.songIds.indexOf(to);
      playlist.songIds.splice(fromIndex,1); playlist.songIds.splice(toIndex,0,from);
      await persistMusic(); renderMusic();
    });
  });
}
document.addEventListener('click',async e=>{
  const target=e.target.closest('[data-music-play],[data-music-add],[data-music-delete],[data-music-remove],[data-music-relink],[data-playlist-select],[data-music-toggle]');
  if(!target) return;
  if(target.dataset.musicToggle){
    if(target.dataset.musicToggle==='library') showAllMusicLibrary=!showAllMusicLibrary;
    if(target.dataset.musicToggle==='playlist') showAllPlaylistSongs=!showAllPlaylistSongs;
    renderMusic(); return;
  }
  if(target.dataset.musicPlay) return playMusicById(target.dataset.musicPlay);
  if(target.dataset.playlistSelect){ activeMusicPlaylistId=target.dataset.playlistSelect; showAllPlaylistSongs=false; resetMusicShuffle(); renderMusic(); return; }
  if(!requireAdmin()) return;
  const playlist=getActiveMusicPlaylist();
  if(target.dataset.musicRelink){ musicRelinkId=target.dataset.musicRelink; $('musicFileInput').click(); return; }
  if(target.dataset.musicAdd){ if(!playlist){showToast('Crie ou escolha uma playlist primeiro.');return;} if(!playlist.songIds.includes(target.dataset.musicAdd)) playlist.songIds.push(target.dataset.musicAdd); await persistMusic(); renderMusic(); return; }
  if(target.dataset.musicRemove){ if(playlist) playlist.songIds=playlist.songIds.filter(id=>id!==target.dataset.musicRemove); await persistMusic(); renderMusic(); return; }
  if(target.dataset.musicDelete){
    const id=target.dataset.musicDelete, song=getMusicById(id);
    const previousLibrary=[...musicLibrary], previousPlaylists=musicPlaylists.map(p=>({...p,songIds:[...(p.songIds||[])]}));
    musicLibrary=musicLibrary.filter(m=>m.id!==id); musicPlaylists.forEach(p=>p.songIds=p.songIds.filter(songId=>songId!==id));
    if(currentMusicId===id){musicAudio.pause();currentMusicId=null;}
    const saved=await persistMusic();
    if(!saved){musicLibrary=previousLibrary;musicPlaylists=previousPlaylists;renderMusic();showToast('A remoção não foi confirmada na nuvem. O arquivo foi mantido.');return;}
    await removeLocalMusicFile(id).catch(()=>{});
    await removeCloudMusicFile(song);
    renderMusic();
  }
});
$('btnAddMusic').addEventListener('click',async()=>{
  if(!requireAdmin()) return;
  if(!selectedMusicFile){showToast('Escolha um arquivo de música primeiro.');return;}
  const id=uid(), title=$('musicTitleInput').value.trim() || selectedMusicFile.name.replace(/\.[^.]+$/,'');
  const fileToAdd=selectedMusicFile,addButton=$('btnAddMusic');
  addButton.disabled=true;addButton.textContent='Enviando…';
  try{
    showToast('Enviando música para a nuvem...');
    const uploaded=await uploadMusicToCloud(id,fileToAdd);
    musicLibrary.push({id,title,url:uploaded.url,source:'cloud',fileName:fileToAdd.name,storagePath:uploaded.storagePath,storageProvider:uploaded.storageProvider,version:uploaded.version});
    selectedMusicFile=null; $('musicFileInput').value=''; $('musicTitleInput').value='';
    const saved=await persistMusic();
    if(!saved){
      musicLibrary=musicLibrary.filter(m=>m.id!==id);
      await deleteSupabaseMediaObjectBestEffort(uploaded.storagePath,'música enviada sem metadados persistidos');
      showToast('O arquivo foi enviado, mas a biblioteca não foi confirmada. O upload foi desfeito com segurança.');return
    }
    renderMusic(); showToast('Música salva na nuvem. Ela já está disponível em todos os dispositivos.');
  }catch(err){
    console.error('Envio para a nuvem falhou; usando cópia local:',err);
    try{
      const savedLocally=await addMusicOnlyOnThisDevice(id,title,fileToAdd);
      selectedMusicFile=null;$('musicFileInput').value='';$('musicTitleInput').value='';renderMusic();
      showToast(savedLocally?'A nuvem não respondeu. Música adicionada neste aparelho; use “Enviar p/ todos” depois.':'Música guardada neste aparelho, mas a biblioteca ainda não foi confirmada na nuvem.');
    }catch(localError){console.error(localError);showToast('Não foi possível adicionar a música nem na nuvem nem neste aparelho.');}
  }finally{addButton.disabled=false;addButton.textContent='Adicionar música';}
});
$('btnChooseMusicFile').addEventListener('click',()=>{ if(requireAdmin()){ musicRelinkId=null; $('musicFileInput').click(); } });
$('musicFileInput').addEventListener('change',async e=>{
  selectedMusicFile=e.target.files?.[0] || null;
  if(musicRelinkId && selectedMusicFile){
    const song=getMusicById(musicRelinkId);
    try{
      showToast('Enviando música para a nuvem...');
      const oldSong=song?{...song}:null;
      const uploaded=await uploadMusicToCloud(musicRelinkId,selectedMusicFile);
      if(song){ song.fileName=selectedMusicFile.name; song.url=uploaded.url; song.source='cloud'; song.storagePath=uploaded.storagePath; song.storageProvider=uploaded.storageProvider; song.version=uploaded.version; }
      const saved=await persistMusic();
      if(!saved){
        if(song&&oldSong)Object.assign(song,oldSong);
        await deleteSupabaseMediaObjectBestEffort(uploaded.storagePath,'novo arquivo de música não persistido');
        showToast('A música foi enviada, mas a alteração da biblioteca não foi confirmada. O arquivo anterior foi mantido.');
        return;
      }
      if(oldSong && normalizeSupabaseMediaPath(oldSong.storagePath||oldSong.url)!==normalizeSupabaseMediaPath(uploaded.storagePath)) await removeCloudMusicFile(oldSong);
      await removeLocalMusicFile(musicRelinkId).catch(()=>{});
      selectedMusicFile=null; musicRelinkId=null; $('musicFileInput').value='';
      renderMusic(); showToast('Música enviada para a nuvem. O arquivo anterior foi removido.');
    }catch(err){ console.error(err); showToast(`Não foi possível enviar a música ao Supabase: ${err?.message||err}`); }
    return;
  }
  if(selectedMusicFile && !$('musicTitleInput').value.trim()) $('musicTitleInput').value=selectedMusicFile.name.replace(/\.[^.]+$/,'');
  if(selectedMusicFile) showToast(`Arquivo selecionado: ${selectedMusicFile.name}`);
});
$('btnCreatePlaylist').addEventListener('click',async()=>{
  if(!requireAdmin()) return;
  const name=$('playlistNameInput').value.trim(); if(!name){showToast('Dê um nome à playlist.');return;}
  const playlist={id:uid(),name,songIds:[]}; musicPlaylists.push(playlist); activeMusicPlaylistId=playlist.id; $('playlistNameInput').value=''; await persistMusic(); renderMusic();
});
$('btnMusicPlay').addEventListener('click',()=>{
  if(currentMusicId) return musicAudio.paused ? playMusicById(currentMusicId) : (musicAudio.pause(),renderMusic());
  stepMusic(1);
});
$('btnMusicPrev').addEventListener('click',()=>stepMusic(-1));
$('btnMusicNext').addEventListener('click',()=>stepMusic(1));
$('musicPlayMode').addEventListener('change',async e=>{musicSettings.playMode=e.target.value;resetMusicShuffle();await persistMusic();});
$('musicLoop').addEventListener('change',async e=>{musicSettings.loop=e.target.checked;await persistMusic();});
$('musicAutoStart').addEventListener('change',async e=>{musicSettings.autoStart=e.target.checked;await persistMusic();});
$('musicRandomStart').addEventListener('change',async e=>{musicSettings.randomStart=e.target.checked;await persistMusic();});
['musicVolume','effectsVolume'].forEach(id=>$(id).addEventListener('input',e=>{musicSettings[id]=Number(e.target.value); applyMusicSettings(); $(id+'Value').textContent=`${musicSettings[id]}%`;}));
['musicMuted','effectsMuted'].forEach(id=>$(id).addEventListener('change',async e=>{musicSettings[id]=e.target.checked;applyMusicSettings();await persistMusic();}));
$('musicVolume').addEventListener('change',persistMusic); $('effectsVolume').addEventListener('change',persistMusic);
document.addEventListener('click',async e=>{ if(e.target.id==='btnDeletePlaylist'){if(!requireAdmin())return; const playlist=getActiveMusicPlaylist(); if(!playlist)return; musicPlaylists=musicPlaylists.filter(p=>p.id!==playlist.id);activeMusicPlaylistId=musicPlaylists[0]?.id||null;await persistMusic();renderMusic();} });
musicAudio.addEventListener('playing',()=>{ pendingMusicAutoStart=false; renderMusic(); });
musicAudio.addEventListener('ended',()=>{
  if(musicSettings.loop!==false) stepMusic(1);
  else renderMusic();
});
['pointerdown','keydown','touchstart'].forEach(eventName=>document.addEventListener(eventName,resumePendingMusicOnInteraction,{passive:true}));
