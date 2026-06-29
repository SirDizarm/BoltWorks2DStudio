window.BoltWorks = window.BoltWorks || {};
BoltWorks.AssetStudio = (() => {
  const title = 'Asset Studio';
  const view = { shelf: 'all', query: '', bgColor: { r: 128, g: 136, b: 128 }, tolerance: 28, removeMode: 'global', removePreview: true, trim: true, selection: null, pickingBg: false, copiedSelection: null };
  const filteredAssets = () => {
    const p = BoltWorks.State.getProject();
    return p.assets.filter(a => (view.shelf === 'all' || a.shelf === view.shelf) && (!view.query || a.name.toLowerCase().includes(view.query.toLowerCase())));
  };
  const left = () => {
    const p = BoltWorks.State.getProject();
    return `<h2 class="module-title">Asset Studio</h2><p class="hint">Import, clean, crop, and sort source art into shelves.</p>
      <div class="section"><button id="importAssetsBtn" class="accent" style="width:100%">+ Import images</button><button id="placeAssetHintBtn" style="width:100%;margin-top:8px">Place selected in scene</button></div>
      <div class="section"><label>Search<input id="assetSearch" value="${BoltWorks.escapeHtml(view.query)}" placeholder="Search assets..."></label><label style="margin-top:10px">Studio shelf<select id="assetShelfFilter"><option value="all">All assets</option>${p.shelves.map(s=>`<option ${view.shelf===s?'selected':''}>${s}</option>`).join('')}</select></label></div>
      <div class="asset-grid">${filteredAssets().map(assetCard).join('') || '<div class="empty">No assets yet.</div>'}</div>`;
  };
  const assetCard = a => `<div class="asset-card ${a.id===BoltWorks.State.getProject().selectedAssetId?'active':''}" data-id="${a.id}"><img class="checker" src="${a.dataUrl}"><strong>${BoltWorks.escapeHtml(a.name)}</strong><span>${a.width} × ${a.height} · ${BoltWorks.escapeHtml(a.shelf || 'Working')}</span></div>`;
  const center = () => {
    const asset = BoltWorks.State.assetById(BoltWorks.State.getProject().selectedAssetId);
    if (!asset) return `<div class="empty">Import or select an asset to begin.</div>`;
    return `<div class="stage-card">
      <div class="toolbar"><button id="selectToolBtn" class="active">Select</button><button id="pickBgBtn">Pick background color</button><label style="min-width:230px">Remove mode<select id="removeModeSelect"><option value="global" ${view.removeMode==='global'?'selected':''}>Global color / old tolerance</option><option value="outside" ${view.removeMode==='outside'?'selected':''}>Outside connected color only</option></select></label><label class="row" style="width:auto"><input id="removePreviewCheck" type="checkbox" ${view.removePreview?'checked':''}> Preview removal</label><label class="row" style="width:auto"><input id="trimCheck" type="checkbox" ${view.trim?'checked':''}> Trim transparent edges</label></div>
      <div class="slider-row"><span>Tolerance</span><input id="toleranceSlider" type="range" min="0" max="140" value="${view.tolerance}"><input id="toleranceNumber" type="number" value="${view.tolerance}"></div>
      <div class="row wrap" style="margin-bottom:12px"><span class="small">Background color</span><span id="bgSwatch" style="display:inline-block;width:34px;height:24px;border:1px solid var(--line);background:rgb(${view.bgColor.r},${view.bgColor.g},${view.bgColor.b})"></span><button id="makeTransparentCopyBtn" class="accent">Create transparent copy</button><button id="applyTransparentBtn">Apply to this asset</button><button id="downloadTransparentBtn">Download transparent PNG</button></div>
      <div class="row wrap" style="margin-bottom:12px"><strong style="color:var(--accent-2)">Selected sprite</strong><label style="width:90px">X<input id="selX" type="number" value="${view.selection?.x ?? ''}"></label><label style="width:90px">Y<input id="selY" type="number" value="${view.selection?.y ?? ''}"></label><label style="width:90px">W<input id="selW" type="number" value="${view.selection?.w ?? ''}"></label><label style="width:90px">H<input id="selH" type="number" value="${view.selection?.h ?? ''}"></label><button id="saveSelectionBtn" class="accent">Save selection to library</button><button id="copySelectionBtn">Copy selection</button><button id="pasteSelectionBtn" ${view.copiedSelection?'':'disabled'}>Paste copied selection</button><button id="downloadSelectionBtn">Download selected PNG</button></div>
      <div class="asset-canvas-wrap checker"><canvas id="assetCanvas"></canvas></div>
      <p class="canvas-note">Drag a rectangle around a sprite. Tip: copy a selected part, switch assets, then draw/select where it should paste.</p>
    </div>`;
  };
  const right = () => {
    const p = BoltWorks.State.getProject(); const asset = BoltWorks.State.assetById(p.selectedAssetId);
    if (!asset) return `<div class="inspector-title">Inspector</div><p class="hint">No asset selected.</p>`;
    return `<div class="inspector-title">Asset</div><label>Name<input id="assetName" value="${BoltWorks.escapeHtml(asset.name)}"></label><label style="margin-top:10px">Asset shelf<select id="assetShelf">${p.shelves.map(s=>`<option ${asset.shelf===s?'selected':''}>${s}</option>`).join('')}</select></label><p class="hint">${asset.width} × ${asset.height} pixels · placed ${asset.placedCount || 0} times</p><div class="row wrap"><button id="downloadAssetBtn">Download saved image</button><button id="deleteAssetBtn" class="danger">Delete asset</button></div>`;
  };
  let dragStart = null;
  const drawAsset = async () => {
    const canvas = BoltWorks.$('#assetCanvas'); const asset = BoltWorks.State.assetById(BoltWorks.State.getProject().selectedAssetId); if (!canvas || !asset) return;
    const src = view.removePreview ? await BoltWorks.ImageUtils.removeBackground(asset.dataUrl, view.bgColor, view.tolerance, false, view.removeMode) : asset.dataUrl;
    const img = await BoltWorks.loadImage(src);
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingEnabled = false; ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0);
    if (view.selection) { ctx.strokeStyle='#ffe27a'; ctx.lineWidth=2; ctx.setLineDash([8,5]); ctx.strokeRect(view.selection.x, view.selection.y, view.selection.w, view.selection.h); ctx.setLineDash([]); }
  };
  const transparentData = async () => {
    const asset = BoltWorks.State.assetById(BoltWorks.State.getProject().selectedAssetId); if (!asset) return null;
    return BoltWorks.ImageUtils.removeBackground(asset.dataUrl, view.bgColor, view.tolerance, view.trim, view.removeMode);
  };
  const selectionSourceData = async () => {
    const asset = BoltWorks.State.assetById(BoltWorks.State.getProject().selectedAssetId);
    if (!asset) return null;
    return view.removePreview
      ? BoltWorks.ImageUtils.removeBackground(asset.dataUrl, view.bgColor, view.tolerance, false, view.removeMode)
      : asset.dataUrl;
  };
  const copySelectionData = async () => {
    const asset = BoltWorks.State.assetById(BoltWorks.State.getProject().selectedAssetId);
    if (!asset || !view.selection) return null;
    const src = await selectionSourceData();
    const dataUrl = await BoltWorks.ImageUtils.cropDataUrl(src, view.selection.x, view.selection.y, view.selection.w, view.selection.h);
    const meta = await BoltWorks.ImageUtils.canvasToAssetData(dataUrl);
    return { dataUrl, width: meta.width, height: meta.height, sourceAssetId: asset.id, sourceName: asset.name };
  };
  const pasteCopiedSelection = async () => {
    const asset = BoltWorks.State.assetById(BoltWorks.State.getProject().selectedAssetId);
    const clip = view.copiedSelection;
    if (!asset || !clip) return;
    const base = await BoltWorks.loadImage(asset.dataUrl);
    const pasted = await BoltWorks.loadImage(clip.dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = base.width;
    canvas.height = base.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0);
    const x = view.selection ? view.selection.x : Math.round((base.width - pasted.width) / 2);
    const y = view.selection ? view.selection.y : Math.round((base.height - pasted.height) / 2);
    ctx.drawImage(pasted, x, y);
    const dataUrl = canvas.toDataURL('image/png');
    BoltWorks.State.updateAsset(asset.id, { dataUrl, width: canvas.width, height: canvas.height, editedAt: new Date().toISOString() });
  };
  const saveDataAsAsset = async (name, dataUrl, shelf = 'Working') => {
    const meta = await BoltWorks.ImageUtils.canvasToAssetData(dataUrl);
    BoltWorks.State.addAsset({ id: BoltWorks.uid('asset'), name, shelf, dataUrl, width: meta.width, height: meta.height, placedCount: 0, createdAt: new Date().toISOString() });
  };
  const afterRender = () => {
    BoltWorks.$('#importAssetsBtn')?.addEventListener('click', () => BoltWorks.$('#assetFileInput').click());
    BoltWorks.$('#assetFileInput').onchange = async e => {
      for (const file of Array.from(e.target.files || [])) {
        const dataUrl = await BoltWorks.fileToDataUrl(file); const meta = await BoltWorks.ImageUtils.canvasToAssetData(dataUrl);
        BoltWorks.State.addAsset({ id: BoltWorks.uid('asset'), name: file.name, shelf: 'Working', dataUrl, width: meta.width, height: meta.height, placedCount: 0, createdAt: new Date().toISOString() });
      }
      e.target.value=''; BoltWorks.Shell.render();
    };
    BoltWorks.$('#assetSearch')?.addEventListener('input', e => { view.query=e.target.value; BoltWorks.Shell.render(); });
    BoltWorks.$('#assetShelfFilter')?.addEventListener('change', e => { view.shelf=e.target.value; BoltWorks.Shell.render(); });
    BoltWorks.$$('.asset-card').forEach(c => c.onclick=()=>{ BoltWorks.State.getProject().selectedAssetId=c.dataset.id; view.selection=null; BoltWorks.State.saveLocal(); BoltWorks.Shell.render(); });
    BoltWorks.$('#assetName')?.addEventListener('change', e=>{ BoltWorks.State.updateAsset(BoltWorks.State.getProject().selectedAssetId,{name:e.target.value}); BoltWorks.Shell.render(); });
    BoltWorks.$('#assetShelf')?.addEventListener('change', e=>{ BoltWorks.State.updateAsset(BoltWorks.State.getProject().selectedAssetId,{shelf:e.target.value}); BoltWorks.Shell.render(); });
    BoltWorks.$('#deleteAssetBtn')?.addEventListener('click',()=>{ if(confirm('Delete this asset from this project?')){BoltWorks.State.deleteAsset(BoltWorks.State.getProject().selectedAssetId); BoltWorks.Shell.render();} });
    const syncTolerance = v => { view.tolerance = Number(v); const n=BoltWorks.$('#toleranceNumber'), s=BoltWorks.$('#toleranceSlider'); if(n) n.value=view.tolerance; if(s) s.value=view.tolerance; drawAsset(); };
    BoltWorks.$('#toleranceSlider')?.addEventListener('input', e=>syncTolerance(e.target.value));
    BoltWorks.$('#toleranceNumber')?.addEventListener('change', e=>syncTolerance(e.target.value));
    BoltWorks.$('#removeModeSelect')?.addEventListener('change', e=>{view.removeMode=e.target.value; drawAsset();});
    BoltWorks.$('#removePreviewCheck')?.addEventListener('change', e=>{view.removePreview=e.target.checked; drawAsset();});
    BoltWorks.$('#trimCheck')?.addEventListener('change', e=>{view.trim=e.target.checked;});
    BoltWorks.$('#pickBgBtn')?.addEventListener('click',()=>{view.pickingBg=true; BoltWorks.Shell.setStatus('Click the image to pick a background color.');});
    BoltWorks.$('#makeTransparentCopyBtn')?.addEventListener('click', async()=>{ const d=await transparentData(); if(d){await saveDataAsAsset('transparent copy.png', d, BoltWorks.State.assetById(BoltWorks.State.getProject().selectedAssetId)?.shelf || 'Working'); BoltWorks.Shell.render();} });
    BoltWorks.$('#applyTransparentBtn')?.addEventListener('click', async()=>{ const id=BoltWorks.State.getProject().selectedAssetId; const d=await transparentData(); const meta=await BoltWorks.ImageUtils.canvasToAssetData(d); BoltWorks.State.updateAsset(id,{dataUrl:d,width:meta.width,height:meta.height}); BoltWorks.Shell.render(); });
    BoltWorks.$('#downloadTransparentBtn')?.addEventListener('click', async()=>{ const d=await transparentData(); if(d) BoltWorks.downloadDataUrl('transparent.png', d); });
    BoltWorks.$('#downloadAssetBtn')?.addEventListener('click',()=>{ const a=BoltWorks.State.assetById(BoltWorks.State.getProject().selectedAssetId); if(a) BoltWorks.downloadDataUrl(a.name, a.dataUrl); });
    ['selX','selY','selW','selH'].forEach(id=>BoltWorks.$('#'+id)?.addEventListener('change',()=>{ view.selection={ x:Number(BoltWorks.$('#selX').value)||0, y:Number(BoltWorks.$('#selY').value)||0, w:Number(BoltWorks.$('#selW').value)||1, h:Number(BoltWorks.$('#selH').value)||1 }; drawAsset(); }));
    BoltWorks.$('#saveSelectionBtn')?.addEventListener('click', async()=>{ const a=BoltWorks.State.assetById(BoltWorks.State.getProject().selectedAssetId); if(!a||!view.selection) return alert('Select a sprite area first.'); const src=await selectionSourceData(); const d=await BoltWorks.ImageUtils.cropDataUrl(src, view.selection.x, view.selection.y, view.selection.w, view.selection.h); await saveDataAsAsset(`${a.name.replace(/\.[^.]+$/,'')}_sprite.png`, d, a.shelf); BoltWorks.Shell.render(); });
    BoltWorks.$('#copySelectionBtn')?.addEventListener('click', async()=>{ const copied=await copySelectionData(); if(!copied) return alert('Select a sprite area first.'); view.copiedSelection=copied; BoltWorks.Shell.setStatus(`Copied ${copied.width} x ${copied.height}px from ${copied.sourceName}.`); BoltWorks.Shell.render(); });
    BoltWorks.$('#pasteSelectionBtn')?.addEventListener('click', async()=>{ if(!view.copiedSelection) return; await pasteCopiedSelection(); BoltWorks.Shell.setStatus('Pasted copied selection into current asset.'); BoltWorks.Shell.render(); });
    BoltWorks.$('#downloadSelectionBtn')?.addEventListener('click', async()=>{ const a=BoltWorks.State.assetById(BoltWorks.State.getProject().selectedAssetId); if(!a||!view.selection) return; const src=await selectionSourceData(); const d=await BoltWorks.ImageUtils.cropDataUrl(src, view.selection.x, view.selection.y, view.selection.w, view.selection.h); BoltWorks.downloadDataUrl('selected-sprite.png', d); });
    const canvas = BoltWorks.$('#assetCanvas');
    if (canvas) {
      canvas.onmousedown = e => { const r=canvas.getBoundingClientRect(); const x=Math.floor((e.clientX-r.left)*canvas.width/r.width), y=Math.floor((e.clientY-r.top)*canvas.height/r.height); if(view.pickingBg){view.bgColor=BoltWorks.ImageUtils.pickPixel(canvas,x,y); view.pickingBg=false; BoltWorks.Shell.render(); return;} dragStart={x,y}; view.selection={x,y,w:1,h:1}; drawAsset(); };
      canvas.onmousemove = e => { if(!dragStart) return; const r=canvas.getBoundingClientRect(); const x=Math.floor((e.clientX-r.left)*canvas.width/r.width), y=Math.floor((e.clientY-r.top)*canvas.height/r.height); view.selection={x:Math.min(dragStart.x,x), y:Math.min(dragStart.y,y), w:Math.abs(x-dragStart.x)+1, h:Math.abs(y-dragStart.y)+1}; drawAsset(); };
      window.onmouseup = () => { dragStart=null; };
    }
    drawAsset();
  };
  return { title, left, center, right, afterRender };
})();


