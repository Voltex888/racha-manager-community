function computeTitleStreaks(){
  const sortedMonths = [...months].sort((a,b)=> a.startDate.localeCompare(b.startDate));
  const best = { mvp:{}, artilheiro:{}, garcom:{}, goat:{} };
  const cur = {
    mvp:{pid:null,count:0,startKey:null}, artilheiro:{pid:null,count:0,startKey:null},
    garcom:{pid:null,count:0,startKey:null}, goat:{pid:null,count:0,startKey:null},
  };
  function bump(type, pid, monthKey){
    if(!pid){ cur[type] = {pid:null, count:0, startKey:null}; return; }
    if(cur[type].pid === pid){ cur[type].count++; }
    else { cur[type] = {pid, count:1, startKey:monthKey}; }
    const prevBest = best[type][pid];
    if(!prevBest || cur[type].count > prevBest.count){
      best[type][pid] = { count:cur[type].count, startKey:cur[type].startKey, endKey:monthKey };
    }
  }
  sortedMonths.forEach(m=>{
    const w = computeMonthWinners(m);
    const monthKey = computePeriodMonthKey(m.startDate, m.endDate);
    const isGoatMonth = !!(w.mvp && w.artilheiro && w.garcom && w.mvp===w.artilheiro && w.artilheiro===w.garcom);
    bump('mvp', w.mvp, monthKey);
    bump('artilheiro', w.artilheiro, monthKey);
    bump('garcom', w.garcom, monthKey);
    bump('goat', isGoatMonth ? w.mvp : null, monthKey);
  });
  function toList(map){
    return Object.entries(map).map(([playerId, v])=> ({ playerId, value:v.count, monthKeyStart:v.startKey, monthKeyEnd:v.endKey }));
  }
  return {
    mvp: pickRecordHolders(toList(best.mvp), 'value'),
    artilheiro: pickRecordHolders(toList(best.artilheiro), 'value'),
    garcom: pickRecordHolders(toList(best.garcom), 'value'),
    goat: pickRecordHolders(toList(best.goat), 'value'),
  };
}

function computeMostRecordsBrokenStats(officialOnly=false){
  const globalRec = computeRecords(officialOnly);
  const roundList = [];
  rounds.forEach(r=>{
    if(officialOnly && !findClosedMonthForRound(r)) return;
    const broken = computeRoundBrokenRecords(r, globalRec);
    const counts = {};
    broken.forEach(b=>{ counts[b.playerId] = (counts[b.playerId]||0) + 1; });
    Object.entries(counts).forEach(([playerId,count])=> roundList.push({ playerId, value:count, round:r }));
  });
  const monthList = [];
  months.forEach(m=>{
    const mRounds = rounds.filter(r=> r.date >= m.startDate.slice(0,10) && r.date < m.endDate.slice(0,10));
    const broken = computeMonthBrokenRecords(mRounds, globalRec);
    const counts = {};
    broken.forEach(b=>{ counts[b.playerId] = (counts[b.playerId]||0) + 1; });
    const monthKey = computePeriodMonthKey(m.startDate, m.endDate);
    Object.entries(counts).forEach(([playerId,count])=> monthList.push({ playerId, value:count, monthKey, month:m }));
  });
  const monthListForSecret = [...monthList];
  if(!officialOnly && periodStart){
    const curRounds = rounds.filter(r=> r.date >= periodStart.slice(0,10));
    if(curRounds.length){
      const brokenCur = computeMonthBrokenRecords(curRounds, globalRec);
      const countsCur = {};
      brokenCur.forEach(b=>{ countsCur[b.playerId] = (countsCur[b.playerId]||0) + 1; });
      const curMonthKey = computePeriodMonthKey(periodStart);
      Object.entries(countsCur).forEach(([playerId,count])=> monthListForSecret.push({ playerId, value:count, monthKey:curMonthKey, isCurrent:true }));
    }
  }
  return {
    roundBrokenRecords: pickRecordHolders(roundList, 'value'),
    monthBrokenRecords: pickRecordHolders(monthList, 'value'),
    monthListClosed: monthList,
    monthListRaw: monthListForSecret,
  };
}

function computeSecretRecords(rec, streaks, brokenStats){
  const officialRec = computeRecords(true);
  const officialBrokenStats = computeMostRecordsBrokenStats(true);
  const latestClosed = [...months].sort((a,b)=>b.endDate.localeCompare(a.endDate))[0];
  const collectorMonthKey = latestClosed ? computePeriodMonthKey(latestClosed.startDate, latestClosed.endDate) : '';
  const categoryLists = [
    officialRec.monthGoals, officialRec.monthAssists, officialRec.monthParticipacao, officialRec.monthScore, officialRec.monthRatingTen, officialRec.monthAvgRating,
    officialRec.roundGoals, officialRec.roundAssists, officialRec.roundParticipacao, officialRec.roundScore, officialRec.ratingTen,
    officialRec.allTimeGoals, officialRec.allTimeAssists, officialRec.allTimeParticipacao,
    streaks.mvp, streaks.artilheiro, streaks.garcom, streaks.goat,
    officialBrokenStats.roundBrokenRecords, officialBrokenStats.monthBrokenRecords,
  ];
  const holderSets = categoryLists.map(list=> new Set((list||[]).map(x=>x.playerId)));
  holderSets.push(new Set(computeTripleCrownRecordHolders()));
  const colecionador = players
    .filter(p=> holderSets.length>0 && holderSets.every(s=> s.has(p.id)))
    .map(p=> ({ playerId:p.id, value: holderSets.length, monthKey:collectorMonthKey }));

  const collectorIds = new Set(colecionador.map(item=>item.playerId));
  const mesPerfeito = (officialBrokenStats.monthListClosed||[]).filter(item=>
    item.value >= MAX_RECORD_CATS_IN_A_MONTH && collectorIds.has(item.playerId)
  );

  return { colecionador, mesPerfeito };
}

function recordContextLine(item){
  if(item.round) return `${item.round.label}${item.matchNumber?` · Partida ${item.matchNumber}`:''} · ${fmtDate(item.round.date)}`;
  if(item.monthKeyStart || item.monthKeyEnd) return `${monthLabel(item.monthKeyStart)} → ${monthLabel(item.monthKeyEnd)}`;
  if(item.monthKey) return monthLabel(item.monthKey) + (item.isCurrent ? ' (em andamento)' : '');
  return 'Total histórico';
}

const RECORD_TIER_PRIORITY = { normal:0, mvp:1, artilheiro:1, garcom:1, prismatic:2, goat:3, platinum:4, cosmic:5 };
function highestRecordTier(tiers){
  return tiers.reduce((best, tier)=> RECORD_TIER_PRIORITY[tier] > RECORD_TIER_PRIORITY[best] ? tier : best, 'normal');
}
function recordTierBadge(tier){
  const badges = {
    normal:['🏆','Recorde'],
    mvp:['⭐','Conquistado como MVP'],
    artilheiro:['⚽','Conquistado como artilheiro'],
    garcom:['🎯','Conquistado como garçom'],
    prismatic:['💎','Recorde raro'],
    goat:['🐐','GOAT'],
    platinum:['💠','Colecionador'],
    cosmic:['🌌','Mês Perfeito'],
  };
  const [icon, label] = badges[tier] || badges.normal;
  return `<span class="record-rank tier-${tier}">${icon} ${label}</span>`;
}
function recordTierMeta(tier){
  const labels = {
    normal:'conquista normal',
    mvp:'conquistado como MVP',
    artilheiro:'conquistado como artilheiro',
    garcom:'conquistado como garçom',
    prismatic:'recorde raro',
    goat:'GOAT',
    platinum:'Colecionador',
    cosmic:'Mês Perfeito',
  };
  return labels[tier] || labels.normal;
}

function buildRecordAccordionItem(label, list, unit, decimals, styleClass, emptyMsg, itemTierResolver){
  const hasAny = list && list.length;
  const itemTiers = hasAny ? list.map(item=> itemTierResolver ? itemTierResolver(item) : styleClass) : [];
  const highestTier = hasAny ? highestRecordTier(itemTiers) : styleClass;
  let cardClass = '', headIcon = '🔸 ';
  if(hasAny){
    if(highestTier==='goat'){ cardClass = ' has-goat'; headIcon = '🐐 '; }
    else if(highestTier==='cosmic'){ cardClass = ' has-cosmic'; headIcon = '🌌 '; }
    else if(highestTier==='platinum'){ cardClass = ' has-platinum'; headIcon = '💠 '; }
    else if(highestTier==='prismatic'){ cardClass = ' has-prismatic'; headIcon = '💎 '; }
    else { cardClass = ' has-record'; headIcon = '🏆 '; }
  }
  const summaryRight = hasAny
    ? `${decimals!=null ? list[0].value.toFixed(decimals) : list[0].value} ${unit}${list.length>1 ? ` · ${list.length} empatados` : ''}`
    : 'Sem dados ainda';
  const bodyHtml = hasAny ? list.map((item, index)=>{
    const p = players.find(pl=>pl.id===item.playerId);
    const pname = p ? p.nickname : 'Jogador removido';
    const pphoto = (p && p.photo) ? circlePhotoMarkup(p,'record-circle-photo',30) : `<div class="ph-fb">${p?initials(p.name):'?'}</div>`;
    const valStr = decimals!=null ? item.value.toFixed(decimals) : item.value;
    return `<div class="record-achievement-row tier-${itemTiers[index]}">
      <div class="record-achievement-name"><span class="name-cell">${pphoto}${pname}</span>${recordTierBadge(itemTiers[index])}</div>
      <div class="record-achievement-context"><b>${valStr} ${unit}</b> · ${recordContextLine(item)}</div>
    </div>`;
  }).join('') : `<span style="color:var(--chalk-dim);font-size:13px;">${emptyMsg || 'Sem dados ainda. Lance algumas rodadas pra começar a bater essa marca.'}</span>`;
  return `<details class="round-item${cardClass}">
    <summary>
      <div><div class="round-title">${headIcon}${label}</div><div class="round-date">${summaryRight}</div></div>
    </summary>
    <div class="round-body">${bodyHtml}</div>
  </details>`;
}

function buildRecordsSection(){
  const rec = computeRecords();
  const streaks = computeTitleStreaks();
  const brokenStats = computeMostRecordsBrokenStats();
  const secret = computeSecretRecords(rec, streaks, brokenStats);
  const tripleCrownSet = new Set(computeTripleCrownHistory().map(c=> c.playerId+'|'+c.monthKey));
  const secretSets = {
    cosmicMonthSet: createCosmicMonthSet(secret.mesPerfeito||[]),
    platinumPlayerSet: createPlatinumPlayerSet(secret.colecionador),
  };
  const tierForItem = (item, fallback='normal')=>{
    const frozen=frozenSpecialTier(item.playerId,item);
    if(frozen==='cosmic') return frozen;
    if(isCosmicInstance(item.playerId, item, secretSets.cosmicMonthSet)) return 'cosmic';
    if(frozen==='platinum') return frozen;
    if(isPlatinumInstance(item.playerId, secretSets.platinumPlayerSet, item)) return 'platinum';
    if(frozen) return frozen;
    if(fallback==='goat') return 'goat';
    if(fallback==='prismatic') return 'prismatic';
    return isGoatInstance(item.playerId, item, tripleCrownSet) ? 'goat' : 'normal';
  };
  const g = (list, isPrismaticFallback)=>{
    return highestRecordTier((list||[]).map(item=> tierForItem(item, isPrismaticFallback ? 'prismatic' : 'normal')));
  };
  const gGoatDefault = (list)=>{
    return highestRecordTier((list||[]).map(item=> tierForItem(item, 'goat')));
  };
  const gNoGoat = (list)=> recordListSecretTier(list, secretSets) || 'normal';
  const tierNoGoatForItem = (item)=>{
    const frozen=frozenSpecialTier(item.playerId,item);
    if(frozen==='cosmic') return frozen;
    if(isCosmicInstance(item.playerId,item,secretSets.cosmicMonthSet)) return 'cosmic';
    if(frozen==='platinum') return frozen;
    if(isPlatinumInstance(item.playerId,secretSets.platinumPlayerSet,item)) return 'platinum';
    if(frozen) return frozen;
    return 'normal';
  };
  const gPrismaticOnly = (list)=> recordListSecretTier(list, secretSets) || 'prismatic';
  const tripleCrownHistory = computeTripleCrownHistory();
  const tripleCrownList = computeTripleCrownRecordHolders().map(playerId=> {
    const crowns = tripleCrownHistory
      .filter(c=> c.playerId===playerId)
      .sort((a,b)=> String(b.endDate||'').localeCompare(String(a.endDate||'')));
    const lastCrown = crowns[0];
    return {
      playerId,
      value: crowns.length,
      monthKey: lastCrown && lastCrown.monthKey,
      startDate: lastCrown && lastCrown.startDate,
      endDate: lastCrown && lastCrown.endDate
    };
  });

  const hasAny = Object.values(rec).some(arr=> arr.length>0);
  if(!hasAny) return '<div class="table-title">👤 Recordes individuais</div><div class="empty">Sem recordes ainda. Lance algumas rodadas pra começar a bater marcas.</div>';

  let html = '<div class="table-title">👤 Recordes individuais</div>';
  html += buildRecordAccordionItem('Maior artilheiro (histórico)', rec.allTimeGoals, 'gols', null, 'prismatic');
  html += buildRecordAccordionItem('Maior garçom (histórico)', rec.allTimeAssists, 'assist.', null, 'prismatic');
  html += buildRecordAccordionItem('Maior participador (G/A) (histórico)', rec.allTimeParticipacao, 'G/A', null, 'prismatic');
  html += buildRecordAccordionItem('Mais gols em um mês', rec.monthGoals, 'gols', null, g(rec.monthGoals, false), null, item=>tierForItem(item));
  html += buildRecordAccordionItem('Mais assistências em um mês', rec.monthAssists, 'assist.', null, g(rec.monthAssists, false), null, item=>tierForItem(item));
  html += buildRecordAccordionItem('Maior G/A em um mês', rec.monthParticipacao, 'G/A', null, g(rec.monthParticipacao, false), null, item=>tierForItem(item));
  html += buildRecordAccordionItem('Maior pontuação em um mês', rec.monthScore, 'pts', 1, g(rec.monthScore, false), null, item=>tierForItem(item));
  html += buildRecordAccordionItem('Melhor performance em um mês (nota média)', rec.monthAvgRating, 'nota', 1, gPrismaticOnly(rec.monthAvgRating), 'Sem dados ainda', item=>tierForItem(item, isPrismaticRecord('monthAvgRating',item)?'prismatic':'normal'));
  html += buildRecordAccordionItem('Mais vezes com nota 10 em um mês', rec.monthRatingTen, 'x', null, g(rec.monthRatingTen, false), null, item=>tierForItem(item));
  html += buildRecordAccordionItem('Mais gols em uma rodada', rec.roundGoals, 'gols', null, g(rec.roundGoals, false), null, item=>tierForItem(item));
  html += buildRecordAccordionItem('Mais assistências em uma rodada', rec.roundAssists, 'assist.', null, g(rec.roundAssists, false), null, item=>tierForItem(item));
  html += buildRecordAccordionItem('Maior G/A em uma rodada', rec.roundParticipacao, 'G/A', null, g(rec.roundParticipacao, false), null, item=>tierForItem(item));
  html += buildRecordAccordionItem('Maior pontuação em uma rodada', rec.roundScore, 'pts', 1, g(rec.roundScore, false), null, item=>tierForItem(item));
  html += buildRecordAccordionItem('Mais vezes com nota 10 (histórico)', rec.ratingTen, 'x', null, g(rec.ratingTen, false), null, item=>tierForItem(item));

  html += '<div class="table-title" style="margin-top:22px;">🔥 Sequências</div>';
  html += buildRecordAccordionItem('Mais meses seguidos como MVP', streaks.mvp, 'meses', null, g(streaks.mvp, false), null, item=>tierForItem(item));
  html += buildRecordAccordionItem('Mais meses seguidos como artilheiro', streaks.artilheiro, 'meses', null, g(streaks.artilheiro, false), null, item=>tierForItem(item));
  html += buildRecordAccordionItem('Mais meses seguidos como garçom', streaks.garcom, 'meses', null, g(streaks.garcom, false), null, item=>tierForItem(item));
  html += buildRecordAccordionItem('Mais meses seguidos como GOAT', streaks.goat, 'meses', null, gGoatDefault(streaks.goat), null, item=>tierForItem(item, 'goat'));

  html += '<div class="table-title" style="margin-top:22px;">🏆 Caçador de recordes</div>';
  html += buildRecordAccordionItem('Mais recordes quebrados numa única rodada', brokenStats.roundBrokenRecords, 'recorde(s)', null, gNoGoat(brokenStats.roundBrokenRecords), null, tierNoGoatForItem);
  html += buildRecordAccordionItem('Mais recordes quebrados num único mês', brokenStats.monthBrokenRecords, 'recorde(s)', null, gNoGoat(brokenStats.monthBrokenRecords), null, tierNoGoatForItem);
  html += buildRecordAccordionItem('Mais tríplices coroas do racha', tripleCrownList, 'x', null, gGoatDefault(tripleCrownList), null, item=>tierForItem(item, 'goat'));

  html += '<div class="table-title" style="margin-top:22px;">🔒 Recordes secretos</div>';
  html += buildRecordAccordionItem('Colecionador — detém TODOS os recordes oficiais do racha ao mesmo tempo (2º mais raro)', secret.colecionador, 'categorias', null, 'platinum',
    'Ninguém alcançou essa marca ainda — é a segunda conquista mais rara do racha. Precisa deter categorias de rodada, mês, carreira, sequências, tríplice coroa e caçador de recordes ao mesmo tempo; COSMIC não entra na contagem.');
  html += buildRecordAccordionItem('Mês Perfeito — quebrou TODOS os recordes de rodada/mês possíveis dentro de um único mês (o mais raro)', secret.mesPerfeito, `de ${MAX_RECORD_CATS_IN_A_MONTH} categorias`, null, 'cosmic',
    'Ninguém alcançou essa marca ainda — é a conquista mais rara do racha, perdendo somente pra ela mesma.');

  return html;
}

function collectiveEntryStats(entries,playerIds){
  const ids=playerIds||Object.keys(entries||{});
  let goals=0,assists=0,score=0,ratingSum=0,ratingCount=0;
  ids.forEach(id=>{const entry=(entries||{})[id];if(!entry)return;const g=Number(entry.goals)||0,a=Number(entry.assists)||0;const hasRating=entry.rating!==''&&entry.rating!=null&&Number.isFinite(Number(entry.rating));const rating=hasRating?Number(entry.rating):0;goals+=g;assists+=a;score+=rating*4+g*5+a*4.5;if(hasRating){ratingSum+=rating;ratingCount++}});
  const avg=ratingCount?ratingSum/ratingCount:0;
  return {goals,assists,ga:goals+assists,score,avg,best:goals*5+assists*4.5+avg*4};
}
function collectiveMax(list,key){
  if(!list.length)return[];const max=Math.max(...list.map(item=>Number(item[key])||0));if(max<=0)return[];return list.filter(item=>(Number(item[key])||0)===max).map(item=>({...item,value:Number(item[key])||0}));
}
function collectiveCombinations(ids,size){
  const result=[];
  const walk=(start,current)=>{
    if(current.length===size){result.push([...current]);return}
    for(let i=start;i<ids.length;i++){current.push(ids[i]);walk(i+1,current);current.pop()}
  };
  walk(0,[]);
  return result;
}
function collectiveRoundTeams(round){
  const groups=[];
  (round.teamPlan?.slots||[]).forEach((slot,slotIndex)=>(slot.teams||[]).forEach((team,teamIndex)=>{
    const ids=[...new Set(team||[])];
    if(ids.length)groups.push({ids,teamIndex,slotIndex,slotLabel:slot.label||`Horário ${slotIndex+1}`});
  }));
  return groups;
}
function collectiveCombinationEntry(ids,stats,extra={}){
  const names=ids.map(id=>players.find(player=>player.id===id)?.nickname||'Jogador removido');
  return {...stats,...extra,playerIds:[...ids],title:names.join(' + ')};
}
function buildCollectiveCombinationRecordItem(label,list,kind){
  if(!list.length)return `<div class="record-card record-card-geral record-empty"><div class="record-label">${label}</div>Sem dados ainda</div>`;
  const patentContext=createRankingPatentContext();
  const avatars=ids=>(ids||[]).map(id=>`<span class="${rankingPatentClass(id,patentContext)}">${playerCircleMarkup(players.find(player=>player.id===id),'saved-team-photo',30)}</span>`).join('');
  const holders=list.map(item=>`<div class="record-holder"><div class="record-player" style="display:flex;align-items:center;gap:8px;"><span style="display:flex;gap:4px;">${avatars(item.playerIds)}</span><span>${item.title}</span></div><div class="record-context">${item.context}</div><div class="saved-team-total">${item.goals} G · ${item.assists} A · ${item.score.toFixed(1)} pts${kind==='month'?` · ${item.sharedRounds} rodada${item.sharedRounds!==1?'s':''} juntos`:''}</div></div>`).join('');
  return `<div class="record-card record-card-geral collective-team-record"><div class="record-label">${label}</div><div class="record-value">${list[0].score.toFixed(1)}<small>pts</small></div>${list.length>1?`<div class="record-tie-note">${list.length} combinações empatadas</div>`:''}<div class="record-holders">${holders}</div></div>`;
}
function buildCollectiveRecordItem(label,list,unit,decimals){
  if(!list.length)return `<div class="record-card record-card-geral record-empty"><div class="record-label">${label}</div>Sem dados ainda</div>`;
  const value=decimals!=null?list[0].value.toFixed(decimals):list[0].value;
  const holders=list.map(item=>`<div class="record-holder"><div class="record-player">${item.title}</div><div class="record-context">${item.context}</div></div>`).join('');
  return `<div class="record-card record-card-geral"><div class="record-label">${label}</div><div class="record-value">${value}<small>${unit}</small></div>${list.length>1?`<div class="record-tie-note">${list.length} marcas empatadas</div>`:''}<div class="record-holders">${holders}</div></div>`;
}
function buildCollectiveTeamRecordItem(label,list,unit,decimals){
  if(!list.length)return `<div class="record-card record-card-geral record-empty"><div class="record-label">${label}</div>Sem dados ainda</div>`;
  const patentContext=createRankingPatentContext();
  const playerAvatar=id=>`<span class="${rankingPatentClass(id,patentContext)}">${playerCircleMarkup(players.find(player=>player.id===id),'saved-team-photo',24)}</span>`;
  const cards=list.map(item=>{
    const captains=new Set(item.captains||[]);
    const playersHtml=(item.teamIds||[]).map(id=>`<div class="saved-team-player">${playerAvatar(id)}<span>${captains.has(id)?'👑':'⚽'} ${players.find(player=>player.id===id)?.nickname||'Jogador removido'}</span></div>`).join('');
    const substitutesHtml=(item.substitutes||[]).length?`<div class="team-substitute-pool"><b>⇄ Substitutos do Time ${item.teamIndex+1}</b>${item.substitutes.map(substitute=>`<span class="team-substitute-chip">${playerAvatar(substitute.id)} <strong>${players.find(player=>player.id===substitute.id)?.nickname||'Jogador removido'}</strong> · origem Time ${Number(substitute.homeTeamIndex)+1}</span>`).join('')}</div>`:'';
    return `<div class="saved-team-card collective-record-team"><h4>Time ${item.teamIndex+1}</h4><div class="saved-team-players">${playersHtml}</div>${substitutesHtml}<div class="saved-team-total">${item.goals} G · ${item.assists} A · ${item.score.toFixed(1)} pts</div></div>`;
  }).join('');
  const value=decimals!=null?list[0].value.toFixed(decimals):list[0].value;
  return `<div class="record-card record-card-geral collective-team-record"><div class="record-label">${label}</div><div class="record-value">${value}<small>${unit}</small></div><div class="record-context">${list[0].roundLabel} · ${fmtDate(list[0].roundDate)} · ${list[0].slotLabel}</div>${list.length>1?`<div class="record-tie-note">${list.length} times empatados</div>`:''}<div class="collective-team-record-list">${cards}</div></div>`;
}
function computeCollectiveRecords(){
  const teamEntries=[],roundEntries=[],monthMap={},roundPairs=[],roundTrios=[],monthPairs={},monthTrios={};
  rounds.forEach(round=>{
    const roundStats=collectiveEntryStats(round.entries||{});
    roundEntries.push({...roundStats,title:round.label,context:fmtDate(round.date)});
    const closedMonth=findClosedMonthForRound(round);
    const monthKey=closedMonth?computePeriodMonthKey(closedMonth.startDate,closedMonth.endDate):'';
    if(monthKey){if(!monthMap[monthKey])monthMap[monthKey]={goals:0,assists:0,ga:0,score:0,title:monthLabel(monthKey),context:'Somatório de todas as rodadas do período'};monthMap[monthKey].goals+=roundStats.goals;monthMap[monthKey].assists+=roundStats.assists;monthMap[monthKey].ga+=roundStats.ga;monthMap[monthKey].score+=roundStats.score}
    const slots=Array.isArray(round.teamPlan?.slots)?round.teamPlan.slots:[];
    slots.forEach((slot,slotIndex)=>(slot.teams||[]).forEach((team,teamIndex)=>{
      if(!Array.isArray(team)||!team.length)return;const stats=collectiveEntryStats(round.entries||{},team);const names=team.map(id=>players.find(player=>player.id===id)?.nickname||'Jogador removido').join(', ');
      teamEntries.push({...stats,title:`Time ${teamIndex+1} · ${round.label}`,context:`${fmtDate(round.date)} · ${slot.label||`Horário ${slotIndex+1}`} · ${names} · ${stats.goals} gols · ${stats.assists} assist. · ${stats.ga} G/A · ${stats.score.toFixed(1)} pts · média ${stats.avg.toFixed(1)}`,teamIds:[...team],teamIndex,captains:[...(slot.captains||[])],substitutes:substitutePoolForTeam(slot,teamIndex),roundLabel:round.label,roundDate:round.date,slotLabel:slot.label||`Horário ${slotIndex+1}`});
    }));
    [[2,roundPairs,monthPairs],[3,roundTrios,monthTrios]].forEach(([size,roundList,monthlyMap])=>{
      const seenInRound=new Set();
      collectiveRoundTeams(round).forEach(group=>{
        collectiveCombinations(group.ids.sort(),size).forEach(ids=>{
          const comboKey=ids.join('|');
          if(seenInRound.has(comboKey))return;
          seenInRound.add(comboKey);
          const stats=collectiveEntryStats(round.entries||{},ids);
          const teamContext=`Time ${group.teamIndex+1} · ${group.slotLabel}`;
          const entry=collectiveCombinationEntry(ids,stats,{context:`${round.label} · ${fmtDate(round.date)} · ${teamContext}`,roundLabel:round.label,roundDate:round.date,teamIndex:group.teamIndex,slotLabel:group.slotLabel});
          roundList.push(entry);
          if(!closedMonth)return;
          const periodId=`${closedMonth.startDate}|${closedMonth.endDate}`;
          const key=`${periodId}|${comboKey}`;
          if(!monthlyMap[key])monthlyMap[key]=collectiveCombinationEntry(ids,{goals:0,assists:0,ga:0,score:0,avg:0,best:0},{monthKey,startDate:closedMonth.startDate,endDate:closedMonth.endDate,sharedRounds:0,context:`${monthLabel(monthKey)} · ${fmtDate(closedMonth.startDate)} até ${fmtDate(closedMonth.endDate)}`});
          monthlyMap[key].goals+=stats.goals;
          monthlyMap[key].assists+=stats.assists;
          monthlyMap[key].ga+=stats.ga;
          monthlyMap[key].score+=stats.score;
          monthlyMap[key].sharedRounds++;
        });
      });
    });
  });
  const monthsList=Object.values(monthMap);
  return {
    teamGoals:collectiveMax(teamEntries,'goals'),teamAssists:collectiveMax(teamEntries,'assists'),teamGa:collectiveMax(teamEntries,'ga'),teamScore:collectiveMax(teamEntries,'score'),bestTeam:collectiveMax(teamEntries,'best'),
    roundGoals:collectiveMax(roundEntries,'goals'),roundAssists:collectiveMax(roundEntries,'assists'),roundGa:collectiveMax(roundEntries,'ga'),roundScore:collectiveMax(roundEntries,'score'),
    monthGoals:collectiveMax(monthsList,'goals'),monthAssists:collectiveMax(monthsList,'assists'),monthGa:collectiveMax(monthsList,'ga'),monthScore:collectiveMax(monthsList,'score'),
    roundPairs:collectiveMax(roundPairs,'score'),roundTrios:collectiveMax(roundTrios,'score'),
    monthPairs:collectiveMax(Object.values(monthPairs),'score'),monthTrios:collectiveMax(Object.values(monthTrios),'score'),
  };
}
function buildCollectiveRecordsSection(){
  const rec=computeCollectiveRecords();
  return `<div class="table-title" style="margin-top:28px;">🤝 Recordes coletivos</div>
    <div class="table-title" style="font-size:13px;">⚽ Recordes por time em uma rodada</div><div class="record-grid">
      ${buildCollectiveTeamRecordItem('Mais gols de um time',rec.teamGoals,'gols')}${buildCollectiveTeamRecordItem('Mais assistências de um time',rec.teamAssists,'assist.')}${buildCollectiveTeamRecordItem('Maior G/A de um time',rec.teamGa,'G/A')}${buildCollectiveTeamRecordItem('Maior pontuação de um time',rec.teamScore,'pts',1)}${buildCollectiveTeamRecordItem('Melhor time — gols, assistências e média',rec.bestTeam,'índice',1)}
    </div><div class="table-title" style="font-size:13px;margin-top:22px;">📅 Recordes de uma rodada inteira</div><div class="record-grid">
      ${buildCollectiveRecordItem('Mais gols em uma rodada',rec.roundGoals,'gols')}${buildCollectiveRecordItem('Mais assistências em uma rodada',rec.roundAssists,'assist.')}${buildCollectiveRecordItem('Maior G/A em uma rodada',rec.roundGa,'G/A')}${buildCollectiveRecordItem('Maior pontuação em uma rodada',rec.roundScore,'pts',1)}
      ${buildCollectiveCombinationRecordItem('Melhor dupla em uma rodada',rec.roundPairs,'round')}${buildCollectiveCombinationRecordItem('Melhor trio em uma rodada',rec.roundTrios,'round')}
    </div><div class="table-title" style="font-size:13px;margin-top:22px;">📆 Recordes de um mês/período</div><div class="record-grid">
      ${buildCollectiveRecordItem('Mais gols em um mês',rec.monthGoals,'gols')}${buildCollectiveRecordItem('Mais assistências em um mês',rec.monthAssists,'assist.')}${buildCollectiveRecordItem('Maior G/A em um mês',rec.monthGa,'G/A')}${buildCollectiveRecordItem('Maior pontuação em um mês',rec.monthScore,'pts',1)}
      ${buildCollectiveCombinationRecordItem('Melhor dupla em um mês',rec.monthPairs,'month')}${buildCollectiveCombinationRecordItem('Melhor trio em um mês',rec.monthTrios,'month')}
    </div>`;
}

function renderGeral(){
  const totals = computeAllTotals();
  $('geralTableWrap').innerHTML =
    buildRecordsSection() + buildCollectiveRecordsSection() +
    buildStatTable(totals, 'goals', 'Artilharia geral (histórico completo)', 'Sem dados ainda. Cadastre jogadores e lance uma rodada.') +
    buildStatTable(totals, 'assists', 'Garçonagem geral (histórico completo)', 'Sem dados ainda.') +
    `<div class="title-row"><div class="table-title">Troféus</div>${isAdmin ? `<button class="btn btn-ghost btn-sm" onclick="openTrophyEditModal()">✎ Editar</button>` : ''}</div>` +
    buildTrophySection() +
    buildTripleCrownSection();
}

function computePlayerRecords(playerId){
  const roundEntries = [];
  const monthMap = {};
  const ratingCounts = {};

  rounds.forEach(r=>{
    const e = (r.entries||{})[playerId];
    if(!e) return;
    const hasData = (e.goals!=='' && e.goals!=null) || (e.assists!=='' && e.assists!=null) || (e.rating!=='' && e.rating!=null);
    if(!hasData) return;
    const goals = Number(e.goals)||0;
    const assists = Number(e.assists)||0;
    const rating = (e.rating!=='' && e.rating!=null) ? Number(e.rating) : null;
    const participacao = goals + assists;
    const score = (rating!==null ? rating : 0)*4 + goals*5 + assists*4.5;
    roundEntries.push({ round:r, goals, assists, participacao, score, rating });

    if(rating!==null){
      ratingCounts[rating] = (ratingCounts[rating]||0) + 1;
    }

    const closedMonth = findClosedMonthForRound(r);
    const monthKey = closedMonth ? computePeriodMonthKey(closedMonth.startDate,closedMonth.endDate) : '';
    const periodId = closedMonth ? `${closedMonth.startDate}|${closedMonth.endDate}` : '';
    if(monthKey){
      if(!monthMap[periodId]) monthMap[periodId] = {monthKey, startDate:closedMonth.startDate, endDate:closedMonth.endDate, goals:0, assists:0, ratingSum:0, ratingCount:0, ratingTenCount:0};
      monthMap[periodId].goals += goals;
      monthMap[periodId].assists += assists;
      if(rating!==null){ monthMap[periodId].ratingSum += rating; monthMap[periodId].ratingCount++; }
      if(rating===10) monthMap[periodId].ratingTenCount++;
    }
  });

  const monthEntries = Object.values(monthMap).map(m=>{
    const avg = m.ratingCount ? m.ratingSum/m.ratingCount : 0;
    const participacao = m.goals + m.assists;
    const score = avg*4 + m.goals*5 + m.assists*4.5;
    return { monthKey:m.monthKey, startDate:m.startDate, endDate:m.endDate, goals:m.goals, assists:m.assists, participacao, score, avg, ratingTenCount:m.ratingTenCount };
  });
  const closedPlayerMonthEntries = monthEntries;

  function pickBy(list, key, dir){
    if(!list.length) return [];
    const target = dir==='max' ? Math.max(...list.map(x=>x[key])) : Math.min(...list.map(x=>x[key]));
    return list.filter(x=> x[key]===target).map(x=>({...x, value:x[key]}));
  }
  function pickByPositive(list, key){
    const filtered = list.filter(x=> x[key] > 0);
    if(!filtered.length) return [];
    const target = Math.max(...filtered.map(x=>x[key]));
    return filtered.filter(x=> x[key]===target).map(x=>({...x, value:x[key]}));
  }

  let ratingRecord = null;
  let ratingRecordEntries = [];
  const ratingValues = Object.keys(ratingCounts).map(Number);
  if(ratingValues.length){
    const maxRating = Math.max(...ratingValues);
    ratingRecord = { value: maxRating, count: ratingCounts[maxRating], isAbsoluteMax: maxRating >= 10 };
    ratingRecordEntries = roundEntries.filter(e=>e.rating===maxRating).map(e=>({...e, value:e.rating}));
  }

  const careerGoals = roundEntries.reduce((s,e)=> s+e.goals, 0);
  const careerAssists = roundEntries.reduce((s,e)=> s+e.assists, 0);
  const careerParticipacao = careerGoals + careerAssists;

  return {
    bestRound: pickBy(roundEntries, 'score', 'max'),
    worstRound: pickBy(roundEntries, 'score', 'min'),
    roundGoals: pickBy(roundEntries, 'goals', 'max'),
    roundAssists: pickBy(roundEntries, 'assists', 'max'),
    roundParticipacao: pickBy(roundEntries, 'participacao', 'max'),
    monthGoals: pickBy(closedPlayerMonthEntries, 'goals', 'max'),
    monthAssists: pickBy(closedPlayerMonthEntries, 'assists', 'max'),
    monthParticipacao: pickBy(closedPlayerMonthEntries, 'participacao', 'max'),
    monthScore: pickBy(closedPlayerMonthEntries, 'score', 'max'),
    monthAvgRating: pickByPositive(closedPlayerMonthEntries, 'avg'),
    monthRatingTen: pickByPositive(closedPlayerMonthEntries, 'ratingTenCount'),
    ratingRecord,
    ratingRecordEntries,
    gamesCount: roundEntries.length,
    careerGoals,
    careerAssists,
    careerParticipacao,
  };
}

function buildPersonalRecordCard(label, list, unit, decimals, isRacha, isPrismatic, tierResolver){
  if(!list.length){
    return `<div class="record-card record-empty"><div class="record-label">${label}</div>Sem dados ainda</div>`;
  }
  const val = decimals!=null ? list[0].value.toFixed(decimals) : list[0].value;
  const itemTiers = list.map(item=> tierResolver ? tierResolver(item) : (isPrismatic ? 'prismatic' : 'normal'));
  const highestTier = highestRecordTier(itemTiers);
  const holdersHtml = list.map((item, index)=>{
    const itemVal = decimals!=null ? item.value.toFixed(decimals) : item.value;
    return `<div class="record-achievement-row tier-${itemTiers[index]}">
      <div class="record-achievement-name">${recordTierBadge(itemTiers[index])}</div>
      <div class="record-achievement-context"><b>${itemVal} ${unit}</b> · ${recordContextLine(item)}</div>
    </div>`;
  }).join('');
  const tieHtml = list.length>1 ? `<div class="record-tie-note">${list.length} ocasiões empatadas</div>` : '';
  const isTitleTier=['mvp','artilheiro','garcom'].includes(highestTier);
  const cardClass = highestTier==='cosmic' ? ' record-card-cosmic' : (highestTier==='platinum' ? ' record-card-platinum' : (highestTier==='goat' ? ' record-card-goat' : (highestTier==='prismatic' ? ' record-card-prismatic' : (isTitleTier ? ' record-card-title' : (isRacha ? ' record-racha' : '')))));
  const cardBadge = highestTier==='cosmic' ? '<div class="cosmic-badge">🌌 Conquista em Mês Perfeito</div>'
    : highestTier==='platinum' ? '<div class="platinum-badge">💠 Conquistado sendo Colecionador</div>'
    : highestTier==='goat' ? '<div class="goat-badge">🐐 Conquistado sendo GOAT</div>'
    : highestTier==='prismatic' ? '<div class="prismatic-badge">💎 Recorde raro</div>'
    : isTitleTier ? `<div class="title-record-badge">${highestTier==='mvp'?'⭐ Conquistado como MVP':(highestTier==='artilheiro'?'⚽ Conquistado como artilheiro':'🎯 Conquistado como garçom')}</div>`
    : '';
  const rachaBadge=isRacha?'<div class="racha-badge">🏆 Recorde do racha</div>':'';
  return `<div class="record-card${cardClass}">
    ${cardBadge}
    ${rachaBadge}
    <div class="record-label">${label}</div>
    <div class="record-value">${val}<small>${unit}</small></div>
    ${tieHtml}
    <div class="record-holders">${holdersHtml}</div>
  </div>`;
}

function buildPersonalTotalCard(label, value, unit, isRacha, isPrismatic){
  if(!value){
    return `<div class="record-card record-empty"><div class="record-label">${label}</div>Sem dados ainda</div>`;
  }
  return `<div class="record-card${isRacha ? ' record-racha' : ''}${isPrismatic ? ' record-card-prismatic' : ''}">
    ${isPrismatic ? '<div class="prismatic-badge">💎 Recorde raro</div>' : ''}
    ${isRacha ? '<div class="racha-badge">🏆 Recorde do racha</div>' : ''}
    <div class="record-label">${label}</div>
    <div class="record-value">${value}<small>${unit}</small></div>
    <div class="record-holders"><div class="record-holder"><div class="record-context">Total histórico</div></div></div>
  </div>`;
}

function buildTitleStatCard(label, value, unit, decimals, isRacha, isPrismatic, isGoat, tier){
  const val = decimals!=null ? Number(value||0).toFixed(decimals) : (value||0);
  const effectiveTier = tier || (isGoat ? 'goat' : (isPrismatic ? 'prismatic' : 'normal'));
  if(effectiveTier==='cosmic'){
    return `<div class="record-card record-card-cosmic"><div class="cosmic-badge">🌌 Conquistado em Mês Perfeito</div><div class="record-label">${label}</div><div class="record-value">${val}<small>${unit}</small></div></div>`;
  }
  if(effectiveTier==='platinum'){
    return `<div class="record-card record-card-platinum"><div class="platinum-badge">💠 Conquistado sendo Colecionador</div><div class="record-label">${label}</div><div class="record-value">${val}<small>${unit}</small></div></div>`;
  }
  if(effectiveTier==='goat'){
    return `<div class="record-card record-card-goat">
      <div class="goat-badge">🐐 GOAT</div>
      <div class="record-label">${label}</div>
      <div class="record-value">${val}<small>${unit}</small></div>
    </div>`;
  }
  if(effectiveTier==='prismatic'){
    return `<div class="record-card record-card-prismatic">
      <div class="prismatic-badge">💎 Performance máxima</div>
      <div class="record-label">${label}</div>
      <div class="record-value">${val}<small>${unit}</small></div>
    </div>`;
  }
  return `<div class="record-card${isRacha ? ' record-racha' : ''}${isPrismatic ? ' record-card-prismatic' : ''}">
    ${isPrismatic ? '<div class="prismatic-badge">💎 Recorde raro</div>' : ''}
    ${isRacha ? '<div class="racha-badge">🏆 Recorde do racha</div>' : ''}
    <div class="record-label">${label}</div>
    <div class="record-value">${val}<small>${unit}</small></div>
  </div>`;
}
function buildCurrentTitlesSection(playerId, r, flag){
  const cur = computeCurrentPeriodStats();
  if(!cur) return '';
  const counts = getTrophyCounts()[playerId] || {mvp:0, artilheiro:0, garcom:0};
  const reigning = computeReigningTitles();
  const reigningGoatId = (reigning && reigning.isGoat) ? reigning.goatPlayerId : null;
  const curIsGoat = !!(reigningGoatId && playerId===reigningGoatId);
  const secretSets = computeSecretRecordSets();
  const officialSpecial=latestClosedSpecialPatentSets();
  const curTier = officialSpecial.cosmic.has(playerId) ? 'cosmic' : (officialSpecial.collector.has(playerId) ? 'platinum' : (curIsGoat ? 'goat' : 'normal'));

  const leadsAllThreeNow = isCurrentGoat(cur,playerId);
  if(leadsAllThreeNow){
    const formationTier = (curTier==='cosmic' || curTier==='platinum') ? curTier : 'goat';
    return `<div class="current-title-block title-tier-${formationTier}">
      <div class="current-title-head">
        <span class="current-title-icon">🐐</span>
        <div><div class="current-title-name">Tríplice coroa em formação</div><div class="current-title-count">Líder de MVP + artilheiro + garçom no mês em andamento — só vira GOAT quando o mês fechar</div></div>
      </div>
      <div class="record-grid" style="margin-top:12px;">
        ${buildTitleStatCard('Pontuação do MVP (atual)', cur.mvp.score, 'pts', 1, flag.monthScore, false, formationTier==='goat', formationTier)}
        ${buildTitleStatCard('G/A do MVP (atual)', cur.mvp.ga, 'G/A', null, flag.monthParticipacao, false, formationTier==='goat', formationTier)}
        ${buildTitleStatCard('Nota média do MVP (atual)', cur.mvp.avg, 'nota', 1, flag.monthAvgRating, flag.monthAvgRating, formationTier==='goat', formationTier)}
        ${buildTitleStatCard('Gols do artilheiro (atual)', cur.artilheiro.goals, 'gols', null, flag.monthGoals, false, formationTier==='goat', formationTier)}
        ${buildTitleStatCard('Assist. do garçom (atual)', cur.garcom.assists, 'assist.', null, flag.monthAssists, false, formationTier==='goat', formationTier)}
      </div>
    </div>`;
  }

  let html = '';
  if(isCurrentLeader(cur,'mvp',playerId)){
    html += `<div class="current-title-block title-tier-${curTier}">
      <div class="current-title-head">
        <span class="current-title-icon">⭐</span>
        <div><div class="current-title-name">MVP atual</div><div class="current-title-count">${trophyPodiumProfileText(playerId,'mvp')}</div></div>
      </div>
      <div class="record-grid" style="margin-top:12px;">
        ${buildTitleStatCard('Maior pontuação em um mês', r.monthScore[0]?.value, 'pts', 1, flag.monthScore, false, curIsGoat, curTier)}
        ${buildTitleStatCard('Maior G/A em um mês', r.monthParticipacao[0]?.value, 'G/A', null, flag.monthParticipacao, false, curIsGoat, curTier)}
        ${buildTitleStatCard('Melhor nota média em um mês', r.monthAvgRating[0]?.value, 'nota', 1, flag.monthAvgRating, flag.monthAvgRating, curIsGoat, curTier)}
      </div>
    </div>`;
  }
  if(isCurrentLeader(cur,'artilheiro',playerId)){
    html += `<div class="current-title-block title-tier-${curTier}">
      <div class="current-title-head">
        <span class="current-title-icon">⚽</span>
        <div><div class="current-title-name">Artilheiro atual</div><div class="current-title-count">${trophyPodiumProfileText(playerId,'artilheiro')}</div></div>
      </div>
      <div class="record-grid" style="margin-top:12px;">
        ${buildTitleStatCard('Mais gols em uma rodada', r.roundGoals[0]?.value, 'gols', null, flag.roundGoals, false, curIsGoat, curTier)}
        ${buildTitleStatCard('Mais gols em um mês', r.monthGoals[0]?.value, 'gols', null, flag.monthGoals, false, curIsGoat, curTier)}
      </div>
    </div>`;
  }
  if(isCurrentLeader(cur,'garcom',playerId)){
    html += `<div class="current-title-block title-tier-${curTier}">
      <div class="current-title-head">
        <span class="current-title-icon">🎯</span>
        <div><div class="current-title-name">Garçom atual</div><div class="current-title-count">${trophyPodiumProfileText(playerId,'garcom')}</div></div>
      </div>
      <div class="record-grid" style="margin-top:12px;">
        ${buildTitleStatCard('Mais assistências em uma rodada', r.roundAssists[0]?.value, 'assist.', null, flag.roundAssists, false, curIsGoat, curTier)}
        ${buildTitleStatCard('Mais assistências em um mês', r.monthAssists[0]?.value, 'assist.', null, flag.monthAssists, false, curIsGoat, curTier)}
      </div>
    </div>`;
  }
  return html;
}

function getLatestTitleWin(playerId, type){
  const orderedMonths = [...months].sort((a,b)=> b.startDate.localeCompare(a.startDate));
  for(const month of orderedMonths){
    const winners = computeMonthWinners(month);
    if(winners[type] !== playerId) continue;
    const isGoat = !!(winners.mvp && winners.mvp===winners.artilheiro && winners.artilheiro===winners.garcom);
    return { monthKey:computePeriodMonthKey(month.startDate, month.endDate), startDate:month.startDate, endDate:month.endDate, isGoat };
  }
  return null;
}

function getTrophyWinHistory(playerId, type){
  return [...months].sort((a,b)=>b.endDate.localeCompare(a.endDate)).flatMap(month=>{
    const winners=computeMonthWinners(month);
    const ids=winners[type+'Ids'] || (winners[type]?[winners[type]]:[]);
    if(!ids.includes(playerId)) return [];
    const totals=computeAllTotals(month.startDate,month.endDate)[playerId] || {goals:0,assists:0,ratingSum:0,ratingCount:0};
    const monthRounds=rounds.filter(round=>round.date>=month.startDate.slice(0,10) && round.date<month.endDate.slice(0,10));
    const bestRound=key=>Math.max(0,...monthRounds.map(round=>Number(round.entries?.[playerId]?.[key])||0));
    const isGoat=ids.includes(playerId) && winners.mvp===playerId && winners.artilheiro===playerId && winners.garcom===playerId;
    return [{monthKey:computePeriodMonthKey(month.startDate,month.endDate), startDate:month.startDate, endDate:month.endDate, totals, bestGoals:bestRound('goals'), bestAssists:bestRound('assists'), isGoat}];
  });
}
function buildTrophyHistoryDetails(type, wins, tierFor){
  if(wins.length<2) return '';
  const icon={mvp:'⭐',artilheiro:'⚽',garcom:'🎯'}[type];
  const label={mvp:'MVP',artilheiro:'Artilheiro',garcom:'Garçom'}[type];
  const cards=wins.map(win=>{
    const tier=tierFor(win);
    const avg=win.totals.ratingCount ? win.totals.ratingSum/win.totals.ratingCount : 0;
    const statCards=type==='mvp'
      ? [buildTitleStatCard('Pontuação',computeMvpScore(win.totals),'pts',1,false,false,false,tier),buildTitleStatCard('G/A',win.totals.goals+win.totals.assists,'G/A',null,false,false,false,tier),buildTitleStatCard('Nota média',avg,'nota',1,false,false,false,tier)]
      : type==='artilheiro'
        ? [buildTitleStatCard('Gols no mês',win.totals.goals,'gols',null,false,false,false,tier),buildTitleStatCard('Gols na melhor rodada',win.bestGoals,'gols',null,false,false,false,tier)]
        : [buildTitleStatCard('Assistências no mês',win.totals.assists,'assist.',null,false,false,false,tier),buildTitleStatCard('Assistências na melhor rodada',win.bestAssists,'assist.',null,false,false,false,tier)];
    return `<div class="trophy-win-history trophy-win-tier-${tier}"><div class="trophy-win-month">${icon} ${label} · ${monthLabel(win.monthKey)}</div><div class="record-grid">${statCards.join('')}</div></div>`;
  }).join('');
  return `<details class="trophy-history-details"><summary><span>📚 ${wins.length} conquistas · ver estatísticas de cada mês</span><span>abrir</span></summary><div class="trophy-history-body">${cards}</div></details>`;
}
function getTripleCrownWinHistory(playerId){
  return [...months].sort((a,b)=>b.endDate.localeCompare(a.endDate)).flatMap(month=>{
    const winners=computeMonthWinners(month);
    if(!(winners.mvp===playerId && winners.artilheiro===playerId && winners.garcom===playerId)) return [];
    const totals=computeAllTotals(month.startDate,month.endDate)[playerId] || {goals:0,assists:0,ratingSum:0,ratingCount:0};
    return [{monthKey:computePeriodMonthKey(month.startDate,month.endDate),startDate:month.startDate,endDate:month.endDate,totals,isGoat:true}];
  });
}
function buildTripleCrownTrophy(history, tierFor){
  if(!history.length) return '';
  const currentTier=tierFor(history[0]);
  const max=(fn)=>Math.max(...history.map(fn));
  const summary=[
    buildTitleStatCard('Maior pontuação',max(item=>computeMvpScore(item.totals)),'pts',1,false,false,currentTier==='goat',currentTier),
    buildTitleStatCard('Maior G/A',max(item=>item.totals.goals+item.totals.assists),'G/A',null,false,false,currentTier==='goat',currentTier),
    buildTitleStatCard('Maior nota média',max(item=>item.totals.ratingCount?item.totals.ratingSum/item.totals.ratingCount:0),'nota',1,false,false,currentTier==='goat',currentTier),
    buildTitleStatCard('Maior quantidade de gols em um mês',max(item=>item.totals.goals),'gols',null,false,false,currentTier==='goat',currentTier),
    buildTitleStatCard('Maior quantidade de assistências em um mês',max(item=>item.totals.assists),'assist.',null,false,false,currentTier==='goat',currentTier),
  ].join('');
  const historyHtml=history.map(item=>{
    const tier=tierFor(item);
    const avg=item.totals.ratingCount?item.totals.ratingSum/item.totals.ratingCount:0;
    return `<div class="trophy-win-history trophy-win-tier-${tier}"><div class="trophy-win-month">🐐 Tríplice Coroa · ${monthLabel(item.monthKey)}</div><div class="record-grid">${[
      buildTitleStatCard('Pontuação',computeMvpScore(item.totals),'pts',1,false,false,false,tier),
      buildTitleStatCard('G/A',item.totals.goals+item.totals.assists,'G/A',null,false,false,false,tier),
      buildTitleStatCard('Nota média',avg,'nota',1,false,false,false,tier),
      buildTitleStatCard('Gols no mês',item.totals.goals,'gols',null,false,false,false,tier),
      buildTitleStatCard('Assistências no mês',item.totals.assists,'assist.',null,false,false,false,tier),
    ].join('')}</div></div>`;
  }).join('');
  return `<div class="current-title-block title-tier-${currentTier}"><div class="current-title-head"><span class="current-title-icon">🐐</span><div><div class="current-title-name">Tríplice Coroa</div><div class="current-title-count">${history.length}x conquistada${history.length>1?'s':''}</div></div></div><div class="record-grid" style="margin-top:12px;">${summary}</div><details class="trophy-history-details"><summary><span>📚 Ver todas as Tríplices Coroas conquistadas</span><span>abrir</span></summary><div class="trophy-history-body">${historyHtml}</div></details></div>`;
}

function computeClosedMonthProfileTeamAwards(month){
  const monthRounds=rounds.filter(round=>round.date>=month.startDate.slice(0,10)&&round.date<month.endDate.slice(0,10));
  let best=null;
  monthRounds.forEach(round=>{
    (round.teamPlan?.slots||[]).forEach((slot,slotIndex)=>{
      (slot.teams||[]).forEach((team,teamIndex)=>{
        if(!Array.isArray(team)||!team.length)return;
        const stats=collectiveEntryStats(round.entries||{},team);
        const candidate={round,slot,slotIndex,teamIndex,ids:[...team],stats,value:stats.best};
        if(!best||candidate.value>best.value)best=candidate;
      });
    });
  });
  const awards=[];
  if(best){
    const substitutes=substitutePoolForTeam(best.slot,best.teamIndex).map(sub=>sub.id);
    const goalkeepers=goalkeeperIdsForSavedTeam(best.round,best.slotIndex,best.teamIndex);
    awards.push({
      playerIds:[...new Set([...best.ids,...substitutes,...goalkeepers])],
      goals:best.stats.goals,assists:best.stats.assists,ga:best.stats.ga,score:best.stats.score,
      category:{size:best.ids.length,scope:'team-round',icon:'⚽',label:'Melhor time em uma rodada'},
      position:1,
      context:`Time ${best.teamIndex+1} · ${best.round.label||'Rodada'} · ${fmtDate(best.round.date)} · ${best.slot.label||`Horário ${best.slotIndex+1}`}`
    });
  }
  const totals=computeAllTotals(month.startDate,month.endDate);
  const podiums=computePodiumData(month.startDate,month.endDate);
  const goldTypes={};
  ['mvp','artilheiro','garcom'].forEach(type=>(podiums[type]?.gold?.playerIds||[]).forEach(id=>{if(!goldTypes[id])goldTypes[id]=[];goldTypes[id].push(type)}));
  const selected=Object.keys(goldTypes);
  const goalkeeperGold=computeGoalkeeperPodium(month.startDate,month.endDate).gold[0];
  const monthRows=sortMonthCategoryRows(players.map(player=>{const total=totals[player.id];if(!total||!total.games)return null;return {p:player,...total,avg:total.ratingCount?total.ratingSum/total.ratingCount:null,participacao:total.goals+total.assists,score:computeMvpScore(total)}}).filter(Boolean),'mvp');
  monthRows.forEach(row=>{if(selected.length<4&&!selected.includes(row.p.id))selected.push(row.p.id)});
  if(goalkeeperGold&&!selected.includes(goalkeeperGold))selected.push(goalkeeperGold);
  if(selected.length){
    const stats=selected.reduce((sum,id)=>{const total=totals[id]||{};sum.goals+=total.goals||0;sum.assists+=total.assists||0;sum.score+=computeMvpScore(total);return sum},{goals:0,assists:0,score:0});
    awards.push({
      playerIds:selected,goals:stats.goals,assists:stats.assists,ga:stats.goals+stats.assists,score:stats.score,
      category:{size:selected.length,scope:'team-month',icon:'🌟',label:'Seleção do mês'},
      position:1,
      context:`${monthLabel(computePeriodMonthKey(month.startDate,month.endDate))} · ${fmtDate(month.startDate)} até ${fmtDate(month.endDate)}`
    });
  }
  return awards;
}
function getCollectiveAwardHistory(playerId){
  const categories=[
    {size:2,scope:'month',icon:'🤝',label:'Melhor dupla do mês'},
    {size:3,scope:'month',icon:'🔺',label:'Melhor trio do mês'},
    {size:2,scope:'round',icon:'⚡',label:'Melhor dupla em uma rodada'},
    {size:3,scope:'round',icon:'🔥',label:'Melhor trio em uma rodada'}
  ];
  return [...months].sort((a,b)=>b.endDate.localeCompare(a.endDate)).flatMap(month=>{
    const monthKey=computePeriodMonthKey(month.startDate,month.endDate);
    const combinationAwards=categories.flatMap(category=>{
      const ranked=category.scope==='round'
        ? computeClosedMonthRoundCombinations(month,category.size)
        : computeClosedMonthCombinations(month,category.size);
      return ranked.slice(0,3).flatMap((item,index)=>item.playerIds.includes(playerId) ? [{
        ...item,category,position:index+1,monthKey,startDate:month.startDate,endDate:month.endDate
      }] : []);
    });
    const teamAwards=computeClosedMonthProfileTeamAwards(month).filter(item=>item.playerIds.includes(playerId)).map(item=>({
      ...item,monthKey,startDate:month.startDate,endDate:month.endDate
    }));
    return [...combinationAwards,...teamAwards];
  });
}
function buildCollectiveAwardsProfileSection(playerId){
  const history=getCollectiveAwardHistory(playerId);
  if(!history.length)return '';
  const medal=[null,{icon:'🥇',label:'Ouro'},{icon:'🥈',label:'Prata'},{icon:'🥉',label:'Bronze'}];
  const podiumCounts=[1,2,3].map(position=>history.filter(item=>item.position===position).length);
  const patentContext=createRankingPatentContext();
  const companionMarkup=item=>{
    const companions=item.playerIds.filter(id=>id!==playerId);
    return `<div class="closed-combo-ranking-name"><div class="closed-combo-avatars">${companions.map(id=>`<span class="${rankingPatentClass(id,patentContext)}">${playerCircleMarkup(players.find(player=>player.id===id),'saved-team-photo',30)}</span>`).join('')}</div><strong>com ${companions.map(id=>players.find(player=>player.id===id)?.nickname||'Jogador').join(' e ')}</strong></div>`;
  };
  const cardMarkup=item=>{
    const award=medal[item.position];
    const context=['round','team-round','team-month'].includes(item.category.scope)
      ? item.context
      : `${monthLabel(item.monthKey)} · ${fmtDate(item.startDate)} até ${fmtDate(item.endDate)} · ${item.sharedRounds} rodada${item.sharedRounds!==1?'s':''} juntos`;
    return `<div class="trophy-win-history closed-podium-${['','gold','silver','bronze'][item.position]}">
      <div class="trophy-win-month">${award.icon} ${item.category.icon} ${item.category.label} · ${award.label}</div>
      ${companionMarkup(item)}
      <div class="record-context" style="margin:8px 0 10px;">${context}</div>
      <div class="mini-award-stats"><div><b>${item.score.toFixed(1)}</b><span>pontuação</span></div><div><b>${item.goals}</b><span>gols</span></div><div><b>${item.assists}</b><span>assist.</span></div><div><b>${item.ga}</b><span>G/A</span></div></div>
    </div>`;
  };
  const seasons=[...history.reduce((map,item)=>{const key=item.monthKey||`${item.startDate}|${item.endDate}`;if(!map.has(key))map.set(key,[]);map.get(key).push(item);return map},new Map())];
  const seasonHistory=seasons.map(([seasonKey,items])=>{
    const counts=[1,2,3].map(position=>items.filter(item=>item.position===position).length);
    const first=items[0];
    const label=first.monthKey?monthLabel(first.monthKey):`${fmtDate(first.startDate)} até ${fmtDate(first.endDate)}`;
    return `<details class="trophy-history-details collective-season-details"><summary><span>📅 Temporada · ${label}</span><span>${items.length} troféu${items.length!==1?'s':''} · 🥇 ${counts[0]} · 🥈 ${counts[1]} · 🥉 ${counts[2]}</span></summary><div class="trophy-history-body">${items.map(cardMarkup).join('')}</div></details>`;
  }).join('');
  return `<div class="current-title-block title-tier-normal">
    <div class="current-title-head"><span class="current-title-icon">🏆</span><div><div class="current-title-name">Prêmios coletivos</div><div class="current-title-count">${history.length} pódio${history.length!==1?'s':''} · 🥇 ${podiumCounts[0]} · 🥈 ${podiumCounts[1]} · 🥉 ${podiumCounts[2]}</div></div></div>
    <div class="collective-season-list">${seasonHistory}</div>
  </div>`;
}

function buildPermanentTitlesSection(playerId, r, flag){
  const counts = getTrophyCounts()[playerId] || {mvp:0, artilheiro:0, garcom:0};
  const lastMvp = getLatestTitleWin(playerId, 'mvp');
  const lastArtilheiro = getLatestTitleWin(playerId, 'artilheiro');
  const lastGarcom = getLatestTitleWin(playerId, 'garcom');
  const secretSets = computeSecretRecordSets();
  const titleTier = (last)=>{
    if(!last) return 'normal';
    const frozen=frozenSpecialTier(playerId,last);
    if(frozen==='cosmic') return frozen;
    if(isCosmicInstance(playerId,last,secretSets.cosmicMonthSet)) return 'cosmic';
    if(frozen==='platinum') return frozen;
    if(last.isGoat) return 'goat';
    if(isPlatinumInstance(playerId,secretSets.platinumPlayerSet,last)) return 'platinum';
    if(frozen) return frozen;
    return 'normal';
  };
  const lastMvpTier = titleTier(lastMvp);
  const lastArtilheiroTier = titleTier(lastArtilheiro);
  const lastGarcomTier = titleTier(lastGarcom);
  const mvpHistory=getTrophyWinHistory(playerId,'mvp');
  const artilheiroHistory=getTrophyWinHistory(playerId,'artilheiro');
  const garcomHistory=getTrophyWinHistory(playerId,'garcom');
  const maxHistory=(history, getter)=>history.length ? Math.max(...history.map(getter)) : 0;
  const mvpScoreMax=maxHistory(mvpHistory,item=>computeMvpScore(item.totals));
  const mvpGaMax=maxHistory(mvpHistory,item=>item.totals.goals+item.totals.assists);
  const mvpAvgMax=maxHistory(mvpHistory,item=>item.totals.ratingCount ? item.totals.ratingSum/item.totals.ratingCount : 0);
  const artGoalsMax=maxHistory(artilheiroHistory,item=>item.totals.goals);
  const artBestRoundMax=maxHistory(artilheiroHistory,item=>item.bestGoals);
  const garAssistsMax=maxHistory(garcomHistory,item=>item.totals.assists);
  const garBestRoundMax=maxHistory(garcomHistory,item=>item.bestAssists);
  let html = '';
  if(counts.mvp > 0){
    html += `<div class="current-title-block title-tier-${lastMvpTier}">
      <div class="current-title-head">
        <span class="current-title-icon">⭐</span>
        <div><div class="current-title-name">Troféu MVP</div><div class="current-title-count">${trophyPodiumProfileText(playerId,'mvp')}${lastMvp ? `<span class="profile-last-win">Último 1º lugar: ${monthLabel(lastMvp.monthKey)}${lastMvpTier==='cosmic' ? ' · 🌌 Mês Perfeito' : (lastMvpTier==='platinum' ? ' · 💠 Colecionador' : (lastMvpTier==='goat' ? ' · 🐐 GOAT' : ''))}</span>` : ''}</div></div>
      </div>
      <div class="record-grid" style="margin-top:12px;">
        ${buildTitleStatCard('Maior pontuação como MVP', mvpScoreMax, 'pts', 1, false, false, false, lastMvpTier)}
        ${buildTitleStatCard('Maior G/A como MVP', mvpGaMax, 'G/A', null, false, false, false, lastMvpTier)}
        ${buildTitleStatCard('Melhor nota média como MVP', mvpAvgMax, 'nota', 1, false, false, false, lastMvpTier)}
      </div>
      ${buildTrophyHistoryDetails('mvp',mvpHistory,titleTier)}
    </div>`;
  }
  if(counts.artilheiro > 0){
    html += `<div class="current-title-block title-tier-${lastArtilheiroTier}">
      <div class="current-title-head">
        <span class="current-title-icon">⚽</span>
        <div><div class="current-title-name">Troféu Artilheiro</div><div class="current-title-count">${trophyPodiumProfileText(playerId,'artilheiro')}${lastArtilheiro ? `<span class="profile-last-win">Último 1º lugar: ${monthLabel(lastArtilheiro.monthKey)}${lastArtilheiroTier==='cosmic' ? ' · 🌌 Mês Perfeito' : (lastArtilheiroTier==='platinum' ? ' · 💠 Colecionador' : (lastArtilheiroTier==='goat' ? ' · 🐐 GOAT' : ''))}</span>` : ''}</div></div>
      </div>
      <div class="record-grid" style="margin-top:12px;">
        ${buildTitleStatCard('Mais gols como artilheiro', artGoalsMax, 'gols', null, false, false, false, lastArtilheiroTier)}
        ${buildTitleStatCard('Gols na melhor rodada', artBestRoundMax, 'gols', null, false, false, false, lastArtilheiroTier)}
      </div>
      ${buildTrophyHistoryDetails('artilheiro',artilheiroHistory,titleTier)}
    </div>`;
  }
  if(counts.garcom > 0){
    html += `<div class="current-title-block title-tier-${lastGarcomTier}">
      <div class="current-title-head">
        <span class="current-title-icon">🎯</span>
        <div><div class="current-title-name">Troféu Garçom</div><div class="current-title-count">${trophyPodiumProfileText(playerId,'garcom')}${lastGarcom ? `<span class="profile-last-win">Último 1º lugar: ${monthLabel(lastGarcom.monthKey)}${lastGarcomTier==='cosmic' ? ' · 🌌 Mês Perfeito' : (lastGarcomTier==='platinum' ? ' · 💠 Colecionador' : (lastGarcomTier==='goat' ? ' · 🐐 GOAT' : ''))}</span>` : ''}</div></div>
      </div>
      <div class="record-grid" style="margin-top:12px;">
        ${buildTitleStatCard('Mais assistências como garçom', garAssistsMax, 'assist.', null, false, false, false, lastGarcomTier)}
        ${buildTitleStatCard('Assistências na melhor rodada', garBestRoundMax, 'assist.', null, false, false, false, lastGarcomTier)}
      </div>
      ${buildTrophyHistoryDetails('garcom',garcomHistory,titleTier)}
    </div>`;
  }
  return html;
}

function buildReigningTitlesSection(playerId){
  const secretSets = computeSecretRecordSets();
  const officialSpecial=latestClosedSpecialPatentSets();
  const latestClosed = months.length ? [...months].sort((a,b)=>b.endDate.localeCompare(a.endDate))[0] : null;
  const latestClosedKey = latestClosed ? computePeriodMonthKey(latestClosed.startDate, latestClosed.endDate) : '';
  const reigning = computeReigningTitles();
  const latestAwardPlayerIds = new Set(['mvp','artilheiro','garcom'].flatMap(type=>reigning?.[type]?.playerIds||[reigning?.[type]?.playerId]).filter(Boolean));
  const rb = computeReigningBadgesFor(reigning, playerId);
  let secretHtml = '';
  if(officialSpecial.cosmic.has(playerId)){
    secretHtml += `<div class="cosmic-block has-watermark" data-wm="COSMIC">
      <div class="current-title-head">
        <span class="current-title-icon">🌌</span>
        <div><div class="current-title-name">COSMIC reinante</div><div class="current-title-count">Mês Perfeito do último mês encerrado.</div></div>
      </div>
    </div>`;
  }
  if(officialSpecial.collector.has(playerId)){
    secretHtml += `<div class="platinum-block has-watermark" data-wm="COL">
      <div class="current-title-head"><span class="current-title-icon">💠</span><div><div class="current-title-name">Colecionador reinante</div><div class="current-title-count">Conquista oficial do último mês encerrado — vale até o próximo fechamento.</div></div></div>
    </div>`;
  }
  if(!reigning) return secretHtml;
  if(rb.isGoat && !officialSpecial.collector.has(playerId)){
    return secretHtml + `<div class="goat-block has-watermark" data-wm="GOAT">
      <div class="current-title-head">
        <span class="current-title-icon">🐐</span>
        <div><div class="current-title-name">${GOAT_TITLE} — Tríplice Coroa</div><div class="current-title-count">MVP + Artilheiro + Garçom de ${monthLabel(reigning.mvp.monthKey)}, tudo pro mesmo jogador — vale até o próximo fechamento do mês</div></div>
      </div>
    </div>`;
  }
  if(!rb.titles.length) return secretHtml;
  const reigningTitleTier=officialSpecial.cosmic.has(playerId)?'cosmic':(officialSpecial.collector.has(playerId)?'platinum':(hasReigningPrismaticPerformance(playerId)?'prismatic':'normal'));
  return secretHtml + rb.titles.map(t=>{
    const monthKeySrc = reigning[t.key].monthKey;
    return `<div class="current-title-block title-tier-${reigningTitleTier} has-watermark" data-wm="${reigningTitleTier==='platinum'?'COL':t.wm}">
      <div class="current-title-head">
        <span class="current-title-icon">👑</span>
        <div><div class="current-title-name${reigningTitleTier==='normal'?' shine-gold':''}">${t.name}</div><div class="current-title-count">${t.label} oficial de ${monthLabel(monthKeySrc)} — vale até o próximo fechamento do mês</div></div>
      </div>
    </div>`;
  }).join('');
}

function buildPlayerAttributesSection(playerId){
  const p = players.find(player=>player.id===playerId);
  if(!p) return '';
  const secretSets = computeSecretRecordSets();
  const officialSpecial=latestClosedSpecialPatentSets();
  const reigning = computeReigningTitles();
  const rb = computeReigningBadgesFor(reigning, playerId);
  const tier = officialSpecial.cosmic.has(playerId) ? 'cosmic' : (officialSpecial.collector.has(playerId) ? 'platinum' : (rb.isGoat ? 'goat' : 'normal'));
  const cardClass = tier==='cosmic' ? ' record-card-cosmic' : (tier==='platinum' ? ' record-card-platinum' : (tier==='goat' ? ' record-card-goat' : ' record-racha'));
  const badgeParts = [];
  if(officialSpecial.cosmic.has(playerId)) badgeParts.push('<div class="cosmic-badge">🌌 COSMIC</div>');
  if(officialSpecial.collector.has(playerId)) badgeParts.push('<div class="platinum-badge">💠 Colecionador</div>');
  if(rb.isGoat) badgeParts.push('<div class="goat-badge">🐐 GOAT</div>');
  if(!badgeParts.length) badgeParts.push('<div class="racha-badge">🏆 Perfil do jogador</div>');
  const badge = badgeParts.join('');
  const attrs = [['VEL','velocidade'],['DRI','drible'],['FIN','chute'],['DEF','marcacao'],['PAS','passe'],['FÍS','contato']];
  const effectiveAttrs = effectivePlayerAttributes(p);
  return `<div class="table-title">Estatísticas do jogador</div><div class="record-grid"><div class="record-card${cardClass}" style="grid-column:1 / -1;">${badge}<div class="record-label">Overall automático</div><div class="record-value">${formatOverall(playerOverall(p))}<small>OVR</small></div><div class="player-attributes">${attrs.map(([label,key])=>`<div><b>${effectiveAttrs[key]}</b>${label}</div>`).join('')}</div></div></div>`;
}

function buildGoalkeeperPersonalRecordsSection(playerId){
  const player=players.find(item=>item.id===playerId);
  if(!player||!['goalkeeper','hybrid'].includes(player.role))return {gamesCount:0,html:''};
  const career=computeGoalkeeperPeriodStats(null,null)[playerId]||{games:0,wins:0,draws:0,losses:0,saves:0,cleanSheets:0,goalsConceded:0,goals:0,assists:0,points:0,average:4};
  if(!career.games)return {gamesCount:0,html:'<div class="table-title">🧤 Recordes pessoais de goleiro</div><div class="empty">Ainda não há partidas registradas para esta pessoa como goleiro.</div>'};
  const roundEntries=[],matchEntries=[];
  rounds.forEach(round=>{
    const stat=round.simulatorStats?.goalkeepers?.[playerId];
    if(stat&&(Number(stat.games)||0)>0){
      const games=Number(stat.games)||0,wins=Number(stat.wins)||0,saves=Number(stat.saves)||0,cleanSheets=Number(stat.cleanSheets)||0,goalsConceded=Number(stat.goalsConceded)||0,goals=Number(stat.goals)||0,assists=Number(stat.assists)||0;
      const points=wins*2+cleanSheets*4+saves*2+goals*.5+assists*.4;
      const cleanRate=games?cleanSheets/games:0,involvement=games?Math.min(1,(goals*.5+assists*.4)/games):0,defense=games?Math.max(0,1-(goalsConceded/games)*.25):0;
      const average=Math.max(4,Math.min(10,4+wins*.2+saves*.3+cleanRate*2+involvement+defense));
      roundEntries.push({round,games,wins,saves,cleanSheets,goalsConceded,goals,assists,points,average});
    }
    (round.simulatorStats?.goalkeeperMatches||[]).filter(item=>String(item.playerId)===String(playerId)).forEach(item=>matchEntries.push({round,matchNumber:Number(item.matchNumber)||0,saves:Number(item.saves)||0,goalsConceded:Number(item.goalsAgainst)||0}));
  });
  const monthEntries=months.map(month=>{const stat=computeGoalkeeperPeriodStats(month.startDate,month.endDate)[playerId];return stat&&stat.games?{...stat,monthKey:computePeriodMonthKey(month.startDate,month.endDate),startDate:month.startDate,endDate:month.endDate}:null}).filter(Boolean);
  const pick=(list,key,dir='max',positive=false)=>{const source=positive?list.filter(item=>Number(item[key])>0):list;if(!source.length)return[];const target=(dir==='min'?Math.min:Math.max)(...source.map(item=>Number(item[key])||0));return source.filter(item=>(Number(item[key])||0)===target).map(item=>({...item,value:Number(item[key])||0}))};
  const global=computeGoalkeeperRecords(),holds=list=>(list||[]).some(item=>String(item.playerId)===String(playerId));
  const careerHtml=`<div class="table-title">🧤 Recordes pessoais de goleiro — carreira</div><div class="record-grid">${buildPersonalTotalCard('Partidas como goleiro',career.games,'partidas')}${buildPersonalTotalCard('Vitórias como goleiro',career.wins,'vitórias')}${buildPersonalTotalCard('Total de defesas',career.saves,'defesas')}${buildPersonalTotalCard('Jogos sem sofrer gol',career.cleanSheets,'jogos')}${buildPersonalTotalCard('Pontos de goleiro',career.points.toFixed(1),'pts')}${buildPersonalTotalCard('Participações em gols',career.goals+career.assists,'G/A')}</div>`;
  const matchHtml=`<div class="table-title">Recordes pessoais de goleiro — partida</div><div class="record-grid">${buildPersonalRecordCard('Mais defesas em uma partida',pick(matchEntries,'saves','max',true),'defesas',null,holds(global.matchSaves))}${buildPersonalRecordCard('Menos gols sofridos em uma partida',pick(matchEntries,'goalsConceded','min'),'gols',null)}</div>`;
  const roundHtml=`<div class="table-title">Recordes pessoais de goleiro — rodada</div><div class="record-grid">${buildPersonalRecordCard('Melhor rodada como goleiro',pick(roundEntries,'points'),'pts',1,holds(global.bestRound))}${buildPersonalRecordCard('Mais defesas em uma rodada',pick(roundEntries,'saves','max',true),'defesas',null,holds(global.roundSaves))}${buildPersonalRecordCard('Mais jogos sem sofrer gol em uma rodada',pick(roundEntries,'cleanSheets'),'jogos',null)}${buildPersonalRecordCard('Menos gols sofridos em uma rodada',pick(roundEntries,'goalsConceded','min'),'gols',null,holds(global.leastRound))}${buildPersonalRecordCard('Melhor nota de goleiro em uma rodada',pick(roundEntries,'average'),'nota',2)}</div>`;
  const monthHtml=`<div class="table-title">Recordes pessoais de goleiro — mês</div><div class="record-grid">${buildPersonalRecordCard('Maior pontuação de goleiro em um mês',pick(monthEntries,'points'),'pts',1)}${buildPersonalRecordCard('Mais defesas em um mês',pick(monthEntries,'saves','max',true),'defesas',null,holds(global.monthSaves))}${buildPersonalRecordCard('Mais jogos sem sofrer gol em um mês',pick(monthEntries,'cleanSheets'),'jogos',null)}${buildPersonalRecordCard('Menos gols sofridos em um mês',pick(monthEntries,'goalsConceded','min'),'gols',null,holds(global.leastMonth))}${buildPersonalRecordCard('Melhor nota de goleiro em um mês',pick(monthEntries,'average'),'nota',2)}</div>`;
  return {gamesCount:career.games,html:`<div class="goalkeeper-personal-records">${careerHtml}${matchHtml}${roundHtml}${monthHtml}</div>`};
}

function buildPlayerRecordsSection(playerId){
  const r = computePlayerRecords(playerId);
  const player=players.find(item=>item.id===playerId);
  const goalkeeperRecords=buildGoalkeeperPersonalRecordsSection(playerId);
  if(r.gamesCount===0&&goalkeeperRecords.gamesCount===0){
    return buildPlayerAttributesSection(playerId) + '<div class="empty">Este jogador ainda não tem nenhuma rodada registrada.</div>';
  }

  const g = computeRecords();
  const streaksAll = computeTitleStreaks();
  const brokenStatsAll = computeMostRecordsBrokenStats();
  const secretAll = computeSecretRecords(g, streaksAll, brokenStatsAll);
  const holdsGlobal = (list)=> list.some(item=>item.playerId===playerId);
  const flag = {
    roundScore: holdsGlobal(g.roundScore),
    roundGoals: holdsGlobal(g.roundGoals),
    roundAssists: holdsGlobal(g.roundAssists),
    roundParticipacao: holdsGlobal(g.roundParticipacao),
    monthGoals: holdsGlobal(g.monthGoals),
    monthAssists: holdsGlobal(g.monthAssists),
    monthParticipacao: holdsGlobal(g.monthParticipacao),
    monthScore: holdsGlobal(g.monthScore),
    monthAvgRating: hasPrismaticPerformance(playerId, g),
    monthRatingTen: holdsGlobal(g.monthRatingTen),
    ratingTen: holdsGlobal(g.ratingTen),
    allTimeGoals: holdsGlobal(g.allTimeGoals),
    allTimeAssists: holdsGlobal(g.allTimeAssists),
    allTimeParticipacao: holdsGlobal(g.allTimeParticipacao),
    tripleCrown: computeTripleCrownRecordHolders().includes(playerId),
    streakMvp: holdsGlobal(streaksAll.mvp),
    streakArtilheiro: holdsGlobal(streaksAll.artilheiro),
    streakGarcom: holdsGlobal(streaksAll.garcom),
    streakGoat: holdsGlobal(streaksAll.goat),
    roundBrokenRecords: holdsGlobal(brokenStatsAll.roundBrokenRecords),
    monthBrokenRecords: holdsGlobal(brokenStatsAll.monthBrokenRecords),
    colecionador: holdsGlobal(secretAll.colecionador),
    mesPerfeito: holdsGlobal(secretAll.mesPerfeito),
  };

  const GOAT_RECORD_KEYS = new Set(['tripleCrown', 'streakGoat']);
  const COSMIC_RECORD_KEYS = new Set(['mesPerfeito']);
  const PLATINUM_RECORD_KEYS = new Set(['colecionador']);
  const chipDefs = [
    [flag.allTimeGoals, 'Maior artilheiro (histórico)', 'allTimeGoals'],
    [flag.allTimeAssists, 'Maior garçom (histórico)', 'allTimeAssists'],
    [flag.allTimeParticipacao, 'Maior participador (G/A) (histórico)', 'allTimeParticipacao'],
    [flag.roundGoals, 'Mais gols em uma rodada', 'roundGoals'],
    [flag.roundAssists, 'Mais assistências em uma rodada', 'roundAssists'],
    [flag.roundParticipacao, 'Maior G/A em uma rodada', 'roundParticipacao'],
    [flag.roundScore, 'Melhor rodada (maior pontuação)', 'roundScore'],
    [flag.monthGoals, 'Mais gols em um mês', 'monthGoals'],
    [flag.monthAssists, 'Mais assistências em um mês', 'monthAssists'],
    [flag.monthParticipacao, 'Maior G/A em um mês', 'monthParticipacao'],
    [flag.monthScore, 'Maior pontuação em um mês', 'monthScore'],
    [flag.monthAvgRating, 'Melhor performance em um mês (nota média)', 'monthAvgRating'],
    [flag.monthRatingTen, 'Mais vezes com nota 10 em um mês', 'monthRatingTen'],
    [flag.ratingTen, 'Mais vezes com nota 10', 'ratingTen'],
    [flag.tripleCrown, 'Mais tríplice coroas do racha', 'tripleCrown'],
    [flag.streakMvp, 'Mais meses seguidos como MVP', 'streakMvp'],
    [flag.streakArtilheiro, 'Mais meses seguidos como artilheiro', 'streakArtilheiro'],
    [flag.streakGarcom, 'Mais meses seguidos como garçom', 'streakGarcom'],
    [flag.streakGoat, 'Mais meses seguidos como GOAT', 'streakGoat'],
    [flag.roundBrokenRecords, 'Mais recordes quebrados numa rodada', 'roundBrokenRecords'],
    [flag.monthBrokenRecords, 'Mais recordes quebrados num mês', 'monthBrokenRecords'],
    [flag.colecionador, 'Colecionador (recorde secreto)', 'colecionador'],
    [flag.mesPerfeito, 'Mês Perfeito (recorde secreto)', 'mesPerfeito'],
  ].filter(([has])=>has).map(([,label,key])=>({
    label,
    style: GOAT_RECORD_KEYS.has(key) ? 'goat'
      : COSMIC_RECORD_KEYS.has(key) ? 'cosmic'
      : PLATINUM_RECORD_KEYS.has(key) ? 'platinum'
      : (key==='monthAvgRating' ? 'prismatic' : (PRISMATIC_RECORD_KEYS.has(key) ? 'prismatic' : 'normal')),
  }));

  const rachaBanner = chipDefs.length ? `
    <div class="table-title">🏆 Recordes do racha</div>
    <div class="racha-record-banner">
      ${chipDefs.map(c=>{
        const icon = c.style==='goat' ? '🐐' : c.style==='cosmic' ? '🌌' : c.style==='platinum' ? '💠' : (c.style==='prismatic' ? '💎' : '🏆');
        const cls = c.style==='goat' ? ' chip-goat' : c.style==='cosmic' ? ' chip-cosmic' : c.style==='platinum' ? ' chip-platinum' : (c.style==='prismatic' ? ' chip-prismatic' : '');
        return `<span class="racha-record-chip${cls}">${icon} ${c.label}</span>`;
      }).join('')}
    </div>` : '';

  const tripleCrownSetForPlayer = new Set(computeTripleCrownHistory().map(c=> c.playerId+'|'+c.monthKey));
  const personalSecretSets = {
    cosmicMonthSet: createCosmicMonthSet(secretAll.mesPerfeito||[]),
    platinumPlayerSet: createPlatinumPlayerSet(secretAll.colecionador),
  };
  const personalTier = (item, fallback='normal')=>{
    const frozen=frozenSpecialTier(playerId,item);
    if(frozen==='cosmic') return frozen;
    if(isCosmicInstance(playerId, item, personalSecretSets.cosmicMonthSet)) return 'cosmic';
    if(frozen==='platinum') return frozen;
    if(isPlatinumInstance(playerId, personalSecretSets.platinumPlayerSet, item)) return 'platinum';
    if(frozen) return frozen;
    if(isGoatInstance(playerId, item, tripleCrownSetForPlayer)) return 'goat';
    return titleTierAtRecord(playerId,item) || fallback;
  };

  let ratingCardHtml;
  if(!r.ratingRecord){
    ratingCardHtml = `<div class="record-card record-empty"><div class="record-label">Nota máxima pessoal</div>Sem notas registradas</div>`;
  } else {
    ratingCardHtml = buildPersonalRecordCard(
      'Nota máxima pessoal', r.ratingRecordEntries, 'nota', 1,
      flag.ratingTen, false, item=>personalTier(item)
    );
  }
  const currentTitlesHtml = buildCurrentTitlesSection(playerId, r, flag);
  const permanentTitlesHtml = buildPermanentTitlesSection(playerId, r, flag);
  const reigningTitlesHtml = buildReigningTitlesSection(playerId);
  const tripleCrownTrophyHtml = buildTripleCrownTrophy(getTripleCrownWinHistory(playerId), personalTier);
  const collectiveAwardsHtml = buildCollectiveAwardsProfileSection(playerId);
  const collector = (secretAll.colecionador||[]).find(item=>item.playerId===playerId);
  const perfectMonths = (secretAll.mesPerfeito||[]).filter(item=>item.playerId===playerId);
  const secretProfileHtml = (collector || perfectMonths.length) ? `
    <div class="table-title">🔒 Conquistas secretas</div>
    <div class="record-grid">
      ${perfectMonths.length ? `<div class="record-card record-card-cosmic"><div class="cosmic-badge">🌌 Mês Perfeito</div><div class="record-label">Conquista cósmica</div><div class="record-value">${perfectMonths.length}<small>x conquistado</small></div><div class="record-context">${perfectMonths.map(item=>monthLabel(item.monthKey)).join(' · ')}</div></div>` : ''}
      ${collector ? `<div class="record-card record-card-platinum"><div class="platinum-badge">💠 Colecionador</div><div class="record-label">Todas as categorias oficiais</div><div class="record-value">${collector.value}<small>categorias</small></div><div class="record-context">Conquistado independentemente da quantidade de marcas obtidas no mês</div></div>` : ''}
    </div>` : '';

  const careerRecordsHtml = `
    <div class="table-title">Recordes pessoais — carreira</div>
    <div class="record-grid">
      ${buildPersonalTotalCard('Maior artilheiro (histórico)', r.careerGoals, 'gols', flag.allTimeGoals, flag.allTimeGoals)}
      ${buildPersonalTotalCard('Maior garçom (histórico)', r.careerAssists, 'assist.', flag.allTimeAssists, flag.allTimeAssists)}
      ${buildPersonalTotalCard('Maior participador (G/A) (histórico)', r.careerParticipacao, 'G/A', flag.allTimeParticipacao, flag.allTimeParticipacao)}
    </div>`;
  const roundRecordsHtml = `
    <div class="table-title">Recordes pessoais — rodada</div>
    <div class="record-grid">
      ${buildPersonalRecordCard('Melhor rodada (maior pontuação)', r.bestRound, 'pts', 1, flag.roundScore, false, item=>personalTier(item))}
      ${buildPersonalRecordCard('Pior rodada', r.worstRound, 'pts', 1)}
      ${buildPersonalRecordCard('Mais gols em uma rodada', r.roundGoals, 'gols', null, flag.roundGoals, false, item=>personalTier(item))}
      ${buildPersonalRecordCard('Mais assistências em uma rodada', r.roundAssists, 'assist.', null, flag.roundAssists, false, item=>personalTier(item))}
      ${buildPersonalRecordCard('Maior G/A em uma rodada', r.roundParticipacao, 'G/A', null, flag.roundParticipacao, false, item=>personalTier(item))}
      ${ratingCardHtml}
    </div>`;
  const monthRecordsHtml = `
    <div class="table-title">Recordes pessoais — mês</div>
    <div class="record-grid">
      ${buildPersonalRecordCard('Mais gols em um mês', r.monthGoals, 'gols', null, flag.monthGoals, false, item=>personalTier(item))}
      ${buildPersonalRecordCard('Mais assistências em um mês', r.monthAssists, 'assist.', null, flag.monthAssists, false, item=>personalTier(item))}
      ${buildPersonalRecordCard('Maior G/A em um mês', r.monthParticipacao, 'G/A', null, flag.monthParticipacao, false, item=>personalTier(item))}
      ${buildPersonalRecordCard('Maior pontuação em um mês', r.monthScore, 'pts', 1, flag.monthScore, false, item=>personalTier(item))}
      ${buildPersonalRecordCard('Melhor performance em um mês (nota média)', r.monthAvgRating, 'nota', 1, flag.monthAvgRating, flag.monthAvgRating, item=>personalTier(item, isPrismaticRecord('monthAvgRating',item) ? 'prismatic' : 'normal'))}
      ${buildPersonalRecordCard('Mais vezes com nota 10 em um mês', r.monthRatingTen, 'x', null, flag.monthRatingTen, false, item=>personalTier(item))}
    </div>`;
  const profileSection=(icon,title,subtitle,content,open=false,extra='')=>content ? `<details class="profile-section ${extra}"${open?' open':''}>
    <summary><span class="profile-section-icon">${icon}</span><span class="profile-section-title"><b>${title}</b><small>${subtitle}</small></span><span class="profile-section-toggle"></span></summary>
    <div class="profile-section-body">${content}</div>
  </details>` : '';
  const achievementHtml=reigningTitlesHtml+currentTitlesHtml+secretProfileHtml;
  const individualTrophiesHtml=permanentTitlesHtml+tripleCrownTrophyHtml;
  const lineRecordsHtml=player?.role==='goalkeeper'?'':rachaBanner+careerRecordsHtml+roundRecordsHtml+monthRecordsHtml;
  const recordsHtml=lineRecordsHtml+goalkeeperRecords.html;
  return `<div class="profile-sections">
    ${profileSection('👑','Conquistas e patentes','Títulos reinantes, conquistas atuais e patentes especiais.',achievementHtml,true,'profile-section-highlight')}
    ${profileSection('🏆','Troféus individuais','MVP, Artilheiro, Garçom e Tríplice Coroa com todo o histórico.',individualTrophiesHtml)}
    ${profileSection('👥','Prêmios coletivos','Times, seleções, duplas e trios conquistados jogando juntos.',collectiveAwardsHtml)}
    ${profileSection('💎','Recordes pessoais','Carreira, rodadas, meses e recordes oficiais do racha.',recordsHtml)}
  </div>`;
}

let detailPlayerId = null;
let detailShowOriginalStats = false;
let detailShowGoalkeeperView = false;
let comparisonPlayerIds = [];
let comparisonBonusEnabled = {};
let comparisonSelectionMode = false;
let suppressOverlayPop = false;
let exitBackArmed = false;
let exitBackTimer = null;
if(!history.state?.rachaAppRoot) history.replaceState({...history.state, rachaAppRoot:true}, '');
history.pushState({...history.state, rachaExitGuard:true}, '');
function pushOverlayHistory(kind){ history.pushState({...history.state,rachaOverlay:kind},''); }
function goToRoster(){
  const rosterTab = document.querySelector('.tab-btn[data-tab="elenco"]');
  if(rosterTab && !rosterTab.classList.contains('active')) rosterTab.click();
}
function closePlayerDetail(fromHistory=false){
  $('playerDetailOverlay').classList.remove('active');
  goToRoster();
  if(!fromHistory && history.state?.rachaOverlay==='player-detail'){ suppressOverlayPop=true; history.back(); }
}
function closePhotoZoom(fromHistory=false){
  $('photoZoomOverlay').classList.remove('active');
  if(!fromHistory && history.state?.rachaOverlay==='photo-zoom'){ suppressOverlayPop=true; history.back(); }
}
function updateComparisonCardSelection(){document.querySelectorAll('.player-card').forEach(card=>card.classList.toggle('is-comparison-selected',comparisonPlayerIds.includes(card.dataset.id)));$('playerGrid')?.classList.toggle('comparison-selection-mode',comparisonSelectionMode);const button=$('btnStartComparison');if(button){button.classList.toggle('btn-primary',comparisonSelectionMode);button.textContent=comparisonSelectionMode?`Cancelar comparação · ${comparisonPlayerIds.length}/2`:'⇄ Comparar jogadores'}}
function closePlayerComparison(clearSelection=true){$('playerComparisonOverlay').classList.remove('active');if(clearSelection){comparisonPlayerIds=[];comparisonBonusEnabled={};comparisonSelectionMode=false;updateComparisonCardSelection()}}
function beginComparisonSelection(initialPlayerId=null){
  $('playerComparisonOverlay').classList.remove('active');
  comparisonPlayerIds=initialPlayerId?[initialPlayerId]:[];
  comparisonBonusEnabled=initialPlayerId?{[initialPlayerId]:true}:{};
  comparisonSelectionMode=true;
  goToRoster();
  updateComparisonCardSelection();
  showToast(initialPlayerId?'Agora escolha a segunda pessoa para comparar.':'Toque em dois cards para comparar.');
}
function selectPlayerForComparison(playerId){
  if(comparisonPlayerIds.includes(playerId)){comparisonPlayerIds=comparisonPlayerIds.filter(id=>id!==playerId);delete comparisonBonusEnabled[playerId];updateComparisonCardSelection();showToast('Jogador removido da comparação.');return}
  if(comparisonPlayerIds.length>=2){comparisonPlayerIds=[];comparisonBonusEnabled={}}
  comparisonPlayerIds.push(playerId);comparisonBonusEnabled[playerId]=true;updateComparisonCardSelection();
  if(comparisonPlayerIds.length<2){showToast('Agora escolha a segunda pessoa para comparar.');return}
  comparisonSelectionMode=false;updateComparisonCardSelection();renderPlayerComparison();$('playerComparisonOverlay').classList.add('active');
}
function comparisonAttributeRows(player,withBonus){
  const effective=effectivePlayerAttributes(player),goalkeeperEffective=effectiveGoalkeeperAttributes(player),line=[['Velocidade','velocidade'],['Drible','drible'],['Finalização','chute'],['Marcação','marcacao'],['Passe','passe'],['Físico','contato']],goalkeeper=[['Reflexo','reflexo'],['Posicionamento','posicionamentoGol'],['Um contra um','umContraUm'],['Jogo aéreo','jogoAereo'],['Reposição','reposicao'],['Saída do gol','saidaGol']],sections=[];
  if(player.role!=='goalkeeper')sections.push(`<div class="comparison-section-title">Jogador · ${formatOverall(withBonus?playerOverall(player):basePlayerOverall(player))} OVR</div><div class="comparison-attributes">${line.map(([label,key])=>`<div class="comparison-value"><span>${label}</span><b>${Math.round(withBonus?effective[key]:player[key])}</b></div>`).join('')}</div>`);
  if(player.role==='goalkeeper'||player.role==='hybrid')sections.push(`<div class="comparison-section-title">Goleiro · ${formatOverall(withBonus?goalkeeperOverall(player):weightedPlayerAttributeAverage(player,GOALKEEPER_ATTRIBUTE_KEYS,GOALKEEPER_ATTRIBUTE_WEIGHTS))} OVR</div><div class="comparison-attributes">${goalkeeper.map(([label,key])=>`<div class="comparison-value"><span>${label}</span><b>${Math.round(Number(withBonus?goalkeeperEffective[key]:player[key])||0)}</b></div>`).join('')}</div>`);
  return sections.join('');
}
function comparisonResultTotals(playerId,sinceDate=null){return rounds.reduce((total,round)=>{if(sinceDate&&String(round.date||'')<String(sinceDate).slice(0,10))return total;const stat=round.simulatorStats?.players?.[playerId];if(stat){total.games+=Number(stat.games)||0;total.wins+=Number(stat.wins)||0;total.draws+=Number(stat.draws)||0;total.losses+=Number(stat.losses)||0;total.ownGoals+=Number(stat.ownGoals)||0}return total},{games:0,wins:0,draws:0,losses:0,ownGoals:0})}
function comparisonPlayerMarkup(player,totals){
  const withBonus=comparisonBonusEnabled[player.id]!==false,avg=totals.ratingCount?totals.ratingSum/totals.ratingCount:null,score=computeMvpScore(totals),results=comparisonResultTotals(player.id);
  return `<section class="comparison-player"><div class="comparison-player-head">${player.photo?circlePhotoMarkup(player,'badge-photo',52):`<div class="mvp-fb">${initials(player.name)}</div>`}<div><h3>${player.nickname}</h3><div class="small muted">${player.name}</div></div></div><label class="small"><input type="checkbox" data-comparison-bonus="${player.id}" ${withBonus?'checked':''}> Aplicar bônus desta pessoa</label>${comparisonAttributeRows(player,withBonus)}<div class="comparison-section-title">Estatísticas</div><div class="comparison-attributes"><div class="comparison-value"><span>Rodadas</span><b>${totals.games||0}</b></div><div class="comparison-value"><span>Gols</span><b>${totals.goals||0}</b></div><div class="comparison-value"><span>Assistências</span><b>${totals.assists||0}</b></div><div class="comparison-value"><span>Nota média</span><b>${avg===null?'—':avg.toFixed(1)}</b></div><div class="comparison-value"><span>Pontuação</span><b>${score.toFixed(1)}</b></div><div class="comparison-value"><span>Faltas</span><b>${totals.absences||0}</b></div><div class="comparison-value"><span>Vitórias</span><b>${results.wins}</b></div><div class="comparison-value"><span>Empates</span><b>${results.draws}</b></div><div class="comparison-value"><span>Derrotas</span><b>${results.losses}</b></div><div class="comparison-value"><span>Gols contra</span><b>${results.ownGoals}</b></div></div></section>`;
}
function comparisonMetricValue(player,key,withBonus,totals,results){const effective=effectivePlayerAttributes(player),goalkeeperEffective=effectiveGoalkeeperAttributes(player);if(key==='lineOverall')return player.role==='goalkeeper'?null:Number(withBonus?playerOverall(player):basePlayerOverall(player));if(key==='goalkeeperOverall')return ['goalkeeper','hybrid'].includes(player.role)?Number(withBonus?goalkeeperOverall(player):weightedPlayerAttributeAverage(player,GOALKEEPER_ATTRIBUTE_KEYS,GOALKEEPER_ATTRIBUTE_WEIGHTS)):null;if(PLAYER_ATTRIBUTE_KEYS.includes(key))return player.role==='goalkeeper'?null:Number(withBonus?effective[key]:player[key]);if(GOALKEEPER_ATTRIBUTE_KEYS.includes(key))return ['goalkeeper','hybrid'].includes(player.role)?Number(withBonus?goalkeeperEffective[key]:player[key])||0:null;if(key==='rating')return totals.ratingCount?totals.ratingSum/totals.ratingCount:null;if(key==='score')return computeMvpScore(totals);if(key==='games')return Number(totals.games)||0;if(key in results)return Number(results[key])||0;return Number(totals[key])||0}
function comparisonValueMarkup(value,otherValue,lowerBetter=false,decimals=0,useAttributeScale=false){if(value===null||value===undefined)return '<span class="comparison-missing">—</span>';const numeric=Number(value),other=otherValue===null||otherValue===undefined?null:Number(otherValue),wins=other!==null&&(lowerBetter?numeric<other:numeric>other),equal=other!==null&&numeric===other,difference=wins?Math.abs(numeric-other):0,formatted=decimals?numeric.toFixed(decimals):String(Math.round(numeric)),ratingClass=useAttributeScale?(numeric<=69?'comparison-rating-red':numeric<=79?'comparison-rating-orange':numeric<=89?'comparison-rating-green':'comparison-rating-cyan'):(other===null?'comparison-stat-lower':wins?'comparison-stat-higher':equal?'comparison-stat-equal':'comparison-stat-lower');return `<b class="${wins?'comparison-advantage ':''}${ratingClass}">${formatted}${wins?` <small>+${decimals?difference.toFixed(decimals):Math.round(difference)}</small>`:''}</b>`}
function renderPlayerComparison(){
  const selected=comparisonPlayerIds.map(id=>players.find(player=>player.id===id)).filter(Boolean),allTotals=computeAllTotals(),openTotals=computeAllTotals(periodStart);if(selected.length!==2)return;
  const bothEnabled=selected.every(player=>comparisonBonusEnabled[player.id]!==false),totals=selected.map(player=>allTotals[player.id]||{}),results=selected.map(player=>comparisonResultTotals(player.id)),currentTotals=selected.map(player=>openTotals[player.id]||{}),currentResults=selected.map(player=>comparisonResultTotals(player.id,periodStart)),hasGoalkeepers=selected.some(player=>['goalkeeper','hybrid'].includes(player.role));
  const groups=[{label:'OVR',metrics:[['OVR jogador','lineOverall'],...(hasGoalkeepers?[['OVR goleiro','goalkeeperOverall']]:[])]},{label:'Atributos de jogador',metrics:[['Velocidade','velocidade'],['Drible','drible'],['Finalização','chute'],['Marcação','marcacao'],['Passe','passe'],['Físico','contato']]},...(hasGoalkeepers?[{label:'Atributos de goleiro',metrics:[['Reflexo','reflexo'],['Posicionamento','posicionamentoGol'],['Um contra um','umContraUm'],['Jogo aéreo','jogoAereo'],['Reposição','reposicao'],['Saída do gol','saidaGol']]}]:[]),{label:'Mês aberto · temporada atual',metrics:[['Rodadas nesta temporada','games',false,0,'current'],['Gols nesta temporada','goals',false,0,'current'],['Assistências nesta temporada','assists',false,0,'current'],['Nota média atual','rating',false,1,'current'],['Pontuação atual','score',false,1,'current'],['Vitórias atuais','wins',false,0,'current'],['Empates atuais','draws',false,0,'current'],['Derrotas atuais','losses',true,0,'current']]},{label:'Estatísticas gerais',metrics:[['Rodadas','games'],['Gols','goals'],['Assistências','assists'],['Nota média','rating',false,1],['Pontuação','score',false,1],['Vitórias','wins'],['Empates','draws'],['Derrotas','losses',true],['Gols contra','ownGoals',true],['Faltas','absences',true]]}];
  const rows=groups.map(group=>{const useAttributeScale=group.label==='OVR'||group.label.startsWith('Atributos');return `<div class="comparison-table-group">${group.label}</div>${group.metrics.map(([label,key,lowerBetter=false,decimals=0,scope='all'])=>{const sourceTotals=scope==='current'?currentTotals:totals,sourceResults=scope==='current'?currentResults:results,values=selected.map((player,index)=>comparisonMetricValue(player,key,comparisonBonusEnabled[player.id]!==false,sourceTotals[index],sourceResults[index]));return `<div class="comparison-table-row"><span>${label}</span>${values.map((value,index)=>comparisonValueMarkup(value,values[index===0?1:0],lowerBetter,decimals,useAttributeScale)).join('')}</div>`}).join('')}`}).join('');
  $('playerComparisonContent').innerHTML=`<div class="comparison-global-controls"><label><input type="checkbox" id="comparisonBonusBoth" ${bothEnabled?'checked':''}> Aplicar bônus nos dois</label><button type="button" class="btn btn-ghost btn-sm" id="resetComparisonPlayers">Escolher outras pessoas</button></div><div class="comparison-table"><div class="comparison-table-head"><span>Comparação</span>${selected.map(player=>`<div><span class="comparison-head-avatar">${player.photo?circlePhotoMarkup(player,'badge-photo',48):`<span class="mvp-fb">${initials(player.name)}</span>`}</span><b>${player.nickname}</b><label><input type="checkbox" data-comparison-bonus="${player.id}" ${comparisonBonusEnabled[player.id]!==false?'checked':''}> Bônus</label></div>`).join('')}</div>${rows}</div>`;
  $('comparisonBonusBoth').addEventListener('change',event=>{selected.forEach(player=>comparisonBonusEnabled[player.id]=event.target.checked);renderPlayerComparison()});
  document.querySelectorAll('[data-comparison-bonus]').forEach(input=>input.addEventListener('change',()=>{comparisonBonusEnabled[input.dataset.comparisonBonus]=input.checked;renderPlayerComparison()}));
  $('resetComparisonPlayers').addEventListener('click',()=>beginComparisonSelection());
}
function buildPdHeaderTheme(playerId){
  const secretSets = computeSecretRecordSets();
  const officialSpecial=latestClosedSpecialPatentSets();
  const latestClosed = months.length ? [...months].sort((a,b)=>b.endDate.localeCompare(a.endDate))[0] : null;
  const latestClosedKey = latestClosed ? computePeriodMonthKey(latestClosed.startDate, latestClosed.endDate) : '';
  const reigning = computeReigningTitles();
  const latestAwardPlayerIds = new Set(['mvp','artilheiro','garcom'].flatMap(type=>reigning?.[type]?.playerIds||[reigning?.[type]?.playerId]).filter(Boolean));
  const rb = computeReigningBadgesFor(reigning, playerId);
  const titleSuffix = rb.isGoat ? ' · 🐐 GOAT do mês' : (rb.titles.length ? ` · 👑 ${rb.titles.map(t=>t.name).join(' + ')}` : '');
  if(officialSpecial.cosmic.has(playerId)){
    return {
      themeClass: ' pd-summary-themed pd-summary-cosmic', wm: 'COSMIC',
      eyebrowHtml: `<div class="pd-eyebrow">🌌 MÊS PERFEITO — CONQUISTA CÓSMICA${officialSpecial.collector.has(playerId) ? ' · 💠 COLECIONADOR' : ''}${titleSuffix}</div>`, badgesHtml: '',
    };
  }
  if(rb.isGoat && !officialSpecial.collector.has(playerId)){
    return {
      themeClass: ' pd-summary-themed pd-summary-goat', wm: 'GOAT',
      eyebrowHtml: `<div class="pd-eyebrow">🐐 ${GOAT_TITLE} — TRÍPLICE COROA${officialSpecial.collector.has(playerId) ? ' · 💠 COLECIONADOR' : ''}</div>`, badgesHtml: '',
    };
  }
  if(officialSpecial.collector.has(playerId)){
    return {
      themeClass: ' pd-summary-themed pd-summary-platinum', wm: 'COL',
      eyebrowHtml: `<div class="pd-eyebrow">💠 COLECIONADOR — CONQUISTA DO ÚLTIMO MÊS${titleSuffix}</div>`, badgesHtml: '',
    };
  }
  if(hasReigningPrismaticPerformance(playerId)){
    return {
      themeClass: ' pd-summary-themed pd-summary-prismatic', wm: 'PRISM',
      eyebrowHtml: '<div class="pd-eyebrow">💎 PERFORMANCE MÁXIMA — NOTA MÉDIA 10</div>',
      badgesHtml: '<div class="pd-title-badges"><span class="prismatic-badge">💎 Recorde raro</span></div>',
    };
  }
  if(rb.titles.length){
    return {
      themeClass: ' pd-summary-themed pd-summary-titled',
      wm: rb.titles.map(t=>t.wm).join(' · '),
      eyebrowHtml: `<div class="pd-eyebrow">👑 ${rb.titles.map(t=>t.name.toUpperCase()).join(' · ')}</div>`,
      badgesHtml: `<div class="pd-title-badges">${rb.titles.map(t=>`<span class="reigning-badge">👑 ${t.name}</span>`).join('')}</div>`,
    };
  }
  return { themeClass:'', wm:'', eyebrowHtml:'', badgesHtml:'' };
}
function openPlayerDetail(playerId, showOriginalStats=false, showGoalkeeperView=false){
  const p = players.find(pp=>pp.id===playerId);
  if(!p) return;
  const wasOpen = $('playerDetailOverlay').classList.contains('active');
  detailPlayerId = playerId;
  detailShowOriginalStats = showOriginalStats;
  detailShowGoalkeeperView = p.role==='hybrid'&&showGoalkeeperView;
  const totals = computeAllTotals();
  const t = totals[p.id] || {goals:0, assists:0, ratingSum:0, ratingCount:0, games:0};
  const disciplineState=computeDisciplineStatus()[p.id] || {yellowCard:false,yellowRoundsRemaining:0,suspendedRounds:0};
  const disciplineProfile=disciplineState.suspendedRounds
    ? `<div class="discipline-profile-card suspended">🟥 <b>CARTÃO VERMELHO — SUSPENSO</b><br>Fora por ${disciplineState.suspendedRounds} rodada. A suspensão termina após a próxima rodada salva.</div>`
    : (disciplineState.yellowCard ? `<div class="discipline-profile-card warning">🟨 <b>CARTÃO AMARELO</b><br>Faltam ${disciplineState.yellowRoundsRemaining} rodada${disciplineState.yellowRoundsRemaining!==1?'s':''} jogada${disciplineState.yellowRoundsRemaining!==1?'s':''} para o amarelo ser removido. Outra falta sem justificar antes disso gera vermelho.</div>` : '');
  const avg = t.ratingCount ? (t.ratingSum/t.ratingCount) : null;
  const score = computeMvpScore(t);
  const effectiveAttrs = effectivePlayerAttributes(p);
  const boosts = getPlayerBoosts(p.id);
  const overall = playerOverall(p);
  const baseOverall = basePlayerOverall(p);
  const goalkeeperBoosts=getGoalkeeperBoosts(p.id),goalkeeperEffective=effectiveGoalkeeperAttributes(p),baseGoalkeeperOverall=weightedPlayerAttributeAverage(p,GOALKEEPER_ATTRIBUTE_KEYS,GOALKEEPER_ATTRIBUTE_WEIGHTS),goalkeeperView=detailShowGoalkeeperView,hasGoalkeeperBonus=GOALKEEPER_ATTRIBUTE_KEYS.some(key=>goalkeeperBoosts[key]>0),hasPatentBonus=goalkeeperView?hasGoalkeeperBonus:PLAYER_ATTRIBUTE_KEYS.some(key=>boosts[key]>0),displayOverall=goalkeeperView?(showOriginalStats?baseGoalkeeperOverall:goalkeeperOverall(p)):(showOriginalStats?baseOverall:overall);
  const attributeDefinitions=goalkeeperView?[['REF','reflexo'],['POS','posicionamentoGol'],['1X1','umContraUm'],['AÉR','jogoAereo'],['REP','reposicao'],['SAÍ','saidaGol']]:[['VEL','velocidade'],['DRI','drible'],['FIN','chute'],['DEF','marcacao'],['PAS','passe'],['FÍS','contato']];
  const attributesHtml = attributeDefinitions.map(([label,key])=>{const value=goalkeeperView?(showOriginalStats?p[key]:goalkeeperEffective[key]):(showOriginalStats?p[key]:effectiveAttrs[key]),bonus=goalkeeperView?goalkeeperBoosts[key]:boosts[key];return `<div><b>${value}</b>${showOriginalStats&&bonus>0?`<em>+${bonus}</em>`:''}${label}</div>`}).join('');
  const goalkeeperTotals=computeGoalkeeperPeriodStats(null,null)[p.id]||{games:0,wins:0,saves:0,cleanSheets:0,goalsConceded:0,points:0,average:4};
  const profileStatsHtml=goalkeeperView?`<div><b>${goalkeeperTotals.games}</b><span>partidas no gol</span></div><div><b>${goalkeeperTotals.wins}</b><span>vitórias</span></div><div><b>${goalkeeperTotals.saves}</b><span>defesas</span></div><div><b>${goalkeeperTotals.cleanSheets}</b><span>sem sofrer gol</span></div><div><b>${goalkeeperTotals.goalsConceded}</b><span>gols sofridos</span></div><div><b>${goalkeeperTotals.points.toFixed(1)}</b><span>pontos de goleiro</span></div><div><b>${goalkeeperTotals.average.toFixed(2)}</b><span>nota de goleiro</span></div>`:`<div><b>${t.games}</b><span>rodadas</span></div><div><b>${t.goals}</b><span>gols</span></div><div><b>${t.assists}</b><span>assist.</span></div><div><b>${avg!==null ? avg.toFixed(1) : '—'}</b><span>nota média</span></div><div><b>${score.toFixed(1)}</b><span>pontuação</span></div><div><b>${t.absences||0}</b><span>faltas</span></div>`;
  const theme = buildPdHeaderTheme(playerId);
  const header = $('playerDetailHeader');
  const detailClosedPodiumMedal=playerClosedPodiumMedal(detailPlayerId);
  const detailPodiumMedal=playerCurrentPodiumMedal(detailPlayerId);
  header.className = 'pd-summary' + theme.themeClass + (detailClosedPodiumMedal==='silver'?' is-achievement-silver':detailClosedPodiumMedal==='bronze'?' is-achievement-bronze':(isCurrentGoat(computeCurrentPeriodStats(),detailPlayerId) ? ' is-goat-contender' : (detailPodiumMedal==='gold'?' is-current-gold':detailPodiumMedal==='silver'?' is-current-silver':detailPodiumMedal==='bronze'?' is-current-bronze':((effectiveAttrs.isContender || isCurrentTitleContender(detailPlayerId)) ? ' is-contender' : ''))));
  if(theme.wm) header.setAttribute('data-wm', theme.wm); else header.removeAttribute('data-wm');
  header.innerHTML = `
    ${theme.eyebrowHtml}
    <div class="pd-overall"><b>${formatOverall(displayOverall)}</b><span>${goalkeeperView?'OVR GOL':'OVR JOG'}</span>${showOriginalStats&&(goalkeeperView?formatOverall(goalkeeperOverall(p))!==formatOverall(baseGoalkeeperOverall):formatOverall(overall)!==formatOverall(baseOverall))?`<em>+${goalkeeperView?(goalkeeperOverall(p)-baseGoalkeeperOverall).toFixed(1):Math.round(overall)-Math.round(baseOverall)}</em>`:''}</div>
    ${p.role==='hybrid'?`<button type="button" class="pd-role-toggle" id="btnToggleHybridRole">${goalkeeperView?'Ver como jogador':'Ver como goleiro'}</button>`:''}
    ${p.photo ? circlePhotoMarkup(p,'mvp-photo',96) : `<div class="mvp-fb">${initials(p.name)}</div>`}
    <div class="mvp-name">${p.nickname}</div>
    <div class="mvp-real">${p.name}</div>
    ${theme.badgesHtml}
    <div class="player-attributes">${attributesHtml}</div>
    <div class="mvp-stats" style="margin-top:18px;">
      ${profileStatsHtml}
    </div>
    ${hasPatentBonus ? `<button type="button" class="pd-stats-toggle" id="btnToggleProfileStats">${showOriginalStats ? 'Ver atuais' : 'Ver originais'}</button>` : ''}`;
  const statsToggle=$('btnToggleProfileStats');
  if(statsToggle) statsToggle.addEventListener('click', event=>{ event.stopPropagation(); openPlayerDetail(playerId,!detailShowOriginalStats,detailShowGoalkeeperView); });
  const roleToggle=$('btnToggleHybridRole');
  if(roleToggle) roleToggle.addEventListener('click',event=>{event.stopPropagation();openPlayerDetail(playerId,false,!detailShowGoalkeeperView)});
  $('playerDetailRecords').innerHTML = disciplineProfile + buildPlayerRecordsSection(playerId);
  $('btnEditFromDetail').style.display = isAdmin ? 'inline-block' : 'none';
  if(!wasOpen) pushOverlayHistory('player-detail');
  $('playerDetailOverlay').classList.add('active');
}
$('playerDetailOverlay').addEventListener('click', event=>{
  if(event.target===$('playerDetailOverlay')) closePlayerDetail();
});
$('btnClosePlayerDetail').addEventListener('click', ()=> closePlayerDetail());
$('btnCompareFromDetail').addEventListener('click',()=>{
  const playerId=detailPlayerId;
  closePlayerDetail();
  beginComparisonSelection(playerId);
});
$('btnStartComparison').addEventListener('click',()=>{comparisonSelectionMode=!comparisonSelectionMode;comparisonPlayerIds=[];comparisonBonusEnabled={};updateComparisonCardSelection();showToast(comparisonSelectionMode?'Toque em dois cards para comparar.':'Comparação cancelada.')});
$('playerComparisonOverlay').addEventListener('click',event=>{if(event.target===$('playerComparisonOverlay'))closePlayerComparison(true)});
$('btnClosePlayerComparison').addEventListener('click',()=>closePlayerComparison(true));
function openPhotoZoom(src, alt, tier='normal'){
  if(!src) return;
  $('photoZoomImage').src = src;
  $('photoZoomImage').alt = alt || 'Foto ampliada do jogador';
  $('photoZoomImage').className = tier==='normal' ? '' : `tier-${tier}`;
  $('photoZoomOverlay').className = `overlay tier-${tier}`;
  if(!$('photoZoomOverlay').classList.contains('active')) pushOverlayHistory('photo-zoom');
  $('photoZoomOverlay').classList.add('active');
}
$('photoZoomOverlay').addEventListener('click', event=>{
  if(event.target===$('photoZoomOverlay')) closePhotoZoom();
});
window.addEventListener('popstate', ()=>{
  if(suppressOverlayPop){ suppressOverlayPop=false; return; }
  if($('photoZoomOverlay').classList.contains('active')){
    closePhotoZoom(true);
    return;
  }
  if($('playerDetailOverlay').classList.contains('active')){
    closePlayerDetail(true);
    return;
  }
  if(exitBackArmed){
    exitBackArmed=false;
    history.back();
    return;
  }
  exitBackArmed=true;
  showToast('Toque em Voltar novamente para sair.');
  history.pushState({...history.state, rachaExitGuard:true}, '');
  clearTimeout(exitBackTimer);
  exitBackTimer=setTimeout(()=>{ exitBackArmed=false; }, 2200);
});
document.addEventListener('click', event=>{
  const image = event.target.closest('.badge-photo,.entry-row img,.pd-summary .mvp-photo,.record-player img,.mini-award-photo');
  if(!image) return;
  const zoomImage = image.tagName==='IMG' ? image : image.querySelector('img');
  if(!zoomImage) return;
  event.preventDefault();
  event.stopPropagation();
  const tier = image.closest('.is-cosmic,.pd-summary-cosmic') ? 'cosmic'
    : (image.closest('.is-platinum,.pd-summary-platinum') ? 'platinum'
    : (image.closest('.is-goat,.pd-summary-goat') ? 'goat' : 'normal'));
  openPhotoZoom(zoomImage.src, zoomImage.alt, tier);
}, true);
document.addEventListener('click', event=>{
  const card = event.target.closest('.record-card');
  if(!card || !card.querySelector('.record-tie-note')) return;
  if(event.target.closest('button,a,input,label')) return;
  card.classList.toggle('show-tie-details');
});
$('btnEditFromDetail').addEventListener('click', ()=>{
  closePlayerDetail();
  const p = players.find(pp=>pp.id===detailPlayerId);
  if(p) openPlayerModal(p);
});
