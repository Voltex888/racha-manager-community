let roundSortMode = 'alpha';
let roundSortDir = 'asc';
let editingRoundId = null;
let editingAttendancePlan = null;
let editingOriginalAttendancePlan = null;
let editingPlannerBefore = null;
let pendingPrefillEntries = null;
function renderRoundSortBar(){
  renderSortBar($('roundSortBar'), {
    label: 'Ordenar lançamento:',
    criteria: [
      {key:'alpha', label:'Alfabética'},
      ...PLAYER_ATTRIBUTE_SORTS,
      {key:'goals', label:'Gols'},
      {key:'assists', label:'Assistências'},
      {key:'ga', label:'G/A'},
      {key:'score', label:'Pontuação'},
      {key:'rating', label:'Nota média'},
      {key:'absences', label:'Faltas'},
    ],
    mode: roundSortMode,
    dir: roundSortDir,
    onModeChange: (mode)=>{
      roundSortMode = mode;
      roundSortDir = mode==='alpha' ? 'asc' : 'desc';
      renderRoundForm();
    },
    onDirChange: ()=>{
      roundSortDir = roundSortDir==='asc' ? 'desc' : 'asc';
      renderRoundForm();
    }
  });
}
function captureCurrentRoundEntries(){
  const map = {};
  document.querySelectorAll('#roundEntriesWrap .entry-row').forEach(row=>{
    map[row.dataset.id] = {
      goals: row.querySelector('.in-goals').value,
      assists: row.querySelector('.in-assists').value,
      rating: row.querySelector('.in-rating').value,
    };
  });
  return map;
}
function getLaunchPresenceIds(date){
  const publishedPlan=(publishedTeamPlans||[]).find(item=>item.date===date)?.teamPlan;
  const plan=editingRoundId ? teamPlanner : (publishedPlan || teamPlanner);
  const ids=(plan?.slots||[]).flatMap(slot=>{
    const attendance=Array.isArray(slot.attendance) ? slot.attendance : [];
    return attendance.length ? attendance : (slot.teams||[]).flat();
  });
  return new Set(ids.filter(id=>players.some(player=>player.id===id)));
}
function getPlanAbsences(plan){
  const absences={};
  (plan?.slots||[]).forEach(slot=>{
    const scheduled=new Set([...(slot.teams||[]).flat(),...(slot.justifiedAbsences||[])]);
    const present=new Set(slot.attendance||[]);
    const justified=new Set(slot.justifiedAbsences||[]);
    scheduled.forEach(id=>{ if(!present.has(id)) absences[id]={justified:justified.has(id)}; });
  });
  return absences;
}
function getRoundAbsences(round){
  if(round?.teamPlan?.slots?.length) return getPlanAbsences(round.teamPlan);
  return round?.absences||{};
}
function isChildPlayer(playerOrId){
  const p=typeof playerOrId==='string' ? players.find(item=>item.id===playerOrId) : playerOrId;
  if(!p) return false;
  const role=String(p.role||p.tipo||p.type||'').trim().toLowerCase();
  return role==='child' || role==='crianca' || role==='criança' || role==='kid' || p.isChild===true || p.child===true;
}
function isGoalkeeperPlayer(playerOrId){const player=typeof playerOrId==='string'?players.find(item=>item.id===playerOrId):playerOrId;return player?.role==='goalkeeper'}
function isHybridPlayer(playerOrId){const player=typeof playerOrId==='string'?players.find(item=>item.id===playerOrId):playerOrId;return player?.role==='hybrid'}
function currentMvpCaptainIds(){const totals=computeAllTotals(periodStart||undefined),score=stat=>{const average=stat.ratingCount?stat.ratingSum/stat.ratingCount:0;return average*4+stat.goals*5+stat.assists*4.5-(stat.absencePenalty||0)};return players.filter(player=>!isGoalkeeperPlayer(player)&&(totals[player.id]?.games||0)>0).sort((a,b)=>{const statA=totals[a.id],statB=totals[b.id],scoreDifference=score(statB)-score(statA),gaDifference=(statB.goals+statB.assists)-(statA.goals+statA.assists),averageA=statA.ratingCount?statA.ratingSum/statA.ratingCount:0,averageB=statB.ratingCount?statB.ratingSum/statB.ratingCount:0;return scoreDifference||gaDifference||(averageB-averageA)||((statA.games||0)-(statB.games||0))||a.nickname.localeCompare(b.nickname,'pt-BR')}).slice(0,4).map(player=>player.id)}
function isCaptainCandidate(playerOrId,mvpIds=null){const player=typeof playerOrId==='string'?players.find(item=>item.id===playerOrId):playerOrId;if(!player)return false;const automaticIds=mvpIds||new Set(currentMvpCaptainIds());return !!player.isCaptain||automaticIds.has(player.id)}
function drawGoalkeeperSides(slot,attendanceOverride=null){
  const randomize=list=>{const result=[...list];for(let index=result.length-1;index>0;index--){const randomIndex=Math.floor(Math.random()*(index+1));[result[index],result[randomIndex]]=[result[randomIndex],result[index]]}return result};
  const attendance=[...new Set(attendanceOverride||slot.attendance||[])],fixed=randomize([...new Set((slot.goalkeepers||[]).filter(id=>isGoalkeeperPlayer(id)))]),hybrids=randomize(attendance.filter(id=>isHybridPlayer(id)));
  if(fixed.length===0)slot.goalkeeperSides={a:hybrids.filter((_,index)=>index%2===0),b:hybrids.filter((_,index)=>index%2===1)};
  else if(fixed.length===1){const fixedSide=Math.random()<.5?'a':'b',hybridSide=fixedSide==='a'?'b':'a';slot.goalkeeperSides={a:[],b:[]};slot.goalkeeperSides[fixedSide]=fixed;slot.goalkeeperSides[hybridSide]=hybrids}
  else slot.goalkeeperSides={a:fixed.filter((_,index)=>index%2===0),b:fixed.filter((_,index)=>index%2===1)};
  return fixed.length+hybrids.length>0;
}
function teamChildCount(team){ return (team||[]).filter(id=>isChildPlayer(id)).length; }
function repairChildDistribution(slot,desiredSizes){
  const totalChildren=(slot.teams||[]).flat().filter(id=>isChildPlayer(id)).length;
  if(totalChildren>(slot.teams||[]).length) return false;
  for(let sourceIndex=0;sourceIndex<slot.teams.length;sourceIndex++){
    while(teamChildCount(slot.teams[sourceIndex])>1){
      const extraIndex=slot.teams[sourceIndex].findIndex((id,idx)=>isChildPlayer(id) && idx>slot.teams[sourceIndex].findIndex(x=>isChildPlayer(x)));
      if(extraIndex<0) break;
      const childId=slot.teams[sourceIndex][extraIndex];
      const targets=slot.teams.map((team,index)=>({team,index,limit:desiredSizes[index]})).filter(item=>item.index!==sourceIndex && teamChildCount(item.team)===0);
      if(!targets.length) return false;
      targets.sort((a,b)=>a.team.length-b.team.length);
      let target=targets.find(item=>item.team.length<item.limit) || targets[0];
      if(target.team.length<target.limit){
        slot.teams[sourceIndex].splice(extraIndex,1);
        target.team.push(childId);
      }else{
        const normalIndex=target.team.findIndex(id=>!isChildPlayer(id));
        if(normalIndex<0) return false;
        const normalId=target.team[normalIndex];
        target.team[normalIndex]=childId;
        slot.teams[sourceIndex][extraIndex]=normalId;
      }
    }
  }
  return slot.teams.every(team=>teamChildCount(team)<=1);
}
function drawTeamsForSlot(slot, attendanceOverride=null){
  const available = [...new Set(attendanceOverride || slot.attendance || [])].filter(id=>players.some(p=>p.id===id));
  const count = Math.max(2,Number(teamPlanner.teamCount)||4);
  const capacity = Math.max(1,Number(teamPlanner.playersPerTeam)||1);
  const target = count*capacity;

  if(available.length > target){
    showToast(`${slot.label}: há ${available.length-target} pessoa(s) a mais que a capacidade dos ${count} times.`);
    return false;
  }
  if(available.length < count){
    showToast(`${slot.label}: são necessárias pelo menos ${count} pessoas para abrir ${count} times.`);
    return false;
  }

  const shuffle = list=>{
    const copy=[...list];
    for(let i=copy.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]]; }
    return copy;
  };

  const chosenCaptains=[...new Set(slot.captains||[])].filter(id=>available.includes(id));
  const automaticMvpCaptains=new Set(currentMvpCaptainIds());
  const markedCaptains=shuffle(available.filter(id=>!chosenCaptains.includes(id) && isCaptainCandidate(id,automaticMvpCaptains)));
  const fallbackCaptains=shuffle(available.filter(id=>!chosenCaptains.includes(id) && !markedCaptains.includes(id)));
  const captains=[...chosenCaptains,...markedCaptains,...fallbackCaptains].slice(0,count);
  slot.captains=[...captains];

  const missing=Math.max(0,target-available.length);
  const desiredSizes=Array(count).fill(capacity);
  let remainingMissing=missing;
  for(let i=count-1;i>=0 && remainingMissing>0;i--){
    const removable=Math.max(0,desiredSizes[i]-1);
    const cut=Math.min(removable,remainingMissing);
    desiredSizes[i]-=cut;
    remainingMissing-=cut;
  }

  slot.teams=captains.map(id=>[id]);

  const childIds=available.filter(id=>isChildPlayer(id));
  if(childIds.length>count){
    showToast(`${slot.label}: há ${childIds.length} crianças para ${count} times. Para manter no máximo 1 criança por time, aumente a quantidade de times ou ajuste os presentes.`);
    return false;
  }

  const balanceByStars=teamPlanner.balanceMode==='stars';
  const balanceByManualOvr=teamPlanner.balanceMode==='manualOvr';
  const playerStrength=id=>{const current=players.find(player=>player.id===id);return balanceByStars?(Number(current?.teamStars)||3)*20:(balanceByManualOvr?(Number(current?.teamManualOvr)||playerOverall(current)):playerOverall(current))};
  const balanceRange=balanceByStars?10:12;
  const strength=team=>team.reduce((sum,member)=>sum+playerStrength(member),0);
  const pendingChildren=shuffle(childIds.filter(id=>!captains.includes(id))).sort((a,b)=>{
    return playerStrength(b)-playerStrength(a);
  });

  for(const id of pendingChildren){
    const candidates=slot.teams.map((team,index)=>({team,index,limit:desiredSizes[index]})).filter(item=>
      item.team.length<item.limit && !item.team.some(member=>isChildPlayer(member))
    );
    if(!candidates.length){
      showToast(`${slot.label}: não foi possível separar as crianças sem repetir uma no mesmo time.`);
      return false;
    }
    candidates.sort((a,b)=>strength(a.team)-strength(b.team) || a.team.length-b.team.length);
    const lowest=strength(candidates[0].team);
    const balancedChoices=candidates.filter(item=>strength(item.team)<=lowest+balanceRange);
    const choice=balancedChoices[Math.floor(Math.random()*balancedChoices.length)] || candidates[0];
    choice.team.push(id);
  }

  const pending=available.filter(id=>!captains.includes(id) && !childIds.includes(id)).map(id=>({id,roll:Math.random()})).sort((a,b)=>{
    const diff=playerStrength(b.id)-playerStrength(a.id);
    return diff || a.roll-b.roll;
  }).map(item=>item.id);

  pending.forEach(id=>{
    const openTeams=slot.teams.map((team,index)=>({team,index,limit:desiredSizes[index]})).filter(item=>item.team.length<item.limit);
    if(!openTeams.length) return;
    openTeams.sort((a,b)=>strength(a.team)-strength(b.team) || a.team.length-b.team.length);
    const lowest=strength(openTeams[0].team);
    const balancedChoices=openTeams.filter(item=>strength(item.team)<=lowest+balanceRange);
    const choice=balancedChoices[Math.floor(Math.random()*balancedChoices.length)] || openTeams[0];
    if(choice) choice.team.push(id);
  });

  if(!repairChildDistribution(slot,desiredSizes)){
    showToast(`${slot.label}: não foi possível manter no máximo 1 criança por time.`);
    return false;
  }

  slot.substitutePools=[];
  const shuffledTeamCandidates=(team,teamIndex)=>{
    const nonCaptains=team.filter(id=>!captains.includes(id));
    const captainIds=team.filter(id=>captains.includes(id));
    return shuffle(nonCaptains).concat(shuffle(captainIds)).map(id=>({id,homeTeamIndex:teamIndex}));
  };

  slot.teams.forEach((team,targetTeamIndex)=>{
    const shortage=Math.max(0,capacity-team.length);
    if(!shortage) return;
    const targetHasChild=teamChildCount(team)>0;
    const pool=[];

    slot.teams.forEach((candidate,sourceTeamIndex)=>{
      if(sourceTeamIndex===targetTeamIndex) return;

      let candidates=shuffledTeamCandidates(candidate,sourceTeamIndex);

      if(!targetHasChild){
        const child=candidates.find(item=>isChildPlayer(item.id));
        if(child){
          candidates=[child,...candidates.filter(item=>item.id!==child.id)];
        }
      }else{
        candidates=candidates.filter(item=>!isChildPlayer(item.id));
      }

      candidates.slice(0,shortage).forEach(item=>{
        if(!pool.some(x=>x.id===item.id)) pool.push(item);
      });
    });

    slot.substitutePools[targetTeamIndex]=pool;
  });

  slot.reserves=[...new Set((slot.substitutePools||[]).flat().map(item=>item?.id).filter(Boolean))];
  drawGoalkeeperSides(slot,available);
  return true;
}
function drawCaptainsForSlot(slot,attendanceOverride=null){
  const count=Math.max(2,Number(teamPlanner.teamCount)||2);
  const attendance=[...new Set(attendanceOverride||slot.attendance||[])].filter(id=>players.some(player=>player.id===id));
  const automaticMvpCaptains=new Set(currentMvpCaptainIds());
  const eligible=attendance.filter(id=>isCaptainCandidate(id,automaticMvpCaptains));
  if(eligible.length<count){showToast(`${slot.label}: existem apenas ${eligible.length} capitão(ões) confirmado(s) para ${count} times.`);return false}
  for(let index=eligible.length-1;index>0;index--){const randomIndex=Math.floor(Math.random()*(index+1));[eligible[index],eligible[randomIndex]]=[eligible[randomIndex],eligible[index]]}
  slot.captains=eligible.slice(0,count);
  slot.teams=[];slot.reserves=[];slot.substitutePools=[];
  return true;
}
function substitutePoolForTeam(slot,teamIndex){
  return Array.isArray(slot?.substitutePools?.[teamIndex]) ? slot.substitutePools[teamIndex].filter(item=>item&&item.id) : [];
}
function activeTeamForMatch(slot,teamIndex,opponentIndex,capacityOverride=null){
  const capacity=Math.max(1,Number(capacityOverride||teamPlanner.playersPerTeam)||1);
  const base=[...(slot?.teams?.[teamIndex]||[])];
  const need=Math.max(0,capacity-base.length);
  if(!need) return {players:base,substitutes:[]};
  const eligible=substitutePoolForTeam(slot,teamIndex).filter(item=>item.homeTeamIndex!==opponentIndex && !base.includes(item.id));
  const used=[];
  let hasChild=teamChildCount(base)>0;
  if(!hasChild){
    const child=eligible.find(item=>isChildPlayer(item.id));
    if(child){used.push(child);hasChild=true;}
  }
  for(const item of eligible){
    if(used.length>=need) break;
    if(used.some(current=>current.id===item.id)) continue;
    if(isChildPlayer(item.id) && hasChild) continue;
    used.push(item);
    if(isChildPlayer(item.id)) hasChild=true;
  }
  return {players:[...base,...used.map(item=>item.id)],substitutes:used};
}
function roundAttendanceLimit(plan=teamPlanner){return Math.min(16,Math.max(1,(Number(plan?.teamCount)||4)*(Number(plan?.playersPerTeam)||4)))}
function teamOverallStrength(team){
  const values=(team||[]).map(id=>players.find(player=>player.id===id)).filter(Boolean).map(player=>playerOverall(player));
  return values.length?formatOverall(values.reduce((sum,value)=>sum+value,0)/values.length):'—';
}
function goalkeeperSidesMarkup(slot,playerName,playerAvatar){const sides=slot?.goalkeeperSides||{a:[],b:[]};const sideHtml=(ids,label)=>(ids||[]).map(id=>{const teamIndex=(slot.teams||[]).findIndex(team=>team.includes(id));return `<div class="goalkeeper-side-player">${playerAvatar(id)}<span>${playerName(id)}${isHybridPlayer(id)?` <small>· híbrido, disponível quando o Time ${teamIndex+1} estiver fora</small>`:' <small>· goleiro</small>'}</span></div>`}).join('')||'<span class="small muted">Sem goleiro definido</span>';if(!(sides.a||[]).length&&!(sides.b||[]).length)return '';return `<div class="goalkeeper-sides"><div class="goalkeeper-sides-title">🥅 Lados dos goleiros</div><div class="goalkeeper-sides-grid"><div><b>Lado A</b>${sideHtml(sides.a,'A')}</div><div><b>Lado B</b>${sideHtml(sides.b,'B')}</div></div></div>`}
function simulatorNameKey(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase()}
function resolveSimulatorPlayer(source){
  const sourceId=String(source?.id||'');
  return players.find(player=>String(player.id)===sourceId)||players.find(player=>simulatorNameKey(player.nickname||player.name)===simulatorNameKey(source?.name||source?.nickname));
}
async function importSimulatorRoundPayload(payload){
  if(!isAdmin){showToast('Somente o organizador pode importar uma rodada.');return}
  if(payload?.schema!=='racha-manager-simulator/v1'||!payload.round)throw new Error('Este arquivo não é uma rodada exportada pelo simulador.');
  const sourceRound=payload.round,simulatorRoundId=String(sourceRound.id||'');
  if(!simulatorRoundId)throw new Error('A rodada não possui um ID válido.');
  const existingSimulatorRound=rounds.find(round=>String(round.simulatorRoundId||'')===simulatorRoundId);
  if(sourceRound.status!=='ended')throw new Error('Encerre a rodada no simulador antes de importar.');
  const sourcePlayers=new Map();
  (sourceRound.teams||[]).forEach(team=>(team.players||[]).forEach(player=>sourcePlayers.set(String(player.id),player)));
  (payload.summary?.players||[]).forEach(player=>{if(!sourcePlayers.has(String(player.id)))sourcePlayers.set(String(player.id),player)});
  (payload.summary?.goalkeepers||[]).forEach(player=>{if(!sourcePlayers.has(String(player.id)))sourcePlayers.set(String(player.id),player)});
  const mapped=new Map(),unknown=[];
  sourcePlayers.forEach((source,id)=>{const official=resolveSimulatorPlayer(source);if(official)mapped.set(id,official.id);else unknown.push(source.name||source.nickname||id)});
  const schedules=sourceRound.schedules?.length?sourceRound.schedules:[{id:'simulator-slot',label:'Horário da rodada',teams:sourceRound.teams||[]}];
  const simulatorTeamSummary=Array.isArray(payload.summary?.teams)?payload.summary.teams:[];
  const simulatorTeams=schedules.flatMap(schedule=>(schedule.teams||[]).map(sourceTeam=>{
    const teamId=String(sourceTeam.id||''),fallback=simulatorTeamSummary.find(stat=>String(stat.id||'')===teamId)||simulatorTeamSummary.find(stat=>simulatorNameKey(stat.name)===simulatorNameKey(sourceTeam.name))||{};
    const stat={id:teamId,name:sourceTeam.name||fallback.name||'Time',goals:0,assists:0,ownGoals:0,gf:0,ga:0,w:0,d:0,l:0,playerStats:{}};
    (sourceRound.matches||[]).forEach(match=>{
      const isA=String(match.teamA||'')===teamId,isB=String(match.teamB||'')===teamId;
      if(!isA&&!isB)return;
      const own=isA?(Number(match.scoreA)||0):(Number(match.scoreB)||0),opponent=isA?(Number(match.scoreB)||0):(Number(match.scoreA)||0);
      stat.ga+=opponent;own>opponent?stat.w++:own<opponent?stat.l++:stat.d++;
      (match.events||[]).filter(event=>!event.cancelled).forEach(event=>{
        const scoringForTeam=String(event.scoringTeamId||'')===teamId;
        if(!event.ownGoal&&scoringForTeam){
          const playerId=mapped.get(String(event.authorId));stat.goals++;
          if(playerId){stat.playerStats[playerId]??={goals:0,assists:0};stat.playerStats[playerId].goals++}
        }
        if(event.assistId&&scoringForTeam){
          const playerId=mapped.get(String(event.assistId));stat.assists++;
          if(playerId){stat.playerStats[playerId]??={goals:0,assists:0};stat.playerStats[playerId].assists++}
        }
        if(event.ownGoal&&String(event.playerTeamId||'')===teamId)stat.ownGoals++;
      });
    });
    stat.gf=stat.goals;
    return stat;
  }));
  const slots=schedules.map((schedule,index)=>{
    const sourceTeams=schedule.teams||[];
    const teams=sourceTeams.map(team=>[...new Set((team.players||[]).map(player=>mapped.get(String(player.id))).filter(Boolean))]).filter(team=>team.length);
    const listedPlayers=[...new Set(sourceTeams.flatMap(team=>(team.players||[]).map(player=>mapped.get(String(player.id))).filter(Boolean)))];
    const attendance=[...new Set(sourceTeams.flatMap(team=>(team.players||[]).filter(player=>!player.absent).map(player=>mapped.get(String(player.id))).filter(Boolean)))].slice(0,16);
    const goalkeeperSides={a:(schedule.goalkeeperSides?.a||[]).map(id=>mapped.get(String(id))).filter(Boolean),b:(schedule.goalkeeperSides?.b||[]).map(id=>mapped.get(String(id))).filter(Boolean)};
    const goalkeepers=(schedule.goalkeepers||[]).map(goalkeeper=>mapped.get(String(goalkeeper.id||goalkeeper))).filter(Boolean);
    return {id:String(schedule.id||`simulator-slot-${index+1}`),label:schedule.label||`Horário ${index+1}`,attendance,captains:[],teams,reserves:[],substitutePools:[],listedPlayers,justifiedAbsences:[],goalkeepers,goalkeeperSides};
  }).filter(slot=>slot.teams.length);
  if(!slots.length)throw new Error('Nenhum time compatível foi encontrado. Confira se os jogadores existem no elenco oficial.');
  const entries={};
  const simulatorPlayers={};
  (payload.summary?.players||[]).forEach(stat=>{
    const officialId=mapped.get(String(stat.id));if(!officialId)return;
    entries[officialId]={goals:String(Number(stat.goals)||0),assists:String(Number(stat.assists)||0),rating:Number(stat.average||0).toFixed(2)};
    simulatorPlayers[officialId]={
      games:Number(stat.games)||0,goals:Number(stat.goals)||0,assists:Number(stat.assists)||0,
      ownGoals:Number(stat.ownGoals)||0,wins:Number(stat.wins)||0,draws:Number(stat.draws)||0,
      losses:Number(stat.losses)||Math.max(0,(Number(stat.games)||0)-(Number(stat.wins)||0)-(Number(stat.draws)||0)),
      average:Number(stat.average)||0
    };
  });
  const simulatorGoalkeepers={};
  (payload.summary?.goalkeepers||[]).forEach(stat=>{
    const officialId=mapped.get(String(stat.id));if(!officialId)return;
    simulatorGoalkeepers[officialId]={games:Number(stat.games)||0,wins:Number(stat.wins)||0,draws:Number(stat.draws)||0,losses:Number(stat.losses)||0,goalsConceded:Number(stat.goalsConceded)||0,cleanSheets:Number(stat.cleanSheets)||0,saves:Number(stat.saves)||0,goals:Number(stat.goals)||0,assists:Number(stat.assists)||0,points:Number(stat.points)||0,average:Number(stat.average)||0,goalsConcededPerGame:Number(stat.goalsConcededPerGame)||0,side:String(stat.side||'')};
  });
  const simulatorGoalkeeperMatches=(sourceRound.matches||[]).flatMap(match=>[['a',match.goalkeeperAId,match.teamA,match.scoreA,match.scoreB],['b',match.goalkeeperBId,match.teamB,match.scoreB,match.scoreA]].map(([side,goalkeeperId,teamId,goalsFor,goalsAgainst])=>{const playerId=mapped.get(String(goalkeeperId));if(!playerId)return null;const saves=(match.defenses||[]).filter(defense=>!defense.cancelled&&String(defense.goalkeeperId)===String(goalkeeperId)).length;return {matchId:String(match.id||''),matchNumber:Number(match.number)||0,playerId,saves,side,teamId:String(teamId||''),goalsFor:Number(goalsFor)||0,goalsAgainst:Number(goalsAgainst)||0}}).filter(Boolean));
  const dateCandidate=String(sourceRound.sourceDate||'').slice(0,10),date=/^\d{4}-\d{2}-\d{2}$/.test(dateCandidate)?dateCandidate:new Date().toISOString().slice(0,10);
  if(existingSimulatorRound){existingSimulatorRound.simulatorStats??={};existingSimulatorRound.simulatorStats.goalkeepers=simulatorGoalkeepers;existingSimulatorRound.simulatorStats.goalkeeperMatches=simulatorGoalkeeperMatches;existingSimulatorRound.teamPlan=normalizeTeamPlanner({...existingSimulatorRound.teamPlan,slots});existingSimulatorRound.simulatorImportedAt=new Date().toISOString();const updated=await saveRounds();if(!updated)throw new Error('Não foi possível atualizar os dados de goleiro desta rodada.');renderAll();showToast('Rodada já existente atualizada com os dados separados dos goleiros.');return}
  const plan=normalizeTeamPlanner({teamCount:Math.max(...slots.map(slot=>slot.teams.length)),playersPerTeam:Math.max(1,...slots.flatMap(slot=>slot.teams.map(team=>team.length))),slots});
  rounds.push({id:uid(),label:sourceRound.sourceName||`Rodada do simulador · ${fmtDate(date)}`,date,entries,teamPlan:plan,absences:getPlanAbsences(plan),simulatorRoundId,simulatorImportedAt:new Date().toISOString(),simulatorStats:{players:simulatorPlayers,teams:simulatorTeams,matches:Number(sourceRound.matches?.length)||0}});
  rounds.at(-1).simulatorStats.goalkeepers=simulatorGoalkeepers;
  rounds.at(-1).simulatorStats.goalkeeperMatches=simulatorGoalkeeperMatches;
  const saved=await saveRounds();
  if(!saved)throw new Error('Não foi possível salvar a rodada no site oficial.');
  renderAll();showToast(`Rodada do simulador importada.${unknown.length?` ${unknown.length} jogador(es) não encontrado(s) foram ignorados.`:''}`);
}
function chooseSimulatorRoundFile(){
  if(!isAdmin){showToast('Somente administradores podem importar rodadas em JSON.');return}
  const input=document.createElement('input');input.type='file';input.accept='application/json,.json';
  input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;try{await importSimulatorRoundPayload(JSON.parse(await file.text()))}catch(error){showToast(error.message||'Não foi possível importar a rodada.')}});input.click();
}
function renderTeamPlanner(){
  const wrap = $('teamPlannerWrap');
  if(!wrap) return;
  if(!teamPlanner || typeof teamPlanner!=='object') teamPlanner = normalizeTeamPlanner(null);
  if(!teamPlanner.slots.length) ensureTeamSlots(2);
  const playerName = id=> players.find(p=>p.id===id)?.nickname || 'Jogador removido';
  const patentContext=createRankingPatentContext();
  const playerAvatar = id=> `<span class="${rankingPatentClass(id,patentContext)}">${playerCircleMarkup(players.find(p=>p.id===id),'team-player-photo',24)}</span>`;
  const discipline = computeDisciplineStatus();
  const automaticMvpCaptains=new Set(currentMvpCaptainIds());
  const slotHtml = teamPlanner.slots.map((slot,index)=>{
    const capacity=Math.max(1,Number(teamPlanner.playersPerTeam)||1);
    const suspendedIds=new Set(editingRoundId ? [] : players.filter(player=>discipline[player.id]?.suspendedRounds>0).map(player=>player.id));
    slot.attendance=(slot.attendance||[]).filter(id=>!suspendedIds.has(id)&&!isGoalkeeperPlayer(id)).slice(0,roundAttendanceLimit());
    slot.captains=(slot.captains||[]).filter(id=>!suspendedIds.has(id));
    const attendance = new Set(slot.attendance||[]);
    const editAttendanceSlot = editingAttendancePlan?.slots?.find(source=>source.id===slot.id);
    const originalEditSlot = editingOriginalAttendancePlan?.slots?.find(source=>source.id===slot.id);
    const originalAttendance = new Set(originalEditSlot?.attendance||[]);
    const captainAttendance = editingRoundId ? new Set(editAttendanceSlot?.attendance||[]) : attendance;
    slot.captains=(slot.captains||[]).filter(id=>captainAttendance.has(id) && isCaptainCandidate(id,automaticMvpCaptains));
    slot.goalkeepers=(slot.goalkeepers||[]).filter(id=>isGoalkeeperPlayer(id));
    const captains = new Set(slot.captains);
    const linePlayers=players.filter(player=>!isGoalkeeperPlayer(player));
    const goalkeeperPlayers=players.filter(player=>isGoalkeeperPlayer(player));
    const attendeesHtml = linePlayers.length ? linePlayers.map(p=>{
      const suspended=!editingRoundId && discipline[p.id]?.suspendedRounds>0;
      const present=attendance.has(p.id);
      const lockedOriginal=!!editingRoundId && originalAttendance.has(p.id);
      const labelClass=[suspended?'is-suspended':'',lockedOriginal?'is-locked-attendance':''].filter(Boolean).join(' ');
      return `<label class="${labelClass}"><input type="checkbox" data-attendance="${slot.id}" value="${p.id}" ${present?'checked':''} ${(suspended||lockedOriginal)?'disabled':''}> ${suspended?'⛔ ':''}${p.nickname}${suspended?' · suspenso nesta rodada':''}${lockedOriginal?'<small>presença original</small>':''}</label>`;
    }).join('') : '<span style="color:var(--chalk-dim);font-size:12px;">Cadastre jogadores no Elenco para montar times.</span>';
    const captainsHtml = captainAttendance.size ? (()=>{ const eligible=players.filter(p=>captainAttendance.has(p.id) && isCaptainCandidate(p,automaticMvpCaptains)).sort((a,b)=>{const rankA=[...automaticMvpCaptains].indexOf(a.id),rankB=[...automaticMvpCaptains].indexOf(b.id);if(rankA>=0||rankB>=0)return (rankA<0?99:rankA)-(rankB<0?99:rankB);return a.nickname.localeCompare(b.nickname,'pt-BR')}); return eligible.length ? eligible.map(p=>`<label><input type="checkbox" data-captain="${slot.id}" value="${p.id}" ${captains.has(p.id)?'checked':''}> ${p.isCaptain?'👑 ':''}${automaticMvpCaptains.has(p.id)?'⭐ ':''}${p.nickname}${automaticMvpCaptains.has(p.id)?' · Top 4 MVP':''}</label>`).join('') : '<span style="color:var(--chalk-dim);font-size:12px;">Nenhum capitão manual ou integrante do Top 4 MVP está confirmado neste horário.</span>'; })() : '<span style="color:var(--chalk-dim);font-size:12px;">Marque os confirmados para escolher os capitães.</span>';
    const selectedGoalkeepers=new Set(slot.goalkeepers||[]);
    const goalkeepersHtml=goalkeeperPlayers.length?`<div class="team-goalkeepers"><div class="team-captains-title">Goleiros disponíveis · fora do limite de 16</div><div class="team-captains-list">${goalkeeperPlayers.map(player=>`<label><input type="checkbox" data-goalkeeper-attendance="${slot.id}" value="${player.id}" ${selectedGoalkeepers.has(player.id)?'checked':''}> 🧤 ${player.nickname}</label>`).join('')}</div><div class="small muted">Jogadores híbridos permanecem na lista normal e podem assumir o gol quando o time deles estiver fora.</div></div>`:'';
    const substitutePool = (editingRoundId ? (editAttendanceSlot?.attendance||[]) : (slot.attendance||[])).filter(id=>players.some(p=>p.id===id));
    const teamsHtml = (slot.teams||[]).length ? `<div class="team-results">${slot.teams.map((team,i)=>{
      const options=substitutePool.filter(id=>!team.includes(id)).map(id=>`<option value="${id}">${playerName(id)}</option>`).join('');
      const editControls=editingRoundId ? `<div class="team-edit-controls">${team.map(id=>`<button type="button" class="btn btn-danger btn-sm" data-team-remove="${slot.id}" data-team-index="${i}" data-player-id="${id}">Remover ${playerName(id)}</button>`).join('')}<select data-team-substitute="${slot.id}" data-team-index="${i}"><option value="">Adicionar substituto…</option>${options}</select></div>` : '';
      const pool=substitutePoolForTeam(slot,i);
      const poolHtml=pool.length ? `<div class="team-substitute-pool"><b>Substitutos rotativos · quantidade exata por time</b>${pool.map(item=>`<span class="team-substitute-chip">↔ ${playerName(item.id)} · Time ${item.homeTeamIndex+1}</span>`).join('')}<div class="team-match-rotation">${slot.teams.map((_,opponentIndex)=>opponentIndex===i?'':(()=>{const active=activeTeamForMatch(slot,i,opponentIndex,capacity);const names=active.substitutes.map(item=>playerName(item.id));return `<span>vs Time ${opponentIndex+1}: ${names.length?'entram '+names.join(', '):'sem substituto disponível'}</span>`;})()).join('')}</div></div>` : '';
      return `<div class="draw-team" style="background:#0b1710!important;background-color:#0b1710!important;background-image:none!important;box-shadow:none!important;"><h4>Time ${i+1} · Força ${teamOverallStrength(team)} OVR</h4><ul>${team.map(id=>`<li class="team-player-line">${playerAvatar(id)}<span>${captains.has(id)?'👑':'⚽'} ${playerName(id)}${isChildPlayer(id)?' · Criança':''}</span></li>`).join('')}</ul>${poolHtml}${editControls}</div>`;
    }).join('')}</div>` : '';
    const target = roundAttendanceLimit();
    return `<div class="team-slot" data-slot="${slot.id}"><div class="team-slot-head"><span class="team-slot-title">Rodada/horário ${index+1}</span><input class="team-slot-label" type="text" data-slot-label="${slot.id}" value="${slot.label}" placeholder="Ex: 08:00 às 09:30"><button type="button" class="btn btn-ghost btn-sm" data-draw-slot="${slot.id}">Sortear este horário</button><button type="button" class="btn btn-ghost btn-sm" data-copy-slot="${slot.id}">Repetir nos demais</button></div><div style="font-size:12px;color:var(--chalk-dim);">Lista normal: <b>${attendance.size}/${target}</b> — os goleiros ficam fora deste limite.</div><div class="team-attendance">${attendeesHtml}</div>${goalkeepersHtml}<div class="team-captains"><div class="team-captains-title">Capitães (${captains.size}/${teamPlanner.teamCount}) — sorteie ou altere manualmente</div><button type="button" class="btn btn-ghost btn-sm" data-draw-captains="${slot.id}" style="margin-bottom:8px;">Sortear capitães</button><div class="team-captains-list">${captainsHtml}</div></div>${teamsHtml}${(slot.teams||[]).length?`<button type="button" class="btn btn-ghost btn-sm" data-draw-goalkeeper-sides="${slot.id}" style="margin-top:10px;">Sortear lados dos goleiros</button>`:''}${goalkeeperSidesMarkup(slot,playerName,playerAvatar)}</div>`;
  }).join('');
  wrap.innerHTML = `<div class="team-planner"><div class="team-planner-head"><div><div class="team-planner-title">⚽ Times da rodada</div><div style="font-size:12px;color:var(--chalk-dim);">Cada horário forma times próprios. Cada jogador mantém um time-base fixo. Se faltar alguém, os times completos fornecem substitutos rotativos sem trocar o time original do jogador.</div></div><div style="display:flex;gap:8px;flex-wrap:wrap;"><button type="button" class="btn btn-ghost btn-sm" id="btnDrawAllCaptains">Sortear capitães</button><button type="button" class="btn btn-primary btn-sm" id="btnDrawAllTeams">Sortear todos</button></div></div><div class="team-planner-settings"><div class="field"><label>Quantidade de times</label><input type="number" id="teamCountInput" min="2" max="12" value="${teamPlanner.teamCount}"></div><div class="field"><label>Pessoas por time</label><input type="number" id="teamPlayersPerTeamInput" min="1" max="20" value="${teamPlanner.playersPerTeam}"></div><div class="field"><label>Horários / rodadas</label><input type="number" id="teamSlotsCountInput" min="1" max="10" value="${teamPlanner.slots.length}"></div></div><button type="button" class="btn btn-ghost btn-sm" id="btnApplyTeamSettings">Aplicar estrutura</button><div class="team-slots">${slotHtml}</div><div class="team-planner-actions"><button type="button" class="btn btn-primary btn-sm" id="btnPublishAttendance">Publicar lista de presença</button><button type="button" class="btn btn-primary btn-sm" id="btnPublishTeamDraw">Publicar sorteios</button><button type="button" class="btn btn-primary btn-sm" id="btnSaveTeamPlanner">Publicar sorteio e presença</button>${isAdmin?'<button type="button" class="btn btn-ghost btn-sm" id="btnImportSimulatorRound">Importar rodada do simulador</button>':''}<button type="button" class="btn btn-danger btn-sm" id="btnResetTeamDraw">Resetar sorteio</button><button type="button" class="btn btn-danger btn-sm" id="btnDeleteTeamPlanner">Apagar escala</button></div></div>`;
  if(isAdmin)wrap.querySelector('.team-planner-settings')?.insertAdjacentHTML('beforeend',`<div class="field"><label>Equilibrar sorteio por</label><select id="teamBalanceMode"><option value="overall" ${teamPlanner.balanceMode==='overall'?'selected':''}>Overall automático e atributos</option><option value="stars" ${teamPlanner.balanceMode==='stars'?'selected':''}>Estrelas do administrador</option><option value="manualOvr" ${teamPlanner.balanceMode==='manualOvr'?'selected':''}>OVR manual do administrador</option></select></div>`);
  if(editingRoundId) ['btnPublishAttendance','btnPublishTeamDraw','btnSaveTeamPlanner','btnDeleteTeamPlanner'].forEach(id=>$(id).style.display='none');
  const savePlannerDraft=()=>editingRoundId?Promise.resolve(true):savePlanner();
  $('teamBalanceMode')?.addEventListener('change',()=>{const mode=$('teamBalanceMode').value;teamPlanner.balanceMode=['stars','manualOvr'].includes(mode)?mode:'overall';teamPlanner.slots.forEach(slot=>{slot.teams=[];slot.reserves=[];slot.substitutePools=[]});savePlannerDraft();renderTeamPlanner();showToast(teamPlanner.balanceMode==='stars'?'O próximo sorteio será equilibrado pelas estrelas.':teamPlanner.balanceMode==='manualOvr'?'O próximo sorteio será equilibrado pelo OVR manual.':'O próximo sorteio será equilibrado pelos atributos.');});
  $('btnImportSimulatorRound')?.addEventListener('click',chooseSimulatorRoundFile);
  $('btnApplyTeamSettings').addEventListener('click', ()=>{
    teamPlanner.teamCount = Math.max(2,Math.min(12,Number($('teamCountInput').value)||4));
    teamPlanner.playersPerTeam = Math.max(1,Math.min(20,Number($('teamPlayersPerTeamInput').value)||1));
    ensureTeamSlots(Math.max(1,Math.min(10,Number($('teamSlotsCountInput').value)||1)));
    const target=roundAttendanceLimit();
    teamPlanner.slots.forEach(slot=>{slot.attendance=(slot.attendance||[]).filter(id=>!isGoalkeeperPlayer(id)).slice(0,target);slot.goalkeepers=(slot.goalkeepers||[]).filter(id=>isGoalkeeperPlayer(id));slot.captains=(slot.captains||[]).filter(id=>slot.attendance.includes(id)).slice(0,teamPlanner.teamCount);slot.teams=[];slot.reserves=[];slot.substitutePools=[];slot.goalkeeperSides={a:[],b:[]};}); savePlannerDraft();renderTeamPlanner();
  });
  wrap.querySelectorAll('[data-attendance]').forEach(input=>input.addEventListener('change', ()=>{
    const slot = teamPlanner.slots.find(s=>s.id===input.dataset.attendance); if(!slot) return;
    const originalSlot=editingOriginalAttendancePlan?.slots?.find(s=>s.id===input.dataset.attendance);
    const wasOriginallyPresent=!!editingRoundId && new Set(originalSlot?.attendance||[]).has(input.value);
    if(wasOriginallyPresent && !input.checked){
      input.checked=true;
      showToast('Quem já estava presente nesta rodada não pode ser desmarcado.');
      return;
    }
    const set = new Set(slot.attendance||[]);
    if(input.checked && !set.has(input.value) && set.size>=roundAttendanceLimit()){ input.checked=false; showToast(`Este horário já tem o limite de ${roundAttendanceLimit()} pessoas.`); return; }
    input.checked ? set.add(input.value) : set.delete(input.value);
    slot.attendance=[...set];
    slot.listedPlayers=[...new Set([...(slot.listedPlayers||[]),input.value])];
    if(input.checked) slot.justifiedAbsences=(slot.justifiedAbsences||[]).filter(id=>id!==input.value);
    if(!input.checked) slot.captains=(slot.captains||[]).filter(id=>id!==input.value);

    if(editingRoundId && editingAttendancePlan){
      const editSlot=editingAttendancePlan.slots.find(s=>s.id===slot.id);
      if(editSlot){
        const editSet=new Set(editSlot.attendance||[]);
        input.checked ? editSet.add(input.value) : editSet.delete(input.value);
        editSlot.attendance=[...editSet];
        editSlot.listedPlayers=[...new Set([...(editSlot.listedPlayers||[]),input.value])];
        if(input.checked) editSlot.justifiedAbsences=(editSlot.justifiedAbsences||[]).filter(id=>id!==input.value);
      }
    }
    if(!editingRoundId){ slot.teams=[]; slot.reserves=[]; slot.substitutePools=[];slot.goalkeeperSides={a:[],b:[]};savePlannerDraft(); }
    renderRoundForm();
  }));
  wrap.querySelectorAll('[data-goalkeeper-attendance]').forEach(input=>input.addEventListener('change',()=>{const slot=teamPlanner.slots.find(item=>item.id===input.dataset.goalkeeperAttendance);if(!slot)return;const selected=new Set(slot.goalkeepers||[]);input.checked?selected.add(input.value):selected.delete(input.value);slot.goalkeepers=[...selected];slot.goalkeeperSides={a:[],b:[]};savePlannerDraft();renderTeamPlanner()}));
  wrap.querySelectorAll('[data-captain]').forEach(input=>input.addEventListener('change', ()=>{
    const slot=teamPlanner.slots.find(s=>s.id===input.dataset.captain); if(!slot) return;
    const captainSet=new Set(slot.captains||[]);
    const attendanceSet=new Set(slot.attendance||[]);
    if(input.checked && !captainSet.has(input.value) && captainSet.size>=teamPlanner.teamCount){ input.checked=false; showToast(`Escolha somente ${teamPlanner.teamCount} capitães neste horário.`); return; }
    if(input.checked && !attendanceSet.has(input.value)){
      if(attendanceSet.size>=roundAttendanceLimit()){ input.checked=false; showToast(`A presença deste horário já atingiu o limite de ${roundAttendanceLimit()} pessoas.`); return; }
      attendanceSet.add(input.value);
    }
    input.checked ? captainSet.add(input.value) : captainSet.delete(input.value);
    slot.attendance=[...attendanceSet]; slot.captains=[...captainSet]; slot.teams=[]; slot.reserves=[]; slot.substitutePools=[];slot.goalkeeperSides={a:[],b:[]};savePlannerDraft();renderRoundForm();
  }));
  wrap.querySelectorAll('[data-team-remove]').forEach(button=>button.addEventListener('click', ()=>{
    const slot=teamPlanner.slots.find(s=>s.id===button.dataset.teamRemove);
    const team=slot?.teams?.[Number(button.dataset.teamIndex)];
    if(!slot || !team) return;
    slot.teams[Number(button.dataset.teamIndex)]=team.filter(id=>id!==button.dataset.playerId);
    slot.captains=(slot.captains||[]).filter(id=>id!==button.dataset.playerId || slot.teams.some(current=>current.includes(id)));
    slot.reserves=[]; slot.substitutePools=[];savePlannerDraft();
    renderTeamPlanner();
  }));
  wrap.querySelectorAll('[data-team-substitute]').forEach(select=>select.addEventListener('change', ()=>{
    if(!select.value) return;
    const slot=teamPlanner.slots.find(s=>s.id===select.dataset.teamSubstitute);
    const team=slot?.teams?.[Number(select.dataset.teamIndex)];
    const capacity=Math.max(1,Number(teamPlanner.playersPerTeam)||1);
    if(!slot || !team) return;
    if(team.length>=capacity){ showToast('Remova quem faltou antes de colocar o substituto neste time.'); select.value=''; return; }
    if(isChildPlayer(select.value) && teamChildCount(team)>=1){ showToast('Este time já possui uma criança. Só é permitido 1 por time.'); select.value=''; return; }
    if(!team.includes(select.value)){
      team.push(select.value);
      slot.reserves=[]; slot.substitutePools=[];savePlannerDraft();
    }
    renderTeamPlanner();
  }));
  const activeAttendanceFor = slot => editingRoundId ? (editingAttendancePlan?.slots?.find(source=>source.id===slot.id)?.attendance||[]) : (slot.attendance||[]);
  wrap.querySelectorAll('[data-slot-label]').forEach(input=>input.addEventListener('change', ()=>{
    const slot=teamPlanner.slots.find(s=>s.id===input.dataset.slotLabel); if(slot){slot.label=input.value.trim() || slot.label;savePlannerDraft()}
  }));
  wrap.querySelectorAll('[data-draw-captains]').forEach(button=>button.addEventListener('click', async ()=>{
    const slot=teamPlanner.slots.find(item=>item.id===button.dataset.drawCaptains);
    if(!slot||!drawCaptainsForSlot(slot,activeAttendanceFor(slot)))return;
    await savePlannerDraft();renderTeamPlanner();showToast('Capitães sorteados. Você ainda pode trocar manualmente antes de sortear os times.');
  }));
  wrap.querySelectorAll('[data-draw-goalkeeper-sides]').forEach(button=>button.addEventListener('click',async()=>{const slot=teamPlanner.slots.find(item=>item.id===button.dataset.drawGoalkeeperSides);if(!slot||!drawGoalkeeperSides(slot,activeAttendanceFor(slot)))return showToast('Não há goleiros ou híbridos disponíveis neste horário.');await savePlannerDraft();renderTeamPlanner();showToast('Lados A e B dos goleiros sorteados. Os goleiros fixos têm prioridade; híbridos continuam em seus times.')}));
  wrap.querySelectorAll('[data-draw-slot]').forEach(btn=>btn.addEventListener('click', async ()=>{ const slot=teamPlanner.slots.find(s=>s.id===btn.dataset.drawSlot); if(slot && drawTeamsForSlot(slot,activeAttendanceFor(slot))){renderTeamPlanner();showToast('Times sorteados. Salvando…');const saved=editingRoundId||await savePlanner();showToast(saved?'Times sorteados e salvos. Ausências são preenchidas por substitutos dentre os confirmados.':'Times sorteados, mas não foi possível salvar.');} }));
  wrap.querySelectorAll('[data-copy-slot]').forEach(btn=>btn.addEventListener('click', ()=>{
    const source=teamPlanner.slots.find(slot=>slot.id===btn.dataset.copySlot);
    if(!source) return;
    teamPlanner.slots.filter(slot=>slot.id!==source.id).forEach(slot=>{
      slot.attendance=[...(source.attendance||[])];
      slot.goalkeepers=[...(source.goalkeepers||[])];
      slot.captains=[...(source.captains||[])];
      slot.teams=[]; slot.reserves=[]; slot.substitutePools=[];slot.goalkeeperSides={a:[],b:[]};
    });
    savePlannerDraft();renderRoundForm();
    showToast('Presença e capitães repetidos nos demais horários. Sorteie os times de cada horário quando quiser.');
  }));
  $('btnDrawAllTeams').addEventListener('click', async ()=>{ const drawn=teamPlanner.slots.map(slot=>drawTeamsForSlot(slot,activeAttendanceFor(slot)));renderTeamPlanner();if(!drawn.every(Boolean))return;showToast('Times sorteados. Salvando…');const saved=editingRoundId||await savePlanner();showToast(saved?'Times sorteados e salvos. Ausências foram completadas por substitutos dentre os confirmados.':'Times sorteados, mas não foi possível salvar.'); });
  $('btnDrawAllCaptains').addEventListener('click', async ()=>{const drawn=teamPlanner.slots.map(slot=>drawCaptainsForSlot(slot,activeAttendanceFor(slot)));if(!drawn.every(Boolean)){renderTeamPlanner();return}await savePlannerDraft();renderTeamPlanner();showToast('Capitães sorteados em todos os horários. Você ainda pode alterá-los manualmente.');});
  $('btnResetTeamDraw').addEventListener('click', ()=>{ teamPlanner.slots.forEach(slot=>{slot.teams=[];slot.reserves=[];slot.substitutePools=[];slot.goalkeeperSides={a:[],b:[]};});savePlannerDraft();renderTeamPlanner(); });
  const publishTeamPlan = async (type)=>{
    if(editingRoundId){ showToast('Na edição, altere presença e justificativas somente na lista publicada abaixo.'); return; }
    const date = $('roundDate').value;
    if(!date){ showToast('Escolha a data da rodada antes de publicar.'); return; }
    const plan = snapshotTeamPlanner();
    plan.slots.forEach(slot=>{
      slot.listedPlayers=[...new Set([...(slot.listedPlayers||[]),...(slot.attendance||[]),...(slot.teams||[]).flat()])];
    });
    const hasTeams = plan.slots.length>0 && plan.slots.every(slot=>Array.isArray(slot.teams) && slot.teams.length===plan.teamCount);
    const hasAttendance = plan.slots.some(slot=>(slot.attendance||[]).length);
    if(type==='attendance' && !hasAttendance){ showToast('Marque pelo menos uma presença antes de publicar a lista.'); return; }
    if((type==='draw' || type==='all') && !hasTeams){ showToast('Sorteie os times antes de publicar os sorteios.'); return; }
    const label = $('roundLabel').value.trim() || `Times de ${fmtDate(date)}`;
    const existing = publishedTeamPlans.find(item=>item.date===date);
    if(existing){
      existing.teamPlan=plan;
      existing.label=label;
      if(type==='draw' || type==='all') existing.drawPublished=true;
      if(type==='attendance') existing.attendancePublished=true;
    } else {
      publishedTeamPlans.push({
        id:uid(), label, date, teamPlan:plan, publishedAt:new Date().toISOString(),
        attendancePublished:true,
        drawPublished:type==='draw' || type==='all',
      });
    }
    const published=await savePlanner();
    if(!published){showToast('Não foi possível publicar agora. Confira a conexão e tente novamente.');return;}
    renderAll();
    showToast(type==='attendance' ? 'Lista de presença publicada para todos.' : (type==='draw' ? 'Sorteios publicados para todos.' : 'Lista e sorteios publicados para todos.'));
  };
  $('btnPublishAttendance').addEventListener('click', ()=>publishTeamPlan('attendance'));
  $('btnPublishTeamDraw').addEventListener('click', ()=>publishTeamPlan('draw'));
  $('btnSaveTeamPlanner').addEventListener('click', ()=>publishTeamPlan('all'));
  $('btnDeleteTeamPlanner').addEventListener('click', async ()=>{ if(!await askConfirm('Apagar os times sorteados e as listas de presença?')) return; const date=$('roundDate').value; teamPlanner.slots.forEach(slot=>{slot.attendance=[];slot.goalkeepers=[];slot.goalkeeperSides={a:[],b:[]};slot.captains=[];slot.teams=[];slot.reserves=[];slot.substitutePools=[];}); if(date) publishedTeamPlans=publishedTeamPlans.filter(item=>item.date!==date); await savePlanner(); renderRoundForm(); showToast('Escala apagada.'); });
}
function renderRoundForm(){
  renderTeamPlanner();
  renderPublishedTeamPlans();
  renderRoundSortBar();
  if(!editingRoundId){
    if(!$('roundDate').value) $('roundDate').value = new Date().toISOString().slice(0,10);
    if(!$('roundLabel').value) $('roundLabel').value = `Rodada ${rounds.length+1}`;
  }
  const wrap = $('roundEntriesWrap');
  let preserved;
  if(pendingPrefillEntries){
    preserved = {};
    Object.entries(pendingPrefillEntries).forEach(([pid,e])=>{
      preserved[pid] = { goals: e.goals!=null?e.goals:'', assists: e.assists!=null?e.assists:'', rating: e.rating!=null?e.rating:'' };
    });
    pendingPrefillEntries = null;
  } else {
    preserved = captureCurrentRoundEntries();
  }
  if(!players.length){
    wrap.innerHTML = '<div class="empty">Cadastre jogadores no Elenco antes de lançar uma rodada.</div>';
  } else {
    const totals = computeAllTotals();
    const sortedPlayers = sortPlayersByMode(players, totals, roundSortMode, roundSortDir);
    const presentIds = getLaunchPresenceIds($('roundDate').value);
    const discipline = computeDisciplineStatus();
    const playersToLaunch = sortedPlayers.filter(player=>presentIds.has(player.id) && (editingRoundId || !(discipline[player.id]?.suspendedRounds>0)));
    const cur = computeCurrentPeriodStats();
    const reigning = computeReigningTitles();
    const secretSets = computeSecretRecordSets();
    const officialSpecial=latestClosedSpecialPatentSets();
    const latestClosed = months.length ? [...months].sort((a,b)=>b.endDate.localeCompare(a.endDate))[0] : null;
    const latestClosedKey = latestClosed ? computePeriodMonthKey(latestClosed.startDate, latestClosed.endDate) : '';
    const latestAwards = computeLastMonthAwardsData();
    const latestAwardPlayerIds = new Set(['mvp','artilheiro','garcom'].flatMap(type=>latestAwards?.[type]?.playerIds||[latestAwards?.[type]?.playerId]).filter(Boolean));
    if(!playersToLaunch.length){
      wrap.innerHTML = '<div class="empty">Marque a presença e publique/salve a estrutura de times desta data para liberar o lançamento dos dados.</div>';
    } else wrap.innerHTML = `<div class="col-labels"><span></span><span>Jogador</span><span>Gols</span><span>Assist.</span><span>Nota</span></div>` +
      playersToLaunch.map(p=>{
        const pv = preserved[p.id] || {};
        let rowBadges = [];
        const contestTitles = [];
        if(cur){
          const leadsAllThreeNowRow = isCurrentGoat(cur,p.id);
          if(leadsAllThreeNowRow){
            rowBadges.push('🐐');
            contestTitles.push('Tríplice Coroa');
          } else {
            if(isCurrentLeader(cur,'mvp',p.id)){ rowBadges.push('⭐'); contestTitles.push('MVP'); }
            if(isCurrentLeader(cur,'artilheiro',p.id)){ rowBadges.push('⚽'); contestTitles.push('Artilheiro'); }
            if(isCurrentLeader(cur,'garcom',p.id)){ rowBadges.push('🎯'); contestTitles.push('Garçom'); }
          }
        }
        const rb = computeReigningBadgesFor(reigning, p.id);
        if(rb.isGoat){ if(!rowBadges.includes('🐐')) rowBadges.push('🐐'); }
        else rb.titles.forEach(()=> rowBadges.push('👑'));
        const isLatestCosmic = officialSpecial.cosmic.has(p.id);
        const isLatestPlatinum = officialSpecial.collector.has(p.id);
        const isLatestPrismatic = hasReigningPrismaticPerformance(p.id);
        const isTitleContender = isCurrentTitleContender(p.id);
        const entryTier = isLatestCosmic ? 'cosmic'
          : (isLatestPlatinum ? 'platinum' : (rb.isGoat ? 'goat' : (isLatestPrismatic ? 'prismatic' : (rb.titles.length ? 'gold' : (isTitleContender ? 'title-contender' : 'normal')))));
        if(entryTier==='cosmic' && !rowBadges.includes('🌌')) rowBadges.unshift('🌌');
        if(entryTier==='platinum' && !rowBadges.includes('💠')) rowBadges.unshift('💠');
        if(entryTier==='prismatic' && !rowBadges.includes('💎')) rowBadges.unshift('💎');
        const badgeHtml = renderEntryTitleBadges(rowBadges);
        const acquiredTags = [];
        if(entryTier==='cosmic') acquiredTags.push(' <span class="entry-cosmic-tag">(COSMIC conquistado)</span>');
        if(isLatestPlatinum) acquiredTags.push(' <span class="entry-platinum-tag">(COLECIONADOR conquistado)</span>');
        if(!isLatestCosmic && !isLatestPlatinum && !isLatestPrismatic){
          if(rb.isGoat) acquiredTags.push(` <span style="font-size:10px;color:#ff8c00;">(${GOAT_TITLE} conquistado)</span>`);
          else acquiredTags.push(...rb.titles.map(t=>` <span style="font-size:10px;color:var(--gold);">(${t.name} conquistado)</span>`));
        }
        const acquiredTag = acquiredTags.join('');
        const contestTag = contestTitles.length ? ` <span style="font-size:10px;color:var(--sky);">(${contestTitles.length===1 ? contestTitles[0]+' atual' : 'Tríplice Coroa atual'})</span>` : '';
        const nameTag = acquiredTag + contestTag;
        const rowClass = entryTier==='cosmic' ? ' is-cosmic' : (entryTier==='platinum' ? ' is-platinum' : (rb.isGoat ? ' is-goat' : (entryTier==='prismatic' ? ' is-prismatic' : (rb.titles.length ? ' is-reigning' : (isCurrentGoat(cur,p.id) ? ' is-goat-contender' : (entryTier==='title-contender' ? ' is-title-contender' : ''))))));
        const wmCodes = isLatestCosmic ? ['MP'] : (isLatestPlatinum ? ['COL'] : (rb.isGoat ? ['GOAT'] : (isLatestPrismatic ? ['PRISM'] : rb.titles.map(t=>t.wm))));
        const enameWmClass = wmCodes.length ? (' has-watermark' + (wmCodes.length>1 ? ' has-watermark-multi' : '')) : '';
        const enameWmAttr = wmCodes.length ? ` data-wm="${wmCodes.join(' · ')}"` : '';
        const nameShineClass = entryTier==='cosmic' ? ' shine-cosmic-text' : (entryTier==='platinum' ? ' shine-platinum-text' : (rb.isGoat ? ' shine-goat-text' : (entryTier==='prismatic' ? ' shine-prismatic-text' : (rb.titles.length ? ' shine-gold-text' : ''))));
        return `
      <div class="entry-row${rowClass}" data-id="${p.id}">
        ${p.photo ? circlePhotoMarkup(p,'entry-circle-photo') : `<div class="ph-fb">${initials(p.name)}</div>`}
        <div class="ename${enameWmClass}"${enameWmAttr}><div class="ename-inner"><span class="ename-text${nameShineClass}">${p.nickname}</span>${badgeHtml}${nameTag}</div></div>
        <input type="number" min="0" step="1" class="in-goals" placeholder="0" value="${pv.goals!==undefined && pv.goals!=='' ? pv.goals : 0}">
        <input type="number" min="0" step="1" class="in-assists" placeholder="0" value="${pv.assists!==undefined && pv.assists!=='' ? pv.assists : 0}">
        <input type="number" min="0" max="10" step="0.5" class="in-rating" placeholder="0" value="${pv.rating!==undefined && pv.rating!=='' ? Math.min(10,Number(pv.rating)||0) : 0}">
      </div>`;}).join('');
  }
  const launchDate=$('roundDate');
  if(launchDate) launchDate.onchange=()=>renderRoundForm();
  renderRoundsList();
}
function startEditRound(id){
  const r = rounds.find(rr=>rr.id===id);
  if(!r) return;
  editingPlannerBefore = snapshotTeamPlanner();
  if(findClosedMonthForRound(r)){ showToast('Essa rodada pertence a um mês fechado. Reabra o mês na aba Mês pra poder editá-la.'); return; }
  editingRoundId = id;
  pendingPrefillEntries = r.entries || {};
  if(r.teamPlan && Array.isArray(r.teamPlan.slots)){
    teamPlanner = normalizeTeamPlanner(r.teamPlan);
  } else {
    const participantIds=Object.entries(r.entries||{})
      .filter(([,entry])=>entry.goals!=='' || entry.assists!=='' || entry.rating!=='')
      .map(([playerId])=>playerId)
      .filter(playerId=>players.some(player=>player.id===playerId));
    teamPlanner = normalizeTeamPlanner({
      teamCount:4,
      playersPerTeam:4,
      slots:[{id:uid(),label:'Horário da rodada',attendance:participantIds,captains:[],teams:[],reserves:[]}],
    });
  }
  editingOriginalAttendancePlan = JSON.parse(JSON.stringify(teamPlanner));
  editingAttendancePlan = JSON.parse(JSON.stringify(teamPlanner));
  teamPlanner.slots.forEach(slot=>{
    const scheduled=[...new Set((slot.listedPlayers||[]).concat((slot.teams||[]).flat()))];
    if(!scheduled.length) return;
    const absences=getRoundAbsences(r);
    slot.listedPlayers=[...new Set([...(slot.listedPlayers||[]),...scheduled])];
    slot.attendance=[...new Set([...(slot.attendance||[]),...scheduled.filter(playerId=>!absences[playerId])])];
  });
  $('roundLabel').value = r.label;
  $('roundDate').value = r.date;
  $('roundEditNotice').style.display = '';
  $('roundEditingLabel').textContent = r.label;
  $('btnSaveRound').textContent = 'Salvar edição';
  $('btnDiscardRoundEdit').style.display = '';
  renderRoundForm();
  showToast('Rodada carregada com presença, capitães e times salvos.');
  document.getElementById('view-rodada').scrollIntoView({behavior:'smooth', block:'start'});
}
window.editRound = startEditRound;
function exitRoundEditMode(restorePlanner=false){
  if(restorePlanner && editingPlannerBefore) teamPlanner = normalizeTeamPlanner(editingPlannerBefore);
  editingRoundId = null;
  editingAttendancePlan = null;
  editingOriginalAttendancePlan = null;
  editingPlannerBefore = null;
  pendingPrefillEntries = {};
  $('roundLabel').value = '';
  $('roundDate').value = '';
  $('roundEditNotice').style.display = 'none';
  $('btnSaveRound').textContent = 'Salvar rodada';
  $('btnDiscardRoundEdit').style.display = 'none';
}
const discardRoundEdit = ()=>{
  exitRoundEditMode(true);
  renderRoundForm();
};
$('btnDiscardRoundEdit').addEventListener('click', discardRoundEdit);
$('btnSaveRound').addEventListener('click', async ()=>{
  if(!players.length) return;
  const entries = {};
  document.querySelectorAll('#roundEntriesWrap .entry-row').forEach(row=>{
    const pid = row.dataset.id;
    const goals = row.querySelector('.in-goals').value;
    const assists = row.querySelector('.in-assists').value;
    const rating = row.querySelector('.in-rating').value;
    entries[pid] = { goals: goals===''?'':goals, assists: assists===''?'':assists, rating: rating===''?'':rating };
  });
  const label = $('roundLabel').value.trim() || `Rodada ${rounds.length+1}`;
  const date = $('roundDate').value;
  const draftTeamPlan = snapshotTeamPlanner();
  if(editingRoundId && editingAttendancePlan){
    draftTeamPlan.slots.forEach(slot=>{
      const attendanceSlot=editingAttendancePlan.slots.find(source=>source.id===slot.id);
      const originalSlot=editingOriginalAttendancePlan?.slots?.find(source=>source.id===slot.id);
      if(!attendanceSlot && !originalSlot) return;
      const originalAttendance=originalSlot?.attendance||[];
      const editedAttendance=attendanceSlot?.attendance||[];
      slot.attendance=[...new Set([...originalAttendance,...editedAttendance])];
      slot.justifiedAbsences=[...(attendanceSlot?.justifiedAbsences||[])].filter(id=>!slot.attendance.includes(id));
      slot.listedPlayers=[...new Set([...(originalSlot?.listedPlayers||[]),...(attendanceSlot?.listedPlayers||[]),...slot.attendance])];
    });
  }
  if(editingRoundId){
    const r = rounds.find(rr=>rr.id===editingRoundId);
    if(r){ r.label = label; r.date = date; r.entries = entries; r.teamPlan = draftTeamPlan; r.absences=getPlanAbsences(draftTeamPlan); }
    publishedTeamPlans=publishedTeamPlans.filter(plan=>plan.date!==date);
    exitRoundEditMode();
    renderAll();
    await saveRounds();
    showToast('Rodada atualizada!');
  } else {
    const publishedIndex = publishedTeamPlans.findIndex(item=>item.date===date);
    const hasLaunchedData = Object.values(entries).some(e=>e.goals!=='' || e.assists!=='' || e.rating!=='');
    if(publishedIndex>=0 && !hasLaunchedData){
      showToast('Lance ao menos um dado da rodada para transformar a escala publicada em rodada salva.');
      return;
    }
    const teamPlan = publishedIndex>=0 ? publishedTeamPlans[publishedIndex].teamPlan : draftTeamPlan;
    const absences = getPlanAbsences(teamPlan);
    const existingRound = rounds.find(r=>r.date===date);
    if(existingRound){ existingRound.label=label; existingRound.entries=entries; existingRound.teamPlan=teamPlan; existingRound.absences=absences; }
    else rounds.push({ id: uid(), label, date, entries, teamPlan, absences });
    if(publishedIndex>=0) publishedTeamPlans.splice(publishedIndex,1);
    $('roundLabel').value = '';
    pendingPrefillEntries = {};
    renderAll();
    await saveRounds();
    showToast('Rodada salva!');
  }
});

let roundPlayersSortMode = 'alpha';
let roundPlayersSortDir = 'asc';
function computeRoundAggregate(r){
  let goals=0, assists=0;
  Object.values(r.entries||{}).forEach(e=>{
    const hasData = (e.goals!=='' && e.goals!=null) || (e.assists!=='' && e.assists!=null) || (e.rating!=='' && e.rating!=null);
    if(!hasData) return;
    goals += Number(e.goals)||0;
    assists += Number(e.assists)||0;
  });
  return { goals, assists };
}
function computeRoundBrokenRecords(r, globalRec, secretSets){
  const found = [];
  const tripleCrownSet = new Set(computeTripleCrownHistory().map(c=> c.playerId+'|'+c.monthKey));
  const monthKey = recordPeriodKeyForRound(r);
  function tierFor(playerId){
    if(secretSets && monthKey && secretSets.cosmicMonthSet.has(playerId+'|'+monthKey)) return 'cosmic';
    if(secretSets && isPlatinumInstance(playerId, secretSets.platinumPlayerSet, {round:r})) return 'platinum';
    if(monthKey && tripleCrownSet.has(playerId+'|'+monthKey)) return 'goat';
    return null;
  }
  ROUND_RECORD_CATS.forEach(c=>{
    (globalRec[c.key]||[]).forEach(item=>{
      if(item.round && item.round.id === r.id){
        const tier = tierFor(item.playerId);
        found.push({ playerId:item.playerId, label:c.label, value:item.value, unit:c.unit,
          prismatic: !tier && isPrismaticRecord(c.key,item), goat: tier==='goat', cosmic: tier==='cosmic', platinum: tier==='platinum' });
      }
    });
  });

  if(monthKey){
    MONTH_RECORD_CATS.forEach(c=>{
      (globalRec[c.key]||[]).forEach(item=>{
        if(item.monthKey !== monthKey) return;
        const e = (r.entries||{})[item.playerId];
        const played = e && ((e.goals!=='' && e.goals!=null) || (e.assists!=='' && e.assists!=null) || (e.rating!=='' && e.rating!=null));
        if(played){
          const tier = tierFor(item.playerId);
          found.push({ playerId:item.playerId, label:c.label, value:item.value, unit:c.unit,
            prismatic: !tier && isPrismaticRecord(c.key,item), goat: tier==='goat', cosmic: tier==='cosmic', platinum: tier==='platinum' });
        }
      });
    });
  }

  (globalRec.ratingTen||[]).forEach(item=>{
    const e = (r.entries||{})[item.playerId];
    const rating = (e && e.rating!=='' && e.rating!=null) ? Number(e.rating) : null;
    if(rating===10){
      const tier = tierFor(item.playerId);
      found.push({ playerId:item.playerId, label:'Mais vezes com nota 10', value:item.value, unit:'x', prismatic:false, goat: tier==='goat', cosmic: tier==='cosmic', platinum: tier==='platinum' });
    }
  });

  return found;
}
function renderRoundPlayersSortBar(){
  renderSortBar($('roundsSortBar'), {
    label: 'Ordenar jogadores em cada rodada:',
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
    mode: roundPlayersSortMode,
    dir: roundPlayersSortDir,
    onModeChange: (mode)=>{
      roundPlayersSortMode = mode;
      roundPlayersSortDir = mode==='alpha' ? 'asc' : 'desc';
      renderRoundsList();
    },
    onDirChange: ()=>{
      roundPlayersSortDir = roundPlayersSortDir==='asc' ? 'desc' : 'asc';
      renderRoundsList();
    }
  });
}
function findClosedMonthForRound(r){
  return months.find(m => r.date >= m.startDate.slice(0,10) && r.date < m.endDate.slice(0,10));
}
function snapshotTeamPlanner(){
  return JSON.parse(JSON.stringify(teamPlanner));
}
async function publishRequestedPlanForToday(saveToCloud=true){
  const targetDate='2026-08-09';
  if(saveToCloud&&(!auth.currentUser||!appDataLoaded))return;
  if(rounds.some(round=>round.seedTag==='requested-round2-2026-08-09-v1'))return;
  const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const findId=name=>{const wanted=key(name);return players.find(player=>key(player.nickname)===wanted||key(player.name)===wanted)?.id};
  const names=['José','Caio','M. Kevyn','Ruan','Henrique','Pelé','Pedrim','Neguim','Thiago','Erick','Samuel'];
  const ids=Object.fromEntries(names.map(name=>[name,findId(name)]));
  if(names.some(name=>!ids[name])){console.warn('Publicação solicitada não aplicada: jogador não encontrado.');return}
  const slot={
    id:uid(),label:'08:00 às 09:30',attendance:names.map(name=>ids[name]),
    captains:[ids['Caio'],ids['Henrique'],ids['Pedrim']],
    teams:[
      [ids['Caio'],ids['José'],ids['Erick'],ids['Pelé']],
      [ids['Henrique'],ids['M. Kevyn'],ids['Thiago'],ids['Ruan']],
      [ids['Pedrim'],ids['Neguim'],ids['Samuel']],
    ],
    reserves:[ids['Erick'],ids['M. Kevyn']],
    substitutePools:[[],[],[{id:ids['Erick'],homeTeamIndex:0},{id:ids['M. Kevyn'],homeTeamIndex:1}]],
    listedPlayers:names.map(name=>ids[name]),justifiedAbsences:[],
  };
  const requestedPlanner=normalizeTeamPlanner({teamCount:3,playersPerTeam:4,slots:[slot]});
  const stats={
    'Caio':[10,0,9],'Erick':[2,2,7],'Henrique':[12,4,10],'José':[0,5,7.5],
    'M. Kevyn':[8,10,10],'Neguim':[5,2,8],'Pedrim':[2,6,8.5],'Pelé':[2,1,7],
    'Ruan':[1,2,8],'Samuel':[4,3,8],'Thiago':[6,4,10],
  };
  const entries=Object.fromEntries(Object.entries(stats).map(([name,[goals,assists,rating]])=>[ids[name],{goals:String(goals),assists:String(assists),rating:String(rating)}]));
  let round=rounds.find(item=>item.label==='Rodada 2'||item.date===targetDate);
  const roundData={label:'Rodada 2',date:targetDate,entries,teamPlan:JSON.parse(JSON.stringify(requestedPlanner)),absences:getPlanAbsences(requestedPlanner),seedTag:'requested-round2-2026-08-09-v1'};
  if(round)Object.assign(round,roundData);else rounds.push({id:uid(),...roundData});
  round2NeedsCloudRecovery=true;
  if(!saveToCloud)return;
  renderAll();
  const saved=await saveRounds();
  if(saved)showToast('Rodada 2 salva com times, presenças e estatísticas.');
}
function renderPublishedAttendance(plan){
  const slots=Array.isArray(plan?.slots) ? plan.slots : [];
  const playerName=id=>players.find(player=>player.id===id)?.nickname || 'Jogador removido';
  const discipline=computeDisciplineStatus();
  const html=slots.map((slot,index)=>{
    slot.attendance=(slot.attendance||[]).slice(0,roundAttendanceLimit(plan));
    const attendance=new Set(slot.attendance||[]), justified=new Set(slot.justifiedAbsences||[]);
    const goalkeeperIds=(slot.goalkeepers||[]).filter(id=>players.some(player=>player.id===id));
    const ids=(editingRoundId
      ? [...new Set([...(slot.attendance||[]),...(slot.justifiedAbsences||[]),...(slot.teams||[]).flat()])]
      : [...new Set([...(slot.listedPlayers||[]),...(slot.teams||[]).flat(),...(slot.attendance||[]),...(slot.justifiedAbsences||[])])])
      .filter(id=>editingRoundId || !(discipline[id]?.suspendedRounds>0));
    if(!ids.length&&!goalkeeperIds.length) return '';
    const originalSlot=editingOriginalAttendancePlan?.slots?.find(source=>source.id===slot.id);
    const originalAttendance=new Set(originalSlot?.attendance||[]);
    return `<div class="published-attendance-slot"><b>Horário ${index+1}${slot.label ? ` — ${slot.label}` : ''}</b><div>${ids.map(id=>{
      const locked=!!editingRoundId && originalAttendance.has(id);
      return isAdmin?`<label><input type="checkbox" data-published-attendance="${slot.id}" value="${id}" ${attendance.has(id)?'checked':''} ${locked?'disabled':''}> ${playerName(id)}${locked?' <small style="color:var(--sky)">· presença original</small>':''}${!attendance.has(id)?` <small><input type="checkbox" data-published-justified="${slot.id}" value="${id}" ${justified.has(id)?'checked':''}> justificada</small>`:''}</label>`:`<span>${attendance.has(id)?'✅':'❌'} ${playerName(id)}${!attendance.has(id)&&justified.has(id)?' · justificada':''}</span>`;
    }).join('')}</div>${goalkeeperIds.length?`<div class="team-goalkeepers"><b>🧤 Goleiros fora da lista normal</b><div>${goalkeeperIds.map(id=>`<span>${playerName(id)}</span>`).join('')}</div></div>`:''}</div>`;
  }).join('');
  return html ? `<div class="published-attendance"><div class="saved-team-plan-title">✅ Lista de presença</div>${html}</div>` : '';
}
function renderSavedRoundTeams(round, showTotals=true){
  const plan = round.teamPlan;
  const slots = Array.isArray(plan?.slots) ? plan.slots.filter(slot=>Array.isArray(slot.teams) && slot.teams.length) : [];
  if(!slots.length) return '';
  const playerName = id=>players.find(p=>p.id===id)?.nickname || 'Jogador removido';
  const safeTeamName=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const patentContext=createRankingPatentContext();
  const playerAvatar = id=>`<span class="${rankingPatentClass(id,patentContext)}">${playerCircleMarkup(players.find(p=>p.id===id),'saved-team-photo',24)}</span>`;
  const simulatorTeams=Array.isArray(round.simulatorStats?.teams)?round.simulatorStats.teams:[];
  let simulatorTeamOffset=0;
  const teamHtml = (team,index,captains,slot,exactTeam)=>{
    let goals=0, assists=0, score=0;
    team.forEach(id=>{
      const entry=(round.entries||{})[id]||{};
      const g=Number(entry.goals)||0, a=Number(entry.assists)||0;
      const rating=(entry.rating!=='' && entry.rating!=null) ? Number(entry.rating)||0 : 0;
      goals+=g; assists+=a; score+=rating*4+g*5+a*4.5;
    });
    const substitutes=substitutePoolForTeam(slot,index);
    const substitutesHtml=substitutes.length?`<div class="team-substitute-pool"><b>⇄ Substitutos do Time ${index+1}</b>${substitutes.map(item=>`<span class="team-substitute-chip">${playerAvatar(item.id)} ${playerName(item.id)} <small>· origem Time ${Number(item.homeTeamIndex)+1}</small></span>`).join('')}</div>`:'';
    const exactResults=exactTeam?`<div class="saved-team-total">${Number(exactTeam.w)||0} V · ${Number(exactTeam.d)||0} E · ${Number(exactTeam.l)||0} D</div>`:'';
    const exactTotals=exactTeam?`<div class="saved-team-total">${Number(exactTeam.goals)||0} gols feitos · ${Number(exactTeam.ga)||0} gols sofridos</div>`:'';
    const playersHtml=team.map(id=>{const stat=exactTeam?.playerStats?.[id];return `<div class="saved-team-player">${playerAvatar(id)}<span>${captains.has(id)?'👑':'⚽'} ${playerName(id)}</span>${exactTeam?`<b>${Number(stat?.goals)||0}G · ${Number(stat?.assists)||0}A</b>`:''}</div>`;}).join('');
    return `<div class="saved-team-card"><h4>${exactTeam?safeTeamName(exactTeam.name||`Time ${index+1}`):`Time ${index+1}`} · Força ${teamOverallStrength(team)} OVR</h4>${exactResults}<div class="saved-team-players">${playersHtml}</div>${substitutesHtml}${exactTotals||(showTotals ? `<div class="saved-team-total">${goals} G · ${assists} A · ${score.toFixed(1)} pts</div>` : '')}</div>`;
  };
  return `<div class="saved-team-plan"><div class="saved-team-plan-title">⚽ Times desta rodada</div>${slots.map((slot,index)=>{const captains=new Set(slot.captains||[]),offset=simulatorTeamOffset;simulatorTeamOffset+=slot.teams.length;return `<div class="saved-team-slot"><b>Horário ${index+1}${slot.label ? ` — ${slot.label}` : ''}</b><div class="saved-team-grid">${slot.teams.map((team,i)=>teamHtml(team,i,captains,slot,simulatorTeams[offset+i]||null)).join('')}</div>${goalkeeperSidesMarkup(slot,playerName,playerAvatar)}</div>`;}).join('')}</div>`;
}
function simulatorExportPlayersForPlan(plan){
  const ids=new Set();
  (plan?.slots||[]).forEach(slot=>{
    [...(slot.attendance||[]),...(slot.goalkeepers||[]),...(slot.goalkeeperSides?.a||[]),...(slot.goalkeeperSides?.b||[]),...(slot.listedPlayers||[]),...(slot.justifiedAbsences||[])].forEach(id=>ids.add(String(id)));
    (slot.teams||[]).forEach(team=>(Array.isArray(team)?team:(team?.members||[])).forEach(id=>ids.add(String(id))));
  });
  return players.filter(player=>ids.has(String(player.id))).map(player=>({id:String(player.id),name:player.name||player.nickname,nickname:player.nickname||player.name,role:player.role||'normal'}));
}
function downloadSimulatorExport(item,type){
  const plan=JSON.parse(JSON.stringify(item.teamPlan||{slots:[]}));
  const payload={schema:'racha-manager-official/v1',exportType:type,exportedAt:new Date().toISOString(),players:simulatorExportPlayersForPlan(plan),publishedTeamPlans:[{id:String(item.id),label:item.label||'Lista do Racha Manager',date:item.date||'',publishedAt:item.publishedAt||null,attendancePublished:true,drawPublished:plan.slots?.some(slot=>(slot.teams||[]).length)||false,teamPlan:plan}]};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`racha-manager-${type}-${String(item.date||item.id||'exportacao').replace(/[^a-z0-9_-]/gi,'-')}.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  showToast('Arquivo pronto para importar no Racha Manager Simulator.');
}
function exportPublishedPlanForSimulator(id){const item=publishedTeamPlans.find(plan=>String(plan.id)===String(id));if(item)downloadSimulatorExport(item,'lista')}
function exportRoundForSimulator(id){const item=rounds.find(round=>String(round.id)===String(id));if(item)downloadSimulatorExport(item,'rodada')}
function sharePlayerName(id){return players.find(player=>String(player.id)===String(id))?.nickname||'Jogador removido'}
function sharePlanText(plan){const lines=[];(plan?.slots||[]).forEach((slot,index)=>{const present=[...new Set(slot.attendance||[])],listed=[...new Set([...(slot.listedPlayers||[]),...(slot.teams||[]).flat(),...present,...(slot.justifiedAbsences||[])])],presentSet=new Set(present),justifiedSet=new Set(slot.justifiedAbsences||[]),absent=listed.filter(id=>!presentSet.has(id)&&!isGoalkeeperPlayer(id)),goalkeepers=[...new Set(slot.goalkeepers||[])];lines.push('',`⏰ Horário ${index+1}${slot.label?` — ${slot.label}`:''}`);if(present.length)lines.push(`✅ Presentes (${present.length}): ${present.map(sharePlayerName).join(', ')}`);if(absent.length)lines.push(`❌ Ausentes: ${absent.map(id=>`${sharePlayerName(id)}${justifiedSet.has(id)?' (justificada)':''}`).join(', ')}`);if(goalkeepers.length)lines.push(`🧤 Goleiros: ${goalkeepers.map(sharePlayerName).join(', ')}`);(slot.teams||[]).forEach((team,teamIndex)=>{if(team?.length)lines.push(`⚽ Time ${teamIndex+1}: ${team.map(sharePlayerName).join(', ')}`)});const sideA=(slot.goalkeeperSides?.a||[]).map(sharePlayerName),sideB=(slot.goalkeeperSides?.b||[]).map(sharePlayerName);if(sideA.length||sideB.length)lines.push(`🥅 Lado A: ${sideA.join(', ')||'sem goleiro'} · Lado B: ${sideB.join(', ')||'sem goleiro'}`)});return lines.join('\n').trim()}
async function shareRachaContent(title,text){const url=location.href.split('#')[0],data={title,text,url};if(navigator.share){try{await navigator.share(data);return}catch(error){if(error?.name==='AbortError')return}}const fullText=`${title}\n\n${text}\n\n${url}`;try{await navigator.clipboard.writeText(fullText);showToast('Conteúdo copiado. Agora é só colar onde quiser.')}catch(error){const area=document.createElement('textarea');area.value=fullText;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();showToast('Conteúdo copiado. Agora é só colar onde quiser.')}}
function sharePublishedPlan(id){const item=publishedTeamPlans.find(plan=>String(plan.id)===String(id));if(!item)return;const title=`Racha Manager · ${item.label||'Lista publicada'}`,text=`📋 ${item.label||'Lista publicada'}\n📅 ${fmtDate(item.date)}\n${sharePlanText(item.teamPlan)}`;shareRachaContent(title,text)}
function shareRound(id){const round=rounds.find(item=>String(item.id)===String(id));if(!round)return;const aggregate=computeRoundAggregate(round),playerLines=Object.entries(round.entries||{}).filter(([,entry])=>entry.goals!==''||entry.assists!==''||entry.rating!=='').map(([playerId,entry])=>{const goals=Number(entry.goals)||0,assists=Number(entry.assists)||0,rating=entry.rating!==''&&entry.rating!=null?` · nota ${Number(entry.rating)||0}`:'';return `${sharePlayerName(playerId)}: ${goals}G · ${assists}A${rating}`}),text=[`⚽ ${round.label}`,`📅 ${fmtDate(round.date)}`,`📊 ${aggregate.goals} gols · ${aggregate.assists} assistências`,playerLines.length?'\n👥 Jogadores\n'+playerLines.join('\n'):'',round.teamPlan?'\n'+sharePlanText(round.teamPlan):''].filter(Boolean).join('\n');shareRachaContent(`Racha Manager · ${round.label}`,text)}
function renderPublishedTeamPlans(){
  const list=$('publishedTeamPlansList');
  if(!list) return;
  const editingRound=editingRoundId ? rounds.find(round=>round.id===editingRoundId) : null;
  const editingPlan=editingRound ? {id:`editing-${editingRound.id}`,label:editingRound.label,date:editingRound.date,teamPlan:editingAttendancePlan || teamPlanner,drawPublished:true,editing:true} : null;
  const plans=editingPlan ? [editingPlan] : [...publishedTeamPlans];
  if(!plans.length){ list.innerHTML=''; return; }
  plans.sort((a,b)=>a.date.localeCompare(b.date));
  list.innerHTML=`<div class="table-title" style="margin-top:18px;">📋 ${editingPlan?'Lista da rodada em edição e escalas publicadas':'Escalas publicadas — aguardando dados'}</div>${plans.map(item=>{ const hasPublishedDraw=item.drawPublished!==false; return `<details class="round-item" open><summary><div><div class="round-title">⚽ ${item.label}</div><div class="round-date">${fmtDate(item.date)}</div></div><div class="round-summary-actions"><span class="record-count-badge tier-gold">${item.editing?'✏️ Lista em edição':(hasPublishedDraw?'⚽ Sorteio publicado':'📋 Lista publicada')}</span>${!item.editing?`<button class="btn btn-ghost btn-sm" onclick="event.preventDefault();event.stopPropagation();sharePublishedPlan('${item.id}')">Compartilhar</button><button class="btn btn-ghost btn-sm" onclick="event.preventDefault();event.stopPropagation();exportPublishedPlanForSimulator('${item.id}')">Importar no simulador</button>`:''}${isAdmin&&!item.editing?`<button class="btn btn-danger btn-sm" onclick="event.preventDefault();event.stopPropagation();deletePublishedTeamPlan('${item.id}')">Apagar escala</button>`:''}</div></summary><div class="round-body"><div class="round-summary">A presença fica pública primeiro. Os times só aparecem após o organizador publicar o sorteio.</div>${renderPublishedAttendance(item.teamPlan)}${hasPublishedDraw?renderSavedRoundTeams({teamPlan:item.teamPlan,entries:{}},false):''}</div></details>`; }).join('')}`;
  const findPublishedSlot=(slotId)=>plans.flatMap(plan=>(plan.teamPlan?.slots||[]).map(slot=>({plan,slot}))).find(item=>item.slot.id===slotId);
  list.querySelectorAll('[data-published-attendance]').forEach(input=>input.addEventListener('change',async ()=>{
    const found=findPublishedSlot(input.dataset.publishedAttendance); if(!found) return;
    const originalSlot=editingOriginalAttendancePlan?.slots?.find(slot=>slot.id===found.slot.id);
    const wasOriginallyPresent=!!found.plan.editing && new Set(originalSlot?.attendance||[]).has(input.value);
    if(wasOriginallyPresent && !input.checked){
      input.checked=true;
      showToast('Quem já estava presente nesta rodada não pode ser desmarcado.');
      return;
    }
    found.slot.listedPlayers=[...new Set([...(found.slot.listedPlayers||[]),...(found.slot.attendance||[]),...(found.slot.teams||[]).flat(),input.value])];
    const set=new Set(found.slot.attendance||[]);
    const publishedLimit=roundAttendanceLimit(found.plan.teamPlan);
    if(input.checked&&!set.has(input.value)&&set.size>=publishedLimit){input.checked=false;showToast(`Esta lista já atingiu o limite de ${publishedLimit} pessoas.`);return;}
    input.checked ? set.add(input.value) : set.delete(input.value);
    found.slot.attendance=[...set];
    if(input.checked) found.slot.justifiedAbsences=(found.slot.justifiedAbsences||[]).filter(id=>id!==input.value);
    if(found.plan.editing){
      const localSlot=teamPlanner.slots.find(slot=>slot.id===found.slot.id);
      if(localSlot){
        const localSet=new Set(localSlot.attendance||[]);
        input.checked ? localSet.add(input.value) : localSet.delete(input.value);
        localSlot.attendance=[...localSet];
        localSlot.listedPlayers=[...new Set([...(localSlot.listedPlayers||[]),input.value])];
        if(input.checked) localSlot.justifiedAbsences=(localSlot.justifiedAbsences||[]).filter(id=>id!==input.value);
      }
      renderRoundForm();
    } else {
      const localSlot=teamPlanner.slots.find(slot=>slot.id===found.slot.id);
      if(localSlot){ localSlot.attendance=[...found.slot.attendance]; localSlot.justifiedAbsences=[...(found.slot.justifiedAbsences||[])]; localSlot.listedPlayers=[...found.slot.listedPlayers]; }
      renderAll();await savePlanner();
    }
  }));
  list.querySelectorAll('[data-published-justified]').forEach(input=>input.addEventListener('change',async ()=>{
    const found=findPublishedSlot(input.dataset.publishedJustified); if(!found) return;
    const set=new Set(found.slot.justifiedAbsences||[]);
    input.checked ? set.add(input.value) : set.delete(input.value);
    found.slot.justifiedAbsences=[...set];
    if(found.plan.editing) renderRoundForm();
    else {
      const localSlot=teamPlanner.slots.find(slot=>slot.id===found.slot.id);
      if(localSlot) localSlot.justifiedAbsences=[...found.slot.justifiedAbsences];
      renderAll();await savePlanner();
    }
  }));
}
window.deletePublishedTeamPlan = async (id)=>{
  const plan=publishedTeamPlans.find(item=>item.id===id);
  if(!plan) return;
  if(!await askConfirm(`Apagar a escala publicada de ${fmtDate(plan.date)}? Nenhuma rodada salva será afetada.`)) return;
  publishedTeamPlans=publishedTeamPlans.filter(item=>item.id!==id);
  renderAll();
  await savePlanner();
  showToast('Escala publicada apagada.');
};
function renderSingleRoundItem(r, globalRec, cur, reigningNow, locked, secretSets){
  const agg = computeRoundAggregate(r);
  const awaitingStats = !!r.teamPlan && Object.values(r.entries||{}).every(e=>e.goals==='' && e.assists==='' && e.rating==='');
  const broken = computeRoundBrokenRecords(r, globalRec, secretSets);
  const latestClosed = months.length ? [...months].sort((a,b)=>b.endDate.localeCompare(a.endDate))[0] : null;
  const latestClosedKey = latestClosed ? computePeriodMonthKey(latestClosed.startDate,latestClosed.endDate) : '';
  const latestAwards = computeLastMonthAwardsData();
  const officialSpecial=latestClosedSpecialPatentSets();
  const latestAwardPlayerIds = new Set(['mvp','artilheiro','garcom'].flatMap(type=>latestAwards?.[type]?.playerIds||[latestAwards?.[type]?.playerId]).filter(Boolean));
  const hasCosmicRecord = broken.some(b=>b.cosmic);
  const hasPlatinumRecord = !hasCosmicRecord && broken.some(b=>b.platinum);
  const hasGoatRecord = !hasCosmicRecord && !hasPlatinumRecord && broken.some(b=>b.goat);
  const hasPrismaticRecord = !hasCosmicRecord && !hasPlatinumRecord && !hasGoatRecord && broken.some(b=>b.prismatic);
  const brokenHtml = renderCollapsibleBrokenRecords(broken, 'Recordes desta rodada');

  const disciplineAtRound = computeDisciplineStatus(r.id);
  const rowsData = Object.entries(r.entries||{})
    .filter(([pid,e])=> (e.goals!=='' ) || (e.assists!=='') || (e.rating!==''))
    .map(([pid,e])=>{
      const p = players.find(pp=>pp.id===pid);
      if(!p) return null;
      const g = Number(e.goals)||0, a = Number(e.assists)||0;
      const rating = (e.rating!=='' && e.rating!=null) ? Number(e.rating) : null;
      const score = (rating!==null?rating:0)*4 + g*5 + a*4.5;
      return {p, g, a, rating, score, simulatorStat:r.simulatorStats?.players?.[pid]||null};
    }).filter(Boolean);
  const absentRows = Object.entries(getRoundAbsences(r)).map(([pid, absence])=>{
    const p = players.find(pp=>pp.id===pid);
    const entry = (r.entries||{})[pid];
    const hasEntry = entry && (entry.goals!=='' || entry.assists!=='' || entry.rating!=='');
    if(!p || hasEntry) return null;
    return {
      p, g:0, a:0, rating:null, score:0,
      absence:true,
      justified:!!absence?.justified,
      card: disciplineAtRound[pid]?.suspendedRounds > 0 ? 'red' : 'yellow'
    };
  }).filter(Boolean);
  rowsData.push(...absentRows);
  rowsData.sort((x,y)=>{
    const modes = Array.isArray(roundPlayersSortMode) ? roundPlayersSortMode : [roundPlayersSortMode];
    for(const mode of modes){
      const val = (d)=>{
        switch(mode){
          case 'goals': return d.g;
          case 'assists': return d.a;
          case 'ga': return d.g+d.a;
          case 'score': return d.score;
          case 'rating': return d.rating!=null ? d.rating : 0;
          default: return playerSortValue(d.p, null, mode);
        }
      };
      const cmp = mode==='alpha' ? x.p.nickname.localeCompare(y.p.nickname, 'pt-BR') : val(x) - val(y);
      if(cmp) return roundPlayersSortDir==='desc' ? -cmp : cmp;
    }
    return x.p.nickname.localeCompare(y.p.nickname, 'pt-BR');
  });
  const roundPatentContext=createRankingPatentContext();
  const roundPlayerAvatar=p=>`<span class="${rankingPatentClass(p.id,roundPatentContext)}">${playerCircleMarkup(p,'round-result-photo',30)}</span>`;
  const rows = rowsData.map(d=>{
    if(d.absence){
      const absenceLabel = d.justified
        ? '📝 Falta justificada'
        : (d.card==='red' ? '🟥 Falta — cartão vermelho / suspensão' : '🟨 Falta — cartão amarelo');
      const absenceClass = d.justified ? '' : ` absence-${d.card}`;
      return `<div class="round-player-result${absenceClass}"><div class="mini-row"><span class="round-player-name">${roundPlayerAvatar(d.p)}<span>${d.p.nickname}</span></span><b>${absenceLabel}</b></div></div>`;
    }
    const rowBadges = [];
    if(cur){
      const leadsAllThreeNowRow = isCurrentGoat(cur,d.p.id);
      if(leadsAllThreeNowRow){
        rowBadges.push('🐐');
      } else {
        if(isCurrentLeader(cur,'mvp',d.p.id)) rowBadges.push('⭐');
        if(isCurrentLeader(cur,'artilheiro',d.p.id)) rowBadges.push('⚽');
        if(isCurrentLeader(cur,'garcom',d.p.id)) rowBadges.push('🎯');
      }
    }
    if(reigningNow){
      const rbRow = computeReigningBadgesFor(reigningNow, d.p.id);
      if(rbRow.isGoat){ if(!rowBadges.includes('🐐')) rowBadges.push('🐐'); }
      else rbRow.titles.forEach(()=> rowBadges.push('👑'));
    }
    const badgeHtml = renderEntryTitleBadges(rowBadges);
    const playerBroken = broken.filter(item=> item.playerId===d.p.id);
    const tier = playerBroken.some(item=>item.cosmic) ? 'cosmic' : (playerBroken.some(item=>item.platinum) ? 'platinum' : (playerBroken.some(item=>item.goat) ? 'goat' : (playerBroken.some(item=>item.prismatic) ? 'prismatic' : 'normal')));
    const hasCosmicPatent = officialSpecial.cosmic.has(d.p.id);
    const hasPlatinumPatent = !hasCosmicPatent && officialSpecial.collector.has(d.p.id);
    const playerReign = computeReigningBadgesFor(reigningNow,d.p.id);
    const patentClass = hasCosmicPatent ? ' patent-cosmic' : (hasPlatinumPatent ? ' patent-platinum' : (playerReign.isGoat ? ' patent-goat' : (playerReign.titles.length ? ' patent-gold' : '')));
    const playerBrokenHtml = renderCollapsibleBrokenRecords(playerBroken, 'Recordes deste jogador');
    const exactSimulatorHtml=d.simulatorStat
      ? `${d.simulatorStat.goals}G · ${d.simulatorStat.assists}A · ${d.simulatorStat.ownGoals}GC · ${d.simulatorStat.wins}V · ${d.simulatorStat.draws}E · ${d.simulatorStat.losses}D${d.rating!==null?' · nota '+d.rating:''}`
      : `${d.g}G · ${d.a}A${d.rating!==null?' · nota '+d.rating:''}`;
    return `<div class="round-player-result tier-${tier}${patentClass}"><div class="mini-row"><span class="round-player-name">${roundPlayerAvatar(d.p)}<span>${d.p.nickname}${badgeHtml}</span></span><b>${exactSimulatorHtml}</b></div>${playerBrokenHtml}</div>`;
  }).join('');
  const goalkeeperRows=Object.entries(r.simulatorStats?.goalkeepers||{}).filter(([,stat])=>(Number(stat.games)||0)>0).map(([playerId,stat])=>{const p=players.find(player=>player.id===playerId);if(!p)return '';return `<div class="round-player-result"><div class="mini-row"><span class="round-player-name">${roundPlayerAvatar(p)}<span>🧤 ${p.nickname}</span></span><b>${Number(stat.saves)||0} DEF · ${Number(stat.wins)||0}V · ${Number(stat.draws)||0}E · ${Number(stat.losses)||0}D · ${Number(stat.cleanSheets)||0} SG · ${Number(stat.goalsConceded)||0} GS · ${Number(stat.points||0).toFixed(1)} pts · nota ${Number(stat.average||4).toFixed(2)}</b></div></div>`}).join('');

  const roundHeaderIcon = hasCosmicRecord ? '🌌 ' : (hasPlatinumRecord ? '💠 ' : (hasGoatRecord ? '🐐 ' : (broken.length ? (hasPrismaticRecord ? '💎 ' : '🏆 ') : '')));
  const roundExtraClass = hasCosmicRecord ? ' has-cosmic' : (hasPlatinumRecord ? ' has-platinum' : (hasGoatRecord ? ' has-goat' : (broken.length ? (hasPrismaticRecord ? ' has-prismatic' : ' has-record') : '')));
  return `<details class="round-item${roundExtraClass}">
    <summary>
      <div><div class="round-title">${roundHeaderIcon}${r.label}</div><div class="round-date">${fmtDate(r.date)}</div></div>
      <div class="round-summary-actions">${renderBrokenRecordCountBadge(broken)}<button class="btn btn-ghost btn-sm" onclick="event.preventDefault(); event.stopPropagation(); shareRound('${r.id}')">Compartilhar</button><button class="btn btn-ghost btn-sm" onclick="event.preventDefault(); event.stopPropagation(); exportRoundForSimulator('${r.id}')">Importar no simulador</button>${(!locked && isAdmin) ? `<div style="display:flex;gap:6px;">
        <button class="btn btn-ghost btn-sm" onclick="event.preventDefault(); event.stopPropagation(); editRound('${r.id}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="event.preventDefault(); event.stopPropagation(); deleteRound('${r.id}')">Excluir</button>
      </div>` : ''}</div>
    </summary>
    <div class="round-body">
      ${locked ? `<div class="round-summary">🔒 Rodada de mês fechado — só dá pra editar/excluir reabrindo o mês na aba Mês.</div>` : ''}
      ${r.simulatorRoundId ? `<div class="round-summary">🎮 Dados exatos importados do simulador · ${Number(r.simulatorStats?.matches)||0} partida(s) · jogadores: G, A e GC · times: V, E, D e gols feitos/sofridos</div>` : ''}
      <div class="round-summary">⚽ ${agg.goals} gol(s) no total · 🅰️ ${agg.assists} assistência(s) no total</div>
      ${awaitingStats ? '<div class="round-summary">📋 Times publicados — aguardando lançamento de gols, assistências e notas.</div>' : ''}
      ${renderSavedRoundTeams(r)}
      ${brokenHtml}
      ${rows || (awaitingStats ? '' : '<span style="color:var(--chalk-dim);font-size:13px;">Ninguém registrado nesta rodada.</span>')}
      ${goalkeeperRows?`<div class="round-summary"><b>🧤 Estatísticas exatas dos goleiros</b></div>${goalkeeperRows}`:''}
    </div>
  </details>`;
}
function renderRoundsList(){
  renderRoundPlayersSortBar();
  const list = $('roundsList');
  if(!rounds.length){ list.innerHTML=''; return; }
  const globalRec = computeRecords();
  const cur = computeCurrentPeriodStats();
  const reigningNow = computeReigningTitles();
  const secretSets = computeSecretRecordSets();

  const roundsByMonthId = {};
  const freeRounds = [];
  rounds.forEach(r=>{
    const m = findClosedMonthForRound(r);
    if(m){
      if(!roundsByMonthId[m.id]) roundsByMonthId[m.id] = [];
      roundsByMonthId[m.id].push(r);
    } else {
      freeRounds.push(r);
    }
  });

  const freeHtml = [...freeRounds].sort((a,b)=> b.date.localeCompare(a.date))
    .map(r=> renderSingleRoundItem(r, globalRec, cur, reigningNow, false, secretSets)).join('');

  const monthGroups = Object.keys(roundsByMonthId).map(mid=> months.find(mm=>mm.id===mid)).filter(Boolean)
    .sort((a,b)=> b.startDate.localeCompare(a.startDate))
    .map(m=>{
      const mRounds = [...roundsByMonthId[m.id]].sort((a,b)=> b.date.localeCompare(a.date));
      const roundsHtml = mRounds.map(r=> renderSingleRoundItem(r, globalRec, cur, reigningNow, true, secretSets)).join('');
      const w = computeMonthWinners(m);
      const monthTotals = computeAllTotals(m.startDate, m.endDate);
      const isGoat = !!(w.mvp && w.artilheiro && w.garcom && w.mvp===w.artilheiro && w.artilheiro===w.garcom);
      const agg = buildMonthAggregate(monthTotals);
      const broken = computeMonthBrokenRecords(mRounds, globalRec, secretSets);
      const {cardClass, titleIcon} = buildMonthCardHeaderExtras(broken, isGoat, m);
      const aggregateNumClass=cardClass.includes('has-platinum')?'collector-number':'';
      return `<details class="round-item${cardClass}">
        <summary>
          <div><div class="round-title">${titleIcon}${m.label}</div><div class="round-date">${fmtDate(m.startDate)} até ${fmtDate(m.endDate)}</div></div>
          <div class="round-summary-actions">${renderBrokenRecordCountBadge(broken,isGoat)}</div>
        </summary>
        <div class="round-body">
          <div class="round-summary">🔒 Mês fechado — edição, exclusão e reabertura só na aba Mês.</div>
          ${buildMonthGoatBannerHtml(isGoat)}
          <div class="round-summary">⚽ <b class="${aggregateNumClass}">${agg.goals}</b> gol(s) no total · 🅰️ <b class="${aggregateNumClass}">${agg.assists}</b> assistência(s) no total · 📊 <b class="${aggregateNumClass}">${agg.score.toFixed(1)}</b> pts no total</div>
          ${renderCollapsibleBrokenRecords(broken, 'Recordes deste mês', isGoat)}
          ${buildMonthWinnerLine('mvp','⭐','MVP', w, monthTotals, broken)}
          ${buildMonthWinnerLine('artilheiro','⚽','Artilheiro', w, monthTotals, broken)}
          ${buildMonthWinnerLine('garcom','🎯','Garçom', w, monthTotals, broken)}
          <div class="table-title" style="font-size:13px;margin:14px 0 6px;">Rodadas deste mês (${mRounds.length})</div>
          ${roundsHtml}
        </div>
      </details>`;
    }).join('');

  list.innerHTML = freeHtml + monthGroups;
}
window.deleteRound = async (id)=>{
  const rr = rounds.find(x=>x.id===id);
  if(rr && findClosedMonthForRound(rr)){ showToast('Essa rodada pertence a um mês fechado. Reabra o mês na aba Mês pra poder excluí-la.'); return; }
  const ok = await askConfirm('Excluir esta rodada? Essa ação não pode ser desfeita. Se ela sustentava algum troféu automático, o troféu pode sumir sozinho.');
  if(!ok) return;
  rounds = rounds.filter(r=>r.id!==id);
  if(editingRoundId===id) exitRoundEditMode();
  await saveRounds();
  renderAll();
  showToast('Rodada excluída.');
};
