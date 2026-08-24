const firebaseConfig = {
  apiKey: "AIzaSyDkUQRBzkjYtdQbx9UOa7qxbLX1k1fpt80",
  authDomain: "racha-manager-9969d.firebaseapp.com",
  projectId: "racha-manager-9969d",
  storageBucket: "racha-manager-9969d.firebasestorage.app",
  messagingSenderId: "509752435125",
  appId: "1:509752435125:web:6708fe47697794c8f839fc"
};

const SUPABASE_URL = "https://moesysxjujftdhetmmfe.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5o5dCQDn-45tUMPD9k4YQQ_OjjBU0aB";
const SUPABASE_MEDIA_BUCKET = "racha-media";

function supabaseMediaPathFromUrl(url){
  const src=String(url||'').trim();
  if(!src || !/^https?:\/\//i.test(src)) return '';
  try{
    const u=new URL(src);
    if(u.origin!==new URL(SUPABASE_URL).origin) return '';
    const marker=`/storage/v1/object/public/${SUPABASE_MEDIA_BUCKET}/`;
    const index=u.pathname.indexOf(marker);
    if(index<0) return '';
    return u.pathname.slice(index+marker.length).split('/').map(part=>decodeURIComponent(part)).join('/');
  }catch(_){ return ''; }
}
function normalizeSupabaseMediaPath(pathOrUrl){
  let path=String(pathOrUrl||'').trim();
  if(!path) return '';
  if(/^https?:\/\//i.test(path)) path=supabaseMediaPathFromUrl(path);
  path=path.replace(/^\/+/, '');
  if(!path || path.includes('..') || path.includes('\\')) return '';
  if(!/^(rachas\/[^/]+\/(players|backgrounds|music)|players|backgrounds|music)\//.test(path)) return '';
  return path;
}
async function deleteSupabaseMediaObject(pathOrUrl){
  const path=normalizeSupabaseMediaPath(pathOrUrl);
  if(!path) return false;
  const endpoint=`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(SUPABASE_MEDIA_BUCKET)}`;
  const response=await fetch(endpoint,{
    method:'DELETE',
    headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({prefixes:[path]})
  });
  if(response.ok || response.status===404) return true;
  let detail='';
  try{detail=await response.text()}catch(_){}
  throw new Error(`Supabase recusou a exclusão (${response.status}${detail?`: ${detail}`:''}).`);
}
async function deleteSupabaseMediaObjectBestEffort(pathOrUrl,label='arquivo antigo'){
  const path=normalizeSupabaseMediaPath(pathOrUrl);
  if(!path) return false;
  try{return await deleteSupabaseMediaObject(path)}
  catch(error){console.warn(`Não foi possível apagar ${label} do Supabase:`,error);return false}
}
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);
const storage = getStorage(fbApp);
let dataDocRef = null;
let activeRachaId = '';
let activeRachaName = '';
let activeRachaRole = '';
function roleLabel(role){return ({owner:'Proprietário',organizer:'Organizador',assistant:'Auxiliar',player:'Jogador'})[role]||'Sem acesso'}
const firestorePersistenceReady=db.enablePersistence({synchronizeTabs:true}).catch(error=>{
  if(!['failed-precondition','unimplemented'].includes(String(error?.code||'')))console.warn('Cache local indisponível:',error);
});

let players = [];
let teamPlanner = { teamCount:4, playersPerTeam:4, balanceMode:'overall', slots:[] };
let publishedTeamPlans = [];
let playerAttributePresetVersion = 0;
let playerCardHeight = 440;
let playerCardBottomShadowReach = 28;
let playerCardOvrShadowReach = 100;
let playerCardOvrShadowWidth = 80;
let monthClosedCardHeight = 340;
let monthClosedCardWidth = 900;
let monthClosedPhotoWidth = 300;
let monthClosedContentOffset = 78;
let monthClosedShadow = 86;
const DEFAULT_MONTH_CLOSED_APPEARANCE = {height:340,width:900,photoWidth:300,contentOffset:78,shadow:86};
let savedMonthClosedAppearance = {...DEFAULT_MONTH_CLOSED_APPEARANCE};
let savedPlayerCardAppearance = {height:440,bottomShadowReach:28,ovrShadowReach:100,ovrShadowWidth:80};
let savedCardPhotoPreset = null;
let savedMonthPhotoPreset = null;
let savedBonusRulesPreset = null;
const CARD_PHOTO_PRESET_FIELDS = ['photoAdjustZoom','photoAdjustX','photoAdjustY','photoAdjustHeight','photoAdjustFadeStart','photoAdjustFadeEnd','photoAdjustDropShadow'];
const MONTH_PHOTO_PRESET_FIELDS = ['monthPhotoAdjustZoom','monthPhotoAdjustX','monthPhotoAdjustY','monthPhotoAdjustHeight','monthPhotoAdjustFadeStart','monthPhotoAdjustFadeEnd','monthPhotoAdjustDropShadow','monthPhotoAdjustShadow'];
const DEFAULT_BONUS_RULES = {
  cosmic:19,
  prismaticSolo:4,
  regularMvpAll:8,
  regularArtMain:6, regularArtSecondary:4,
  regularGarMain:6, regularGarSecondary:4,
  regularMvpArtAll:8, regularMvpArtMain:5, regularMvpArtSecondary:2,
  regularMvpGarAll:8, regularMvpGarMain:5, regularMvpGarSecondary:2,
  regularArtGarMain:5, regularArtGarSecondary:2,
  prismaticMvpAll:8,
  prismaticArtMain:6, prismaticArtSecondary:5,
  prismaticGarMain:6, prismaticGarSecondary:5,
  prismaticMvpArtAll:11, prismaticMvpArtMain:1, prismaticMvpArtSecondary:0,
  prismaticMvpGarAll:11, prismaticMvpGarMain:1, prismaticMvpGarSecondary:0,
  prismaticArtGarMain:9, prismaticArtGarSecondary:8,
  prismaticMvpArtGarAll:17,
  goatAll:15, prismaticGoatAll:17,
  collectorSoloAll:8,
  collectorMvpAll:12,
  collectorArtAll:9, collectorArtMain:2, collectorArtSecondary:1,
  collectorGarAll:9, collectorGarMain:2, collectorGarSecondary:1,
  collectorMvpArtAll:12, collectorMvpArtMain:2,
  collectorMvpGarAll:12, collectorMvpGarMain:2,
  collectorArtGarAll:9, collectorArtGarMain:4,
  collectorMvpArtGarAll:16,
  collectorGoatAll:17,
  prismaticCollectorSoloAll:10,
  prismaticCollectorMvpAll:12,
  prismaticCollectorArtAll:9, prismaticCollectorArtMain:2, prismaticCollectorArtSecondary:1,
  prismaticCollectorGarAll:9, prismaticCollectorGarMain:2, prismaticCollectorGarSecondary:1,
  prismaticCollectorMvpArtAll:12, prismaticCollectorMvpArtMain:2,
  prismaticCollectorMvpGarAll:12, prismaticCollectorMvpGarMain:2,
  prismaticCollectorArtGarAll:9, prismaticCollectorArtGarMain:4,
  prismaticCollectorMvpArtGarAll:18,
  prismaticCollectorGoatAll:19,
  currentMvpAll:5,
  currentArtMain:3, currentArtSecondary:2,
  currentGarMain:3, currentGarSecondary:2,
  currentMvpArtAll:7, currentMvpArtMain:1, currentMvpArtSecondary:0,
  currentMvpGarAll:7, currentMvpGarMain:1, currentMvpGarSecondary:0,
  currentArtGarMain:5, currentArtGarSecondary:4,
  currentGoatAll:12,
};

const PODIUM_MEDALS=['gold','silver','bronze'];
const PODIUM_TYPES=['mvp','artilheiro','garcom'];
const PODIUM_MEDAL_LABEL={gold:'Ouro',silver:'Prata',bronze:'Bronze'};
const PODIUM_TYPE_LABEL={mvp:'MVP',artilheiro:'Artilheiro',garcom:'Garçom'};
const PODIUM_BASE_BONUS_CLOSED={
  gold:{mvp:6,artMain:4,artSecondary:3,garMain:4,garSecondary:3},
  silver:{mvp:4,artMain:3,artSecondary:2,garMain:3,garSecondary:2},
  bronze:{mvp:2,artMain:2,artSecondary:1,garMain:2,garSecondary:1},
};
const PODIUM_BASE_BONUS_CURRENT={
  gold:{mvp:5,artMain:3,artSecondary:2,garMain:3,garSecondary:2},
  silver:{mvp:3,artMain:2,artSecondary:1,garMain:2,garSecondary:1},
  bronze:{mvp:1,artMain:1,artSecondary:0,garMain:1,garSecondary:0},
};
const PODIUM_REGULAR_CAP=12;
const SPECIAL_BONUS_CAP=20;
function isGoldPodiumGoatCombo(combo){
  return !!combo && combo.mvp==='gold' && combo.artilheiro==='gold' && combo.garcom==='gold';
}
function computePodiumComboBoost(combo,scope='closed'){
  const out={chute:0,passe:0,contato:0,drible:0,marcacao:0,velocidade:0};
  if(!combo) return out;
  if(isGoldPodiumGoatCombo(combo)){
    const value=scope==='current'?12:15;
    PLAYER_ATTRIBUTE_KEYS.forEach(k=>out[k]=value);
    return out;
  }
  if(scope==='current'){
    if(combo.mvp){
      const rule=PODIUM_BASE_BONUS_CURRENT[combo.mvp];
      addPlayerBoost(out,PLAYER_ATTRIBUTE_KEYS,rule.mvp);
    }
    if(combo.artilheiro){
      const rule=PODIUM_BASE_BONUS_CURRENT[combo.artilheiro];
      addPlayerBoost(out,['chute','velocidade'],rule.artMain);
      addPlayerBoostExcept(out,['chute','velocidade'],rule.artSecondary);
    }
    if(combo.garcom){
      const rule=PODIUM_BASE_BONUS_CURRENT[combo.garcom];
      addPlayerBoost(out,['passe','drible'],rule.garMain);
      addPlayerBoostExcept(out,['passe','drible'],rule.garSecondary);
    }
    PLAYER_ATTRIBUTE_KEYS.forEach(k=>out[k]=Math.min(PODIUM_REGULAR_CAP,out[k]));
    return out;
  }
  const fields=podiumComboRuleFields(scope,combo);
  fields.forEach(([key,label])=>{
    const value=bonusRule(key);
    if(label==='Todos') addPlayerBoost(out,PLAYER_ATTRIBUTE_KEYS,value);
    else if(label==='FIN / VEL') addPlayerBoost(out,['chute','velocidade'],value);
    else if(label==='PAS / DRI') addPlayerBoost(out,['passe','drible'],value);
    else if(label==='FIN / VEL / PAS / DRI') addPlayerBoost(out,['chute','velocidade','passe','drible'],value);
    else if(label==='DEF / FÍS' || label==='DEF / FÃS') addPlayerBoost(out,['marcacao','contato'],value);
    else if(label==='Demais'){
      const main=combo.artilheiro?['chute','velocidade']:['passe','drible'];
      addPlayerBoostExcept(out,main,value);
    }
  });
  PLAYER_ATTRIBUTE_KEYS.forEach(k=>out[k]=Math.min(PODIUM_REGULAR_CAP,out[k]));
  return out;
}

function podiumComboKey(scope,combo){ return scope+'Podium_'+PODIUM_TYPES.map(t=>combo[t]||'none').join('_'); }
function podiumComboLabel(combo){ return PODIUM_TYPES.filter(t=>combo[t]).map(t=>PODIUM_TYPE_LABEL[t]+' '+PODIUM_MEDAL_LABEL[combo[t]]).join(' + '); }
function allPodiumCombos(){
  const opts=[null,...PODIUM_MEDALS], out=[];
  opts.forEach(mvp=>opts.forEach(artilheiro=>opts.forEach(garcom=>{
    if(!mvp&&!artilheiro&&!garcom) return;
    out.push({mvp,artilheiro,garcom});
  })));
  return out;
}
function podiumComboRuleFields(scope,combo){
  const base=podiumComboKey(scope,combo);
  const hasMvp=!!combo.mvp, hasArt=!!combo.artilheiro, hasGar=!!combo.garcom;
  if(hasMvp && hasArt && hasGar) return [[base+'All','Todos']];
  if(hasMvp && hasArt) return [[base+'All','Todos'],[base+'ArtMain','FIN / VEL']];
  if(hasMvp && hasGar) return [[base+'All','Todos'],[base+'GarMain','PAS / DRI']];
  if(hasArt && hasGar) return [[base+'Main','FIN / VEL / PAS / DRI'],[base+'Secondary','DEF / FÍS']];
  if(hasMvp) return [[base+'All','Todos']];
  if(hasArt) return [[base+'Main','FIN / VEL'],[base+'Secondary','Demais']];
  return [[base+'Main','PAS / DRI'],[base+'Secondary','Demais']];
}
allPodiumCombos().forEach(combo=>{
  const medals=PODIUM_TYPES.map(t=>combo[t]).filter(Boolean);
  const medalValue=medals.reduce((sum,m)=>sum+(m==='gold'?5:m==='silver'?3:2),0);
  ['closed','current'].forEach(scope=>{
    const value=scope==='current'?Math.max(1,medalValue-1):medalValue;
    podiumComboRuleFields(scope,combo).forEach(([key,label])=>{
      DEFAULT_BONUS_RULES[key]=label==='Todos'?value:Math.max(1,Math.round(value*.65));
    });
  });
});

let bonusRules = {...DEFAULT_BONUS_RULES};
function bonusRule(key){ return Math.max(0, Number(bonusRules[key] ?? DEFAULT_BONUS_RULES[key]) || 0); }
const PLAYER_ATTRIBUTE_KEYS = ['velocidade','drible','chute','marcacao','passe','contato'];
const PLAYER_ATTRIBUTE_WEIGHTS = { chute:4, passe:4, drible:4, velocidade:3, marcacao:3, contato:2 };
const GOALKEEPER_ATTRIBUTE_KEYS = ['reflexo','posicionamentoGol','umContraUm','jogoAereo','reposicao','saidaGol'];
const GOALKEEPER_ATTRIBUTE_WEIGHTS = {reflexo:4,posicionamentoGol:4,umContraUm:4,jogoAereo:3,reposicao:2,saidaGol:3};
function normalizePlayer(player){
  if(player&&player.photo)player.photo=cacheBustRemoteUrl(player.photo,player.photoVersion);
  PLAYER_ATTRIBUTE_KEYS.forEach(key=> player[key] = Math.max(0, Math.min(99, Math.round(Number(player[key])||0))));
  GOALKEEPER_ATTRIBUTE_KEYS.forEach(key=> player[key] = Math.max(0, Math.min(99, Math.round(Number(player[key])||0))));
  const normalizedRole=String(player.role||player.tipo||player.type||'').trim().toLowerCase();
  player.role = ['child','crianca','criança','kid'].includes(normalizedRole) || player.isChild===true || player.child===true ? 'child' : (['goalkeeper','goleiro','keeper'].includes(normalizedRole)?'goalkeeper':(['hybrid','hibrido','híbrido'].includes(normalizedRole)?'hybrid':'normal'));
  player.isCaptain = !!player.isCaptain;
  return player;
}
function addPlayerBoost(boost, keys, amount){ keys.forEach(key=>boost[key]+=amount); }
function addPlayerBoostExcept(boost, excludedKeys, amount){
  addPlayerBoost(boost, PLAYER_ATTRIBUTE_KEYS.filter(key=>!excludedKeys.includes(key)), amount);
}
function getPlayerBoosts(playerId){
  const boost={chute:0,passe:0,contato:0,drible:0,marcacao:0,velocidade:0};
  const all=[...PLAYER_ATTRIBUTE_KEYS];
  const officialSpecial=latestClosedSpecialPatentSets();
  const currentPodiumCombo=playerPodiumCombo(currentPodiums(),playerId);
  const currentPodiumBoost=computePodiumComboBoost(currentPodiumCombo,'current');
  const latestClosed=months.length ? [...months].sort((a,b)=>b.endDate.localeCompare(a.endDate))[0] : null;
  const latestKey=latestClosed ? computePeriodMonthKey(latestClosed.startDate,latestClosed.endDate) : '';
  if(officialSpecial.cosmic.has(playerId)){
    addPlayerBoost(boost,all,bonusRule('cosmic'));
    PLAYER_ATTRIBUTE_KEYS.forEach(key=>boost[key]=Math.min(20,boost[key]+currentPodiumBoost[key]));
    return {...boost,isContender:false,isContenderGoat:false};
  }

  const reigning=computeReigningTitles();
  const reigningMvp=(reigning?.mvp?.playerIds||[reigning?.mvp?.playerId]).includes(playerId);
  const reigningArt=(reigning?.artilheiro?.playerIds||[reigning?.artilheiro?.playerId]).includes(playerId);
  const reigningGar=(reigning?.garcom?.playerIds||[reigning?.garcom?.playerId]).includes(playerId);
  const isCollector=officialSpecial.collector.has(playerId);
  const isPrismatic=hasReigningPrismaticPerformance(playerId);
  const closedPodiumCombo=playerPodiumCombo(latestClosedPodiums(),playerId);
  const isOfficialGoat=!!((reigning?.isGoat && reigning.goatPlayerId===playerId) || isGoldPodiumGoatCombo(closedPodiumCombo));
  const closedMedals=PODIUM_TYPES.map(type=>closedPodiumCombo?.[type]).filter(Boolean);
  const patentCap=isCollector ? 20
    : isOfficialGoat ? 19
    : isPrismatic ? 18
    : closedMedals.includes('gold') ? 17
    : closedMedals.includes('silver') ? 16
    : 12;

  const applyMainSecondary=(mainKeys, mainRule, secondaryRule)=>{
    addPlayerBoost(boost,mainKeys,bonusRule(mainRule));
    addPlayerBoostExcept(boost,mainKeys,bonusRule(secondaryRule));
  };

  const hasClosedPodium=closedPodiumCombo && PODIUM_TYPES.some(type=>!!closedPodiumCombo[type]);
  const closedBase=hasClosedPodium ? computePodiumComboBoost(closedPodiumCombo,'closed') : null;

  if(isOfficialGoat){
    let value=15;
    if(isPrismatic) value+=2;
    if(isCollector) value+=4;
    value=Math.min(SPECIAL_BONUS_CAP,value);
    addPlayerBoost(boost,all,value);
  } else if(isCollector || isPrismatic){
    PLAYER_ATTRIBUTE_KEYS.forEach(key=>{
      let value=closedBase ? closedBase[key] : 0;
      const hasOtherForCollector = !!(hasClosedPodium || isPrismatic);
      const hasOtherForPrismatic = !!(hasClosedPodium || isCollector);

      if(isCollector){
        if(hasOtherForCollector) value=Math.max(value + 4, 8);
        else value=Math.max(value,8);
      }
      if(isPrismatic){
        if(hasOtherForPrismatic) value=Math.max(value + 2, 4);
        else value=Math.max(value,4);
      }
      boost[key]=Math.min(SPECIAL_BONUS_CAP,value);
    });
  } else if(hasClosedPodium){
    PLAYER_ATTRIBUTE_KEYS.forEach(key=>boost[key]=closedBase[key]);
  }

  if(isOfficialGoat || isCollector || isPrismatic){
    PLAYER_ATTRIBUTE_KEYS.forEach(key=>boost[key]+=currentPodiumBoost[key]);
  }

  const current=computeCurrentPeriodStats();
  const isContenderGoat=isCurrentGoat(current,playerId);
  const isContender=!!(isContenderGoat || ['mvp','artilheiro','garcom'].some(type=>isCurrentLeader(current,type,playerId)));

  if(!isOfficialGoat && !isCollector && !isPrismatic){
    PLAYER_ATTRIBUTE_KEYS.forEach(key=>boost[key]+=currentPodiumBoost[key]);
  }
  const currentMedals=PODIUM_TYPES.map(type=>currentPodiumCombo[type]).filter(Boolean);
  const podiumMedal=currentMedals.includes('gold')?'gold':currentMedals.includes('silver')?'silver':currentMedals.includes('bronze')?'bronze':null;
  PLAYER_ATTRIBUTE_KEYS.forEach(key=>boost[key]=Math.min(patentCap,boost[key]));
  return {...boost,isContender:isContender||!!podiumMedal,isContenderGoat,podiumMedal};
}
function effectivePlayerAttributes(player){
  normalizePlayer(player);
  const boost=getPlayerBoosts(player.id);
  const attrs={};
  PLAYER_ATTRIBUTE_KEYS.forEach(key=>attrs[key]=Math.min(99,player[key]+boost[key]));
  return {...attrs,isContender:boost.isContender,isContenderGoat:boost.isContenderGoat,podiumMedal:boost.podiumMedal};
}
function formatOverall(value){ return String(Math.round(Number(value)||0)); }
function weightedPlayerAttributeAverage(player,keys,weights){const totalWeight=keys.reduce((sum,key)=>sum+weights[key],0);return keys.reduce((sum,key)=>sum+(Number(player[key])||0)*weights[key],0)/totalWeight}
function effectiveGoalkeeperAttributes(player){normalizePlayer(player);const boost=typeof getGoalkeeperBoosts==='function'?getGoalkeeperBoosts(player.id):Object.fromEntries(GOALKEEPER_ATTRIBUTE_KEYS.map(key=>[key,0]));const attrs={};GOALKEEPER_ATTRIBUTE_KEYS.forEach(key=>attrs[key]=Math.min(99,(Number(player[key])||0)+(Number(boost[key])||0)));return attrs}
function goalkeeperOverall(player){return weightedPlayerAttributeAverage(effectiveGoalkeeperAttributes(player),GOALKEEPER_ATTRIBUTE_KEYS,GOALKEEPER_ATTRIBUTE_WEIGHTS)}
function playerOverall(player){
  const attrs=effectivePlayerAttributes(player);
  const lineOverall=weightedPlayerAttributeAverage(attrs,PLAYER_ATTRIBUTE_KEYS,PLAYER_ATTRIBUTE_WEIGHTS),goalkeeperOverall=weightedPlayerAttributeAverage(effectiveGoalkeeperAttributes(player),GOALKEEPER_ATTRIBUTE_KEYS,GOALKEEPER_ATTRIBUTE_WEIGHTS);
  return player.role==='goalkeeper'?goalkeeperOverall:lineOverall;
}
function basePlayerOverall(player){
  normalizePlayer(player);
  const lineOverall=weightedPlayerAttributeAverage(player,PLAYER_ATTRIBUTE_KEYS,PLAYER_ATTRIBUTE_WEIGHTS),goalkeeperOverall=weightedPlayerAttributeAverage(player,GOALKEEPER_ATTRIBUTE_KEYS,GOALKEEPER_ATTRIBUTE_WEIGHTS);
  return player.role==='goalkeeper'?goalkeeperOverall:lineOverall;
}
const PLAYER_ATTRIBUTE_PRESETS = {
  guilherme:{velocidade:90,drible:90,chute:91,marcacao:86,passe:88,contato:74},
  lincoln:{velocidade:90,drible:70,chute:91,marcacao:90,passe:85,contato:86},
  jonasb:{velocidade:91,drible:80,chute:85,marcacao:86,passe:80,contato:78},
  pedrim:{velocidade:85,drible:85,chute:79,marcacao:70,passe:87,contato:79},
  henrique:{velocidade:89,drible:86,chute:81,marcacao:65,passe:72,contato:70},
  caio:{velocidade:90,drible:60,chute:90,marcacao:76,passe:70,contato:70},
  mkevyn:{velocidade:90,drible:85,chute:80,marcacao:50,passe:81,contato:70},
  samuel:{velocidade:89,drible:86,chute:70,marcacao:70,passe:71,contato:69},
  gabigol:{velocidade:80,drible:50,chute:65,marcacao:70,passe:80,contato:70},
  adicelino:{velocidade:75,drible:50,chute:70,marcacao:70,passe:70,contato:70},
  jose:{velocidade:83,drible:75,chute:80,marcacao:60,passe:80,contato:26},
  ruan:{velocidade:85,drible:56,chute:45,marcacao:80,passe:60,contato:70},
  neguim:{velocidade:80,drible:50,chute:72,marcacao:40,passe:70,contato:30},
};
function playerPresetKey(player){
  return String(player.nickname||player.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
}
function applyPlayerAttributePresets(){
  if(playerAttributePresetVersion >= 1) return false;
  let changed=false;
  players.forEach(player=>{
    const preset=PLAYER_ATTRIBUTE_PRESETS[playerPresetKey(player)];
    if(!preset) return;
    Object.assign(player,preset); normalizePlayer(player); changed=true;
  });
  playerAttributePresetVersion=1;
  return changed;
}
function normalizeTeamPlanner(value){
  const source = value && typeof value==='object' ? value : {};
  const slots = Array.isArray(source.slots) ? source.slots.map((slot,index)=>({
    id: slot.id || uid(), label: String(slot.label || `Horário ${index+1}`),
    attendance: Array.isArray(slot.attendance) ? slot.attendance : [],
    goalkeepers: Array.isArray(slot.goalkeepers) ? slot.goalkeepers : [],
    goalkeeperSides: slot.goalkeeperSides&&typeof slot.goalkeeperSides==='object' ? {a:Array.isArray(slot.goalkeeperSides.a)?slot.goalkeeperSides.a:[],b:Array.isArray(slot.goalkeeperSides.b)?slot.goalkeeperSides.b:[]} : {a:[],b:[]},
    captains: Array.isArray(slot.captains) ? slot.captains : [],
    teams: Array.isArray(slot.teams) ? slot.teams.map(team=>Array.isArray(team)?team:(Array.isArray(team?.members)?team.members:[])) : [],
    reserves: Array.isArray(slot.reserves) ? slot.reserves : [],
    substitutePools: Array.isArray(slot.substitutePools) ? slot.substitutePools.map(pool=>Array.isArray(pool)?pool:(Array.isArray(pool?.items)?pool.items:[])) : [],
    listedPlayers: Array.isArray(slot.listedPlayers) ? slot.listedPlayers : [],
    justifiedAbsences: Array.isArray(slot.justifiedAbsences) ? slot.justifiedAbsences : [],
  })) : [];
  return { teamCount:Math.max(2,Math.min(12,Number(source.teamCount)||4)), playersPerTeam:Math.max(1,Math.min(20,Number(source.playersPerTeam)||4)), balanceMode:['stars','manualOvr'].includes(source.balanceMode)?source.balanceMode:'overall', slots };
}
function firebaseSafeTeamPlanner(value){
  const plan=normalizeTeamPlanner(value);
  return firestoreSafe({...plan,slots:plan.slots.map(slot=>({...slot,
    teams:(slot.teams||[]).map((members,index)=>({index,members:[...members]})),
    substitutePools:(slot.substitutePools||[]).map((items,teamIndex)=>({teamIndex,items:firestoreSafe(items)})),
  }))});
}
function normalizePublishedTeamPlans(value){
  return Array.isArray(value)?value.map(item=>({...item,teamPlan:normalizeTeamPlanner(item?.teamPlan)})):[];
}
function firebaseSafePublishedTeamPlans(value){
  return normalizePublishedTeamPlans(value).map(item=>firestoreSafe({...item,teamPlan:firebaseSafeTeamPlanner(item.teamPlan)}));
}
function ensureTeamSlots(count){
  const previous = teamPlanner.slots || [];
  const defaults = ['08:00 às 09:30','09:30 às 11:00'];
  teamPlanner.slots = Array.from({length:count},(_,index)=> previous[index] || ({
    id:uid(), label:defaults[index] || `Horário ${index+1}`, attendance:[], captains:[], teams:[], reserves:[], substitutePools:[],
  }));
}
let rounds = [];
let round1PhotoSeedVersion = 0;
let periodStart = null;
let months = [];
let manualTrophyAdjustments = {};
let monthStartDay = 1;
let musicLibrary = [];
let musicPlaylists = [];
let activeMusicPlaylistId = null;
let musicSettings = { musicVolume:70, musicMuted:false, effectsVolume:70, effectsMuted:false, playMode:'ordered', loop:true, autoStart:true, randomStart:true };
let currentMusicId = null;
const musicAudio = new Audio();
let selectedMusicFile = null;
let musicRelinkId = null;
const musicObjectUrls = new Map();
let pendingMusicAutoStart = false;
let isAdmin = false;
let organizerEmail = '';
let appDataLoaded = false;
let loadedRarityBackgrounds = {};
let round2NeedsCloudRecovery = false;
let lastPlayerPhotoSavedLocally = false;

const $ = (id) => document.getElementById(id);

