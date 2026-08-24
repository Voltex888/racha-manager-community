function buildStatTable(totals, sortKey, title, emptyMsg){
  const rankingPatents=createRankingPatentContext();
  const rows = players.map(p=>{
    const t = totals[p.id] || {goals:0,assists:0,ratingSum:0,ratingCount:0,games:0};
    const avg = t.ratingCount ? (t.ratingSum/t.ratingCount) : null;
    const participacao = t.goals + t.assists;
    const score = computeMvpScore(t);
    return {p, ...t, avg, participacao, score};
  }).sort((a,b)=> (b[sortKey]-a[sortKey]) || (b.participacao-a.participacao));
  const titleHtml = title ? `<div class="table-title">${title}</div>` : '';
  if(!rows.length || rows.every(r=>r.games===0)) return titleHtml + `<div class="empty">${emptyMsg || 'Sem dados ainda.'}</div>`;
  let pos = 0, prevVal = null;
  const posLabels = rows.map(r=>{
    if(r[sortKey] <= 0) return '—';
    if(r[sortKey] !== prevVal){ pos++; prevVal = r[sortKey]; }
    return pos + 'º';
  });
  return titleHtml + `<div class="table-scroll"><table class="stat-table">
    <thead><tr><th>Pos.</th><th>Jogador</th><th>Jogos</th><th>Gols</th><th>Assist.</th><th>G/A</th><th>Nota média</th><th>Pontuação</th></tr></thead>
    <tbody>${rows.map((r,i)=>`<tr class="${rankingPatentClass(r.p.id,rankingPatents)}">
      <td class="num">${posLabels[i]}</td>
      <td class="name-cell">${r.p.photo?circlePhotoMarkup(r.p,'table-circle-photo',30):`<div class="ph-fb" style="width:30px;height:30px;border-radius:50%;">${initials(r.p.name)}</div>`}${r.p.nickname}</td>
      <td class="num">${r.games}</td>
      <td class="num">${r.goals}</td>
      <td class="num">${r.assists}</td>
      <td class="num">${r.participacao}</td>
      <td class="num">${r.avg!==null ? r.avg.toFixed(1) : '—'}</td>
      <td class="num">${r.score.toFixed(1)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

function computeMonthWinners(month){
  const totals = computeAllTotals(month.startDate, month.endDate);
  const withGames = players.filter(p => (totals[p.id]?.games || 0) > 0);
  if(!withGames.length) return { artilheiro:null, garcom:null, mvp:null };
  const bestArtilheiro = [...withGames].sort((a,b)=>{
    const ta=totals[a.id], tb=totals[b.id];
    return (tb.goals-ta.goals)
      || ((tb.goals+tb.assists)-(ta.goals+ta.assists))
      || ((tb.ratingCount?tb.ratingSum/tb.ratingCount:0)-(ta.ratingCount?ta.ratingSum/ta.ratingCount:0))
      || ((ta.games||0)-(tb.games||0))
      || (computeMvpScore(tb)-computeMvpScore(ta));
  })[0];
  const bestGarcom = [...withGames].sort((a,b)=>{
    const ta=totals[a.id], tb=totals[b.id];
    return (tb.assists-ta.assists)
      || ((tb.goals+tb.assists)-(ta.goals+ta.assists))
      || ((tb.ratingCount?tb.ratingSum/tb.ratingCount:0)-(ta.ratingCount?ta.ratingSum/ta.ratingCount:0))
      || ((ta.games||0)-(tb.games||0))
      || (computeMvpScore(tb)-computeMvpScore(ta));
  })[0];
  const bestMvp = [...withGames].sort((a,b)=>{
    const ta=totals[a.id], tb=totals[b.id];
    const sa=computeMvpScore(ta), sb=computeMvpScore(tb);
    return (sb-sa) || ((tb.goals+tb.assists)-(ta.goals+ta.assists));
  })[0];
  const sameArtilheiro=(p)=>{
    const t=totals[p.id], best=totals[bestArtilheiro.id];
    return t.goals===best.goals && (t.goals+t.assists)===(best.goals+best.assists)
      && (t.ratingCount?t.ratingSum/t.ratingCount:0)===(best.ratingCount?best.ratingSum/best.ratingCount:0)
      && t.games===best.games && computeMvpScore(t)===computeMvpScore(best);
  };
  const sameGarcom=(p)=>{
    const t=totals[p.id], best=totals[bestGarcom.id];
    return t.assists===best.assists && (t.goals+t.assists)===(best.goals+best.assists)
      && (t.ratingCount?t.ratingSum/t.ratingCount:0)===(best.ratingCount?best.ratingSum/best.ratingCount:0)
      && t.games===best.games && computeMvpScore(t)===computeMvpScore(best);
  };
  return {
    artilheiro: totals[bestArtilheiro.id].goals>0 ? bestArtilheiro.id : null,
    garcom: totals[bestGarcom.id].assists>0 ? bestGarcom.id : null,
    mvp: bestMvp.id,
    artilheiroIds: totals[bestArtilheiro.id].goals>0 ? withGames.filter(sameArtilheiro).map(p=>p.id) : [],
    garcomIds: totals[bestGarcom.id].assists>0 ? withGames.filter(sameGarcom).map(p=>p.id) : [],
    mvpIds:[bestMvp.id],
  };
}
function computeAutomaticTrophyCounts(){
  const counts = {};
  months.forEach(month=>{
    const w = computeMonthWinners(month);
    ['mvp','artilheiro','garcom'].forEach(type=>{
      const ids=w[type+'Ids'] || (w[type]?[w[type]]:[]);
      ids.forEach(pid=>{ if(!counts[pid]) counts[pid] = {mvp:0,artilheiro:0,garcom:0}; counts[pid][type]++; });
    });
  });
  return counts;
}
function getTrophyCounts(){
  const counts = computeAutomaticTrophyCounts();
  const result = {};
  players.forEach(p=>{
    const auto = counts[p.id] || {mvp:0,artilheiro:0,garcom:0};
    const manual = manualTrophyAdjustments[p.id] || {mvp:0,artilheiro:0,garcom:0};
    result[p.id] = {
      mvp: Math.max(0, auto.mvp + (manual.mvp||0)),
      artilheiro: Math.max(0, auto.artilheiro + (manual.artilheiro||0)),
      garcom: Math.max(0, auto.garcom + (manual.garcom||0)),
    };
  });
  return result;
}

function computeTrophyPodiumCounts(){
  const result={};
  players.forEach(p=>{result[p.id]={mvp:{gold:0,silver:0,bronze:0,total:0},artilheiro:{gold:0,silver:0,bronze:0,total:0},garcom:{gold:0,silver:0,bronze:0,total:0}}});
  months.forEach(month=>{
    const podiums=computePodiumData(month.startDate,month.endDate);
    PODIUM_TYPES.forEach(type=>PODIUM_MEDALS.forEach(medal=>{
      (podiums[type]?.[medal]?.playerIds||[]).forEach(playerId=>{if(result[playerId])result[playerId][type][medal]++});
    }));
  });
  players.forEach(p=>PODIUM_TYPES.forEach(type=>{
    const c=result[p.id][type],manual=Number(manualTrophyAdjustments[p.id]?.[type]||0);
    c.gold=Math.max(0,c.gold+manual);c.total=c.gold+c.silver+c.bronze;
    c.points=type==='mvp' ? c.gold*10+c.silver*6+c.bronze*4 : c.gold*6+c.silver*4+c.bronze*2;
  }));
  return result;
}
function trophyPodiumProfileText(playerId,type){
  const c=computeTrophyPodiumCounts()[playerId]?.[type]||{gold:0,silver:0,bronze:0,total:0,points:0};
  return `<span class="profile-podium-summary">
    <span class="profile-podium-medal medal-gold"><span>🥇 1º</span><b>${c.gold}x</b></span>
    <span class="profile-podium-medal medal-silver"><span>🥈 2º</span><b>${c.silver}x</b></span>
    <span class="profile-podium-medal medal-bronze"><span>🥉 3º</span><b>${c.bronze}x</b></span>
    <span class="profile-podium-total"><span>Pódios</span><b>${c.total}</b></span>
    <span class="profile-podium-points"><span>Pontos</span><b>${c.points}</b></span>
  </span>`;
}

function computeTrophyRankingList(countsMap, key, podiumMap=null){
  const rows=players.map(p=>({p,count:(countsMap[p.id]&&countsMap[p.id][key])||0,podium:podiumMap?.[p.id]?.[key]||null}))
    .filter(r=>podiumMap?(r.podium?.total||0)>0:r.count>0)
    .sort((a,b)=>podiumMap
      ? (b.podium.points-a.podium.points)||(b.podium.gold-a.podium.gold)||(b.podium.silver-a.podium.silver)||(b.podium.bronze-a.podium.bronze)||a.p.nickname.localeCompare(b.p.nickname,'pt-BR')
      : b.count-a.count||a.p.nickname.localeCompare(b.p.nickname,'pt-BR'));
  let pos=0,prevKey=null;
  return rows.map((r)=>{
    const rankKey=podiumMap?`${r.podium.points}|${r.podium.gold}|${r.podium.silver}|${r.podium.bronze}`:String(r.count);
    if(rankKey!==prevKey){pos++;prevKey=rankKey;}
    return {...r, pos};
  });
}
function buildTrophyRankingSection(title, icon, list, unit, emptyMsg){
  const titleHtml = `<div class="table-title">${icon} ${title}</div>`;
  if(!list.length) return titleHtml + `<div class="empty">${emptyMsg || 'Ninguém conquistou este troféu ainda.'}</div>`;
  const rankingPatents=createRankingPatentContext();
  const rows = list.map(r=>{
    const pphoto = r.p.photo ? circlePhotoMarkup(r.p,'table-circle-photo',30) : `<div class="ph-fb" style="width:30px;height:30px;border-radius:50%;">${initials(r.p.name)}</div>`;
    return `<tr class="${rankingPatentClass(r.p.id,rankingPatents)}">
      <td class="num">${r.pos}º</td>
      <td class="name-cell">${pphoto}${r.p.nickname}</td>
      <td class="num podium-gold-count">${r.podium?.gold||0}x</td>
      <td class="num podium-silver-count">${r.podium?.silver||0}x</td>
      <td class="num podium-bronze-count">${r.podium?.bronze||0}x</td>
      <td class="num">${r.podium?.total||r.count}${unit ? ' '+unit : ''}</td>
      <td class="num trophy-points">${r.podium?.points||0} pts</td>
    </tr>`;
  }).join('');
  return titleHtml + `<div class="table-scroll trophy-ranking-scroll"><table class="stat-table trophy-ranking-table">
    <colgroup><col class="rank-pos"><col><col class="rank-total"><col class="rank-total"><col class="rank-total"><col class="rank-total"><col class="rank-total"></colgroup>
    <thead><tr><th>Pos.</th><th>Jogador</th><th>🥇 1º</th><th>🥈 2º</th><th>🥉 3º</th><th>Total de pódios</th><th>Pontos</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function buildTrophyOverallRankingSection(title, icon, list, countsMap, podiumMap, emptyMsg){
  const titleHtml = `<div class="table-title">${icon} ${title}</div>`;
  if(!list.length) return titleHtml + `<div class="empty">${emptyMsg || 'Nenhum troféu distribuído ainda.'}</div>`;
  const rankingPatents=createRankingPatentContext();
  const rows=list.map(r=>{
    const count=countsMap[r.p.id] || {mvp:0,artilheiro:0,garcom:0,total:0};
    const podium=podiumMap[r.p.id]?.total||{gold:0,silver:0,bronze:0,total:0,points:0};
    const avatar=r.p.photo ? circlePhotoMarkup(r.p,'table-circle-photo',30) : `<div class="ph-fb" style="width:30px;height:30px;border-radius:50%;">${initials(r.p.name)}</div>`;
    return `<tr class="${rankingPatentClass(r.p.id,rankingPatents)}">
      <td class="num">${r.pos}º</td>
      <td class="name-cell">${avatar}${r.p.nickname}</td>
      <td class="num podium-gold-count">${podium.gold}x</td>
      <td class="num podium-silver-count">${podium.silver}x</td>
      <td class="num podium-bronze-count">${podium.bronze}x</td>
      <td class="num">${podium.total}x</td>
      <td class="num trophy-points">${podium.points} pts</td>
    </tr>`;
  }).join('');
  return titleHtml + `<div class="table-scroll trophy-ranking-scroll"><table class="stat-table trophy-overall-table">
    <colgroup><col class="rank-pos"><col><col class="rank-total"><col class="rank-total"><col class="rank-total"><col class="rank-total"><col class="rank-total"></colgroup>
    <thead><tr><th>Pos.</th><th>Jogador</th><th>🥇 Ouro</th><th>🥈 Prata</th><th>🥉 Bronze</th><th>Conquistas</th><th>Pontos</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function collectiveGeneralCategories(){
  return [
    {key:'duo-month',size:2,scope:'month',icon:'🤝',label:'Melhores duplas do mês'},
    {key:'trio-month',size:3,scope:'month',icon:'🔺',label:'Melhores trios do mês'},
    {key:'duo-round',size:2,scope:'round',icon:'⚡',label:'Melhores duplas em uma rodada'},
    {key:'trio-round',size:3,scope:'round',icon:'🔥',label:'Melhores trios em uma rodada'}
  ];
}
function computeGeneralCollectiveRankings(){
  const medals=['gold','silver','bronze'], medalPoints=[3,2,1];
  const playerTotals={}, formationMaps={}, categories=collectiveGeneralCategories();
  players.forEach(player=>playerTotals[player.id]={gold:0,silver:0,bronze:0,total:0,points:0,teamWins:0});
  [...categories,{key:'team-round'},{key:'team-month'}].forEach(category=>formationMaps[category.key]=new Map());
  const addFormation=(key,item,position,points,month)=>{
    const ids=[...new Set(item.playerIds||[])].sort();
    if(!ids.length)return;
    const map=formationMaps[key], formationKey=ids.join('|');
    let row=map.get(formationKey);
    if(!row){row={playerIds:ids,gold:0,silver:0,bronze:0,total:0,points:0,wins:0,performance:0,appearances:0,latestEnd:''};map.set(formationKey,row);}
    if(position){row[medals[position-1]]++;row.total++;}else row.wins++;
    row.points+=points;
    row.performance+=Number(item.score)||0;
    row.appearances++;
    row.latestEnd=month.endDate>row.latestEnd?month.endDate:row.latestEnd;
    ids.forEach(id=>{
      const total=playerTotals[id]||(playerTotals[id]={gold:0,silver:0,bronze:0,total:0,points:0,teamWins:0});
      if(position){total[medals[position-1]]++;total.total++;}else{total.teamWins++;total.total++;}
      total.points+=points;
    });
  };
  const ensureFormation=(key,item,month)=>{
    const ids=[...new Set(item.playerIds||[])].sort();
    if(!ids.length)return;
    const map=formationMaps[key], formationKey=ids.join('|');
    let row=map.get(formationKey);
    if(!row){row={playerIds:ids,gold:0,silver:0,bronze:0,total:0,points:0,wins:0,performance:0,appearances:0,latestEnd:''};map.set(formationKey,row);}
    row.performance+=Number(item.score)||0;
    row.appearances++;
    row.latestEnd=month.endDate>row.latestEnd?month.endDate:row.latestEnd;
  };
  months.forEach(month=>{
    categories.forEach(category=>{
      const ranking=category.scope==='round'?computeClosedMonthRoundCombinations(month,category.size):computeClosedMonthCombinations(month,category.size);
      ranking.slice(0,10).forEach((item,index)=>{
        if(index<3)addFormation(category.key,item,index+1,medalPoints[index],month);
        else ensureFormation(category.key,item,month);
      });
    });
    computeClosedMonthProfileTeamAwards(month).forEach(item=>{
      const isMonthSelection=item.category.scope==='team-month';
      addFormation(isMonthSelection?'team-month':'team-round',item,null,isMonthSelection?10:5,month);
    });
  });
  const sortAndRank=(map,isTeam)=>{
    const rows=[...map.values()].sort((a,b)=>b.points-a.points||b.gold-a.gold||b.silver-a.silver||b.bronze-a.bronze||b.wins-a.wins||b.performance-a.performance||b.appearances-a.appearances||b.latestEnd.localeCompare(a.latestEnd));
    let position=0,previous=null;
    return rows.slice(0,10).map((row,index)=>{
      const signature=isTeam?`${row.points}|${row.wins}|${row.performance}`:`${row.points}|${row.gold}|${row.silver}|${row.bronze}|${row.performance}`;
      if(signature!==previous)position=index+1;
      previous=signature;
      return {...row,pos:position};
    });
  };
  const lists={};
  categories.forEach(category=>lists[category.key]=sortAndRank(formationMaps[category.key],false));
  lists['team-round']=sortAndRank(formationMaps['team-round'],true);
  lists['team-month']=sortAndRank(formationMaps['team-month'],true);
  return {playerTotals,lists,categories};
}
function buildGeneralCollectiveRanking(title,icon,list,isTeam){
  const rankingPatents=createRankingPatentContext();
  const rows=list.map(row=>{
    const avatars=row.playerIds.map(id=>`<span class="${rankingPatentClass(id,rankingPatents)}">${playerCircleMarkup(players.find(player=>player.id===id),'saved-team-photo',30)}</span>`).join('');
    const names=row.playerIds.map(id=>players.find(player=>player.id===id)?.nickname||'Jogador removido').join(' + ');
    return `<tr><td class="num">${row.pos}º</td><td><div class="closed-combo-ranking-name"><div class="closed-combo-avatars">${avatars}</div><strong>${names}</strong></div></td>${isTeam?`<td class="num">${row.wins}x</td><td class="num trophy-points">${row.points} pts</td>`:`<td class="num podium-gold-count">${row.gold}x</td><td class="num podium-silver-count">${row.silver}x</td><td class="num podium-bronze-count">${row.bronze}x</td><td class="num">${row.total}x</td><td class="num trophy-points">${row.points} pts</td>`}</tr>`;
  }).join('');
  const head=isTeam?'<th>Pos.</th><th>Formação</th><th>Conquistas</th><th>Pontos</th>':'<th>Pos.</th><th>Formação</th><th>🥇 1º</th><th>🥈 2º</th><th>🥉 3º</th><th>Pódios</th><th>Pontos</th>';
  const body=list.length?`<div class="table-scroll trophy-ranking-scroll"><table class="stat-table trophy-ranking-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">Ainda não há conquistas nesta categoria.</div>';
  return `<details class="closed-month-ranking collective-geral-ranking"><summary><span>${icon} ${title}</span><span>Top 10 · abrir</span></summary>${body}</details>`;
}
function buildGeneralCollectiveRankings(data){
  let html='<div class="table-title" style="margin-top:30px;">👥 Rankings coletivos</div><div class="round-summary" style="margin-bottom:12px;">Duplas e trios: 1º = 3 pts, 2º = 2 pts e 3º = 1 pt para cada participante. Melhor time da rodada: 5 pts para cada integrante. Seleção do mês: 10 pts para cada integrante.</div>';
  data.categories.forEach(category=>html+=buildGeneralCollectiveRanking(category.label,category.icon,data.lists[category.key],false));
  html+=buildGeneralCollectiveRanking('Melhores times em uma rodada','⚽',data.lists['team-round'],true);
  html+=buildGeneralCollectiveRanking('Seleções do mês','🌟',data.lists['team-month'],true);
  return html;
}

function computeTrophyExtremes(){
  const artilheiroStats = [], garcomStats = [], mvpScoreStats = [], mvpGaStats = [], mvpRatingStats = [];
  const artilheiroRoundStats = [], garcomRoundStats = [];
  months.forEach(month=>{
    const w = computeMonthWinners(month);
    const totals = computeAllTotals(month.startDate, month.endDate);
    const monthKey = computePeriodMonthKey(month.startDate, month.endDate);
    (w.artilheiroIds || (w.artilheiro?[w.artilheiro]:[])).forEach(playerId=>{
      artilheiroStats.push({playerId,value:totals[playerId].goals,monthKey});
      const bestRound=computeBestRoundStat(playerId,'goals',month.startDate,month.endDate);
      if(bestRound!=null) artilheiroRoundStats.push({playerId,value:bestRound,monthKey});
    });
    (w.garcomIds || (w.garcom?[w.garcom]:[])).forEach(playerId=>{
      garcomStats.push({playerId,value:totals[playerId].assists,monthKey});
      const bestRound=computeBestRoundStat(playerId,'assists',month.startDate,month.endDate);
      if(bestRound!=null) garcomRoundStats.push({playerId,value:bestRound,monthKey});
    });
    if(w.mvp){
      const t = totals[w.mvp];
      mvpScoreStats.push({playerId:w.mvp, value:computeMvpScore(t), monthKey});
      mvpGaStats.push({playerId:w.mvp, value:t.goals+t.assists, monthKey});
      mvpRatingStats.push({playerId:w.mvp, value: t.ratingCount ? t.ratingSum/t.ratingCount : 0, monthKey});
    }
  });
  function pickExtreme(list, mode){
    if(!list.length) return [];
    const val = mode==='max' ? Math.max(...list.map(x=>x.value)) : Math.min(...list.map(x=>x.value));
    return list.filter(x=> x.value===val);
  }
  return {
    artilheiroMax: pickExtreme(artilheiroStats,'max'),
    artilheiroMin: pickExtreme(artilheiroStats,'min'),
    artilheiroRoundMax: pickExtreme(artilheiroRoundStats,'max'),
    garcomMax: pickExtreme(garcomStats,'max'),
    garcomMin: pickExtreme(garcomStats,'min'),
    garcomRoundMax: pickExtreme(garcomRoundStats,'max'),
    mvpScoreMax: pickExtreme(mvpScoreStats,'max'),
    mvpScoreMin: pickExtreme(mvpScoreStats,'min'),
    mvpGaMax: pickExtreme(mvpGaStats,'max'),
    mvpGaMin: pickExtreme(mvpGaStats,'min'),
    mvpRatingMax: pickExtreme(mvpRatingStats,'max'),
  };
}
function buildBigExtremeCard(label, list, unit, decimals, tripleCrownSet, globalList, isPrismaticCategory, secretSets, titleTier){
  if(!list.length){
    return `<div class="record-card record-card-lg record-empty"><div class="record-label">${label}</div>Sem dados ainda</div>`;
  }
  const val = decimals!=null ? list[0].value.toFixed(decimals) : list[0].value;
  const frozenTiers=list.map(item=>frozenSpecialTier(item.playerId,item)).filter(Boolean);
  const secretTier = frozenTiers.includes('cosmic') ? 'cosmic'
    : frozenTiers.includes('platinum') ? 'platinum'
    : (secretSets ? recordListSecretTier(list, secretSets) : null);
  const isCosmic = secretTier==='cosmic';
  const isPlatinum = secretTier==='platinum';
  const isGoat = !isCosmic && !isPlatinum && !!(tripleCrownSet && list.some(item=> tripleCrownSet.has(item.playerId+'|'+item.monthKey)));
  const isRacha = !!(globalList && list.some(item=> isRachaRecord(item, globalList)));
  const tierForHolder = (item)=>{
    const frozen=frozenSpecialTier(item.playerId,item);
    if(frozen==='cosmic') return frozen;
    if(secretSets && isCosmicInstance(item.playerId,item,secretSets.cosmicMonthSet)) return 'cosmic';
    if(frozen==='platinum') return frozen;
    if(secretSets && isPlatinumInstance(item.playerId,secretSets.platinumPlayerSet,item)) return 'platinum';
    if(frozen) return frozen;
    if(tripleCrownSet && tripleCrownSet.has(item.playerId+'|'+item.monthKey)) return 'goat';
    return item.prismatic || hasPrismaticPerformanceAtMonth(item.playerId,item.monthKey) || (globalList && isRachaRecord(item,globalList) && isPrismaticCategory && Number(item.value)===10) ? 'prismatic' : 'normal';
  };
  const holders = list.map(item=>{
    const p = players.find(pl=>pl.id===item.playerId);
    const pname = p ? p.nickname : 'Jogador removido';
    const pphoto = (p && p.photo) ? circlePhotoMarkup(p,'record-circle-photo',26) : `<div class="ph-fb">${p?initials(p.name):'?'}</div>`;
    const holderTier = tierForHolder(item);
    return `<div class="record-holder">
      <div class="record-player">${pphoto}${pname}${recordTierBadge(holderTier)}</div>
      <div class="record-context">${monthLabel(item.monthKey)} · ${recordTierMeta(holderTier)}</div>
    </div>`;
  }).join('');
  const tieHtml = list.length>1 ? `<div class="record-tie-note">${list.length} empatados</div>` : '';
  if(isCosmic){
    return `<div class="record-card record-card-lg record-card-cosmic">
      <div class="cosmic-badge">🌌 Conquistado em Mês Perfeito</div>
      <div class="record-label">${label}</div>
      <div class="record-value">${val}<small>${unit}</small></div>
      ${tieHtml}
      <div class="record-holders">${holders}</div>
    </div>`;
  }
  if(isPlatinum){
    return `<div class="record-card record-card-lg record-card-platinum">
      <div class="platinum-badge">💠 Conquistado sendo Colecionador</div>
      <div class="record-label">${label}</div>
      <div class="record-value">${val}<small>${unit}</small></div>
      ${tieHtml}
      <div class="record-holders">${holders}</div>
    </div>`;
  }
  if(isGoat){
    return `<div class="record-card record-card-lg record-card-goat">
      <div class="goat-badge">🐐 Conquistado sendo GOAT do mês</div>
      <div class="record-label">${label}</div>
      <div class="record-value">${val}<small>${unit}</small></div>
      ${tieHtml}
      <div class="record-holders">${holders}</div>
    </div>`;
  }
  const isPrismatic = frozenTiers.includes('prismatic') || list.some(item=>item.prismatic || hasPrismaticPerformanceAtMonth(item.playerId,item.monthKey)) || (isRacha && isPrismaticCategory && list.some(item=>Number(item.value)===10));
  const titleBadge = !isRacha && titleTier ? `<div class="title-record-badge">${titleTier==='mvp'?'⭐ MVP do mês':(titleTier==='artilheiro'?'⚽ Artilheiro do mês':'🎯 Garçom do mês')}</div>` : '';
  return `<div class="record-card record-card-lg${isRacha ? ' record-racha' : (titleTier ? ' record-card-title' : '')}${isPrismatic ? ' record-card-prismatic' : ''}">
    ${isPrismatic ? '<div class="prismatic-badge">💎 Recorde raro</div>' : ''}
    ${(isRacha && !isPrismatic) ? '<div class="racha-badge">🏆 Recorde do racha</div>' : ''}
    ${titleBadge}
    <div class="record-label">${label}</div>
    <div class="record-value">${val}<small>${unit}</small></div>
    ${tieHtml}
    <div class="record-holders">${holders}</div>
  </div>`;
}


function computePodiumData(startDate,endDate){
  const totals=computeAllTotals(startDate,endDate);
  const eligible=players.filter(p=>(totals[p.id]?.games||0)>0);
  const comparators={
    mvp:(a,b)=>computeMvpScore(totals[b.id])-computeMvpScore(totals[a.id]) || ((totals[b.id].goals+totals[b.id].assists)-(totals[a.id].goals+totals[a.id].assists)),
    artilheiro:(a,b)=>totals[b.id].goals-totals[a.id].goals || ((totals[b.id].goals+totals[b.id].assists)-(totals[a.id].goals+totals[a.id].assists)) || computeMvpScore(totals[b.id])-computeMvpScore(totals[a.id]),
    garcom:(a,b)=>totals[b.id].assists-totals[a.id].assists || ((totals[b.id].goals+totals[b.id].assists)-(totals[a.id].goals+totals[a.id].assists)) || computeMvpScore(totals[b.id])-computeMvpScore(totals[a.id]),
  };
  const result={};
  PODIUM_TYPES.forEach(type=>{
    const sorted=[...eligible].sort(comparators[type]);
    const groups=[];
    sorted.forEach(p=>{
      if(type==='artilheiro' && totals[p.id].goals<=0) return;
      if(type==='garcom' && totals[p.id].assists<=0) return;
      if(type==='mvp' && computeMvpScore(totals[p.id])<=0) return;
      const last=groups[groups.length-1];
      if(last && comparators[type](p,last[0])===0 && comparators[type](last[0],p)===0) last.push(p); else groups.push([p]);
    });
    result[type]={};
    PODIUM_MEDALS.forEach((medal,i)=>{
      const ps=groups[i]||[];
      result[type][medal]={playerIds:ps.map(p=>p.id)};
    });
  });
  return result;
}
function currentPodiums(){ return computePodiumData(periodStart); }
function latestClosedPodiums(){
  const latest=months.length?[...months].sort((a,b)=>b.endDate.localeCompare(a.endDate))[0]:null;
  return latest?computePodiumData(latest.startDate,latest.endDate):null;
}
function playerPodiumCombo(podiums,playerId){
  const combo={mvp:null,artilheiro:null,garcom:null};
  if(!podiums) return combo;
  PODIUM_TYPES.forEach(type=>PODIUM_MEDALS.forEach(medal=>{ if((podiums[type]?.[medal]?.playerIds||[]).includes(playerId)) combo[type]=medal; }));
  return combo;
}
function playerCurrentPodiumMedal(playerId){
  const combo=playerPodiumCombo(currentPodiums(),playerId);
  const medals=PODIUM_TYPES.map(t=>combo[t]).filter(Boolean);
  return medals.includes('gold')?'gold':medals.includes('silver')?'silver':medals.includes('bronze')?'bronze':null;
}
function playerClosedPodiumMedal(playerId){
  const combo=playerPodiumCombo(latestClosedPodiums(),playerId);
  const medals=PODIUM_TYPES.map(t=>combo[t]).filter(Boolean);
  return medals.includes('gold')?'gold':medals.includes('silver')?'silver':medals.includes('bronze')?'bronze':null;
}
function applyPodiumRule(boost,scope,combo){
  const calculated=computePodiumComboBoost(combo,scope==='current'?'current':'closed');
  PLAYER_ATTRIBUTE_KEYS.forEach(key=>boost[key]+=calculated[key]);
}
function applyPodiumCombinationBonus(boost,playerId){
  const conquered=computePodiumComboBoost(playerPodiumCombo(latestClosedPodiums(),playerId),'closed');
  const inProgress=computePodiumComboBoost(playerPodiumCombo(currentPodiums(),playerId),'current');
  PLAYER_ATTRIBUTE_KEYS.forEach(key=>boost[key]+=conquered[key]+inProgress[key]);
}
function computeGoalkeeperPeriodStats(startDate,endDate){const result={};rounds.forEach(round=>{if(startDate&&String(round.date||'')<String(startDate).slice(0,10))return;if(endDate&&String(round.date||'')>String(endDate).slice(0,10))return;Object.entries(round.simulatorStats?.goalkeepers||{}).forEach(([playerId,stat])=>{const player=players.find(item=>item.id===playerId);if(!player||!['goalkeeper','hybrid'].includes(player.role))return;const total=result[playerId]||(result[playerId]={playerId,games:0,wins:0,draws:0,losses:0,goalsConceded:0,cleanSheets:0,saves:0,goals:0,assists:0,points:0,average:4});['games','wins','draws','losses','goalsConceded','cleanSheets','saves','goals','assists'].forEach(key=>total[key]+=Number(stat[key])||0)})});Object.values(result).forEach(stat=>{stat.points=stat.wins*2+stat.cleanSheets*4+stat.saves*2+stat.goals*.5+stat.assists*.4;const cleanRate=stat.games?stat.cleanSheets/stat.games:0,involvement=stat.games?Math.min(1,(stat.goals*.5+stat.assists*.4)/stat.games):0,defense=stat.games?Math.max(0,1-(stat.goalsConceded/stat.games)*.25):0;stat.average=Math.max(4,Math.min(10,4+stat.wins*.2+stat.saves*.3+cleanRate*2+involvement+defense));stat.goalsConcededPerGame=stat.games?stat.goalsConceded/stat.games:0});return result}
function computeGoalkeeperPodium(startDate,endDate){const stats=computeGoalkeeperPeriodStats(startDate,endDate),sorted=Object.values(stats).filter(stat=>stat.games>0).sort((a,b)=>b.points-a.points||a.goalsConcededPerGame-b.goalsConcededPerGame||b.cleanSheets-a.cleanSheets||b.wins-a.wins||b.games-a.games),groups=[];sorted.forEach(stat=>{const last=groups.at(-1)?.[0];if(last&&stat.points===last.points&&stat.goalsConcededPerGame===last.goalsConcededPerGame&&stat.cleanSheets===last.cleanSheets&&stat.wins===last.wins)groups.at(-1).push(stat);else groups.push([stat])});return {stats,gold:(groups[0]||[]).map(stat=>stat.playerId),silver:(groups[1]||[]).map(stat=>stat.playerId),bronze:(groups[2]||[]).map(stat=>stat.playerId)}}
function goalkeeperIdsForSavedTeam(round){const rows=Object.entries(round.simulatorStats?.goalkeepers||{}).map(([playerId,stat])=>({playerId,games:Number(stat.games)||0,wins:Number(stat.wins)||0,cleanSheets:Number(stat.cleanSheets)||0,saves:Number(stat.saves)||0,goals:Number(stat.goals)||0,assists:Number(stat.assists)||0,goalsConceded:Number(stat.goalsConceded)||0})).filter(item=>item.games>0);rows.forEach(item=>{item.points=item.wins*2+item.cleanSheets*4+item.saves*2+item.goals*.5+item.assists*.4;item.goalsConcededPerGame=item.games?item.goalsConceded/item.games:0});rows.sort((a,b)=>b.points-a.points||a.goalsConcededPerGame-b.goalsConcededPerGame||b.cleanSheets-a.cleanSheets||b.saves-a.saves||b.wins-a.wins);if(!rows.length)return[];const best=rows[0];return rows.filter(item=>item.points===best.points&&item.goalsConcededPerGame===best.goalsConcededPerGame&&item.cleanSheets===best.cleanSheets&&item.saves===best.saves&&item.wins===best.wins).map(item=>item.playerId)}
function computeGoalkeeperSavePodium(startDate,endDate,scope){const stats={};if(scope==='month'){Object.values(computeGoalkeeperPeriodStats(startDate,endDate)).forEach(item=>{if(item.games>0)stats[item.playerId]={playerId:item.playerId,saves:item.saves}})}else{rounds.forEach(round=>{if(startDate&&String(round.date||'')<String(startDate).slice(0,10))return;if(endDate&&String(round.date||'')>String(endDate).slice(0,10))return;Object.entries(round.simulatorStats?.goalkeepers||{}).forEach(([playerId,item])=>{const saves=Number(item.saves)||0;if(!stats[playerId]||saves>stats[playerId].saves)stats[playerId]={playerId,saves}})})}const sorted=Object.values(stats).filter(item=>item.saves>0).sort((a,b)=>b.saves-a.saves),groups=[];sorted.forEach(item=>{const last=groups.at(-1)?.[0];if(last&&last.saves===item.saves)groups.at(-1).push(item);else groups.push([item])});return {gold:groups[0]||[],silver:groups[1]||[],bronze:groups[2]||[]}}
function currentGoalkeeperPodium(){return computeGoalkeeperPodium(periodStart)}
function latestClosedGoalkeeperPodium(){const latest=months.length?[...months].sort((a,b)=>b.endDate.localeCompare(a.endDate))[0]:null;return latest?computeGoalkeeperPodium(latest.startDate,latest.endDate):null}
function goalkeeperPodiumMedal(podium,playerId){return ['gold','silver','bronze'].find(medal=>(podium?.[medal]||[]).includes(playerId))||null}
function getGoalkeeperBoosts(playerId){const boost=Object.fromEntries(GOALKEEPER_ATTRIBUTE_KEYS.map(key=>[key,0])),closed={gold:5,silver:3,bronze:2}[goalkeeperPodiumMedal(latestClosedGoalkeeperPodium(),playerId)]||0,current={gold:2,silver:1,bronze:.5}[goalkeeperPodiumMedal(currentGoalkeeperPodium(),playerId)]||0;GOALKEEPER_ATTRIBUTE_KEYS.forEach(key=>boost[key]=closed+current);return boost}
function goalkeeperPodiumCards(){const current=currentGoalkeeperPodium(),latest=latestClosedGoalkeeperPodium(),currentBonus={gold:2,silver:1,bronze:.5},closedBonus={gold:5,silver:3,bronze:2},playerLine=id=>{const p=players.find(item=>item.id===id);if(!p)return '';const photo=p.photo?circlePhotoMarkup(p,'table-circle-photo',28):`<div class="ph-fb" style="width:28px;height:28px;border-radius:50%">${initials(p.name)}</div>`;return `<div class="podium-award-player">${photo}<strong>${p.nickname}</strong></div>`};return ['gold','silver','bronze'].map(medal=>{const icon={gold:'🥇',silver:'🥈',bronze:'🥉'}[medal],now=(current[medal]||[]).map(playerLine).join(''),old=(latest?.[medal]||[]).map(playerLine).join('');return `<div class="podium-award-card medal-${medal}"><div class="podium-award-head"><b>${icon} Lev Yashin · ${PODIUM_MEDAL_LABEL[medal]}</b></div><div class="podium-award-list"><div class="podium-status-block is-current medal-${medal}"><div class="podium-status-label"><span>Em andamento</span><span>+${currentBonus[medal]} em cada atributo de goleiro</span></div>${now||'<span class="record-context">Sem goleiro com partidas</span>'}</div><div class="podium-status-block is-achievement medal-${medal}"><div class="podium-status-label"><span>Conquista Lev Yashin · +${closedBonus[medal]} em cada atributo de goleiro</span><b>${icon} ${PODIUM_MEDAL_LABEL[medal]}</b></div>${old||'<span class="record-context">Sem conquista encerrada</span>'}</div></div></div>`}).join('')}
function goalkeeperSavePodiumCards(scope){const latest=months.length?[...months].sort((a,b)=>b.endDate.localeCompare(a.endDate))[0]:null,current=computeGoalkeeperSavePodium(periodStart,null,scope),closed=latest?computeGoalkeeperSavePodium(latest.startDate,latest.endDate,scope):null,label=scope==='round'?'Defesas em uma rodada':'Defesas no mês',playerLine=item=>{const p=players.find(player=>player.id===item.playerId);if(!p)return '';const photo=p.photo?circlePhotoMarkup(p,'table-circle-photo',28):`<div class="ph-fb" style="width:28px;height:28px;border-radius:50%">${initials(p.name)}</div>`;return `<div class="podium-award-player">${photo}<strong>${p.nickname}</strong><span>${item.saves} DEF</span></div>`};return ['gold','silver','bronze'].map(medal=>{const icon={gold:'🥇',silver:'🥈',bronze:'🥉'}[medal],now=(current[medal]||[]).map(playerLine).join(''),old=(closed?.[medal]||[]).map(playerLine).join('');return `<div class="podium-award-card medal-${medal}"><div class="podium-award-head"><b>${icon} ${label} · ${PODIUM_MEDAL_LABEL[medal]}</b></div><div class="podium-award-list"><div class="podium-status-block is-current medal-${medal}"><div class="podium-status-label"><span>Em andamento</span></div>${now||'<span class="record-context">Sem defesas registradas</span>'}</div><div class="podium-status-block is-achievement medal-${medal}"><div class="podium-status-label"><span>Conquista oficial</span></div>${old||'<span class="record-context">Sem conquista encerrada</span>'}</div></div></div>`}).join('')}
function computeGoalkeeperRecords(){const matchEntries=[],roundEntries=[],monthEntries=[];rounds.forEach(round=>{(round.simulatorStats?.goalkeeperMatches||[]).forEach(stat=>{if((Number(stat.saves)||0)>0)matchEntries.push({playerId:stat.playerId,round,matchNumber:Number(stat.matchNumber)||0,saves:Number(stat.saves)||0})});Object.entries(round.simulatorStats?.goalkeepers||{}).forEach(([playerId,stat])=>{if((Number(stat.games)||0)>0)roundEntries.push({playerId,round,points:Number(stat.points)||0,goalsConceded:Number(stat.goalsConceded)||0,saves:Number(stat.saves)||0})})});months.forEach(month=>Object.values(computeGoalkeeperPeriodStats(month.startDate,month.endDate)).filter(stat=>stat.games>0).forEach(stat=>monthEntries.push({...stat,monthKey:computePeriodMonthKey(month.startDate,month.endDate)})));const max=(list,key)=>{if(!list.length)return[];const value=Math.max(...list.map(item=>item[key]));if(value<=0)return[];return list.filter(item=>item[key]===value).map(item=>({...item,value}))},min=(list,key)=>{if(!list.length)return[];const value=Math.min(...list.map(item=>item[key]));return list.filter(item=>item[key]===value).map(item=>({...item,value}))};return {bestRound:max(roundEntries,'points'),leastRound:min(roundEntries,'goalsConceded'),leastMonth:min(monthEntries,'goalsConceded'),matchSaves:max(matchEntries,'saves'),roundSaves:max(roundEntries,'saves'),monthSaves:max(monthEntries,'saves')}}
function goalkeeperRecordCard(label,list,unit,decimals=0){if(!list.length)return `<div class="record-card record-card-geral record-empty"><div class="record-label">${label}</div>Sem dados ainda</div>`;const value=Number(list[0].value).toFixed(decimals),holders=list.map(item=>{const p=players.find(player=>player.id===item.playerId),match=item.matchNumber?` · Partida ${item.matchNumber}`:'';return `<div class="record-holder"><div class="record-player">${p?.photo?circlePhotoMarkup(p,'record-circle-photo',22):`<div class="ph-fb">${p?initials(p.name):'?'}</div>`}${p?.nickname||'Jogador removido'}</div><div class="record-context">${item.round?`${item.round.label}${match} · ${fmtDate(item.round.date)}`:monthLabel(item.monthKey)}</div></div>`}).join('');return `<div class="record-card record-card-geral"><div class="record-label">${label}</div><div class="record-value">${value}<small>${unit}</small></div>${holders}</div>`}
function buildMonthlyPodiumSection(){
  const current=currentPodiums();
  const latest=latestClosedPodiums();
  const playerLine=(id)=>{const p=players.find(x=>x.id===id);if(!p)return '';const photo=p.photo?circlePhotoMarkup(p,'table-circle-photo',28):`<div class="ph-fb" style="width:28px;height:28px;border-radius:50%">${initials(p.name)}</div>`;return `<div class="podium-award-player">${photo}<strong>${p.nickname}</strong></div>`};
  const cards=[];
  PODIUM_TYPES.forEach(type=>PODIUM_MEDALS.forEach(medal=>{
    const now=(current[type]?.[medal]?.playerIds||[]).map(playerLine).join('');
    const old=(latest?.[type]?.[medal]?.playerIds||[]).map(playerLine).join('');
    const icon=medal==='gold'?'🥇':medal==='silver'?'🥈':'🥉';
    const currentBlock=`<div class="podium-status-block is-current medal-${medal}"><div class="podium-status-label"><span>Em andamento</span><span>Aura ${PODIUM_MEDAL_LABEL[medal].toLowerCase()}</span></div>${now||'<span class="record-context">Sem colocado atual</span>'}</div>`;
    const conquestBlock=`<div class="podium-status-block is-achievement medal-${medal}"><div class="podium-status-label"><span>Conquista oficial</span><b>${icon} ${PODIUM_MEDAL_LABEL[medal]}</b></div>${old||'<span class="record-context">Sem conquista encerrada</span>'}</div>`;
    cards.push(`<div class="podium-award-card medal-${medal}"><div class="podium-award-head"><b>${icon} ${PODIUM_TYPE_LABEL[type]} ${PODIUM_MEDAL_LABEL[medal]}</b></div><div class="podium-award-list">${currentBlock}${conquestBlock}</div></div>`);
  }));
  const goalkeeperRecords=computeGoalkeeperRecords();
  return `<section class="monthly-podium-section"><div class="monthly-podium-title">⚽ Pódios dos jogadores</div><div class="monthly-podium-sub">MVP, Artilheiro e Garçom calculados somente com o desempenho como jogador de linha.</div><div class="monthly-podium-grid">${cards.join('')}</div></section><section class="monthly-podium-section goalkeeper-podium-section"><div class="monthly-podium-title">🧤 Pódios dos goleiros · Lev Yashin</div><div class="monthly-podium-sub">O Troféu Lev Yashin e os pódios de defesas são exclusivos do desempenho no gol. Para híbridos, nota, pontuação e bônus permanecem separados dos dados de jogador.</div><div class="monthly-podium-grid">${goalkeeperPodiumCards()}${goalkeeperSavePodiumCards('round')}${goalkeeperSavePodiumCards('month')}</div><div class="monthly-podium-title" style="margin-top:22px">🧤 Recordes de goleiros</div><div class="record-grid-lg">${goalkeeperRecordCard('Mais defesas em uma partida',goalkeeperRecords.matchSaves,'defesas')}${goalkeeperRecordCard('Mais defesas em uma rodada',goalkeeperRecords.roundSaves,'defesas')}${goalkeeperRecordCard('Mais defesas em um mês',goalkeeperRecords.monthSaves,'defesas')}${goalkeeperRecordCard('Melhor rodada de um goleiro',goalkeeperRecords.bestRound,'pts',1)}${goalkeeperRecordCard('Menos gols sofridos em uma rodada',goalkeeperRecords.leastRound,'gols')}${goalkeeperRecordCard('Menos gols sofridos em um mês',goalkeeperRecords.leastMonth,'gols')}</div></section>`;
}

function computeCurrentPeriodStats(){
  const totals = computeAllTotals(periodStart);
  const withGames = players.filter(p => (totals[p.id]?.games || 0) > 0);
  if(!withGames.length) return null;
  const compare=(a,b,type)=>{
    const ta=totals[a.id], tb=totals[b.id];
    const primary=type==='mvp' ? computeMvpScore(tb)-computeMvpScore(ta) : (type==='artilheiro' ? tb.goals-ta.goals : tb.assists-ta.assists);
    const ga=(tb.goals+tb.assists)-(ta.goals+ta.assists);
    const avg=(tb.ratingCount?tb.ratingSum/tb.ratingCount:0)-(ta.ratingCount?ta.ratingSum/ta.ratingCount:0);
    const games=(ta.games||0)-(tb.games||0);
    const score=computeMvpScore(tb)-computeMvpScore(ta);
    return primary || ga || avg || games || score;
  };
  const leaders=(type)=>{
    const best=[...withGames].sort((a,b)=>compare(a,b,type))[0];
    return withGames.filter(p=>compare(p,best,type)===0);
  };
  const artLeaders=leaders('artilheiro');
  const garLeaders=leaders('garcom');
  const mvpLeaders=leaders('mvp');
  const bestArtilheiro=artLeaders[0], bestGarcom=garLeaders[0], bestMvp=mvpLeaders[0];
  const tArt = totals[bestArtilheiro.id], tGar = totals[bestGarcom.id], tMvp = totals[bestMvp.id];

  return {
    artilheiro: tArt.goals>0 ? { playerId: bestArtilheiro.id, playerIds:artLeaders.map(p=>p.id), goals: tArt.goals, roundBestGoals: computeBestRoundStat(bestArtilheiro.id, 'goals', periodStart) || 0 } : null,
    garcom: tGar.assists>0 ? { playerId: bestGarcom.id, playerIds:garLeaders.map(p=>p.id), assists: tGar.assists, roundBestAssists: computeBestRoundStat(bestGarcom.id, 'assists', periodStart) || 0 } : null,
    mvp: computeMvpScore(tMvp)>0 ? { playerId: bestMvp.id, playerIds:mvpLeaders.map(p=>p.id), score: computeMvpScore(tMvp), ga: tMvp.goals + tMvp.assists, avg: tMvp.ratingCount ? tMvp.ratingSum/tMvp.ratingCount : 0 } : null,
  };
}
function isCurrentLeader(current,type,playerId){ return (current?.[type]?.playerIds || (current?.[type]?.playerId?[current[type].playerId]:[])).includes(playerId); }
function isCurrentGoat(current,playerId){ return ['mvp','artilheiro','garcom'].every(type=>isCurrentLeader(current,type,playerId)); }
function buildCurrentLeaderCard(label, playerId, value, unit, decimals, isGoat, isRacha, isPrismaticCategory, isPlatinum, isCosmic){
  const currentData=computeCurrentPeriodStats();
  const leaderType=label.includes('MVP') ? 'mvp' : (label.includes('artilheiro') ? 'artilheiro' : 'garcom');
  const leaderIds=currentData?.[leaderType]?.playerIds || (Array.isArray(playerId) ? playerId : (playerId==null ? [] : [playerId]));
  const officialSpecial=latestClosedSpecialPatentSets();
  const currentRecords=computeRecords();
  isCosmic=leaderIds.some(id=>officialSpecial.cosmic.has(id));
  isPlatinum=!isCosmic && leaderIds.some(id=>officialSpecial.collector.has(id));
  isGoat=!isCosmic && !isPlatinum && leaderIds.some(id=>isCurrentGoat(currentData,id));
  playerId=leaderIds[0] || null;
  if(playerId==null){
    return `<div class="record-card record-card-lg record-empty"><div class="record-label">${label}</div>Sem dados neste período</div>`;
  }
  const val = decimals!=null ? value.toFixed(decimals) : value;
  const currentTierForHolder = (id)=>{
    if(officialSpecial.cosmic.has(id)) return 'cosmic';
    if(officialSpecial.collector.has(id)) return 'platinum';
    if(isCurrentGoat(currentData,id)) return 'goat';
    return isPrismaticCategory && Number(value)===10 ? 'prismatic' : 'normal';
  };
  const holders = leaderIds.map(id=>{
    const p = players.find(pl=>pl.id===id);
    const pname = p ? p.nickname : 'Jogador removido';
    const pphoto = (p && p.photo) ? circlePhotoMarkup(p,'record-circle-photo',26) : `<div class="ph-fb">${p?initials(p.name):'?'}</div>`;
    const holderTier = currentTierForHolder(id);
    return `<div class="record-holder">
      <div class="record-player">${pphoto}${pname}${recordTierBadge(holderTier)}</div>
      <div class="record-context">Mês em andamento · ${recordTierMeta(holderTier)}</div>
    </div>`;
  }).join('');
  const tieHtml = leaderIds.length>1 ? `<div class="record-tie-note">${leaderIds.length} empatados</div>` : '';
  const contextHtml = `${tieHtml}<div class="record-holders">${holders}</div>`;
  if(isCosmic){
    return `<div class="record-card record-card-lg record-card-cosmic">
      <div class="cosmic-badge">🌌 COSMIC (em andamento)</div>
      <div class="record-label">${label}</div>
      <div class="record-value">${val}<small>${unit}</small></div>
      ${contextHtml}
    </div>`;
  }
  if(isPlatinum){
    return `<div class="record-card record-card-lg record-card-platinum">
      <div class="platinum-badge">💠 Colecionador (em andamento)</div>
      <div class="record-label">${label}</div>
      <div class="record-value">${val}<small>${unit}</small></div>
      ${contextHtml}
    </div>`;
  }
  if(isGoat){
    return `<div class="record-card record-card-lg record-card-goat">
      <div class="goat-badge">🐐 GOAT do mês (em andamento)</div>
      <div class="record-label">${label}</div>
      <div class="record-value">${val}<small>${unit}</small></div>
      ${contextHtml}
    </div>`;
  }
  const isPrismaticLive = leaderIds.some(id=>isCurrentTitleContender(id));
  const isPrismatic = isRacha && isPrismaticCategory && Number(value)===10;
  const titleBadge = !isRacha && leaderType ? `<div class="title-record-badge">${leaderType==='mvp'?'⭐ MVP atual':(leaderType==='artilheiro'?'⚽ Artilheiro atual':'🎯 Garçom atual')}</div>` : '';
  return `<div class="record-card record-card-lg${isRacha ? ' record-racha' : ' record-card-title'}${isPrismatic ? ' record-card-prismatic' : ''}${isPrismaticLive ? ' record-card-current-glow' : ''}">
    ${isPrismatic ? '<div class="prismatic-badge">💎 Recorde raro (em andamento)</div>' : ''}
    ${(isRacha && !isPrismatic) ? '<div class="racha-badge">🏆 Recorde do racha (em andamento)</div>' : ''}
    ${titleBadge}
    <div class="record-label">${label}</div>
    <div class="record-value">${val}<small>${unit}</small></div>
    ${contextHtml}
  </div>`;
}
function buildTrophySection(){
  if(!players.length) return '<div class="empty">Cadastre jogadores para começar a acumular troféus.</div>';
  const trophyCounts = getTrophyCounts();
  const trophyPodiums = computeTrophyPodiumCounts();
  const collectiveRankings = computeGeneralCollectiveRankings();
  const overallPodiums={};
  const withTotal = {};
  players.forEach(p=>{
    const c = trophyCounts[p.id] || {mvp:0, artilheiro:0, garcom:0};
    const collective = collectiveRankings.playerTotals[p.id] || {gold:0,silver:0,bronze:0,total:0,points:0};
    withTotal[p.id] = {...c, total: c.mvp + c.artilheiro + c.garcom + collective.total};
    const m=trophyPodiums[p.id]?.mvp||{gold:0,silver:0,bronze:0,total:0,points:0};
    const a=trophyPodiums[p.id]?.artilheiro||{gold:0,silver:0,bronze:0,total:0,points:0};
    const g=trophyPodiums[p.id]?.garcom||{gold:0,silver:0,bronze:0,total:0,points:0};
    overallPodiums[p.id]={total:{
      gold:m.gold+a.gold+g.gold+collective.gold,
      silver:m.silver+a.silver+g.silver+collective.silver,
      bronze:m.bronze+a.bronze+g.bronze+collective.bronze,
      total:m.total+a.total+g.total+collective.total,
      points:m.points+a.points+g.points+collective.points
    }};
  });
  const rankingTotal = computeTrophyRankingList(withTotal, 'total', overallPodiums);
  const rankingMvp = computeTrophyRankingList(withTotal, 'mvp', trophyPodiums);
  const rankingArt = computeTrophyRankingList(withTotal, 'artilheiro', trophyPodiums);
  const rankingGar = computeTrophyRankingList(withTotal, 'garcom', trophyPodiums);
  const ex = computeTrophyExtremes();
  const cur = computeCurrentPeriodStats();
  const globalRec = computeRecords();
  const tripleCrownSet = new Set(computeTripleCrownHistory().map(c=> c.playerId+'|'+c.monthKey));
  const reigning = computeReigningTitles();
  const reigningGoatId = (reigning && reigning.isGoat) ? reigning.goatPlayerId : null;
  const mvpLeaderIsGoat = !!(cur && cur.mvp && reigningGoatId && cur.mvp.playerId===reigningGoatId);
  const artLeaderIsGoat = !!(cur && cur.artilheiro && reigningGoatId && cur.artilheiro.playerId===reigningGoatId);
  const garLeaderIsGoat = !!(cur && cur.garcom && reigningGoatId && cur.garcom.playerId===reigningGoatId);

  const curMonthKey = computePeriodMonthKey(periodStart);
  const curMvpScoreIsRacha = !!(cur && cur.mvp && isRachaRecord({playerId:cur.mvp.playerId, value:cur.mvp.score, monthKey:curMonthKey}, globalRec.monthScore));
  const curMvpGaIsRacha = !!(cur && cur.mvp && isRachaRecord({playerId:cur.mvp.playerId, value:cur.mvp.ga, monthKey:curMonthKey}, globalRec.monthParticipacao));
  const curMvpAvgIsRacha = !!(cur && cur.mvp && Number(cur.mvp.avg)===10 && isRachaRecord({playerId:cur.mvp.playerId, value:cur.mvp.avg, monthKey:curMonthKey}, globalRec.monthAvgRating));
  const curArtGoalsIsRacha = !!(cur && cur.artilheiro && isRachaRecord({playerId:cur.artilheiro.playerId, value:cur.artilheiro.goals, monthKey:curMonthKey}, globalRec.monthGoals));
  const curArtRoundIsRacha = !!(cur && cur.artilheiro && isRachaRecord({playerId:cur.artilheiro.playerId, value:cur.artilheiro.roundBestGoals||0}, globalRec.roundGoals));
  const curGarAssistsIsRacha = !!(cur && cur.garcom && isRachaRecord({playerId:cur.garcom.playerId, value:cur.garcom.assists, monthKey:curMonthKey}, globalRec.monthAssists));
  const curGarRoundIsRacha = !!(cur && cur.garcom && isRachaRecord({playerId:cur.garcom.playerId, value:cur.garcom.roundBestAssists||0}, globalRec.roundAssists));

  const secretSets = computeSecretRecordSets();
  const officialSpecial = latestClosedSpecialPatentSets();
  const mvpLeaderIsPlatinum = !!(cur && cur.mvp && officialSpecial.collector.has(cur.mvp.playerId));
  const artLeaderIsPlatinum = !!(cur && cur.artilheiro && officialSpecial.collector.has(cur.artilheiro.playerId));
  const garLeaderIsPlatinum = !!(cur && cur.garcom && officialSpecial.collector.has(cur.garcom.playerId));
  const mvpLeaderIsCosmic = !!(cur && cur.mvp && officialSpecial.cosmic.has(cur.mvp.playerId));
  const artLeaderIsCosmic = !!(cur && cur.artilheiro && officialSpecial.cosmic.has(cur.artilheiro.playerId));
  const garLeaderIsCosmic = !!(cur && cur.garcom && officialSpecial.cosmic.has(cur.garcom.playerId));

  let html = buildMonthlyPodiumSection();
  html += `<div class="round-summary" style="margin-bottom:18px;"><b>Sistema de pontos:</b> MVP — 1º = 10 pts, 2º = 6 pts, 3º = 4 pts. Artilheiro e garçom — 1º = 6 pts, 2º = 4 pts, 3º = 2 pts. Duplas e trios — 1º = 3 pts, 2º = 2 pts, 3º = 1 pt. Melhor time de uma rodada — 5 pts para cada participante. Seleção do mês — 10 pts para cada participante. Todas essas conquistas entram em “Maiores de todos os tempos”. Desempate: mais ouros, depois pratas e bronzes; igualdade completa divide a colocação.</div>`;
  html += buildTrophyOverallRankingSection('Maiores de todos os tempos', '🏆', rankingTotal, withTotal, overallPodiums, 'Nenhum troféu distribuído ainda. Eles são liberados toda vez que você fecha um mês (ou pelo botão "Editar" acima).');
  html += buildGeneralCollectiveRankings(collectiveRankings);

  html += buildTrophyRankingSection('Ranking de MVP do mês', '⭐', rankingMvp, 'x');
  html += `<div class="record-grid-lg" style="margin-bottom:26px;">
    ${buildBigExtremeCard('Maior pontuação de um MVP', ex.mvpScoreMax, 'pts', 1, tripleCrownSet, globalRec.monthScore, false, secretSets)}
    ${buildBigExtremeCard('Maior G/A de um MVP', ex.mvpGaMax, 'G/A', null, tripleCrownSet, globalRec.monthParticipacao, false, secretSets)}
    ${buildBigExtremeCard('Maior nota média de um MVP', ex.mvpRatingMax, 'nota', 1, tripleCrownSet, globalRec.monthAvgRating, true, secretSets)}
    ${buildCurrentLeaderCard('Pontuação do MVP atual', cur && cur.mvp ? cur.mvp.playerId : null, cur && cur.mvp ? cur.mvp.score : 0, 'pts', 1, mvpLeaderIsGoat, curMvpScoreIsRacha, false, mvpLeaderIsPlatinum, mvpLeaderIsCosmic)}
    ${buildCurrentLeaderCard('G/A do MVP atual', cur && cur.mvp ? cur.mvp.playerId : null, cur && cur.mvp ? cur.mvp.ga : 0, 'G/A', null, mvpLeaderIsGoat, curMvpGaIsRacha, false, mvpLeaderIsPlatinum, mvpLeaderIsCosmic)}
    ${buildCurrentLeaderCard('Nota média do MVP atual', cur && cur.mvp ? cur.mvp.playerId : null, cur && cur.mvp ? cur.mvp.avg : 0, 'nota', 1, mvpLeaderIsGoat, curMvpAvgIsRacha, true, mvpLeaderIsPlatinum, mvpLeaderIsCosmic)}
  </div>`;

  html += buildTrophyRankingSection('Ranking de artilheiros do mês', '⚽', rankingArt, 'x');
  html += `<div class="record-grid-lg" style="margin-bottom:26px;">
    ${buildBigExtremeCard('Maior quantidade de gols de um artilheiro', ex.artilheiroMax, 'gols', null, tripleCrownSet, globalRec.monthGoals, false, secretSets)}
    ${buildBigExtremeCard('Maior quantidade de gols de um artilheiro na melhor rodada', ex.artilheiroRoundMax, 'gols', null, tripleCrownSet, globalRec.roundGoals, false, secretSets)}
    ${buildCurrentLeaderCard('Gols do artilheiro atual', cur && cur.artilheiro ? cur.artilheiro.playerId : null, cur && cur.artilheiro ? cur.artilheiro.goals : 0, 'gols', null, artLeaderIsGoat, curArtGoalsIsRacha, false, artLeaderIsPlatinum, artLeaderIsCosmic)}
    ${buildCurrentLeaderCard('Gols do artilheiro atual na melhor rodada', cur && cur.artilheiro ? cur.artilheiro.playerId : null, cur && cur.artilheiro ? (cur.artilheiro.roundBestGoals||0) : 0, 'gols', null, artLeaderIsGoat, curArtRoundIsRacha, false, artLeaderIsPlatinum, artLeaderIsCosmic)}
  </div>`;

  html += buildTrophyRankingSection('Ranking de garçons do mês', '🎯', rankingGar, 'x');
  html += `<div class="record-grid-lg" style="margin-bottom:6px;">
    ${buildBigExtremeCard('Maior quantidade de assistências de um garçom', ex.garcomMax, 'assist.', null, tripleCrownSet, globalRec.monthAssists, false, secretSets)}
    ${buildBigExtremeCard('Maior quantidade de assistências de um garçom na melhor rodada', ex.garcomRoundMax, 'assist.', null, tripleCrownSet, globalRec.roundAssists, false, secretSets)}
    ${buildCurrentLeaderCard('Assistências do garçom atual', cur && cur.garcom ? cur.garcom.playerId : null, cur && cur.garcom ? cur.garcom.assists : 0, 'assist.', null, garLeaderIsGoat, curGarAssistsIsRacha, false, garLeaderIsPlatinum, garLeaderIsCosmic)}
    ${buildCurrentLeaderCard('Assistências do garçom atual na melhor rodada', cur && cur.garcom ? cur.garcom.playerId : null, cur && cur.garcom ? (cur.garcom.roundBestAssists||0) : 0, 'assist.', null, garLeaderIsGoat, curGarRoundIsRacha, false, garLeaderIsPlatinum, garLeaderIsCosmic)}
  </div>`;

  return html;
}

function buildTripleCrownSection(){
  const crowns = computeTripleCrownHistory();
  const titleHtml = `<div class="table-title">🐐 Tríplice coroa (MVP + artilheiro + garçom no mesmo mês)</div>`;
  if(!crowns.length){
    return titleHtml + `<div class="empty">Ninguém fechou um mês sendo MVP, artilheiro e garçom ao mesmo tempo ainda. É a marca mais rara do racha.</div>`;
  }
  const counts = {};
  crowns.forEach(c=>{ counts[c.playerId] = (counts[c.playerId]||0) + 1; });
  const rows = players.map(p=> ({p, count: counts[p.id]||0}))
    .filter(r=> r.count>0)
    .sort((a,b)=> b.count-a.count || a.p.nickname.localeCompare(b.p.nickname, 'pt-BR'));
  let pos = 0, prevCount = null;
  const ranked = rows.map(r=>{
    if(r.count !== prevCount){ pos++; prevCount = r.count; }
    return {...r, pos};
  });
  const rankingPatents=createRankingPatentContext();
  const rowsHtml = ranked.map(r=>{
    const pphoto = r.p.photo ? circlePhotoMarkup(r.p,'table-circle-photo',30) : `<div class="ph-fb" style="width:30px;height:30px;border-radius:50%;">${initials(r.p.name)}</div>`;
    return `<tr class="${rankingPatentClass(r.p.id,rankingPatents)}"><td class="num">${r.pos}º</td><td class="name-cell">${pphoto}${r.p.nickname}</td><td class="num">${r.count}x</td></tr>`;
  }).join('');
  return titleHtml + `<div class="record-grid" style="margin-bottom:16px;">
    <div class="record-card record-card-goat">
      <div class="goat-badge">🐐 Recorde raríssimo</div>
      <div class="record-label">Total de tríplices coroas já conquistadas no racha</div>
      <div class="record-value">${crowns.length}<small>x</small></div>
    </div>
  </div>
  <div class="table-scroll"><table class="stat-table">
    <thead><tr><th>Pos.</th><th>Jogador</th><th>Vezes</th></tr></thead>
    <tbody>${rowsHtml}</tbody></table></div>`;
}

function openTrophyEditModal(){
  if(!isAdmin) return;
  const counts = computeAutomaticTrophyCounts();
  const wrap = $('trophyEditList');
  if(!players.length){
    wrap.innerHTML = '<div class="empty">Cadastre jogadores primeiro.</div>';
  } else {
    wrap.innerHTML = players.map(p=>{
      const auto = counts[p.id] || {mvp:0,artilheiro:0,garcom:0};
      const manual = manualTrophyAdjustments[p.id] || {mvp:0,artilheiro:0,garcom:0};
      const totalMvp = auto.mvp + (manual.mvp||0);
      const totalArt = auto.artilheiro + (manual.artilheiro||0);
      const totalGar = auto.garcom + (manual.garcom||0);
      return `<div class="trophy-edit-row" data-id="${p.id}" data-auto-mvp="${auto.mvp}" data-auto-art="${auto.artilheiro}" data-auto-gar="${auto.garcom}">
        <div class="te-name">${p.nickname}</div>
        <input type="number" min="0" class="te-mvp" value="${totalMvp}">
        <input type="number" min="0" class="te-art" value="${totalArt}">
        <input type="number" min="0" class="te-gar" value="${totalGar}">
      </div>`;
    }).join('');
  }
  $('trophyEditOverlay').classList.add('active');
}
window.openTrophyEditModal = openTrophyEditModal;
$('btnCancelTrophyEdit').addEventListener('click', ()=> $('trophyEditOverlay').classList.remove('active'));
$('btnSaveTrophyEdits').addEventListener('click', async ()=>{
  document.querySelectorAll('#trophyEditList .trophy-edit-row').forEach(row=>{
    const pid = row.dataset.id;
    const autoMvp = Number(row.dataset.autoMvp)||0, autoArt = Number(row.dataset.autoArt)||0, autoGar = Number(row.dataset.autoGar)||0;
    const newMvp = Math.max(0, Number(row.querySelector('.te-mvp').value)||0);
    const newArt = Math.max(0, Number(row.querySelector('.te-art').value)||0);
    const newGar = Math.max(0, Number(row.querySelector('.te-gar').value)||0);
    manualTrophyAdjustments[pid] = { mvp: newMvp-autoMvp, artilheiro: newArt-autoArt, garcom: newGar-autoGar };
  });
  await saveMonth();
  $('trophyEditOverlay').classList.remove('active');
  renderGeral();
  showToast('Troféus atualizados!');
});

function monthKeyFromSavedLabel(label){
  const match = String(label||'').trim().match(/^(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\s*\/?\s*(\d{4})$/i);
  if(!match) return '';
  const names = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const index = names.indexOf(match[1].toLowerCase());
  return index>=0 ? `${match[2]}-${String(index+1).padStart(2,'0')}` : '';
}
function computePeriodMonthKey(periodStartISO, periodEndISO){
  if(!periodStartISO) return '';
  const savedMonth = (months||[]).find(m=>m.startDate===periodStartISO && m.endDate===periodEndISO);
  if(savedMonth) return `closed:${savedMonth.id || savedMonth.startDate+'|'+savedMonth.endDate}`;
  const start = new Date(periodStartISO);
  const end = periodEndISO ? new Date(periodEndISO) : new Date();
  let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if(cur >= endDateOnly) return periodStartISO.slice(0,7);
  const counts = {};
  while(cur < endDateOnly){
    const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`;
    counts[key] = (counts[key]||0) + 1;
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate()+1);
  }
  let bestKey = periodStartISO.slice(0,7), bestCount = -1;
  Object.entries(counts).forEach(([k,c])=>{
    if(c > bestCount){ bestCount = c; bestKey = k; }
  });
  return bestKey;
}
function monthLabel(monthKey){
  if(String(monthKey||'').startsWith('closed:')){
    const identity=String(monthKey).slice(7);
    const saved=(months||[]).find(m=>m.id===identity || (m.startDate+'|'+m.endDate)===identity);
    if(saved) return `${saved.label || 'Período fechado'} · ${fmtDate(saved.startDate)} até ${fmtDate(saved.endDate)}`;
  }
  if(!monthKey) return '—';
  const [y,m] = monthKey.split('-');
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const idx = parseInt(m,10)-1;
  return `${names[idx]||m}/${y}`;
}
function recordPeriodKeyForRound(round){
  const closedMonth = findClosedMonthForRound(round);
  if(closedMonth) return computePeriodMonthKey(closedMonth.startDate, closedMonth.endDate);
  if(periodStart && round.date >= periodStart.slice(0,10)) return computePeriodMonthKey(periodStart);
  return (round.date||'').slice(0,7);
}

function pickRecordHolders(list, key){
  if(!list.length) return [];
  const max = Math.max(...list.map(x=>x[key]));
  if(max <= 0) return [];
  return list.filter(x=> x[key]===max).map(x=>({...x, value:x[key]}));
}

function computeRecords(officialOnly=false){
  const roundEntries = [];
  const monthMap = {};
  const ratingTenCounts = {};
  const ratingTenLastRound = {};

  rounds.forEach(r=>{
    if(officialOnly && !findClosedMonthForRound(r)) return;
    const closedMonth = findClosedMonthForRound(r);
    const monthKey = closedMonth ? computePeriodMonthKey(closedMonth.startDate, closedMonth.endDate) : '';
    const periodId = closedMonth ? `${closedMonth.startDate}|${closedMonth.endDate}` : '';
    Object.entries(r.entries||{}).forEach(([pid,e])=>{
      const hasData = (e.goals!=='' && e.goals!=null) || (e.assists!=='' && e.assists!=null) || (e.rating!=='' && e.rating!=null);
      if(!hasData) return;
      const goals = Number(e.goals)||0;
      const assists = Number(e.assists)||0;
      const rating = (e.rating!=='' && e.rating!=null) ? Number(e.rating) : null;
      const participacao = goals + assists;
      const score = (rating!==null ? rating : 0)*4 + goals*5 + assists*4.5;
      roundEntries.push({playerId:pid, round:r, goals, assists, participacao, score});

      if(rating===10){
        ratingTenCounts[pid] = (ratingTenCounts[pid]||0) + 1;
        ratingTenLastRound[pid] = r;
      }

      if(monthKey){
        const key = pid+'|'+periodId;
        if(!monthMap[key]) monthMap[key] = {playerId:pid, monthKey, startDate:closedMonth.startDate, endDate:closedMonth.endDate, goals:0, assists:0, ratingSum:0, ratingCount:0, ratingTenCount:0};
        monthMap[key].goals += goals;
        monthMap[key].assists += assists;
        if(rating!==null){ monthMap[key].ratingSum += rating; monthMap[key].ratingCount++; }
        if(rating===10) monthMap[key].ratingTenCount++;
      }
    });
  });

  const monthEntries = Object.values(monthMap).map(m=>{
    const avg = m.ratingCount ? m.ratingSum/m.ratingCount : 0;
    const participacao = m.goals + m.assists;
    const score = avg*4 + m.goals*5 + m.assists*4.5;
    return { playerId:m.playerId, monthKey:m.monthKey, startDate:m.startDate, endDate:m.endDate, goals:m.goals, assists:m.assists, participacao, score, avg, ratingTenCount:m.ratingTenCount };
  });
  const closedMonthEntries = monthEntries;

  const ratingTenList = Object.entries(ratingTenCounts).map(([playerId,count])=>({playerId, count, round:ratingTenLastRound[playerId]}));

  const careerTotals = officialOnly
    ? roundEntries.reduce((acc,item)=>{
        if(!acc[item.playerId]) acc[item.playerId]={goals:0,assists:0};
        acc[item.playerId].goals += item.goals;
        acc[item.playerId].assists += item.assists;
        return acc;
      },{})
    : computeAllTotals();
  const careerList = Object.entries(careerTotals).map(([playerId,t])=>{
    const lastRound = roundEntries.filter(item=>item.playerId===playerId).sort((a,b)=>(b.round.date||'').localeCompare(a.round.date||''))[0]?.round;
    return {playerId, goals:t.goals, assists:t.assists, participacao:t.goals+t.assists, round:lastRound};
  });

  return {
    monthGoals: pickRecordHolders(closedMonthEntries, 'goals'),
    monthAssists: pickRecordHolders(closedMonthEntries, 'assists'),
    monthParticipacao: pickRecordHolders(closedMonthEntries, 'participacao'),
    monthScore: pickRecordHolders(closedMonthEntries, 'score'),
    monthRatingTen: pickRecordHolders(closedMonthEntries, 'ratingTenCount'),
    monthAvgRating: pickRecordHolders(closedMonthEntries, 'avg'),
    roundGoals: pickRecordHolders(roundEntries, 'goals'),
    roundAssists: pickRecordHolders(roundEntries, 'assists'),
    roundParticipacao: pickRecordHolders(roundEntries, 'participacao'),
    roundScore: pickRecordHolders(roundEntries, 'score'),
    ratingTen: pickRecordHolders(ratingTenList, 'count'),
    allTimeGoals: pickRecordHolders(careerList, 'goals'),
    allTimeAssists: pickRecordHolders(careerList, 'assists'),
    allTimeParticipacao: pickRecordHolders(careerList, 'participacao'),
  };
}

function buildRecordCard(label, list, unit, decimals, isPrismatic, isGoat){
  if(!list.length){
    return `<div class="record-card record-card-geral record-empty"><div class="record-label">${label}</div>Sem dados ainda</div>`;
  }
  const val = decimals!=null ? list[0].value.toFixed(decimals) : list[0].value;
  const holders = list.map(item=>{
    const p = players.find(pl=>pl.id===item.playerId);
    const pname = p ? p.nickname : 'Jogador removido';
    const pphoto = (p && p.photo) ? circlePhotoMarkup(p,'record-circle-photo',22) : `<div class="ph-fb">${p?initials(p.name):'?'}</div>`;
    const ctx = item.round ? `${item.round.label} · ${fmtDate(item.round.date)}` : (item.monthKey ? monthLabel(item.monthKey) : 'Total histórico');
    return `<div class="record-holder">
      <div class="record-player">${pphoto}${pname}</div>
      <div class="record-context">${ctx}</div>
    </div>`;
  }).join('');
  const tieHtml = list.length>1 ? `<div class="record-tie-note">${list.length} jogadores empatados</div>` : '';
  if(isGoat){
    return `<div class="record-card record-card-goat">
      <div class="goat-badge">🐐 Recorde do racha — conquistado sendo GOAT</div>
      <div class="record-label">${label}</div>
      <div class="record-value">${val}<small>${unit}</small></div>
      ${tieHtml}
      <div class="record-holders">${holders}</div>
    </div>`;
  }
  return `<div class="record-card record-card-geral${isPrismatic ? ' record-card-prismatic' : ''}">
    ${isPrismatic ? '<div class="prismatic-badge">💎 Recorde raro</div>' : ''}
    <div class="record-label">${label}</div>
    <div class="record-value">${val}<small>${unit}</small></div>
    ${tieHtml}
    <div class="record-holders">${holders}</div>
  </div>`;
}
