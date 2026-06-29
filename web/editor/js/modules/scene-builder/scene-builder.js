window.BoltWorks = window.BoltWorks || {};
BoltWorks.SceneBuilder = (() => {
  const title = 'Scene Builder';
  const left = () => {
    const p = BoltWorks.State.getProject();
    const scene = BoltWorks.State.currentScene();
    return `<h2 class="module-title">Scene Builder</h2>
      <p class="hint">Build scenes, layers, triggers, starts, camera space, and placed objects.</p>
      <div class="section"><label>Current scene<select id="sceneSelect">${p.scenes.map(s => `<option value="${s.id}" ${s.id===scene.id?'selected':''}>${BoltWorks.escapeHtml(s.name)}</option>`).join('')}</select></label>
      <div class="row" style="margin-top:10px"><button id="addSceneBtn">+ Add scene</button><button id="renameSceneBtn">Rename</button></div></div>
      <div class="section"><button id="addObjectBtn" class="accent" style="width:100%">+ Add object placeholder</button><button id="addStartBtn" style="width:100%;margin-top:8px">+ Add player_start_here</button></div>
      <div class="section"><strong>Scene objects</strong><div class="layer-list" style="margin-top:10px">${scene.objects.map(o => `<button class="object-pick ${p.selectedObjectId===o.id?'active':''}" data-id="${o.id}">${BoltWorks.escapeHtml(o.name || o.type)}</button>`).join('') || '<p class="hint">No objects yet.</p>'}</div></div>`;
  };
  const center = () => `<div class="stage-card"><div class="scene-canvas"><canvas id="sceneCanvas" width="1040" height="540"></canvas></div><p class="canvas-note">Scene canvas foundation. The old world editor will be ported here in smaller pieces.</p></div>`;
  const right = () => {
    const p = BoltWorks.State.getProject();
    const scene = BoltWorks.State.currentScene();
    const obj = scene.objects.find(o => o.id === p.selectedObjectId);
    if (!obj) return `<div class="inspector-title">Inspector</div><p class="hint">Select a scene object to edit it.</p>`;
    return `<div class="inspector-title">Inspector</div><label>Name<input id="objName" value="${BoltWorks.escapeHtml(obj.name)}"></label><div class="grid2" style="margin-top:10px"><label>X<input id="objX" type="number" value="${obj.x}"></label><label>Y<input id="objY" type="number" value="${obj.y}"></label><label>Width<input id="objW" type="number" value="${obj.width}"></label><label>Height<input id="objH" type="number" value="${obj.height}"></label></div><label style="margin-top:10px"><input id="objLocked" type="checkbox" ${obj.locked?'checked':''}> Locked / do not move in editor</label><div class="row" style="margin-top:12px"><button id="duplicateObjBtn">Duplicate</button><button id="deleteObjBtn" class="danger">Delete</button></div>`;
  };
  const draw = () => {
    const canvas = BoltWorks.$('#sceneCanvas'); if (!canvas) return;
    const ctx = canvas.getContext('2d'); const scene = BoltWorks.State.currentScene(); const p = BoltWorks.State.getProject();
    ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#9aa89a'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#66786a'; for(let x=70;x<canvas.width;x+=260){ ctx.beginPath(); ctx.moveTo(x, canvas.height-110); ctx.lineTo(x+90, canvas.height-330); ctx.lineTo(x+180, canvas.height-110); ctx.fill(); }
    ctx.fillStyle='#69664c'; ctx.fillRect(0, canvas.height-110, canvas.width, 110);
    scene.objects.forEach(o => { ctx.strokeStyle=o.id===p.selectedObjectId?'#ffdf75':'#263529'; ctx.setLineDash(o.id===p.selectedObjectId?[8,5]:[]); ctx.lineWidth=2; ctx.strokeRect(o.x/5, o.y/2, o.width/5, o.height/2); ctx.setLineDash([]); ctx.fillStyle='#e5b344'; ctx.fillText(o.name || o.type, o.x/5+4, o.y/2-6); });
  };
  const afterRender = () => {
    const p = BoltWorks.State.getProject(); const scene = BoltWorks.State.currentScene();
    BoltWorks.$('#sceneSelect')?.addEventListener('change', e => { p.activeSceneId=e.target.value; p.selectedObjectId=null; BoltWorks.State.saveLocal(); BoltWorks.Shell.render(); });
    BoltWorks.$('#addSceneBtn')?.addEventListener('click', () => { const s={id:BoltWorks.uid('scene'),name:'New scene',width:5200,height:720,groundHeight:150,objects:[],layers:scene.layers}; p.scenes.push(s); p.activeSceneId=s.id; BoltWorks.State.saveLocal(); BoltWorks.Shell.render(); });
    BoltWorks.$('#renameSceneBtn')?.addEventListener('click', () => { const name=prompt('Scene name', scene.name); if(name){scene.name=name; BoltWorks.State.saveLocal(); BoltWorks.Shell.render();} });
    BoltWorks.$('#addObjectBtn')?.addEventListener('click', () => { const o={id:BoltWorks.uid('obj'),type:'asset',name:'Object placeholder',x:600,y:300,width:180,height:140,layer:'gameplay',locked:false}; scene.objects.push(o); p.selectedObjectId=o.id; BoltWorks.State.saveLocal(); BoltWorks.Shell.render(); });
    BoltWorks.$('#addStartBtn')?.addEventListener('click', () => { const o={id:BoltWorks.uid('start'),type:'player_start_here',name:'player_start_here',x:120,y:420,width:60,height:120,layer:'gameplay',locked:false}; scene.objects.push(o); p.selectedObjectId=o.id; BoltWorks.State.saveLocal(); BoltWorks.Shell.render(); });
    BoltWorks.$$('.object-pick').forEach(b => b.onclick=()=>{p.selectedObjectId=b.dataset.id; BoltWorks.State.saveLocal(); BoltWorks.Shell.render();});
    const updateObj = (key, val) => { const o=scene.objects.find(x=>x.id===p.selectedObjectId); if(o){o[key]=val; BoltWorks.State.saveLocal(); draw();} };
    [['objName','name'],['objX','x'],['objY','y'],['objW','width'],['objH','height']].forEach(([id,key])=>BoltWorks.$('#'+id)?.addEventListener('change', e=>updateObj(key, key==='name'?e.target.value:Number(e.target.value))));
    BoltWorks.$('#objLocked')?.addEventListener('change', e=>updateObj('locked', e.target.checked));
    BoltWorks.$('#deleteObjBtn')?.addEventListener('click',()=>{ scene.objects=scene.objects.filter(o=>o.id!==p.selectedObjectId); p.selectedObjectId=null; BoltWorks.State.saveLocal(); BoltWorks.Shell.render(); });
    draw();
  };
  return { title, left, center, right, afterRender };
})();
