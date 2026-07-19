(() => {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clone = value => JSON.parse(JSON.stringify(value));
  const bodyParts = ["backArm", "backLeg", "torso", "head", "frontLeg", "frontArm"];
  const prettyPart = { backArm:"Back arm", backLeg:"Back leg", torso:"Torso", head:"Head", frontLeg:"Front leg", frontArm:"Front arm" };
  const builtInStates = ["standing", "idle", "walking", "running", "crawling", "jumping", "sitting"];
  const directions = ["right", "left", "forward", "back"];
  const directionLabels = { right:"right", left:"left", forward:"toward-screen", back:"away" };
  const directionViewNames = { right:"right-side", left:"left-side", forward:"front-facing", back:"back-facing" };
  const storageKey = "boltworks-character-animator";
  const canvas = $("#characterCanvas");
  const ctx = canvas.getContext("2d");
  const images = new Map();
  let state = loadWorkspace();
  let animationState = "standing";
  let animationDirection = "forward";
  let frameIndex = 0;
  let selectedPart = "torso";
  let selectedAssetId = null;
  let assetQuery = "";
  let zoom = 1;
  let playing = false;
  let lastStep = 0;
  let drag = null;
  let selectedGuideId = null;
  let showGuides = true;
  let showBendGuides = true;
  let clipboard = null;
  let undoStack = [];
  let saveTimer = null;

  function defaultTransform(part, assetId = null) {
    const positions = { backArm:[98,150,4], backLeg:[116,218,0], torso:[128,172,0], head:[128,96,0], frontLeg:[140,218,0], frontArm:[158,150,-4] };
    const [x,y,rotation] = positions[part];
    return { assetId, x, y, rotation, scale:1, widthScale:1, heightScale:1, brightness:1, flip:false, sheetColumns:1, sheetRows:1, sheetCell:1, bendEnabled:false, bend:0, bendZone:25, bendAxis:"bottom", toeBendEnabled:false, toeBend:0, toeBendZone:12, toeCutAxis:"same", shoeMoveX:0, shoeMoveY:0, toeMoveX:0, toeMoveY:0 };
  }
  function baseFrame(rig = {}) {
    return { parts:Object.fromEntries(bodyParts.map(part => [part, defaultTransform(part, rig[part] || null)])) };
  }
  function posedFrame(rig, changes) {
    const frame = baseFrame(rig);
    Object.entries(changes).forEach(([part, values]) => Object.assign(frame.parts[part], values));
    return frame;
  }
  function directionalWalkFrames(rig = {}, direction = "forward", running = false) {
    const stride = running ? 1.35 : 1;
    const phases = [-1, -.35, .35, 1];
    return phases.map((phase, index) => {
      const leftLift = index < 2 ? (index === 0 ? 10 : 4) * stride : 0;
      const rightLift = index >= 2 ? (index === 3 ? 10 : 4) * stride : 0;
      const away = direction === "back";
      return posedFrame(rig, {
        backArm: {
          x: 104 + phase * 3,
          y: 148 + phase * 5,
          rotation: phase * (away ? -12 : 12) * stride,
          scale: away ? .94 : 1
        },
        frontArm: {
          x: 152 - phase * 3,
          y: 148 - phase * 5,
          rotation: -phase * (away ? -12 : 12) * stride,
          scale: away ? .94 : 1
        },
        backLeg: {
          x: 117 - phase * 2,
          y: 218 - leftLift,
          rotation: -phase * 7 * stride
        },
        frontLeg: {
          x: 139 + phase * 2,
          y: 218 - rightLift,
          rotation: phase * 7 * stride
        },
        torso: {
          x: 128 + phase * (away ? -1 : 1),
          y: 172 - (index === 1 || index === 2 ? 3 : 0) * stride,
          rotation: phase * (away ? -1.5 : 1.5)
        },
        head: {
          x: 128 + phase * (away ? -1 : 1),
          y: 96 - (index === 1 || index === 2 ? 3 : 0) * stride,
          rotation: phase * (away ? -1 : 1)
        }
      });
    });
  }
  function createCharacter(rig = {}) {
    const walk = [-1,-.35,.35,1].map(phase => posedFrame(rig, { backArm:{rotation:phase*18+6}, frontArm:{rotation:-phase*18-6}, backLeg:{rotation:-phase*14,x:116-phase*3}, frontLeg:{rotation:phase*14,x:140+phase*3}, torso:{y:172+Math.abs(phase)*2}, head:{y:96+Math.abs(phase)*2} }));
    const character = {
      width:256, height:320, fps:8, partOrder:[...bodyParts], lockedParts:["head","torso"], guides:[], partNames:Object.fromEntries(directions.map(direction=>[direction,{}])),
      animationFps:Object.fromEntries(builtInStates.map(name => [name, name === "running" ? 14 : 8])),
      loopMode:Object.fromEntries(builtInStates.map(name => [name, ["walking","running"].includes(name) ? "pingpong" : "normal"])),
      animations:{
        standing:[baseFrame(rig)], idle:[baseFrame(rig),posedFrame(rig,{torso:{y:170},head:{y:94}}),baseFrame(rig)], walking:walk,
        running:walk.map(frame => { const next=clone(frame); bodyParts.forEach(part => next.parts[part].rotation*=1.5); return next; }),
        crawling:[posedFrame(rig,{head:{x:184,y:184},torso:{x:132,y:204,rotation:78},backArm:{x:178,y:232,rotation:62},frontArm:{x:200,y:230,rotation:92},backLeg:{x:96,y:234,rotation:-45},frontLeg:{x:118,y:236,rotation:-72}})],
        jumping:[posedFrame(rig,{torso:{y:148},head:{y:72},backArm:{rotation:-45},frontArm:{rotation:45},backLeg:{rotation:-18},frontLeg:{rotation:18}})],
        sitting:[posedFrame(rig,{torso:{y:178},head:{y:102},backLeg:{x:116,y:232,rotation:72},frontLeg:{x:140,y:232,rotation:72}})]
      }
    };
    character.directionAnimations = {
      left: Object.fromEntries(Object.entries(character.animations).map(([name, frames]) => [name, clone(frames)])),
      forward: {
        ...Object.fromEntries(Object.entries(character.animations).map(([name, frames]) => [name, clone(frames)])),
        walking: directionalWalkFrames(rig, "forward"),
        running: directionalWalkFrames(rig, "forward", true)
      },
      back: {
        ...Object.fromEntries(Object.entries(character.animations).map(([name, frames]) => [name, clone(frames)])),
        walking: directionalWalkFrames(rig, "back"),
        running: directionalWalkFrames(rig, "back", true)
      }
    };
    return character;
  }
  function normalizeCharacter(input, rig = {}) {
    const fallback = createCharacter(rig);
    if (!input?.animations) return fallback;
    const result = { ...fallback, ...input, width:clamp(+input.width||256,64,1024), height:clamp(+input.height||320,64,1024) };
    result.partOrder = [...new Set([...(input.partOrder||[]).filter(p => bodyParts.includes(p)), ...bodyParts])];
    result.lockedParts = (input.lockedParts||[]).filter(p => bodyParts.includes(p));
    const incomingPartNames=input.partNames||input.directionPartNames||{};
    result.partNames=Object.fromEntries(directions.map(direction=>[direction,Object.fromEntries(bodyParts.flatMap(part=>{
      const name=incomingPartNames?.[direction]?.[part];
      return typeof name==="string"&&name.trim()?[[part,name.trim().slice(0,60)]]:[];
    }))]));
    result.guides = (input.guides||[]).map(g => ({ id:g.id||uid(), axis:g.axis === "y" ? "y":"x", value:+g.value||0 }));
    result.animations = {};
    Object.entries(input.animations).forEach(([name, frames]) => {
      result.animations[name] = (Array.isArray(frames)&&frames.length ? frames:[baseFrame(rig)]).map(frame => {
        const normalized = baseFrame(rig);
        bodyParts.forEach(part => Object.assign(normalized.parts[part], frame.parts?.[part]||{}));
        return normalized;
      });
    });
    builtInStates.forEach(name => { if (!result.animations[name]) result.animations[name] = fallback.animations[name]; });
    result.directionAnimations = { left:{}, forward:{}, back:{} };
    ["left","forward","back"].forEach(direction => {
      const incoming = input.directionAnimations?.[direction] || {};
      Object.keys(result.animations).forEach(name => {
        const frames = Array.isArray(incoming[name]) && incoming[name].length ? incoming[name] : fallback.directionAnimations[direction]?.[name] || result.animations[name];
        result.directionAnimations[direction][name] = frames.map(frame => {
          const normalized = baseFrame(rig);
          bodyParts.forEach(part => Object.assign(normalized.parts[part], frame.parts?.[part]||{}));
          return normalized;
        });
      });
    });
    result.animationFps = { ...fallback.animationFps, ...(input.animationFps||{}) };
    result.loopMode = { ...fallback.loopMode, ...(input.loopMode||{}) };
    return result;
  }
  function emptyWorkspace() {
    const rig = Object.fromEntries(bodyParts.map(part => [part,null]));
    return { name:"BoltWorks Character", rig, assets:[], character:createCharacter(rig) };
  }
  function loadWorkspace() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved) return { ...emptyWorkspace(), ...saved, character:normalizeCharacter(saved.character,saved.rig||{}) };
    } catch {}
    return emptyWorkspace();
  }
  function pushUndo() {
    undoStack.push({ state:clone(state), animationState, animationDirection, frameIndex, selectedPart });
    if (undoStack.length > 50) undoStack.shift();
  }
  function markDirty() {
    $("#saveState").textContent = "Saving…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(state)); $("#saveState").textContent = "Saved locally"; }
      catch { $("#saveState").textContent = "Autosave unavailable"; }
    }, 250);
  }
  function assetImage(id) { return id ? images.get(id) : null; }
  function rebuildImages() {
    images.clear();
    state.assets.forEach(asset => {
      const image = new Image();
      image.onload = draw;
      image.src = asset.src;
      images.set(asset.id,image);
    });
  }
  function directionAnimations(direction = animationDirection) {
    if (direction === "right") return state.character.animations;
    state.character.directionAnimations ||= { left:{}, forward:{}, back:{} };
    state.character.directionAnimations[direction] ||= {};
    return state.character.directionAnimations[direction];
  }
  function ensureDirectionAnimation(name, direction = animationDirection) {
    const store = directionAnimations(direction);
    if (!store[name]) store[name] = clone(state.character.animations[name] || state.character.animations.standing);
    return store[name];
  }
  function animationNames() { return [...new Set([...builtInStates,...Object.keys(state.character.animations),...directions.flatMap(direction=>Object.keys(directionAnimations(direction)))])]; }
  function currentFrames() { return ensureDirectionAnimation(animationState); }
  function currentFrame() { frameIndex=clamp(frameIndex,0,currentFrames().length-1); return currentFrames()[frameIndex]; }
  function currentTransform() { return selectedPart ? currentFrame().parts[selectedPart] : null; }
  function partLabel(part,direction=animationDirection){return state.character.partNames?.[direction]?.[part]||prettyPart[part]}
  function playbackIndexes() {
    const indexes=currentFrames().map((_,i)=>i);
    return state.character.loopMode[animationState] === "pingpong" && indexes.length>2 ? [...indexes,...indexes.slice(1,-1).reverse()] : indexes;
  }
  function escapeHtml(value) { return String(value??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]); }
  function render() {
    $("#characterName").value=state.name;
    const names=animationNames();
    $("#animationState").innerHTML=names.map(name=>`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    $("#animationState").value=animationState;
    $("#animationDirection").value=animationDirection;
    $("#copyForwardDirection").disabled=animationDirection==="forward";
    $("#animationDirectionHint").textContent=animationDirection==="right"?"Right-side view. Copy the front base here, then choose its sprite-sheet cells.":animationDirection==="left"?"Left-side view. Copy the front base here, then choose its sprite-sheet cells.":animationDirection==="forward"?"Front-facing base view: build the character and animation here first.":"Back view. Copy the front base here, then choose its sprite-sheet cells.";
    $("#copyAnimationSource").innerHTML=names.filter(n=>n!==animationState).map(name=>`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    $("#animationFps").value=state.character.animationFps[animationState]||8;
    $("#animationFpsValue").textContent=`${state.character.animationFps[animationState]||8} fps`;
    $("#animationLoopMode").value=state.character.loopMode[animationState]||"normal";
    renderParts(); renderAssets(); renderTimeline(); renderTransforms(); renderGuides(); draw();
  }
  function renderParts() {
    $("#animatorPartList").innerHTML=bodyParts.map((part,index)=>{
      const asset=state.assets.find(a=>a.id===currentFrame().parts[part].assetId);
      return `<div class="animator-part ${part===selectedPart?"selected":""}" data-part="${part}"><span>${index+1}</span><div><strong>${escapeHtml(partLabel(part))}</strong><small>${asset?escapeHtml(asset.name):"placeholder"}</small></div></div>`;
    }).join("");
    $("#bodyLayerNameHint").textContent=`Names shown here belong only to the ${directionViewNames[animationDirection]} view.`;
    $("#renameCharacterPart").disabled=!selectedPart;
  }
  function renderAssets() {
    const query=assetQuery.toLowerCase();
    const assets=state.assets.filter(asset=>asset.name.toLowerCase().includes(query));
    $("#characterAssetGrid").innerHTML=assets.length?assets.map(asset=>`<div class="character-asset-card ${asset.id===selectedAssetId?"selected":""}" data-asset="${asset.id}"><img src="${asset.src}" alt=""><span>${escapeHtml(asset.name)}</span></div>`).join(""):`<p class="hint">Import body-part images to begin.</p>`;
    const hasSelection=!!selectedAsset();
    ["replaceCharacterAsset","renameCharacterAsset","saveCharacterAssetAs","deleteCharacterAsset","assignCharacterAsset"].forEach(id=>$("#"+id).disabled=!hasSelection);
  }
  function renderTimeline() {
    $("#characterTimeline").innerHTML=currentFrames().map((_,i)=>`<button class="character-frame ${i===frameIndex?"selected":""}" data-frame="${i}">Frame ${i+1}</button>`).join("");
    $("#characterFrameLabel").textContent=`Frame ${frameIndex+1} / ${currentFrames().length} · plays ${playbackIndexes().length} steps`;
    $("#playCharacterAnimation").textContent=playing?"Stop":"Preview";
  }
  function renderTransforms() {
    const t=currentTransform();
    $("#partLayerOrder").innerHTML=state.character.partOrder.map((part,i)=>`<div class="order-row ${part===selectedPart?"selected":""}" data-order-part="${part}"><span>${i+1}</span><span>${escapeHtml(partLabel(part))}</span><small>${i===0?"bottom":i===bodyParts.length-1?"top":""}</small></div>`).join("");
    $("#partLockList").innerHTML=bodyParts.map(part=>`<label class="lock-row"><input type="checkbox" data-lock-part="${part}" ${state.character.lockedParts.includes(part)?"checked":""}><span>${escapeHtml(partLabel(part))}</span></label>`).join("");
    $("#characterWidth").value=state.character.width; $("#characterHeight").value=state.character.height;
    $$(".animator-right input, .animator-right select, .animator-right button").forEach(control=>{if(!["characterWidth","characterHeight"].includes(control.id))control.disabled=!t});
    $(".animator-right").classList.toggle("controls-disabled",!t);
    if(!t){
      $("#selectedCharacterPart").textContent="No layer selected";
      ["partX","partY","partRotationNumber","partScaleNumber","partWidthScale","partHeightScale"].forEach(id=>$("#"+id).value="");
      $("#partRotationValue").textContent="—"; $("#partScaleValue").textContent="—";
      return;
    }
    $("#selectedCharacterPart").textContent=partLabel(selectedPart);
    $("#partX").value=Math.round(t.x); $("#partY").value=Math.round(t.y);
    $("#partRotation").value=t.rotation||0; $("#partRotationNumber").value=Math.round(t.rotation||0); $("#partRotationValue").textContent=`${Math.round(t.rotation||0)}°`;
    const scale=Math.round((t.scale||1)*100); $("#partScale").value=scale; $("#partScaleNumber").value=scale; $("#partScaleValue").textContent=`${scale}%`;
    $("#partWidthScale").value=Math.round((t.widthScale||1)*100); $("#partHeightScale").value=Math.round((t.heightScale||1)*100);
    const brightness=Math.round((t.brightness||1)*100); $("#partBrightness").value=brightness; $("#partBrightnessNumber").value=brightness; $("#partBrightnessValue").textContent=`${brightness}%`;
    $("#partFlip").checked=!!t.flip;
    const cols=clamp(Math.round(+t.sheetColumns||1),1,64),rows=clamp(Math.round(+t.sheetRows||1),1,64),total=cols*rows,cell=clamp(Math.round(+t.sheetCell||1),1,total);
    Object.assign(t,{sheetColumns:cols,sheetRows:rows,sheetCell:cell});
    $("#partSheetColumns").value=cols; $("#partSheetRows").value=rows;
    $("#partSheetCell").max=total; $("#partSheetCell").value=cell; $("#partSheetCellNumber").max=total; $("#partSheetCellNumber").value=cell; $("#partSheetCellValue").textContent=`${cell} / ${total}`;
    $("#partBendEnabled").checked=!!t.bendEnabled; $("#partBendAxis").value=["bottom","left","right"].includes(t.bendAxis)?t.bendAxis:"bottom";
    $("#partBend").value=Math.round(t.bend||0); $("#partBendValue").textContent=`${Math.round(t.bend||0)}°`;
    $("#partBendZone").value=Math.round(t.bendZone||25); $("#partBendZoneValue").textContent=`${Math.round(t.bendZone||25)}%`;
    $("#partToeBendEnabled").checked=!!t.toeBendEnabled; $("#partToeCutAxis").value=["same","bottom","left","right"].includes(t.toeCutAxis)?t.toeCutAxis:"same";
    $("#partToeBend").value=Math.round(t.toeBend||0); $("#partToeBendValue").textContent=`${Math.round(t.toeBend||0)}°`;
    const toeMax=t.toeCutAxis==="same"?Math.min(40,Math.max(1,Math.round((t.bendZone||25)-1))):100;
    $("#partToeBendZone").max=toeMax; $("#partToeBendZone").value=clamp(Math.round(t.toeBendZone||12),1,toeMax); $("#partToeBendZoneValue").textContent=`${Math.round(t.toeBendZone||12)}%`;
    [["partShoeMoveX","shoeMoveX"],["partShoeMoveY","shoeMoveY"],["partToeMoveX","toeMoveX"],["partToeMoveY","toeMoveY"]].forEach(([id,key])=>{$("#"+id).value=Math.round(t[key]||0);$("#"+id+"Value").textContent=`${Math.round(t[key]||0)}px`});
    $("#partShowBendGuides").checked=showBendGuides;
  }
  function renderGuides() {
    const guides=state.character.guides;
    $("#characterGuideList").innerHTML=guides.length?guides.map((g,i)=>`<div class="character-guide-row" data-guide="${g.id}"><strong>${g.axis==="x"?"Vertical":"Horizontal"}</strong><input data-guide-value="${g.id}" type="number" value="${Math.round(g.value)}" min="0" max="${g.axis==="x"?state.character.width:state.character.height}"><button data-delete-guide="${i}">×</button></div>`).join(""):`<p class="hint">No guides yet.</p>`;
  }
  function sourceRect(image,t) {
    const cols=clamp(Math.round(+t.sheetColumns||1),1,64),rows=clamp(Math.round(+t.sheetRows||1),1,64),cell=clamp(Math.round(+t.sheetCell||1),1,cols*rows)-1;
    const w=Math.max(1,Math.floor(image.naturalWidth/cols)),h=Math.max(1,Math.floor(image.naturalHeight/rows));
    return { x:(cell%cols)*w,y:Math.floor(cell/cols)*h,w,h };
  }
  function partSize(part,t) {
    const image=assetImage(t.assetId);
    const sx=(t.scale||1)*(t.widthScale||1),sy=(t.scale||1)*(t.heightScale||1);
    let w,h;
    if(image?.naturalWidth){const r=sourceRect(image,t);w=r.w*sx;h=r.h*sy}
    else{const fallback=part==="head"?[54,58]:part==="torso"?[68,94]:[30,90];w=fallback[0]*sx;h=fallback[1]*sy}
    return {w,h,width:w,height:h};
  }
  function partAnchor(part,size){return ["head","torso"].includes(part)?{x:-size.w/2,y:-size.h/2}:{x:-size.w/2,y:0}}
  function cellImage(image,t){
    const r=sourceRect(image,t),out=document.createElement("canvas");out.width=r.w;out.height=r.h;
    const c=out.getContext("2d");c.imageSmoothingEnabled=false;c.drawImage(image,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
    Object.defineProperty(out,"naturalWidth",{value:r.w});Object.defineProperty(out,"naturalHeight",{value:r.h});return out;
  }
  function drawBendable(target,image,anchor,size,t){
    const bend=clamp(+t.bend||0,-55,55),toeBend=clamp(+t.toeBend||0,-90,90),bendOn=!!t.bendEnabled&&Math.abs(bend)>.1,toeOn=!!t.toeBendEnabled&&Math.abs(toeBend)>.1;
    if(!bendOn&&!toeOn){target.drawImage(image,anchor.x,anchor.y,size.w,size.h);return}
    const axis=["bottom","left","right"].includes(t.bendAxis)?t.bendAxis:"bottom",zone=clamp(+t.bendZone||25,5,70)/100,toeAxis=["same","bottom","left","right"].includes(t.toeCutAxis)?t.toeCutAxis:"same",toeMax=toeAxis==="same"?Math.min(40,zone*100-1):100,toeZone=clamp(+t.toeBendZone||12,1,toeMax)/100;
    const br=bendOn?bend*Math.PI/180:0,tr=toeOn?toeBend*Math.PI/180:0,shoeX=+t.shoeMoveX||0,shoeY=+t.shoeMoveY||0,toeX=+t.toeMoveX||0,toeY=+t.toeMoveY||0,iw=image.naturalWidth,ih=image.naturalHeight;
    if(axis==="bottom"){
      const cutH=size.h*(1-zone),srcCut=ih*(1-zone);target.drawImage(image,0,0,iw,srcCut,anchor.x,anchor.y,size.w,cutH);
      target.save();target.translate(anchor.x+size.w/2+shoeX,anchor.y+cutH+shoeY);target.rotate(br);
      const endH=size.h-cutH,srcEnd=ih-srcCut;
      if(toeAxis==="left"||toeAxis==="right"){
        const tipW=size.w*toeZone,srcTip=iw*toeZone,right=toeAxis==="right";
        if(right)target.drawImage(image,0,srcCut,iw-srcTip,srcEnd,-size.w/2,0,size.w-tipW,endH);else target.drawImage(image,srcTip,srcCut,iw-srcTip,srcEnd,-size.w/2+tipW,0,size.w-tipW,endH);
        target.save();target.translate((right?size.w/2-tipW:-size.w/2+tipW)+toeX,toeY);target.rotate(tr);
        target.drawImage(image,right?iw-srcTip:0,srcCut,srcTip,srcEnd,right?0:-tipW,0,tipW,endH);target.restore();
      }else{
        const tipStart=size.h*(1-toeZone),srcTipStart=ih*(1-toeZone),midH=Math.max(1,tipStart-cutH),midSrc=Math.max(1,srcTipStart-srcCut);
        target.drawImage(image,0,srcCut,iw,midSrc,-size.w/2,0,size.w,midH);target.save();target.translate(toeX,midH+toeY);target.rotate(tr);target.drawImage(image,0,srcTipStart,iw,ih-srcTipStart,-size.w/2,0,size.w,size.h-tipStart);target.restore();
      }target.restore();return;
    }
    const right=axis==="right",cut=right?size.w*(1-zone):size.w*zone,srcCut=right?iw*(1-zone):iw*zone;
    if(right)target.drawImage(image,0,0,srcCut,ih,anchor.x,anchor.y,cut,size.h);else target.drawImage(image,srcCut,0,iw-srcCut,ih,anchor.x+cut,anchor.y,size.w-cut,size.h);
    target.save();target.translate(anchor.x+cut+shoeX,anchor.y+size.h/2+shoeY);target.rotate(br);
    const endW=right?size.w-cut:cut,srcEnd=right?iw-srcCut:srcCut;
    const effectiveToeAxis=toeAxis==="same"?axis:toeAxis;
    if(effectiveToeAxis==="bottom"){
      const tipH=size.h*toeZone,srcTipH=ih*toeZone;
      target.drawImage(image,right?srcCut:0,0,srcEnd,ih-srcTipH,right?0:-endW,-size.h/2,endW,size.h-tipH);
      target.save();target.translate(toeX,size.h/2-tipH+toeY);target.rotate(tr);target.drawImage(image,right?srcCut:0,ih-srcTipH,srcEnd,srcTipH,right?0:-endW,0,endW,tipH);target.restore();
    }else{
      const tipW=size.w*toeZone,srcTipW=iw*toeZone,midW=Math.max(1,endW-tipW),midSrc=Math.max(1,srcEnd-srcTipW);
      if(right){target.drawImage(image,srcCut,0,midSrc,ih,0,-size.h/2,midW,size.h);target.save();target.translate(midW+toeX,toeY);target.rotate(tr);target.drawImage(image,iw-srcTipW,0,srcTipW,ih,0,-size.h/2,tipW,size.h)}
      else{target.drawImage(image,srcTipW,0,midSrc,ih,-midW,-size.h/2,midW,size.h);target.save();target.translate(-midW+toeX,toeY);target.rotate(tr);target.drawImage(image,0,0,srcTipW,ih,-tipW,-size.h/2,tipW,size.h)}
      target.restore();
    }target.restore();
  }
  function drawBendGuides(target,anchor,size,t){
    const axis=["bottom","left","right"].includes(t.bendAxis)?t.bendAxis:"bottom",zone=clamp(+t.bendZone||25,5,70)/100,toeAxis=t.toeCutAxis||"same",toeZone=clamp(+t.toeBendZone||12,1,100)/100;
    const lines=[];
    if(axis==="bottom")lines.push([anchor.x,anchor.y+size.h*(1-zone),anchor.x+size.w,anchor.y+size.h*(1-zone),false]);
    else{const x=anchor.x+(axis==="right"?size.w*(1-zone):size.w*zone);lines.push([x,anchor.y,x,anchor.y+size.h,false])}
    const ta=toeAxis==="same"?axis:toeAxis;
    if(ta==="bottom")lines.push([anchor.x,anchor.y+size.h*(1-toeZone),anchor.x+size.w,anchor.y+size.h*(1-toeZone),true]);
    else{const x=anchor.x+(ta==="right"?size.w*(1-toeZone):size.w*toeZone);lines.push([x,anchor.y,x,anchor.y+size.h,true])}
    target.save();target.lineWidth=2;lines.forEach(([x1,y1,x2,y2,tip])=>{target.strokeStyle=tip?"#ff6b5f":"#ffd45f";target.setLineDash(tip?[3,3]:[7,4]);target.beginPath();target.moveTo(x1,y1);target.lineTo(x2,y2);target.stroke()});target.restore();
  }
  function paintFrame(target,frame,offsetX=0,offsetY=0,selection=false) {
    target.imageSmoothingEnabled=false;
    state.character.partOrder.forEach(part=>{
      const t=frame.parts[part],image=assetImage(t.assetId),size=partSize(part,t),anchor=partAnchor(part,size);
      target.save(); target.translate(offsetX+(+t.x||0),offsetY+(+t.y||0)); target.rotate((+t.rotation||0)*Math.PI/180); target.scale(t.flip?-1:1,1); target.filter=`brightness(${t.brightness||1})`;
      if(image?.naturalWidth)drawBendable(target,cellImage(image,t),anchor,size,t)
      else {target.fillStyle=part==="head"?"#b58f70":part==="torso"?"#3c5b52":"#4d5550"; if(part==="head"){target.beginPath();target.ellipse(0,0,size.w/2,size.h/2,0,0,Math.PI*2);target.fill()}else target.fillRect(anchor.x,anchor.y,size.w,size.h)}
      target.filter="none";
      if(selection&&part===selectedPart){target.strokeStyle="#ffe08b";target.lineWidth=2;target.setLineDash([5,3]);target.strokeRect(anchor.x-3,anchor.y-3,size.w+6,size.h+6);target.setLineDash([]);target.fillStyle="#ffe08b";target.fillRect(-4,-4,8,8);if(showBendGuides)drawBendGuides(target,anchor,size,t)}
      target.restore();
    });
  }
  function draw() {
    if(canvas.width!==state.character.width)canvas.width=state.character.width;
    if(canvas.height!==state.character.height)canvas.height=state.character.height;
    canvas.style.width=`${Math.round(canvas.width*zoom)}px`; canvas.style.height=`${Math.round(canvas.height*zoom)}px`;
    ctx.clearRect(0,0,canvas.width,canvas.height); paintFrame(ctx,currentFrame(),0,0,true);
    ctx.save();ctx.strokeStyle="#ffffff44";ctx.beginPath();ctx.moveTo(0,canvas.height-22);ctx.lineTo(canvas.width,canvas.height-22);ctx.stroke();
    if(showGuides)state.character.guides.forEach(g=>{ctx.strokeStyle=g.id===selectedGuideId?"#ff5d55":g.axis==="x"?"#48d8ff":"#ffd15a";ctx.setLineDash([8,4]);ctx.beginPath();if(g.axis==="x"){ctx.moveTo(g.value,0);ctx.lineTo(g.value,canvas.height)}else{ctx.moveTo(0,g.value);ctx.lineTo(canvas.width,g.value)}ctx.stroke()});ctx.restore();
  }
  function setZoom(value){zoom=clamp(value,.5,5);$("#characterZoom").value=Math.round(zoom*100);$("#characterZoomValue").textContent=`${Math.round(zoom*100)}%`;draw()}
  function lockedGroup(part){const locked=state.character.lockedParts;return locked.includes(part)?[...locked]:[part]}
  function pointFromEvent(event){const rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height}}
  function hitSelected(point){const t=currentTransform();if(!t)return false;const size=partSize(selectedPart,t),anchor=partAnchor(selectedPart,size),angle=-(t.rotation||0)*Math.PI/180,dx=point.x-t.x,dy=point.y-t.y,x=(dx*Math.cos(angle)-dy*Math.sin(angle))*(t.flip?-1:1),y=dx*Math.sin(angle)+dy*Math.cos(angle);return x>=anchor.x&&x<=anchor.x+size.w&&y>=anchor.y&&y<=anchor.y+size.h}
  function assignAsset(assetId) {if(!selectedPart)return alert("Select a body layer first.");pushUndo();const frames=$("#assignAllCharacterFrames").checked?currentFrames():[currentFrame()];frames.forEach(frame=>frame.parts[selectedPart].assetId=assetId);if(animationState==="standing")state.rig[selectedPart]=assetId;render();markDirty()}
  function changeTransform(key,value,allLocked=false){if(!selectedPart)return;const targets=allLocked?lockedGroup(selectedPart):[selectedPart];targets.forEach(part=>currentFrame().parts[part][key]=value);renderTransforms();draw();markDirty()}
  function moveLayer(direction){if(!selectedPart)return;const order=state.character.partOrder,index=order.indexOf(selectedPart),next=direction==="bottom"?0:direction==="top"?order.length-1:clamp(index+direction,0,order.length-1);if(index===next)return;pushUndo();order.splice(next,0,order.splice(index,1)[0]);render();markDirty()}
  function download(blob,name){const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)}
  function sanitizeFilename(name,fallback,extension=""){let clean=String(name||"").trim().replace(/[<>:"/\\|?*]+/g,"-").replace(/\s+/g," ").replace(/^\.+|\.+$/g,"")||fallback;if(extension&&!clean.toLowerCase().endsWith(extension.toLowerCase()))clean+=extension;return clean}
  async function saveBlobAs(blob,defaultName,extension,description="BoltWorks file"){
    const suggested=sanitizeFilename(defaultName,defaultName,extension);
    if(window.showSaveFilePicker){try{const handle=await window.showSaveFilePicker({suggestedName:suggested,types:[{description,accept:{[blob.type||"application/octet-stream"]:[extension]}}]});const writable=await handle.createWritable();await writable.write(blob);await writable.close();return handle.name||suggested}catch(error){if(error?.name==="AbortError")return null}}
    const picked=prompt("Save as filename:",suggested);if(picked===null)return null;const filename=sanitizeFilename(picked,suggested,extension);download(blob,filename);return filename;
  }
  function readFileDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)})}
  function installRangeSteppers(){
    $$("input[type=range]").forEach(input=>{
      if(input.closest(".range-stepper"))return;
      const wrapper=document.createElement("div"),decrease=document.createElement("button"),increase=document.createElement("button"),label=input.closest("label"),name=(label?.childNodes?.[0]?.textContent||input.id||"value").trim();
      wrapper.className="range-stepper";
      decrease.type=increase.type="button";decrease.textContent="−";increase.textContent="+";
      decrease.setAttribute("aria-label",`Decrease ${name}`);increase.setAttribute("aria-label",`Increase ${name}`);
      input.title="Use Left/Down to decrease and Right/Up to increase";
      input.parentNode.insertBefore(wrapper,input);wrapper.append(decrease,input,increase);
      const nudge=direction=>{if(input.disabled)return;direction<0?input.stepDown():input.stepUp();input.dispatchEvent(new Event("input",{bubbles:true}));input.focus()};
      decrease.onclick=()=>nudge(-1);increase.onclick=()=>nudge(1);
    });
  }
  function unpackCharacterBackup(raw,fileName="character backup"){
    const parsed=JSON.parse(String(raw||"").replace(/^\uFEFF/,"").trim());
    const container=parsed.project||parsed.workspace||parsed.state||parsed;
    const character=parsed.character||container.character||(container.animations?container:null);
    if(!character||!character.animations||typeof character.animations!=="object"||Array.isArray(character.animations))throw new Error("Missing character animations");
    const rig=parsed.rig||container.rig||{};
    const incomingAssets=Array.isArray(parsed.assets)?parsed.assets:Array.isArray(container.assets)?container.assets:[];
    const assets=incomingAssets.map((asset,index)=>({
      ...asset,
      id:String(asset?.id||uid()),
      name:String(asset?.name||asset?.fileName||`Body part ${index+1}`),
      src:asset?.src||asset?.dataUrl||asset?.data||asset?.image||asset?.url||"",
      category:asset?.category||"character"
    })).filter(asset=>asset.src);
    return {
      name:parsed.projectName||container.projectName||container.name||fileName.replace(/\.(?:boltchar|scrap-character(?:\.json)?|json)$/i,"")||"BoltWorks Character",
      rig,
      assets,
      character,
      animationState:parsed.animationState||parsed.characterState||container.animationState||container.characterState||"standing",
      animationDirection:parsed.animationDirection||container.animationDirection||character.animationDirection||character.facing||null,
      frameIndex:+(parsed.characterFrameIndex??parsed.frameIndex??container.characterFrameIndex??container.frameIndex??0)||0
    };
  }
  function directionAssetCount(character,direction){
    const store=direction==="right"?character.animations:character.directionAnimations?.[direction];
    return Object.values(store||{}).reduce((total,frames)=>total+(frames||[]).reduce((frameTotal,frame)=>frameTotal+bodyParts.filter(part=>frame.parts?.[part]?.assetId).length,0),0);
  }
  function loadedDirection(character,requested){
    if(directions.includes(requested))return requested;
    return directions.map(direction=>({direction,count:directionAssetCount(character,direction)})).sort((a,b)=>b.count-a.count)[0]?.direction||"right";
  }
  function restoreSavedTransforms(character,savedCharacter){
    const storePairs=[[character.animations,savedCharacter.animations]];
    ["left","forward","back"].forEach(direction=>storePairs.push([character.directionAnimations?.[direction],savedCharacter.directionAnimations?.[direction]]));
    storePairs.forEach(([targetStore,sourceStore])=>Object.entries(sourceStore||{}).forEach(([name,sourceFrames])=>{
      const targetFrames=targetStore?.[name];
      if(!Array.isArray(sourceFrames)||!Array.isArray(targetFrames))return;
      sourceFrames.forEach((sourceFrame,index)=>bodyParts.forEach(part=>{
        const source=sourceFrame.parts?.[part],target=targetFrames[index]?.parts?.[part];
        if(!source||!target)return;
        const columns=source.sheetColumns??source.sheetCols??source.columns;
        const rows=source.sheetRows??source.rows;
        let cell=source.sheetCell??source.cell??source.cellIndex;
        if(cell==null&&(source.sheetColumn!=null||source.sheetRow!=null))cell=(Math.max(0,+source.sheetRow||0)*Math.max(1,+columns||1))+Math.max(0,+source.sheetColumn||0)+1;
        const exact={
          scale:source.scale??source.uniformScale,
          widthScale:source.widthScale??source.scaleX,
          heightScale:source.heightScale??source.scaleY,
          sheetColumns:columns,
          sheetRows:rows,
          sheetCell:cell
        };
        Object.entries(exact).forEach(([key,value])=>{if(value!=null&&value!==""&&Number.isFinite(+value))target[key]=+value});
      }));
    }));
    return character;
  }
  function selectedAsset(){return state.assets.find(asset=>asset.id===selectedAssetId)||null}
  function clearAssetReferences(assetId){
    bodyParts.forEach(part=>{if(state.rig[part]===assetId)state.rig[part]=null});
    const stores=[state.character.animations,...Object.values(state.character.directionAnimations||{})];
    stores.forEach(store=>Object.values(store||{}).forEach(frames=>(frames||[]).forEach(frame=>bodyParts.forEach(part=>{if(frame.parts?.[part]?.assetId===assetId)frame.parts[part].assetId=null}))));
  }
  function safeName(){return (state.name||"boltworks-character").replace(/\W+/g,"-").replace(/^-|-$/g,"").toLowerCase()||"boltworks-character"}
  function exportStem(){return `${safeName()}-${animationState}-${directionLabels[animationDirection]}`}
  function exportCanvasFrames(){return playbackIndexes().map(i=>{const out=document.createElement("canvas");out.width=state.character.width;out.height=state.character.height;paintFrame(out.getContext("2d"),currentFrames()[i]);return out})}
  function rgbaToGifIndices(data){const indices=new Uint8Array(data.length/4);for(let i=0,j=0;i<data.length;i+=4,j++){if(data[i+3]<32)indices[j]=0;else{const r=Math.round(data[i]/51),g=Math.round(data[i+1]/51),b=Math.round(data[i+2]/51);indices[j]=1+r*36+g*6+b}}return indices}
  function lzwGif(indices,minCodeSize=8){const clear=1<<minCodeSize,end=clear+1,bytes=[];let bitBuffer=0,bitCount=0,codeSize=minCodeSize+1,next=end+1,dict=new Map();const reset=()=>{dict=new Map();codeSize=minCodeSize+1;next=end+1};const write=code=>{bitBuffer|=code<<bitCount;bitCount+=codeSize;while(bitCount>=8){bytes.push(bitBuffer&255);bitBuffer>>=8;bitCount-=8}};write(clear);reset();let prefix=indices[0]||0;for(let i=1;i<indices.length;i++){const value=indices[i],key=prefix+","+value;if(dict.has(key))prefix=dict.get(key);else{write(prefix);if(next<4096){dict.set(key,next++);if(next===(1<<codeSize)&&codeSize<12)codeSize++}else{write(clear);reset()}prefix=value}}write(prefix);write(end);if(bitCount)bytes.push(bitBuffer&255);return bytes}
  function encodeGif(frameCanvases,fps){const bytes=[],push=(...v)=>bytes.push(...v),word=v=>push(v&255,v>>8&255),text=s=>push(...[...s].map(c=>c.charCodeAt(0))),w=state.character.width,h=state.character.height;text("GIF89a");word(w);word(h);push(0xf7,0,0,0,0,0);for(let i=0;i<256;i++){if(i===0)push(0,0,0);else{const n=i-1;push(Math.floor(n/36)*51,Math.floor(n%36/6)*51,(n%6)*51)}}push(0x21,0xff,11);text("NETSCAPE2.0");push(3,1,0,0,0);frameCanvases.forEach(frame=>{const indices=rgbaToGifIndices(frame.getContext("2d").getImageData(0,0,w,h).data),data=lzwGif(indices);push(0x21,0xf9,4,1);word(Math.max(2,Math.round(100/fps)));push(0,0);push(0x2c);word(0);word(0);word(w);word(h);push(0);push(8);for(let i=0;i<data.length;i+=255){const block=data.slice(i,i+255);push(block.length,...block)}push(0)});push(0x3b);return new Blob([new Uint8Array(bytes)],{type:"image/gif"})}

  $("#characterName").oninput=e=>{state.name=e.target.value;markDirty()};
  $("#animationState").onchange=e=>{animationState=e.target.value;frameIndex=0;playing=false;render()};
  $("#animationDirection").onchange=e=>{animationDirection=e.target.value;ensureDirectionAnimation(animationState);frameIndex=0;playing=false;render();markDirty()};
  $("#copyForwardDirection").onclick=()=>{if(animationDirection==="forward")return;pushUndo();directionAnimations(animationDirection)[animationState]=clone(ensureDirectionAnimation(animationState,"forward"));frameIndex=0;render();markDirty()};
  $("#addCharacterAnimation").onclick=()=>{const name=prompt("Animation name:","custom");if(!name)return;const key=name.trim().toLowerCase().replace(/\s+/g,"-");if(!key||animationNames().includes(key))return alert("That animation already exists.");pushUndo();const base=clone(directionAnimations("forward").standing?.[0]||state.character.animations.standing[0]);state.character.animations[key]=[clone(base)];["left","forward","back"].forEach(direction=>directionAnimations(direction)[key]=[clone(base)]);state.character.animationFps[key]=8;state.character.loopMode[key]="normal";animationState=key;frameIndex=0;render();markDirty()};
  $("#copyAnimationTimeline").onclick=()=>{const source=$("#copyAnimationSource").value;if(!source)return;pushUndo();directionAnimations()[animationState]=clone(ensureDirectionAnimation(source));state.character.animationFps[animationState]=state.character.animationFps[source];state.character.loopMode[animationState]=state.character.loopMode[source];frameIndex=0;render();markDirty()};
  $("#animationFps").oninput=e=>{state.character.animationFps[animationState]=+e.target.value;$("#animationFpsValue").textContent=`${e.target.value} fps`;markDirty()};
  $("#animationLoopMode").onchange=e=>{state.character.loopMode[animationState]=e.target.value;renderTimeline();markDirty()};
  $("#animatorPartList").onclick=e=>{const row=e.target.closest("[data-part]");if(row){selectedPart=selectedPart===row.dataset.part?null:row.dataset.part;renderParts();renderTransforms();draw()}};
  $("#renameCharacterPart").onclick=()=>{if(!selectedPart)return alert("Select a body layer first.");const original=prettyPart[selectedPart],current=partLabel(selectedPart),name=prompt(`Name for this layer in the ${directionViewNames[animationDirection]} view:\n\nLeave blank to restore “${original}”.`,current);if(name===null)return;pushUndo();state.character.partNames||=Object.fromEntries(directions.map(direction=>[direction,{}]));state.character.partNames[animationDirection]||={};const clean=name.trim().slice(0,60);if(!clean||clean===original)delete state.character.partNames[animationDirection][selectedPart];else state.character.partNames[animationDirection][selectedPart]=clean;renderParts();renderTransforms();markDirty()};
  $("#deselectCharacterPart").onclick=()=>{selectedPart=null;renderParts();renderTransforms();draw()};
  $("#characterAssetGrid").onclick=e=>{const card=e.target.closest("[data-asset]");if(card){selectedAssetId=card.dataset.asset;renderAssets()}};
  $("#characterAssetGrid").ondblclick=e=>{const card=e.target.closest("[data-asset]");if(card)assignAsset(card.dataset.asset)};
  $("#characterAssetSearch").oninput=e=>{assetQuery=e.target.value;renderAssets()};
  $("#importCharacterAsset").onclick=()=>$("#characterAssetFile").click();
  $("#characterAssetFile").onchange=async e=>{if(!e.target.files.length)return;pushUndo();for(const file of e.target.files){const src=await readFileDataUrl(file);const asset={id:uid(),name:file.name.replace(/\.[^.]+$/,"")||"Body part",src,category:"character"};state.assets.push(asset);selectedAssetId=asset.id}rebuildImages();render();markDirty();e.target.value=""};
  $("#replaceCharacterAsset").onclick=()=>{if(!selectedAsset())return alert("Choose an image to replace first.");$("#replaceCharacterAssetFile").click()};
  $("#replaceCharacterAssetFile").onchange=async e=>{const file=e.target.files[0],asset=selectedAsset();if(!file||!asset){e.target.value="";return}pushUndo();asset.src=await readFileDataUrl(file);rebuildImages();render();markDirty();e.target.value=""};
  $("#renameCharacterAsset").onclick=()=>{const asset=selectedAsset();if(!asset)return alert("Choose an image to rename first.");const name=prompt("Asset name:",asset.name);if(name===null||!name.trim()||name.trim()===asset.name)return;pushUndo();asset.name=name.trim();renderAssets();markDirty()};
  $("#saveCharacterAssetAs").onclick=async()=>{const asset=selectedAsset();if(!asset)return alert("Choose an image to save first.");try{const blob=await fetch(asset.src).then(response=>response.blob()),extensions={"image/jpeg":".jpg","image/webp":".webp","image/gif":".gif","image/png":".png"},extension=extensions[blob.type]||".png";await saveBlobAs(blob,asset.name,extension,"Character body-part image")}catch{alert("The selected image could not be saved.")}};
  $("#deleteCharacterAsset").onclick=()=>{const asset=selectedAsset();if(!asset)return alert("Choose an image to delete first.");if(!confirm(`Delete “${asset.name}”? It will also be removed from every frame that uses it.`))return;pushUndo();clearAssetReferences(asset.id);state.assets=state.assets.filter(item=>item.id!==asset.id);selectedAssetId=null;rebuildImages();render();markDirty()};
  $("#assignCharacterAsset").onclick=()=>selectedAssetId?assignAsset(selectedAssetId):alert("Choose or import an image first.");
  $("#clearCharacterPart").onclick=()=>assignAsset(null);
  $("#resetCharacterPose").onclick=()=>{pushUndo();const frame=currentFrame();bodyParts.forEach(part=>{const assetId=frame.parts[part].assetId;frame.parts[part]=defaultTransform(part,assetId)});render();markDirty()};
  $("#characterTimeline").onclick=e=>{const button=e.target.closest("[data-frame]");if(button){frameIndex=+button.dataset.frame;playing=false;renderTimeline();renderTransforms();draw()}};
  $("#addCharacterFrame").onclick=()=>{pushUndo();currentFrames().push(baseFrame(state.rig));frameIndex=currentFrames().length-1;render();markDirty()};
  $("#duplicateCharacterFrame").onclick=()=>{pushUndo();currentFrames().splice(frameIndex+1,0,clone(currentFrame()));frameIndex++;render();markDirty()};
  $("#deleteCharacterFrame").onclick=()=>{if(currentFrames().length===1)return alert("An animation needs at least one frame.");pushUndo();currentFrames().splice(frameIndex,1);frameIndex=clamp(frameIndex,0,currentFrames().length-1);render();markDirty()};
  function shiftFrame(delta){const next=clamp(frameIndex+delta,0,currentFrames().length-1);if(next===frameIndex)return;pushUndo();currentFrames().splice(next,0,currentFrames().splice(frameIndex,1)[0]);frameIndex=next;render();markDirty()}
  $("#moveCharacterFrameBack").onclick=()=>shiftFrame(-1); $("#moveCharacterFrameForward").onclick=()=>shiftFrame(1);
  $("#previousCharacterFrame").onclick=()=>{frameIndex=(frameIndex-1+currentFrames().length)%currentFrames().length;renderTimeline();renderTransforms();draw()};
  $("#nextCharacterFrame").onclick=()=>{frameIndex=(frameIndex+1)%currentFrames().length;renderTimeline();renderTransforms();draw()};
  $("#playCharacterAnimation").onclick=()=>{playing=!playing;lastStep=performance.now();renderTimeline()};
  [["partX","x",-1024,2048,true],["partY","y",-1024,2048,true],["partRotationNumber","rotation",-180,180,false]].forEach(([id,key,min,max,locked])=>{$("#"+id).onchange=e=>{pushUndo();changeTransform(key,clamp(+e.target.value||0,min,max),locked)}});
  function sliderPair(slider,number,key,divisor,min,max){const apply=e=>{pushUndo();changeTransform(key,clamp(+e.target.value/divisor,min,max));renderTransforms()};$(slider).oninput=apply;$(number).onchange=apply}
  sliderPair("#partRotation","#partRotationNumber","rotation",1,-180,180); sliderPair("#partScale","#partScaleNumber","scale",100,.01,3); sliderPair("#partBrightness","#partBrightnessNumber","brightness",100,.2,2);
  $("#partWidthScale").onchange=e=>{if(!currentTransform())return;pushUndo();changeTransform("widthScale",clamp((+e.target.value||100)/100,.01,5))};
  $("#partHeightScale").onchange=e=>{if(!currentTransform())return;pushUndo();changeTransform("heightScale",clamp((+e.target.value||100)/100,.01,5))};
  $("#partBrightnessReset").onclick=()=>{pushUndo();changeTransform("brightness",1)}; $("#partFlip").onchange=e=>{pushUndo();changeTransform("flip",e.target.checked)};
  [["partSheetColumns","sheetColumns"],["partSheetRows","sheetRows"],["partSheetCell","sheetCell"],["partSheetCellNumber","sheetCell"]].forEach(([id,key])=>{$("#"+id).onchange=e=>{pushUndo();changeTransform(key,clamp(Math.round(+e.target.value||1),1,64));renderTransforms()};$("#"+id).oninput=$("#"+id).onchange});
  [["partBendEnabled","bendEnabled"],["partToeBendEnabled","toeBendEnabled"]].forEach(([id,key])=>{$("#"+id).onchange=e=>{if(!currentTransform())return;pushUndo();changeTransform(key,e.target.checked)}});
  $("#partBendAxis").onchange=e=>{if(!currentTransform())return;pushUndo();changeTransform("bendAxis",["bottom","left","right"].includes(e.target.value)?e.target.value:"bottom")};
  $("#partToeCutAxis").onchange=e=>{if(!currentTransform())return;pushUndo();changeTransform("toeCutAxis",["same","bottom","left","right"].includes(e.target.value)?e.target.value:"same")};
  function bindBendRange(id,key,min,max,enableKey){$("#"+id).oninput=e=>{const t=currentTransform();if(!t)return;pushUndo();t[key]=clamp(+e.target.value||0,min,max);if(enableKey)t[enableKey]=Math.abs(t[key])>.1;renderTransforms();draw();markDirty()}}
  bindBendRange("partBend","bend",-55,55,"bendEnabled");bindBendRange("partBendZone","bendZone",5,70);bindBendRange("partToeBend","toeBend",-90,90,"toeBendEnabled");
  $("#partToeBendZone").oninput=e=>{const t=currentTransform();if(!t)return;pushUndo();const max=t.toeCutAxis==="same"?Math.min(40,Math.max(1,Math.round((t.bendZone||25)-1))):100;t.toeBendZone=clamp(+e.target.value||12,1,max);renderTransforms();draw();markDirty()};
  [["partShoeMoveX","shoeMoveX"],["partShoeMoveY","shoeMoveY"],["partToeMoveX","toeMoveX"],["partToeMoveY","toeMoveY"]].forEach(([id,key])=>bindBendRange(id,key,-120,120));
  $("#partShowBendGuides").onchange=e=>{showBendGuides=e.target.checked;draw()};
  $$('[data-part-nudge]').forEach(button=>button.onclick=e=>{const t=currentTransform();if(!t)return;pushUndo();const step=e.shiftKey?5:1,piece=button.dataset.partNudge,xKey=piece==="shoe"?"shoeMoveX":"toeMoveX",yKey=piece==="shoe"?"shoeMoveY":"toeMoveY";t[xKey]=clamp((+t[xKey]||0)+(+button.dataset.dx||0)*step,-120,120);t[yKey]=clamp((+t[yKey]||0)+(+button.dataset.dy||0)*step,-120,120);renderTransforms();draw();markDirty()});
  $("#copyPartTransform").onclick=()=>{clipboard=clone(currentTransform());delete clipboard.assetId;$("#partTransformClipboardStatus").textContent=`Copied ${partLabel(selectedPart)} transform.`};
  $("#pastePartTransform").onclick=()=>{if(!clipboard)return alert("Copy a transform first.");pushUndo();Object.assign(currentTransform(),clone(clipboard));render();markDirty()};
  $("#partReset").onclick=()=>{pushUndo();const assetId=currentTransform().assetId;currentFrame().parts[selectedPart]=defaultTransform(selectedPart,assetId);render();markDirty()};
  $("#partRotateLeft").onclick=()=>{pushUndo();changeTransform("rotation",(currentTransform().rotation||0)-15)}; $("#partRotateRight").onclick=()=>{pushUndo();changeTransform("rotation",(currentTransform().rotation||0)+15)};
  $("#partLayerOrder").onclick=e=>{const row=e.target.closest("[data-order-part]");if(row){selectedPart=row.dataset.orderPart;render()}};
  $("#partLayerBack").onclick=()=>moveLayer(-1);$("#partLayerForward").onclick=()=>moveLayer(1);$("#partLayerBottom").onclick=()=>moveLayer("bottom");$("#partLayerTop").onclick=()=>moveLayer("top");
  $("#partLockList").onchange=e=>{const box=e.target.closest("[data-lock-part]");if(!box)return;pushUndo();const set=new Set(state.character.lockedParts);box.checked?set.add(box.dataset.lockPart):set.delete(box.dataset.lockPart);state.character.lockedParts=bodyParts.filter(p=>set.has(p));markDirty()};
  [["characterWidth","width"],["characterHeight","height"]].forEach(([id,key])=>{$("#"+id).onchange=e=>{pushUndo();state.character[key]=clamp(+e.target.value||state.character[key],64,1024);render();markDirty()}});
  $("#characterZoom").oninput=e=>setZoom(+e.target.value/100);$("#characterZoomOut").onclick=()=>setZoom(zoom-.25);$("#characterZoomIn").onclick=()=>setZoom(zoom+.25);$("#characterZoomReset").onclick=()=>setZoom(1);
  $("#showCharacterGuides").onchange=e=>{showGuides=e.target.checked;draw()};
  function addGuide(axis){pushUndo();const guide={id:uid(),axis,value:Math.round((axis==="x"?state.character.width:state.character.height)/2)};state.character.guides.push(guide);selectedGuideId=guide.id;renderGuides();draw();markDirty()}
  $("#addVerticalGuide").onclick=()=>addGuide("x");$("#addHorizontalGuide").onclick=()=>addGuide("y");$("#deleteNearestGuide").onclick=()=>{const i=state.character.guides.findIndex(g=>g.id===selectedGuideId);if(i>=0){pushUndo();state.character.guides.splice(i,1);selectedGuideId=null;renderGuides();draw();markDirty()}};$("#clearCharacterGuides").onclick=()=>{pushUndo();state.character.guides=[];renderGuides();draw();markDirty()};
  $("#characterGuideList").onclick=e=>{const row=e.target.closest("[data-guide]");if(row){selectedGuideId=row.dataset.guide;draw()}const del=e.target.closest("[data-delete-guide]");if(del){pushUndo();state.character.guides.splice(+del.dataset.deleteGuide,1);renderGuides();draw();markDirty()}};
  $("#characterGuideList").onchange=e=>{const input=e.target.closest("[data-guide-value]");if(input){const guide=state.character.guides.find(g=>g.id===input.dataset.guideValue);pushUndo();guide.value=clamp(+input.value||0,0,guide.axis==="x"?state.character.width:state.character.height);draw();markDirty()}};
  canvas.onpointerdown=e=>{const p=pointFromEvent(e),guide=state.character.guides.find(g=>Math.abs((g.axis==="x"?p.x:p.y)-g.value)<8/zoom);pushUndo();if(guide){selectedGuideId=guide.id;drag={guide}}else if(hitSelected(p)){drag={start:p,parts:lockedGroup(selectedPart).map(part=>({part,x:currentFrame().parts[part].x,y:currentFrame().parts[part].y}))}}else{undoStack.pop();return}canvas.setPointerCapture(e.pointerId)};
  canvas.onpointermove=e=>{if(!drag)return;const p=pointFromEvent(e);if(drag.guide)drag.guide.value=clamp(drag.guide.axis==="x"?p.x:p.y,0,drag.guide.axis==="x"?state.character.width:state.character.height);else drag.parts.forEach(item=>{const t=currentFrame().parts[item.part];t.x=item.x+p.x-drag.start.x;t.y=item.y+p.y-drag.start.y});renderTransforms();draw()};canvas.onpointerup=()=>{if(drag){drag=null;renderGuides();markDirty()}};
  $("#undoCharacterEdit").onclick=()=>{const snapshot=undoStack.pop();if(!snapshot)return;state=snapshot.state;animationState=snapshot.animationState;animationDirection=snapshot.animationDirection||"right";frameIndex=snapshot.frameIndex;selectedPart=snapshot.selectedPart;playing=false;rebuildImages();render();markDirty()};
  $("#saveCharacterBackup").onclick=async()=>{const backup={type:"boltworks-character",version:2,directions:["right","left","forward","back"],savedAt:new Date().toISOString(),projectName:state.name,animationState,animationDirection,characterFrameIndex:frameIndex,selectedCharacterPart:selectedPart,character:state.character,rig:state.rig,assets:state.assets};await saveBlobAs(new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}),`${safeName()}-character.boltchar`,".boltchar","BoltWorks character backup")};
  $("#loadCharacterBackup").onclick=()=>$("#characterBackupFile").click();$("#characterBackupFile").onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const backup=unpackCharacterBackup(await file.text(),file.name),character=restoreSavedTransforms(normalizeCharacter(backup.character,backup.rig),backup.character);pushUndo();state={name:backup.name,rig:backup.rig,assets:backup.assets,character};animationState=character.animations[backup.animationState]?backup.animationState:character.animations.standing?"standing":Object.keys(character.animations)[0];animationDirection=loadedDirection(character,backup.animationDirection);frameIndex=Math.max(0,backup.frameIndex);selectedAssetId=null;rebuildImages();render();markDirty()}catch(error){console.error("Character backup load failed",error);alert(`Could not load “${file.name}”.\n\n${error?.message||"The file is not a valid character backup."}`)}finally{e.target.value=""}};
  $("#exportAnimationSheet").onclick=()=>{const frames=exportCanvasFrames(),sheet=document.createElement("canvas");sheet.width=state.character.width*frames.length;sheet.height=state.character.height;const out=sheet.getContext("2d");frames.forEach((frame,i)=>out.drawImage(frame,i*state.character.width,0));sheet.toBlob(blob=>download(blob,`${exportStem()}-sheet.png`),"image/png")};
  $("#exportAnimationGif").onclick=()=>download(encodeGif(exportCanvasFrames(),state.character.animationFps[animationState]||8),`${exportStem()}.gif`);
  $("#exportAnimationWebm").onclick=async()=>{if(!window.MediaRecorder)return alert("This browser cannot export WebM.");const frames=exportCanvasFrames(),out=document.createElement("canvas"),fps=state.character.animationFps[animationState]||8;out.width=state.character.width;out.height=state.character.height;const stream=out.captureStream(fps),chunks=[],recorder=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported("video/webm;codecs=vp9")?"video/webm;codecs=vp9":"video/webm"});recorder.ondataavailable=e=>e.data.size&&chunks.push(e.data);const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();for(const frame of frames){out.getContext("2d").clearRect(0,0,out.width,out.height);out.getContext("2d").drawImage(frame,0,0);await new Promise(resolve=>setTimeout(resolve,1000/fps))}recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());download(new Blob(chunks,{type:"video/webm"}),`${exportStem()}.webm`)};
  $("#exportAnimationHtml").onclick=()=>{const frames=exportCanvasFrames().map(frame=>frame.toDataURL()),fps=state.character.animationFps[animationState]||8,html=`<!doctype html><meta charset="utf-8"><title>${escapeHtml(state.name)}</title><style>html,body{height:100%;margin:0;display:grid;place-items:center;background:#171a16}img{image-rendering:pixelated;max-width:90vw;max-height:90vh}</style><img id="character" alt=""><script>const frames=${JSON.stringify(frames)};let i=0;const image=document.querySelector('#character');function draw(){image.src=frames[i++%frames.length]}draw();setInterval(draw,${Math.round(1000/fps)});<\/script>`;download(new Blob([html],{type:"text/html"}),`${exportStem()}-preview.html`)};
  window.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"&&!/input|select/i.test(e.target.tagName)){e.preventDefault();$("#undoCharacterEdit").click()}});
  function loop(now){if(playing&&now-lastStep>=1000/(state.character.animationFps[animationState]||8)){const indexes=playbackIndexes(),at=indexes.indexOf(frameIndex);frameIndex=indexes[(at+1)%indexes.length];lastStep=now;renderTimeline();renderTransforms()}draw();requestAnimationFrame(loop)}
  installRangeSteppers();rebuildImages();render();requestAnimationFrame(loop);
})();
