const STORAGE_KEY = 'mahjong_tracker_data_v2';

let match = {
  roundInfo: ["동", "남", "서"], roundIdx: 0, kyoku: 1, honba: 0, kyotaku: 0, oya: 0,
  players: [
    { id: 0, score: 25000, name: "동", isRiichi: false },
    { id: 1, score: 25000, name: "남", isRiichi: false },
    { id: 2, score: 25000, name: "서", isRiichi: false },
    { id: 3, score: 25000, name: "북", isRiichi: false }
  ]
};

let gameHistory = []; 
let winType = 'RON'; 
let winners = []; 
let loserId = null;
let drawType = 'NORMAL'; 
let tenpaiList = []; 
let confirmActionCallback = null;
let inputMode = 'MANUAL'; 

let builders = {};
let activeWIdForKeyboard = null; 
let pendingBlockType = null;

const tileList = [
  '1만','2만','3만','4만','5만','6만','7만','8만','9만',
  '1통','2통','3통','4통','5통','6통','7통','8통','9통',
  '1삭','2삭','3삭','4삭','5삭','6삭','7삭','8삭','9삭',
  '동','남','서','북','백','발','중'
];

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message; toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}
function showConfirm(message, callback) {
  document.getElementById("confirm-msg").innerText = message;
  confirmActionCallback = callback;
  document.getElementById("customConfirmModal").style.display = 'flex';
}
function closeCustomConfirm() {
  document.getElementById("customConfirmModal").style.display = 'none';
  confirmActionCallback = null;
}
document.getElementById("confirm-yes-btn").onclick = () => {
  if (confirmActionCallback) confirmActionCallback();
  closeCustomConfirm();
};

function updateUI() {
  document.getElementById('round-info').innerText = `${match.roundInfo[match.roundIdx]} ${match.kyoku}국`;
  document.getElementById('honba-ui').innerText = match.honba;
  document.getElementById('kyotaku-ui').innerText = match.kyotaku;
  for(let i=0; i<4; i++) {
    document.getElementById(`score-${i}`).innerText = match.players[i].score;
    const playerDiv = document.getElementById(`player-${i}`);
    playerDiv.classList.remove('is-oya', 'is-riichi');
    if(match.oya === i) playerDiv.classList.add('is-oya');
    if(match.players[i].isRiichi) playerDiv.classList.add('is-riichi');
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ match, gameHistory }));
}

function startNewGame() {
  showConfirm("정말 새 게임을 시작하시겠습니까?\n현재 진행 중인 모든 데이터가 영구히 삭제됩니다.", () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload(); 
  });
}

function toggleRiichi(id) {
  const p = match.players[id];
  if (!p.isRiichi) {
    if (p.score < 1000) return showToast("점수 부족");
    p.score -= 1000; match.kyotaku += 1; p.isRiichi = true;
  } else {
    p.score += 1000; match.kyotaku -= 1; p.isRiichi = false;
  }
  updateUI();
}
function resetRiichiFlags() { match.players.forEach(p => p.isRiichi = false); }

function initBlockKeyboard() {
  const container = document.getElementById('tile-keyboard-container');
  const groups = [
    { cls: 'man', label: '만', count: 9 },
    { cls: 'pin', label: '통', count: 9 },
    { cls: 'sou', label: '삭', count: 9 },
    { cls: 'jihai', labels: ['동','남','서','북','백','발','중'] }
  ];
  let html = `<div class="keyboard-title" id="keyboard-instruction">패를 선택하세요</div>`;
  groups.forEach(g => {
    html += `<div class="tile-keyboard-row">`;
    if (g.count) {
      for(let i=1; i<=g.count; i++) html += `<button class="tile-key ${g.cls}" onclick="addBlockFromKey('${i}${g.label}')">${i}${g.label}</button>`;
    } else {
      g.labels.forEach(l => html += `<button class="tile-key jihai" onclick="addBlockFromKey('${l}')">${l}</button>`);
    }
    html += `</div>`;
  });
  container.innerHTML = html;
}

function initBuildersForWinners() {
  winners.forEach(wId => {
    if (!builders[wId]) {
      builders[wId] = { blocks: [], blockIdCounter: 0, winningBlockId: null, winningTileIdx: null };
    }
  });
  Object.keys(builders).forEach(key => {
    if (!winners.includes(parseInt(key))) delete builders[key];
  });
}

function openKeyboard(wId, type) {
  if (builders[wId].blocks.length >= 7) return showToast("더 이상 추가할 수 없습니다.");
  activeWIdForKeyboard = wId; pendingBlockType = type;
  document.getElementById('tile-keyboard-container').style.display = 'flex';
  const instruction = document.getElementById('keyboard-instruction');
  const pName = match.players[wId].name;
  if (type === 'shuntsu') instruction.innerText = `[${pName}] 순쯔(연속패)의 '첫 번째 패' 누르기`;
  else if (type === 'koutsu') instruction.innerText = `[${pName}] 커쯔로 만들 패 누르기`;
  else if (type === 'kantsu') instruction.innerText = `[${pName}] 깡쯔로 만들 패 누르기`;
  else instruction.innerText = `[${pName}] 머리(또이츠)로 만들 패 누르기`;
}

function addBlockFromKey(tileName) {
  if (activeWIdForKeyboard === null) return;
  let idx = tileList.indexOf(tileName);
  let tilesToAdd = [];
  if (pendingBlockType === 'shuntsu') {
    if (idx >= 27) return showToast("자패로는 순쯔를 만들 수 없습니다.");
    if (idx % 9 >= 7) return showToast("8, 9로는 시작할 수 없습니다.");
    tilesToAdd = [tileList[idx], tileList[idx+1], tileList[idx+2]];
  } else if (pendingBlockType === 'koutsu') { tilesToAdd = [tileName, tileName, tileName];
  } else if (pendingBlockType === 'kantsu') { tilesToAdd = [tileName, tileName, tileName, tileName];
  } else if (pendingBlockType === 'pair') { tilesToAdd = [tileName, tileName]; }

  const bData = builders[activeWIdForKeyboard];
  bData.blocks.push({ id: bData.blockIdCounter++, type: pendingBlockType, tiles: tilesToAdd, isOpen: false });
  document.getElementById('tile-keyboard-container').style.display = 'none';
  activeWIdForKeyboard = null;
  renderAutoBuilders();
}

function toggleNaki(wId, blockId) {
  const block = builders[wId].blocks.find(b => b.id === blockId);
  if (block.type === 'pair') return showToast("머리는 울 수 없습니다.");
  block.isOpen = !block.isOpen;
  renderAutoBuilders();
}

function deleteBlock(wId, blockId) {
  const bData = builders[wId];
  bData.blocks = bData.blocks.filter(b => b.id !== blockId);
  if (bData.winningBlockId === blockId) { bData.winningBlockId = null; bData.winningTileIdx = null; }
  renderAutoBuilders();
}

function setWinningTile(wId, blockId, tIdx) {
  const bData = builders[wId];
  bData.winningBlockId = blockId;
  bData.winningTileIdx = tIdx;
  renderAutoBuilders();
}

function renderAutoBuilders() {
  const container = document.getElementById('auto-builders-container');
  if (winners.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:#9ca3af; font-size:0.9rem;">승자를 선택해주세요.</div>';
    document.getElementById('tile-keyboard-container').style.display = 'none';
    return;
  }
  let html = '';
  winners.forEach(wId => {
    const bData = builders[wId]; const pName = match.players[wId].name;
    let blocksHtml = bData.blocks.map(block => {
      let tileHtml = block.tiles.map((tName, i) => {
        let isWin = (bData.winningBlockId === block.id && bData.winningTileIdx === i) ? 'is-winning' : '';
        return `<span class="block-tile ${isWin}" onclick="setWinningTile(${wId}, ${block.id}, ${i})">${tName}</span>`;
      }).join('');
      let nakiLabel = block.isOpen ? '🔓울음' : '🔒멘젠';
      let nakiBtn = (block.type === 'pair') ? '' : `<button class="btn-toggle-naki" onclick="toggleNaki(${wId}, ${block.id})">${nakiLabel}</button>`;
      return `<div class="hand-block ${block.isOpen ? 'is-open' : ''}"><div class="block-tiles">${tileHtml}</div><div class="block-actions">${nakiBtn}<button class="btn-delete-block" onclick="deleteBlock(${wId}, ${block.id})">삭제</button></div></div>`;
    }).join('');
    if (bData.blocks.length === 0) blocksHtml = '<span style="color:#6b7280; font-size:0.85rem; width:100%; text-align:center;">블럭을 추가해주세요.</span>';
    html += `<div class="auto-builder-panel"><div class="builder-header">▶ [${pName}]의 패 조립</div><div class="block-builder-controls"><button class="btn-add-block" onclick="openKeyboard(${wId}, 'shuntsu')">+ 순쯔(123)</button><button class="btn-add-block" onclick="openKeyboard(${wId}, 'koutsu')">+ 커쯔(111)</button><button class="btn-add-block" onclick="openKeyboard(${wId}, 'kantsu')">+ 깡쯔(1111)</button><button class="btn-add-block" onclick="openKeyboard(${wId}, 'pair')">+ 머리(11)</button></div><div class="hand-blocks-container">${blocksHtml}</div><div style="font-size:0.8rem; color:#fca5a5;">※ 복합 대기일 경우 부수가 높은 패를 오름패로 찍어주세요.</div></div>`;
  });
  container.innerHTML = html;
}

function isYaochu(name) {
  const idx = tileList.indexOf(name);
  return (idx >= 27) || (idx % 9 === 0) || (idx % 9 === 8); 
}

function calculateAllFu() {
  if (winners.length === 0) return showToast("승자를 선택해주세요.");
  let successCount = 0;

  // for문으로 변경하여 에러 발생 시 깔끔하게 continue 처리되게 보완
  for(let i = 0; i < winners.length; i++) {
    const wId = winners[i];
    const bData = builders[wId];
    const blocks = bData.blocks;
    
    let pairs = blocks.filter(b => b.type === 'pair').length;
    let melds = blocks.filter(b => b.type !== 'pair').length;

    let isChiitoi = (blocks.length === 7 && pairs === 7);
    let isStandard = (pairs === 1 && melds === 4);

    if (!isChiitoi && !isStandard) { showToast(`[${match.players[wId].name}] 패가 불완전합니다.`); continue; }
    if (bData.winningBlockId === null) { showToast(`[${match.players[wId].name}] 오름패를 터치해주세요.`); continue; }

    if (isChiitoi) {
      applyCalculatedFu(wId, 25);
      successCount++;
      continue;
    }

    let isHandMenzen = blocks.every(b => !b.isOpen);
    let fu = 20; 

    if (winType === 'RON' && isHandMenzen) fu += 10;
    let isTsumo = (winType === 'TSUMO');

    let isPinghu = isHandMenzen; 
    let waitFu = 0;
    let pairFu = 0;
    let meldFu = 0;

    blocks.forEach(block => {
      let isWinBlock = (block.id === bData.winningBlockId);
      let winIdx = isWinBlock ? bData.winningTileIdx : -1;

      if (block.type === 'pair') {
        let tIdx = tileList.indexOf(block.tiles[0]);
        let isRoundWind = (tIdx === 27 + match.roundIdx);
        let seatWind = (wId - match.oya + 4) % 4; 
        let isSeatWind = (tIdx === 27 + seatWind);
        let isDragon = (tIdx >= 31);

        if (isRoundWind || isSeatWind || isDragon) {
          if (isRoundWind && isSeatWind) pairFu += 4; 
          else pairFu += 2;
          isPinghu = false;
        }
        if (isWinBlock) { waitFu = 2; isPinghu = false; } 
      } 
      else if (block.type === 'shuntsu') {
        if (isWinBlock) {
          let num = parseInt(block.tiles[winIdx].charAt(0));
          if (winIdx === 1) { waitFu = 2; isPinghu = false; } 
          else if (winIdx === 2 && num === 3) { waitFu = 2; isPinghu = false; } 
          else if (winIdx === 0 && num === 7) { waitFu = 2; isPinghu = false; } 
        }
      } 
      else if (block.type === 'koutsu' || block.type === 'kantsu') {
        isPinghu = false;
        let isYao = isYaochu(block.tiles[0]);
        let isClosed = !block.isOpen;

        if (isWinBlock && winType === 'RON' && isClosed) {
          isClosed = false; 
        }

        let bFu = (block.type === 'kantsu') ? 8 : 2;
        if (isClosed) bFu *= 2;
        if (isYao) bFu *= 2;
        meldFu += bFu;
      }
    });

    fu += pairFu + waitFu + meldFu;

    if (isPinghu && pairFu === 0 && meldFu === 0 && waitFu === 0) {
      if (isTsumo) fu = 20; 
      else fu = 30; 
    } else {
      if (isTsumo) fu += 2; 
      fu = Math.ceil(fu / 10) * 10;
      if (fu === 20 && winType === 'RON') fu = 30; 
      if (fu === 20 && !isHandMenzen) fu = 30; 
    }

    applyCalculatedFu(wId, fu);
    successCount++;
  }

  if (successCount === winners.length) {
    showToast("부수 자동 계산 완료!\n판수(Han)를 확정해주세요.");
  }
}

function applyCalculatedFu(winnerId, fuValue) {
  const fuSelect = document.getElementById(`fu-${winnerId}`);
  if(fuSelect) fuSelect.value = fuValue > 110 ? "110" : fuValue.toString();
  setInputMode('MANUAL'); 
}

// === ✨ 에러 유발 찌꺼기 완벽 제거된 모달 오픈 로직 ===
function openModal() {
  winners = []; loserId = null;
  document.getElementById('winModal').style.display = 'flex';
  setWinType('RON'); setInputMode('MANUAL');
  // (에러의 원인이었던 renderHandBlocks() 코드를 완전히 지웠습니다!)
}

function closeModal() { document.getElementById('winModal').style.display = 'none'; }
function setWinType(type) {
  winType = type;
  document.getElementById('btn-ron').classList.toggle('active', type === 'RON');
  document.getElementById('btn-tsumo').classList.toggle('active', type === 'TSUMO');
  document.getElementById('loser-section').style.display = (type === 'RON') ? 'block' : 'none';
  if(type === 'TSUMO') { loserId = null; if(winners.length > 1) winners = [winners[0]]; }
  updateModalUI();
}
function toggleWinner(id) {
  if (winType === 'TSUMO') winners = [id];
  else {
    if (winners.includes(id)) winners = winners.filter(w => w !== id); 
    else winners.push(id); 
  }
  if (winners.includes(loserId)) loserId = null; 
  updateModalUI();
}
function setLoser(id) { loserId = id; updateModalUI(); }

function setInputMode(mode) {
  inputMode = mode;
  document.getElementById('btn-input-manual').classList.toggle('active', mode === 'MANUAL');
  document.getElementById('btn-input-auto').classList.toggle('active-blue', mode === 'AUTO');
  document.getElementById('manual-input-section').style.display = (mode === 'MANUAL') ? 'block' : 'none';
  document.getElementById('auto-input-section').style.display = (mode === 'AUTO') ? 'flex' : 'none';
}

function renderDynamicInputs() {
  const container = document.getElementById('dynamic-inputs');
  if (winners.length === 0) { container.innerHTML = '<div style="text-align:center; color:#9ca3af; font-size:0.9rem;">승자를 선택해주세요.</div>'; return; }
  let html = '';
  winners.forEach(wId => {
    const pName = match.players[wId].name;
    html += `
      <div class="dynamic-row">
        <div class="player-label">▶ [${pName}]의 화료 점수</div>
        <div class="input-group" style="padding: 5px 10px; background: transparent;">
          <label>판(Han)</label>
          <select id="han-${wId}"><option value="1">1판</option><option value="2">2판</option><option value="3">3판</option><option value="4">4판</option><option value="5">5판(만관)</option><option value="6">6~7판(하네만)</option><option value="8">8~10판(배만)</option><option value="11">11~12판(삼배만)</option><option value="13">13판+(역만)</option></select>
        </div>
        <div class="input-group" style="padding: 5px 10px; background: transparent;">
          <label>부(Fu)</label>
          <select id="fu-${wId}"><option value="20">20부</option><option value="25">25부(치또이츠)</option><option value="30" selected>30부</option><option value="40">40부</option><option value="50">50부</option><option value="60">60부</option><option value="70">70부</option><option value="80">80부</option><option value="90">90부</option><option value="100">100부</option><option value="110">110부~</option></select>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

function updateModalUI() {
  const winnerBtns = document.getElementById('winner-btns').children;
  const loserBtns = document.getElementById('loser-btns').children;
  for (let i = 0; i < 4; i++) {
    winnerBtns[i].className = winners.includes(i) ? 'active-win' : '';
    loserBtns[i].className = (loserId === i) ? 'active-lose' : '';
    loserBtns[i].disabled = winners.includes(i); 
  }
  initBuildersForWinners();
  renderAutoBuilders();
  renderDynamicInputs();
}

function calcScore(han, fu, isOya, isTsumo) {
  let base = 0;
  if (han >= 13) base = 8000;
  else if (han >= 11) base = 6000;
  else if (han >= 8) base = 4000;
  else if (han >= 6) base = 3000;
  else if (han >= 5 || (han === 4 && fu >= 40) || (han === 3 && fu >= 70)) base = 2000;
  else base = fu * Math.pow(2, 2 + han);
  const ceil100 = (num) => Math.ceil(num / 100) * 100;
  if (isTsumo) return { total: ceil100(base * 2) * (isOya?3:1) + ceil100(base)*(isOya?0:2), oyaPays: isOya?0:ceil100(base * 2), koPays: isOya?ceil100(base * 2):ceil100(base) };
  else return { total: ceil100(base * (isOya ? 6 : 4)), oyaPays: 0, koPays: 0 };
}

// === ✨ 점수 적용 안전장치 덧댐 ===
function applyScore() {
  if (winners.length === 0) return showToast("승자를 1명 이상 선택해주세요!"); 
  if (winType === 'RON' && loserId === null) return showToast("패자(방총자)를 선택해주세요!"); 
  
  const roundLabel = `${match.roundInfo[match.roundIdx]} ${match.kyoku}국 (${match.honba}본장)`;
  const winnerNames = winners.map(id => match.players[id].name).join(", ");
  const actionLabel = `화료 (${winType === 'TSUMO' ? '쯔모' : '론'}) - 승자: ${winnerNames}`;
  const honbaPoints = match.honba * 300;
  let isOyaWin = false;

  winners.forEach(wId => {
    if (wId === match.oya) isOyaWin = true;
    
    // 요소가 렌더링되지 않았을 때를 대비한 안전망 (Fallback) 추가
    const hanElem = document.getElementById(`han-${wId}`);
    const fuElem = document.getElementById(`fu-${wId}`);
    const han = hanElem ? parseInt(hanElem.value) : 1;
    const fu = fuElem ? parseInt(fuElem.value) : 30;
    
    const scoreData = calcScore(han, fu, wId === match.oya, winType === 'TSUMO');

    if (winType === 'TSUMO') {
      match.players.forEach((p, idx) => {
        if (idx !== wId) {
          const pay = (idx === match.oya) ? scoreData.oyaPays : scoreData.koPays;
          p.score -= (pay + (match.honba * 100)); 
        }
      });
      match.players[wId].score += (scoreData.total + honbaPoints);
    } else {
      match.players[loserId].score -= (scoreData.total + honbaPoints);
      match.players[wId].score += (scoreData.total + honbaPoints);
    }
  });

  let kyotakuWinner = winners[0]; 
  if (winType === 'RON' && winners.length > 1) {
    let minDistance = 99;
    winners.forEach(wId => {
      let distance = (wId - loserId + 4) % 4; 
      if (distance < minDistance) { minDistance = distance; kyotakuWinner = wId; }
    });
  }
  match.players[kyotakuWinner].score += (match.kyotaku * 1000);
  match.kyotaku = 0;

  if (isOyaWin) { match.honba++; } 
  else { match.honba = 0; match.oya = (match.oya + 1) % 4; match.kyoku++; if (match.kyoku > 4) { match.kyoku = 1; match.roundIdx++; } }
  
  resetRiichiFlags();
  gameHistory.push({ action: actionLabel, roundStr: roundLabel, state: JSON.parse(JSON.stringify(match)) });
  closeModal(); updateUI();
}

function openDrawModal() { tenpaiList = []; document.getElementById('drawModal').style.display = 'flex'; setDrawType('NORMAL'); }
function closeDrawModal() { document.getElementById('drawModal').style.display = 'none'; }
function setDrawType(type) {
  drawType = type;
  document.getElementById('btn-draw-normal').classList.toggle('active', type === 'NORMAL');
  document.getElementById('btn-draw-abortive').classList.toggle('active', type === 'ABORTIVE');
  document.getElementById('tenpai-section').style.display = (type === 'NORMAL') ? 'block' : 'none';
  document.getElementById('abortive-desc').style.display = (type === 'ABORTIVE') ? 'block' : 'none';
  updateDrawModalUI();
}
function toggleTenpai(id) { if (tenpaiList.includes(id)) tenpaiList = tenpaiList.filter(t => t !== id); else tenpaiList.push(id); updateDrawModalUI(); }
function updateDrawModalUI() { const btns = document.getElementById('tenpai-btns').children; for (let i = 0; i < 4; i++) btns[i].className = tenpaiList.includes(i) ? 'active-tenpai' : ''; }
function applyDraw() {
  const roundLabel = `${match.roundInfo[match.roundIdx]} ${match.kyoku}국 (${match.honba}본장)`;
  if (drawType === 'ABORTIVE') {
    match.honba++; resetRiichiFlags(); gameHistory.push({ action: "도중 유국", roundStr: roundLabel, state: JSON.parse(JSON.stringify(match)) });
  } else {
    const count = tenpaiList.length;
    if (count > 0 && count < 4) {
      const receive = 3000 / count; const pay = 3000 / (4 - count);
      match.players.forEach((p, idx) => { if (tenpaiList.includes(idx)) p.score += receive; else p.score -= pay; });
    }
    if (tenpaiList.includes(match.oya)) { match.honba++; } 
    else { match.oya = (match.oya + 1) % 4; match.honba++; match.kyoku++; if (match.kyoku > 4) { match.kyoku = 1; match.roundIdx++; } }
    resetRiichiFlags(); gameHistory.push({ action: "유국 (류쿄쿠)", roundStr: roundLabel, state: JSON.parse(JSON.stringify(match)) });
  }
  closeDrawModal(); updateUI();
}

function openEditModal() {
  document.getElementById('edit-round').value = match.roundIdx; document.getElementById('edit-kyoku').value = match.kyoku;
  document.getElementById('edit-oya').value = match.oya; document.getElementById('edit-honba').value = match.honba; document.getElementById('edit-kyotaku').value = match.kyotaku;
  for(let i=0; i<4; i++) { document.getElementById(`edit-score-${i}`).value = match.players[i].score; }
  document.getElementById('editModal').style.display = 'flex';
}
function closeEditModal() { document.getElementById('editModal').style.display = 'none'; }
function applyEdit() {
  const roundLabel = `${match.roundInfo[match.roundIdx]} ${match.kyoku}국 (${match.honba}본장)`;
  match.roundIdx = parseInt(document.getElementById('edit-round').value); match.kyoku = parseInt(document.getElementById('edit-kyoku').value);
  match.oya = parseInt(document.getElementById('edit-oya').value); match.honba = parseInt(document.getElementById('edit-honba').value); match.kyotaku = parseInt(document.getElementById('edit-kyotaku').value);
  for(let i=0; i<4; i++) { let newScore = parseInt(document.getElementById(`edit-score-${i}`).value); match.players[i].score = isNaN(newScore) ? 0 : newScore; }
  gameHistory.push({ action: "⚙️ 상태 직접 수정", roundStr: roundLabel, state: JSON.parse(JSON.stringify(match)) });
  closeEditModal(); updateUI();
}

function openHistoryModal() {
  const listContainer = document.getElementById('history-list'); listContainer.innerHTML = '';
  if (gameHistory.length === 0) { listContainer.innerHTML = '<div style="text-align:center; color:#9ca3af; padding: 20px;">기록이 없습니다.</div>'; } 
  else {
    [...gameHistory].reverse().forEach((log, reversedIndex) => {
      const actualIndex = gameHistory.length - 1 - reversedIndex;
      const prevState = actualIndex > 0 ? gameHistory[actualIndex - 1].state : null;
      let scoreHtml = '';
      log.state.players.forEach((p, i) => {
        let deltaStr = '';
        if (prevState) {
          let delta = p.score - prevState.players[i].score;
          if (delta > 0) deltaStr = `<span class="score-up">(+${delta})</span>`; else if (delta < 0) deltaStr = `<span class="score-down">(${delta})</span>`;
        }
        scoreHtml += `<div><span>${p.name}</span> <span>${p.score} ${deltaStr}</span></div>`;
      });
      const item = document.createElement('div'); item.className = 'history-item';
      item.innerHTML = `<div class="history-header"><div><div class="history-action">${log.action}</div><div class="history-round">${log.roundStr} | 리치봉: ${log.state.kyotaku}개</div></div><button class="btn-revert" onclick="confirmRevert(${actualIndex})">이 시점으로</button></div><div class="history-scores">${scoreHtml}</div>`;
      listContainer.appendChild(item);
    });
  }
  document.getElementById('historyModal').style.display = 'flex';
}
function closeHistoryModal() { document.getElementById('historyModal').style.display = 'none'; }
function confirmRevert(index) {
  showConfirm("이 시점으로 되돌아가면 이후 기록은 삭제됩니다. 되돌릴까요?", () => {
    match = JSON.parse(JSON.stringify(gameHistory[index].state)); gameHistory = gameHistory.slice(0, index + 1);
    closeHistoryModal(); updateUI(); showToast("되돌아갔습니다.");
  });
}

window.onload = () => {
  initBlockKeyboard(); 
  const savedData = localStorage.getItem(STORAGE_KEY);
  if (savedData) {
    try {
      const parsed = JSON.parse(savedData);
      match = parsed.match; gameHistory = parsed.history;
      showToast("이전 게임 데이터를 불러왔습니다.");
    } catch(e) {
      gameHistory.push({ action: "게임 시작", roundStr: "초기 상태", state: JSON.parse(JSON.stringify(match)) });
    }
  } else {
    gameHistory.push({ action: "게임 시작", roundStr: "초기 상태", state: JSON.parse(JSON.stringify(match)) });
  }
  updateUI();
};
