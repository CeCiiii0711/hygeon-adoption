/* ===========================================================
   简单数据层（可替换为 fetch 载入）
   =========================================================== */
   const TOKENS = {
    bgList: [
      "./assets/bg/setting1.jpg",
      "./assets/bg/setting2.JPG",
      "./assets/bg/setting3.JPG",
    ],
    leftImgs: [1,2,3,4,5].map(i => `./assets/pigeon/p${i}.JPG`),
    rightImgs:[1,2,3,4,5].map(i => `./assets/hydrant/h${i}.JPG`),
    genPath: (l,r)=> `./assets/gen/hyg_${l}-${r}.png`,
    spritePath: (l,r,pose)=> `./assets/sprite/hyg_${l}-${r}_${pose}.png`,
    spriteFallback: (pose)=> `./assets/sprite/hyg_any_${pose}.png`, // 若你只有通用三视图
    comboNames: (()=>{ // 25 个随便起的名字
      const L = ["Nimbus","Velvet","Orbit","Flare","Echo"];
      const R = ["Drift","Spark","Tide","Pulse","Quill"];
      const out = [];
      for(let i=0;i<5;i++){
        for(let j=0;j<5;j++){
          out.push(`${L[i]} ${R[j]}`);
        }
      }
      return out;
    })()
  };
  
  /* ===========================================================
     DOM 引用
     =========================================================== */
  const stage = document.getElementById('stage');
  const btnSetting = document.getElementById('btnSetting');
  const btnAdopt = document.getElementById('btnAdopt');
  const btnIndex = document.getElementById('btnIndex');
  const btnAbout = document.getElementById('btnAbout');
  const drawerIndex = document.getElementById('drawerIndex');
  const drawerAbout = document.getElementById('drawerAbout');
  const scrim = document.getElementById('scrim');
  const modal = document.getElementById('modal');
  const leftList = document.getElementById('leftList');
  const rightList = document.getElementById('rightList');
  const genImg = document.getElementById('genImg');
  const genCaption = document.getElementById('genCaption');
  const btnNotif    = document.getElementById('btnNotif');
  const drawerNotif = document.getElementById('drawerNotif');

  
  /* ===========================================================
     状态
     =========================================================== */
  let bgIdx = 0;
  let selLeft = 2;   // 默认第 2 张被选中（1-based）
  let selRight = 2;
  
  /* ===========================================================
     小工具
     =========================================================== */
  function rand(min,max){ return Math.random()*(max-min)+min; }
  function assetExists(url){
    return new Promise(resolve=>{
      const img = new Image();
      img.onload = ()=> resolve(true);
      img.onerror = ()=> resolve(false);
      img.src = url;
    });
  }
  
  /* 每 N 次侧向步伐插一次 front（全局可调） */
  const FRONT_EVERY = 100;
  
  /* 根据方向选择帧，并做“每 N 次插 front” */
  function stepAnimate(node, framesObj, dirX){
    // dirX < 0 用 leftPair(A/B)，>0 用 rightPair(C/D)
    const pair = (dirX < 0) ? framesObj.leftPair : framesObj.rightPair;
  
    let sideFlip   = (typeof node._sideFlip === 'boolean') ? node._sideFlip : false;
    let sinceFront = (typeof node._sinceFront === 'number')  ? node._sinceFront : 0;
  
    if (sinceFront >= FRONT_EVERY) {
      node.style.backgroundImage = `url("${framesObj.front}")`;
      sinceFront = 0;
    } else {
      sideFlip = !sideFlip;
      node.style.backgroundImage = `url("${pair[sideFlip ? 0 : 1]}")`;
      sinceFront++;
    }
  
    node._sideFlip   = sideFlip;
    node._sinceFront = sinceFront;
  }
  
  /* ===========================================================
     背景切换（左下角 setting change）
     =========================================================== */
  btnSetting.addEventListener('click', ()=>{
    bgIdx = (bgIdx + 1) % TOKENS.bgList.length;
    stage.style.backgroundImage = `url("${TOKENS.bgList[bgIdx]}")`;
  });
  
  /* ===========================================================
     Drawer
     =========================================================== */
  function openDrawer(el){ el.classList.add('is-open'); el.setAttribute('aria-hidden','false'); }
  function closeDrawer(el){ el.classList.remove('is-open'); el.setAttribute('aria-hidden','true'); }
  btnIndex.addEventListener('click', ()=> openDrawer(drawerIndex));
  btnAbout.addEventListener('click', ()=> openDrawer(drawerAbout));
  document.querySelectorAll('[data-close-drawer]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const id = e.currentTarget.getAttribute('data-close-drawer');
      const el = document.getElementById(id);
      closeDrawer(el);
    });
  });

  function openDrawer(el){
    closeModal(); // 打开任一 drawer 前先关 adopt
    [drawerIndex, drawerAbout, drawerNotif].forEach(d=>{
      if (d && d !== el) d.classList.remove('is-open');
    });
    el.classList.add('is-open');
    el.setAttribute('aria-hidden','false');
  }

  
  
  /* ===========================================================
     Modal（Adopt）
     =========================================================== */
  function openModal(){
    scrim.classList.add('is-on');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden','false');
  }
  function closeModal(){
    scrim.classList.remove('is-on');
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden','true');
  }
  scrim.addEventListener('click', closeModal);
  btnAdopt.addEventListener('click', openModal);
  
  /* ===========================================================
     列表渲染 & 选择逻辑（默认第2张高亮）
     =========================================================== */
  function makeThumb(src, active=false){
    const div = document.createElement('div');
    div.className = 'thumb' + (active ? ' is-active' : '');
    div.style.backgroundImage = `url("${src}")`;
    return div;
  }
  
  function renderLists(){
    leftList.innerHTML = '';
    rightList.innerHTML = '';
  
    TOKENS.leftImgs.forEach((src, idx)=>{
      const el = makeThumb(src, (idx+1)===selLeft);
      el.addEventListener('click', ()=>{
        selLeft = idx+1;
        renderLists();
        updateGenerated();
      });
      leftList.appendChild(el);
    });
  
    TOKENS.rightImgs.forEach((src, idx)=>{
      const el = makeThumb(src, (idx+1)===selRight);
      el.addEventListener('click', ()=>{
        selRight = idx+1;
        renderLists();
        updateGenerated();
      });
      rightList.appendChild(el);
    });
  }
  
  /* ===========================================================
     生成区：根据左右选择实时更换图片与标题
     =========================================================== */
  async function updateGenerated(){
    const url = TOKENS.genPath(selLeft, selRight);
    genImg.style.backgroundImage = `url("${url}")`;
    const comboIndex = (selLeft-1)*5 + (selRight-1);
    const name = TOKENS.comboNames[comboIndex];
    genCaption.textContent = `this is ：L${selLeft} × R${selRight} · ${name}`;
  }
  
  /* ===========================================================
     精灵帧选择（含 sideC/D 回退）
     =========================================================== */
  async function pickFrames(l, r){
    async function chooseOrFallback(pose, fallbackPose){
      const p = TOKENS.spritePath(l, r, pose);
      if (await assetExists(p)) return p;
      // 对于 front/sideA/sideB 的缺失，回退到 any_同名
      if (!fallbackPose) return TOKENS.spriteFallback(pose);
      // 对于 sideC/D 的缺失，回退到 A/B
      return TOKENS.spritePath(l, r, fallbackPose);
    }
  
    const front = await chooseOrFallback('front');
    const sideA = await chooseOrFallback('sideA');
    const sideB = await chooseOrFallback('sideB');
  
    // 右向：优先 C/D；若缺失，则回退到 A/B
    const sideCexists = await assetExists(TOKENS.spritePath(l,r,'sideC'));
    const sideDexists = await assetExists(TOKENS.spritePath(l,r,'sideD'));
    const sideC = sideCexists ? TOKENS.spritePath(l,r,'sideC') : sideA;
    const sideD = sideDexists ? TOKENS.spritePath(l,r,'sideD') : sideB;
  
    return {
      front,
      leftPair:  [sideA, sideB], // 向左
      rightPair: [sideC, sideD], // 向右
    };
  }
  
  /* ===========================================================
     弹窗内部：从 genImg 区域“出生”，逐帧 + 左移，直到越过 modal 左边消失
     =========================================================== */
  async function walkOutOfModal(l, r){
    const frames = await pickFrames(l, r); // { front, leftPair, rightPair }
  
    const modalRect = modal.getBoundingClientRect();
    const genRect   = genImg.getBoundingClientRect();
  
    // 出生点（fixed，屏幕坐标）
    const walker = document.createElement('div');
    walker.style.position = 'fixed';
    const size = 88; // 弹窗阶段略小
    walker.style.width  = `${size}px`;
    walker.style.height = `${size}px`;
    walker.style.left   = `${Math.min(genRect.right - size - 16, genRect.left + genRect.width*0.6)}px`;
    walker.style.top    = `${Math.min(genRect.bottom - size - 12, genRect.top + genRect.height*0.65)}px`;
    walker.style.background = `center/contain no-repeat url("${frames.front}")`;
    walker.style.pointerEvents = 'none';
    walker.style.zIndex = (parseInt(getComputedStyle(modal).zIndex,10) || 30) + 1;
    document.body.appendChild(walker);
  
    // 逐帧 + 左移
    const tickMs = 120;
    const stepPx = 6;
    const leftEdge = modalRect.left;
    let x = parseFloat(walker.style.left);
    const y = parseFloat(walker.style.top);
  
    return new Promise(resolve=>{
      const timer = setInterval(()=>{
        // 弹窗阶段固定向左，所以 dirX = -1
        stepAnimate(walker, frames, -1);
  
        x -= stepPx;
        walker.style.left = `${x}px`;
  
        // 右边界 <= modal.left 视为“完全走出”
        if(x + size <= leftEdge){
          clearInterval(timer);
          const exitPos = { screenX: x, screenY: y, size, frames };
          walker.remove();
          resolve(exitPos);
        }
      }, tickMs);
    });
  }
  
  /* ===========================================================
     在 Home（stage）里继续走：先向左到边缘，首次反弹后进入随机游走
     =========================================================== */
  function continueOnStageFromScreenPos(exitPos){
    const { screenX, screenY, size, frames } = exitPos;
    const stageRect = stage.getBoundingClientRect();
  
    // 转换为 stage 内部坐标
    const startX = Math.max(0, Math.min(stageRect.width  - size, screenX - stageRect.left));
    const startY = Math.max(0, Math.min(stageRect.height - size, screenY - stageRect.top));
  
    const npc = document.createElement('div');
    npc.className = 'npc';
    npc.style.width  = `${Math.max(120, size)}px`;
    npc.style.height = `${Math.max(120, size)}px`;
    npc.style.left   = `${startX}px`;
    npc.style.top    = `${startY}px`;
    npc.style.backgroundImage = `url("${frames.front}")`;
    stage.appendChild(npc);
  
    // 动画参数
    const tickMs = 140;
    const pad = 16;
    const stepPx = 3;
  
    // Phase 1：只水平向左，触左边反弹一次 → Phase 2
    let phase = 1;
    let dirX = -1; // 向左
    let hasBounced = false;
  
    const walkTimer = setInterval(()=>{
      // 切帧：按当前水平方向选择 AB 或 CD，且每 N 次插 front
      const curDirX = (phase === 1) ? dirX : (parseInt(npc.dataset.dirX || '1', 10));
      stepAnimate(npc, frames, curDirX);
  
      const rect = stage.getBoundingClientRect();
      const w = parseFloat(npc.style.width)  || 120;
      const h = parseFloat(npc.style.height) || 120;
  
      let x = parseFloat(npc.style.left);
      let y = parseFloat(npc.style.top);
  
      if(phase === 1){
        x += dirX * stepPx;
  
        // 触到左边：反弹一次（改向右），进入随机阶段
        if(x <= pad){
          x = pad;
          dirX = 1;
          hasBounced = true;
        }
        npc.style.left = `${x}px`;
  
        if(hasBounced){
          phase = 2;
          npc.dataset.dirX = '1'; // 初始向右
          npc.dataset.dirY = (Math.random()<0.5 ? -1 : 1).toString(); // 随机上下
        }
      } else {
        // Phase 2：随机游走（水平为主，竖直轻微）
        let dx = parseInt(npc.dataset.dirX || '1', 10);
        let dy = parseInt(npc.dataset.dirY || '1', 10);
  
        if(Math.random()<0.04) dx *= -1;
        if(Math.random()<0.04) dy *= -1;
  
        x += dx * stepPx;
        y += dy * (stepPx * 0.6);
  
        // 碰边反弹
        const maxX = rect.width  - w - pad, minX = pad;
        const maxY = rect.height - h - pad, minY = pad;
        if(x <= minX){ x = minX; dx = 1; }
        if(x >= maxX){ x = maxX; dx = -1; }
        if(y <= minY){ y = minY; dy = 1; }
        if(y >= maxY){ y = maxY; dy = -1; }
  
        npc.style.left = `${x}px`;
        npc.style.top  = `${y}px`;
      
        npc.dataset.dirX = dx.toString();
        npc.dataset.dirY = dy.toString();
      }
    }, tickMs);
  
    // 变大：每 30 秒 +20px
    const growTimer = setInterval(()=>{
      const cw = parseFloat(npc.style.width)  || 220;
      const ch = parseFloat(npc.style.height) || 220;
      npc.style.width  = `${cw + 50}px`;
      npc.style.height = `${ch + 50}px`;
    }, 30000);
  
    npc.dataset.walkTimer = walkTimer;
    npc.dataset.growTimer = growTimer;
  }
  
  /* ===========================================================
     点击 adopt：弹窗里逐帧+左移走出 → Home 同坐标继续走
     =========================================================== */
  document.getElementById('adoptGo').addEventListener('click', async ()=>{
    const exitPos = await walkOutOfModal(selLeft, selRight);
    closeModal();
    continueOnStageFromScreenPos(exitPos);
  });
  
  /* ===========================================================
     初始化
     =========================================================== */
  function boot(){
    renderLists();
    updateGenerated();
  }
  boot();

  /* =============================
   Index 页面：卡片动画工具
   ============================= */

/* 给一张卡片的预览框启动伪3D动画：front -> sideA -> sideC 循环，每 1s 切换 */
function startCardPreviewAnimation(previewEl, frames) {
  const TICK_MS = 2000; // 1s 一帧

  // 如果 sideC 不存在，就用 sideB 代替（防止缺图）
  const cycle = [
    frames.front,
    frames.sideA,
    frames.sideC || frames.sideB || frames.front
  ];

  let i = 0;
  previewEl.style.backgroundImage = `url("${cycle[0]}")`;

  const timer = setInterval(() => {
    i = (i + 1) % cycle.length;
    previewEl.style.backgroundImage = `url("${cycle[i]}")`;
  }, TICK_MS);

  previewEl._timer = timer;
}


/* 取一张卡片需要的三帧（缺失回退到 any_同名） */
async function framesForCard(l, r){
  async function pick(pose){
    const p = TOKENS.spritePath(l, r, pose);
    if (await assetExists(p)) return p;
    return TOKENS.spriteFallback(pose);
  }
  const front = await pick('front');
  const sideA = await pick('sideA');
  const sideB = await pick('sideC');
  return { front, sideA, sideB };
}

/* =============================
   Index 页面：渲染 Grid（直接写进 drawerIndex 容器）
   ============================= */
const indexGridEl = document.getElementById('indexGrid');
let indexBuilt = false;
let indexTimers = []; // 存卡片动画的定时器，关闭抽屉时清理

async function buildIndexGridOnce(){
  if (indexBuilt) return;
  let idx = 0;

  for (let l=1; l<=5; l++){
    for (let r=1; r<=5; r++){
      const name = TOKENS.comboNames[idx++];
      const card = document.createElement('article');
      card.className = 'index-card';

      const preview = document.createElement('div');
      preview.className = 'index-card__preview';

      const title = document.createElement('div');
      title.className = 'index-card__name';
      title.textContent = name;

      const desc = document.createElement('div');
      desc.className = 'index-card__desc';
      desc.textContent = 'description…'; // 先占位，将来可从数据层带入

      card.append(preview, title, desc);
      indexGridEl.appendChild(card);

      // 拿三帧并启动动画
      const frames = await framesForCard(l, r);
      startCardPreviewAnimation(preview, frames);
      indexTimers.push(preview._timer);
    }
  }
  indexBuilt = true;
}

/* 打开 Index 抽屉时（不用 fetch），首次渲染 Grid；再次打开只恢复动画 */
btnIndex.addEventListener('click', async ()=>{
  openDrawer(drawerIndex);
  await buildIndexGridOnce();
  // 重新开启动画（如果上次关闭抽屉清理过）
  document.querySelectorAll('.index-card__preview').forEach(prev=>{
    if (!prev._timer && prev.style.backgroundImage) {
      // 简单恢复（用当前帧继续跑）
      const url = prev.style.backgroundImage.replace(/^url\(["']?|["']?\)$/g,'');
      startCardPreviewAnimation(prev, {front:url, sideA:url, sideB:url}); 
      // ↑ 如果想恢复到真实 sideA/sideB/front，可把三帧缓存到 dataset；这里给简化版本
    }
  });
});

/* 关闭任意抽屉的按钮里已经有 data-close-drawer，追加一个监听：若关的是 Index，就暂停动画 */
document.querySelectorAll('[data-close-drawer]').forEach(btn=>{
  btn.addEventListener('click', (e)=>{
    const id = e.currentTarget.getAttribute('data-close-drawer');
    const el = document.getElementById(id);
    closeDrawer(el);

    if (id === 'drawerIndex'){
      // 清理所有卡片动画
      indexTimers.forEach(t=> clearInterval(t));
      indexTimers = [];
      document.querySelectorAll('.index-card__preview').forEach(prev=>{
        if (prev._timer){ clearInterval(prev._timer); prev._timer = null; }
      });
    }
  });
});

function pushNotificationCard({ avatarUrl, name, message, time }){
  const list = document.getElementById('notifList');
  if (!list) return;
  const li = document.createElement('li');
  li.className = 'notif-item';
  li.innerHTML = `
    <div class="notif-item__row">
      <div class="notif-avatar" style="background-image:url('${avatarUrl || ''}')"></div>
      <div class="notif-name">${name || 'Hygeon'}</div>
    </div>
    <div class="notif-msg">${message || ''}</div>
    <div class="notif-time">${time || new Date().toLocaleString()}</div>
  `;
  list.prepend(li); // 最新在最上面
}
btnNotif.addEventListener('click', (e)=>{
  e.preventDefault();
  openDrawer(drawerNotif);
});

document.getElementById('adoptGo').addEventListener('click', async ()=>{
  const exitPos = await walkOutOfModal(selLeft, selRight);
  closeModal();
  continueOnStageFromScreenPos(exitPos);

  // —— 在这里推送一条通知 —— //
  const comboIndex = (selLeft-1)*5 + (selRight-1);
  const name = TOKENS.comboNames[comboIndex];
  // front 头像（若缺失用 any_front）
  const frontUrl = (await assetExists(TOKENS.spritePath(selLeft, selRight, 'front')))
    ? TOKENS.spritePath(selLeft, selRight, 'front')
    : TOKENS.spriteFallback('front');

  pushNotificationCard({
    avatarUrl: frontUrl,
    name,
    message:
`hiii thanks for raising me up. I feel like its time for me to live my own life so i applied for the Hygeon museum and got a spot. I’ll be at 33st 5ave, NY, 10022. Come find me when you got time! thank you again!`,
  });
});



  
