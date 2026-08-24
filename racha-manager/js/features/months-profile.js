function computeLastMonthAwardsData(){
  if(!months.length) return null;
  const latest = [...months].sort((a,b)=> b.endDate.localeCompare(a.endDate))[0];
  const w = computeMonthWinners(latest);
  const totals = computeAllTotals(latest.startDate, latest.endDate);
  const monthKey = computePeriodMonthKey(latest.startDate, latest.endDate);

  const result = { monthId: latest.id, startDate: latest.startDate, endDate: latest.endDate };
  ['mvp','artilheiro','garcom'].forEach(type=>{
    const pid = w[type];
    if(!pid){ result[type] = null; return; }
    const t = totals[pid];
    if(!t || !t.games){ result[type] = null; return; }
    const avg = t.ratingCount ? t.ratingSum/t.ratingCount : null;
    result[type] = {
      playerId: pid,
      playerIds: w[type+'Ids'] || [pid],
      goals: t.goals,
      assists: t.assists,
      ga: t.goals + t.assists,
      avg,
      score: computeMvpScore(t),
      monthKey,
    };
    if(type==='artilheiro'){
      const bestRound = computeBestRoundStat(pid, 'goals', latest.startDate, latest.endDate);
      result[type].roundBestGoals = bestRound!=null ? bestRound : 0;
    }
    if(type==='garcom'){
      const bestRound = computeBestRoundStat(pid, 'assists', latest.startDate, latest.endDate);
      result[type].roundBestAssists = bestRound!=null ? bestRound : 0;
    }
  });
  if(!result.mvp && !result.artilheiro && !result.garcom) return null;
  return result;
}
function computeReigningTitles(){
  const data = computeLastMonthAwardsData();
  if(!data) return null;
  const isGoat = !!(data.mvp && data.artilheiro && data.garcom &&
    data.mvp.playerId === data.artilheiro.playerId &&
    data.artilheiro.playerId === data.garcom.playerId);
  return { ...data, isGoat, goatPlayerId: isGoat ? data.mvp.playerId : null };
}
function computeReigningBadgesFor(reigning, playerId){
  if(!reigning) return { isGoat:false, titles:[] };
  const isGoat = !!(reigning.isGoat && reigning.goatPlayerId===playerId);
  if(isGoat) return { isGoat:true, titles:[] };
  const titles = [];
  if(reigning.mvp && (reigning.mvp.playerIds||[reigning.mvp.playerId]).includes(playerId)) titles.push({key:'mvp', icon:'⭐', name:REIGNING_MVP_TITLE, wm:'MVP', label:'MVP'});
  if(reigning.artilheiro && (reigning.artilheiro.playerIds||[reigning.artilheiro.playerId]).includes(playerId)) titles.push({key:'artilheiro', icon:'⚽', name:REIGNING_ART_TITLE, wm:'GOL', label:'Artilheiro'});
  if(reigning.garcom && (reigning.garcom.playerIds||[reigning.garcom.playerId]).includes(playerId)) titles.push({key:'garcom', icon:'🎯', name:REIGNING_GAR_TITLE, wm:'ASS', label:'Garçom'});
  return { isGoat:false, titles };
}

function computeTripleCrownHistory(){
  const crowns = [];
  months.forEach(month=>{
    const w = computeMonthWinners(month);
    if(w.mvp && w.artilheiro && w.garcom && w.mvp===w.artilheiro && w.artilheiro===w.garcom){
      crowns.push({
        playerId: w.mvp,
        monthKey: computePeriodMonthKey(month.startDate, month.endDate),
        startDate: month.startDate,
        endDate: month.endDate
      });
    }
  });
  return crowns;
}
function computePlayerTripleCrownCount(playerId){
  return computeTripleCrownHistory().filter(c=>c.playerId===playerId).length;
}
function computeTripleCrownRecordHolders(){
  const crowns = computeTripleCrownHistory();
  if(!crowns.length) return [];
  const counts = {};
  crowns.forEach(c=> counts[c.playerId] = (counts[c.playerId]||0) + 1);
  const max = Math.max(...Object.values(counts));
  if(max<=0) return [];
  return Object.keys(counts).filter(pid=> counts[pid]===max);
}

function computeLastMonthRecordBadges(data, globalRec, secretSets){
  const result = {};
  const matchMonth = (list, monthKey, playerId)=> list.some(item=> item.monthKey===monthKey && item.playerId===playerId);
  const matchCareer = (list, playerId)=> list.some(item=> item.playerId===playerId);
  const matchRoundInPeriod = (list, playerId)=> list.some(item=> item.playerId===playerId && item.round &&
    item.round.date >= data.startDate.slice(0,10) && item.round.date < data.endDate.slice(0,10));

  if(data.mvp){
    const {playerId, monthKey} = data.mvp;
    const scoreBroken = matchMonth(globalRec.monthScore, monthKey, playerId);
    const gaBroken = matchMonth(globalRec.monthParticipacao, monthKey, playerId);
    const avgBroken = globalRec.monthAvgRating.some(item=>item.monthKey===monthKey && item.playerId===playerId && Number(item.value)===10);
    const broken = [];
    if(scoreBroken) broken.push({label:'Maior pontuação em um mês', prismatic:false});
    if(gaBroken) broken.push({label:'Maior G/A em um mês', prismatic:false});
    if(avgBroken) broken.push({label:'Melhor nota média em um mês', prismatic:true});
    result.mvp = { scoreBroken, gaBroken, avgBroken, broken, count:broken.length, isPrismatic: avgBroken };
  }
  if(data.artilheiro){
    const {playerId, monthKey} = data.artilheiro;
    const monthGoalsBroken = matchMonth(globalRec.monthGoals, monthKey, playerId);
    const roundGoalsBroken = matchRoundInPeriod(globalRec.roundGoals, playerId);
    const allTimeGoalsBroken = matchCareer(globalRec.allTimeGoals, playerId);
    const broken = [];
    if(monthGoalsBroken) broken.push({label:'Mais gols em um mês', prismatic:false});
    if(roundGoalsBroken) broken.push({label:'Mais gols em uma rodada', prismatic:false});
    result.artilheiro = { goalsBroken: monthGoalsBroken || allTimeGoalsBroken, goalsPrismatic: allTimeGoalsBroken, roundGoalsBroken, broken, count:broken.length, isPrismatic: false };
  }
  if(data.garcom){
    const {playerId, monthKey} = data.garcom;
    const monthAssistsBroken = matchMonth(globalRec.monthAssists, monthKey, playerId);
    const roundAssistsBroken = matchRoundInPeriod(globalRec.roundAssists, playerId);
    const allTimeAssistsBroken = matchCareer(globalRec.allTimeAssists, playerId);
    const broken = [];
    if(monthAssistsBroken) broken.push({label:'Mais assistências em um mês', prismatic:false});
    if(roundAssistsBroken) broken.push({label:'Mais assistências em uma rodada', prismatic:false});
    result.garcom = { assistsBroken: monthAssistsBroken || allTimeAssistsBroken, assistsPrismatic: allTimeAssistsBroken, roundAssistsBroken, broken, count:broken.length, isPrismatic: false };
  }
  const monthRounds = rounds.filter(r=> r.date >= data.startDate.slice(0,10) && r.date < data.endDate.slice(0,10));
  const monthBroken = computeMonthBrokenRecords(monthRounds, globalRec, secretSets);
  ['mvp','artilheiro','garcom'].forEach(type=>{
    if(!data[type]) return;
    const current = result[type] || {broken:[], count:0, isPrismatic:false};
    const combined = [...current.broken, ...monthBroken.filter(item=> item.playerId===data[type].playerId)];
    const awardIds = data[type].playerIds || [data[type].playerId];
    const performanceMax = awardIds.some(playerId=>
      frozenSpecialTier(playerId,{monthKey:data[type].monthKey})==='prismatic' ||
      globalRec.monthAvgRating.some(item=>item.playerId===playerId && item.monthKey===data[type].monthKey && Number(item.value)===10)
    );
    if(performanceMax && !combined.some(item=>item.label==='Melhor performance em um mês (nota média)')){
      combined.push({playerId:data[type].playerId,label:'Melhor performance em um mês (nota média)',value:10,unit:'nota',prismatic:true});
    }
    const seen = new Set();
    const broken = combined.filter(item=>{
      if(seen.has(item.label)) return false;
      seen.add(item.label);
      return true;
    });
    result[type] = {...current, broken, count:broken.length, isPrismatic:performanceMax || broken.some(item=>item.prismatic)};
  });
  return result;
}
function renderMiniAwardStat(row){
  let cls = '';
  if(row.broken){
    const tier = row.tier || (row.prismatic ? 'prismatic' : 'gold');
    cls = `stat-${tier} stat-highlight`;
  }
  return `<div><b class="${cls}">${row.val}</b><span>${row.unit}</span></div>`;
}
function buildRecordBrokenExtrasLegacy(b){
  if(!b || !b.count) return { badgeHtml:'', chipsHtml:'' };
  const badgeHtml = `<div class="${b.isPrismatic?'prismatic-badge':'racha-badge'}">${b.isPrismatic?'💎':'🏆'} ${b.count} recorde${b.count>1?'s':''} quebrado${b.count>1?'s':''}</div>`;
  const chipsHtml = `<div class="mini-award-records">${b.broken.map(x=>`<div class="round-record-chip${x.prismatic?' chip-prismatic':''}">${x.prismatic?'💎':'🏆'} ${x.label}</div>`).join('')}</div>`;
  return { badgeHtml, chipsHtml };
}
function buildRecordBrokenExtras(b){
  if(!b || !b.count) return { badgeHtml:'', chipsHtml:'' };
  const icon=b.isPrismatic?'💎':'🏆';
  const badgeHtml = '';
  const chipsHtml = `<details class="mini-award-records"><summary>${renderBrokenRecordCountBadge(b.broken)}</summary><div class="mini-award-record-list">${b.broken.map(x=>`<div class="round-record-chip${x.prismatic?' chip-prismatic':''}">${x.prismatic?'💎':'🏆'} ${x.label}</div>`).join('')}</div></details>`;
  return { badgeHtml, chipsHtml };
}
function buildLastMonthCard(wm, icon, label, data, statRows, badge, tier, podiumMedal='gold'){
  if(data.playerIds && data.playerIds.length>1){
    return data.playerIds.map(playerId=>buildLastMonthCard(wm,icon,label,{...data,playerId,playerIds:[playerId]},statRows,badge,tier)).join('');
  }
  const p = players.find(pl=>pl.id===data.playerId);
  const pname = p ? p.nickname : 'Jogador removido';
  const preal = p ? p.name : '';
  const monthPhoto = (p && p.photo) ? monthCardPhotoMarkup(p) : '<span class="month-photo-shade"></span>';
  const pphoto = (p && p.photo) ? '' : `<div class="mini-award-fb">${p?initials(p.name):'?'}</div>`;
  const photoClass = p?.photo ? ' has-month-card-photo' : '';
  const statsHtml = statRows.map(row=>renderMiniAwardStat({...row, tier:row.broken ? (tier || undefined) : undefined})).join('');
  const b = badge || {count:0, isPrismatic:false};
  const {badgeHtml, chipsHtml} = buildRecordBrokenExtras(b);
  if(tier==='cosmic' || tier==='platinum'){
    const cardClass = tier==='cosmic' ? ' card-cosmic' : ' card-platinum';
    const tierBadge = tier==='cosmic' ? `<div class="cosmic-badge">🌌 Mês Perfeito</div>` : `<div class="platinum-badge">💠 Colecionador</div>`;
    return `<div class="mini-award-card${cardClass}${photoClass} closed-podium-${podiumMedal}" data-wm="${wm}">
      <div class="mini-award-eyebrow">${icon} ${label}</div>
      ${monthPhoto}
      ${pphoto}
      <div class="mini-award-name">${pname}</div>
      <div class="mini-award-real">${preal}</div>
      ${tierBadge}
      ${badgeHtml}
      <div class="mini-award-stats">${statsHtml}</div>
      ${chipsHtml}
      <div class="mini-award-context">${monthLabel(data.monthKey)}</div>
    </div>`;
  }
  const cardClass = podiumMedal==='silver' ? ' card-silver'
    : podiumMedal==='bronze' ? ' card-bronze'
    : tier==='goat' ? ' card-goat'
    : (tier==='prismatic' || b.isPrismatic ? ' card-prismatic' : ' card-gold');
  const tierBadge = tier==='goat' ? '<div class="goat-badge">🐐 GOAT do mês</div>' : '';
  return `<div class="mini-award-card${cardClass}${photoClass} closed-podium-${podiumMedal}" data-wm="${wm}">
    <div class="mini-award-eyebrow">${icon} ${label}</div>
    ${monthPhoto}
    ${pphoto}
    <div class="mini-award-name">${pname}</div>
    <div class="mini-award-real">${preal}</div>
    ${tierBadge}
    ${badgeHtml}
    <div class="mini-award-stats">${statsHtml}</div>
    ${chipsHtml}
    <div class="mini-award-context">${monthLabel(data.monthKey)}</div>
  </div>`;
}
function buildLastMonthGoatCard(data, badgeMap, secretSets){
  const playerId = data.mvp.playerId;
  const p = players.find(pl=>pl.id===playerId);
  const pname = p ? p.nickname : 'Jogador removido';
  const preal = p ? p.name : '';
  const monthPhoto = (p && p.photo) ? monthCardPhotoMarkup(p) : '<span class="month-photo-shade"></span>';
  const pphoto = (p && p.photo) ? '' : `<div class="mini-award-fb">${p?initials(p.name):'?'}</div>`;
  const photoClass = p?.photo ? ' has-month-card-photo' : '';
  const bm = badgeMap.mvp || {broken:[]}, ba = badgeMap.artilheiro || {broken:[]}, bg = badgeMap.garcom || {broken:[]};
  const tier = secretSets ? secretTierForLastMonth(playerId, data.mvp.monthKey, secretSets, data) : null;
  const statRows = [
    {broken:bm.scoreBroken, prismatic:false, val:data.mvp.score.toFixed(1), unit:'pontuação'},
    {broken:ba.goalsBroken, prismatic:ba.goalsPrismatic, val:data.artilheiro.goals, unit:'gols'},
    {broken:bg.assistsBroken, prismatic:bg.assistsPrismatic, val:data.garcom.assists, unit:'assist.'},
    {broken:bm.gaBroken, prismatic:false, val:data.mvp.ga, unit:'G/A'},
    {broken:bm.avgBroken, prismatic:true, val: data.mvp.avg!==null ? data.mvp.avg.toFixed(1) : '—', unit:'nota média'},
    {broken:ba.roundGoalsBroken, prismatic:false, val:data.artilheiro.roundBestGoals, unit:'maior quantidade de gols em uma rodada'},
    {broken:bg.roundAssistsBroken, prismatic:false, val:data.garcom.roundBestAssists, unit:'maior quantidade de assistências em uma rodada'},
  ];
  const statsHtml = statRows.map(row=>renderMiniAwardStat({...row, tier:row.broken ? (tier || 'goat') : undefined})).join('');
  const context = `MVP + Artilheiro + Garçom de ${monthLabel(data.mvp.monthKey)}`;
  const seen = new Set();
  const broken = [...bm.broken, ...ba.broken, ...bg.broken].filter(x=>{
    if(seen.has(x.label)) return false;
    seen.add(x.label);
    return true;
  });
  const hasPrismatic = broken.some(x=>x.prismatic);
  const badgeHtml = '';
  const chipsHtml = broken.length ? `<details class="mini-award-records"><summary>${renderBrokenRecordCountBadge(broken,true)}</summary><div class="mini-award-record-list">${broken.map(x=>`<div class="round-record-chip${x.prismatic?' chip-prismatic':''}">${x.prismatic?'💎':'🏆'} ${x.label}</div>`).join('')}</div></details>` : '';
  if(tier==='cosmic' || tier==='platinum'){
    const cardClass = tier==='cosmic' ? ' card-cosmic' : ' card-platinum';
    const wm = tier==='cosmic' ? 'MP' : 'COL';
    const eyebrow = tier==='cosmic' ? '🌌 Mês Perfeito' : '💠 Colecionador';
    const tierBadge = tier==='cosmic' ? `<div class="cosmic-badge">🌌 Mês Perfeito</div>` : `<div class="platinum-badge">💠 Colecionador</div>`;
    return `<div class="mini-award-card${cardClass}${photoClass}" data-wm="${wm}" style="grid-column:1 / -1;">
      <div class="mini-award-eyebrow">${eyebrow}</div>
      ${monthPhoto}
      ${pphoto}
      <div class="mini-award-name">${pname}</div>
      <div class="mini-award-real">${preal}</div>
      ${tierBadge}
      ${badgeHtml}
      <div class="mini-award-stats">${statsHtml}</div>
      ${chipsHtml}
      <div class="mini-award-context">${context} · também foi ${GOAT_TITLE}</div>
    </div>`;
  }
  return `<div class="mini-award-card card-goat${photoClass}" data-wm="GOAT" style="grid-column:1 / -1;">
    <div class="mini-award-eyebrow">🐐 ${GOAT_TITLE} do mês passado</div>
    ${monthPhoto}
    ${pphoto}
    <div class="mini-award-name">${pname}</div>
    <div class="mini-award-real">${preal}</div>
    ${badgeHtml}
    <div class="mini-award-stats">${statsHtml}</div>
    ${chipsHtml}
    <div class="mini-award-context">${context}</div>
  </div>`;
}
function buildLastMonthBigCardsSection(data, tripleCrownSet, globalRec, secretSets){
  const cards = [];
  const tiedItems=(award,value)=> (award.playerIds||[award.playerId]).map(playerId=>({
    playerId,value,monthKey:award.monthKey,
    prismatic:(globalRec.monthAvgRating||[]).some(item=>item.playerId===playerId && item.monthKey===award.monthKey && Number(item.value)===10)
  }));
  if(data.mvp){
    cards.push(buildBigExtremeCard('Pontuação do MVP', tiedItems(data.mvp,data.mvp.score), 'pts', 1, tripleCrownSet, globalRec.monthScore, false, secretSets, 'mvp'));
    cards.push(buildBigExtremeCard('G/A do MVP', tiedItems(data.mvp,data.mvp.ga), 'G/A', null, tripleCrownSet, globalRec.monthParticipacao, false, secretSets, 'mvp'));
    cards.push(buildBigExtremeCard('Nota média do MVP', tiedItems(data.mvp,data.mvp.avg||0), 'nota', 1, tripleCrownSet, globalRec.monthAvgRating, true, secretSets, 'mvp'));
  }
  if(data.artilheiro){
    cards.push(buildBigExtremeCard('Gols do artilheiro', tiedItems(data.artilheiro,data.artilheiro.goals), 'gols', null, tripleCrownSet, globalRec.monthGoals, false, secretSets, 'artilheiro'));
    cards.push(buildBigExtremeCard('Maior quantidade de gols do artilheiro em uma rodada', tiedItems(data.artilheiro,data.artilheiro.roundBestGoals||0), 'gols', null, tripleCrownSet, globalRec.roundGoals, false, secretSets, 'artilheiro'));
  }
  if(data.garcom){
    cards.push(buildBigExtremeCard('Assistências do garçom', tiedItems(data.garcom,data.garcom.assists), 'assist.', null, tripleCrownSet, globalRec.monthAssists, false, secretSets, 'garcom'));
    cards.push(buildBigExtremeCard('Maior quantidade de assistências do garçom em uma rodada', tiedItems(data.garcom,data.garcom.roundBestAssists||0), 'assist.', null, tripleCrownSet, globalRec.roundAssists, false, secretSets, 'garcom'));
  }
  if(!cards.length) return '';
  return `<div class="table-title" style="font-size:15px;">Marcas do mês passado</div><div class="record-grid-lg" style="margin-bottom:26px;">${cards.join('')}</div>`;
}
function buildClosedMonthCategoryPodiums(data,badgeMap,secretSets){
  const podiums=computePodiumData(data.startDate,data.endDate);
  const totals=computeAllTotals(data.startDate,data.endDate);
  const monthKey=computePeriodMonthKey(data.startDate,data.endDate);
  const config={
    mvp:{title:'MVP do mês encerrado',icon:'⭐',wm:'MVP',stats:r=>[
      {val:r.score.toFixed(1),unit:'pontuação'},{val:r.goals,unit:'gols'},{val:r.assists,unit:'assist.'},{val:r.ga,unit:'G/A'},{val:r.avg!==null?r.avg.toFixed(1):'—',unit:'nota média'}]},
    artilheiro:{title:'Artilheiro do mês encerrado',icon:'⚽',wm:'GOL',stats:r=>[
      {val:r.goals,unit:'gols'},{val:r.ga,unit:'G/A'},{val:r.avg!==null?r.avg.toFixed(1):'—',unit:'nota média'},{val:r.roundBestGoals,unit:'maior quantidade de gols em uma rodada'}]},
    garcom:{title:'Garçom do mês encerrado',icon:'🎯',wm:'ASS',stats:r=>[
      {val:r.assists,unit:'assist.'},{val:r.ga,unit:'G/A'},{val:r.avg!==null?r.avg.toFixed(1):'—',unit:'nota média'},{val:r.roundBestAssists,unit:'maior quantidade de assistências em uma rodada'}]}
  };
  const medalInfo={gold:{icon:'🥇',label:'Ouro'},silver:{icon:'🥈',label:'Prata'},bronze:{icon:'🥉',label:'Bronze'}};
  return ['mvp','artilheiro','garcom'].map(type=>{
    const cfg=config[type];
    const cards=['silver','gold','bronze'].flatMap(medal=>(podiums[type]?.[medal]?.playerIds||[]).map(playerId=>{
      const t=totals[playerId]; if(!t) return '';
      const row={playerId,playerIds:[playerId],goals:t.goals,assists:t.assists,ga:t.goals+t.assists,avg:t.ratingCount?t.ratingSum/t.ratingCount:null,score:computeMvpScore(t),monthKey,
        roundBestGoals:computeBestRoundStat(playerId,'goals',data.startDate,data.endDate)||0,
        roundBestAssists:computeBestRoundStat(playerId,'assists',data.startDate,data.endDate)||0};
      const isOfficialGold=medal==='gold' && data[type]?.playerId===playerId;
      const badge=isOfficialGold?badgeMap[type]:null;
      const tier=isOfficialGold?secretTierForLastMonth(playerId,monthKey,secretSets,data):null;
      return buildLastMonthCard(cfg.wm,cfg.icon,`${medalInfo[medal].icon} ${cfg.title} · ${medalInfo[medal].label}`,row,cfg.stats(row),badge,tier,medal);
    })).join('');
    const allRows=players.map(p=>{
      const t=totals[p.id];
      if(!t || !t.games) return null;
      return {p,...t,avg:t.ratingCount?t.ratingSum/t.ratingCount:null,participacao:t.goals+t.assists,score:computeMvpScore(t)};
    }).filter(Boolean);
    const sortType=type==='artilheiro'?'goals':type==='garcom'?'assists':'mvp';
    const ranked=sortMonthCategoryRows(allRows,sortType);
    const primary=sortType==='mvp'?'score':sortType;
    let pos=0,previous=null;
    const rankingRows=ranked.map(r=>{
      const value=r[primary];
      if(previous===null || value!==previous){pos++;previous=value;}
      return `<tr><td class="num">${pos}º</td><td class="name-cell">${r.p.photo?circlePhotoMarkup(r.p,'table-circle-photo',30):`<div class="ph-fb" style="width:30px;height:30px;border-radius:50%;">${initials(r.p.name)}</div>`}${r.p.nickname}</td><td class="num">${r.games}</td><td class="num">${r.goals}</td><td class="num">${r.assists}</td><td class="num">${r.participacao}</td><td class="num">${r.avg!==null?r.avg.toFixed(1):'—'}</td><td class="num">${r.score.toFixed(1)}</td></tr>`;
    }).join('');
    const ranking=`<details class="closed-month-ranking"><summary>Ver classificação completa · ${ranked.length} jogador${ranked.length!==1?'es':''}</summary><div class="table-scroll"><table class="stat-table"><thead><tr><th>Pos.</th><th>Jogador</th><th>Rodadas</th><th>Gols</th><th>Assist.</th><th>G/A</th><th>Média</th><th>Pontos</th></tr></thead><tbody>${rankingRows}</tbody></table></div></details>`;
    return `<section class="closed-month-category"><div class="closed-month-category-title">${cfg.icon} ${cfg.title}</div><div class="closed-month-podium">${cards||'<div class="empty">Sem colocados nesta categoria.</div>'}</div>${ranking}</section>`;
  }).join('');
}
function computeClosedMonthCombinations(data,size){
  const combinations={};
  const monthRounds=rounds.filter(round=>round.date>=data.startDate.slice(0,10)&&round.date<data.endDate.slice(0,10));
  monthRounds.forEach(round=>{
    const seenThisRound=new Set();
    collectiveRoundTeams(round).forEach(team=>{
      const exact=collectiveSimulatorTeamResult(round,team);
      const teamIds=[...new Set(team.ids||[])].sort();
      collectiveCombinations(teamIds,size).forEach(ids=>{
        const key=ids.join('|');
        if(seenThisRound.has(key))return;
        seenThisRound.add(key);
        const stats=collectiveEntryStats(round.entries||{},ids);
        if(!combinations[key])combinations[key]=collectiveCombinationEntry(ids,{goals:0,assists:0,ga:0,score:0,avg:0,best:0},{sharedRounds:0,wins:0,draws:0,losses:0,hasExactResults:false});
        const item=combinations[key];
        item.goals+=stats.goals;
        item.assists+=stats.assists;
        item.ga+=stats.ga;
        item.score+=stats.score;
        item.sharedRounds++;
        if(exact){item.wins+=exact.wins;item.draws+=exact.draws;item.losses+=exact.losses;item.hasExactResults=true}
      });
    });
  });
  return Object.values(combinations).filter(item=>item.sharedRounds>0).sort((a,b)=>
    b.score-a.score||b.ga-a.ga||b.goals-a.goals||b.assists-a.assists||a.title.localeCompare(b.title,'pt-BR')
  );
}
function computeClosedMonthRoundCombinations(data,size){
  const results=[];
  const monthRounds=rounds.filter(round=>round.date>=data.startDate.slice(0,10)&&round.date<data.endDate.slice(0,10));
  monthRounds.forEach(round=>{
    const seenThisRound=new Set();
    collectiveRoundTeams(round).forEach(team=>{
      const exact=collectiveSimulatorTeamResult(round,team);
      const teamIds=[...new Set(team.ids||[])].sort();
      collectiveCombinations(teamIds,size).forEach(ids=>{
        const key=ids.join('|');
        if(seenThisRound.has(key))return;
        seenThisRound.add(key);
        const stats=collectiveEntryStats(round.entries||{},ids);
        results.push(collectiveCombinationEntry(ids,stats,{
          roundId:round.id,
          roundLabel:round.label||'Rodada',
          roundDate:round.date,
          context:`${round.label||'Rodada'} · ${fmtDate(round.date)}`,
          wins:exact?.wins||0,draws:exact?.draws||0,losses:exact?.losses||0,hasExactResults:Boolean(exact)
        }));
      });
    });
  });
  return results.sort((a,b)=>
    b.score-a.score||b.ga-a.ga||b.goals-a.goals||b.assists-a.assists||a.title.localeCompare(b.title,'pt-BR')||String(a.roundDate).localeCompare(String(b.roundDate))
  );
}
function collectiveSimulatorTeamResult(round,team){
  const teams=Array.isArray(round.simulatorStats?.teams)?round.simulatorStats.teams:[];
  if(!teams.length)return null;
  const slots=round.teamPlan?.slots||[];
  const offset=slots.slice(0,team.slotIndex).reduce((total,slot)=>total+(slot.teams||[]).length,0)+team.teamIndex;
  const exact=teams[offset];
  return exact?{wins:Number(exact.w)||0,draws:Number(exact.d)||0,losses:Number(exact.l)||0}:null;
}
function buildClosedMonthCombinationPodiums(data,isCurrent=false){
  const patentContext=createRankingPatentContext();
  const avatar=(id,size=58)=>`<span class="${rankingPatentClass(id,patentContext)}">${playerCircleMarkup(players.find(player=>player.id===id),'saved-team-photo',size)}</span>`;
  const avatars=(ids,size=58)=>`<div class="closed-combo-avatars">${(ids||[]).map(id=>avatar(id,size)).join('')}</div>`;
  const medalInfo=[
    {icon:'🥇',label:'Ouro',className:'card-gold closed-podium-gold'},
    {icon:'🥈',label:'Prata',className:'closed-podium-silver'},
    {icon:'🥉',label:'Bronze',className:'closed-podium-bronze'}
  ];
  return [
    {size:2,icon:'🤝',title:isCurrent?'Melhores duplas do mês em andamento':'Melhores duplas do mês encerrado',singular:'dupla',scope:'month'},
    {size:3,icon:'🔺',title:isCurrent?'Melhores trios do mês em andamento':'Melhores trios do mês encerrado',singular:'trio',scope:'month'},
    {size:2,icon:'⚡',title:isCurrent?'Melhores duplas em uma rodada · em andamento':'Melhores duplas em uma rodada',singular:'dupla',scope:'round'},
    {size:3,icon:'🔥',title:isCurrent?'Melhores trios em uma rodada · em andamento':'Melhores trios em uma rodada',singular:'trio',scope:'round'}
  ].map(category=>{
    const isRound=category.scope==='round';
    const ranked=isRound?computeClosedMonthRoundCombinations(data,category.size):computeClosedMonthCombinations(data,category.size);
    const podiumEntries=ranked.slice(0,3).map((item,index)=>({item,index,...medalInfo[index]}));
    const cards=[1,0,2].map(index=>podiumEntries.find(entry=>entry.index===index)).filter(Boolean).map(entry=>{
      const item=entry.item;
      const context=isRound?item.context:`${item.sharedRounds} rodada${item.sharedRounds!==1?'s':''} no mesmo time`;
      return `<article class="mini-award-card ${entry.className}" data-wm="${category.size===2?'DUPLA':'TRIO'}"><div class="mini-award-eyebrow">${entry.icon} ${category.singular} · ${entry.label}${isCurrent?' provisório':''}</div>${avatars(item.playerIds)}<div class="closed-combo-name">${item.title}</div><div class="closed-combo-shared">${context}</div>${item.hasExactResults?`<div class="closed-combo-results">${item.wins} V · ${item.draws} E · ${item.losses} D</div>`:''}<div class="mini-award-stats"><div><b>${item.score.toFixed(1)}</b><span>pontuação</span></div><div><b>${item.goals}</b><span>gols</span></div><div><b>${item.assists}</b><span>assist.</span></div><div><b>${item.ga}</b><span>G/A</span></div></div></article>`;
    }).join('');
    const topTen=ranked.slice(0,10);
    const rows=topTen.map((item,index)=>`<tr><td class="num">${index+1}º</td><td><div class="closed-combo-ranking-name">${avatars(item.playerIds,30)}<strong>${item.title}</strong></div></td><td class="num">${isRound?item.context:item.sharedRounds}</td><td class="num">${item.goals}</td><td class="num">${item.assists}</td><td class="num">${item.ga}</td><td class="num">${item.score.toFixed(1)}</td></tr>`).join('');
    const contextHeading=isRound?'Rodada':'Rodadas juntos';
    const ranking=ranked.length?`<details class="closed-month-ranking"><summary>Ver Top 10 · ${Math.min(10,ranked.length)} ${category.singular}${Math.min(10,ranked.length)!==1?'s':''}</summary><div class="table-scroll"><table class="stat-table"><thead><tr><th>Pos.</th><th>Formação</th><th>${contextHeading}</th><th>Gols</th><th>Assist.</th><th>G/A</th><th>Pontos</th></tr></thead><tbody>${rows}</tbody></table></div></details>`:'';
    return `<section class="closed-month-category"><div class="closed-month-category-title">${category.icon} ${category.title}</div><div class="closed-month-podium">${cards||'<div class="empty">Ainda não há formações que jogaram juntas no mesmo time neste mês.</div>'}</div>${ranking}</section>`;
  }).join('');
}
function buildCurrentCombinationPodiums(){
  if(!periodStart)return '';
  const tomorrow=new Date();
  tomorrow.setDate(tomorrow.getDate()+1);
  const currentPeriod={startDate:String(periodStart).slice(0,10),endDate:tomorrow.toISOString().slice(0,10)};
  const avatar=(id,size)=>`<span class="current-collective-avatar">${playerCircleMarkup(players.find(player=>player.id===id),'podium-photo',size)}</span>`;
  const playerName=id=>players.find(player=>player.id===id)?.nickname||'Jogador removido';
  const roundTeams=rounds.filter(round=>round.date>=currentPeriod.startDate&&round.date<currentPeriod.endDate).flatMap(round=>collectiveRoundTeams(round).map(team=>{const stats=collectiveEntryStats(round.entries||{},team.ids),exact=collectiveSimulatorTeamResult(round,team),entry=collectiveCombinationEntry(team.ids,stats,{context:`${round.label||'Rodada'} · ${fmtDate(round.date)} · ${team.slotLabel}`,wins:exact?.wins||0,draws:exact?.draws||0,losses:exact?.losses||0,hasExactResults:Boolean(exact)});entry.title=`Time ${team.teamIndex+1}`;return entry})).sort((a,b)=>b.score-a.score||b.ga-a.ga||b.goals-a.goals||b.assists-a.assists||a.title.localeCompare(b.title,'pt-BR'));
  const categories=[
    {size:2,icon:'🤝',title:'Duplas do mês',scope:'month'},
    {size:3,icon:'🔺',title:'Trios do mês',scope:'month'},
    {size:2,icon:'⚡',title:'Duplas em uma rodada',scope:'round'},
    {size:3,icon:'🔥',title:'Trios em uma rodada',scope:'round'},
    {size:4,icon:'⚽',title:'Melhor time em uma rodada',scope:'team-round',ranked:roundTeams}
  ];
  const sections=categories.map(category=>{
    const ranked=category.ranked||(category.scope==='round'?computeClosedMonthRoundCombinations(currentPeriod,category.size):computeClosedMonthCombinations(currentPeriod,category.size));
    if(!ranked.length)return `<section class="month-category-section"><div class="month-category-title">${category.icon} ${category.title}</div><div class="empty">Ainda não há formações nesta categoria.</div></section>`;
    const podium=ranked.slice(0,3),order=podium.length===3?[1,0,2]:podium.map((_,index)=>index),medals=['🥇','🥈','🥉'];
    const podiumHtml=order.map(index=>{const item=podium[index],avatarSize=item.playerIds.length<=2?46:item.playerIds.length===3?38:30,teamNames=category.scope==='team-round'?item.playerIds.map(id=>playerName(id)).join(' · '):'';return `<div class="podium-slot podium-p${index+1}"><div class="podium-medal">${medals[index]}</div><div class="closed-combo-avatars">${item.playerIds.map(id=>avatar(id,avatarSize)).join('')}</div><div class="podium-nick">${item.title}</div>${teamNames?`<div class="current-team-player-names">${teamNames}</div>`:''}<div class="podium-score"><b>${item.score.toFixed(1)} pts</b>${item.goals} G · ${item.assists} A · ${item.ga} G/A${item.hasExactResults?`<strong class="current-collective-results">${item.wins} V · ${item.draws} E · ${item.losses} D</strong>`:''}${category.scope==='month'?`<small>${item.sharedRounds} rodada${item.sharedRounds!==1?'s':''} juntos</small>`:`<small>${item.context}</small>`}</div><div class="podium-bar"></div></div>`}).join('');
    const topTen=ranked.slice(0,10),rows=topTen.map((item,index)=>{const teamNames=category.scope==='team-round'?item.playerIds.map(id=>playerName(id)).join(', '):'';return `<tr><td class="num">${index+1}º</td><td><div class="closed-combo-ranking-name"><div class="closed-combo-avatars">${item.playerIds.map(id=>avatar(id,24)).join('')}</div><span><strong>${item.title}</strong>${teamNames?`<small class="current-team-ranking-players">${teamNames}</small>`:''}<small class="record-context">${category.scope==='month'?`${item.sharedRounds} rodada${item.sharedRounds!==1?'s':''} juntos`:item.context}</small></span></div></td><td class="num">${item.score.toFixed(1)}</td><td class="num">${item.goals}</td><td class="num">${item.assists}</td><td class="num">${item.ga}</td><td class="num">${item.hasExactResults?item.wins:'—'}</td><td class="num">${item.hasExactResults?item.draws:'—'}</td><td class="num">${item.hasExactResults?item.losses:'—'}</td></tr>`}).join('');
    const ranking=`<details class="closed-month-ranking"><summary>Ver Top 10 · ${topTen.length} ${category.size===4?'times':category.size===3?'trios':'duplas'}</summary><div class="table-scroll"><table class="stat-table"><thead><tr><th>Pos.</th><th>Formação</th><th>Pts</th><th>G</th><th>A</th><th>G/A</th><th>V</th><th>E</th><th>D</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
    return `<section class="month-category-section current-collective-category"><div class="month-category-title">${category.icon} ${category.title} · em andamento</div><div class="podium">${podiumHtml}</div>${ranking}</section>`;
  }).join('');
  return `<div class="table-title" style="margin-top:28px">👥 Coletivos em andamento</div><div class="monthly-podium-sub">Pódios provisórios e compactos de duplas, trios e do melhor time em uma rodada.</div>${sections}`;
}
function buildClosedMonthSpecialTeams(data){
  const monthRounds=rounds.filter(r=>r.date>=data.startDate.slice(0,10)&&r.date<data.endDate.slice(0,10));
  const patentContext=createRankingPatentContext();
  const avatar=id=>`<span class="${rankingPatentClass(id,patentContext)}">${playerCircleMarkup(players.find(p=>p.id===id),'team-showcase-photo',86)}</span>`;
  const smallAvatar=id=>`<span class="${rankingPatentClass(id,patentContext)}">${playerCircleMarkup(players.find(p=>p.id===id),'saved-team-photo',24)}</span>`;
  const playerName=id=>players.find(p=>p.id===id)?.nickname||'Jogador removido';
  const entryStats=(entries,id)=>{
    const e=(entries||{})[id]||{},goals=Number(e.goals)||0,assists=Number(e.assists)||0;
    const rating=e.rating!==''&&e.rating!=null?Number(e.rating)||0:0;
    return {goals,assists,score:rating*4+goals*5+assists*4.5};
  };
  const renderPlayers=(ids,getStats,getTags)=>ids.map(id=>{
    const s=getStats(id),tags=getTags?getTags(id):'';
    return `<div class="closed-month-team-player"><div class="closed-month-team-player-main">${avatar(id)}<div><strong>${playerName(id)}</strong>${tags?`<span class="closed-month-team-player-tags">${tags}</span>`:''}</div></div><div class="closed-month-team-player-stats">${s.goals} G · ${s.assists} A · ${s.score.toFixed(1)} pts</div></div>`;
  }).join('');
  const totalFor=(ids,getStats)=>ids.reduce((sum,id)=>{const s=getStats(id);sum.goals+=s.goals;sum.assists+=s.assists;sum.score+=s.score;return sum},{goals:0,assists:0,score:0});

  const teamCandidates=[];
  monthRounds.forEach(round=>{
    (round.teamPlan?.slots||[]).forEach((slot,slotIndex)=>{
      (slot.teams||[]).forEach((team,teamIndex)=>{
        if(!Array.isArray(team)||!team.length)return;
        const stats=collectiveEntryStats(round.entries||{},team);
        const candidate={round,slot,slotIndex,teamIndex,ids:[...team],stats,value:stats.best};
        teamCandidates.push(candidate);
      });
    });
  });
  teamCandidates.sort((a,b)=>b.value-a.value||b.stats.ga-a.stats.ga||b.stats.goals-a.stats.goals||b.stats.assists-a.stats.assists||String(a.round.date).localeCompare(String(b.round.date)));
  const best=teamCandidates[0]||null;
  let bestHtml='<div class="closed-month-team-card" data-wm="TIME"><h3>⚽ Melhor time em uma rodada</h3><div class="empty">Nenhum time salvo neste mês.</div></div>';
  if(best){
    const bestGoalkeepers=goalkeeperIdsForSavedTeam(best.round),displayIds=[...best.ids,...bestGoalkeepers],getStats=id=>{if(bestGoalkeepers.includes(id)){const stat=best.round.simulatorStats?.goalkeepers?.[id]||{},points=(Number(stat.wins)||0)*2+(Number(stat.cleanSheets)||0)*4+(Number(stat.saves)||0)*2+(Number(stat.goals)||0)*.5+(Number(stat.assists)||0)*.4;return {goals:Number(stat.goals)||0,assists:Number(stat.assists)||0,score:points}}return entryStats(best.round.entries,id)},total=totalFor(best.ids,getStats),exact=collectiveSimulatorTeamResult(best.round,best);
    const captains=new Set(best.slot.captains||[]);
    const substitutes=substitutePoolForTeam(best.slot,best.teamIndex);
    const subs=substitutes.length?`<div class="team-substitute-pool"><b>⇄ Substitutos do Time ${best.teamIndex+1}</b>${substitutes.map(sub=>`<span class="team-substitute-chip">${smallAvatar(sub.id)} ${playerName(sub.id)} <small>· origem Time ${Number(sub.homeTeamIndex)+1}</small></span>`).join('')}</div>`:'';
    bestHtml=`<div class="closed-month-team-card" data-wm="TIME"><h3>⚽ Melhor time em uma rodada</h3><div class="closed-month-team-context">Time ${best.teamIndex+1} · ${best.round.label} · ${fmtDate(best.round.date)} · ${best.slot.label||`Horário ${best.slotIndex+1}`} · goleiro escolhido pelo desempenho geral da rodada</div>${exact?`<div class="closed-combo-results">${exact.wins} V · ${exact.draws} E · ${exact.losses} D</div>`:''}<div class="closed-month-team-players">${renderPlayers(displayIds,getStats,id=>bestGoalkeepers.includes(id)?'🧤 Destaque Lev Yashin da rodada':(captains.has(id)?'👑 Capitão':'') )}</div>${subs}<div class="closed-month-team-total"><span>${total.goals} G</span> · ${total.assists} A · ${total.score.toFixed(1)} pts</div></div>`;
  }
  const topFive=teamCandidates.slice(0,5);
  const topFiveRows=topFive.map((item,index)=>{const exact=collectiveSimulatorTeamResult(item.round,item),names=item.ids.map(id=>playerName(id)).join(', ');return `<tr><td class="num">${index+1}º</td><td><strong>Time ${item.teamIndex+1}</strong><small class="record-context">${names}</small></td><td>${item.round.label||'Rodada'} · ${fmtDate(item.round.date)} · ${item.slot.label||`Horário ${item.slotIndex+1}`}</td><td class="num">${item.stats.goals}</td><td class="num">${item.stats.assists}</td><td class="num">${item.stats.ga}</td><td class="num">${exact?exact.wins:'—'}</td><td class="num">${exact?exact.draws:'—'}</td><td class="num">${exact?exact.losses:'—'}</td></tr>`}).join('');
  const topFiveHtml=topFive.length?`<details class="closed-month-ranking closed-team-top-five"><summary>Ver Top 5 dos melhores times em uma rodada</summary><div class="monthly-podium-sub">Somente o 1º lugar vale como conquista coletiva. As demais posições são apenas classificação.</div><div class="table-scroll"><table class="stat-table"><thead><tr><th>Pos.</th><th>Time</th><th>Rodada</th><th>G</th><th>A</th><th>G/A</th><th>V</th><th>E</th><th>D</th></tr></thead><tbody>${topFiveRows}</tbody></table></div></details>`:'';

  const totals=computeAllTotals(data.startDate,data.endDate);
  const podiums=computePodiumData(data.startDate,data.endDate);
  const goldTypes={};
  ['mvp','artilheiro','garcom'].forEach(type=>(podiums[type]?.gold?.playerIds||[]).forEach(id=>{if(!goldTypes[id])goldTypes[id]=[];goldTypes[id].push(type)}));
  const selected=Object.keys(goldTypes);
  const goalkeeperGold=computeGoalkeeperPodium(data.startDate,data.endDate).gold[0];
  const monthRows=sortMonthCategoryRows(players.map(p=>{const t=totals[p.id];if(!t||!t.games)return null;return {p,...t,avg:t.ratingCount?t.ratingSum/t.ratingCount:null,participacao:t.goals+t.assists,score:computeMvpScore(t)}}).filter(Boolean),'mvp');
  monthRows.forEach(r=>{if(selected.length<4&&!selected.includes(r.p.id))selected.push(r.p.id)});
  if(goalkeeperGold&&!selected.includes(goalkeeperGold))selected.push(goalkeeperGold);
  const monthStats=id=>{const t=totals[id]||{};return {goals:t.goals||0,assists:t.assists||0,score:computeMvpScore(t)}};
  const monthTotal=totalFor(selected,monthStats);
  const labels={mvp:'⭐ MVP Ouro',artilheiro:'⚽ Artilheiro Ouro',garcom:'🎯 Garçom Ouro'};
  const monthHtml=`<div class="closed-month-team-card" data-wm="MÊS"><h3>🌟 Seleção do mês</h3><div class="closed-month-team-context">Quatro destaques de linha e o vencedor do Lev Yashin, mantendo as pontuações separadas.</div><div class="closed-month-team-players">${renderPlayers(selected,monthStats,id=>id===goalkeeperGold?'🧤 Lev Yashin do mês':((goldTypes[id]||[]).map(type=>labels[type]).join(' · ')||'Destaque do mês'))}</div><div class="closed-month-team-total"><span>${monthTotal.goals} G</span> · ${monthTotal.assists} A · ${monthTotal.score.toFixed(1)} pts</div></div>`;
  return `<section><div class="table-title">Times de destaque do mês encerrado</div><div class="closed-month-teams">${bestHtml}${monthHtml}</div>${topFiveHtml}</section>`;
}
function buildLastMonthSection(){
  const data = computeLastMonthAwardsData();
  if(!data) return '';
  const globalRec = computeRecords();
  const tripleCrownSet = new Set(computeTripleCrownHistory().map(c=> c.playerId+'|'+c.monthKey));
  const secretSets = computeSecretRecordSets();
  const badgeMap = computeLastMonthRecordBadges(data, globalRec, secretSets);
  const bigCardsHtml = buildLastMonthBigCardsSection(data, tripleCrownSet, globalRec, secretSets);
  const isGoat = !!(data.mvp && data.artilheiro && data.garcom &&
    data.mvp.playerId===data.artilheiro.playerId && data.artilheiro.playerId===data.garcom.playerId);
  const awardWinners = [data.mvp, data.artilheiro, data.garcom].filter(Boolean);
  const cosmicWinner = awardWinners.find(item=>secretTierForLastMonth(item.playerId, item.monthKey, secretSets, data)==='cosmic');
  const platinumWinner = !cosmicWinner && awardWinners.find(item=>secretTierForLastMonth(item.playerId, item.monthKey, secretSets, data)==='platinum');
  let statusBanner = '';
  if(cosmicWinner){
    const p = players.find(pl=>pl.id===cosmicWinner.playerId);
    const name = p ? p.nickname : 'Jogador removido';
    statusBanner = `<div class="cosmic-block has-watermark" data-wm="COSMIC">
      <div class="current-title-head"><span class="current-title-icon">🌌</span><div><div class="current-title-name">${name} conquistou o Mês Perfeito!</div><div class="current-title-count">Conquista COSMIC em ${monthLabel(cosmicWinner.monthKey)} — todos os recordes possíveis do período foram alcançados.</div></div></div>
    </div>`;
  } else if(platinumWinner){
    const p = players.find(pl=>pl.id===platinumWinner.playerId);
    const name = p ? p.nickname : 'Jogador removido';
    statusBanner = `<div class="platinum-block has-watermark" data-wm="COL">
      <div class="current-title-head"><span class="current-title-icon">💠</span><div><div class="current-title-name">${name} é Colecionador!</div><div class="current-title-count">Detém todos os recordes oficiais do racha ao mesmo tempo.</div></div></div>
    </div>`;
  }
  if(isGoat){
    const gp = players.find(pl=>pl.id===data.mvp.playerId);
    const gname = gp ? gp.nickname : 'Jogador removido';
    if(!statusBanner) statusBanner = `<div class="goat-block has-watermark" data-wm="GOAT">
      <div class="current-title-head">
        <span class="current-title-icon">🐐</span>
        <div><div class="current-title-name">${gname} é o ${GOAT_TITLE}!</div><div class="current-title-count">Tríplice coroa: MVP + artilheiro + garçom de ${monthLabel(data.mvp.monthKey)}, tudo pro mesmo jogador</div></div>
      </div>
    </div>`;
  }
  const podiumHtml=buildClosedMonthCategoryPodiums(data,badgeMap,secretSets);
  const combinationPodiumsHtml=buildClosedMonthCombinationPodiums(data);
  const specialTeamsHtml=buildClosedMonthSpecialTeams(data);
  return statusBanner + bigCardsHtml + specialTeamsHtml + `<div class="table-title">Último mês encerrado</div>${podiumHtml}${combinationPodiumsHtml}`;
}

function applyMonthClosedAppearance(){
  const wrap=$('lastMonthWrap');
  if(wrap){
    const fallbackSize=Math.max(64,Math.min(150,64 + Math.max(0,monthClosedCardHeight-340)*.18 + Math.max(0,monthClosedContentOffset-30)*.25));
    wrap.style.setProperty('--month-card-height', `${monthClosedCardHeight}px`);
    wrap.style.setProperty('--month-card-width', `${monthClosedCardWidth}px`);
    wrap.style.setProperty('--month-photo-width', `${monthClosedPhotoWidth}px`);
    wrap.style.setProperty('--month-card-content-offset', `${monthClosedContentOffset}px`);
    wrap.style.setProperty('--month-card-shadow', `${monthClosedShadow/100}`);
    wrap.style.setProperty('--month-fallback-size', `${fallbackSize}px`);
    wrap.style.setProperty('--month-fallback-font-size', `${Math.round(fallbackSize*.38)}px`);
    wrap.style.setProperty('--month-fallback-shift', `${Math.round(monthClosedContentOffset*.56)}px`);
    wrap.style.setProperty('--month-fallback-name-gap', `${Math.round(monthClosedContentOffset*.44)}px`);
  }
  $('monthCardHeight').value=monthClosedCardHeight; $('monthCardHeightValue').textContent=`${monthClosedCardHeight} px`;
  $('monthCardWidth').value=monthClosedCardWidth; $('monthCardWidthValue').textContent=monthClosedCardWidth>=900?'Automática':`${monthClosedCardWidth} px`;
  $('monthCardPhotoWidth').value=monthClosedPhotoWidth; $('monthCardPhotoWidthValue').textContent=`${monthClosedPhotoWidth} px`;
  $('monthCardContentOffset').value=monthClosedContentOffset; $('monthCardContentOffsetValue').textContent=`${monthClosedContentOffset} px`;
  $('monthCardShadow').value=monthClosedShadow; $('monthCardShadowValue').textContent=`${monthClosedShadow}%`;
}
['monthCardHeight','monthCardWidth','monthCardPhotoWidth','monthCardContentOffset','monthCardShadow'].forEach(id=>$(id).addEventListener('input',()=>{
  monthClosedCardHeight=Number($('monthCardHeight').value)||340;
  monthClosedCardWidth=Number($('monthCardWidth').value)||900;
  monthClosedPhotoWidth=Number($('monthCardPhotoWidth').value)||300;
  monthClosedContentOffset=Number($('monthCardContentOffset').value)||78;
  monthClosedShadow=Number($('monthCardShadow').value)||86;
  applyMonthClosedAppearance();
}));
function restoreMonthClosedAppearance(source){
  monthClosedCardHeight=source.height;
  monthClosedCardWidth=source.width;
  monthClosedPhotoWidth=source.photoWidth;
  monthClosedContentOffset=source.contentOffset;
  monthClosedShadow=source.shadow;
  applyMonthClosedAppearance();
}
$('btnSaveMonthAppearance').addEventListener('click',async()=>{
  if(!requireAdmin()) return;
  savedMonthClosedAppearance={height:monthClosedCardHeight,width:monthClosedCardWidth,photoWidth:monthClosedPhotoWidth,contentOffset:monthClosedContentOffset,shadow:monthClosedShadow};
  await savePersonalization();
  showToast('Aparência do mês encerrado salva.');
});
$('btnDiscardMonthAppearance').addEventListener('click',()=>{
  restoreMonthClosedAppearance(savedMonthClosedAppearance);
  showToast('Alterações de aparência descartadas.');
});
$('btnResetMonthAppearance').addEventListener('click',()=>{
  restoreMonthClosedAppearance(DEFAULT_MONTH_CLOSED_APPEARANCE);
  showToast('Padrão restaurado na prévia. Clique em salvar para confirmar.');
});
function computeMvpScore(t){
  const avg = t.ratingCount ? t.ratingSum/t.ratingCount : 0;
  return (avg * 4) + (t.goals * 5) + (t.assists * 4.5) - (t.absencePenalty||0);
}
function buildMonthCategoryRows(totals, sinceISO, untilISO){
  return players.map(p=>{
    const t=totals[p.id] || {goals:0,assists:0,ratingSum:0,ratingCount:0,games:0};
    const avg=t.ratingCount ? t.ratingSum/t.ratingCount : null;
    return {
      p,...t,avg,participacao:t.goals+t.assists,score:computeMvpScore(t),
      bestGoals:computeBestRoundStat(p.id,'goals',sinceISO,untilISO)||0,
      bestAssists:computeBestRoundStat(p.id,'assists',sinceISO,untilISO)||0
    };
  }).filter(r=>r.games>0);
}
function sortMonthCategoryRows(rows,type){
  return [...rows].sort((a,b)=>{
    if(type==='mvp') return (b.score-a.score)||(b.participacao-a.participacao)||(b.avg||0)-(a.avg||0);
    if(type==='goals') return (b.goals-a.goals)||(b.participacao-a.participacao)||(b.avg||0)-(a.avg||0)||(a.games-b.games)||(b.score-a.score);
    return (b.assists-a.assists)||(b.participacao-a.participacao)||(b.avg||0)-(a.avg||0)||(a.games-b.games)||(b.score-a.score);
  });
}
function monthCategoryStats(r,type){
  if(type==='mvp') return `<b>${r.score.toFixed(1)} pts</b>${r.participacao} G/A · média ${r.avg!==null?r.avg.toFixed(1):'—'} · ${r.games} rodada(s)`;
  if(type==='goals') return `<b>${r.goals} gol(s)</b>${r.participacao} G/A · média ${r.avg!==null?r.avg.toFixed(1):'—'}`;
  return `<b>${r.assists} assistência(s)</b>${r.participacao} G/A · média ${r.avg!==null?r.avg.toFixed(1):'—'}`;
}
function buildMonthCategorySection(rows,type,title,icon,rule){
  const ranked=sortMonthCategoryRows(rows,type);
  if(!ranked.length) return `<section class="month-category-section"><div class="month-category-title">${icon} ${title}</div><div class="empty">Ainda não há rodadas neste período.</div></section>`;
  const podium=ranked.slice(0,3), order=podium.length===3?[1,0,2]:podium.map((_,i)=>i), medals=['🥇','🥈','🥉'];
  const podiumHtml=order.map(i=>{
    const r=podium[i];
    return `<div class="podium-slot podium-p${i+1}"><div class="podium-medal">${medals[i]}</div>${r.p.photo?circlePhotoMarkup(r.p,'podium-photo',52):`<div class="podium-fb">${initials(r.p.name)}</div>`}<div class="podium-nick">${r.p.nickname}</div><div class="podium-score">${monthCategoryStats(r,type)}</div><div class="podium-bar"></div></div>`;
  }).join('');
  const primary=type==='mvp'?'score':type;
  let position=0,previous=null;
  const body=ranked.map(r=>{
    const value=r[primary];
    if(previous===null || value!==previous){position++;previous=value;}
    return `<tr><td class="num">${position}º</td><td class="name-cell">${r.p.photo?circlePhotoMarkup(r.p,'table-circle-photo',30):`<div class="ph-fb" style="width:30px;height:30px;border-radius:50%;">${initials(r.p.name)}</div>`}${r.p.nickname}</td><td>${r.games}</td><td class="num">${r.goals}</td><td class="num">${r.assists}</td><td class="num">${r.participacao}</td><td class="num">${r.avg!==null?r.avg.toFixed(1):'—'}</td><td class="num">${r.score.toFixed(1)}</td></tr>`;
  }).join('');
  return `<section class="month-category-section"><div class="month-category-head"><div class="month-category-title">${icon} ${title}</div><div class="month-category-rule">${rule}</div></div><div class="podium">${podiumHtml}</div><details class="closed-month-ranking"><summary>Ver classificação completa · ${ranked.length} jogador${ranked.length!==1?'es':''}</summary><div class="table-scroll"><table class="stat-table"><thead><tr><th>Pos.</th><th>Jogador</th><th>Rodadas</th><th>Gols</th><th>Assist.</th><th>G/A</th><th>Média</th><th>Pontos</th></tr></thead><tbody>${body}</tbody></table></div></details></section>`;
}
function renderMes(){
  $('lastMonthWrap').innerHTML = buildLastMonthSection();
  applyMonthClosedAppearance();
  $('periodSince').textContent = fmtDate(periodStart);
  $('monthStartDayInput').value = monthStartDay;
  if(!$('customPeriodStartInput').value) $('customPeriodStartInput').value = (periodStart||'').slice(0,10);
  const totals = computeAllTotals(periodStart);
  const ranked = buildMonthCategoryRows(totals,periodStart);
  const mvpWrap = $('mvpWrap');
  mvpWrap.innerHTML=buildMonthCategorySection(ranked,'mvp','MVP do mês','⭐','Classificação pela pontuação: média × 4 + gols × 5 + assistências × 4,5.');
  $('mesTableWrap').innerHTML =
    buildMonthCategorySection(ranked,'goals','Artilheiro do mês','⚽','Classificação pelo total de gols, mantendo os mesmos critérios de desempate do site.')+
    buildMonthCategorySection(ranked,'assists','Garçom do mês','🎯','Classificação pelo total de assistências, mantendo os mesmos critérios de desempate do site.')+
    buildCurrentCombinationPodiums();
  renderMonthsList();
}
function closeMonth(startVal, endVal, label){
  const monthKey = computePeriodMonthKey(startVal, endVal);
  const closingMonth={startDate:startVal,endDate:endVal};
  const secretSets=computeSecretRecordSets();
  const specialPatents={
    prismatic:deriveMonthPrismaticPlayers(closingMonth),
    cosmic:players.filter(p=>secretSets.cosmicMonthSet.has(p.id+'|'+monthKey)).map(p=>p.id),
    collector:players.filter(p=>secretSets.platinumPlayerSet.has(p.id)).map(p=>p.id),
  };
  months.push({
    id: uid(),
    label: label || monthLabel(monthKey),
    startDate: startVal,
    endDate: endVal,
    closedAt: new Date().toISOString(),
    specialPatents,
  });
}

function dateOnlyToISO(d){ return new Date(d+'T00:00:00').toISOString(); }
function openMonthEditModal(id){
  if(!isAdmin) return;
  const m = months.find(mm=>mm.id===id);
  if(!m) return;
  $('monthEditId').value = m.id;
  $('monthEditLabel').value = m.label;
  $('monthEditStart').value = m.startDate.slice(0,10);
  $('monthEditEnd').value = m.endDate.slice(0,10);
  $('monthEditOverlay').classList.add('active');
}
window.openMonthEditModal = openMonthEditModal;
$('btnCancelMonthEdit').addEventListener('click', ()=> $('monthEditOverlay').classList.remove('active'));
$('btnSaveMonthEdit').addEventListener('click', async ()=>{
  const id = $('monthEditId').value;
  const m = months.find(mm=>mm.id===id);
  if(!m) return;
  const label = $('monthEditLabel').value.trim() || m.label;
  const start = $('monthEditStart').value;
  const end = $('monthEditEnd').value;
  if(!start || !end || start>=end){ showToast('Datas inválidas: o fim precisa ser depois do início.'); return; }
  m.label = label;
  m.startDate = dateOnlyToISO(start);
  m.endDate = dateOnlyToISO(end);
  await saveMonth();
  $('monthEditOverlay').classList.remove('active');
  renderAll();
  showToast('Mês atualizado!');
});
window.deleteMonth = async (id)=>{
  const m = months.find(mm=>mm.id===id);
  if(!m) return;
  const ok = await askConfirm('Excluir este mês fechado? Isso vai apagar também TODAS as rodadas registradas dentro do período dele — ou seja, os gols, assistências e troféus daquele mês somem junto. Essa ação não pode ser desfeita.');
  if(!ok) return;
  rounds = rounds.filter(r => !(r.date >= m.startDate.slice(0,10) && r.date < m.endDate.slice(0,10)));
  months = months.filter(mm=>mm.id!==id);
  await Promise.all([saveRounds(),saveMonth()]);
  renderAll();
  showToast('Mês e as rodadas dele foram apagados.');
};
window.reopenMonth = async (id)=>{
  if(!isAdmin) return;
  const m = months.find(mm=>mm.id===id);
  if(!m) return;
  const sortedByStart = [...months].sort((a,b)=> a.startDate.localeCompare(b.startDate));
  const idx = sortedByStart.findIndex(mm=>mm.id===id);
  const nextMonth = sortedByStart[idx+1];

  const msg = nextMonth
    ? `Reabrir "${m.label}"? As rodadas deste período passam a fazer parte do mês seguinte fechado ("${nextMonth.label}"), que passa a começar em ${fmtDate(m.startDate)} — os troféus dele são recalculados automaticamente. Confirmar?`
    : `Reabrir "${m.label}"? Isso desfaz o fechamento: os troféus dele deixam de valer e as rodadas a partir de ${fmtDate(m.startDate)} voltam a contar como o período/mês em andamento (junto com qualquer rodada lançada depois do fechamento). Confirmar?`;
  const ok = await askConfirm(msg);
  if(!ok) return;
  if(nextMonth){
    nextMonth.startDate = m.startDate;
  } else {
    periodStart = m.startDate;
  }
  months = months.filter(mm=>mm.id!==id);
  await saveMonth();
  renderAll();
  showToast('Mês reaberto!');
};
function buildMonthWinnerLine(type, icon, lbl, w, totals, broken=[]){
  const pid = w[type];
  if(!pid) return `<div class="month-winner-card"><div class="mini-row"><span>${icon} ${lbl}</span><b>—</b></div></div>`;
  const p = players.find(pp=>pp.id===pid);
  const t = totals[pid];
  const valStr = type==='mvp' ? `${computeMvpScore(t).toFixed(1)} pts` : (type==='artilheiro' ? `${t.goals} gols` : `${t.assists} assist.`);
  const playerBroken=broken.filter(item=>item.playerId===pid);
  const isGoat=!!(w.mvp && w.artilheiro && w.garcom && w.mvp===w.artilheiro && w.artilheiro===w.garcom);
  const patentClass=playerBroken.some(item=>item.cosmic) ? ' patent-cosmic'
    : playerBroken.some(item=>item.platinum) ? ' patent-platinum'
    : isGoat ? ' patent-goat'
    : playerBroken.some(item=>item.prismatic) ? ' patent-prismatic'
    : ' patent-gold';
  const valueClass=patentClass.includes('patent-platinum')?'collector-number':'';
  return `<div class="month-winner-card${patentClass}">
    <div class="mini-row"><span>${icon} ${lbl}</span><b>${p?p.nickname:'Jogador removido'} · <span class="${valueClass}">${valStr}</span></b></div>
  </div>`;
}
function buildMonthAggregate(totals){
  return Object.values(totals).reduce((s,t)=>{
    s.goals += t.goals||0; s.assists += t.assists||0; s.score += computeMvpScore(t); return s;
  }, {goals:0, assists:0, score:0});
}
function computeMonthBrokenRecords(mRounds, globalRec, secretSets){
  const seen = new Set();
  const found = [];
  mRounds.forEach(r=>{
    computeRoundBrokenRecords(r, globalRec, secretSets).forEach(b=>{
      const key = b.playerId+'|'+b.label;
      if(seen.has(key)) return;
      seen.add(key);
      found.push(b);
    });
  });
  return found;
}
function buildMonthCardHeaderExtras(broken, isGoat, month=null){
  const frozenTier=frozenMonthHighestTier(month);
  const hasCosmicRecord = frozenTier==='cosmic' || broken.some(b=>b.cosmic);
  const hasPlatinumRecord = !hasCosmicRecord && (frozenTier==='platinum' || broken.some(b=>b.platinum));
  const hasPrismaticRecord = frozenTier==='prismatic' || broken.some(b=>b.prismatic);
  const cardClass = hasCosmicRecord ? ' has-cosmic' : (hasPlatinumRecord ? ' has-platinum' : (isGoat ? ' has-goat' : (broken.length ? (hasPrismaticRecord ? ' has-prismatic' : ' has-record') : '')));
  const titleIcon = hasCosmicRecord ? '🌌 ' : (hasPlatinumRecord ? '💠 ' : (isGoat ? '🐐 ' : (broken.length ? (hasPrismaticRecord ? '💎 ' : '🏆 ') : '')));
  return {cardClass, titleIcon};
}
function buildMonthBrokenRecordsHtml(broken){
  return renderCollapsibleBrokenRecords(broken, 'Recordes deste mês');
}
function buildMonthGoatBannerHtml(isGoat){
  return isGoat ? `<div class="goat-badge" style="margin-bottom:10px;" title="MVP + artilheiro + garçom do mesmo mês">🐐 ${GOAT_TITLE} — Tríplice Coroa</div>` : '';
}
function renderMonthsList(){
  const list = $('monthsList');
  if(!list) return;
  if(!months.length){ list.innerHTML = '<div class="empty">Nenhum mês fechado ainda. Feche o mês atual acima quando quiser distribuir os troféus dele.</div>'; return; }
  const sortedMonths = [...months].sort((a,b)=> b.startDate.localeCompare(a.startDate));
  const globalRec = computeRecords();
  const secretSets = computeSecretRecordSets();
  list.innerHTML = sortedMonths.map(m=>{
    const w = computeMonthWinners(m);
    const totals = computeAllTotals(m.startDate, m.endDate);
    const isGoat = !!(w.mvp && w.artilheiro && w.garcom && w.mvp===w.artilheiro && w.artilheiro===w.garcom);
    const monthRounds = rounds.filter(r=> r.date >= m.startDate.slice(0,10) && r.date < m.endDate.slice(0,10))
      .sort((a,b)=> a.date.localeCompare(b.date));
    const agg = buildMonthAggregate(totals);
    const broken = computeMonthBrokenRecords(monthRounds, globalRec, secretSets);
    const {cardClass, titleIcon} = buildMonthCardHeaderExtras(broken, isGoat, m);
    const roundsHtml = monthRounds.length
      ? monthRounds.map(r=>`<div class="mini-row"><span>${r.label}</span><b>${fmtDate(r.date)}</b></div>`).join('')
      : '<span style="color:var(--chalk-dim);font-size:13px;">Nenhuma rodada neste período.</span>';
    return `<details class="round-item${cardClass}">
      <summary>
        <div><div class="round-title">${titleIcon}${m.label}</div><div class="round-date">${fmtDate(m.startDate)} até ${fmtDate(m.endDate)}</div></div>
        <div class="round-summary-actions">${renderBrokenRecordCountBadge(broken,isGoat)}${isAdmin ? `<div style="display:flex;gap:6px;">
          <button class="btn btn-ghost btn-sm" onclick="event.preventDefault();event.stopPropagation();reopenMonth('${m.id}')">Reabrir</button>
          <button class="btn btn-ghost btn-sm" onclick="event.preventDefault();event.stopPropagation();openMonthEditModal('${m.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="event.preventDefault();event.stopPropagation();deleteMonth('${m.id}')">Excluir</button>
        </div>` : ''}</div>
      </summary>
      <div class="round-body">
        ${buildMonthGoatBannerHtml(isGoat)}
        <div class="round-summary">⚽ ${agg.goals} gol(s) no total · 🅰️ ${agg.assists} assistência(s) no total · 📊 ${agg.score.toFixed(1)} pts no total</div>
        ${buildMonthBrokenRecordsHtml(broken)}
        ${buildMonthWinnerLine('mvp','⭐','MVP', w, totals, broken)}
        ${buildMonthWinnerLine('artilheiro','⚽','Artilheiro', w, totals, broken)}
        ${buildMonthWinnerLine('garcom','🎯','Garçom', w, totals, broken)}
        <div class="table-title" style="font-size:13px;margin:14px 0 6px;">Rodadas deste mês (${monthRounds.length})</div>
        ${roundsHtml}
      </div>
    </details>`;

  }).join('');
}
$('btnResetMonth').addEventListener('click', async ()=>{
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0,0,0,0);
  const newStart = tomorrow.toISOString();
  if(periodStart && new Date(periodStart) >= tomorrow){
    showToast('O mês já foi fechado hoje — o período atual já começa amanhã. Não há rodadas novas pra distribuir troféu de novo. Se estiver testando, ajuste manualmente a data de início do período (abaixo) antes de resetar de novo.');
    return;
  }
  const ok = await askConfirm('Isso vai FECHAR o mês atual (uma "temporada"), guardando as rodadas de até hoje nele e liberando os troféus (MVP, artilheiro e garçom) desse mês, mesmo que o dia configurado ainda não tenha chegado. Rodadas de hoje ainda contam para o mês que está sendo fechado; o novo mês começa amanhã. O mês fechado fica listado mais abaixo, podendo ser editado ou apagado depois. Confirmar?');
  if(!ok) return;
  const previousPeriodStart=periodStart,previousMonths=JSON.parse(JSON.stringify(months));
  closeMonth(periodStart, newStart);
  periodStart = newStart;
  renderAll();
  const saved=await saveMonth();
  if(!saved){periodStart=previousPeriodStart;months=previousMonths;renderAll();showToast('O mês não foi fechado porque a nuvem não confirmou o salvamento.');return}
  showToast('Mês fechado e troféus liberados!');
});

function computeExpectedPeriodStart(startDay, ref){
  const d = ref || new Date();
  let y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
  if(day < startDay){
    m -= 1;
    if(m < 0){ m = 11; y -= 1; }
  }
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const clampedDay = Math.min(startDay, daysInMonth);
  return new Date(y, m, clampedDay, 0, 0, 0, 0);
}
async function autoRolloverMonthIfNeeded(){
  if(!isAdmin || !periodStart) return;
  const expected = computeExpectedPeriodStart(monthStartDay, new Date());
  const cur = new Date(periodStart);
  const curDateOnly = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate());
  if(curDateOnly >= expected) return;
  const dayAfter = new Date(expected.getFullYear(), expected.getMonth(), expected.getDate()+1, 0,0,0,0);
  const newStart = dayAfter.toISOString();
  closeMonth(periodStart, newStart);
  periodStart = newStart;
  await saveMonth();
  showToast(`Mês fechado automaticamente (dia ${monthStartDay}) e troféus liberados!`);
  renderAll();
}

$('btnSaveMonthStartDay').addEventListener('click', async ()=>{
  let v = parseInt($('monthStartDayInput').value, 10);
  if(isNaN(v) || v < 1) v = 1;
  if(v > 31) v = 31;
  monthStartDay = v;
  $('monthStartDayInput').value = monthStartDay;
  await saveMonth();
  showToast(`O mês agora fecha automaticamente todo dia ${monthStartDay}. Isso só vale daqui pra frente — não fecha o mês atual retroativamente.`);
  renderMes();
});

$('btnCustomPeriodStart').addEventListener('click', async ()=>{
  const val = $('customPeriodStartInput').value;
  if(!val){ showToast('Escolha uma data no calendário.'); return; }
  const chosen = new Date(val+'T00:00:00');
  const isForward = periodStart ? chosen > new Date(periodStart) : true;
  const msg = isForward
    ? `Isso vai fechar o período contando as rodadas até o dia anterior a ${fmtDate(val)}, distribuir os troféus, e o período atual passa a contar a partir de ${fmtDate(val)}. Você pode ajustar essa data de novo quando quiser. Confirmar?`
    : `Isso vai ajustar o início do período atual pra ${fmtDate(val)} — uma data anterior à atual — sem fechar nem distribuir troféus. As rodadas entre essa data e agora passam a contar no período atual. Confirmar?`;
  const ok = await askConfirm(msg);
  if(!ok) return;
  const newStart = chosen.toISOString();
  const previousPeriodStart=periodStart,previousMonths=JSON.parse(JSON.stringify(months));
  if(isForward){
    closeMonth(periodStart, newStart);
  }
  periodStart = newStart;
  const saved=await saveMonth();
  if(!saved){periodStart=previousPeriodStart;months=previousMonths;renderAll();showToast('A data não foi alterada porque a nuvem não confirmou o salvamento.');return}
  renderAll();
  showToast('Data de início do período ajustada!');
});

function renderAll(){
  renderPlayerGrid();
  if(document.getElementById('view-rodada').classList.contains('active')) renderRoundForm();
  if(document.getElementById('view-geral').classList.contains('active')) renderGeral();
  if(document.getElementById('view-mes').classList.contains('active')) renderMes();
  if(document.getElementById('view-musicas').classList.contains('active')) renderMusic();
  if(typeof scheduleRarityBgApply==='function') scheduleRarityBgApply();
}
