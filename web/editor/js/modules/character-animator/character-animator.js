window.BoltWorks = window.BoltWorks || {};
BoltWorks.CharacterAnimator = (() => {
  const title = 'Character Animator';
  const view = { selectedLayerId: null, selectedAssetShelf: 'Character', frameIndex: 0 };
  const animNames = () => Object.keys(BoltWorks.State.getProject().character.animations);
  const currentAnim = () => BoltWorks.State.activeAnimation();
  const currentFrame = () => currentAnim().frames[view.frameIndex] || currentAnim().frames[0];
  const left = () => {
    const p = BoltWorks.State.getProject(); const anim = currentAnim(); const frame = currentFrame();
    const assets = p.assets.filter(a => a.shelf === view.selectedAssetShelf || view.selectedAssetShelf === 'all');
    return `<h2 class="module-title">Character Animator</h2><p class="hint">Layer body parts, pose frames, preview movement, and export.</p>
      <div class="section"><label>Animation<select id="animSelect">${animNames().map(n=>`<option ${p.character.activeAnimation===n?'selected':''}>${n}</option>`).join('')}</select></label><div class="row" style="margin-top:10px"><button id="addAnimBtn">+ Animation</button><button id="copyAnimBtn">Copy timeline</button></div><div class="slider-row"><span>FPS</span><input id="animFps" type="range" min="1" max="24" value="${anim.fps||8}"><input id="animFpsNum" type="number" min="1" max="24" value="${anim.fps||8}"></div></div>
      <div class="section"><strong>Body layers</strong><div class="layer-list" style="margin-top:10px">${frame.layers.map(l => `<div class="layer-row ${view.selectedLayerId===l.id?'active':''}" data-id="${l.id}"><button class="layerPick" data-id="${l.id}">${l.id.slice(0,2).toUpperCase()}</button><span><strong>${BoltWorks.escapeHtml(l.label)}</strong><br><small>${l.assetId ? BoltWorks.escapeHtml(BoltWorks.State.assetById(l.assetId)?.name || 'missing asset') : 'placeholder'}</small></span><button class="toggleLayer" data-id="${l.id}">${l.hidden?'show':'hide'}</button></div>`).join('')}</div><button id="deselectLayerBtn" style="width:100%;margin-top:10px">Deselect layer</button></div>
      <div class="section"><label>Asset picker shelf<select id="charAssetShelf"><option value="all">All</option>${p.shelves.map(s=>`<option ${view.selectedAssetShelf===s?'selected':''}>${s}</option>`).join('')}</select></label><div class="asset-grid" style="margin-top:10px">${assets.map(a=>`<div class="asset-card char-asset" data-id="${a.id}"><img class="checker" src="${a.dataUrl}"><strong>${BoltWorks.escapeHtml(a.name)}</strong></div>`).join('') || '<p class="hint">No matching assets.</p>'}</div><button id="assignAssetBtn" class="accent" style="width:100%;margin-top:10px">Assign selected asset to layer</button></div>`;
  };
  const center = () => `<div class="stage-card"><div class="character-canvas-wrap checker"><canvas id="characterCanvas" width="512" height="640"></canvas></div><div class="toolbar" style="justify-content:center;margin-top:12px"><button id="prevFrameBtn">‹</button><button id="previewAnimBtn" class="accent">Preview</button><button id="nextFrameBtn">›</button><span class="small">Frame ${view.frameIndex+1} / ${currentAnim().frames.length}</span></div><div class="toolbar" style="justify-content:center"><button id="newFrameBtn">+ New frame</button><button id="dupFrameBtn">Duplicate frame</button><button id="moveFrameBackBtn">Move frame back</button><button id="moveFrameForwardBtn">Move frame forward</button><button id="deleteFrameBtn" class="danger">Delete frame</button></div></div>`;
  const right = () => {
    const layer = currentFrame().layers.find(l => l.id === view.selectedLayerId);
    if (!layer) return `<div class="inspector-title">Selected body layer</div><p class="hint">No layer selected. Pick one on the left, then only that layer can move.</p>`;
    return `<div class="inspector-title">Selected body layer</div><h3 style="color:var(--accent-2)">${BoltWorks.escapeHtml(layer.label)}</h3><div class="grid2"><label>X<input id="layerX" type="number" value="${layer.x}"></label><label>Y<input id="layerY" type="number" value="${layer.y}"></label></div><div class="slider-row"><span>Rotation</span><input id="layerRot" type="range" min="-180" max="180" value="${layer.rotation}"><input id="layerRotNum" type="number" value="${layer.rotation}"></div><div class="slider-row"><span>Scale %</span><input id="layerScale" type="range" min="10" max="300" value="${Math.round(layer.scale*100)}"><input id="layerScaleNum" type="number" value="${Math.round(layer.scale*100)}"></div><label><input id="layerFlip" type="checkbox" ${layer.flip?'checked':''}> Flip this body part</label><label style="margin-top:10px"><input id="layerHidden" type="checkbox" ${layer.hidden?'checked':''}> Hide layer</label><div class="row" style="margin-top:12px"><button id="copyTransformBtn">Copy transform</button><button id="pasteTransformBtn">Paste transform</button></div><p class="hint">Bend tools, guides, and exports will be ported next as separate files instead of being buried in one giant script.</p>`;
  };
  let pickedAssetId = null; let copiedTransform = null;
  const draw = async () => {
    const canvas = BoltWorks.$('#characterCanvas'); if (!canvas) return;
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle='rgba(255,255,255,.15)'; ctx.beginPath(); ctx.moveTo(60,520); ctx.lineTo(452,520); ctx.stroke();
    for (const layer of currentFrame().layers) {
      if (layer.hidden) continue;
      const asset = BoltWorks.State.assetById(layer.assetId);
      ctx.save(); ctx.translate(layer.x*2, layer.y*2); ctx.rotate((layer.rotation||0)*Math.PI/180); ctx.scale(layer.flip?-layer.scale:layer.scale, layer.scale);
      if (asset) { const img = await BoltWorks.loadImage(asset.dataUrl); ctx.drawImage(img, -img.width/2, -img.height/2); }
      else { ctx.fillStyle = layer.id.includes('head') ? '#bd9474' : layer.id.includes('torso') ? '#3c655a' : '#9b7b62'; ctx.fillRect(-22,-45,44,90); }
      if (layer.id === view.selectedLayerId) { ctx.strokeStyle='#ffe27a'; ctx.setLineDash([7,5]); ctx.lineWidth=2; ctx.strokeRect(-34,-58,68,116); }
      ctx.restore();
    }
  };
  const mutateLayer = fn => { const l=currentFrame().layers.find(x=>x.id===view.selectedLayerId); if(l){fn(l); BoltWorks.State.saveLocal(); draw();} };
  const afterRender = () => {
    const p = BoltWorks.State.getProject(); const anim = currentAnim();
    BoltWorks.$('#animSelect')?.addEventListener('change', e=>{p.character.activeAnimation=e.target.value; view.frameIndex=0; view.selectedLayerId=null; BoltWorks.State.saveLocal(); BoltWorks.Shell.render();});
    BoltWorks.$('#addAnimBtn')?.addEventListener('click',()=>{const n=prompt('Animation name','New animation'); if(n&&!p.character.animations[n]){p.character.animations[n]={fps:8,loop:'normal',facing:'right',frames:[BoltWorks.State.defaultFrame()]}; p.character.activeAnimation=n; view.frameIndex=0; BoltWorks.State.saveLocal(); BoltWorks.Shell.render();}});
    const setFps=v=>{anim.fps=Number(v)||8; BoltWorks.State.saveLocal(); const n=BoltWorks.$('#animFpsNum'), r=BoltWorks.$('#animFps'); if(n)n.value=anim.fps; if(r)r.value=anim.fps;};
    BoltWorks.$('#animFps')?.addEventListener('input', e=>setFps(e.target.value)); BoltWorks.$('#animFpsNum')?.addEventListener('change', e=>setFps(e.target.value));
    BoltWorks.$$('.layerPick,.layer-row').forEach(el=>el.onclick=e=>{view.selectedLayerId=(e.currentTarget.dataset.id); BoltWorks.Shell.render();});
    BoltWorks.$$('.toggleLayer').forEach(b=>b.onclick=e=>{e.stopPropagation(); const l=currentFrame().layers.find(x=>x.id===b.dataset.id); if(l){l.hidden=!l.hidden; BoltWorks.State.saveLocal(); BoltWorks.Shell.render();}});
    BoltWorks.$('#deselectLayerBtn')?.addEventListener('click',()=>{view.selectedLayerId=null; BoltWorks.Shell.render();});
    BoltWorks.$('#charAssetShelf')?.addEventListener('change', e=>{view.selectedAssetShelf=e.target.value; BoltWorks.Shell.render();});
    BoltWorks.$$('.char-asset').forEach(c=>c.onclick=()=>{pickedAssetId=c.dataset.id; BoltWorks.$$('.char-asset').forEach(x=>x.classList.toggle('active',x.dataset.id===pickedAssetId));});
    BoltWorks.$('#assignAssetBtn')?.addEventListener('click',()=>{ if(!view.selectedLayerId) return alert('Select a body layer first.'); if(!pickedAssetId) return alert('Pick an asset first.'); mutateLayer(l=>l.assetId=pickedAssetId); BoltWorks.Shell.render(); });
    [['layerX','x'],['layerY','y']].forEach(([id,key])=>BoltWorks.$('#'+id)?.addEventListener('change',e=>mutateLayer(l=>l[key]=Number(e.target.value)||0)));
    const syncRot=v=>mutateLayer(l=>l.rotation=Number(v)||0); BoltWorks.$('#layerRot')?.addEventListener('input',e=>syncRot(e.target.value)); BoltWorks.$('#layerRotNum')?.addEventListener('change',e=>syncRot(e.target.value));
    const syncScale=v=>mutateLayer(l=>l.scale=(Number(v)||100)/100); BoltWorks.$('#layerScale')?.addEventListener('input',e=>syncScale(e.target.value)); BoltWorks.$('#layerScaleNum')?.addEventListener('change',e=>syncScale(e.target.value));
    BoltWorks.$('#layerFlip')?.addEventListener('change',e=>mutateLayer(l=>l.flip=e.target.checked)); BoltWorks.$('#layerHidden')?.addEventListener('change',e=>mutateLayer(l=>l.hidden=e.target.checked));
    BoltWorks.$('#copyTransformBtn')?.addEventListener('click',()=>{ const l=currentFrame().layers.find(x=>x.id===view.selectedLayerId); if(l) copiedTransform={x:l.x,y:l.y,rotation:l.rotation,scale:l.scale,flip:l.flip}; });
    BoltWorks.$('#pasteTransformBtn')?.addEventListener('click',()=>{ if(copiedTransform) mutateLayer(l=>Object.assign(l,copiedTransform)); });
    BoltWorks.$('#prevFrameBtn')?.addEventListener('click',()=>{view.frameIndex=Math.max(0,view.frameIndex-1); BoltWorks.Shell.render();}); BoltWorks.$('#nextFrameBtn')?.addEventListener('click',()=>{view.frameIndex=Math.min(anim.frames.length-1,view.frameIndex+1); BoltWorks.Shell.render();});
    BoltWorks.$('#newFrameBtn')?.addEventListener('click',()=>{anim.frames.push(BoltWorks.State.defaultFrame()); view.frameIndex=anim.frames.length-1; BoltWorks.State.saveLocal(); BoltWorks.Shell.render();});
    BoltWorks.$('#dupFrameBtn')?.addEventListener('click',()=>{anim.frames.splice(view.frameIndex+1,0,JSON.parse(JSON.stringify(currentFrame()))); view.frameIndex++; BoltWorks.State.saveLocal(); BoltWorks.Shell.render();});
    BoltWorks.$('#deleteFrameBtn')?.addEventListener('click',()=>{if(anim.frames.length>1){anim.frames.splice(view.frameIndex,1); view.frameIndex=Math.max(0,view.frameIndex-1); BoltWorks.State.saveLocal(); BoltWorks.Shell.render();}});
    draw();
  };
  return { title, left, center, right, afterRender };
})();
