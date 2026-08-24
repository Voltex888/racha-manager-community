function resizePhoto(file){
  return new Promise((resolve,reject)=>{
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.onload = () => {
      const maxSize = 520;
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(img.width*scale));
      canvas.height = Math.max(1,Math.round(img.height*scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL(file.type==='image/png' || file.type==='image/webp' ? 'image/png' : 'image/jpeg', 0.88));
    }; img.onerror = reject; img.src = e.target.result; };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let editingPlayerPhoto = null;
let hasPendingPlayerPhotoUpload = false;
let pendingPlayerPhotoPlayerId = null;
function readCardPhotoAdjustment(){
  return {
    photoScale:Math.max(.7,Math.min(1.6,(Number($('photoAdjustZoom').value)||100)/100)),
    photoX:Math.max(-35,Math.min(35,Number($('photoAdjustX').value)||0)),
    photoY:Math.max(-25,Math.min(25,Number($('photoAdjustY').value)||0)),
    photoExtraHeight:Math.max(0,Math.min(160,Number($('photoAdjustHeight').value)||45)),
    photoFadeStart:Math.max(0,Math.min(100,Number($('photoAdjustFadeStart').value)||74)),
    photoFadeEnd:Math.max(0,Math.min(100,Number($('photoAdjustFadeEnd').value)||100)),
    photoDropShadow:Math.max(0,Math.min(100,Number($('photoAdjustDropShadow').value)||42)),
    monthPhotoScale:Math.max(.7,Math.min(1.6,(Number($('monthPhotoAdjustZoom').value)||100)/100)),
    monthPhotoX:Math.max(-35,Math.min(35,Number($('monthPhotoAdjustX').value)||0)),
    monthPhotoY:Math.max(-25,Math.min(25,Number($('monthPhotoAdjustY').value)||0)),
    monthPhotoHeight:Math.max(180,Math.min(480,Number($('monthPhotoAdjustHeight').value)||330)),
    monthPhotoFadeStart:Math.max(0,Math.min(100,Number($('monthPhotoAdjustFadeStart').value)||58)),
    monthPhotoFadeEnd:Math.max(0,Math.min(100,Number($('monthPhotoAdjustFadeEnd').value)||100)),
    monthPhotoDropShadow:Math.max(0,Math.min(100,Number($('monthPhotoAdjustDropShadow').value)||42)),
    monthPhotoShadow:Math.max(0,Math.min(100,Number($('monthPhotoAdjustShadow').value)||86)),
    photoCircleScale:Math.max(.7,Math.min(1.6,(Number($('photoCircleZoom').value)||100)/100)),
    photoCircleX:Math.max(-35,Math.min(35,Number($('photoCircleX').value)||0)),
    photoCircleY:Math.max(-25,Math.min(25,Number($('photoCircleY').value)||0)),
  };
}
function circlePhotoMarkup(player, className='', size=32){
  const scale=Math.max(.7,Math.min(1.6,Number(player?.photoCircleScale)||1));
  const x=Math.max(-35,Math.min(35,Number(player?.photoCircleX)||0));
  const y=Math.max(-25,Math.min(25,Number(player?.photoCircleY)||0));
  return `<span class="circle-photo-frame ${className}" style="--circle-photo-size:${size}px;--circle-photo-scale:${scale};--circle-photo-x:${x}%;--circle-photo-y:${y}%;"><img src="${player.photo}" alt="${player.nickname||player.name}"></span>`;
}
function playerCircleMarkup(player, className='', size=32){
  if(player?.photo) return circlePhotoMarkup(player,className,size);
  const label=player ? initials(player.name) : '?';
  return `<span class="circle-photo-frame circle-photo-fallback ${className}" style="--circle-photo-size:${size}px;">${label}</span>`;
}
function monthCardPhotoMarkup(player){
  const scale=Math.max(.7,Math.min(1.6,Number(player?.monthPhotoScale ?? player?.photoScale)||1));
  const x=Math.max(-35,Math.min(35,Number(player?.monthPhotoX ?? player?.photoX)||0));
  const y=Math.max(-25,Math.min(25,Number(player?.monthPhotoY ?? player?.photoY)||0));
  const height=Math.max(180,Math.min(480,Number(player?.monthPhotoHeight)||330));
  const fadeStart=Math.max(0,Math.min(100,Number(player?.monthPhotoFadeStart ?? 58)));
  const fade=Math.max(0,Math.min(100,Number(player?.monthPhotoFadeEnd ?? player?.photoFadeEnd ?? 100)));
  const shadow=Math.max(0,Math.min(100,Number(player?.monthPhotoShadow ?? 100)))/100;
  const dropShadow=Math.max(0,Math.min(100,Number(player?.monthPhotoDropShadow ?? 42)))/100;
  return `<img class="mini-award-card-photo" src="${player.photo}" alt="${player.nickname||player.name}" style="--month-photo-height:${height}px;--month-photo-fade-start:${fadeStart}%;--month-photo-fade-end:${fade}%;--month-photo-shadow-factor:${shadow};--month-photo-drop-shadow:${dropShadow};transform:translate(calc(-50% + ${x}%),${y}%) scale(${scale});"><span class="month-photo-shade" style="--month-photo-shadow-factor:${shadow};"></span>`;
}
function photoContentTopForCardHeight(height=playerCardHeight){
  return Math.max(156,Math.min(285,Math.round(Number(height || 440) * .52)));
}
function applyPlayerCardHeight(height=playerCardHeight){
  const safeHeight = Math.max(320,Math.min(680,Number(height)||440));
  const photoTop = photoContentTopForCardHeight(safeHeight);
  const grid = $('playerGrid');
  if(grid){
    grid.style.setProperty('--elenco-card-height', `${safeHeight}px`);
    grid.style.setProperty('--elenco-photo-content-top', `${photoTop}px`);
    grid.style.setProperty('--elenco-bottom-shadow-start', `${100-playerCardBottomShadowReach}%`);
    grid.style.setProperty('--elenco-ovr-shadow-reach', `${playerCardOvrShadowReach}%`);
    grid.style.setProperty('--elenco-ovr-shadow-width', `${playerCardOvrShadowWidth}px`);
  }
  const stage = $('photoStageContent');
  if(stage) stage.style.setProperty('--card-photo-content-top', `${photoTop}px`);
  $('elencoCardHeight').value = safeHeight;
  $('elencoCardHeightValue').textContent = `${safeHeight} px`;
  $('elencoBottomShadowReach').value = playerCardBottomShadowReach;
  $('elencoBottomShadowReachValue').textContent = `${playerCardBottomShadowReach}%`;
  $('elencoOvrShadowReach').value = playerCardOvrShadowReach;
  $('elencoOvrShadowReachValue').textContent = `${playerCardOvrShadowReach}%`;
  $('elencoOvrShadowWidth').value = playerCardOvrShadowWidth;
  $('elencoOvrShadowWidthValue').textContent = `${playerCardOvrShadowWidth} px`;
}
function renderSimplePhotoStage(photo){
  const stage = $('photoStageContent');
  if(!stage) return;
  stage.style.setProperty('--card-photo-content-top', `${photoContentTopForCardHeight()}px`);
  const name = $('playerName')?.value.trim() || 'Nome do jogador';
  const nickname = $('playerNick')?.value.trim() || name.split(' ')[0];
  const overall = $('playerOverall')?.value || '0';
  stage.innerHTML = photo
    ? `<img id="photoStageImage" src="${photo}" alt="Prévia da foto escolhida">`
    : '<p>Escolha uma foto para visualizar aqui.</p>';
  if(photo) stage.insertAdjacentHTML('beforeend', `<div class="photo-stage-ovr">${overall}<small>OVR</small></div><div class="photo-stage-nick">${nickname}</div><div class="photo-stage-name">${name}</div>`);
  renderMonthPhotoStage(photo);
}
function renderMonthPhotoStage(photo){
  const stage=$('monthPhotoStageContent');
  if(!stage) return;
  const nickname=$('playerNick')?.value.trim() || $('playerName')?.value.trim() || 'Jogador';
  stage.innerHTML=photo ? `<img id="monthPhotoStageImage" src="${photo}" alt="Prévia do mês encerrado"><div class="month-stage-title">${nickname}</div><div class="month-stage-stats">PONTUAÇÃO · GOLS · ASSIST.</div>` : '<p>A prévia do mês aparecerá aqui.</p>';
  updateMonthPhotoStageTransform();
}
function updateMonthPhotoStageTransform(){
  const stage=$('monthPhotoStageContent');
  const image=$('monthPhotoStageImage');
  if(!stage || !image) return;
  const zoom=(Number($('monthPhotoAdjustZoom').value)||100)/100;
  const x=Number($('monthPhotoAdjustX').value)||0;
  const y=Number($('monthPhotoAdjustY').value)||0;
  stage.style.setProperty('--month-preview-height', `${Number($('monthPhotoAdjustHeight').value)||330}px`);
  stage.style.setProperty('--month-preview-fade-start', `${Number($('monthPhotoAdjustFadeStart').value)||58}%`);
  stage.style.setProperty('--month-preview-fade', `${Number($('monthPhotoAdjustFadeEnd').value)||100}%`);
  stage.style.setProperty('--month-preview-shadow', `${(Number($('monthPhotoAdjustShadow').value)||86)/100}`);
  stage.style.setProperty('--month-preview-drop-shadow', `${(Number($('monthPhotoAdjustDropShadow').value)||42)/100}`);
  image.style.transform=`translate(calc(-50% + ${x}%),${y}%) scale(${zoom})`;
}
function updateSimplePhotoTransform(){
  const stage = $('photoStageContent');
  const extraHeight = Math.max(0,Math.min(160,Number($('photoAdjustHeight').value)||45));
  const fadeStart = Math.max(0,Math.min(100,Number($('photoAdjustFadeStart').value)||74));
  const fadeEnd = Math.max(0,Math.min(100,Number($('photoAdjustFadeEnd').value)||100));
  const dropShadow = Math.max(0,Math.min(100,Number($('photoAdjustDropShadow').value)||42))/100;
  if(stage){ stage.style.setProperty('--photo-extra-height', `${extraHeight}px`); stage.style.setProperty('--photo-fade-start', `${fadeStart}%`); stage.style.setProperty('--photo-fade-end', `${fadeEnd}%`); stage.style.setProperty('--photo-drop-shadow', `${dropShadow}`); }
  const image = $('photoStageImage');
  if(!image) return;
  const zoom = Number($('photoAdjustZoom').value)/100;
  const x = Number($('photoAdjustX').value)||0;
  const y = Number($('photoAdjustY').value)||0;
  image.style.transform = `translate(${x}%,${y}%) scale(${zoom})`;
  const circleImage = $('photoPreview');
  const circleZoom = Number($('photoCircleZoom').value)/100;
  const circleX = Number($('photoCircleX').value)||0;
  const circleY = Number($('photoCircleY').value)||0;
  if(circleImage) circleImage.style.transform = `translate(${circleX}%,${circleY}%) scale(${circleZoom})`;
}
$('photoAdjustZoom').addEventListener('input', updateSimplePhotoTransform);
$('photoAdjustX').addEventListener('input', updateSimplePhotoTransform);
$('photoAdjustY').addEventListener('input', updateSimplePhotoTransform);
$('photoAdjustHeight').addEventListener('input', updateSimplePhotoTransform);
$('photoAdjustFadeStart').addEventListener('input', updateSimplePhotoTransform);
$('photoAdjustFadeEnd').addEventListener('input', updateSimplePhotoTransform);
$('photoAdjustDropShadow').addEventListener('input', updateSimplePhotoTransform);
['monthPhotoAdjustZoom','monthPhotoAdjustX','monthPhotoAdjustY','monthPhotoAdjustHeight','monthPhotoAdjustFadeStart','monthPhotoAdjustFadeEnd','monthPhotoAdjustShadow','monthPhotoAdjustDropShadow'].forEach(id=>$(id).addEventListener('input',updateMonthPhotoStageTransform));
['playerName','playerNick','playerOverall'].forEach(id=>$(id).addEventListener('input',()=>renderSimplePhotoStage(editingPlayerPhoto)));
$('photoCircleZoom').addEventListener('input', updateSimplePhotoTransform);
$('photoCircleX').addEventListener('input', updateSimplePhotoTransform);
$('photoCircleY').addEventListener('input', updateSimplePhotoTransform);
function readPhotoPresetFields(fields){
  const preset = {};
  fields.forEach(id=> preset[id] = $(id).value);
  return preset;
}
function applyPhotoPresetFields(preset, fields){
  if(!preset) return;
  fields.forEach(id=>{ if(preset[id]!=null) $(id).value = preset[id]; });
}
$('btnSaveCardPhotoPreset').addEventListener('click', async ()=>{
  if(!requireAdmin()) return;
  savedCardPhotoPreset = readPhotoPresetFields(CARD_PHOTO_PRESET_FIELDS);
  await savePersonalization();
  showToast('Configuração do card salva! Agora dá pra carregá-la em qualquer jogador.');
});
$('btnLoadCardPhotoPreset').addEventListener('click', ()=>{
  if(!savedCardPhotoPreset){ showToast('Nenhuma configuração de card salva ainda.'); return; }
  applyPhotoPresetFields(savedCardPhotoPreset, CARD_PHOTO_PRESET_FIELDS);
  updateSimplePhotoTransform();
  showToast('Configuração do card carregada. Salve o jogador pra confirmar.');
});
$('btnSaveMonthPhotoPreset').addEventListener('click', async ()=>{
  if(!requireAdmin()) return;
  savedMonthPhotoPreset = readPhotoPresetFields(MONTH_PHOTO_PRESET_FIELDS);
  await savePersonalization();
  showToast('Configuração do mês encerrado salva! Agora dá pra carregá-la em qualquer jogador.');
});
$('btnLoadMonthPhotoPreset').addEventListener('click', ()=>{
  if(!savedMonthPhotoPreset){ showToast('Nenhuma configuração do mês encerrado salva ainda.'); return; }
  applyPhotoPresetFields(savedMonthPhotoPreset, MONTH_PHOTO_PRESET_FIELDS);
  updateMonthPhotoStageTransform();
  showToast('Configuração do mês encerrado carregada. Salve o jogador pra confirmar.');
});

$('playerPhoto').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const dataUrl = await resizePhoto(file);
  editingPlayerPhoto = dataUrl;
  hasPendingPlayerPhotoUpload = true;
  $('btnRemovePlayerPhoto').disabled = false;
  $('photoAdjustZoom').value = 100; $('photoAdjustX').value = 0; $('photoAdjustY').value = 0;
  $('photoAdjustHeight').value = 45; $('photoAdjustFadeStart').value = 74; $('photoAdjustFadeEnd').value = 100; $('photoAdjustDropShadow').value = 42;
  $('monthPhotoAdjustZoom').value = 100; $('monthPhotoAdjustX').value = 0; $('monthPhotoAdjustY').value = 0;
  $('monthPhotoAdjustHeight').value = 330; $('monthPhotoAdjustFadeStart').value = 58; $('monthPhotoAdjustFadeEnd').value = 100; $('monthPhotoAdjustDropShadow').value = 42; $('monthPhotoAdjustShadow').value = 86;
  $('photoCircleZoom').value = 100; $('photoCircleX').value = 0; $('photoCircleY').value = 0;
  $('photoPreview').src = dataUrl; $('photoPreviewCrop').style.display='block';
  $('photoFallback').style.display='none';
  renderSimplePhotoStage(dataUrl);
  updateSimplePhotoTransform();
});
$('btnRemovePlayerPhoto').addEventListener('click', ()=>{
  editingPlayerPhoto = null;
  hasPendingPlayerPhotoUpload = false;
  pendingPlayerPhotoPlayerId = null;
  $('btnRemovePlayerPhoto').disabled = true;
  $('playerPhoto').value = '';
  $('photoPreview').removeAttribute('src');
  $('photoPreviewCrop').style.display = 'none';
  $('photoFallback').style.display = 'flex';
  $('photoFallback').textContent = initials($('playerName').value.trim() || $('playerNick').value.trim() || '?');
  $('photoAdjustZoom').value = 100; $('photoAdjustX').value = 0; $('photoAdjustY').value = 0;
  $('photoAdjustHeight').value = 45; $('photoAdjustFadeStart').value = 74; $('photoAdjustFadeEnd').value = 100; $('photoAdjustDropShadow').value = 42;
  $('monthPhotoAdjustZoom').value = 100; $('monthPhotoAdjustX').value = 0; $('monthPhotoAdjustY').value = 0;
  $('monthPhotoAdjustHeight').value = 330; $('monthPhotoAdjustFadeStart').value = 58; $('monthPhotoAdjustFadeEnd').value = 100; $('monthPhotoAdjustDropShadow').value = 42; $('monthPhotoAdjustShadow').value = 86;
  $('photoCircleZoom').value = 100; $('photoCircleX').value = 0; $('photoCircleY').value = 0;
  renderSimplePhotoStage(null);
  showToast('Foto removida. Salve o jogador para confirmar.');
});

function updatePlayerAttributeGroups(){const role=$('playerRole').value,isGoalkeeper=role==='goalkeeper',isHybrid=role==='hybrid';$('lineAttributeGroup').style.display=isGoalkeeper?'none':'grid';$('goalkeeperAttributeGroup').style.display=isGoalkeeper||isHybrid?'grid':'none';$('lineOverallField').style.display=isGoalkeeper?'none':'block';$('goalkeeperOverallField').style.display=isGoalkeeper||isHybrid?'block':'none'}
function normalizeBoundedStatInput(input,finalize=false){const minimum=Number(input.dataset.statMin)||0;let value=String(input.value||'').replace(/\D/g,'').replace(/^0+(?=\d)/,'');if(value)value=String(Math.min(99,Math.max(minimum,Number(value))));else if(finalize)value=String(minimum);input.value=value;return value}
function openPlayerModal(player){
  editingPlayerPhoto = player ? player.photo : null;
  hasPendingPlayerPhotoUpload = false;
  pendingPlayerPhotoPlayerId = null;
  $('photoAdjustZoom').value = Math.round((Number(player?.photoScale)||1)*100); $('photoAdjustX').value = Number(player?.photoX)||0; $('photoAdjustY').value = Number(player?.photoY)||0;
  $('photoAdjustHeight').value = Number(player?.photoExtraHeight ?? 45); $('photoAdjustFadeStart').value = Number(player?.photoFadeStart ?? 74); $('photoAdjustFadeEnd').value = Number(player?.photoFadeEnd ?? 100); $('photoAdjustDropShadow').value = Number(player?.photoDropShadow ?? 42);
  $('monthPhotoAdjustZoom').value = Math.round((Number(player?.monthPhotoScale ?? player?.photoScale)||1)*100); $('monthPhotoAdjustX').value = Number(player?.monthPhotoX ?? player?.photoX)||0; $('monthPhotoAdjustY').value = Number(player?.monthPhotoY ?? player?.photoY)||0;
  $('monthPhotoAdjustHeight').value = Number(player?.monthPhotoHeight)||330; $('monthPhotoAdjustFadeStart').value = Number(player?.monthPhotoFadeStart ?? 58); $('monthPhotoAdjustFadeEnd').value = Number(player?.monthPhotoFadeEnd ?? player?.photoFadeEnd ?? 100); $('monthPhotoAdjustDropShadow').value = Number(player?.monthPhotoDropShadow ?? 42); $('monthPhotoAdjustShadow').value = Number(player?.monthPhotoShadow ?? 86);
  $('photoCircleZoom').value = Math.round((Number(player?.photoCircleScale)||1)*100); $('photoCircleX').value = Number(player?.photoCircleX)||0; $('photoCircleY').value = Number(player?.photoCircleY)||0;
  $('playerId').value = player ? player.id : '';
  $('playerName').value = player ? player.name : '';
  $('playerNick').value = player ? player.nickname : '';
  $('playerRole').value = player ? (player.role||'normal') : 'normal';
  $('playerCaptain').checked = !!player?.isCaptain;
  $('playerTeamStars').value = String(Math.max(.5,Math.min(5,Math.round((Number(player?.teamStars)||3)*2)/2)));
  $('playerTeamManualOvr').value = Math.max(1,Math.min(99,Math.round(Number(player?.teamManualOvr)||(player?basePlayerOverall(player):50))));
  PLAYER_ATTRIBUTE_KEYS.forEach(key=>{ const id = 'attr'+key[0].toUpperCase()+key.slice(1); $(id).value = player ? (Number(player[key])||0) : 0; });
  GOALKEEPER_ATTRIBUTE_KEYS.forEach(key=>{const id='attr'+key[0].toUpperCase()+key.slice(1);$(id).value=player?(Number(player[key])||0):0});
  const refreshOverall = ()=>{
    const inputAverage=(keys,weights)=>keys.reduce((sum,key)=>sum+(Number($('attr'+key[0].toUpperCase()+key.slice(1)).value)||0)*weights[key],0)/keys.reduce((sum,key)=>sum+weights[key],0),role=$('playerRole').value,line=inputAverage(PLAYER_ATTRIBUTE_KEYS,PLAYER_ATTRIBUTE_WEIGHTS),goalkeeper=inputAverage(GOALKEEPER_ATTRIBUTE_KEYS,GOALKEEPER_ATTRIBUTE_WEIGHTS);
    $('playerOverall').value = formatOverall(line);
    $('playerGoalkeeperOverall').value = formatOverall(goalkeeper);
  };
  updatePlayerAttributeGroups();
  refreshOverall();
  PLAYER_ATTRIBUTE_KEYS.forEach(key=>{const input=$('attr'+key[0].toUpperCase()+key.slice(1));input.oninput=()=>{normalizeBoundedStatInput(input);refreshOverall()}});
  GOALKEEPER_ATTRIBUTE_KEYS.forEach(key=>{const input=$('attr'+key[0].toUpperCase()+key.slice(1));input.oninput=()=>{normalizeBoundedStatInput(input);refreshOverall()}});
  $('playerTeamManualOvr').oninput=()=>normalizeBoundedStatInput($('playerTeamManualOvr'));
  $('playerRole').onchange=()=>{updatePlayerAttributeGroups();refreshOverall()};
  $('playerPhoto').value = '';
  $('playerModalTitle').textContent = player ? 'Editar jogador' : 'Novo jogador';
  $('btnDeletePlayer').style.display = player ? 'inline-block' : 'none';
  if(player && player.photo){
    $('photoPreview').src = player.photo; $('photoPreviewCrop').style.display='block'; $('photoFallback').style.display='none';
  } else {
    $('photoPreviewCrop').style.display='none'; $('photoFallback').style.display='flex';
    $('photoFallback').textContent = player ? initials(player.name) : '?';
  }
  $('btnRemovePlayerPhoto').disabled = !editingPlayerPhoto;
  renderSimplePhotoStage(editingPlayerPhoto);
  updateSimplePhotoTransform();
  $('playerOverlay').classList.add('active');
}
$('btnAddPlayer').addEventListener('click', ()=> openPlayerModal(null));
$('elencoCardHeight').addEventListener('input', e=>{
  const value = Math.max(320,Math.min(680,Number(e.target.value)||440));
  playerCardHeight = value;
  applyPlayerCardHeight(value);
});
function bindCardAppearanceRange(id, apply){
  $(id).addEventListener('input', e=>{ apply(e.target.value); applyPlayerCardHeight(playerCardHeight); });
}
bindCardAppearanceRange('elencoBottomShadowReach', value=> playerCardBottomShadowReach=Math.max(0,Math.min(100,Number(value)||0)));
bindCardAppearanceRange('elencoOvrShadowReach', value=> playerCardOvrShadowReach=Math.max(45,Math.min(100,Number(value)||100)));
bindCardAppearanceRange('elencoOvrShadowWidth', value=> playerCardOvrShadowWidth=Math.max(45,Math.min(220,Number(value)||80)));
$('btnSaveCardAppearance').addEventListener('click', async ()=>{
  await savePersonalization();
  savedPlayerCardAppearance = {height:playerCardHeight,bottomShadowReach:playerCardBottomShadowReach,ovrShadowReach:playerCardOvrShadowReach,ovrShadowWidth:playerCardOvrShadowWidth};
  showToast('Aparência dos cards salva para todo o elenco.');
});
$('btnDiscardCardAppearance').addEventListener('click', ()=>{
  playerCardHeight=savedPlayerCardAppearance.height;
  playerCardBottomShadowReach=savedPlayerCardAppearance.bottomShadowReach;
  playerCardOvrShadowReach=savedPlayerCardAppearance.ovrShadowReach;
  playerCardOvrShadowWidth=savedPlayerCardAppearance.ovrShadowWidth;
  applyPlayerCardHeight(playerCardHeight);
  showToast('Alterações visuais descartadas.');
});
$('btnCancelPlayer').addEventListener('click', ()=> $('playerOverlay').classList.remove('active'));
$('btnSavePlayer').addEventListener('click', async ()=>{
  const name = $('playerName').value.trim();
  const nickname = $('playerNick').value.trim() || name.split(' ')[0];
  if(!name){ showToast('Digite o nome do jogador.'); return; }
  const id = $('playerId').value;
  const attributes = {};
  PLAYER_ATTRIBUTE_KEYS.forEach(key=> attributes[key] = Math.max(0, Math.min(99, Math.round(Number($('attr'+key[0].toUpperCase()+key.slice(1)).value)||0))));
  GOALKEEPER_ATTRIBUTE_KEYS.forEach(key=> attributes[key] = Math.max(0, Math.min(99, Math.round(Number($('attr'+key[0].toUpperCase()+key.slice(1)).value)||0))));
  const role = $('playerRole').value;
  const isCaptain = $('playerCaptain').checked;
  const teamStars = Math.max(.5,Math.min(5,Math.round((Number($('playerTeamStars').value)||3)*2)/2));
  const teamManualOvr = Math.max(1,Math.min(99,Math.round(Number($('playerTeamManualOvr').value)||50)));
  const photoAdjustment = readCardPhotoAdjustment();
  let savedPlayerId=id;
  if(id){
    const p = players.find(p=>p.id===id);
    const oldPhotoPath=normalizeSupabaseMediaPath(p?.photoStoragePath || p?.photo || '');
    const removingPhoto=!editingPlayerPhoto && !!oldPhotoPath;
    Object.assign(p, {name, nickname, photo:editingPlayerPhoto, role, isCaptain, teamStars, teamManualOvr, ...photoAdjustment, ...attributes});
    if(removingPhoto){
      p._photoCleanupPath=oldPhotoPath;
      p.photoStoragePath='';
      p.photoStorageProvider='';
      p.photoVersion=Date.now();
      delete p.photoLocalFallback;
    }
  } else {
    savedPlayerId=uid();
    players.push({ id:savedPlayerId, name, nickname, photo: editingPlayerPhoto, role, isCaptain, teamStars, teamManualOvr, ...photoAdjustment, ...attributes });
  }
  if(hasPendingPlayerPhotoUpload) pendingPlayerPhotoPlayerId=savedPlayerId;
  const saved=await savePlayers();
  if(saved===false) return;
  $('playerOverlay').classList.remove('active');
  renderAll();
  showToast('Jogador salvo. Foto sincronizada entre os dispositivos.');
});
$('btnDeletePlayer').addEventListener('click', async ()=>{
  const id = $('playerId').value;
  const ok = await askConfirm('Remover este jogador? O histórico de rodadas dele será mantido, mas ele some do elenco.');
  if(!ok) return;
  const playerToDelete=players.find(p=>p.id===id);
  const oldPhotoPath=normalizeSupabaseMediaPath(playerToDelete?.photoStoragePath || playerToDelete?.photo || '');
  players = players.filter(p=>p.id!==id);
  const saved=await savePlayers();
  if(saved===false) return;
  if(oldPhotoPath) deleteSupabaseMediaObjectBestEffort(oldPhotoPath,`foto do jogador removido ${playerToDelete?.nickname||playerToDelete?.name||id}`);
  $('playerOverlay').classList.remove('active');
  renderAll();
  showToast('Jogador removido.');
});

document.addEventListener('input', event=>{
  const input = event.target;
  if(input.matches('[data-stat-min]')){normalizeBoundedStatInput(input);return}
  if(!input.matches('.entry-row .in-goals, .entry-row .in-assists, .entry-row .in-rating')) return;
  const value = input.value;
  if(!value || /^0\.$/.test(value) || /^0\.\d/.test(value)) return;
  if(/^0+\d/.test(value)) input.value = value.replace(/^0+(?=\d)/, '');
  if(input.classList.contains('in-rating') && Number(input.value)>10) input.value='10';
  if(Number(input.value)<0) input.value='0';
});
document.addEventListener('focusout', event=>{
  const input=event.target;
  if(input.matches('[data-stat-min]')){normalizeBoundedStatInput(input,true);return}
  if(input.matches('.entry-row .in-goals, .entry-row .in-assists, .entry-row .in-rating') && input.value==='') input.value='0';
});

function statValue(t, mode){
  const tt = t || {goals:0, assists:0, ratingSum:0, ratingCount:0, games:0};
  switch(mode){
    case 'goals': return tt.goals||0;
    case 'assists': return tt.assists||0;
    case 'ga': return (tt.goals||0)+(tt.assists||0);
    case 'score': return computeMvpScore(tt);
    case 'rating': return tt.ratingCount ? tt.ratingSum/tt.ratingCount : 0;
    case 'absences': return tt.absences||0;
    default: return 0;
  }
}
const PLAYER_ATTRIBUTE_SORTS = [
  {key:'overall', label:'OVR'},
  {key:'velocidade', label:'Velocidade'},
  {key:'chute', label:'Finalização'},
  {key:'passe', label:'Passe'},
  {key:'drible', label:'Drible'},
  {key:'marcacao', label:'Marcação'},
  {key:'contato', label:'Físico'},
];
function playerSortValue(player, totals, mode){
  if(mode==='overall') return playerOverall(player);
  if(PLAYER_ATTRIBUTE_KEYS.includes(mode)) return effectivePlayerAttributes(player)[mode] || 0;
  return statValue(totals?.[player.id], mode);
}
function sortPlayersByMode(list, totals, mode, dir){
  const modes = Array.isArray(mode) ? mode : [mode];
  const sorted = [...list].sort((a,b)=>{
    for(const currentMode of modes){
      const cmp = currentMode==='alpha'
        ? a.nickname.localeCompare(b.nickname, 'pt-BR')
        : playerSortValue(a, totals, currentMode) - playerSortValue(b, totals, currentMode);
      if(cmp) return dir==='desc' ? -cmp : cmp;
    }
    return a.nickname.localeCompare(b.nickname, 'pt-BR');
  });
  return sorted;
}

function renderSortBar(container, opts){
  if(!container) return;
  const dirLabel = opts.dir==='asc' ? '↑ Crescente' : '↓ Decrescente';
  const criteria = opts.criteria||[];
  const groups = opts.groups || [
    {label:'Ordem alfabética', keys:['alpha']},
    {label:'Atributos', keys:criteria.filter(c=>PLAYER_ATTRIBUTE_KEYS.includes(c.key)||c.key==='overall').map(c=>c.key)},
    {label:'Estatísticas', keys:criteria.filter(c=>!['alpha','overall',...PLAYER_ATTRIBUTE_KEYS].includes(c.key)).map(c=>c.key)},
  ].filter(group=>group.keys.length);
  const byKey = new Map(criteria.map(c=>[c.key,c]));
  const groupsHtml = groups.map(group=>{
    const keys=group.keys.filter(key=>byKey.has(key));
    return `<div class="sort-filter-group"><span class="sort-filter-title">${group.label}</span>${keys.map(key=>{ const c=byKey.get(key); return `<button type="button" class="sort-chip${opts.mode===key?' active':''}" data-mode="${key}">${c.label}</button>`; }).join('')}</div>`;
  }).join('');
  container.innerHTML = `<div class="sort-bar">
    ${opts.label ? `<span class="sort-bar-label">${opts.label}</span>` : ''}
    <details class="sort-filter-panel"><summary>Filtros de ordenação: ${criteria.find(c=>c.key===opts.mode)?.label || 'Alfabética'}</summary><div class="sort-filter-panel-body">${groupsHtml}</div></details>
    <button type="button" class="sort-dir-btn">${dirLabel}</button>
  </div>`;
  container.querySelectorAll('.sort-chip').forEach(btn=>{
    btn.addEventListener('click', ()=> opts.onModeChange(btn.dataset.mode));
  });
  const dirBtn = container.querySelector('.sort-dir-btn');
  if(dirBtn) dirBtn.addEventListener('click', opts.onDirChange);
}

let playerSortMode = 'alpha';
let playerSortDir = 'asc';
function renderPlayerSortBar(){
  renderSortBar($('playerSortBar'), {
    label: 'Ordenar:',
    criteria: [
      {key:'alpha', label:'Alfabética'},
      {key:'goals', label:'Gols'},
      {key:'assists', label:'Assistências'},
      {key:'ga', label:'G/A'},
      {key:'score', label:'Pontuação'},
      {key:'rating', label:'Nota média'},
      {key:'absences', label:'Faltas'},
      ...PLAYER_ATTRIBUTE_SORTS,
    ],
    mode: playerSortMode,
    dir: playerSortDir,
    onModeChange: (mode)=>{
      playerSortMode = mode;
      playerSortDir = mode==='alpha' ? 'asc' : 'desc';
      renderPlayerGrid();
    },
    onDirChange: ()=>{
      playerSortDir = playerSortDir==='asc' ? 'desc' : 'asc';
      renderPlayerGrid();
    }
  });
}
const BONUS_RULE_GROUPS_V2 = [
  {title:'Troféus conquistados',rows:[
    {label:'MVP',values:[['regularMvpAll','Todos']]},
    {label:'Artilheiro',values:[['regularArtMain','FIN / VEL'],['regularArtSecondary','Demais']]},
    {label:'Garçom',values:[['regularGarMain','PAS / DRI'],['regularGarSecondary','Demais']]},
    {label:'MVP + Artilheiro',values:[['regularMvpArtAll','Todos'],['regularMvpArtMain','FIN / VEL'],['regularMvpArtSecondary','Demais']]},
    {label:'MVP + Garçom',values:[['regularMvpGarAll','Todos'],['regularMvpGarMain','PAS / DRI'],['regularMvpGarSecondary','Demais']]},
    {label:'Artilheiro + Garçom',values:[['regularArtGarMain','FIN / VEL / PAS / DRI'],['regularArtGarSecondary','DEF / FÍS']]},
  ]},
  {title:'Troféus especiais',rows:[
    {label:'COSMIC',values:[['cosmic','Todos (exclusivo)']]},
    {label:'Prismático isolado',values:[['prismaticSolo','Todos']]},
    {label:'Prismático + MVP',values:[['prismaticMvpAll','Todos']]},
    {label:'Prismático + Artilheiro',values:[['prismaticArtMain','FIN / VEL'],['prismaticArtSecondary','Demais']]},
    {label:'Prismático + Garçom',values:[['prismaticGarMain','PAS / DRI'],['prismaticGarSecondary','Demais']]},
    {label:'Prismático + MVP + Artilheiro',values:[['prismaticMvpArtAll','Todos'],['prismaticMvpArtMain','FIN / VEL'],['prismaticMvpArtSecondary','Demais']]},
    {label:'Prismático + MVP + Garçom',values:[['prismaticMvpGarAll','Todos'],['prismaticMvpGarMain','PAS / DRI'],['prismaticMvpGarSecondary','Demais']]},
    {label:'Prismático + Artilheiro + Garçom',values:[['prismaticArtGarMain','FIN / VEL / PAS / DRI'],['prismaticArtGarSecondary','DEF / FÍS']]},
    {label:'Prismático + GOAT',values:[['prismaticGoatAll','Todos']]},
    {label:'GOAT',values:[['goatAll','Todos']]},
    {label:'Colecionador isolado',values:[['collectorSoloAll','Todos']]},
    {label:'Colecionador + MVP',values:[['collectorMvpAll','Todos']]},
    {label:'Colecionador + Artilheiro',values:[['collectorArtAll','Todos'],['collectorArtMain','FIN / VEL'],['collectorArtSecondary','Demais']]},
    {label:'Colecionador + Garçom',values:[['collectorGarAll','Todos'],['collectorGarMain','PAS / DRI'],['collectorGarSecondary','Demais']]},
    {label:'Colecionador + MVP + Artilheiro',values:[['collectorMvpArtAll','Todos'],['collectorMvpArtMain','FIN / VEL']]},
    {label:'Colecionador + MVP + Garçom',values:[['collectorMvpGarAll','Todos'],['collectorMvpGarMain','PAS / DRI']]},
    {label:'Colecionador + Artilheiro + Garçom',values:[['collectorArtGarAll','Todos'],['collectorArtGarMain','FIN / VEL / PAS / DRI']]},
    {label:'Colecionador + GOAT',values:[['collectorGoatAll','Todos']]},
    {label:'Prismático + Colecionador',values:[['prismaticCollectorSoloAll','Todos']]},
    {label:'Prismático + Colecionador + MVP',values:[['prismaticCollectorMvpAll','Todos']]},
    {label:'Prismático + Colecionador + Artilheiro',values:[['prismaticCollectorArtAll','Todos'],['prismaticCollectorArtMain','FIN / VEL'],['prismaticCollectorArtSecondary','Demais']]},
    {label:'Prismático + Colecionador + Garçom',values:[['prismaticCollectorGarAll','Todos'],['prismaticCollectorGarMain','PAS / DRI'],['prismaticCollectorGarSecondary','Demais']]},
    {label:'Prismático + Colecionador + MVP + Artilheiro',values:[['prismaticCollectorMvpArtAll','Todos'],['prismaticCollectorMvpArtMain','FIN / VEL']]},
    {label:'Prismático + Colecionador + MVP + Garçom',values:[['prismaticCollectorMvpGarAll','Todos'],['prismaticCollectorMvpGarMain','PAS / DRI']]},
    {label:'Prismático + Colecionador + Artilheiro + Garçom',values:[['prismaticCollectorArtGarAll','Todos'],['prismaticCollectorArtGarMain','FIN / VEL / PAS / DRI']]},
    {label:'Prismático + GOAT + Colecionador',values:[['prismaticCollectorGoatAll','Todos']]},
  ]},
  {title:'Troféus em andamento',rows:[
    {label:'MVP atual',values:[['currentMvpAll','Todos']]},
    {label:'Artilheiro atual',values:[['currentArtMain','FIN / VEL'],['currentArtSecondary','Demais']]},
    {label:'Garçom atual',values:[['currentGarMain','PAS / DRI'],['currentGarSecondary','Demais']]},
    {label:'MVP + Artilheiro atuais',values:[['currentMvpArtAll','Todos'],['currentMvpArtMain','FIN / VEL'],['currentMvpArtSecondary','Demais']]},
    {label:'MVP + Garçom atuais',values:[['currentMvpGarAll','Todos'],['currentMvpGarMain','PAS / DRI'],['currentMvpGarSecondary','Demais']]},
    {label:'Artilheiro + Garçom atuais',values:[['currentArtGarMain','FIN / VEL / PAS / DRI'],['currentArtGarSecondary','DEF / FÍS']]},
    {label:'GOAT em andamento',values:[['currentGoatAll','Todos']]},
  ]},
];
function renderBonusRulesPanel(){
  const panel=$('bonusRulesPanel');
  if(!panel) return;
  let draftRules={...bonusRules};
  const safeValue=(rules,key)=>Math.max(0,Math.min(99,Number(rules[key] ?? DEFAULT_BONUS_RULES[key])||0));
  const bonusValue=(key,label)=>isAdmin
    ? '<label class="bonus-rule-value"><small>'+label+'</small><input type="number" min="0" max="99" step="1" data-bonus-rule="'+key+'" value="'+safeValue(draftRules,key)+'" aria-label="'+label+'"></label>'
    : '<strong><small>'+label+'</small>+'+safeValue(draftRules,key)+'</strong>';
  const medalOptions=(allowNone=true)=>`${allowNone?'<option value="">Nenhum</option>':''}${PODIUM_MEDALS.map(m=>'<option value="'+m+'">'+PODIUM_MEDAL_LABEL[m]+'</option>').join('')}`;
  const medalIcon={gold:'🥇',silver:'🥈',bronze:'🥉'};
  const comboVisualHtml=(title,combo,fields,specials=[])=>{
    const medalChips=PODIUM_TYPES.filter(type=>combo&&combo[type]).map(type=>'<span class="bonus-medal-chip medal-'+combo[type]+'">'+medalIcon[combo[type]]+' '+PODIUM_TYPE_LABEL[type]+' '+PODIUM_MEDAL_LABEL[combo[type]]+'</span>').join('');
    const specialChips=specials.map(item=>'<span class="bonus-special-chip '+item.kind+'">'+item.icon+' '+item.label+'</span>').join('');
    const effects=fields.map(value=>'<div class="bonus-effect-card"><small>'+value[1]+'</small><b>+'+safeValue(draftRules,value[0])+'</b><span>atributos</span></div>').join('');
    return '<div class="bonus-visual-title">'+title+'</div><div class="bonus-medal-chips">'+specialChips+medalChips+'</div><div class="bonus-effect-grid">'+effects+'</div><div class="bonus-public-note">Uma medalha por categoria. Combinações conflitantes são bloqueadas automaticamente.</div>';
  };
  const podiumCalculatedVisual=(combo,title=podiumComboLabel(combo),scope='closed')=>{
    const medalChips=PODIUM_TYPES.filter(type=>combo&&combo[type]).map(type=>'<span class="bonus-medal-chip medal-'+combo[type]+'">'+medalIcon[combo[type]]+' '+PODIUM_TYPE_LABEL[type]+' '+PODIUM_MEDAL_LABEL[combo[type]]+'</span>').join('');
    const b=computePodiumComboBoost(combo,scope==='current'?'current':'closed');
    const short={chute:'CHU',passe:'PAS',contato:'FÍS',drible:'DRI',marcacao:'DEF',velocidade:'VEL'};
    const effects=PLAYER_ATTRIBUTE_KEYS.map(k=>'<div class="bonus-effect-card"><small>'+short[k]+'</small><b>+'+b[k]+'</b><span>bônus</span></div>').join('');
    return '<div class="bonus-visual-title">'+title+'</div><div class="bonus-medal-chips">'+medalChips+'</div><div class="bonus-effect-grid">'+effects+'</div><div class="bonus-public-note">Conquistado e andamento se somam. Teto pela patente oficial: sem patente/bronze +12, prata +16, ouro +17, Prismática +18, GOAT +19 e Colecionador +20.</div>';
  };
  const visitorComboExplorer=(title,scope)=>'<div class="bonus-public-explorer" data-visitor-combo="'+scope+'"><div class="bonus-public-explorer-head"><b>'+title+'</b><small>Selecione até uma medalha por categoria para visualizar a combinação.</small></div><div class="bonus-combo-selects">'+PODIUM_TYPES.map(type=>'<label>'+PODIUM_TYPE_LABEL[type]+'<select data-visitor-medal="'+type+'">'+medalOptions(true)+'</select></label>').join('')+'</div><div class="bonus-public-result is-empty" data-visitor-preview>Escolha pelo menos uma taça para visualizar os bônus.</div></div>';
  const comboEditor=(scope,primaryType,primaryMedal)=>{
    const editorId=`${scope}-${primaryType}-${primaryMedal}`;
    const combo={mvp:null,artilheiro:null,garcom:null}; combo[primaryType]=primaryMedal;
    const extraTypes=primaryType==='mvp'?['artilheiro','garcom']:(primaryType==='artilheiro'?['garcom']:['artilheiro']);
    const selects=extraTypes.map(type=>'<label>'+PODIUM_TYPE_LABEL[type]+'<select data-combo-select="'+type+'" data-editor="'+editorId+'">'+medalOptions(true)+'</select></label>').join('');
    return '<details class="bonus-rule-trophy" data-combo-editor="'+editorId+'" data-scope="'+scope+'" data-primary-type="'+primaryType+'" data-primary-medal="'+primaryMedal+'"><summary><span><b>'+PODIUM_TYPE_LABEL[primaryType]+' '+PODIUM_MEDAL_LABEL[primaryMedal]+'</b><small>Clique para montar combinações compatíveis</small></span><strong>+</strong></summary><div class="bonus-combo-builder">'+(selects?'<div class="bonus-combo-selects">'+selects+'</div>':'')+'<div class="bonus-combo-preview" data-combo-preview></div><div class="bonus-combo-help">Cada categoria aceita somente uma medalha. A medalha principal fica bloqueada, evitando combinações sem sentido como MVP Ouro + MVP Prata.</div></div></details>';
  };
  const compactPodiumGroup=(title,scope)=>{
    const mvp=PODIUM_MEDALS.map(m=>comboEditor(scope,'mvp',m)).join('');
    const art=PODIUM_MEDALS.map(m=>comboEditor(scope,'artilheiro',m)).join('');
    const gar=PODIUM_MEDALS.map(m=>comboEditor(scope,'garcom',m)).join('');
    return '<div class="bonus-rule-group"><div class="bonus-rule-group-title">'+title+'</div><details class="bonus-rule-trophy"><summary><span><b>MVP</b><small>Combina com Artilheiro e Garçom</small></span><strong>+</strong></summary><div class="bonus-rule-expanded">'+mvp+'</div></details><details class="bonus-rule-trophy"><summary><span><b>Artilheiro</b><small>Combina com Garçom quando não houver MVP</small></span><strong>+</strong></summary><div class="bonus-rule-expanded">'+art+'</div></details><details class="bonus-rule-trophy"><summary><span><b>Garçom</b><small>Conquistas isoladas sem duplicação</small></span><strong>+</strong></summary><div class="bonus-rule-expanded">'+gar+'</div></details></div>';
  };
  const podiumHtml=isAdmin
    ? compactPodiumGroup('Troféus conquistados','regular')+compactPodiumGroup('Troféus em andamento','current')
    : visitorComboExplorer('Troféus conquistados','closed')+visitorComboExplorer('Troféus em andamento','current');
  const specialComboCard=(kind,label,icon,help)=>'<details class="bonus-rule-trophy" data-special-kind="'+kind+'"><summary><span><b>'+icon+' '+label+'</b><small>'+help+'</small></span><strong>+</strong></summary><div class="bonus-combo-builder"><div class="bonus-combo-section-label">Taças conquistadas</div><div class="bonus-combo-selects">'+PODIUM_TYPES.map(type=>'<label>'+PODIUM_TYPE_LABEL[type]+'<select data-special-medal="'+type+'">'+medalOptions(true)+'</select></label>').join('')+'</div><div class="bonus-combo-preview" data-special-combo-preview></div><div class="bonus-combo-help">Você pode selecionar nenhuma, uma, duas ou as três taças. Cada categoria aceita apenas uma medalha, então não é possível escolher Artilheiro Ouro e Artilheiro Prata ao mesmo tempo.</div></div></details>';
  const exclusiveSpecialCard=(kind,label,icon,ruleKey,help)=>'<details class="bonus-rule-trophy" data-exclusive-special="'+kind+'"><summary><span><b>'+icon+' '+label+'</b><small>'+help+'</small></span><strong>+</strong></summary><div class="bonus-rule-expanded">'+(isAdmin?'<div class="bonus-combo-preview-title">'+label+' exclusivo</div><div class="bonus-rule-values">'+bonusValue(ruleKey,'Todos')+'</div>':'<div class="bonus-public-result">'+comboVisualHtml(label+' exclusivo',{mvp:null,artilheiro:null,garcom:null},[[ruleKey,'Todos']],[{kind:kind,icon:icon,label:label}])+'</div>')+'<div class="bonus-combo-help">Esta conquista é exclusiva e não aceita combinações adicionais nesta configuração.</div></div></details>';
  const goatSpecialCard=()=>'<details class="bonus-rule-trophy" data-goat-special><summary><span><b>🐐 GOAT</b><small>Tríplice coroa, com Prismático e/ou Colecionador opcionais</small></span><strong>+</strong></summary><div class="bonus-combo-builder"><div class="bonus-combo-section-label">Conquistas especiais adicionais</div><div class="bonus-special-checks"><label><input type="checkbox" data-goat-addon="prismatic"> 💎 Prismático</label><label><input type="checkbox" data-goat-addon="collector"> 💠 Colecionador</label></div><div class="bonus-combo-preview" data-goat-combo-preview></div><div class="bonus-combo-help">GOAT já representa MVP + Artilheiro + Garçom. Por isso, aqui você escolhe apenas se a conquista também foi Prismática, Colecionador ou as duas ao mesmo tempo.</div></div></details>';
  const specialHtml='<div class="bonus-rule-group"><div class="bonus-rule-group-title">Troféus especiais</div>'+exclusiveSpecialCard('cosmic','COSMIC','🌌','cosmic','Conquista única de Mês Perfeito')+goatSpecialCard()+specialComboCard('prismatic','Prismático','💎','Combina com MVP, Artilheiro e Garçom')+specialComboCard('collector','Colecionador','💠','Combina com MVP, Artilheiro e Garçom')+'</div>';
  const actions=isAdmin?'<div class="bonus-rules-actions"><button type="button" class="btn btn-primary btn-sm" id="btnSaveBonusRules">Aplicar e salvar</button><button type="button" class="btn btn-ghost btn-sm" id="btnSaveBonusPreset">Salvar configuração</button><button type="button" class="btn btn-ghost btn-sm" id="btnLoadBonusPreset">Carregar configuração</button><button type="button" class="btn btn-ghost btn-sm" id="btnDiscardBonusChanges">Descartar alterações</button><button type="button" class="btn btn-danger btn-sm" id="btnResetBonusRules">Restaurar padrão</button></div>':'';
  panel.innerHTML='<details class="bonus-rules-details"><summary><span class="record-count-badge tier-gold">⚙️ Bônus e patentes</span><span class="records-toggle-label">Como funcionam os atributos · abrir</span></summary><div class="bonus-rules-body">'+(isAdmin?'<div class="round-summary">Ouro, Prata e Bronze usam valores fixos por categoria. Andamento e conquistado ficam separados e nunca somam entre si. O teto normal é +12 por atributo. A Tríplice Ouro em andamento vale GOAT em andamento (+12); quando conquistada, vira GOAT oficial (+15). Prismático isolado vale +4. Com qualquer outra conquista de pódio, inclusive Bronze ou Prata, acrescenta somente +2 ao bônus dela. GOAT + Prismático = +17; GOAT + Prismático + Colecionador = +19, que é o teto absoluto.</div>':'<div class="bonus-public-intro"><b>Modo de consulta.</b> Você pode explorar todas as combinações possíveis. O andamento usa valores menores que o conquistado e os dois estados nunca são somados. O teto normal é +12. Tríplice Ouro em andamento vale +12; conquistada vira GOAT +15. Prismático isolado vale +4. Com qualquer outra conquista de pódio acrescenta só +2. GOAT + Prismático = +17; GOAT + Prismático + Colecionador = +19.</div>')+podiumHtml+specialHtml+actions+'</div></details>';

  const currentComboFromEditor=(editor)=>{
    const combo={mvp:null,artilheiro:null,garcom:null};
    combo[editor.dataset.primaryType]=editor.dataset.primaryMedal;
    editor.querySelectorAll('[data-combo-select]').forEach(select=>combo[select.dataset.comboSelect]=select.value||null);
    return combo;
  };
  const renderComboPreview=(editor)=>{
    const combo=currentComboFromEditor(editor);
    const preview=editor.querySelector('[data-combo-preview]');
    preview.innerHTML=podiumCalculatedVisual(combo,podiumComboLabel(combo),editor.dataset.scope==='current'?'current':'closed');
  };
  panel.querySelectorAll('[data-combo-editor]').forEach(editor=>{
    renderComboPreview(editor);
    editor.querySelectorAll('[data-combo-select]').forEach(select=>select.addEventListener('change',()=>renderComboPreview(editor)));
  });
  const renderVisitorCombo=(editor)=>{
    const combo={mvp:null,artilheiro:null,garcom:null};
    editor.querySelectorAll('[data-visitor-medal]').forEach(select=>combo[select.dataset.visitorMedal]=select.value||null);
    const preview=editor.querySelector('[data-visitor-preview]');
    if(!PODIUM_TYPES.some(type=>combo[type])){
      preview.className='bonus-public-result is-empty';
      preview.innerHTML='Escolha pelo menos uma taça para visualizar os bônus.';
      return;
    }
    preview.className='bonus-public-result';
    preview.innerHTML=podiumCalculatedVisual(combo,podiumComboLabel(combo),editor.dataset.visitorCombo==='current'?'current':'closed');
  };
  panel.querySelectorAll('[data-visitor-combo]').forEach(editor=>{
    editor.querySelectorAll('[data-visitor-medal]').forEach(select=>select.addEventListener('change',()=>renderVisitorCombo(editor)));
    renderVisitorCombo(editor);
  });
  const specialFieldsFor=(kind,combo)=>{
    const hasMvp=!!combo.mvp, hasArt=!!combo.artilheiro, hasGar=!!combo.garcom;
    const suffix=hasMvp&&hasArt&&hasGar?'MvpArtGar':hasMvp&&hasArt?'MvpArt':hasMvp&&hasGar?'MvpGar':hasArt&&hasGar?'ArtGar':hasMvp?'Mvp':hasArt?'Art':hasGar?'Gar':'Solo';
    if(kind==='collector'){
      const base='collector'+suffix;
      if(suffix==='MvpArtGar') return [[base+'All','Todos']];
      if(suffix==='Art') return [[base+'All','Todos'],[base+'Main','FIN / VEL'],[base+'Secondary','Demais']];
      if(suffix==='Gar') return [[base+'All','Todos'],[base+'Main','PAS / DRI'],[base+'Secondary','Demais']];
      if(suffix==='MvpArt') return [[base+'All','Todos'],[base+'Main','FIN / VEL']];
      if(suffix==='MvpGar') return [[base+'All','Todos'],[base+'Main','PAS / DRI']];
      if(suffix==='ArtGar') return [[base+'All','Todos'],[base+'Main','FIN / VEL / PAS / DRI']];
      return [[base+'All','Todos']];
    }
    if(suffix==='MvpArtGar') return [['prismaticMvpArtGarAll','Todos']];
    if(suffix==='Solo') return [['prismaticSolo','Todos']];
    if(suffix==='Mvp') return [['prismaticMvpAll','Todos']];
    if(suffix==='Art') return [['prismaticArtMain','FIN / VEL'],['prismaticArtSecondary','Demais']];
    if(suffix==='Gar') return [['prismaticGarMain','PAS / DRI'],['prismaticGarSecondary','Demais']];
    if(suffix==='MvpArt') return [['prismaticMvpArtAll','Todos'],['prismaticMvpArtMain','FIN / VEL'],['prismaticMvpArtSecondary','Demais']];
    if(suffix==='MvpGar') return [['prismaticMvpGarAll','Todos'],['prismaticMvpGarMain','PAS / DRI'],['prismaticMvpGarSecondary','Demais']];
    return [['prismaticArtGarMain','FIN / VEL / PAS / DRI'],['prismaticArtGarSecondary','DEF / FÍS']];
  };
  const specialCalculatedVisual=(kind,combo,title)=>{
    const base=computePodiumComboBoost(combo,'closed');
    const hasPodium=PODIUM_TYPES.some(type=>!!combo[type]);
    const isolated=kind==='prismatic' ? 4 : 8;
    const increment=kind==='prismatic' ? 2 : 4;
    const boost={};
    const previewCap=kind==='prismatic'?18:20;
    PLAYER_ATTRIBUTE_KEYS.forEach(key=>boost[key]=Math.min(previewCap,hasPodium?(base[key]+increment):isolated));
    const medalChips=PODIUM_TYPES.filter(type=>combo[type]).map(type=>'<span class="bonus-medal-chip medal-'+combo[type]+'">'+medalIcon[combo[type]]+' '+PODIUM_TYPE_LABEL[type]+' '+PODIUM_MEDAL_LABEL[combo[type]]+'</span>').join('');
    const specialIcon=kind==='prismatic'?'💎':'💠';
    const specialLabel=kind==='prismatic'?'Prismático':'Colecionador';
    const short={chute:'CHU',passe:'PAS',contato:'FÍS',drible:'DRI',marcacao:'DEF',velocidade:'VEL'};
    const effects=PLAYER_ATTRIBUTE_KEYS.map(key=>'<div class="bonus-effect-card"><small>'+short[key]+'</small><b>+'+boost[key]+'</b><span>bônus</span></div>').join('');
    return '<div class="bonus-visual-title">'+title+'</div><div class="bonus-medal-chips"><span class="bonus-special-chip '+kind+'">'+specialIcon+' '+specialLabel+'</span>'+medalChips+'</div><div class="bonus-effect-grid">'+effects+'</div><div class="bonus-public-note">'+(kind==='prismatic'?'Prismático vale +4 isolado e tem teto +18.':'Colecionador vale +8 isolado e tem teto +20.')+' O andamento é somado dentro desse limite.</div>';
  };
  const renderSpecialCard=(editor)=>{
    const combo={mvp:null,artilheiro:null,garcom:null};
    editor.querySelectorAll('[data-special-medal]').forEach(select=>combo[select.dataset.specialMedal]=select.value||null);
    const kind=editor.dataset.specialKind;
    const preview=editor.querySelector('[data-special-combo-preview]');
    const trophyLabel=podiumComboLabel(combo);
    const title=(kind==='prismatic'?'Prismático':'Colecionador')+(trophyLabel?' + '+trophyLabel:' isolado');
    const fields=specialFieldsFor(kind,combo);
    const calculated=specialCalculatedVisual(kind,combo,title);
    const advanced=isAdmin?'<details style="margin-top:9px"><summary style="cursor:pointer;color:var(--chalk-dim);font-size:10px">Ajuste avançado desta combinação</summary><div class="bonus-rule-values" style="margin-top:8px">'+fields.map(value=>bonusValue(value[0],value[1])).join('')+'</div></details>':'';
    preview.innerHTML=calculated+advanced;
    preview.querySelectorAll('[data-bonus-rule]').forEach(input=>input.addEventListener('input',()=>{draftRules[input.dataset.bonusRule]=Math.max(0,Math.min(99,Number(input.value)||0));renderSpecialCard(editor);}));
  };
  panel.querySelectorAll('[data-special-kind]').forEach(editor=>{
    editor.querySelectorAll('select').forEach(control=>control.addEventListener('change',()=>renderSpecialCard(editor)));
    renderSpecialCard(editor);
  });
  const renderGoatSpecial=(editor)=>{
    const hasPrismatic=!!editor.querySelector('[data-goat-addon="prismatic"]')?.checked;
    const hasCollector=!!editor.querySelector('[data-goat-addon="collector"]')?.checked;
    const preview=editor.querySelector('[data-goat-combo-preview]');
    let title='GOAT';
    let fields=[['goatAll','Todos']];
    if(hasPrismatic&&hasCollector){ title='GOAT + Prismático + Colecionador'; fields=[['prismaticCollectorGoatAll','Todos']]; }
    else if(hasPrismatic){ title='GOAT + Prismático'; fields=[['prismaticGoatAll','Todos']]; }
    else if(hasCollector){ title='GOAT + Colecionador'; fields=[['collectorGoatAll','Todos']]; }
    const specials=[{kind:'goat',icon:'🐐',label:'GOAT'}];
    if(hasPrismatic) specials.push({kind:'prismatic',icon:'💎',label:'Prismático'});
    if(hasCollector) specials.push({kind:'collector',icon:'💠',label:'Colecionador'});
    preview.innerHTML=isAdmin
      ? '<div class="bonus-combo-preview-title">'+title+'</div><div class="bonus-rule-values">'+fields.map(value=>bonusValue(value[0],value[1])).join('')+'</div>'
      : comboVisualHtml(title,{mvp:null,artilheiro:null,garcom:null},fields,specials);
    preview.querySelectorAll('[data-bonus-rule]').forEach(input=>input.addEventListener('input',()=>{draftRules[input.dataset.bonusRule]=Math.max(0,Math.min(99,Number(input.value)||0));}));
  };
  panel.querySelectorAll('[data-goat-special]').forEach(editor=>{
    editor.querySelectorAll('[data-goat-addon]').forEach(control=>control.addEventListener('change',()=>renderGoatSpecial(editor)));
    renderGoatSpecial(editor);
  });
  panel.querySelectorAll('[data-bonus-rule]').forEach(input=>input.addEventListener('input',()=>{draftRules[input.dataset.bonusRule]=Math.max(0,Math.min(99,Number(input.value)||0));}));
  const refreshAllInputs=(rules)=>{
    draftRules={...rules};
    panel.querySelectorAll('[data-combo-editor]').forEach(renderComboPreview);
    panel.querySelectorAll('[data-special-kind]').forEach(renderSpecialCard);
    panel.querySelectorAll('[data-goat-special]').forEach(renderGoatSpecial);
    panel.querySelectorAll('[data-bonus-rule]').forEach(input=>input.value=safeValue(draftRules,input.dataset.bonusRule));
  };
  const save=$('btnSaveBonusRules');
  if(save) save.addEventListener('click',async ()=>{ bonusRules={...draftRules}; await saveBonus(); renderAll(); showToast('Bônus aplicados e salvos.'); });
  const savePreset=$('btnSaveBonusPreset');
  if(savePreset) savePreset.addEventListener('click',async ()=>{ savedBonusRulesPreset={...draftRules}; await saveBonus(); showToast('Configuração de bônus salva.'); });
  const loadPreset=$('btnLoadBonusPreset');
  if(loadPreset) loadPreset.addEventListener('click',()=>{ if(!savedBonusRulesPreset){ showToast('Nenhuma configuração de bônus salva.'); return; } refreshAllInputs(savedBonusRulesPreset); showToast('Configuração carregada. Clique em aplicar para confirmar.'); });
  const discard=$('btnDiscardBonusChanges');
  if(discard) discard.addEventListener('click',()=>{ refreshAllInputs(bonusRules); showToast('Alterações não salvas descartadas.'); });
  const reset=$('btnResetBonusRules');
  if(reset) reset.addEventListener('click',()=>{ refreshAllInputs(DEFAULT_BONUS_RULES); showToast('Valores padrão carregados. Clique em aplicar para salvar.'); });
}

function renderPlayerGrid(){
  renderBonusRulesPanel();
  renderPlayerSortBar();
  const grid = $('playerGrid');
  applyPlayerCardHeight(playerCardHeight);
  $('elencoCardHeight').value = playerCardHeight;
  $('elencoCardHeightValue').textContent = `${playerCardHeight} px`;
  if(!players.length){
    grid.innerHTML = '<div class="empty">Nenhum jogador ainda. Clique em "+ Novo jogador" para começar o elenco.</div>';
    return;
  }
  const totals = computeAllTotals();
  const discipline = computeDisciplineStatus();
  const cur = computeCurrentPeriodStats();
  const reigning = computeReigningTitles();
  const secretSets = computeSecretRecordSets();
  const officialSpecial=latestClosedSpecialPatentSets();
  const latestClosed = months.length ? [...months].sort((a,b)=>b.endDate.localeCompare(a.endDate))[0] : null;
  const latestClosedKey = latestClosed ? computePeriodMonthKey(latestClosed.startDate, latestClosed.endDate) : '';
  const latestAwards = computeLastMonthAwardsData();
  const latestAwardPlayerIds = new Set(['mvp','artilheiro','garcom'].flatMap(type=>latestAwards?.[type]?.playerIds||[latestAwards?.[type]?.playerId]).filter(Boolean));
  const list = sortPlayersByMode(players, totals, playerSortMode, playerSortDir);
  grid.innerHTML = list.map(p=>{
    const t = totals[p.id] || {goals:0, assists:0, ratingSum:0, ratingCount:0, games:0};
    const disciplineState=discipline[p.id] || {yellowCard:false,yellowRoundsRemaining:0,suspendedRounds:0};
    const disciplineBadge=disciplineState.suspendedRounds
      ? `<div class="discipline-badge suspended">🟥 Cartão vermelho · suspenso por ${disciplineState.suspendedRounds} rodada</div>`
      : (disciplineState.yellowCard ? `<div class="discipline-badge warning">🟨 Cartão amarelo · faltam ${disciplineState.yellowRoundsRemaining} rodada${disciplineState.yellowRoundsRemaining!==1?'s':''} para limpar</div>` : '');
    const avg = t.ratingCount ? (t.ratingSum/t.ratingCount) : null;
    const score = computeMvpScore(t);
    const leadsAllThreeNow = isCurrentGoat(cur,p.id);
    const titleBadges = [];
    if(cur && !leadsAllThreeNow){
      if(isCurrentLeader(cur,'mvp',p.id)) titleBadges.push({icon:'⭐', label:'MVP atual'});
      if(isCurrentLeader(cur,'artilheiro',p.id)) titleBadges.push({icon:'⚽', label:'Artilheiro atual'});
      if(isCurrentLeader(cur,'garcom',p.id)) titleBadges.push({icon:'🎯', label:'Garçom atual'});
    }
    const badgesHtml = leadsAllThreeNow
      ? `<div class="player-title-badges"><span class="title-badge" title="Líder de MVP, artilheiro e garçom no mês em andamento">🐐</span></div>`
      : (titleBadges.length ? `<div class="player-title-badges">${titleBadges.map(b=>`<span class="title-badge" title="${b.label}">${b.icon}</span>`).join('')}</div>` : '');

    const rb = computeReigningBadgesFor(reigning, p.id);
    const hasCosmic = officialSpecial.cosmic.has(p.id);
    const isPlat = officialSpecial.collector.has(p.id);
    const hasPrismaticPatent = hasReigningPrismaticPerformance(p.id);
    const isTitleContender = isCurrentTitleContender(p.id);
    const reignParts = [];
    if(hasCosmic){
      reignParts.push(`<div class="cosmic-badge" title="Mês Perfeito do último mês encerrado">🌌 Mês Perfeito</div>`);
    } else {
      if(isPlat) reignParts.push(`<div class="platinum-badge" title="Detém todos os recordes do racha ao mesmo tempo">💠 Colecionador</div>`);
      if(hasPrismaticPatent) reignParts.push('<div class="prismatic-badge" title="Melhor performance do último mês fechado: nota média 10">💎 Performance máxima</div>');
      if(rb.isGoat) reignParts.push(`<div class="goat-badge" title="Foi MVP, artilheiro E garçom do mês que encerrou">🐐 ${GOAT_TITLE}</div>`);
      else reignParts.push(...rb.titles.map(t=>`<div class="reigning-badge" title="${t.name} do mês que encerrou">👑 ${t.name}</div>`));
    }
    const reignHtml = reignParts.length ? `<div class="reigning-badges-wrap">${reignParts.join('')}</div>` : '';
    const closedPodiumMedal = playerClosedPodiumMedal(p.id);
    const currentPodiumMedal = playerCurrentPodiumMedal(p.id);
    const currentBeamClass=leadsAllThreeNow?' has-current-goat-beam':(currentPodiumMedal==='gold'?' has-current-gold-beam':currentPodiumMedal==='silver'?' has-current-silver-beam':currentPodiumMedal==='bronze'?' has-current-bronze-beam':(isTitleContender?' has-current-silver-beam':''));
    let cardClass = '';
    if(hasCosmic) cardClass = ' is-cosmic';
    else if(isPlat) cardClass = ' is-platinum';
    else if(rb.isGoat || leadsAllThreeNow) cardClass = ' is-goat';
    else if(hasPrismaticPatent) cardClass = ' is-prismatic';
    else if(rb.titles.length) cardClass = ' is-reigning';
    else if(closedPodiumMedal==='silver') cardClass = ' is-achievement-silver';
    else if(closedPodiumMedal==='bronze') cardClass = ' is-achievement-bronze';
    else if(leadsAllThreeNow) cardClass = ' is-goat-contender';
    else if(currentPodiumMedal==='gold') cardClass = ' is-current-gold';
    else if(currentPodiumMedal==='silver') cardClass = ' is-current-silver';
    else if(currentPodiumMedal==='bronze') cardClass = ' is-current-bronze';
    else if(isTitleContender) cardClass = ' is-contender';
    const wmCodes = hasCosmic ? ['MP'] : (isPlat ? ['COL'] : ((rb.isGoat || leadsAllThreeNow) ? ['GOAT'] : (hasPrismaticPatent ? ['PRISM'] : rb.titles.map(t=>t.wm))));
    const watermarkClass = wmCodes.length ? (' has-watermark' + (wmCodes.length>1 ? ' has-watermark-multi' : '')) : '';
    const watermarkAttr = wmCodes.length ? ` data-wm="${wmCodes.join('\n')}"` : '';
    const nickShineClass = hasCosmic ? ' shine-cosmic-text' : (isPlat ? ' shine-platinum-text' : ((rb.isGoat || leadsAllThreeNow) ? ' shine-goat-text' : (hasPrismaticPatent ? ' shine-prismatic-text' : (rb.titles.length ? ' shine-gold-text' : ''))));

    const effectiveAttrs = effectivePlayerAttributes(p);
    const overall = playerOverall(p),keeperOverall=goalkeeperOverall(p);
    const goalkeeperEffective=effectiveGoalkeeperAttributes(p),lineAttributes=[['VEL',effectiveAttrs.velocidade],['DRI',effectiveAttrs.drible],['FIN',effectiveAttrs.chute],['DEF',effectiveAttrs.marcacao],['PAS',effectiveAttrs.passe],['FÍS',effectiveAttrs.contato]],goalkeeperAttributes=[['REF',goalkeeperEffective.reflexo],['POS',goalkeeperEffective.posicionamentoGol],['1X1',goalkeeperEffective.umContraUm],['AÉR',goalkeeperEffective.jogoAereo],['REP',goalkeeperEffective.reposicao],['SAÍ',goalkeeperEffective.saidaGol]],attributeMarkup=attributes=>attributes.map(([label,value])=>`<div><b>${Math.round(Number(value)||0)}</b>${label}</div>`).join('');
    const attributesHtml = attributeMarkup(p.role==='goalkeeper'?goalkeeperAttributes:lineAttributes),goalkeeperAttributesHtml=p.role==='hybrid'?attributeMarkup(goalkeeperAttributes):'';
    const contenderClass = '';
    const disciplineClass=disciplineState.suspendedRounds ? ' is-red-card' : (disciplineState.yellowCard ? ' is-yellow-card' : '');
    const photoCardClass = p.photo ? ' has-card-photo' : '';
    const photoScale = Math.max(.7,Math.min(1.6,Number(p.photoScale)||1));
    const photoX = Math.max(-35,Math.min(35,Number(p.photoX)||0));
    const photoY = Math.max(-25,Math.min(25,Number(p.photoY)||0));
    const photoExtraHeight = Math.max(0,Math.min(160,Number(p.photoExtraHeight ?? 45)));
    const photoFadeStart = Math.max(0,Math.min(100,Number(p.photoFadeStart ?? 74)));
    const photoFadeEnd = Math.max(0,Math.min(100,Number(p.photoFadeEnd ?? 100)));
    const photoDropShadow = Math.max(0,Math.min(100,Number(p.photoDropShadow ?? 42)))/100;
    return `<div class="player-card${cardClass}${currentBeamClass}${disciplineClass}${contenderClass}${watermarkClass}${photoCardClass}" data-id="${p.id}" data-podium-wm="${closedPodiumMedal==='silver'?'PRATA':closedPodiumMedal==='bronze'?'BRONZE':''}"${watermarkAttr}>
      <span class="player-aura-beam" aria-hidden="true"></span>${badgesHtml}<div class="player-overall"><b>${formatOverall(overall)}</b><span>${p.role==='goalkeeper'?'OVR GOL':'OVR JOG'}</span>${p.role==='hybrid'?`<button type="button" class="hybrid-goalkeeper-toggle" aria-pressed="false">${formatOverall(keeperOverall)} OVR GOL</button>`:''}</div>
      ${p.photo ? `<img class="card-player-photo" src="${p.photo}" alt="${p.name}" style="--photo-extra-height:${photoExtraHeight}px;--photo-fade-start:${photoFadeStart}%;--photo-fade-end:${photoFadeEnd}%;--photo-drop-shadow:${photoDropShadow};transform:translate(${photoX}%,${photoY}%) scale(${photoScale});">` : `<div class="badge-fallback">${initials(p.name)}</div>`}
      <div class="p-nick${nickShineClass}">${p.nickname}</div><div class="p-name">${p.name}${t.absences?` · ${t.absences} falta${t.absences>1?'s':''}`:''}</div>
      ${disciplineBadge}${reignHtml}<div class="player-attributes player-line-attributes">${attributesHtml}</div>${p.role==='hybrid'?`<div class="player-attributes player-goalkeeper-attributes" style="display:none">${goalkeeperAttributesHtml}</div>`:''}
    </div>`;
  }).join('');
  grid.querySelectorAll('.player-card').forEach(card=>{
    card.querySelector('.hybrid-goalkeeper-toggle')?.addEventListener('click',event=>{event.stopPropagation();const button=event.currentTarget,line=card.querySelector('.player-line-attributes'),goalkeeper=card.querySelector('.player-goalkeeper-attributes'),showGoalkeeper=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(showGoalkeeper));line.style.display=showGoalkeeper?'none':'';goalkeeper.style.display=showGoalkeeper?'':'none';card.classList.toggle('showing-goalkeeper',showGoalkeeper)});
    card.addEventListener('click',event=>{if(event.target.closest('.hybrid-goalkeeper-toggle'))return;if(typeof comparisonSelectionMode!=='undefined'&&comparisonSelectionMode){selectPlayerForComparison(card.dataset.id);return}openPlayerDetail(card.dataset.id)});
  });
  if(typeof updateComparisonCardSelection==='function')updateComparisonCardSelection();
}

function computeAllTotals(sinceISO, untilISO){
  const totals = {};
  players.forEach(p=> totals[p.id] = {goals:0, assists:0, ratingSum:0, ratingCount:0, games:0, absences:0, justifiedAbsences:0, absencePenalty:0});
  rounds.forEach(r=>{
    if(sinceISO && r.date < sinceISO.slice(0,10)) return;
    if(untilISO && r.date >= untilISO.slice(0,10)) return;
    const validAbsences=typeof getRoundAbsences==='function'?getRoundAbsences(r):(r.absences||{});
    Object.entries(validAbsences).forEach(([pid,absence])=>{
      if(!totals[pid]) return;
      if(absence?.justified) totals[pid].justifiedAbsences++;
      else {
        totals[pid].absences++;
        totals[pid].absencePenalty+=10;
        totals[pid].ratingCount++;
        totals[pid].games++;
      }
    });
    Object.entries(r.entries||{}).forEach(([pid, e])=>{
      if(!totals[pid]) return;
      const hasData = (e.goals!=='' && e.goals!=null) || (e.assists!=='' && e.assists!=null) || (e.rating!=='' && e.rating!=null);
      if(!hasData) return;
      totals[pid].goals += Number(e.goals)||0;
      totals[pid].assists += Number(e.assists)||0;
      if(e.rating!=='' && e.rating!=null){ totals[pid].ratingSum += Number(e.rating); totals[pid].ratingCount++; }
      totals[pid].games++;
    });
  });
  return totals;
}

function computeDisciplineStatus(untilRoundId=null){
  const status={};
  players.forEach(player=>status[player.id]={unjustifiedAbsences:0, yellowCard:false, yellowCleanGames:0, yellowRoundsRemaining:0, suspendedRounds:0});
  for(const round of [...rounds].sort((a,b)=>String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)))){
    const validAbsences=typeof getRoundAbsences==='function'?getRoundAbsences(round):(round.absences||{});
    players.forEach(player=>{
      const state=status[player.id];
      if(state.suspendedRounds>0){
        state.suspendedRounds--;
        state.yellowCard=false;
        state.yellowCleanGames=0;
        return;
      }
      const absence=validAbsences[player.id];
      if(absence && !absence.justified){
        state.unjustifiedAbsences++;
        if(state.yellowCard){
          state.suspendedRounds=1;
          state.yellowCard=false;
          state.yellowCleanGames=0;
        } else {
          state.yellowCard=true;
          state.yellowCleanGames=0;
        }
        return;
      }
      const entry=(round.entries||{})[player.id];
      const played=entry && ((entry.goals!=='' && entry.goals!=null) || (entry.assists!=='' && entry.assists!=null) || (entry.rating!=='' && entry.rating!=null));
      if(state.yellowCard && played){
        state.yellowCleanGames++;
        if(state.yellowCleanGames>=2){
          state.yellowCard=false;
          state.yellowCleanGames=0;
        }
      }
    });
    if(untilRoundId && round.id===untilRoundId) break;
  }
  Object.values(status).forEach(state=>{ state.yellowRoundsRemaining=state.yellowCard ? Math.max(0,2-state.yellowCleanGames) : 0; });
  return status;
}

function computeBestRoundStat(playerId, statKey, sinceISO, untilISO){
  let best = null;
  rounds.forEach(r=>{
    if(sinceISO && r.date < sinceISO.slice(0,10)) return;
    if(untilISO && r.date >= untilISO.slice(0,10)) return;
    const e = (r.entries||{})[playerId];
    if(!e) return;
    const hasData = (e.goals!=='' && e.goals!=null) || (e.assists!=='' && e.assists!=null) || (e.rating!=='' && e.rating!=null);
    if(!hasData) return;
    const val = Number(e[statKey])||0;
    if(best===null || val>best) best = val;
  });
  return best;
}
