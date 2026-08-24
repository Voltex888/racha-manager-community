(function(){
  'use strict';

  const uniq = values => [...new Set((values || []).filter(Boolean))];

  function currentChecked(slotId){
    return uniq(
      [...document.querySelectorAll('input[data-attendance]')]
        .filter(input => String(input.dataset.attendance) === String(slotId) && input.checked)
        .map(input => input.value)
    );
  }

  function cleanPools(pools, allowed){
    if(!Array.isArray(pools)) return [];
    return pools.map(pool => Array.isArray(pool)
      ? pool.filter(item => allowed.has(item && typeof item === 'object' ? item.id : item))
      : []
    );
  }

  function syncSlot(slot){
    if(!slot || !slot.id) return;

    const attendance = currentChecked(slot.id);
    const allowed = new Set(attendance);
    const justified = uniq(slot.justifiedAbsences || []).filter(id => !allowed.has(id));

    slot.attendance = attendance;
    slot.justifiedAbsences = justified;

    slot.listedPlayers = uniq([...attendance, ...justified]);

    slot.captains = uniq(slot.captains || []).filter(id => allowed.has(id));

    if(Array.isArray(slot.teams)){
      slot.teams = slot.teams.map(team => uniq(team || []).filter(id => allowed.has(id)));
    }

    slot.reserves = uniq(slot.reserves || []).filter(id => allowed.has(id));
    slot.substitutePools = cleanPools(slot.substitutePools, allowed);
  }

  function syncAll(){
    if(typeof teamPlanner === 'undefined' || !teamPlanner || !Array.isArray(teamPlanner.slots)) return;
    teamPlanner.slots.forEach(syncSlot);
  }

  document.addEventListener('change', event => {
    const input = event.target;
    if(!(input instanceof HTMLInputElement) || !input.matches('input[data-attendance]')) return;
    if(typeof editingRoundId !== 'undefined' && editingRoundId) return;
    if(typeof teamPlanner === 'undefined' || !teamPlanner || !Array.isArray(teamPlanner.slots)) return;

    const slot = teamPlanner.slots.find(item => String(item.id) === String(input.dataset.attendance));
    if(!slot) return;

    if(!input.checked){
      if(Array.isArray(slot.justifiedAbsences)){
        slot.justifiedAbsences = slot.justifiedAbsences.filter(id => id !== input.value);
      }
    }

    syncSlot(slot);
  }, true);

  document.addEventListener('click', event => {
    const btn = event.target && event.target.closest
      ? event.target.closest('#btnPublishAttendance, #btnPublishTeamDraw, #btnSaveTeamPlanner, #btnSaveRound')
      : null;
    if(!btn) return;
    if(typeof editingRoundId !== 'undefined' && editingRoundId) return;

    syncAll();
  }, true);
})();
