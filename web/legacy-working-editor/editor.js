(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const uid = () => Math.random().toString(36).slice(2, 9);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function defaultSceneArt() {
    const base = { assetId: null, mode: "stretch", spacing: 0, yOffset: 0, height: 0 };
    return {
      background: { ...base, mode: "stretch" },
      far: { ...base, mode: "tile", spacing: 180 },
      ground: { ...base, mode: "tile", spacing: 0 },
      front: { ...base, mode: "tile", spacing: 260 },
      busStop: { ...base, mode: "stretch" },
      bus: { ...base, mode: "stretch" }
    };
  }

  function normalizeSceneArt(sceneArt = {}) {
    const defaults = defaultSceneArt();
    Object.keys(defaults).forEach(slot => {
      defaults[slot] = { ...defaults[slot], ...(sceneArt?.[slot] || {}) };
      defaults[slot].mode = defaults[slot].mode === "tile" ? "tile" : "stretch";
      defaults[slot].spacing = clamp(Number(defaults[slot].spacing) || 0, 0, 2000);
      defaults[slot].yOffset = clamp(Number(defaults[slot].yOffset) || 0, -2000, 2000);
      defaults[slot].height = clamp(Number(defaults[slot].height) || 0, 0, 4000);
      defaults[slot].assetId = defaults[slot].assetId || null;
    });
    return defaults;
  }
  const bodyParts = ["backArm", "backLeg", "torso", "head", "frontLeg", "frontArm"];
  const prettyPart = { backArm: "Back arm", backLeg: "Back leg", torso: "Torso", head: "Head", frontLeg: "Front leg", frontArm: "Front arm" };
  const animationStates = ["standing", "idle", "walking", "running", "crawling", "jumping", "sitting"];
  const carToolOptions = ["none", "wrench", "screwdriver", "socket_set", "pliers", "jack", "grinder"];
  const assetCategories = ["working", "character", "world", "object", "part", "scene", "inventory"];
  const assetCategoryLabels = { working: "Working", character: "Character", world: "World", object: "Objects", part: "Parts", scene: "Scenes", inventory: "Inventory" };

  const starterProject = () => ({
    version: 1,
    name: "My Scrapyard Story",
    world: { width: 5200, height: 720, groundHeight: 150 },
    layers: [
      { id: "background", name: "Sky / fixed background", parallax: 0, visible: true, color: "#7d908b" },
      { id: "far", name: "Far scenery", parallax: 0.18, visible: true, color: "#66756b" },
      { id: "ground", name: "Ground & gameplay", parallax: 1, visible: true, color: "#5b5743" },
      { id: "front", name: "Front scenery", parallax: 0.72, visible: true, color: "#343a2e" }
    ],
    activeLayer: "ground",
    assets: [],
    carModels: [],
    rig: { backArm: null, backLeg: null, torso: null, head: null, frontLeg: null, frontArm: null },
    player: { spawnX: 250, walkSpeed: 260, crawlSpeed: 120 },
    objects: [
      { id: uid(), type: "bus-stop", name: "Morning bus stop", sceneId: "street", x: 430, y: 470, w: 100, h: 150, layer: "ground", flip: false },
      { id: uid(), type: "bus", name: "Morning bus", sceneId: "street", x: 80, y: 430, w: 330, h: 160, layer: "ground", flip: false, busDelay: 5, busDuration: 3, busStartScale: .59, busEndScale: 1, busDriftX: 0, busDriftY: 0, busAnchor: "bottom", busRunOverAfter: 7, busRunOverSceneId: "hospital", honkAssetId: null, honkSound: "soundAssets/bus_horn.mp3" },
      { id: uid(), type: "gate", name: "Junkyard gate", sceneId: "street", x: 2100, y: 365, w: 270, h: 260, layer: "ground", flip: false },
      { id: uid(), type: "npc", name: "Foreman", sceneId: "street", x: 1980, y: 465, w: 70, h: 145, layer: "ground", flip: true },
      { id: uid(), type: "trigger", name: "Late for work greeting", sceneId: "street", x: 1810, y: 420, w: 300, h: 210, layer: "ground", flip: false, action: "dialogue", prompt: "Press E to talk", dialogue: "You here for the job? You are late. You start at 7:00.", duration: 0, breakChance: 0, reward: 0 },
      { id: uid(), type: "car", name: "Rusty hatchback", sceneId: "street", x: 2800, y: 465, w: 260, h: 140, layer: "ground", flip: false },
      { id: uid(), type: "trigger", name: "Remove starter motor", sceneId: "street", x: 2770, y: 420, w: 320, h: 210, layer: "ground", flip: false, action: "salvage", prompt: "Press E to remove starter motor", dialogue: "You work the bolts loose and pull out the starter motor.", duration: 4, breakChance: 30, reward: 45 }
    ]
  });

  let project = normalizeProject(loadLocal() || starterProject());
  let activeTool = "select";
  let selectionId = null;
  let selectedAssetId = null;
  let placingSelectedAsset = false;
  let placingCarModelId = null;
  let selectedCarModelId = null;
  let selectedCarPartId = null;
  let carAssetQuery = "";
  let carPartDrag = null;
  let cameraX = 0;
  let zoom = 1;
  let pointer = null;
  let drag = null;
  let dirtyTimer = null;
  let images = new Map();
  let playing = false;
  let gameFrame = 0;
  let lastTime = 0;
  let game = null;
  let busHornAudio = null;
  let busEngineAudio = null;
  let busParticles = [];
  let hornAudioContext = null;
  let outlinerQuery = "";
  let assetQuery = "";
  let assetLibraryCategory = "working";
  let assetStudioCategory = "all";
  let assetSelection = null;
  let assetSelectionDrag = null;
  let assetZoom = .5;
  let pickBackgroundActive = false;
  let assetPaintTool = "select";
  let assetPaintStroke = null;
  let assetPaintHover = null;
  let paintColorPickActive = false;
  let paintColorPickReturnTool = "pen";
  let assetPaintUndoSrc = null;
  let transparencyPreview = true;
  let backgroundRgb = { r: 154, g: 158, b: 145 };
  let colorTolerance = 28;
  let backgroundRemoveMode = "global";
  let assetPreviewCache = null;
  let assetStatusMessage = "";
  let copiedAssetSprite = null;
  let floatingPasteLayer = null;
  let assetMoveLayerMode = false;
  let assetUndoStack = [];
  let pasteCopiedFlipX = false;
  let pasteCopiedFlipY = false;
  let characterState = "standing";
  let characterFrameIndex = 0;
  let selectedCharacterPart = "torso";
  let characterAssetQuery = "";
  let characterShowSourceSheets = false;
  const characterHiddenParts = new Set();
  let characterPlaying = false;
  let characterLastStep = 0;
  let characterZoom = 1;
  let characterDrag = null;
  let characterShowGuides = true;
  let selectedCharacterGuideId = null;
  const characterUndoStack = [];
  let characterTransformClipboard = null;
  let characterShowBendGuides = true;
  const keys = {};

  const editorCanvas = $("#editorCanvas");
  const ectx = editorCanvas.getContext("2d");
  const gameCanvas = $("#gameCanvas");
  const gctx = gameCanvas.getContext("2d");
  const assetPreview = $("#assetPreview");
  const assetCtx = assetPreview.getContext("2d", { willReadFrequently: true });
  const characterCanvas = $("#characterCanvas");
  const characterCtx = characterCanvas.getContext("2d");
  const carBuilderCanvas = $("#carBuilderCanvas");
  const carBuilderCtx = carBuilderCanvas ? carBuilderCanvas.getContext("2d") : null;

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem("scrapyard-project")); }
    catch { return null; }
  }

  function openProjectDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("Browser database unavailable"));
      const request = indexedDB.open("boltworks-studio", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("projects")) request.result.createObjectStore("projects");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveProjectDatabase(data) {
    const db = await openProjectDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("projects", "readwrite");
      transaction.objectStore("projects").put(data, "current");
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    });
  }

  async function loadProjectDatabase() {
    const db = await openProjectDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("projects", "readonly");
      const request = transaction.objectStore("projects").get("current");
      request.onsuccess = () => { db.close(); resolve(request.result || null); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  }


  function normalizeAssetCategory(asset) {
    if (assetCategories.includes(asset?.category)) return asset.category;
    if (asset?.characterPart) return "character";
    return "working";
  }

  function assetInCategory(asset, category) {
    if (category === "all") return true;
    return normalizeAssetCategory(asset) === category;
  }

  function assetCategoryName(asset) {
    return assetCategoryLabels[normalizeAssetCategory(asset)] || "Working";
  }
  function normalizeScenes(scenes, activeSceneId) {
    const list = Array.isArray(scenes) && scenes.length ? scenes : [{ id: activeSceneId || "street", name: "Street / bus stop" }];
    return list.map((scene, index) => ({ id: scene.id || `scene-${index + 1}`, name: scene.name || `Scene ${index + 1}` }));
  }

  function normalizeActiveSceneId(scenes, activeSceneId) {
    const list = normalizeScenes(scenes, activeSceneId);
    return list.some(scene => scene.id === activeSceneId) ? activeSceneId : list[0].id;
  }

  function activeScene() {
    project.scenes = normalizeScenes(project.scenes, project.activeSceneId);
    project.activeSceneId = normalizeActiveSceneId(project.scenes, project.activeSceneId);
    return project.scenes.find(scene => scene.id === project.activeSceneId) || project.scenes[0];
  }

  function ensureScene(id, name) {
    project.scenes = normalizeScenes(project.scenes, project.activeSceneId);
    let scene = project.scenes.find(item => item.id === id);
    if (!scene) {
      scene = { id, name };
      project.scenes.push(scene);
    }
    return scene;
  }
  function objectInActiveScene(object) {
    return !object.sceneId || object.sceneId === project.activeSceneId;
  }

  function sceneObjects() {
    return project.objects.filter(objectInActiveScene);
  }

  function isPlayerStartObject(object) {
    return object?.type === "player_start_here" || object?.type === "spawn";
  }

  function playerStartForScene(sceneId = project.activeSceneId) {
    const starts = project.objects.filter(object => object.sceneId === sceneId && object.visible !== false && isPlayerStartObject(object));
    return starts.find(object => object.type === "player_start_here") || starts[0] || null;
  }

  function normalizeCarPart(part = {}, index = 0) {
    return {
      id: part.id || uid(),
      name: part.name || `Part ${index + 1}`,
      assetId: part.assetId || null,
      x: Number.isFinite(+part.x) ? +part.x : 80 + index * 20,
      y: Number.isFinite(+part.y) ? +part.y : 80 + index * 12,
      w: clamp(Number(part.w) || 120, 1, 4000),
      h: clamp(Number(part.h) || 80, 1, 4000),
      rotation: clamp(Number(part.rotation) || 0, -180, 180),
      scale: clamp(Number(part.scale) || 1, .05, 3),
      flip: !!part.flip,
      removable: part.removable !== false,
      requiredTool: carToolOptions.includes(part.requiredTool) ? part.requiredTool : "none",
      removalTime: clamp(Number(part.removalTime) || 30, 0, 3600),
      breakChance: clamp(Number(part.breakChance) || 0, 0, 100),
      reward: clamp(Number(part.reward) || 0, 0, 9999)
    };
  }

  function normalizeCarModel(model = {}, index = 0) {
    const parts = Array.isArray(model.parts) ? model.parts.map(normalizeCarPart) : [];
    return {
      id: model.id || uid(),
      name: model.name || `Car model ${index + 1}`,
      width: clamp(Number(model.width) || 640, 64, 4000),
      height: clamp(Number(model.height) || 360, 64, 2400),
      parts
    };
  }

  function normalizeCarModels(models = []) {
    return Array.isArray(models) ? models.map(normalizeCarModel) : [];
  }
  function normalizeObjectScript(object) {
    if (object.type === "bus" && typeof object.scriptCode === "string") {
      const generatedByBuilder = object.scriptCode.includes("Real JavaScript. Runs every frame during Play Scene") || object.scriptCode.includes("BusApproachScript");
      const missingDepartedGuard = !object.scriptCode.includes("api.state.departed") && !object.scriptCode.includes("state.departed");
      const hasSceneOrHide = object.scriptCode.includes("api.goToScene") || object.scriptCode.includes("api.hospital") || object.scriptCode.includes("api.hidePlayer()");
      const mayHideImmediately = object.scriptCode.includes("api.hidePlayer()") && !object.scriptCode.includes("passProgress");
      if ((generatedByBuilder && (missingDepartedGuard || mayHideImmediately)) || (hasSceneOrHide && missingDepartedGuard)) delete object.scriptCode;
    }
    object.locked = !!object.locked;
    object.alwaysOnTop = !!object.alwaysOnTop;
    object.opacity = clamp(Number(object.opacity ?? 1), 0, 1);
    const blendModes = new Set(["source-over", "multiply", "screen", "overlay", "soft-light"]);
    object.blendMode = blendModes.has(object.blendMode) ? object.blendMode : "source-over";
    return object;
  }
  function normalizeProject(data = {}) {
    const base = starterProject();
    const scenes = normalizeScenes(data.scenes, data.activeSceneId || "street");
    const activeSceneId = normalizeActiveSceneId(scenes, data.activeSceneId || scenes[0].id);
    const layers = Array.isArray(data.layers) && data.layers.length ? data.layers : base.layers;
    const activeLayer = layers.some(layer => layer.id === data.activeLayer) ? data.activeLayer : (layers.find(layer => layer.id === "ground")?.id || layers[0].id);
    const rawObjects = Array.isArray(data.objects) && data.objects.length ? data.objects : base.objects;
    return {
      ...base, ...data,
      world: { ...base.world, ...(data.world || {}) },
      scenes,
      player: { ...base.player, ...(data.player || {}) },
      activeSceneId,
      activeLayer,
      rig: { ...base.rig, ...(data.rig || {}) },
      character: normalizeCharacter(data.character, { ...base.rig, ...(data.rig || {}) }),
      layers,
      assets: (Array.isArray(data.assets) ? data.assets : []).map(asset => ({ ...asset, category: normalizeAssetCategory(asset) })),
      carModels: normalizeCarModels(data.carModels || []),
      objects: rawObjects.map(object => normalizeObjectScript({ ...object, sceneId: object.sceneId || activeSceneId, layer: layers.some(layer => layer.id === object.layer) ? object.layer : activeLayer }))
    };
  }
  function normalizePartOrder(order) {
    const normalized = Array.isArray(order) ? order.filter(part => bodyParts.includes(part)) : [];
    bodyParts.forEach(part => { if (!normalized.includes(part)) normalized.push(part); });
    return normalized;
  }

  function characterPartOrder() {
    if (!project.character) return bodyParts;
    project.character.partOrder = normalizePartOrder(project.character.partOrder);
    return project.character.partOrder;
  }
  function baseCharacterFrame(rig = {}) {
    const defaults = {
      backArm: { x: 98, y: 150, rotation: 4 },
      backLeg: { x: 116, y: 218, rotation: 0 },
      torso: { x: 128, y: 172, rotation: 0 },
      head: { x: 128, y: 96, rotation: 0 },
      frontLeg: { x: 140, y: 218, rotation: 0 },
      frontArm: { x: 158, y: 150, rotation: -4 }
    };
    const parts = {};
    bodyParts.forEach(part => {
      parts[part] = { assetId: rig[part] || null, ...defaults[part], scale: 1, flip: false, bendEnabled: false, bend: 0, bendZone: 25, toeBendEnabled: false, toeBend: 0, toeBendZone: 12, toeSlide: 0, toeMoveX: 0, toeMoveY: 0, shoeMoveX: 0, shoeMoveY: 0, showBendGuides: true, toeCutAxis: "same", bendAxis: "bottom" };
    });
    return { parts };
  }

  function posedFrame(rig, changes = {}) {
    const frame = baseCharacterFrame(rig);
    Object.entries(changes).forEach(([part, values]) => Object.assign(frame.parts[part], values));
    return frame;
  }

  function createCharacterModel(rig = {}) {
    const walk = [-1, -.35, .35, 1].map(phase => posedFrame(rig, {
      backArm: { rotation: phase * 18 + 6 },
      frontArm: { rotation: -phase * 18 - 6 },
      backLeg: { rotation: -phase * 14, x: 116 - phase * 3 },
      frontLeg: { rotation: phase * 14, x: 140 + phase * 3 },
      torso: { y: 172 + Math.abs(phase) * 2 },
      head: { y: 96 + Math.abs(phase) * 2 }
    }));
    const run = [-1, -.35, .35, 1].map(phase => posedFrame(rig, {
      backArm: { rotation: phase * 28 + 8 },
      frontArm: { rotation: -phase * 28 - 8 },
      backLeg: { rotation: -phase * 22, x: 116 - phase * 5 },
      frontLeg: { rotation: phase * 22, x: 140 + phase * 5 },
      torso: { rotation: 3, y: 174 + Math.abs(phase) * 3 },
      head: { x: 130, y: 98 + Math.abs(phase) * 3 }
    }));
    return {
      width: 256,
      height: 320,
      fps: 8,
      motionPresetVersion: 2,
      facing: Object.fromEntries(animationStates.map(state => [state, "right"])),
      animationFps: Object.fromEntries(animationStates.map(state => [state, state === "running" ? 14 : 8])),
      loopMode: Object.fromEntries(animationStates.map(state => [state, state === "walking" || state === "running" ? "pingpong" : "normal"])),
      partOrder: [...bodyParts],
      lockedParts: ["head", "torso"],
      animations: {
        standing: [baseCharacterFrame(rig)],
        idle: [
          baseCharacterFrame(rig),
          posedFrame(rig, { torso: { y: 170 }, head: { y: 94 }, backArm: { y: 149 }, frontArm: { y: 149 } }),
          baseCharacterFrame(rig),
          posedFrame(rig, { torso: { y: 174 }, head: { y: 98 }, backArm: { y: 151 }, frontArm: { y: 151 } })
        ],
        walking: walk,
        running: run,
        crawling: [
          posedFrame(rig, { head: { x: 184, y: 184 }, torso: { x: 132, y: 204, rotation: 78 }, backArm: { x: 178, y: 232, rotation: 62 }, frontArm: { x: 200, y: 230, rotation: 92 }, backLeg: { x: 96, y: 234, rotation: -45 }, frontLeg: { x: 118, y: 236, rotation: -72 } }),
          posedFrame(rig, { head: { x: 184, y: 186 }, torso: { x: 132, y: 206, rotation: 78 }, backArm: { x: 196, y: 230, rotation: 92 }, frontArm: { x: 176, y: 234, rotation: 62 }, backLeg: { x: 118, y: 236, rotation: -72 }, frontLeg: { x: 92, y: 234, rotation: -45 } })
        ],
        jumping: [
          posedFrame(rig, { torso: { y: 158 }, head: { y: 82 }, backArm: { y: 142, rotation: -36 }, frontArm: { y: 142, rotation: 36 }, backLeg: { y: 220, rotation: -16 }, frontLeg: { y: 220, rotation: 18 } }),
          posedFrame(rig, { torso: { y: 140 }, head: { y: 64 }, backArm: { y: 132, rotation: -55 }, frontArm: { y: 132, rotation: 55 }, backLeg: { y: 206, rotation: 26 }, frontLeg: { y: 206, rotation: -26 } })
        ],
        sitting: [posedFrame(rig, { torso: { y: 178 }, head: { y: 102 }, backArm: { y: 166, rotation: -16 }, frontArm: { y: 166, rotation: 16 }, backLeg: { x: 116, y: 232, rotation: 72 }, frontLeg: { x: 140, y: 232, rotation: 72 } })]
      }
    };
  }
  function normalizeCharacter(character, rig) {
    const defaults = createCharacterModel(rig);
    if (!character) return defaults;
    const result = {
      width: clamp(Number(character.width) || defaults.width, 64, 1024),
      height: clamp(Number(character.height) || defaults.height, 64, 1024),
      fps: clamp(Number(character.fps) || defaults.fps, 1, 20),
      facing: { ...defaults.facing, ...(character.facing || {}) },
      animationFps: { ...defaults.animationFps, ...(character.animationFps || {}) },
      loopMode: { ...defaults.loopMode, ...(character.loopMode || {}) },
      partOrder: normalizePartOrder(character.partOrder || defaults.partOrder),
      lockedParts: Array.isArray(character.lockedParts) ? character.lockedParts.filter(part => bodyParts.includes(part)) : [...defaults.lockedParts],
      guides: Array.isArray(character.guides) ? character.guides.map((guide, index) => ({
        id: guide.id || `guide-${index}`,
        axis: guide.axis === "y" ? "y" : "x",
        value: clamp(Number(guide.value) || 0, 0, guide.axis === "y" ? (Number(character.height) || defaults.height) : (Number(character.width) || defaults.width))
      })) : [],
      animations: {}
    };
    animationStates.forEach(state => {
      const frames = Array.isArray(character.animations?.[state]) && character.animations[state].length
        ? character.animations[state] : defaults.animations[state];
      result.animations[state] = frames.map(frame => {
        const fallback = baseCharacterFrame(rig);
        const parts = {};
        bodyParts.forEach(part => {
          parts[part] = { ...fallback.parts[part], ...(frame.parts?.[part] || {}) };
        });
        return { parts };
      });
    });
    if (character.motionPresetVersion !== defaults.motionPresetVersion) {
      const assignedAssets = {};
      bodyParts.forEach(part => {
        assignedAssets[part] = rig[part] || null;
        for (const state of animationStates) {
          const frames = character.animations?.[state] || [];
          const found = frames.find(frame => frame.parts?.[part]?.assetId)?.parts?.[part]?.assetId;
          if (found) { assignedAssets[part] = found; break; }
        }
      });
      result.animations = JSON.parse(JSON.stringify(defaults.animations));
      animationStates.forEach(state => result.animations[state].forEach(frame => {
        bodyParts.forEach(part => { frame.parts[part].assetId = assignedAssets[part] || null; });
      }));
    }
    const mainFrame = result.animations.standing?.[0];
    if (mainFrame) {
      animationStates.forEach(state => {
        if (state === "standing") return;
        (result.animations[state] || []).forEach(frame => {
          bodyParts.forEach(part => {
            const mainAssetId = mainFrame.parts?.[part]?.assetId || rig?.[part] || null;
            if (mainAssetId && !frame.parts[part].assetId) frame.parts[part].assetId = mainAssetId;
          });
        });
      });
    }
    animationStates.forEach(state => {
      result.facing[state] = "right";
      result.animationFps[state] = clamp(Number(result.animationFps[state]) || result.fps || 8, 1, 20);
      if (!["normal", "pingpong"].includes(result.loopMode[state])) result.loopMode[state] = "normal";
    });
    result.motionPresetVersion = defaults.motionPresetVersion;
    return result;
  }

  function pushCharacterUndo(label = "Character edit") {
    if (!project.character) return;
    characterUndoStack.push({ label, character: JSON.parse(JSON.stringify(project.character)), rig: JSON.parse(JSON.stringify(project.rig || {})), state: characterState, frame: characterFrameIndex, part: selectedCharacterPart });
    if (characterUndoStack.length > 50) characterUndoStack.shift();
  }

  function undoCharacterEdit() {
    const snapshot = characterUndoStack.pop();
    if (!snapshot) return;
    project.character = normalizeCharacter(snapshot.character, snapshot.rig || project.rig);
    project.rig = { ...project.rig, ...(snapshot.rig || {}) };
    characterState = snapshot.state || characterState;
    characterFrameIndex = snapshot.frame || 0;
    selectedCharacterPart = snapshot.part || selectedCharacterPart;
    characterPlaying = false;
    renderCharacterAnimator();
    renderRig();
    markDirty();
  }

  function markDirty() {
    $("#saveState").textContent = "Saving...";
    clearTimeout(dirtyTimer);
    dirtyTimer = setTimeout(() => {
      project.updatedAt = Date.now();
      try {
        localStorage.setItem("scrapyard-project", JSON.stringify(project));
      } catch {}
      saveProjectDatabase(project)
        .then(() => { $("#saveState").textContent = "Saved locally"; })
        .catch(() => { $("#saveState").textContent = "Autosave unavailable - use Save Project"; });
    }, 350);
  }

  function rebuildImages() {
    images.clear();
    project.assets.forEach(asset => {
      const img = new Image();
      img.onload = refreshAssetViews;
      img.src = asset.src;
      images.set(asset.id, img);
    });
  }

  function resizeCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return { width, height, dpr };
  }

  function refreshAssetViews() {
    renderAssets();
    if ($("#characterAnimator").classList.contains("active")) renderCharacterAnimator();
    if ($("#carBuilder")?.classList.contains("active")) renderCarBuilder();
    if ($("#carBuilder")?.classList.contains("active")) renderCarBuilder();
  }

  function screenToWorld(clientX, clientY) {
    const rect = editorCanvas.getBoundingClientRect();
    const scaleX = editorCanvas.width / rect.width;
    const scaleY = editorCanvas.height / rect.height;
    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;
    const viewportH = editorCanvas.height / zoom;
    const worldYScale = viewportH / project.world.height;
    return {
      x: cameraX + canvasX / zoom,
      y: canvasY / zoom / worldYScale
    };
  }

  function visibleLayers() {
    return project.layers.filter(layer => layer.visible);
  }


  function objectBlendMode(object) {
    const mode = object?.blendMode || "source-over";
    return ["source-over", "multiply", "screen", "overlay", "soft-light"].includes(mode) ? mode : "source-over";
  }

  function layerDrawableObjects(layer, isGame, alwaysOnTop = false) {
    return sceneObjects().filter(object => object.visible !== false && object.layer === layer.id && !!object.alwaysOnTop === alwaysOnTop && (isGame || object.type !== "trigger"));
  }

  function triggerObjectsForLayer(layer, alwaysOnTop = false) {
    return sceneObjects().filter(object => object.visible !== false && object.layer === layer.id && object.type === "trigger" && !!object.alwaysOnTop === alwaysOnTop);
  }

  function drawWorld(ctx, canvas, viewX, viewZoom, isGame, now = 0) {
    const { width, height } = resizeCanvas(canvas);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.scale(viewZoom, viewZoom);
    const viewportW = width / viewZoom;
    const viewportH = height / viewZoom;
    const yScale = viewportH / project.world.height;
    ctx.scale(1, yScale);

    const sky = ctx.createLinearGradient(0, 0, 0, project.world.height);
    sky.addColorStop(0, "#7d918e");
    sky.addColorStop(.65, "#b3aa8b");
    sky.addColorStop(1, "#76705a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, viewportW, project.world.height);

    for (const layer of visibleLayers()) {
      ctx.save();
      const offset = viewX * layer.parallax;
      ctx.translate(-offset, 0);
      drawLayerBackdrop(ctx, layer, viewX, viewportW);
      layerDrawableObjects(layer, isGame, false).forEach(object => drawObject(ctx, object, isGame, now));
      if (!isGame) triggerObjectsForLayer(layer, false).forEach(object => drawObject(ctx, object, false, now));
      ctx.restore();
    }
    for (const layer of visibleLayers()) {
      ctx.save();
      const offset = viewX * layer.parallax;
      ctx.translate(-offset, 0);
      layerDrawableObjects(layer, isGame, true).forEach(object => drawObject(ctx, object, isGame, now));
      if (!isGame) triggerObjectsForLayer(layer, true).forEach(object => drawObject(ctx, object, false, now));
      ctx.restore();
    }


    if (isGame) drawBusParticles(ctx, viewX);
    if (!isGame) drawEditorOverlay(ctx, viewX);
    ctx.restore();
  }

  function sceneArt(slot) {
    project.sceneArt = normalizeSceneArt(project.sceneArt);
    return project.sceneArt[slot];
  }

  function sceneArtImage(slot) {
    const art = sceneArt(slot);
    const image = art?.assetId ? images.get(art.assetId) : null;
    return image?.complete && image.naturalWidth ? image : null;
  }

  function drawSceneArtLayer(ctx, slot, layer, viewX, viewportW, fallbackDraw) {
    const art = sceneArt(slot);
    const image = sceneArtImage(slot);
    const groundY = project.world.height - project.world.groundHeight;
    if (!image) { fallbackDraw?.(); return false; }
    const drawHeight = art.height || (slot === "ground" ? project.world.groundHeight : image.naturalHeight);
    const scale = drawHeight / image.naturalHeight;
    const drawWidth = image.naturalWidth * scale;
    const y = slot === "ground" ? groundY + art.yOffset : slot === "background" ? art.yOffset : groundY - drawHeight + art.yOffset;
    if (art.mode === "tile") {
      const step = Math.max(1, drawWidth + art.spacing);
      const start = Math.floor((viewX * (layer?.parallax || 0) - step) / step) * step;
      for (let x = start; x < start + viewportW + step * 2; x += step) ctx.drawImage(image, x, y, drawWidth, drawHeight);
    } else {
      const w = slot === "background" ? viewportW : project.world.width;
      const h = slot === "background" ? project.world.height : drawHeight;
      ctx.drawImage(image, slot === "background" ? viewX * (layer?.parallax || 0) : 0, y, w, h);
    }
    return true;
  }

  function drawLayerBackdrop(ctx, layer, viewX, viewportW) {
    const groundY = project.world.height - project.world.groundHeight;
    if (layer.id === "background") {
      drawSceneArtLayer(ctx, "background", layer, viewX, viewportW, null);
    }
    if (layer.id === "far") {
      drawSceneArtLayer(ctx, "far", layer, viewX, viewportW, () => {
        ctx.fillStyle = layer.color;
        const start = Math.floor((viewX * layer.parallax - 500) / 600) * 600;
        for (let x = start; x < start + viewportW + 1400; x += 600) {
          ctx.beginPath();
          ctx.moveTo(x, groundY + 10);
          ctx.lineTo(x + 140, 330);
          ctx.lineTo(x + 310, groundY + 10);
          ctx.fill();
          ctx.fillRect(x + 380, 360, 80, groundY - 360);
          ctx.fillRect(x + 455, 430, 100, groundY - 430);
        }
      });
    }
    if (layer.id === "ground") {
      ctx.fillStyle = layer.color;
      ctx.fillRect(0, groundY, project.world.width, project.world.groundHeight);
      ctx.fillStyle = "#817a5e";
      ctx.fillRect(0, groundY, project.world.width, 7);
      ctx.strokeStyle = "#3d3d31";
      ctx.lineWidth = 2;
      for (let x = 0; x < project.world.width; x += 90) {
        ctx.beginPath(); ctx.moveTo(x, groundY + 55); ctx.lineTo(x + 38, groundY + 61); ctx.stroke();
      }
      drawSceneArtLayer(ctx, "ground", layer, viewX, viewportW, null);
    }
    if (layer.id === "front") {
      drawSceneArtLayer(ctx, "front", layer, viewX, viewportW, () => {
        ctx.fillStyle = "#252b21";
        const start = Math.floor((viewX * layer.parallax - 200) / 430) * 430;
        for (let x = start; x < start + viewportW + 900; x += 430) {
          ctx.beginPath();
          ctx.moveTo(x, project.world.height);
          ctx.lineTo(x + 24, 635);
          ctx.lineTo(x + 50, project.world.height);
          ctx.fill();
        }
      });
    }
  }


  function carModelById(id) {
    project.carModels = normalizeCarModels(project.carModels || []);
    return project.carModels.find(model => model.id === id) || null;
  }

  function selectedCarModel() {
    if (!project.carModels.length) return null;
    if (!selectedCarModelId || !project.carModels.some(model => model.id === selectedCarModelId)) selectedCarModelId = project.carModels[0].id;
    return carModelById(selectedCarModelId);
  }

  function selectedCarPart() {
    const model = selectedCarModel();
    if (!model?.parts?.length) return null;
    if (!selectedCarPartId || !model.parts.some(part => part.id === selectedCarPartId)) selectedCarPartId = model.parts[model.parts.length - 1].id;
    return model.parts.find(part => part.id === selectedCarPartId) || null;
  }

  function drawCarModel(ctx, model, x, y, w, h, options = {}) {
    if (!model) return;
    const sx = w / Math.max(1, model.width || 1);
    const sy = h / Math.max(1, model.height || 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    model.parts.forEach(part => {
      if (options.removedParts?.has(part.id)) return;
      const image = part.assetId ? images.get(part.assetId) : null;
      ctx.save();
      ctx.translate(part.x + part.w / 2, part.y + part.h / 2);
      ctx.rotate((part.rotation || 0) * Math.PI / 180);
      const scale = Number(part.scale) || 1;
      ctx.scale((part.flip ? -1 : 1) * scale, scale);
      if (image?.complete && image.naturalWidth) {
        ctx.drawImage(image, -part.w / 2, -part.h / 2, part.w, part.h);
      } else {
        ctx.fillStyle = part.removable ? "rgba(184, 138, 50, .55)" : "rgba(80, 92, 84, .65)";
        ctx.strokeStyle = "rgba(245, 217, 149, .75)";
        rounded(ctx, -part.w / 2, -part.h / 2, part.w, part.h, 8);
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    });
    if (options.showSelection && selectedCarPartId) {
      const part = model.parts.find(item => item.id === selectedCarPartId);
      if (part) {
        ctx.save();
        ctx.translate(part.x + part.w / 2, part.y + part.h / 2);
        ctx.rotate((part.rotation || 0) * Math.PI / 180);
        ctx.strokeStyle = "#fff1a7";
        ctx.lineWidth = 2 / Math.max(sx, sy, .01);
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(-part.w * (part.scale || 1) / 2, -part.h * (part.scale || 1) / 2, part.w * (part.scale || 1), part.h * (part.scale || 1));
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
    ctx.restore();
  }
  function drawObject(ctx, o, isGame, now) {
    if (isGame && o.id === game?.hiddenObject) return;
    ctx.save();
    ctx.globalAlpha = clamp(Number(o.opacity ?? 1), 0, 1);
    ctx.globalCompositeOperation = objectBlendMode(o);
    drawObjectInner(ctx, o, isGame, now);
    ctx.restore();
  }

  function drawObjectInner(ctx, o, isGame, now) {
    if (isGame && o.id === game?.hiddenObject) return;
    if (o.type === "car_model") {
      const model = carModelById(o.carModelId);
      ctx.save();
      ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
      ctx.rotate((o.rotation || 0) * Math.PI / 180);
      ctx.scale(o.flip ? -1 : 1, 1);
      drawCarModel(ctx, model, -o.w / 2, -o.h / 2, o.w, o.h, { removedParts: game?.removedCarParts?.get(o.id) });
      ctx.restore();
      return;
    }
    if (!["bus", "bus-stop"].includes(o.type) && o.assetId && images.get(o.assetId)?.complete) {
      ctx.save();
      ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
      ctx.rotate((o.rotation || 0) * Math.PI / 180);
      ctx.scale(o.flip ? -1 : 1, 1);
      ctx.drawImage(images.get(o.assetId), -o.w / 2, -o.h / 2, o.w, o.h);
      ctx.restore();
      return;
    }
    if (o.type === "trigger") {
      ctx.fillStyle = "rgba(218,170,72,.16)";
      ctx.strokeStyle = "#e0b65c";
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeRect(o.x, o.y, o.w, o.h);
      ctx.setLineDash([]);
      ctx.fillStyle = "#f5d995";
      ctx.font = "12px sans-serif";
      ctx.fillText("Trigger " + o.name, o.x + 8, o.y + 18);
      return;
    }
    ctx.save();
    const w = o.w, h = o.h;
    ctx.translate(o.x + w / 2, o.y + h / 2);
    ctx.rotate((o.rotation || 0) * Math.PI / 180);
    ctx.scale(o.flip ? -1 : 1, 1);
    ctx.translate(-w / 2, -h / 2);
    if (o.type === "bus") {
      let depart = 0;
      if (isGame) depart = busApproachProgress(o);
      if (isGame && depart >= 1) { ctx.restore(); return; }
      depart = clamp(depart, 0, 1);
      const startScale = clamp(Number(o.busStartScale) || .59, .05, 1);
      const endScale = clamp(Number(o.busEndScale) || 1, .5, 2.5);
      const departScale = startScale + (endScale - startScale) * depart;
      const driftX = (Number(o.busDriftX) || 0) * depart;
      const driftY = (Number(o.busDriftY) || 0) * depart;
      const anchorY = o.busAnchor === "center" ? h / 2 : h;
      ctx.translate(w / 2 + driftX, anchorY + driftY);
      ctx.scale(departScale, departScale);
      ctx.translate(-w / 2, -anchorY);
      const honkImage = isGame && game?.honkBusId === o.id && game.elapsed <= (game.honkFlashUntil || 0) && o.honkAssetId ? images.get(o.honkAssetId) : null;
      const busImage = honkImage?.complete && honkImage.naturalWidth ? honkImage : (o.assetId ? images.get(o.assetId) : sceneArtImage("bus"));
      if (busImage?.complete && busImage.naturalWidth) {
        ctx.drawImage(busImage, 0, 0, w, h);
      } else {
        ctx.fillStyle = "#b88a32"; rounded(ctx, w * .18, 0, w * .64, h * .9, 15); ctx.fill();
        ctx.fillStyle = "#273633"; ctx.fillRect(w * .29, h * .12, w * .42, h * .24);
        ctx.fillStyle = "#6f4f26"; ctx.fillRect(w * .28, h * .44, w * .44, h * .32);
        ctx.fillStyle = "#1c211d"; ctx.fillRect(w * .18, h * .72, w * .15, h * .22); ctx.fillRect(w * .67, h * .72, w * .15, h * .22);
        ctx.fillStyle = "#d9c173"; ctx.fillRect(w * .4, h * .86, w * .2, h * .06);
      }
    } else if (o.type === "bus-stop") {
      const stopImage = o.assetId ? images.get(o.assetId) : sceneArtImage("busStop");
      if (stopImage?.complete && stopImage.naturalWidth) {
        ctx.drawImage(stopImage, 0, 0, w, h);
      } else {
        ctx.fillStyle = "#494f47"; ctx.fillRect(w * .47, h * .1, w * .08, h * .9);
        ctx.fillStyle = "#d7b44e"; ctx.beginPath(); ctx.arc(w * .51, h * .16, w * .23, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#222921"; ctx.fillRect(w * .18, h * .7, w * .72, h * .08);
        ctx.fillRect(w * .24, h * .76, w * .07, h * .2); ctx.fillRect(w * .76, h * .76, w * .07, h * .2);
      }
    } else if (o.type === "car") {
      ctx.fillStyle = "#7d4d3c"; ctx.beginPath(); ctx.moveTo(0, h * .68); ctx.lineTo(w * .12, h * .38); ctx.lineTo(w * .58, h * .22); ctx.lineTo(w * .84, h * .43); ctx.lineTo(w, h * .52); ctx.lineTo(w * .95, h * .78); ctx.lineTo(0, h * .78); ctx.fill();
      ctx.fillStyle = "#35413d"; ctx.beginPath(); ctx.moveTo(w * .2, h * .4); ctx.lineTo(w * .56, h * .28); ctx.lineTo(w * .72, h * .44); ctx.fill();
      ctx.fillStyle = "#252721"; ctx.beginPath(); ctx.arc(w * .22, h * .78, h * .2, 0, Math.PI * 2); ctx.arc(w * .78, h * .78, h * .2, 0, Math.PI * 2); ctx.fill();
    } else if (o.type === "gate") {
      ctx.strokeStyle = "#464c43"; ctx.lineWidth = 8; ctx.strokeRect(3, 2, w - 6, h - 4);
      ctx.lineWidth = 2;
      for (let x = 15; x < w; x += 18) { ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, h - 4); ctx.stroke(); }
      for (let y = 20; y < h; y += 18) { ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(w - 4, y); ctx.stroke(); }
    } else if (o.type === "npc") {
      ctx.fillStyle = "#a88c70"; ctx.beginPath(); ctx.arc(w * .5, h * .16, w * .25, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#59634e"; rounded(ctx, w * .2, h * .3, w * .6, h * .48, 8); ctx.fill();
      ctx.fillStyle = "#2f342d"; ctx.fillRect(w * .22, h * .74, w * .2, h * .26); ctx.fillRect(w * .58, h * .74, w * .2, h * .26);
    } else if (isPlayerStartObject(o)) {
      ctx.fillStyle = "rgba(242, 207, 113, .18)";
      ctx.strokeStyle = "#f2cf71";
      ctx.lineWidth = 3;
      rounded(ctx, 2, 2, w - 4, h - 4, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#f2cf71";
      ctx.font = `${Math.min(w, h) * .42}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("START", w / 2, h * .58);
    } else {
      ctx.fillStyle = "#696a52"; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w * .2, h * .25); ctx.lineTo(w * .72, 0); ctx.lineTo(w, h); ctx.fill();
    }
    ctx.restore();
  }

  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  }

  function drawEditorOverlay(ctx, viewX) {
    const selected = project.objects.find(o => o.id === selectionId);
    if (selected) {
      const layer = project.layers.find(l => l.id === selected.layer);
      const offset = viewX * (layer?.parallax ?? 1);
      const bounds = objectVisualBounds(selected);
      ctx.save();
      ctx.translate(bounds.cx - offset, bounds.cy);
      ctx.rotate((selected.rotation || 0) * Math.PI / 180);
      ctx.strokeStyle = "#fff1a7";
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([7 / zoom, 4 / zoom]);
      ctx.strokeRect(-bounds.w / 2 - 3 / zoom, -bounds.h / 2 - 3 / zoom, bounds.w + 6 / zoom, bounds.h + 6 / zoom);
      ctx.setLineDash([]);
      ctx.fillStyle = "#fff1a7";
      const s = 9 / zoom;
      [[-bounds.w / 2, -bounds.h / 2], [bounds.w / 2, -bounds.h / 2], [-bounds.w / 2, bounds.h / 2], [bounds.w / 2, bounds.h / 2]].forEach(([x, y]) => ctx.fillRect(x - s / 2, y - s / 2, s, s));
      ctx.restore();
    }
  }

  function editorLoop() {
    drawWorld(ectx, editorCanvas, cameraX, zoom, false);
    updateMinimap();
    requestAnimationFrame(editorLoop);
  }

  function updateMinimap() {
    const visible = editorCanvas.width / zoom;
    const left = cameraX / project.world.width * 100;
    const width = clamp(visible / project.world.width * 100, 2, 100);
    $("#miniView").style.left = `${clamp(left, 0, 100 - width)}%`;
    $("#miniView").style.width = `${width}%`;
    $("#worldMetres").textContent = `${Math.round(project.world.width / 100)} m`;
    $("#sceneInfo").textContent = `${project.name} - ${Math.round(zoom * 100)}%`;
  }

  function renderScenes() {
    project.scenes = normalizeScenes(project.scenes, project.activeSceneId);
    project.activeSceneId = normalizeActiveSceneId(project.scenes, project.activeSceneId);
    const options = project.scenes.map(scene => `<option value="${scene.id}">${escapeHtml(scene.name)}</option>`).join("");
    $("#sceneSelect").innerHTML = options;
    $("#sceneSelect").value = project.activeSceneId;
    if ($("#triggerTargetScene")) $("#triggerTargetScene").innerHTML = options;
  }
  function renderLayers() {
    if (!Array.isArray(project.layers) || !project.layers.length) project.layers = starterProject().layers;
    if (!project.layers.some(layer => layer.id === project.activeLayer)) project.activeLayer = project.layers.find(layer => layer.id === "ground")?.id || project.layers[0].id;
    $("#layerList").innerHTML = project.layers.slice().reverse().map(layer => `
      <div class="layer-row ${layer.id === project.activeLayer ? "active" : ""}" data-layer="${layer.id}">
        <button class="visibility" title="Show/hide">${layer.visible ? "on" : "off"}</button>
        <span class="layer-name">${escapeHtml(layer.name)}</span>
        <span class="layer-speed">${Math.round(layer.parallax * 100)}%</span>
      </div>`).join("");
    $("#objLayer").innerHTML = project.layers.map(l => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join("");
  }

  function renderAssets() {
    if ($("#assetLibraryCategory")) $("#assetLibraryCategory").value = assetLibraryCategory;
    if ($("#assetStudioCategory")) $("#assetStudioCategory").value = assetStudioCategory;
    const libraryAssets = project.assets.filter(asset => assetInCategory(asset, assetLibraryCategory));
    $("#assetGrid").innerHTML = libraryAssets.length ? libraryAssets.map(asset => `
      <div class="asset-card ${asset.id === selectedAssetId ? "selected" : ""}" data-asset="${asset.id}">
        <button class="asset-card-delete" data-delete-asset="${asset.id}" title="Delete ${escapeHtml(asset.name)}" aria-label="Delete ${escapeHtml(asset.name)}">X</button>
        <img src="${asset.src}" alt=""><span>${escapeHtml(asset.name)}</span><small>${assetCategoryName(asset)}</small>
      </div>`).join("") : `<p class="hint">No images on this shelf.</p>`;
    const filtered = project.assets.filter(asset => assetInCategory(asset, assetStudioCategory) && asset.name.toLowerCase().includes(assetQuery.toLowerCase()));
    $("#studioAssetGrid").innerHTML = filtered.length ? filtered.map(asset => {
      const image = images.get(asset.id);
      const dimensions = image?.naturalWidth ? `${image.naturalWidth} x ${image.naturalHeight}` : "Loading...";
      return `<div class="studio-asset-card ${asset.id === selectedAssetId ? "selected" : ""}" data-asset="${asset.id}">
        <button class="asset-card-delete" data-delete-asset="${asset.id}" title="Delete ${escapeHtml(asset.name)}" aria-label="Delete ${escapeHtml(asset.name)}">X</button>
        <img src="${asset.src}" alt=""><strong>${escapeHtml(asset.name)}</strong><small>${dimensions} - ${assetCategoryName(asset)}</small>
      </div>`;
    }).join("") : `<div class="object-list-empty">${project.assets.length ? "No matching assets on this shelf." : "No assets imported yet."}</div>`;
    renderAssetEditor();
  }
  function sceneArtSlotLabel(slot) {
    return { background: "Background", far: "Far scenery", ground: "Ground", front: "Front scenery", busStop: "Bus stop", bus: "Bus rear view" }[slot] || slot;
  }

  function currentSceneArtSlot() {
    return $("#sceneArtSlot")?.value || "background";
  }

  function renderSceneArtControls() {
    const slotSelect = $("#sceneArtSlot");
    if (!slotSelect) return;
    project.sceneArt = normalizeSceneArt(project.sceneArt);
    const slot = currentSceneArtSlot();
    const art = sceneArt(slot);
    const asset = project.assets.find(item => item.id === art.assetId);
    $("#sceneArtPreview").innerHTML = asset
      ? `<img src="${asset.src}" alt=""><span>${sceneArtSlotLabel(slot)} uses ${escapeHtml(asset.name)}</span>`
      : `<span>${sceneArtSlotLabel(slot)} uses the built-in placeholder art.</span>`;
    $("#sceneArtMode").value = art.mode;
    $("#sceneArtSpacing").value = art.spacing;
    $("#sceneArtSpacingValue").textContent = `${art.spacing}px`;
    $("#sceneArtYOffset").value = art.yOffset;
    $("#sceneArtYOffsetValue").textContent = `${art.yOffset}px`;
    $("#sceneArtHeight").value = art.height;
    $("#sceneArtHeightValue").textContent = art.height ? `${art.height}px` : "auto";
  }
  function renderOutliner() {
    const query = outlinerQuery.toLowerCase();
    const objects = sceneObjects().filter(o => `${o.name} ${o.type}`.toLowerCase().includes(query));
    $("#objectCount").textContent = `${sceneObjects().length} item${sceneObjects().length === 1 ? "" : "s"}`;
    const icons = { spawn: "ST", player_start_here: "ST", "bus-stop": "BS", bus: "BU", gate: "GA", npc: "NPC", car: "CAR", car_model: "CAR", trigger: "TR" };
    $("#objectList").innerHTML = objects.length ? objects.map(o => {
      const outside = o.x < 0 || o.y < 0 || o.x + o.w > project.world.width || o.y + o.h > project.world.height;
      return `
      <div class="object-row ${o.id === selectionId ? "selected" : ""} ${o.visible === false ? "hidden-item" : ""}" data-object="${o.id}" title="Select and focus ${escapeHtml(o.name)}">
        <span class="object-icon">${icons[o.type] || "?"}</span>
        <span class="object-info"><strong>${escapeHtml(o.name)}</strong><small>${outside ? "outside area" : escapeHtml(o.type.replace("-", " "))} - x ${Math.round(o.x)}</small></span>
        <button class="outliner-visibility" title="${o.visible === false ? "Show" : "Hide"}">${o.visible === false ? "show" : "hide"}</button>
        <button class="outliner-delete" title="Delete">X</button>
      </div>`;
    }).join("") : `<div class="object-list-empty">${sceneObjects().length ? "No matching items." : "The scene is empty."}</div>`;
  }

  function renderAssetEditor() {
    const asset = project.assets.find(a => a.id === selectedAssetId);
    $("#assetStudioEmpty").hidden = !!asset;
    $("#assetEditor").hidden = !asset;
    if (!asset) return;
    $("#assetName").value = asset.name;
    if ($("#assetCategory")) $("#assetCategory").value = normalizeAssetCategory(asset);
    const image = images.get(asset.id);
    const used = project.objects.filter(o => o.assetId === asset.id).length;
    const rigged = bodyParts.filter(part => project.rig[part] === asset.id).map(part => prettyPart[part]);
    const size = image?.naturalWidth ? `${image.naturalWidth} x ${image.naturalHeight} pixels` : "Reading dimensions...";
    $("#assetDetails").textContent = `${size} - placed ${used} time${used === 1 ? "" : "s"}${rigged.length ? ` - character: ${rigged.join(", ")}` : ""}`;
    $("#assetZoom").value = Math.round(assetZoom * 100);
    $("#assetZoomValue").textContent = `${Math.round(assetZoom * 100)}%`;
    $("#transparentBackground").checked = transparencyPreview;
    $("#backgroundColor").value = rgbToHex(backgroundRgb);
    if ($("#backgroundRemoveMode")) $("#backgroundRemoveMode").value = backgroundRemoveMode;
    $("#colorTolerance").value = colorTolerance;
    $("#toleranceValue").textContent = colorTolerance;
    renderTransparencyNotice(asset);
    updateSelectionDetails();
    if (image?.naturalWidth) drawAssetPreview();
  }

  function renderTransparencyNotice(asset) {
    const notice = $("#transparencyNotice");
    if (transparencyPreview) {
      notice.className = "transparency-notice preview-only";
      notice.innerHTML = `<strong>Preview only</strong><span>These removal settings are not saved yet. Placing or using "Download saved image" still uses the currently saved asset.</span>`;
    } else if (asset?.backgroundRemoved) {
      notice.className = "transparency-notice saved-alpha";
      notice.innerHTML = `<strong>Transparency saved</strong><span>This asset contains real transparent pixels. Placing and downloading it will keep the background removed.</span>`;
    } else {
      notice.className = "transparency-notice preview-only";
      notice.innerHTML = `<strong>Saved image unchanged</strong><span>Background-removal preview is off. Placing and downloading uses the original saved image data.</span>`;
    }
  }

  function rgbToHex(color) {
    return `#${[color.r, color.g, color.b].map(value => value.toString(16).padStart(2, "0")).join("")}`;
  }

  function hexToRgb(hex) {
    return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
  }

  function backgroundColorDistance(pixels, index) {
    const dr = pixels[index] - backgroundRgb.r;
    const dg = pixels[index + 1] - backgroundRgb.g;
    const db = pixels[index + 2] - backgroundRgb.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  function removeGlobalBackgroundPixels(imageData) {
    const pixels = imageData.data;
    const feather = 12;
    for (let i = 0; i < pixels.length; i += 4) {
      const distance = backgroundColorDistance(pixels, i);
      if (distance <= colorTolerance) pixels[i + 3] = 0;
      else if (distance < colorTolerance + feather) pixels[i + 3] = Math.round(pixels[i + 3] * (distance - colorTolerance) / feather);
    }
    return imageData;
  }

  function removeOutsideConnectedBackgroundPixels(imageData) {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const visited = new Uint8Array(width * height);
    const queue = [];
    const enqueue = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const pixelIndex = y * width + x;
      if (visited[pixelIndex]) return;
      const dataIndex = pixelIndex * 4;
      if (pixels[dataIndex + 3] === 0 || backgroundColorDistance(pixels, dataIndex) <= colorTolerance) {
        visited[pixelIndex] = 1;
        queue.push(pixelIndex);
      }
    };
    for (let x = 0; x < width; x++) {
      enqueue(x, 0);
      enqueue(x, height - 1);
    }
    for (let y = 1; y < height - 1; y++) {
      enqueue(0, y);
      enqueue(width - 1, y);
    }
    for (let read = 0; read < queue.length; read++) {
      const pixelIndex = queue[read];
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      pixels[pixelIndex * 4 + 3] = 0;
      enqueue(x + 1, y);
      enqueue(x - 1, y);
      enqueue(x, y + 1);
      enqueue(x, y - 1);
    }
    return imageData;
  }

  function removeBackgroundPixels(imageData) {
    return backgroundRemoveMode === "outside" ? removeOutsideConnectedBackgroundPixels(imageData) : removeGlobalBackgroundPixels(imageData);
  }
  function applyTransparency(imageData) {
    return transparencyPreview ? removeBackgroundPixels(imageData) : imageData;
  }

  function makeTransparentAssetCanvas(image, trim = false) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.putImageData(removeBackgroundPixels(data), 0, 0);
    return trim ? trimTransparentCanvas(canvas) : canvas;
  }

  function transparencyMetadata() {
    return { color: rgbToHex(backgroundRgb), tolerance: colorTolerance, mode: backgroundRemoveMode, appliedAt: Date.now() };
  }

  function processedAssetCanvas(asset, image) {
    const key = `${asset.id}:${transparencyPreview}:${backgroundRemoveMode}:${backgroundRgb.r},${backgroundRgb.g},${backgroundRgb.b}:${colorTolerance}:${image.naturalWidth}x${image.naturalHeight}`;
    if (assetPreviewCache?.key === key) return assetPreviewCache.canvas;
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    if (transparencyPreview) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.putImageData(applyTransparency(data), 0, 0);
    }
    assetPreviewCache = { key, canvas };
    return canvas;
  }

  function drawAssetPreview() {
    const asset = project.assets.find(a => a.id === selectedAssetId);
    const image = images.get(selectedAssetId);
    if (!asset || !image?.naturalWidth) return;
    assetPreview.width = image.naturalWidth;
    assetPreview.height = image.naturalHeight;
    assetPreview.style.width = `${Math.round(image.naturalWidth * assetZoom)}px`;
    assetPreview.style.height = `${Math.round(image.naturalHeight * assetZoom)}px`;
    assetCtx.imageSmoothingEnabled = false;
    assetCtx.clearRect(0, 0, assetPreview.width, assetPreview.height);
    assetCtx.drawImage(processedAssetCanvas(asset, image), 0, 0);
    if (floatingPasteLayer?.assetId === selectedAssetId && floatingPasteLayer.image?.complete) {
      drawFloatingPasteLayer(assetCtx, floatingPasteLayer);
      assetCtx.save();
      assetCtx.strokeStyle = "#ffef95";
      assetCtx.fillStyle = "rgba(255,216,120,.10)";
      assetCtx.lineWidth = Math.max(2, 3 / assetZoom);
      assetCtx.setLineDash([Math.max(4, 8 / assetZoom), Math.max(3, 5 / assetZoom)]);
      assetCtx.fillRect(floatingPasteLayer.x, floatingPasteLayer.y, layerDrawWidth(floatingPasteLayer), layerDrawHeight(floatingPasteLayer));
      assetCtx.strokeRect(floatingPasteLayer.x, floatingPasteLayer.y, layerDrawWidth(floatingPasteLayer), layerDrawHeight(floatingPasteLayer));
      assetCtx.restore();
    }
    if (assetPaintTool !== "select" && assetPaintHover) drawPaintCursorPreview(assetPaintHover);
    if (assetSelection) {
      assetCtx.save();
      assetCtx.fillStyle = "rgba(214,168,70,.12)";
      assetCtx.strokeStyle = "#ffd878";
      assetCtx.lineWidth = Math.max(2, 3 / assetZoom);
      assetCtx.setLineDash([Math.max(4, 8 / assetZoom), Math.max(3, 5 / assetZoom)]);
      assetCtx.fillRect(assetSelection.x, assetSelection.y, assetSelection.w, assetSelection.h);
      assetCtx.strokeRect(assetSelection.x, assetSelection.y, assetSelection.w, assetSelection.h);
      assetCtx.restore();
    }
  }

  function updateSelectionDetails(message = "") {
    if (message) assetStatusMessage = message;
    $("#extractAsset").disabled = !assetSelection;
    $("#downloadSelectedSprite").disabled = !assetSelection;
    if ($("#copySelectedSprite")) $("#copySelectedSprite").disabled = !assetSelection;
    if ($("#pasteCopiedSprite")) $("#pasteCopiedSprite").disabled = !copiedAssetSprite;
    if ($("#moveFloatingPaste")) {
      $("#moveFloatingPaste").disabled = !(floatingPasteLayer?.assetId === selectedAssetId);
      $("#moveFloatingPaste").classList.toggle("active", assetMoveLayerMode && floatingPasteLayer?.assetId === selectedAssetId);
    }
    if ($("#mergeFloatingPaste")) $("#mergeFloatingPaste").disabled = !(floatingPasteLayer?.assetId === selectedAssetId);
    if ($("#cancelFloatingPaste")) $("#cancelFloatingPaste").disabled = !(floatingPasteLayer?.assetId === selectedAssetId);
    if ($("#undoAssetEdit")) $("#undoAssetEdit").disabled = !assetUndoStack.length;
    const hasFloatingLayer = floatingPasteLayer?.assetId === selectedAssetId;
    if ($("#floatingLayerScale")) {
      $("#floatingLayerScale").disabled = !hasFloatingLayer;
      $("#floatingLayerScale").value = hasFloatingLayer ? Math.round((floatingPasteLayer.scale || 1) * 100) : 100;
    }
    if ($("#floatingLayerScaleExact")) {
      $("#floatingLayerScaleExact").disabled = !hasFloatingLayer;
      $("#floatingLayerScaleExact").value = hasFloatingLayer ? Math.round((floatingPasteLayer.scale || 1) * 100) : 100;
    }
    if ($("#floatingLayerScaleValue")) $("#floatingLayerScaleValue").textContent = hasFloatingLayer ? `${Math.round((floatingPasteLayer.scale || 1) * 100)}%` : "100%";
    if ($("#resetFloatingLayerScale")) $("#resetFloatingLayerScale").disabled = !hasFloatingLayer;
    if ($("#pasteFlipX")) $("#pasteFlipX").disabled = !copiedAssetSprite;
    if ($("#pasteFlipY")) $("#pasteFlipY").disabled = !copiedAssetSprite;
    $("#keepSelectionPixels").disabled = !assetSelection;
    $("#eraseSelectionPixels").disabled = !assetSelection;
    ["selectionX", "selectionY", "selectionW", "selectionH"].forEach(id => { $(`#${id}`).disabled = !assetSelection; });
    if (assetSelection) {
      $("#selectionX").value = assetSelection.x;
      $("#selectionY").value = assetSelection.y;
      $("#selectionW").value = assetSelection.w;
      $("#selectionH").value = assetSelection.h;
    } else {
      ["selectionX", "selectionY", "selectionW", "selectionH"].forEach(id => { $(`#${id}`).value = ""; });
    }
    $("#selectionDetails").textContent = message || assetStatusMessage || (assetSelection
      ? `Selected sprite: ${assetSelection.w} x ${assetSelection.h}px at ${assetSelection.x}, ${assetSelection.y}`
      : "No sprite selected yet.");
  }

  function renderRig() {
    $("#rigSummary").innerHTML = bodyParts.map(part => {
      const asset = project.assets.find(a => a.id === project.rig[part]);
      return `<div><span>${prettyPart[part]}</span><strong>${asset ? escapeHtml(asset.name) : "placeholder"}</strong></div>`;
    }).join("");
  }

  function renderInspector() {
    const o = project.objects.find(item => item.id === selectionId);
    $("#inspector").hidden = !o;
    $("#noSelection").hidden = !!o;
    $("#selectionType").textContent = o ? o.type.replace("-", " ") : "Nothing selected";
    if (!o) return;
    $("#objName").value = o.name;
    $("#objX").value = Math.round(o.x);
    $("#objY").value = Math.round(o.y);
    $("#objW").value = Math.round(o.w);
    $("#objH").value = Math.round(o.h);
    $("#objLayer").value = o.layer;
    if ($("#objAlwaysOnTop")) $("#objAlwaysOnTop").checked = !!o.alwaysOnTop;
    if ($("#objLocked")) $("#objLocked").checked = !!o.locked;
    if ($("#objOpacity")) {
      $("#objOpacity").value = Math.round((o.opacity ?? 1) * 100);
      $("#objOpacityValue").textContent = `${Math.round((o.opacity ?? 1) * 100)}%`;
    }
    if ($("#objBlendMode")) $("#objBlendMode").value = objectBlendMode(o);
    $("#objFlip").checked = !!o.flip;
    $("#objRotation").value = o.rotation || 0;
    $("#rotationValue").textContent = `${Math.round(o.rotation || 0)} deg`;
    $("#transformFields").hidden = o.type === "trigger";
    $("#triggerFields").hidden = o.type !== "trigger";
    $("#busFields").hidden = o.type !== "bus";
    $("#objectScriptEditor").hidden = true;
    $("#scriptEditActions").hidden = true;
    $("#scriptStatus").textContent = "";
    if (o.type === "trigger") {
      $("#triggerAction").value = o.action || "dialogue";
      $("#triggerPrompt").value = o.prompt || "";
      $("#triggerDialogue").value = o.dialogue || "";
      $("#triggerDuration").value = o.duration || 0;
      $("#triggerBreak").value = o.breakChance || 0;
      $("#breakValue").textContent = `${o.breakChance || 0}%`;
      $("#triggerReward").value = o.reward || 0;
    }
    if (o.type === "bus") {
      $("#busDelay").value = o.busDelay ?? 5;
      $("#busDuration").value = o.busDuration ?? 3;
      $("#busStartScale").value = Math.round((o.busStartScale ?? .59) * 100);
      $("#busEndScale").value = Math.round((o.busEndScale ?? 1) * 100);
      $("#busDriftX").value = o.busDriftX ?? 0;
      $("#busDriftY").value = o.busDriftY ?? 0;
      $("#busAnchor").value = o.busAnchor === "center" ? "center" : "bottom";
      renderBusScriptPreview(o);
    }
  }

  function scriptAssetName(assetId) {
    const asset = project.assets.find(item => item.id === assetId);
    return asset ? asset.name : "none";
  }

  function defaultObjectScript(o) {
    if (o?.type === "bus") return `// Real JavaScript. Runs every frame during Play Scene.
// You can edit this freely. Available: object, game, dt, api.
const wait = ${o.busDelay ?? 5};
const driveTime = ${o.busDuration ?? 3};
const runOverAfter = ${o.busRunOverAfter ?? 7};
object.busStartScale = ${o.busStartScale ?? .59};
object.busEndScale = ${o.busEndScale ?? 1};
object.busDriftX = ${o.busDriftX ?? 0};
object.busDriftY = ${o.busDriftY ?? 0};
object.busAnchor = "${o.busAnchor === "center" ? "center" : "bottom"}";

if (api.state.departed) {
  if (api.busProgressFrom(api.state.drivePastStartedAt, driveTime) >= 1) api.hideObject();
  return;
}

if (api.state.runningOverPlayer) {
  api.knockPlayerDown();
  const passProgress = api.busProgressFrom(api.state.drivePastStartedAt, driveTime);
  if (passProgress >= .72) api.hidePlayer();
  if (passProgress >= 1) {
    api.goToScene("${o.busRunOverSceneId || "hospital"}", "The bus driver warned you, but you stayed in the road. You wake up at the hospital and lose the morning.");
  }
  return;
}

const progress = api.busProgress(wait, driveTime);

if (progress >= 0 && progress < 1 && api.playerBlocksBus()) {
  api.honk("${o.honkSound || "soundAssets/bus_horn.mp3"}", "bus_driver_honk.png");
  if (api.blockedFor() >= runOverAfter) {
    api.knockPlayerDown();
    api.startBusPassNow();
    api.state.runningOverPlayer = true;
  }
} else {
  api.clearBlock();
  if (progress >= 0) {
    api.startBusPassNow();
    api.state.departed = true;
  }
}`;
    return `// Real JavaScript. Runs every frame during Play Scene.
// Available: object, game, dt, api.
// Example:
// object.x += 40 * dt;
`;
  }

  function objectScriptText(o) {
    if (!o) return "// Select an object to see its script.";
    return o.scriptCode || defaultObjectScript(o);
  }

  function parseScalePercent(value, fallback, min, max) {
    const number = Number(String(value).replace("%", "").trim());
    return clamp((Number.isFinite(number) ? number : fallback * 100) / 100, min, max);
  }
  function cleanScriptValue(value) {
    return String(value ?? "").trim().replace(/^['"]|['"]$/g, "");
  }

  function resolveAssetReference(value) {
    const clean = cleanScriptValue(value);
    if (!clean || clean.toLowerCase() === "none" || clean.toLowerCase() === "null") return null;
    const lower = clean.toLowerCase();
    const noExt = lower.replace(/\.[^.]+$/, "");
    const exact = project.assets.find(asset => asset.id === clean || asset.name.toLowerCase() === lower || asset.name.replace(/\.[^.]+$/, "").toLowerCase() === noExt);
    if (exact) return exact.id;
    const loose = project.assets.find(asset => {
      const assetLower = asset.name.toLowerCase();
      const assetNoExt = assetLower.replace(/\.[^.]+$/, "");
      return assetLower.includes(lower) || assetNoExt.includes(noExt) || lower.includes(assetNoExt);
    });
    return loose?.id || null;
  }

  function resolveSceneReference(value, fallbackId = "hospital") {
    const clean = cleanScriptValue(value);
    if (!clean) return fallbackId;
    const lower = clean.toLowerCase();
    const found = project.scenes.find(scene => scene.id === clean || scene.name.toLowerCase() === lower || scene.id.toLowerCase() === lower);
    return found?.id || clean;
  }

  function applyObjectScript(o, script) {
    if (!o) throw new Error("Select an object first.");
    new Function("object", "game", "dt", "api", script);
    o.scriptCode = script;
    o.scriptError = "";
  }

  function renderBusScriptPreview(o) {
    const startScale = Math.round((o.busStartScale ?? .59) * 100);
    const endScale = Math.round((o.busEndScale ?? 1) * 100);
    const driftX = Math.round(o.busDriftX ?? 0);
    const driftY = Math.round(o.busDriftY ?? 0);
    $("#busStartScaleValue").textContent = `${startScale}%`;
    $("#busEndScaleValue").textContent = `${endScale}%`;
    $("#busDriftXValue").textContent = `${driftX}px`;
    $("#busDriftYValue").textContent = `${driftY}px`;
    $("#busScriptPreview").textContent = objectScriptText(o);
    if (!$("#objectScriptEditor").hidden && $("#objectScriptEditor").readOnly) $("#objectScriptEditor").value = objectScriptText(o);
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function hitTest(point) {
    for (const layer of project.layers.slice().reverse()) {
      if (!layer.visible) continue;
      const localX = point.x + cameraX * (layer.parallax - 1);
      const objects = sceneObjects().filter(o => o.visible !== false && o.layer === layer.id).slice().reverse();
      const found = objects.find(o => pointInsideObject(localX, point.y, o));
      if (found) return found;
    }
    return null;
  }

  function objectVisualBounds(object) {
    if (object.type !== "bus") return { cx: object.x + object.w / 2, cy: object.y + object.h / 2, w: object.w, h: object.h };
    const progress = game && playing ? busVisualProgress(object) : 0;
    const startScale = clamp(Number(object.busStartScale) || .59, .05, 1.5);
    const endScale = clamp(Number(object.busEndScale) || 1, .5, 3);
    const scale = startScale + (endScale - startScale) * progress;
    const w = object.w * scale;
    const h = object.h * scale;
    const cx = object.x + object.w / 2 + (Number(object.busDriftX) || 0) * progress;
    const bottom = object.y + object.h + (Number(object.busDriftY) || 0) * progress;
    const cy = object.busAnchor === "center" ? object.y + object.h / 2 + (Number(object.busDriftY) || 0) * progress : bottom - h / 2;
    return { cx, cy, w, h };
  }

  function pointInsideObject(x, y, object) {
    const bounds = objectVisualBounds(object);
    const angle = (object.rotation || 0) * Math.PI / 180;
    const dx = x - bounds.cx, dy = y - bounds.cy;
    const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
    const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
    return Math.abs(localX) <= bounds.w / 2 && Math.abs(localY) <= bounds.h / 2;
  }

  function addObject(type, x = cameraX + editorCanvas.width / zoom / 2, y = 430) {
    const defaults = {
      bus: ["Bus", 330, 160], "bus-stop": ["Bus stop", 100, 150], car: ["Junk car", 260, 140],
      gate: ["Gate", 270, 260], npc: ["Worker", 70, 145], prop: ["Prop", 110, 90],
      trigger: ["Interaction", 260, 180], spawn: ["Player start", 60, 60], player_start_here: ["player_start_here", 130, 70]
    }[type];
    const object = { id: uid(), type, name: defaults[0], sceneId: project.activeSceneId, x: clamp(x - defaults[1] / 2, 0, project.world.width - defaults[1]), y: y - defaults[2] / 2, w: defaults[1], h: defaults[2], layer: project.activeLayer, flip: false, rotation: 0 };
    if (type === "trigger") Object.assign(object, { action: "dialogue", prompt: "Press E to interact", dialogue: "Write dialogue in the Inspector.", duration: 0, breakChance: 0, reward: 0 });
    if (type === "bus") Object.assign(object, { busDelay: 5, busDuration: 3, busStartScale: .59, busEndScale: 1, busDriftX: 0, busDriftY: 0, busAnchor: "bottom", busRunOverAfter: 7, busRunOverSceneId: "hospital", honkAssetId: null, honkSound: "soundAssets/bus_horn.mp3" });
    if (type === "spawn" || type === "player_start_here") {
      object.layer = "ground";
      project.player.spawnX = object.x + object.w / 2;
    }
    project.objects.push(object);
    selectionId = object.id;
    $("#emptyTip").hidden = true;
    renderInspector();
    renderOutliner();
    markDirty();
  }

  editorCanvas.addEventListener("pointerdown", event => {
    editorCanvas.setPointerCapture(event.pointerId);
    const p = screenToWorld(event.clientX, event.clientY);
    pointer = p;
    if (placingSelectedAsset && selectedAssetId) {
      const asset = project.assets.find(a => a.id === selectedAssetId);
    const image = images.get(selectedAssetId);
      const ratio = image?.naturalWidth ? image.naturalWidth / image.naturalHeight : 1;
      const h = 150, w = h * ratio;
      const object = { id: uid(), type: "asset", sceneId: project.activeSceneId, name: asset.name.replace(/\.[^.]+$/, ""), assetId: asset.id, x: p.x - w / 2, y: p.y - h / 2, w, h, layer: project.activeLayer, flip: false, rotation: 0 };
      project.objects.push(object);
      selectionId = object.id;
      placingSelectedAsset = false;
      renderAssets(); renderInspector(); renderOutliner(); markDirty();
      return;
    }
    if (placingCarModelId && selectedCarModel()) {
      placeSelectedCarModelAt(p);
      return;
    }
    if (activeTool === "pan" || event.button === 1 || event.altKey) {
      drag = { mode: "pan", startX: event.clientX, cameraX };
      return;
    }
    if (activeTool === "trigger") {
      addObject("trigger", p.x, p.y);
      const o = project.objects.find(item => item.id === selectionId);
      o.x = p.x; o.y = p.y; o.w = 10; o.h = 10;
      drag = { mode: "draw", object: o, start: p };
      return;
    }
    const hit = hitTest(p);
    selectionId = hit?.id || null;
    renderInspector();
    renderOutliner();
    if (hit && !hit.locked) {
      const layer = project.layers.find(l => l.id === hit.layer);
      drag = { mode: "move", object: hit, dx: p.x + cameraX * (layer.parallax - 1) - hit.x, dy: p.y - hit.y };
    }
  });

  editorCanvas.addEventListener("pointermove", event => {
    if (!drag) return;
    const p = screenToWorld(event.clientX, event.clientY);
    if (drag.mode === "pan") {
      cameraX = clamp(drag.cameraX - (event.clientX - drag.startX) / zoom, 0, Math.max(0, project.world.width - editorCanvas.width / zoom));
    } else if (drag.mode === "move") {
      const layer = project.layers.find(l => l.id === drag.object.layer);
      drag.object.x = clamp(p.x + cameraX * (layer.parallax - 1) - drag.dx, 0, project.world.width - drag.object.w);
      drag.object.y = clamp(p.y - drag.dy, 0, project.world.height - drag.object.h);
      if (isPlayerStartObject(drag.object)) project.player.spawnX = drag.object.x + drag.object.w / 2;
      renderInspector();
    } else if (drag.mode === "draw") {
      drag.object.x = Math.min(drag.start.x, p.x);
      drag.object.y = Math.min(drag.start.y, p.y);
      drag.object.w = Math.max(10, Math.abs(p.x - drag.start.x));
      drag.object.h = Math.max(10, Math.abs(p.y - drag.start.y));
      renderInspector();
    }
  });

  editorCanvas.addEventListener("pointerup", () => {
    if (drag && drag.mode !== "pan") { renderOutliner(); markDirty(); }
    drag = null;
  });

  editorCanvas.addEventListener("wheel", event => {
    event.preventDefault();
    if (event.ctrlKey) setZoom(zoom * (event.deltaY > 0 ? .9 : 1.1));
    else cameraX = clamp(cameraX + event.deltaY + event.deltaX, 0, Math.max(0, project.world.width - editorCanvas.width / zoom));
  }, { passive: false });

  function setZoom(value) {
    zoom = clamp(value, .45, 2);
    cameraX = clamp(cameraX, 0, Math.max(0, project.world.width - editorCanvas.width / zoom));
  }

  $$(".tab").forEach(tab => tab.addEventListener("click", () => {
    $$(".tab").forEach(t => t.classList.toggle("active", t === tab));
    $$(".tab-page").forEach(page => page.classList.toggle("active", page.id === `${tab.dataset.tab}Page`));
  }));
  $$(".tool").forEach(button => button.addEventListener("click", () => {
    activeTool = button.dataset.tool;
    $$(".tool").forEach(b => b.classList.toggle("active", b === button));
  }));
  $$(".object-grid button").forEach(button => button.addEventListener("click", () => addObject(button.dataset.create)));

  $("#outlinerSearch").addEventListener("input", event => {
    outlinerQuery = event.target.value;
    renderOutliner();
  });
  $("#objectList").addEventListener("click", event => {
    const row = event.target.closest(".object-row");
    if (!row) return;
    const object = project.objects.find(o => o.id === row.dataset.object);
    if (!object) return;
    if (event.target.closest(".outliner-delete")) {
      project.objects = project.objects.filter(o => o.id !== object.id);
      if (selectionId === object.id) selectionId = null;
      renderInspector(); renderOutliner(); markDirty();
      return;
    }
    if (event.target.closest(".outliner-visibility")) {
      object.visible = object.visible === false;
      renderOutliner(); markDirty();
      return;
    }
    selectionId = object.id;
    focusObject(object);
    renderInspector();
    renderOutliner();
  });

  function focusObject(object) {
    const layer = project.layers.find(l => l.id === object.layer);
    const parallax = layer?.parallax ?? 1;
    if (parallax <= 0) return;
    const viewport = editorCanvas.width / zoom;
    cameraX = Math.max(0, (object.x + object.w / 2 - viewport / 2) / parallax);
  }

  $("#sceneSelect").onchange = event => {
    project.activeSceneId = event.target.value;
    selectionId = null;
    cameraX = 0;
    renderScenes(); renderLayers(); renderInspector(); renderOutliner(); markDirty();
  };
  $("#addScene").onclick = () => {
    const name = prompt("Scene name", `Scene ${project.scenes.length + 1}`);
    if (!name) return;
    const id = uid();
    project.scenes.push({ id, name });
    project.activeSceneId = id;
    selectionId = null;
    cameraX = 0;
    renderScenes(); renderLayers(); renderInspector(); renderOutliner(); markDirty();
  };
  $("#renameScene").onclick = () => {
    const scene = activeScene();
    const name = prompt("Rename scene", scene.name);
    if (!name) return;
    scene.name = name;
    renderScenes(); renderOutliner(); markDirty();
  };
  $("#layerList").addEventListener("click", event => {
    const row = event.target.closest(".layer-row");
    if (!row) return;
    const layer = project.layers.find(l => l.id === row.dataset.layer);
    if (event.target.closest(".visibility")) layer.visible = !layer.visible;
    else project.activeLayer = layer.id;
    renderLayers(); markDirty();
  });
  $("#addLayer").addEventListener("click", () => {
    const id = uid();
    project.layers.push({ id, name: `New scenery layer`, parallax: .5, visible: true, color: "#454c40" });
    project.activeLayer = id; renderLayers(); markDirty();
  });
  $("#zoomIn").onclick = () => setZoom(zoom * 1.15);
  $("#zoomOut").onclick = () => setZoom(zoom / 1.15);
  $("#zoomReset").onclick = () => { zoom = 1; cameraX = 0; };

  $("#worldWidth").value = project.world.width;
  $("#groundHeight").value = project.world.groundHeight;
  $("#walkSpeed").value = project.player.walkSpeed;
  $("#crawlSpeed").value = project.player.crawlSpeed;
  function updateLabels() {
    $("#worldWidthValue").textContent = `${project.world.width}px`;
    $("#groundValue").textContent = `${project.world.groundHeight}px`;
    $("#speedValue").textContent = `${project.player.walkSpeed}px/s`;
    $("#crawlValue").textContent = `${project.player.crawlSpeed}px/s`;
  }
  ["worldWidth", "groundHeight", "walkSpeed", "crawlSpeed"].forEach(id => {
    $(`#${id}`).addEventListener("input", event => {
      if (id === "worldWidth") project.world.width = +event.target.value;
      if (id === "groundHeight") project.world.groundHeight = +event.target.value;
      if (id === "walkSpeed") project.player.walkSpeed = +event.target.value;
      if (id === "crawlSpeed") project.player.crawlSpeed = +event.target.value;
      updateLabels(); markDirty();
    });
  });

  if ($("#assetLibraryCategory")) $("#assetLibraryCategory").onchange = event => {
    assetLibraryCategory = event.target.value || "working";
    renderAssets();
  };
  if ($("#assetStudioCategory")) $("#assetStudioCategory").onchange = event => {
    assetStudioCategory = event.target.value || "all";
    renderAssets();
  };
  if ($("#assetCategory")) $("#assetCategory").onchange = event => {
    const asset = project.assets.find(a => a.id === selectedAssetId);
    if (!asset) return;
    asset.category = assetCategories.includes(event.target.value) ? event.target.value : "working";
    renderAssets();
    renderSceneArtControls();
    renderRig();
    if ($("#characterAnimator").classList.contains("active")) renderCharacterAnimator();
    if ($("#carBuilder")?.classList.contains("active")) renderCarBuilder();
    markDirty();
  };
  $("#placeSelectedAsset").onclick = () => {
    if (!selectedAssetId) return alert("Select an asset first.");
    placingSelectedAsset = true;
    setTool("select");
    alert("Now click once in the scene where you want to place this asset.");
  };
  $("#addAssets").onclick = () => $("#assetFiles").click();
  $("#assetFiles").addEventListener("change", async event => {
    for (const file of event.target.files) {
      const src = await fileToDataUrl(file);
      const asset = { id: uid(), name: file.name, src, category: assetLibraryCategory === "all" ? "working" : assetLibraryCategory };
      project.assets.push(asset);
      const img = new Image(); img.onload = refreshAssetViews; img.src = src; images.set(asset.id, img);
      selectedAssetId = asset.id;
    }
    resetAssetWorkspace();
    renderAssets(); markDirty(); event.target.value = "";
  });
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  $("#assetGrid").addEventListener("click", event => {
    const deleteButton = event.target.closest("[data-delete-asset]");
    if (deleteButton) {
      deleteAssetById(deleteButton.dataset.deleteAsset);
      return;
    }
    const card = event.target.closest(".asset-card");
    if (!card) return;
    if (selectedAssetId !== card.dataset.asset) resetAssetWorkspace();
    selectedAssetId = card.dataset.asset;
    renderAssets();
  });
  $("#sceneArtSlot").onchange = renderSceneArtControls;
  $("#assignSceneArt").onclick = () => {
    if (!selectedAssetId) return alert("Select an imported asset first in the Asset library.");
    const slot = currentSceneArtSlot();
    project.sceneArt = normalizeSceneArt(project.sceneArt);
    project.sceneArt[slot].assetId = selectedAssetId;
    const assignedAsset = project.assets.find(asset => asset.id === selectedAssetId);
    if (assignedAsset) assignedAsset.category = slot === "background" || slot === "far" || slot === "ground" || slot === "front" ? "world" : "object";
    renderSceneArtControls();
    markDirty();
  };
  $("#clearSceneArt").onclick = () => {
    const slot = currentSceneArtSlot();
    project.sceneArt = normalizeSceneArt(project.sceneArt);
    project.sceneArt[slot].assetId = null;
    renderSceneArtControls();
    markDirty();
  };
  ["sceneArtMode", "sceneArtSpacing", "sceneArtYOffset", "sceneArtHeight"].forEach(id => {
    $(`#${id}`).addEventListener("input", event => {
      const slot = currentSceneArtSlot();
      project.sceneArt = normalizeSceneArt(project.sceneArt);
      const art = project.sceneArt[slot];
      if (id === "sceneArtMode") art.mode = event.target.value === "tile" ? "tile" : "stretch";
      if (id === "sceneArtSpacing") art.spacing = +event.target.value;
      if (id === "sceneArtYOffset") art.yOffset = +event.target.value;
      if (id === "sceneArtHeight") art.height = +event.target.value;
      renderSceneArtControls();
      markDirty();
    });
  });
  $("#assignObjectAsset").onclick = () => {
    const object = project.objects.find(item => item.id === selectionId);
    if (!object) return;
    if (!selectedAssetId) return alert("Select an imported asset first in the Asset library.");
    object.assetId = selectedAssetId;
    const assignedAsset = project.assets.find(asset => asset.id === selectedAssetId);
    if (assignedAsset) assignedAsset.category = object.type === "asset" ? "world" : "object";
    renderInspector();
    renderOutliner();
    markDirty();
  };
  $("#clearObjectAsset").onclick = () => {
    const object = project.objects.find(item => item.id === selectionId);
    if (!object) return;
    object.assetId = null;
    renderInspector();
    markDirty();
  };
  $("#studioAssetGrid").addEventListener("click", event => {
    const deleteButton = event.target.closest("[data-delete-asset]");
    if (deleteButton) {
      deleteAssetById(deleteButton.dataset.deleteAsset);
      return;
    }
    const card = event.target.closest(".studio-asset-card");
    if (!card) return;
    if (selectedAssetId !== card.dataset.asset) resetAssetWorkspace();
    selectedAssetId = card.dataset.asset;
    renderAssets();
  });
  $("#openAssetStudio").onclick = () => {
    $("#assetStudio").classList.add("active");
    $("#assetStudio").setAttribute("aria-hidden", "false");
    renderAssets();
  };
  $("#closeAssetStudio").onclick = closeAssetStudio;
  function closeAssetStudio() {
    $("#assetStudio").classList.remove("active");
    $("#assetStudio").setAttribute("aria-hidden", "true");
  }
  $("#studioImport").onclick = () => $("#assetFiles").click();
  function setAssetPaintTool(tool) {
    assetPaintTool = ["select", "pen", "brush", "spray", "erase"].includes(tool) ? tool : "select";
    if (tool !== "pick-color") paintColorPickActive = false;
    [["paintSelectTool", "select"], ["paintPenTool", "pen"], ["paintBrushTool", "brush"], ["paintSprayTool", "spray"], ["paintEraseTool", "erase"]].forEach(([id, value]) => {
      const button = $(`#${id}`);
      if (button) button.classList.toggle("active", assetPaintTool === value);
    });
    if ($("#pickPaintColor")) $("#pickPaintColor").classList.toggle("active", paintColorPickActive);
    if (assetPreview) {
      assetPreview.classList.toggle("painting", assetPaintTool !== "select" && !paintColorPickActive);
      assetPreview.classList.toggle("moving-layer", assetMoveLayerMode && floatingPasteLayer?.assetId === selectedAssetId);
      assetPreview.classList.toggle("picking-color", paintColorPickActive);
    }
    drawAssetPreview();
  }

  function setPaintColorPicker(active) {
    paintColorPickActive = active;
    if (active) {
      paintColorPickReturnTool = assetPaintTool === "select" ? "pen" : assetPaintTool;
      assetPaintTool = "select";
      assetStatusMessage = "Click a pixel in the asset to use it as the paint color.";
    } else {
      assetPaintTool = paintColorPickReturnTool || "pen";
      assetStatusMessage = "";
    }
    [["paintSelectTool", "select"], ["paintPenTool", "pen"], ["paintBrushTool", "brush"], ["paintSprayTool", "spray"], ["paintEraseTool", "erase"]].forEach(([id, value]) => {
      const button = $(`#${id}`);
      if (button) button.classList.toggle("active", !paintColorPickActive && assetPaintTool === value);
    });
    if ($("#pickPaintColor")) $("#pickPaintColor").classList.toggle("active", paintColorPickActive);
    if (assetPreview) {
      assetPreview.classList.toggle("painting", assetPaintTool !== "select" && !paintColorPickActive);
      assetPreview.classList.toggle("moving-layer", assetMoveLayerMode && floatingPasteLayer?.assetId === selectedAssetId);
      assetPreview.classList.toggle("picking-color", paintColorPickActive);
    }
    drawAssetPreview();
    updateSelectionDetails();
  }

  function samplePaintColor(point) {
    const asset = project.assets.find(a => a.id === selectedAssetId);
    const image = images.get(selectedAssetId);
    if (!asset || !image?.naturalWidth) return;
    const sample = processedAssetCanvas(asset, image);
    const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
    const pixel = sampleCtx.getImageData(point.x, point.y, 1, 1).data;
    if (pixel[3] === 0) {
      updateSelectionDetails("That pixel is transparent, so the paint color was not changed.");
      return;
    }
    $("#paintColor").value = rgbToHex({ r: pixel[0], g: pixel[1], b: pixel[2] });
    setPaintColorPicker(false);
    drawAssetPreview();
  }

  function paintPreviewColor(settings) {
    if (settings.tool === "erase") return { r: 255, g: 93, b: 78 };
    const picked = hexToRgb(settings.color || "#ffd15a");
    const inverted = { r: 255 - picked.r, g: 255 - picked.g, b: 255 - picked.b };
    const luminance = (inverted.r * 0.299) + (inverted.g * 0.587) + (inverted.b * 0.114);
    if (luminance > 95 && luminance < 175) return luminance < 135 ? { r: 255, g: 238, b: 120 } : { r: 45, g: 225, b: 255 };
    return inverted;
  }

  function drawPaintCursorPreview(point) {
    const settings = paintSettings();
    const size = Math.max(1, Math.round(settings.size));
    const radius = size / 2;
    const isPen = settings.tool === "pen";
    const previewRgb = paintPreviewColor(settings);
    const color = `rgba(${previewRgb.r}, ${previewRgb.g}, ${previewRgb.b}, .48)`;
    const centerColor = `rgb(${previewRgb.r}, ${previewRgb.g}, ${previewRgb.b})`;
    const x = Math.round(point.x - size / 2);
    const y = Math.round(point.y - size / 2);

    assetCtx.save();
    assetCtx.globalAlpha = 1;
    assetCtx.setLineDash([]);
    assetCtx.fillStyle = color;
    if (isPen || size <= 1) {
      assetCtx.fillRect(x, y, size, size);
    } else {
      assetCtx.beginPath();
      assetCtx.arc(point.x + .5, point.y + .5, radius, 0, Math.PI * 2);
      assetCtx.fill();
    }

    assetCtx.fillStyle = centerColor;
    assetCtx.fillRect(Math.round(point.x), Math.round(point.y), Math.max(1 / assetZoom, .25), Math.max(1 / assetZoom, .25));
    assetCtx.restore();
  }
  function updatePaintControls() {
    if ($("#paintSizeValue")) $("#paintSizeValue").textContent = `${$("#paintSize")?.value || 8}px`;
    if ($("#paintOpacityValue")) $("#paintOpacityValue").textContent = `${$("#paintOpacity")?.value || 100}%`;
    if ($("#paintUndo")) $("#paintUndo").disabled = !assetPaintUndoSrc;
  }

  function assetSourceCanvas(asset, image) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    return canvas;
  }

  function paintSettings() {
    return {
      tool: assetPaintTool,
      color: $("#paintColor")?.value || "#ffd15a",
      size: clamp(+("0" + ($("#paintSize")?.value || 8)), 1, 80),
      opacity: clamp(+("0" + ($("#paintOpacity")?.value || 100)), 1, 100) / 100
    };
  }

  function paintDot(ctx, point, settings) {
    ctx.save();
    ctx.globalAlpha = settings.opacity;
    ctx.fillStyle = settings.color;
    if (settings.tool === "erase") ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = settings.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (settings.tool === "pen") {
      const size = Math.max(1, Math.round(settings.size));
      ctx.globalAlpha = settings.opacity;
      ctx.fillRect(Math.round(point.x - size / 2), Math.round(point.y - size / 2), size, size);
    } else if (settings.tool === "spray") {
      const radius = settings.size / 2;
      const dots = Math.max(8, Math.round(settings.size * 2.5));
      for (let i = 0; i < dots; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.sqrt(Math.random()) * radius;
        ctx.globalAlpha = settings.opacity * (.25 + Math.random() * .45);
        ctx.beginPath();
        ctx.arc(point.x + Math.cos(angle) * distance, point.y + Math.sin(angle) * distance, Math.max(.6, settings.size / 18), 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.arc(point.x, point.y, settings.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function paintSegment(ctx, from, to, settings) {
    if (settings.tool === "spray") {
      const dx = to.x - from.x, dy = to.y - from.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const steps = Math.max(1, Math.ceil(distance / Math.max(2, settings.size / 3)));
      for (let i = 0; i <= steps; i++) paintDot(ctx, { x: from.x + dx * i / steps, y: from.y + dy * i / steps }, settings);
      return;
    }
    if (settings.tool === "pen") {
      const dx = to.x - from.x, dy = to.y - from.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const steps = Math.max(1, Math.ceil(distance / Math.max(1, settings.size / 2)));
      for (let i = 0; i <= steps; i++) paintDot(ctx, { x: from.x + dx * i / steps, y: from.y + dy * i / steps }, settings);
      return;
    }
    ctx.save();
    ctx.globalAlpha = settings.opacity;
    if (settings.tool === "erase") ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = settings.color;
    ctx.lineWidth = settings.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  function commitPaintCanvas(asset, canvas, message = "Paint saved into asset.") {
    const src = canvas.toDataURL("image/png");
    pushAssetUndo(asset, "paint edit");
    asset.src = src;
    assetPreviewCache = null;
    const replacement = new Image();
    replacement.onload = () => {
      images.set(asset.id, replacement);
      drawAssetPreview();
      renderAssets();
      updateSelectionDetails(message);
    };
    replacement.src = src;
    images.set(asset.id, replacement);
    markDirty();
  }
  function resetAssetWorkspace() {
    assetSelection = null;
    assetSelectionDrag = null;
    assetPreviewCache = null;
    assetStatusMessage = "";
    pickBackgroundActive = false;
    $("#pickBackground").classList.remove("pick-active");
  }
  function previewPoint(event) {
    const rect = assetPreview.getBoundingClientRect();
    return {
      x: clamp(Math.round((event.clientX - rect.left) * assetPreview.width / rect.width), 0, assetPreview.width - 1),
      y: clamp(Math.round((event.clientY - rect.top) * assetPreview.height / rect.height), 0, assetPreview.height - 1)
    };
  }
  function findVisiblePixelBounds(image) {
    if (!image?.naturalWidth) return null;
    const source = transparencyPreview ? makeTransparentAssetCanvas(image, false) : image;
    const canvas = document.createElement("canvas");
    canvas.width = source.width || source.naturalWidth;
    canvas.height = source.height || source.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (data[(y * canvas.width + x) * 4 + 3] > 5) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < minX || maxY < minY) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }
  function selectVisibleSpriteBounds() {
    const image = images.get(selectedAssetId);
    const bounds = findVisiblePixelBounds(image);
    if (!bounds) {
      alert("No visible pixels found. If the asset still has a solid background, enable background-removal preview first.");
      return;
    }
    setAssetSelection(bounds, `Selected visible image: ${bounds.w} x ${bounds.h}px at ${bounds.x}, ${bounds.y}.`);
  }
  function clampAssetSelection(selection, image = images.get(selectedAssetId)) {
    if (!selection || !image?.naturalWidth) return null;
    const x = clamp(Math.round(selection.x), 0, image.naturalWidth - 1);
    const y = clamp(Math.round(selection.y), 0, image.naturalHeight - 1);
    const w = clamp(Math.round(selection.w), 1, image.naturalWidth - x);
    const h = clamp(Math.round(selection.h), 1, image.naturalHeight - y);
    return { x, y, w, h };
  }
  function pushAssetUndo(asset, label = "asset edit") {
    if (!asset) return;
    assetUndoStack.push({ assetId: asset.id, src: asset.src, name: asset.name, backgroundRemoved: asset.backgroundRemoved ? JSON.parse(JSON.stringify(asset.backgroundRemoved)) : undefined, selection: assetSelection ? { ...assetSelection } : null, label });
    if (assetUndoStack.length > 30) assetUndoStack.shift();
    updateSelectionDetails();
  }
  function restoreLastAssetUndo() {
    const entry = assetUndoStack.pop();
    if (!entry) return;
    const asset = project.assets.find(a => a.id === entry.assetId);
    if (!asset) return;
    asset.src = entry.src;
    asset.name = entry.name;
    asset.backgroundRemoved = entry.backgroundRemoved;
    assetSelection = entry.selection;
    if (floatingPasteLayer?.assetId === asset.id) floatingPasteLayer = null;
    const replacement = new Image();
    replacement.onload = refreshAssetViews;
    replacement.src = asset.src;
    images.set(asset.id, replacement);
    assetPreviewCache = null;
    renderAssets(); renderRig(); renderCharacterAnimator();
    updateSelectionDetails(`Undid ${entry.label}.`);
    markDirty();
  }
  function layerDrawWidth(layer) { return Math.max(1, Math.round((layer?.sourceW || layer?.w || 1) * (layer?.scale || 1))); }
  function layerDrawHeight(layer) { return Math.max(1, Math.round((layer?.sourceH || layer?.h || 1) * (layer?.scale || 1))); }
  function drawFloatingPasteLayer(ctx, layer) {
    if (!layer?.image) return;
    const drawW = layerDrawWidth(layer);
    const drawH = layerDrawHeight(layer);
    ctx.save();
    ctx.translate(layer.x + (layer.flipX ? drawW : 0), layer.y + (layer.flipY ? drawH : 0));
    ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(layer.image, 0, 0, drawW, drawH);
    ctx.restore();
  }
  function pointInFloatingPaste(point) {
    return floatingPasteLayer?.assetId === selectedAssetId && point.x >= floatingPasteLayer.x && point.y >= floatingPasteLayer.y && point.x <= floatingPasteLayer.x + layerDrawWidth(floatingPasteLayer) && point.y <= floatingPasteLayer.y + layerDrawHeight(floatingPasteLayer);
  }
  function startMovingFloatingLayer(point, centered = false) {
    if (!(floatingPasteLayer?.assetId === selectedAssetId)) return false;
    floatingPasteLayer.dragging = true;
    floatingPasteLayer.dragOffsetX = centered ? Math.round(layerDrawWidth(floatingPasteLayer) / 2) : point.x - floatingPasteLayer.x;
    floatingPasteLayer.dragOffsetY = centered ? Math.round(layerDrawHeight(floatingPasteLayer) / 2) : point.y - floatingPasteLayer.y;
    assetSelection = { x: floatingPasteLayer.x, y: floatingPasteLayer.y, w: layerDrawWidth(floatingPasteLayer), h: layerDrawHeight(floatingPasteLayer) };
    drawAssetPreview();
    updateSelectionDetails(`Moving floating layer: ${layerDrawWidth(floatingPasteLayer)} x ${layerDrawHeight(floatingPasteLayer)}px. Drag to place it, then use Merge layer or Cancel layer.`);
    return true;
  }
  function setMoveLayerMode(active) {
    assetMoveLayerMode = !!active && floatingPasteLayer?.assetId === selectedAssetId;
    if (assetMoveLayerMode) setAssetPaintTool("select");
    if (assetPreview) assetPreview.classList.toggle("moving-layer", assetMoveLayerMode);
    updateSelectionDetails(assetMoveLayerMode ? "Move layer mode: drag in the preview to move the floating pasted layer." : "Move layer mode off. Normal selection is active.");
  }
  function setAssetSelection(selection, message = "") {
    assetSelection = clampAssetSelection(selection);
    assetSelectionDrag = null;
    assetStatusMessage = "";
    drawAssetPreview();
    updateSelectionDetails(message);
  }
  assetPreview.addEventListener("pointerdown", event => {
    const point = previewPoint(event);
    assetPaintHover = point;
    const image = images.get(selectedAssetId);
    if (!image?.naturalWidth) return;
    if (paintColorPickActive) {
      samplePaintColor(point);
      return;
    }
    if (pickBackgroundActive) {
      const sample = document.createElement("canvas");
      sample.width = 1; sample.height = 1;
      const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
      sampleCtx.drawImage(image, point.x, point.y, 1, 1, 0, 0, 1, 1);
      const pixel = sampleCtx.getImageData(0, 0, 1, 1).data;
      backgroundRgb = { r: pixel[0], g: pixel[1], b: pixel[2] };
      $("#backgroundColor").value = rgbToHex(backgroundRgb);
      pickBackgroundActive = false;
      $("#pickBackground").classList.remove("pick-active");
      assetPreviewCache = null;
      drawAssetPreview();
      return;
    }
    assetPreview.setPointerCapture(event.pointerId);
    assetStatusMessage = "";
    if (assetPaintTool !== "select") {
      const asset = project.assets.find(a => a.id === selectedAssetId);
      if (!asset) return;
      assetPaintUndoSrc = asset.src;
      updatePaintControls();
      const canvas = assetSourceCanvas(asset, image);
      const ctx = canvas.getContext("2d");
      const settings = paintSettings();
      paintDot(ctx, point, settings);
      assetPaintStroke = { canvas, ctx, last: point, settings, assetId: asset.id };
      assetCtx.imageSmoothingEnabled = false;
      assetCtx.clearRect(0, 0, assetPreview.width, assetPreview.height);
      assetCtx.drawImage(canvas, 0, 0);
      drawPaintCursorPreview(point);
      updateSelectionDetails("Painting... release to save into this asset.");
      return;
    }
    if (assetMoveLayerMode && floatingPasteLayer?.assetId === selectedAssetId) {
      startMovingFloatingLayer(point, true);
      return;
    }
    if (pointInFloatingPaste(point)) {
      startMovingFloatingLayer(point, false);
      return;
    }
    assetSelectionDrag = point;
    assetSelection = clampAssetSelection({ x: point.x, y: point.y, w: 1, h: 1 }, image);
    drawAssetPreview();
    updateSelectionDetails();
  });
  assetPreview.addEventListener("pointermove", event => {
    const point = previewPoint(event);
    assetPaintHover = point;
    if (assetPaintStroke) {
      paintSegment(assetPaintStroke.ctx, assetPaintStroke.last, point, assetPaintStroke.settings);
      assetPaintStroke.last = point;
      assetCtx.imageSmoothingEnabled = false;
      assetCtx.clearRect(0, 0, assetPreview.width, assetPreview.height);
      assetCtx.drawImage(assetPaintStroke.canvas, 0, 0);
      drawPaintCursorPreview(point);
      return;
    }
    if (floatingPasteLayer?.dragging) {
      const image = images.get(selectedAssetId);
      const maxX = Math.max(0, (image?.naturalWidth || 0) - layerDrawWidth(floatingPasteLayer));
      const maxY = Math.max(0, (image?.naturalHeight || 0) - layerDrawHeight(floatingPasteLayer));
      floatingPasteLayer.x = clamp(Math.round(point.x - floatingPasteLayer.dragOffsetX), 0, maxX);
      floatingPasteLayer.y = clamp(Math.round(point.y - floatingPasteLayer.dragOffsetY), 0, maxY);
      assetSelection = { x: floatingPasteLayer.x, y: floatingPasteLayer.y, w: layerDrawWidth(floatingPasteLayer), h: layerDrawHeight(floatingPasteLayer) };
      drawAssetPreview();
      updateSelectionDetails(`Floating layer: ${layerDrawWidth(floatingPasteLayer)} x ${layerDrawHeight(floatingPasteLayer)}px at ${floatingPasteLayer.x}, ${floatingPasteLayer.y}.`);
      return;
    }
    if (!assetSelectionDrag) {
      if (assetPaintTool !== "select") drawAssetPreview();
      return;
    }
    assetSelection = clampAssetSelection({
      x: Math.min(assetSelectionDrag.x, point.x),
      y: Math.min(assetSelectionDrag.y, point.y),
      w: Math.max(1, Math.abs(point.x - assetSelectionDrag.x)),
      h: Math.max(1, Math.abs(point.y - assetSelectionDrag.y))
    });
    drawAssetPreview();
    updateSelectionDetails();
  });
  assetPreview.addEventListener("pointerup", () => {
    if (floatingPasteLayer?.dragging) floatingPasteLayer.dragging = false;
    if (assetPaintStroke) {
      const asset = project.assets.find(a => a.id === assetPaintStroke.assetId);
      const canvas = assetPaintStroke.canvas;
      assetPaintStroke = null;
      if (asset) commitPaintCanvas(asset, canvas);
      return;
    }
    assetSelectionDrag = null;
    if (assetSelection && (assetSelection.w < 2 || assetSelection.h < 2)) assetSelection = null;
    drawAssetPreview();
    updateSelectionDetails();
  });
  assetPreview.addEventListener("pointerleave", () => {
    if (assetPaintStroke) return;
    assetPaintHover = null;
    drawAssetPreview();
  });
  if ($("#paintSelectTool")) $("#paintSelectTool").onclick = () => setAssetPaintTool("select");
  if ($("#paintPenTool")) $("#paintPenTool").onclick = () => setAssetPaintTool("pen");
  if ($("#paintBrushTool")) $("#paintBrushTool").onclick = () => setAssetPaintTool("brush");
  if ($("#paintSprayTool")) $("#paintSprayTool").onclick = () => setAssetPaintTool("spray");
  if ($("#paintEraseTool")) $("#paintEraseTool").onclick = () => setAssetPaintTool("erase");
  if ($("#paintSize")) $("#paintSize").oninput = () => { updatePaintControls(); drawAssetPreview(); };
  if ($("#paintOpacity")) $("#paintOpacity").oninput = () => { updatePaintControls(); drawAssetPreview(); };
  if ($("#pickPaintColor")) $("#pickPaintColor").onclick = async () => {
    paintColorPickActive = false;
    if (assetPreview) assetPreview.classList.remove("picking-color");
    if ($("#pickPaintColor")) $("#pickPaintColor").classList.remove("active");
    if (window.EyeDropper) {
      try {
        const result = await new EyeDropper().open();
        if (result?.sRGBHex && $("#paintColor")) {
          $("#paintColor").value = result.sRGBHex;
          drawAssetPreview();
        }
        return;
      } catch {
        return;
      }
    }
    $("#paintColor")?.click();
  };
  if ($("#paintColor")) {
    $("#paintColor").oninput = event => { drawAssetPreview(); event.target.blur(); };
    $("#paintColor").onchange = event => { drawAssetPreview(); event.target.blur(); };
  }
  if ($("#paintUndo")) $("#paintUndo").onclick = () => {
    const asset = project.assets.find(a => a.id === selectedAssetId);
    if (!asset || !assetPaintUndoSrc) return;
    asset.src = assetPaintUndoSrc;
    const replacement = new Image();
    replacement.onload = () => {
      images.set(asset.id, replacement);
      assetPreviewCache = null;
      drawAssetPreview();
      renderAssets();
      updateSelectionDetails("Last paint stroke undone.");
    };
    replacement.src = assetPaintUndoSrc;
    images.set(asset.id, replacement);
    assetPaintUndoSrc = null;
    updatePaintControls();
    markDirty();
  };
  setAssetPaintTool("select");
  updatePaintControls();
  $("#pickBackground").onclick = () => {
    pickBackgroundActive = !pickBackgroundActive;
    $("#pickBackground").classList.toggle("pick-active", pickBackgroundActive);
  };
  $("#transparentBackground").onchange = event => {
    transparencyPreview = event.target.checked;
    assetPreviewCache = null;
    renderTransparencyNotice(project.assets.find(asset => asset.id === selectedAssetId));
    drawAssetPreview();
  };
  if ($("#backgroundRemoveMode")) $("#backgroundRemoveMode").onchange = event => {
    backgroundRemoveMode = event.target.value === "outside" ? "outside" : "global";
    assetPreviewCache = null;
    renderTransparencyNotice(project.assets.find(asset => asset.id === selectedAssetId));
    drawAssetPreview();
  };
  $("#backgroundColor").oninput = event => {
    backgroundRgb = hexToRgb(event.target.value);
    assetPreviewCache = null;
    renderTransparencyNotice(project.assets.find(asset => asset.id === selectedAssetId));
    drawAssetPreview();
  };
  $("#colorTolerance").oninput = event => {
    colorTolerance = +event.target.value;
    $("#toleranceValue").textContent = colorTolerance;
    assetPreviewCache = null;
    renderTransparencyNotice(project.assets.find(asset => asset.id === selectedAssetId));
    drawAssetPreview();
  };
  $("#assetZoom").oninput = event => {
    assetZoom = +event.target.value / 100;
    $("#assetZoomValue").textContent = `${event.target.value}%`;
    drawAssetPreview();
  };
  $("#fitAsset").onclick = () => {
    const image = images.get(selectedAssetId);
    const scroller = $(".asset-preview-scroll");
    if (!image?.naturalWidth) return;
    assetZoom = clamp(Math.min((scroller.clientWidth - 50) / image.naturalWidth, (scroller.clientHeight - 50) / image.naturalHeight), .1, 16);
    renderAssetEditor();
  };
  $("#clearAssetSelection").onclick = () => {
    assetSelection = null;
    assetStatusMessage = "";
    drawAssetPreview();
    updateSelectionDetails();
  };
  ["selectionX", "selectionY", "selectionW", "selectionH"].forEach(id => {
    $(`#${id}`).addEventListener("change", () => {
      if (!assetSelection) return;
      setAssetSelection({
        x: +$("#selectionX").value,
        y: +$("#selectionY").value,
        w: +$("#selectionW").value,
        h: +$("#selectionH").value
      });
    });
  });
  if ($("#selectVisibleSprite")) $("#selectVisibleSprite").onclick = selectVisibleSpriteBounds;
  $("#extractAsset").onclick = extractSelectedAsset;
  if ($("#copySelectedSprite")) $("#copySelectedSprite").onclick = copySelectedSprite;
  if ($("#pasteCopiedSprite")) $("#pasteCopiedSprite").onclick = pasteCopiedSprite;
  if ($("#moveFloatingPaste")) $("#moveFloatingPaste").onclick = () => setMoveLayerMode(!assetMoveLayerMode);
  if ($("#mergeFloatingPaste")) $("#mergeFloatingPaste").onclick = mergeFloatingPasteLayer;
  if ($("#cancelFloatingPaste")) $("#cancelFloatingPaste").onclick = cancelFloatingPasteLayer;
  if ($("#undoAssetEdit")) $("#undoAssetEdit").onclick = restoreLastAssetUndo;
  function setFloatingLayerScalePercent(value) {
    if (!(floatingPasteLayer?.assetId === selectedAssetId)) return;
    const image = images.get(selectedAssetId);
    const percent = clamp(Math.round(Number(value) || 100), 10, 400);
    floatingPasteLayer.scale = percent / 100;
    floatingPasteLayer.w = layerDrawWidth(floatingPasteLayer);
    floatingPasteLayer.h = layerDrawHeight(floatingPasteLayer);
    floatingPasteLayer.x = clamp(floatingPasteLayer.x, 0, Math.max(0, (image?.naturalWidth || 0) - floatingPasteLayer.w));
    floatingPasteLayer.y = clamp(floatingPasteLayer.y, 0, Math.max(0, (image?.naturalHeight || 0) - floatingPasteLayer.h));
    assetSelection = { x: floatingPasteLayer.x, y: floatingPasteLayer.y, w: floatingPasteLayer.w, h: floatingPasteLayer.h };
    drawAssetPreview();
    updateSelectionDetails(`Floating layer scaled to ${percent}% (${floatingPasteLayer.w} x ${floatingPasteLayer.h}px).`);
  }
  if ($("#floatingLayerScale")) $("#floatingLayerScale").oninput = event => setFloatingLayerScalePercent(event.target.value);
  if ($("#floatingLayerScaleExact")) $("#floatingLayerScaleExact").onchange = event => setFloatingLayerScalePercent(event.target.value);
  if ($("#resetFloatingLayerScale")) $("#resetFloatingLayerScale").onclick = () => setFloatingLayerScalePercent(100);
  if ($("#pasteFlipX")) $("#pasteFlipX").onchange = event => { pasteCopiedFlipX = event.target.checked; };
  if ($("#pasteFlipY")) $("#pasteFlipY").onchange = event => { pasteCopiedFlipY = event.target.checked; };
  $("#downloadSelectedSprite").onclick = downloadSelectedSprite;
  function makeSelectedSpriteCanvas(image) {
    if (!image?.naturalWidth || !assetSelection) return null;
    const crop = document.createElement("canvas");
    crop.width = assetSelection.w;
    crop.height = assetSelection.h;
    const cropCtx = crop.getContext("2d", { willReadFrequently: true });
    cropCtx.drawImage(image, assetSelection.x, assetSelection.y, assetSelection.w, assetSelection.h, 0, 0, assetSelection.w, assetSelection.h);
    if (transparencyPreview) {
      const data = cropCtx.getImageData(0, 0, crop.width, crop.height);
      cropCtx.putImageData(applyTransparency(data), 0, 0);
    }
    return transparencyPreview && $("#trimTransparentAsset").checked ? trimTransparentCanvas(crop) : crop;
  }
  function extractSelectedAsset() {
    const sourceAsset = project.assets.find(a => a.id === selectedAssetId);
    const image = images.get(selectedAssetId);
    if (!sourceAsset || !image?.naturalWidth || !assetSelection) return;
    const trimmed = makeSelectedSpriteCanvas(image);
    if (!trimmed) return;
    const number = project.assets.filter(a => a.sourceAssetId === sourceAsset.id).length + 1;
    const baseName = sourceAsset.name.replace(/\.[^.]+$/, "");
    const newAsset = {
      id: uid(),
      name: `${baseName} sprite ${number}.png`,
      src: trimmed.toDataURL("image/png"),
      sourceAssetId: sourceAsset.id,
      category: normalizeAssetCategory(sourceAsset),
      ...(transparencyPreview ? { backgroundRemoved: transparencyMetadata() } : {})
    };
    project.assets.push(newAsset);
    const extractedImage = new Image();
    extractedImage.onload = refreshAssetViews;
    extractedImage.src = newAsset.src;
    images.set(newAsset.id, extractedImage);
    assetSelection = null;
    renderAssets();
    updateSelectionDetails(`Created "${newAsset.name}" (${trimmed.width} x ${trimmed.height}px). Select it from the library to place it.`);
    markDirty();
  }
  function copySelectedSprite() {
    const sourceAsset = project.assets.find(a => a.id === selectedAssetId);
    const image = images.get(selectedAssetId);
    if (!sourceAsset || !image?.naturalWidth || !assetSelection) return;
    const canvas = makeSelectedSpriteCanvas(image);
    if (!canvas) return;
    copiedAssetSprite = {
      src: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
      sourceAssetId: sourceAsset.id,
      sourceName: sourceAsset.name,
      copiedAt: Date.now()
    };
    updateSelectionDetails(`Copied ${canvas.width} x ${canvas.height}px from "${sourceAsset.name}". Select another asset, pick a paste position, then press Paste copied selection.`);
    updatePaintControls();
  }

  function pasteCopiedSprite() {
    const asset = project.assets.find(a => a.id === selectedAssetId);
    const image = images.get(selectedAssetId);
    if (!asset || !image?.naturalWidth || !copiedAssetSprite) return;
    const pasteImage = new Image();
    pasteImage.onload = () => {
      const x = assetSelection ? assetSelection.x : Math.round((image.naturalWidth - pasteImage.naturalWidth) / 2);
      const y = assetSelection ? assetSelection.y : Math.round((image.naturalHeight - pasteImage.naturalHeight) / 2);
      floatingPasteLayer = { assetId: asset.id, src: copiedAssetSprite.src, image: pasteImage, x: clamp(x, 0, Math.max(0, image.naturalWidth - pasteImage.naturalWidth)), y: clamp(y, 0, Math.max(0, image.naturalHeight - pasteImage.naturalHeight)), sourceW: pasteImage.naturalWidth, sourceH: pasteImage.naturalHeight, w: pasteImage.naturalWidth, h: pasteImage.naturalHeight, scale: 1, sourceAssetId: copiedAssetSprite.sourceAssetId, sourceName: copiedAssetSprite.sourceName, flipX: pasteCopiedFlipX, flipY: pasteCopiedFlipY, dragging: false };
      assetMoveLayerMode = true;
      assetSelection = { x: floatingPasteLayer.x, y: floatingPasteLayer.y, w: layerDrawWidth(floatingPasteLayer), h: layerDrawHeight(floatingPasteLayer) };
      drawAssetPreview();
      updateSelectionDetails(`Floating layer placed: ${layerDrawWidth(floatingPasteLayer)} x ${layerDrawHeight(floatingPasteLayer)}px at ${floatingPasteLayer.x}, ${floatingPasteLayer.y}. Drag it, then use Merge layer or Cancel layer.`);
    };
    pasteImage.src = copiedAssetSprite.src;
  }
  function cancelFloatingPasteLayer() {
    if (!(floatingPasteLayer?.assetId === selectedAssetId)) return;
    const size = `${layerDrawWidth(floatingPasteLayer)} x ${layerDrawHeight(floatingPasteLayer)}px`;
    floatingPasteLayer = null;
    assetMoveLayerMode = false;
    assetSelection = null;
    drawAssetPreview();
    updateSelectionDetails(`Cancelled floating layer (${size}). Asset was not changed.`);
  }
  function mergeFloatingPasteLayer() {
    const asset = project.assets.find(a => a.id === selectedAssetId);
    const image = images.get(selectedAssetId);
    const layer = floatingPasteLayer;
    if (!asset || !image?.naturalWidth || !(layer?.assetId === asset.id)) return;
    pushAssetUndo(asset, "layer merge");
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);
    drawFloatingPasteLayer(ctx, layer);
    const src = canvas.toDataURL("image/png");
    asset.src = src;
    asset.name = `${asset.name.replace(/\.[^.]+$/, "")}.png`;
    asset.backgroundRemoved = { ...(asset.backgroundRemoved || {}), pastedSprite: { sourceAssetId: layer.sourceAssetId, sourceName: layer.sourceName, x: layer.x, y: layer.y, width: layerDrawWidth(layer), height: layerDrawHeight(layer), scale: layer.scale || 1, flipX: layer.flipX, flipY: layer.flipY, appliedAt: Date.now() } };
    floatingPasteLayer = null;
    assetMoveLayerMode = false;
    assetSelection = { x: layer.x, y: layer.y, w: layerDrawWidth(layer), h: layerDrawHeight(layer) };
    const replacement = new Image();
    replacement.onload = refreshAssetViews;
    replacement.src = src;
    images.set(asset.id, replacement);
    assetPreviewCache = null;
    renderAssets();
    updateSelectionDetails(`Merged floating layer into "${asset.name}". Undo is available.`);
    renderRig(); renderCharacterAnimator(); markDirty();
  }
  function expandAssetTransparentCanvas() {
    const asset = project.assets.find(a => a.id === selectedAssetId);
    const image = images.get(selectedAssetId);
    if (!asset || !image?.naturalWidth) return;
    const left = Math.max(0, Math.round(Number($("#canvasPadLeft")?.value) || 0));
    const right = Math.max(0, Math.round(Number($("#canvasPadRight")?.value) || 0));
    const top = Math.max(0, Math.round(Number($("#canvasPadTop")?.value) || 0));
    const bottom = Math.max(0, Math.round(Number($("#canvasPadBottom")?.value) || 0));
    if (!left && !right && !top && !bottom) {
      alert("Type padding pixels first, for example Bottom = 40.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth + left + right;
    canvas.height = image.naturalHeight + top + bottom;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, left, top);
    const src = canvas.toDataURL("image/png");
    pushAssetUndo(asset, "canvas expansion");
    asset.src = src;
    asset.name = `${asset.name.replace(/\.[^.]+$/, "")}.png`;
    asset.backgroundRemoved = { ...(asset.backgroundRemoved || {}), canvasPadding: { left, right, top, bottom }, appliedAt: Date.now() };
    if (assetSelection) assetSelection = { ...assetSelection, x: assetSelection.x + left, y: assetSelection.y + top };
    const replacement = new Image();
    replacement.onload = refreshAssetViews;
    replacement.src = src;
    images.set(asset.id, replacement);
    assetPreviewCache = null;
    renderAssets();
    updateSelectionDetails(`Expanded canvas to ${canvas.width} x ${canvas.height}px. Artwork was not scaled.`);
    renderRig();
    renderCharacterAnimator();
    markDirty();
  }
  function downloadSelectedSprite() {
    const sourceAsset = project.assets.find(a => a.id === selectedAssetId);
    const image = images.get(selectedAssetId);
    if (!sourceAsset || !image?.naturalWidth || !assetSelection) return;
    const canvas = makeSelectedSpriteCanvas(image);
    if (!canvas) return;
    const baseName = sourceAsset.name.replace(/\.[^.]+$/, "") || "scrapyard-sprite";
    const filename = `${baseName}-selection-${assetSelection.x}-${assetSelection.y}-${assetSelection.w}x${assetSelection.h}.png`;
    canvas.toBlob(blob => {
      if (blob) {
        downloadBlob(blob, filename);
        updateSelectionDetails(`Downloaded ${filename} (${canvas.width} x ${canvas.height}px).`);
      }
    }, "image/png");
  }
  $("#keepSelectionPixels").onclick = () => applySelectionPixelDelete("outside");
  $("#eraseSelectionPixels").onclick = () => applySelectionPixelDelete("inside");
  function applySelectionPixelDelete(mode) {
    const asset = project.assets.find(a => a.id === selectedAssetId);
    const image = images.get(selectedAssetId);
    const selection = clampAssetSelection(assetSelection, image);
    if (!asset || !image?.naturalWidth || !selection) return;
    const action = mode === "outside" ? "erase every pixel outside the selected rectangle" : "erase the pixels inside the selected rectangle";
    if (!confirm(`This will ${action} in "${asset.name}" and save real transparency into the project asset.\n\nYour original file on disk will not be changed. Continue?`)) return;
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    if (mode === "outside") {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillRect(0, 0, canvas.width, selection.y);
      ctx.fillRect(0, selection.y + selection.h, canvas.width, canvas.height - selection.y - selection.h);
      ctx.fillRect(0, selection.y, selection.x, selection.h);
      ctx.fillRect(selection.x + selection.w, selection.y, canvas.width - selection.x - selection.w, selection.h);
      ctx.restore();
    } else {
      ctx.clearRect(selection.x, selection.y, selection.w, selection.h);
    }
    const src = canvas.toDataURL("image/png");
    asset.src = src;
    asset.name = `${asset.name.replace(/\.[^.]+$/, "")}.png`;
    asset.backgroundRemoved = { ...(asset.backgroundRemoved || {}), pixelEdited: mode, selection: { ...selection }, appliedAt: Date.now() };
    const replacement = new Image();
    replacement.onload = refreshAssetViews;
    replacement.src = src;
    images.set(asset.id, replacement);
    assetPreviewCache = null;
    assetSelection = selection;
    renderAssets();
    updateSelectionDetails(mode === "outside"
      ? `Kept only the selected ${selection.w} x ${selection.h}px area.`
      : `Erased the selected ${selection.w} x ${selection.h}px area.`);
    renderRig();
    renderCharacterAnimator();
    markDirty();
  }
  function trimTransparentCanvas(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (data[(y * canvas.width + x) * 4 + 3] > 5) {
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < minX || maxY < minY) return canvas;
    const pad = 2;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(canvas.width - 1, maxX + pad); maxY = Math.min(canvas.height - 1, maxY + pad);
    const trimmed = document.createElement("canvas");
    trimmed.width = maxX - minX + 1;
    trimmed.height = maxY - minY + 1;
    trimmed.getContext("2d").drawImage(canvas, minX, minY, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
    return trimmed;
  }
  $("#assetSearch").addEventListener("input", event => {
    assetQuery = event.target.value;
    renderAssets();
  });
  $("#assetName").addEventListener("change", event => {
    const asset = project.assets.find(a => a.id === selectedAssetId);
    if (!asset) return;
    asset.name = event.target.value.trim() || asset.name;
    renderAssets(); renderOutliner(); markDirty();
  });
  $("#replaceAsset").onclick = () => $("#replaceAssetFile").click();
  $("#createTransparentCopy").onclick = () => saveTransparentAsset(false);
  $("#applyTransparencyAsset").onclick = () => saveTransparentAsset(true);
  if ($("#expandAssetCanvas")) $("#expandAssetCanvas").onclick = expandAssetTransparentCanvas;
  $("#downloadTransparentAsset").onclick = () => {
    const image = images.get(selectedAssetId);
    const asset = project.assets.find(item => item.id === selectedAssetId);
    if (!image?.naturalWidth || !asset) return;
    const canvas = makeTransparentAssetCanvas(image, $("#trimTransparentAsset").checked);
    canvas.toBlob(blob => {
      if (blob) downloadBlob(blob, `${asset.name.replace(/\.[^.]+$/, "")}-transparent.png`);
    }, "image/png");
  };
  function saveTransparentAsset(replaceCurrent) {
    const sourceAsset = project.assets.find(item => item.id === selectedAssetId);
    const image = images.get(selectedAssetId);
    if (!sourceAsset || !image?.naturalWidth) return;
    if (replaceCurrent && !confirm(`Apply the current background removal permanently to "${sourceAsset.name}" inside this project? Your original file on disk will not be changed.`)) return;
    const canvas = makeTransparentAssetCanvas(image, $("#trimTransparentAsset").checked);
    const src = canvas.toDataURL("image/png");
    const metadata = transparencyMetadata();
    if (replaceCurrent) {
      sourceAsset.src = src;
      sourceAsset.name = `${sourceAsset.name.replace(/\.[^.]+$/, "")}.png`;
      sourceAsset.backgroundRemoved = metadata;
      const replacement = new Image();
      replacement.onload = refreshAssetViews;
      replacement.src = src;
      images.set(sourceAsset.id, replacement);
      resetAssetWorkspace();
      transparencyPreview = false;
      assetPreviewCache = null;
      renderAssets();
      markDirty();
      return;
    }
    const baseName = sourceAsset.name.replace(/\.[^.]+$/, "");
    let name = `${baseName}-transparent.png`;
    let suffix = 2;
    while (project.assets.some(asset => asset.name === name)) name = `${baseName}-transparent-${suffix++}.png`;
    const copy = { id: uid(), name, src, sourceAssetId: sourceAsset.id,
      category: normalizeAssetCategory(sourceAsset), backgroundRemoved: metadata };
    project.assets.push(copy);
    const copyImage = new Image();
    copyImage.onload = refreshAssetViews;
    copyImage.src = src;
    images.set(copy.id, copyImage);
    selectedAssetId = copy.id;
    resetAssetWorkspace();
    transparencyPreview = false;
    assetPreviewCache = null;
    renderAssets();
    markDirty();
  }
  $("#downloadAsset").onclick = async () => {
    const asset = project.assets.find(item => item.id === selectedAssetId);
    if (!asset) return;
    const blob = await (await fetch(asset.src)).blob();
    downloadBlob(blob, asset.name || "scrapyard-asset.png");
  };
  $("#replaceAssetFile").addEventListener("change", async event => {
    const file = event.target.files[0];
    const asset = project.assets.find(a => a.id === selectedAssetId);
    if (!file || !asset) return;
    asset.src = await fileToDataUrl(file);
    delete asset.backgroundRemoved;
    const image = new Image();
    image.onload = refreshAssetViews;
    image.src = asset.src;
    images.set(asset.id, image);
    resetAssetWorkspace();
    event.target.value = "";
    renderAssets(); markDirty();
  });
  $("#placeAsset").onclick = () => {
    if (!selectedAssetId) return alert("Select an asset first.");
    placingSelectedAsset = true;
    setTool("select");
    assetStatusMessage = "Placement armed. Keep this studio open, then click once in the scene behind it.";
    renderAssetEditor();
  };
  $("#deleteAsset").onclick = () => {
    if (selectedAssetId) deleteAssetById(selectedAssetId);
  };
  function deleteAssetById(assetId) {
    const asset = project.assets.find(item => item.id === assetId);
    if (!asset) return;
    const placedCount = project.objects.filter(object => object.assetId === asset.id).length;
    const sceneArtCount = Object.values(normalizeSceneArt(project.sceneArt)).filter(art => art.assetId === asset.id).length;
    const rigCount = bodyParts.filter(part => project.rig[part] === asset.id).length;
    let animationCount = 0;
    Object.values(project.character?.animations || {}).forEach(frames => {
      frames.forEach(frame => {
        bodyParts.forEach(part => {
          if (frame.parts?.[part]?.assetId === asset.id) animationCount++;
        });
      });
    });
    const usage = [];
    if (placedCount) usage.push(`${placedCount} placed scene item${placedCount === 1 ? "" : "s"}`);
    if (sceneArtCount) usage.push(`${sceneArtCount} scene art slot${sceneArtCount === 1 ? "" : "s"}`);
    if (rigCount) usage.push(`${rigCount} character rig part${rigCount === 1 ? "" : "s"}`);
    if (animationCount) usage.push(`${animationCount} animation frame part${animationCount === 1 ? "" : "s"}`);
    const warning = usage.length
      ? `\n\nIt is used by ${usage.join(", ")}. Placed scene items using this image will be removed; other references will be cleared.`
      : "";
    if (!confirm(`Permanently delete "${asset.name}" from this project?${warning}\n\nThis cannot be undone after you save the project.`)) return;
    project.assets = project.assets.filter(item => item.id !== asset.id);
    const removedObjectIds = new Set(project.objects.filter(object => object.assetId === asset.id).map(object => object.id));
    project.objects = project.objects.filter(object => object.assetId !== asset.id);
    if (removedObjectIds.has(selectionId)) selectionId = null;
    project.sceneArt = normalizeSceneArt(project.sceneArt);
    Object.values(project.sceneArt).forEach(art => { if (art.assetId === asset.id) art.assetId = null; });
    bodyParts.forEach(part => { if (project.rig[part] === asset.id) project.rig[part] = null; });
    Object.values(project.character?.animations || {}).forEach(frames => {
      frames.forEach(frame => {
        bodyParts.forEach(part => {
          if (frame.parts?.[part]?.assetId === asset.id) frame.parts[part].assetId = null;
        });
      });
    });
    images.delete(asset.id);
    if (selectedAssetId === asset.id) {
      selectedAssetId = project.assets[0]?.id || null;
      resetAssetWorkspace();
    }
    renderAssets(); renderSceneArtControls(); renderRig(); renderCharacterAnimator(); renderOutliner(); markDirty();
  }
  $("#assignRig").onclick = () => {
    if (!selectedAssetId) return alert("Choose an image in the Assets tab first.");
    project.rig[$("#rigPart").value] = selectedAssetId; const rigAsset = project.assets.find(asset => asset.id === selectedAssetId); if (rigAsset) rigAsset.category = "character"; renderRig(); renderAssets(); markDirty();
  };
  $("#clearRig").onclick = () => {
    project.rig[$("#rigPart").value] = null; renderRig(); markDirty();
  };

  function characterAnimationNames() {
    const custom = Object.keys(project.character?.animations || {}).filter(state => !animationStates.includes(state));
    return [...animationStates, ...custom];
  }

  function ensureCharacterAnimation(state) {
    if (!project.character.animations[state]) project.character.animations[state] = [baseCharacterFrame(project.rig || {})];
    if (!project.character.facing) project.character.facing = {};
    if (!project.character.animationFps) project.character.animationFps = {};
    if (!project.character.loopMode) project.character.loopMode = {};
    project.character.facing[state] = "right";
    project.character.animationFps[state] = clamp(Number(project.character.animationFps[state]) || project.character.fps || 8, 1, 20);
    project.character.loopMode[state] = project.character.loopMode[state] === "pingpong" ? "pingpong" : "normal";
  }

  function currentCharacterAnimation() {
    if (!project.character.animations[characterState]) characterState = characterAnimationNames()[0] || "standing";
    ensureCharacterAnimation(characterState);
    return project.character.animations[characterState];
  }

  function animationLoopMode(state = characterState) {
    return project.character?.loopMode?.[state] === "pingpong" ? "pingpong" : "normal";
  }
  function animationFps(state = characterState) {
    const value = project.character?.animationFps?.[state] ?? project.character?.fps ?? 8;
    return clamp(Number(value) || 8, 1, 20);
  }


  function playbackFrameIndexes(state = characterState) {
    const frames = project.character?.animations?.[state] || [];
    const indexes = frames.map((_, index) => index);
    if (animationLoopMode(state) !== "pingpong" || frames.length <= 2) return indexes;
    for (let index = frames.length - 2; index > 0; index--) indexes.push(index);
    return indexes;
  }

  function playbackFrames(state = characterState) {
    const frames = project.character?.animations?.[state] || [];
    return playbackFrameIndexes(state).map(index => frames[index]).filter(Boolean);
  }

  function playbackFrameIndexAt(step, state = characterState) {
    const indexes = playbackFrameIndexes(state);
    return indexes.length ? indexes[step % indexes.length] : 0;
  }

  function currentCharacterFrame() {
    const frames = currentCharacterAnimation();
    characterFrameIndex = clamp(characterFrameIndex, 0, frames.length - 1);
    return frames[characterFrameIndex];
  }

  function currentCharacterTransform() {
    if (!selectedCharacterPart) return null;
    return currentCharacterFrame().parts[selectedCharacterPart] || null;
  }

  function standingCharacterFrame() {
    return project.character?.animations?.standing?.[0] || null;
  }

  function mainCharacterAsset(part) {
    return standingCharacterFrame()?.parts?.[part]?.assetId || project.rig?.[part] || null;
  }

  function inheritMissingAssetsFromStanding(state = characterState, force = false) {
    const standing = standingCharacterFrame();
    const frames = project.character?.animations?.[state] || [];
    if (!standing || state === "standing") return false;
    let changed = false;
    frames.forEach(frame => {
      bodyParts.forEach(part => {
        const mainAssetId = standing.parts?.[part]?.assetId || project.rig?.[part] || null;
        if (!mainAssetId) return;
        if (force || !frame.parts[part].assetId || isLikelySourceSheetAsset(frame.parts[part].assetId)) {
          frame.parts[part].assetId = mainAssetId;
          changed = true;
        }
      });
    });
    return changed;
  }

  function inheritAllMissingAnimationAssetsFromStanding() {
    let changed = false;
    animationStates.forEach(state => {
      if (inheritMissingAssetsFromStanding(state)) changed = true;
    });
    return changed;
  }

  function propagateMainAssetToAnimations(part, assetId) {
    animationStates.forEach(state => {
      (project.character?.animations?.[state] || []).forEach(frame => {
        if (!frame.parts?.[part]) return;
        if (state === "standing" || assetId || !frame.parts[part].assetId || isLikelySourceSheetAsset(frame.parts[part].assetId)) {
          frame.parts[part].assetId = assetId;
        }
      });
    });
  }

  function lockedCharacterPartsFor(part = selectedCharacterPart) {
    const locked = (project.character?.lockedParts || []).filter(item => bodyParts.includes(item));
    return locked.includes(part) ? locked : [part];
  }

  function moveLockedCharacterParts(part, dx, dy) {
    const frame = currentCharacterFrame();
    lockedCharacterPartsFor(part).forEach(item => {
      const transform = frame.parts[item];
      transform.x = clamp((transform.x || 0) + dx, -project.character.width, project.character.width * 2);
      transform.y = clamp((transform.y || 0) + dy, -project.character.height, project.character.height * 2);
    });
  }

  function propagatePartScaleFromStanding(part) {
    if (characterState !== "standing") return;
    const standing = standingCharacterFrame();
    const scale = standing?.parts?.[part]?.scale;
    if (!scale) return;
    animationStates.forEach(state => {
      (project.character?.animations?.[state] || []).forEach(frame => {
        if (frame.parts?.[part]) frame.parts[part].scale = scale;
      });
    });
  }

  function characterPointInsidePart(part, point) {
    const transform = currentCharacterFrame().parts[part];
    if (!transform) return false;
    const size = characterPartSize(part, transform);
    const angle = -((transform.rotation || 0) * Math.PI / 180);
    const dx = point.x - transform.x;
    const dy = point.y - transform.y;
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
    const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
    const anchor = characterPartAnchor(part, size);
    return localX >= anchor.x && localX <= anchor.x + size.width && localY >= anchor.y && localY <= anchor.y + size.height;
  }

  function characterDefaultPose(part, assetId = null) {
    const center = project.character.width / 2;
    const defaults = {
      backArm: { x: center - 30, y: 150, rotation: 4, scale: 1, flip: false, bendEnabled: false, bend: 0, bendZone: 25, toeBendEnabled: false, toeBend: 0, toeBendZone: 12, toeSlide: 0, toeMoveX: 0, toeMoveY: 0, shoeMoveX: 0, shoeMoveY: 0, showBendGuides: true, toeCutAxis: "same", bendAxis: "bottom" },
      backLeg: { x: center - 12, y: 218, rotation: 0, scale: 1, flip: false, bendEnabled: false, bend: 0, bendZone: 25, toeBendEnabled: false, toeBend: 0, toeBendZone: 12, toeSlide: 0, toeMoveX: 0, toeMoveY: 0, shoeMoveX: 0, shoeMoveY: 0, showBendGuides: true, toeCutAxis: "same", bendAxis: "bottom" },
      torso: { x: center, y: 172, rotation: 0, scale: 1, flip: false, bendEnabled: false, bend: 0, bendZone: 25, toeBendEnabled: false, toeBend: 0, toeBendZone: 12, toeSlide: 0, toeMoveX: 0, toeMoveY: 0, shoeMoveX: 0, shoeMoveY: 0, showBendGuides: true, toeCutAxis: "same", bendAxis: "bottom" },
      head: { x: center, y: 96, rotation: 0, scale: 1, flip: false, bendEnabled: false, bend: 0, bendZone: 25, toeBendEnabled: false, toeBend: 0, toeBendZone: 12, toeSlide: 0, toeMoveX: 0, toeMoveY: 0, shoeMoveX: 0, shoeMoveY: 0, showBendGuides: true, toeCutAxis: "same", bendAxis: "bottom" },
      frontLeg: { x: center + 12, y: 218, rotation: 0, scale: 1, flip: false, bendEnabled: false, bend: 0, bendZone: 25, toeBendEnabled: false, toeBend: 0, toeBendZone: 12, toeSlide: 0, toeMoveX: 0, toeMoveY: 0, shoeMoveX: 0, shoeMoveY: 0, showBendGuides: true, toeCutAxis: "same", bendAxis: "bottom" },
      frontArm: { x: center + 30, y: 150, rotation: -4, scale: 1, flip: false, bendEnabled: false, bend: 0, bendZone: 25, toeBendEnabled: false, toeBend: 0, toeBendZone: 12, toeSlide: 0, toeMoveX: 0, toeMoveY: 0, shoeMoveX: 0, shoeMoveY: 0, showBendGuides: true, toeCutAxis: "same", bendAxis: "bottom" }
    };
    return { assetId, ...(defaults[part] || { x: center, y: 160, rotation: 0, scale: 1, flip: false, bendEnabled: false, bend: 0, bendZone: 25, toeBendEnabled: false, toeBend: 0, toeBendZone: 12, toeSlide: 0, toeMoveX: 0, toeMoveY: 0, shoeMoveX: 0, shoeMoveY: 0, showBendGuides: true, toeCutAxis: "same", bendAxis: "bottom" }) };
  }

  function isLikelySourceSheetAsset(assetId) {
    const asset = project.assets.find(item => item.id === assetId);
    const image = images.get(assetId);
    if (!asset || !image?.naturalWidth) return false;
    return !asset.characterPart && !asset.sourceAssetId && (image.naturalWidth > 700 || image.naturalHeight > 700);
  }

  function resetFramePoseLayout(frame) {
    bodyParts.forEach(part => {
      const currentAssetId = frame.parts[part]?.assetId || null;
      const assetId = isLikelySourceSheetAsset(currentAssetId) ? null : currentAssetId;
      frame.parts[part] = characterDefaultPose(part, assetId);
    });
  }

  function cloneCharacterFrame(frame) {
    return JSON.parse(JSON.stringify(frame));
  }

  function animationFacing(state = characterState) {
    return "right";
  }

  function prettyAnimationState(state) {
    return state.charAt(0).toUpperCase() + state.slice(1);
  }

  function renderCharacterAnimator() {
    if (!project.character) return;
    characterAnimationNames().forEach(ensureCharacterAnimation);
    if (!project.character.animations[characterState]) characterState = characterAnimationNames()[0] || "standing";
    const animationSelect = $("#animationState");
    animationSelect.innerHTML = characterAnimationNames().map(state => `<option value="${state}">${prettyAnimationState(state)}</option>`).join("");
    animationSelect.value = characterState;
    $("#animationFacing").value = "right";
    $("#animationFacingHint").textContent = `${prettyAnimationState(characterState)} is authored facing right. The game mirrors the full character when moving left.`;
    $("#animationFps").value = animationFps(characterState);
    $("#animationFpsValue").textContent = `${animationFps(characterState)} fps`;
    $("#animationLoopMode").value = animationLoopMode(characterState);
    renderCopyAnimationSourceOptions();
    $("#showCharacterSourceSheets").checked = characterShowSourceSheets;
    $("#characterWidth").value = project.character.width;
    $("#characterHeight").value = project.character.height;
    inheritMissingAssetsFromStanding();
    renderCharacterParts();
    renderCharacterAssets();
    renderCharacterTimeline();
    renderCharacterTransforms();
    drawCharacterPreview();
  }

  function renderCopyAnimationSourceOptions() {
    const select = $("#copyAnimationSource");
    if (!select) return;
    select.innerHTML = characterAnimationNames()
      .filter(state => state !== characterState)
      .map(state => `<option value="${state}">${prettyAnimationState(state)}</option>`)
      .join("");
    if (!select.value && select.options.length) select.value = select.options[0].value;
  }
  function renderCharacterParts() {
    const frame = currentCharacterFrame();
    const icons = { backArm: "BA", backLeg: "BL", torso: "TO", head: "HD", frontLeg: "FL", frontArm: "FA" };
    $("#animatorPartList").innerHTML = characterPartOrder().map(part => {
      const asset = project.assets.find(item => item.id === frame.parts[part].assetId);
      const hidden = characterHiddenParts.has(part);
      return `<div class="animator-part ${part === selectedCharacterPart ? "selected" : ""} ${hidden ? "part-hidden" : ""}" data-character-part="${part}">
        <span>${icons[part]}</span><div><strong>${prettyPart[part]}</strong><small>${asset ? escapeHtml(asset.name) : "placeholder"}</small></div>
        <button class="part-visibility" data-toggle-character-part="${part}" title="${hidden ? "Show layer" : "Hide layer"}">${hidden ? "show" : "hide"}</button>
      </div>`;
    }).join("");
  }

  function renderCharacterAssets() {
    const filtered = project.assets.filter(asset => {
      const image = images.get(asset.id);
      const isLargeSheet = image?.naturalWidth ? image.naturalWidth > 700 || image.naturalHeight > 700 : !asset.sourceAssetId && !asset.characterPart;
      const isBodyPartAsset = !!asset.characterPart || !!asset.sourceAssetId || !isLargeSheet;
      return assetInCategory(asset, "character") && asset.name.toLowerCase().includes(characterAssetQuery.toLowerCase()) && (characterShowSourceSheets || isBodyPartAsset || asset.category === "character");
    });
    $("#characterAssetGrid").innerHTML = filtered.length ? filtered.map(asset => `
      <div class="character-asset-card ${asset.id === selectedAssetId ? "selected" : ""}" data-character-asset="${asset.id}">
        <img src="${asset.src}" alt=""><span>${escapeHtml(asset.name)}</span>
      </div>`).join("") : `<div class="object-list-empty">No matching assets.</div>`;
  }

  function renderCharacterTimeline() {
    const frames = currentCharacterAnimation();
    const playbackCount = playbackFrameIndexes().length;
    $("#characterTimeline").innerHTML = frames.map((_, index) => `
      <button class="character-frame ${index === characterFrameIndex ? "selected" : ""}" data-character-frame="${index}">Frame ${index + 1}</button>
    `).join("");
    $("#characterFrameLabel").textContent = `Frame ${characterFrameIndex + 1} / ${frames.length} - plays ${playbackCount} step${playbackCount === 1 ? "" : "s"}`;
    $("#playCharacterAnimation").textContent = characterPlaying ? "Stop" : "Preview";
  }

  function updatePartTransformClipboardStatus() {
    const status = $("#partTransformClipboardStatus");
    if (!status) return;
    status.textContent = characterTransformClipboard
      ? `Copied ${prettyPart[characterTransformClipboard.part] || "body layer"}: x ${Math.round(characterTransformClipboard.x)}, y ${Math.round(characterTransformClipboard.y)}, rot ${Math.round(characterTransformClipboard.rotation || 0)} deg, scale ${Math.round((characterTransformClipboard.scale || 1) * 100)}%`
      : "No copied body-layer transform yet.";
  }

  function renderCharacterTransforms() {
    const transform = currentCharacterTransform();
    if (!selectedCharacterPart || !transform) {
      $("#selectedCharacterPart").textContent = "No layer selected";
      ["partX", "partY", "partRotation", "partRotationNumber", "partScale", "partScaleNumber"].forEach(id => { if ($(`#${id}`)) $(`#${id}`).value = ""; });
      if ($("#partRotationValue")) $("#partRotationValue").textContent = "-";
      if ($("#partScaleValue")) $("#partScaleValue").textContent = "-";
      if ($("#partFlip")) $("#partFlip").checked = false;
      renderPartLayerOrder();
      renderPartLockList();
      return;
    }
    $("#selectedCharacterPart").textContent = prettyPart[selectedCharacterPart];
    $("#partX").value = Math.round(transform.x);
    $("#partY").value = Math.round(transform.y);
    $("#partRotation").value = transform.rotation || 0;
    $("#partRotationNumber").value = Math.round(transform.rotation || 0);
    $("#partRotationValue").textContent = `${Math.round(transform.rotation || 0)} deg`;
    $("#partScale").value = Math.round((transform.scale || 1) * 100);
    $("#partScaleNumber").value = Math.round((transform.scale || 1) * 100);
    $("#partScaleValue").textContent = `${Math.round((transform.scale || 1) * 100)}%`;
    $("#partFlip").checked = !!transform.flip;
    if ($("#partBendEnabled")) $("#partBendEnabled").checked = !!transform.bendEnabled;
    if ($("#partBendAxis")) $("#partBendAxis").value = ["bottom", "left", "right"].includes(transform.bendAxis) ? transform.bendAxis : "bottom";
    if ($("#partBend")) $("#partBend").value = Math.round(transform.bend || 0);
    if ($("#partBendValue")) $("#partBendValue").textContent = `${Math.round(transform.bend || 0)} deg`;
    if ($("#partBendZone")) $("#partBendZone").value = Math.round(transform.bendZone || 25);
    if ($("#partBendZoneValue")) $("#partBendZoneValue").textContent = `${Math.round(transform.bendZone || 25)}%`;
    if ($("#partToeBendEnabled")) $("#partToeBendEnabled").checked = !!transform.toeBendEnabled;
    if ($("#partToeCutAxis")) $("#partToeCutAxis").value = ["same", "bottom", "left", "right"].includes(transform.toeCutAxis) ? transform.toeCutAxis : "same";
    if ($("#partToeBend")) $("#partToeBend").value = Math.round(transform.toeBend || 0);
    if ($("#partToeBendValue")) $("#partToeBendValue").textContent = `${Math.round(transform.toeBend || 0)} deg`;
    if ($("#partToeBendZone")) {
      const toeCutAxis = ["same", "bottom", "left", "right"].includes(transform.toeCutAxis) ? transform.toeCutAxis : "same";
      const toeMax = toeCutAxis === "same" ? Math.min(40, Math.max(1, Math.round((Number(transform.bendZone) || 25) - 1))) : 100;
      $("#partToeBendZone").max = toeMax;
      $("#partToeBendZone").value = clamp(Math.round(transform.toeBendZone || 12), 1, toeMax);
    }
    if ($("#partToeBendZoneValue")) $("#partToeBendZoneValue").textContent = `${Math.round(transform.toeBendZone || 12)}%`;
    if ($("#partShoeMoveX")) $("#partShoeMoveX").value = Math.round(transform.shoeMoveX || 0);
    if ($("#partShoeMoveXValue")) $("#partShoeMoveXValue").textContent = `${Math.round(transform.shoeMoveX || 0)}px`;
    if ($("#partShoeMoveY")) $("#partShoeMoveY").value = Math.round(transform.shoeMoveY || 0);
    if ($("#partShoeMoveYValue")) $("#partShoeMoveYValue").textContent = `${Math.round(transform.shoeMoveY || 0)}px`;
    if ($("#partToeMoveX")) $("#partToeMoveX").value = Math.round(transform.toeMoveX ?? transform.toeSlide ?? 0);
    if ($("#partToeMoveXValue")) $("#partToeMoveXValue").textContent = `${Math.round(transform.toeMoveX ?? transform.toeSlide ?? 0)}px`;
    if ($("#partToeMoveY")) $("#partToeMoveY").value = Math.round(transform.toeMoveY || 0);
    if ($("#partToeMoveYValue")) $("#partToeMoveYValue").textContent = `${Math.round(transform.toeMoveY || 0)}px`;
    if ($("#partShowBendGuides")) $("#partShowBendGuides").checked = characterShowBendGuides;
    renderPartLayerOrder();
    renderPartLockList();
  }

  function renderPartLayerOrder() {
    const order = characterPartOrder();
    $("#partLayerOrder").innerHTML = order.map((part, index) => `
      <div class="animator-part ${part === selectedCharacterPart ? "selected" : ""}" data-layer-order-part="${part}">
        <span>${index + 1}</span><div><strong>${prettyPart[part]}</strong><small>${index === 0 ? "bottom" : index === order.length - 1 ? "top" : "middle"}</small></div>
      </div>
    `).join("");
  }

  function moveCharacterPartLayer(part, direction) {
    const order = characterPartOrder();
    const currentIndex = order.indexOf(part);
    if (currentIndex < 0) return;
    const nextIndex = clamp(direction === "bottom" ? 0 : direction === "top" ? order.length - 1 : currentIndex + direction, 0, order.length - 1);
    if (nextIndex === currentIndex) return;
    pushCharacterUndo("Body layer order");
    const [item] = order.splice(currentIndex, 1);
    order.splice(nextIndex, 0, item);
    project.character.partOrder = order;
    renderCharacterAnimator();
    markDirty();
  }

  function renderPartLockList() {
    const locked = project.character.lockedParts || [];
    $("#partLockList").innerHTML = bodyParts.map(part => `
      <label class="check"><input type="checkbox" data-lock-character-part="${part}" ${locked.includes(part) ? "checked" : ""}> ${prettyPart[part]}</label>
    `).join("");
  }

  function characterPartSize(part, transform) {
    const image = images.get(transform.assetId);
    if (image?.naturalWidth) return { width: image.naturalWidth * (transform.scale || 1), height: image.naturalHeight * (transform.scale || 1) };
    const fallback = part === "head" ? [54, 58] : part === "torso" ? [68, 94] : [30, 90];
    return { width: fallback[0] * (transform.scale || 1), height: fallback[1] * (transform.scale || 1) };
  }

  function characterPartAnchor(part, size) {
    return part === "head" || part === "torso"
      ? { x: -size.width / 2, y: -size.height / 2 }
      : { x: -size.width / 2, y: 0 };
  }


  function drawBendableCharacterImage(ctx, image, anchor, size, transform) {
    const bend = clamp(Number(transform.bend) || 0, -55, 55);
    const toeBend = clamp(Number(transform.toeBend) || 0, -90, 90);
    const bendEnabled = !!transform.bendEnabled && Math.abs(bend) > .1;
    const toeEnabled = !!transform.toeBendEnabled && Math.abs(toeBend) > .1;
    if (!bendEnabled && !toeEnabled) {
      ctx.drawImage(image, anchor.x, anchor.y, size.width, size.height);
      return;
    }
    const axis = ["bottom", "left", "right"].includes(transform.bendAxis) ? transform.bendAxis : "bottom";
    const bendZone = clamp(Number(transform.bendZone) || 25, 5, 70) / 100;
    const toeCutAxis = ["same", "bottom", "left", "right"].includes(transform.toeCutAxis) ? transform.toeCutAxis : "same";
    const toeZoneMax = toeCutAxis === "same" ? Math.min(40, bendZone * 100 - 1) : 100;
    const toeZone = clamp(Number(transform.toeBendZone) || 12, 1, toeZoneMax) / 100;
    const bendRad = bendEnabled ? bend * Math.PI / 180 : 0;
    const toeRad = toeEnabled ? toeBend * Math.PI / 180 : 0;
    const toeMoveX = Number(transform.toeMoveX ?? transform.toeSlide) || 0;
    const toeMoveY = Number(transform.toeMoveY) || 0;
    const shoeMoveX = Number(transform.shoeMoveX) || 0;
    const shoeMoveY = Number(transform.shoeMoveY) || 0;

    if (axis === "bottom") {
      const shoeStartY = size.height * (1 - bendZone);
      const sourceShoeStart = image.naturalHeight * (1 - bendZone);
      ctx.drawImage(image, 0, 0, image.naturalWidth, sourceShoeStart, anchor.x, anchor.y, size.width, shoeStartY);
      ctx.save();
      ctx.translate(anchor.x + size.width / 2 + shoeMoveX, anchor.y + shoeStartY + shoeMoveY);
      ctx.rotate(bendRad);
      const shoeDrawH = Math.max(1, size.height - shoeStartY);
      const shoeSourceH = Math.max(1, image.naturalHeight - sourceShoeStart);
      if (toeCutAxis === "left") {
        const toeDrawW = Math.max(1, size.width * toeZone);
        const toeSourceW = Math.max(1, image.naturalWidth * toeZone);
        ctx.drawImage(image, toeSourceW, sourceShoeStart, image.naturalWidth - toeSourceW, shoeSourceH, -size.width / 2 + toeDrawW, 0, size.width - toeDrawW, shoeDrawH);
        ctx.save();
        ctx.translate(-size.width / 2 + toeDrawW + toeMoveX, toeMoveY);
        ctx.rotate(toeRad);
        ctx.drawImage(image, 0, sourceShoeStart, toeSourceW, shoeSourceH, -toeDrawW, 0, toeDrawW, shoeDrawH);
        ctx.restore();
      } else if (toeCutAxis === "right") {
        const toeDrawW = Math.max(1, size.width * toeZone);
        const toeSourceW = Math.max(1, image.naturalWidth * toeZone);
        ctx.drawImage(image, 0, sourceShoeStart, image.naturalWidth - toeSourceW, shoeSourceH, -size.width / 2, 0, size.width - toeDrawW, shoeDrawH);
        ctx.save();
        ctx.translate(size.width / 2 - toeDrawW + toeMoveX, toeMoveY);
        ctx.rotate(toeRad);
        ctx.drawImage(image, image.naturalWidth - toeSourceW, sourceShoeStart, toeSourceW, shoeSourceH, 0, 0, toeDrawW, shoeDrawH);
        ctx.restore();
      } else {
        const toeStartY = size.height * (1 - toeZone);
        const sourceToeStart = image.naturalHeight * (1 - toeZone);
        const midSourceH = Math.max(1, sourceToeStart - sourceShoeStart);
        const midDrawH = Math.max(1, toeStartY - shoeStartY);
        ctx.drawImage(image, 0, sourceShoeStart, image.naturalWidth, midSourceH, -size.width / 2, 0, size.width, midDrawH);
        ctx.save();
        ctx.translate(toeMoveX, midDrawH + toeMoveY);
        ctx.rotate(toeRad);
        const toeSourceH = Math.max(1, image.naturalHeight - sourceToeStart);
        const toeDrawH = Math.max(1, size.height - toeStartY);
        ctx.drawImage(image, 0, sourceToeStart, image.naturalWidth, toeSourceH, -size.width / 2, 0, size.width, toeDrawH);
        ctx.restore();
      }
      ctx.restore();
      return;
    }

    if (axis === "right") {
      const shoeStartX = size.width * (1 - bendZone);
      const toeStartX = size.width * (1 - toeZone);
      const sourceShoeStart = image.naturalWidth * (1 - bendZone);
      const sourceToeStart = image.naturalWidth * (1 - toeZone);
      ctx.drawImage(image, 0, 0, sourceShoeStart, image.naturalHeight, anchor.x, anchor.y, shoeStartX, size.height);
      ctx.save();
      ctx.translate(anchor.x + shoeStartX + shoeMoveX, anchor.y + size.height / 2 + shoeMoveY);
      ctx.rotate(bendRad);
      const midSourceW = Math.max(1, sourceToeStart - sourceShoeStart);
      const midDrawW = Math.max(1, toeStartX - shoeStartX);
      ctx.drawImage(image, sourceShoeStart, 0, midSourceW, image.naturalHeight, 0, -size.height / 2, midDrawW, size.height);
      ctx.save();
      ctx.translate(midDrawW + toeMoveX, toeMoveY);
      ctx.rotate(toeRad);
      const toeSourceW = Math.max(1, image.naturalWidth - sourceToeStart);
      const toeDrawW = Math.max(1, size.width - toeStartX);
      ctx.drawImage(image, sourceToeStart, 0, toeSourceW, image.naturalHeight, 0, -size.height / 2, toeDrawW, size.height);
      ctx.restore();
      ctx.restore();
      return;
    }

    const shoeEndX = size.width * bendZone;
    const toeEndX = size.width * toeZone;
    const sourceShoeEnd = image.naturalWidth * bendZone;
    const sourceToeEnd = image.naturalWidth * toeZone;
    ctx.drawImage(image, sourceShoeEnd, 0, image.naturalWidth - sourceShoeEnd, image.naturalHeight, anchor.x + shoeEndX, anchor.y, size.width - shoeEndX, size.height);
    ctx.save();
    ctx.translate(anchor.x + shoeEndX + shoeMoveX, anchor.y + size.height / 2 + shoeMoveY);
    ctx.rotate(bendRad);
    const midSourceW = Math.max(1, sourceShoeEnd - sourceToeEnd);
    const midDrawW = Math.max(1, shoeEndX - toeEndX);
    ctx.drawImage(image, sourceToeEnd, 0, midSourceW, image.naturalHeight, -midDrawW, -size.height / 2, midDrawW, size.height);
    ctx.save();
    ctx.translate(-midDrawW + toeMoveX, toeMoveY);
    ctx.rotate(toeRad);
    const toeSourceW = Math.max(1, sourceToeEnd);
    const toeDrawW = Math.max(1, toeEndX);
    ctx.drawImage(image, 0, 0, toeSourceW, image.naturalHeight, -toeDrawW, -size.height / 2, toeDrawW, size.height);
    ctx.restore();
    ctx.restore();
  }
  function drawCharacterBendGuides(ctx, anchor, size, transform) {
    const axis = ["bottom", "left", "right"].includes(transform.bendAxis) ? transform.bendAxis : "bottom";
    const toeCutAxis = ["same", "bottom", "left", "right"].includes(transform.toeCutAxis) ? transform.toeCutAxis : "same";
    const bendZone = clamp(Number(transform.bendZone) || 25, 5, 70) / 100;
    const toeMax = toeCutAxis === "same" ? Math.min(40, Math.max(1, bendZone * 100 - 1)) : 100;
    const toeZone = clamp(Number(transform.toeBendZone) || 12, 1, toeMax) / 100;
    const guides = [];
    if (axis === "bottom") {
      const bendY = anchor.y + size.height * (1 - bendZone);
      guides.push({ kind: "main", x1: anchor.x, y1: bendY, x2: anchor.x + size.width, y2: bendY, labelX: anchor.x + size.width + 8, labelY: bendY });
      if (toeCutAxis === "left") {
        const toeX = anchor.x + size.width * toeZone;
        guides.push({ kind: "tip", x1: toeX, y1: bendY, x2: toeX, y2: anchor.y + size.height, labelX: toeX + 4, labelY: bendY + 12 });
      } else if (toeCutAxis === "right") {
        const toeX = anchor.x + size.width * (1 - toeZone);
        guides.push({ kind: "tip", x1: toeX, y1: bendY, x2: toeX, y2: anchor.y + size.height, labelX: toeX + 4, labelY: bendY + 12 });
      } else {
        const toeY = anchor.y + size.height * (1 - toeZone);
        guides.push({ kind: "tip", x1: anchor.x, y1: toeY, x2: anchor.x + size.width, y2: toeY, labelX: anchor.x + size.width + 8, labelY: toeY });
      }
    } else if (axis === "right") {
      const bendX = anchor.x + size.width * (1 - bendZone);
      guides.push({ kind: "main", x1: bendX, y1: anchor.y, x2: bendX, y2: anchor.y + size.height, labelX: bendX + 4, labelY: anchor.y - 8 });
      if (toeCutAxis === "bottom") {
        const toeY = anchor.y + size.height * (1 - toeZone);
        guides.push({ kind: "tip", x1: bendX, y1: toeY, x2: anchor.x + size.width, y2: toeY, labelX: bendX + 4, labelY: toeY - 8 });
      } else {
        const toeX = anchor.x + size.width * (1 - toeZone);
        guides.push({ kind: "tip", x1: toeX, y1: anchor.y, x2: toeX, y2: anchor.y + size.height, labelX: toeX + 4, labelY: anchor.y - 8 });
      }
    } else {
      const bendX = anchor.x + size.width * bendZone;
      guides.push({ kind: "main", x1: bendX, y1: anchor.y, x2: bendX, y2: anchor.y + size.height, labelX: bendX + 4, labelY: anchor.y - 8 });
      if (toeCutAxis === "bottom") {
        const toeY = anchor.y + size.height * (1 - toeZone);
        guides.push({ kind: "tip", x1: anchor.x, y1: toeY, x2: bendX, y2: toeY, labelX: anchor.x + 4, labelY: toeY - 8 });
      } else {
        const toeX = anchor.x + size.width * toeZone;
        guides.push({ kind: "tip", x1: toeX, y1: anchor.y, x2: toeX, y2: anchor.y + size.height, labelX: toeX + 4, labelY: anchor.y - 8 });
      }
    }
    ctx.save();
    ctx.lineWidth = 2;
    ctx.font = "10px sans-serif";
    ctx.textBaseline = "middle";
    guides.forEach(guide => {
      const isTip = guide.kind === "tip";
      ctx.strokeStyle = isTip ? "#ff6b5f" : "#ffd45f";
      ctx.fillStyle = isTip ? "#ff6b5f" : "#ffd45f";
      ctx.setLineDash(isTip ? [3, 3] : [7, 4]);
      ctx.beginPath();
      ctx.moveTo(guide.x1, guide.y1);
      ctx.lineTo(guide.x2, guide.y2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(guide.x1, guide.y1, 3, 0, Math.PI * 2);
      ctx.arc(guide.x2, guide.y2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(isTip ? "tip" : "bend", guide.labelX, guide.labelY);
    });
    ctx.restore();
  }
  function paintCharacterFrame(ctx, frame, offsetX = 0, offsetY = 0, showSelection = false) {
    ctx.imageSmoothingEnabled = false;
    characterPartOrder().forEach(part => {
      if (showSelection && characterHiddenParts.has(part)) return;
      const transform = frame.parts[part];
      const image = images.get(transform.assetId);
      const size = characterPartSize(part, transform);
      ctx.save();
      ctx.translate(offsetX + transform.x, offsetY + transform.y);
      ctx.rotate((transform.rotation || 0) * Math.PI / 180);
      ctx.scale(transform.flip ? -1 : 1, 1);
      const anchor = characterPartAnchor(part, size);
      if (image?.naturalWidth && !isLikelySourceSheetAsset(transform.assetId)) {
        drawBendableCharacterImage(ctx, image, anchor, size, transform);
      } else {
        drawCharacterPlaceholder(ctx, part, size);
      }
      if (showSelection && part === selectedCharacterPart) {
        ctx.strokeStyle = "#ffe08b";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(anchor.x - 3, anchor.y - 3, size.width + 6, size.height + 6);
        ctx.setLineDash([]);
        ctx.fillStyle = "#ffe08b";
        ctx.fillRect(-4, -4, 8, 8);
        if (characterShowBendGuides) drawCharacterBendGuides(ctx, anchor, size, transform);
      }
      ctx.restore();
    });
  }

  function drawCharacterPlaceholder(ctx, part, size) {
    if (part === "head") {
      ctx.fillStyle = "#b58f70";
      ctx.beginPath(); ctx.ellipse(0, 0, size.width / 2, size.height / 2, 0, 0, Math.PI * 2); ctx.fill();
    } else if (part === "torso") {
      ctx.fillStyle = "#3c5b52";
      rounded(ctx, -size.width / 2, -size.height / 2, size.width, size.height, 10); ctx.fill();
    } else {
      ctx.strokeStyle = part.includes("Arm") ? "#876d57" : "#343b37";
      ctx.lineWidth = Math.max(8, size.width * .55);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, size.height - 8); ctx.stroke();
    }
  }

  function setCharacterZoom(value) {
    characterZoom = clamp(Number(value) || 1, .5, 5);
    if ($("#characterZoom")) $("#characterZoom").value = Math.round(characterZoom * 100);
    if ($("#characterZoomValue")) $("#characterZoomValue").textContent = `${Math.round(characterZoom * 100)}%`;
    characterCanvas.style.width = `${Math.round(project.character.width * characterZoom)}px`;
    characterCanvas.style.height = `${Math.round(project.character.height * characterZoom)}px`;
  }

  function characterGuides() {
    if (!project.character.guides) project.character.guides = [];
    return project.character.guides;
  }

  function drawCharacterGuides(ctx) {
    if (!characterShowGuides) return;
    const guides = characterGuides();
    if (!guides.length) return;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.font = "bold 11px sans-serif";
    guides.forEach((guide, index) => {
      const value = Number(guide.value) || 0;
      const selected = guide.id === selectedCharacterGuideId;
      const color = selected ? "#ff4f4f" : guide.axis === "x" ? "#48d8ff" : "#ffd15a";
      ctx.strokeStyle = "rgba(0,0,0,.85)";
      ctx.lineWidth = selected ? 5 : 4;
      ctx.setLineDash([]);
      ctx.beginPath();
      if (guide.axis === "x") { ctx.moveTo(value, 0); ctx.lineTo(value, project.character.height); }
      else { ctx.moveTo(0, value); ctx.lineTo(project.character.width, value); }
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = selected ? 3 : 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      if (guide.axis === "x") {
        ctx.moveTo(value, 0);
        ctx.lineTo(value, project.character.height);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillRect(value - 5, 4, 10, 10);
        ctx.fillText(`V${index + 1} x=${Math.round(value)}`, value + 7, 14);
      } else {
        ctx.moveTo(0, value);
        ctx.lineTo(project.character.width, value);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillRect(4, value - 5, 10, 10);
        ctx.fillText(`H${index + 1} y=${Math.round(value)}`, 18, value - 7);
      }
    });
    ctx.restore();
  }


  function deleteCharacterGuideAt(index) {
    const guides = characterGuides();
    if (index < 0 || index >= guides.length) return;
    pushCharacterUndo("Delete guide line");
    const [removed] = guides.splice(index, 1);
    if (removed?.id === selectedCharacterGuideId) selectedCharacterGuideId = null;
    renderCharacterGuides();
    drawCharacterPreview();
    markDirty();
  }

  function renderCharacterGuides() {
    const list = $("#characterGuideList");
    if (!list) return;
    const guides = characterGuides();
    list.innerHTML = guides.length ? guides.map((guide, index) => {
      const label = guide.axis === "x" ? `V${index + 1} X` : `H${index + 1} Y`;
      return `<div class="character-guide-row ${guide.id === selectedCharacterGuideId ? "selected" : ""}" data-guide-id="${guide.id}" data-guide-index="${index}">
        <strong>${label}</strong>
        <input type="number" min="0" max="${guide.axis === "x" ? project.character.width : project.character.height}" value="${Math.round(Number(guide.value) || 0)}" data-guide-value="${guide.id}">
        <button type="button" data-delete-guide-index="${index}">Del</button>
      </div>`;
    }).join("") : `<p class="hint">No guides yet. Add a vertical or horizontal guide.</p>`;
    list.querySelectorAll("[data-delete-guide-index]").forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        deleteCharacterGuideAt(Number(button.dataset.deleteGuideIndex));
      };
    });
  }
  function characterGuideAt(point) {
    if (!characterShowGuides) return null;
    const threshold = Math.max(4, 8 / Math.max(.5, characterZoom));
    let best = null;
    characterGuides().forEach(guide => {
      const distance = Math.abs((guide.axis === "x" ? point.x : point.y) - guide.value);
      if (distance <= threshold && (!best || distance < best.distance)) best = { guide, distance };
    });
    return best?.guide || null;
  }

  function addCharacterGuide(axis) {
    if (!project.character) return;
    pushCharacterUndo("Add guide line");
    characterGuides().push({ id: uid(), axis: axis === "y" ? "y" : "x", value: axis === "y" ? Math.round(project.character.height / 2) : Math.round(project.character.width / 2) });
    characterShowGuides = true;
    selectedCharacterGuideId = characterGuides()[characterGuides().length - 1].id;
    if ($("#showCharacterGuides")) $("#showCharacterGuides").checked = true;
    renderCharacterGuides();
    drawCharacterPreview();
    markDirty();
  }

  function deleteLastCharacterGuide() {
    if (!project.character || !characterGuides().length) return;
    pushCharacterUndo("Delete guide line");
    const removed = characterGuides().pop();
    if (removed?.id === selectedCharacterGuideId) selectedCharacterGuideId = null;
    renderCharacterGuides();
    drawCharacterPreview();
    markDirty();
  }
  function drawCharacterPreview() {
    if (characterCanvas.width !== project.character.width) characterCanvas.width = project.character.width;
    if (characterCanvas.height !== project.character.height) characterCanvas.height = project.character.height;
    setCharacterZoom(characterZoom);
    characterCtx.imageSmoothingEnabled = false;
    characterCtx.clearRect(0, 0, characterCanvas.width, characterCanvas.height);
    characterCtx.strokeStyle = "rgba(220,225,210,.25)";
    characterCtx.lineWidth = 1;
    characterCtx.beginPath();
    characterCtx.moveTo(0, characterCanvas.height - 22);
    characterCtx.lineTo(characterCanvas.width, characterCanvas.height - 22);
    characterCtx.stroke();
    paintCharacterFrame(characterCtx, currentCharacterFrame(), 0, 0, true);
    drawCharacterGuides(characterCtx);
    renderCharacterGuides();
    characterCtx.save();
    characterCtx.fillStyle = "rgba(11, 14, 10, .72)";
    characterCtx.fillRect(8, 8, 112, 24);
    characterCtx.fillStyle = "#ffe08b";
    characterCtx.font = "12px sans-serif";
    characterCtx.fillText(`Facing: ${prettyAnimationState(animationFacing())}`, 14, 25);
    characterCtx.restore();
  }

  function characterCanvasPoint(event) {
    const rect = characterCanvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * characterCanvas.width / rect.width,
      y: (event.clientY - rect.top) * characterCanvas.height / rect.height
    };
  }

  function characterPartAt(point) {
    const frame = currentCharacterFrame();
    for (const part of characterPartOrder().slice().reverse()) {
      const transform = frame.parts[part];
      const size = characterPartSize(part, transform);
      const angle = (transform.rotation || 0) * Math.PI / 180;
      const dx = point.x - transform.x, dy = point.y - transform.y;
      const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
      const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
      if (Math.abs(localX) <= size.width / 2 && Math.abs(localY) <= size.height / 2) return part;
    }
    return null;
  }

  $("#openCharacterAnimator").onclick = () => {
    $("#characterAnimator").classList.add("active");
    $("#characterAnimator").setAttribute("aria-hidden", "false");
    renderCharacterAnimator();
  };
  $("#closeCharacterAnimator").onclick = closeCharacterAnimator;
  function closeCharacterAnimator() {
    characterPlaying = false;
    $("#characterAnimator").classList.remove("active");
    $("#characterAnimator").setAttribute("aria-hidden", "true");
  }
  $("#animationState").onchange = event => {
    characterState = event.target.value;
    characterFrameIndex = 0;
    characterPlaying = false;
    const inherited = inheritMissingAssetsFromStanding(characterState, true);
    renderCharacterAnimator();
    if (inherited) markDirty();
  };
  if ($("#addCharacterAnimation")) $("#addCharacterAnimation").onclick = () => {
    const rawName = prompt("Name the new animation:", "New animation");
    if (!rawName) return;
    const state = rawName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!state) return;
    if (project.character.animations[state]) return alert("That animation already exists.");
    pushCharacterUndo("Add animation");
    const source = currentCharacterAnimation();
    project.character.animations[state] = source.length ? source.map(cloneCharacterFrame) : [baseCharacterFrame(project.rig || {})];
    characterState = state;
    characterFrameIndex = 0;
    ensureCharacterAnimation(state);
    renderCharacterAnimator();
    markDirty();
  };
  $("#animationFacing").onchange = () => {
    project.character.facing[characterState] = "right";
    renderCharacterAnimator();
    markDirty();
  };
  $("#animationFps").oninput = event => {
    if (!project.character.animationFps) project.character.animationFps = {};
    project.character.animationFps[characterState] = +event.target.value;
    project.character.fps = +event.target.value;
    $("#animationFpsValue").textContent = `${animationFps(characterState)} fps`;
    markDirty();
  };
  $("#animationLoopMode").onchange = event => {
    pushCharacterUndo("Animation loop mode");
    project.character.loopMode[characterState] = event.target.value === "pingpong" ? "pingpong" : "normal";
    renderCharacterTimeline();
    markDirty();
  };
  $("#copyAnimationTimeline").onclick = () => {
    const sourceState = $("#copyAnimationSource").value;
    if (!sourceState || sourceState === characterState) return;
    const sourceFrames = project.character.animations[sourceState] || [];
    if (!sourceFrames.length) return alert("That source animation has no frames to copy.");
    const ok = confirm(`Replace ${prettyAnimationState(characterState)} with a copy of ${prettyAnimationState(sourceState)}?`);
    if (!ok) return;
    pushCharacterUndo("Copy animation timeline");
    project.character.animations[characterState] = sourceFrames.map(cloneCharacterFrame);
    project.character.facing[characterState] = "right";
    project.character.loopMode[characterState] = animationLoopMode(sourceState);
    if (!project.character.animationFps) project.character.animationFps = {};
    project.character.animationFps[characterState] = animationFps(sourceState);
    project.character.fps = animationFps(sourceState);
    characterFrameIndex = 0;
    characterPlaying = false;
    renderCharacterAnimator();
    markDirty();
  };
  $("#animatorPartList").onclick = event => {
    const toggle = event.target.closest("[data-toggle-character-part]");
    if (toggle) {
      event.stopPropagation();
      const part = toggle.dataset.toggleCharacterPart;
      if (characterHiddenParts.has(part)) characterHiddenParts.delete(part); else characterHiddenParts.add(part);
      renderCharacterParts(); drawCharacterPreview();
      return;
    }
    const row = event.target.closest(".animator-part");
    if (!row) return;
    selectedCharacterPart = selectedCharacterPart === row.dataset.characterPart ? null : row.dataset.characterPart;
    renderCharacterParts(); renderCharacterTransforms(); drawCharacterPreview();
  };
  $("#characterAssetSearch").oninput = event => {
    characterAssetQuery = event.target.value;
    renderCharacterAssets();
  };
  $("#showCharacterSourceSheets").onchange = event => {
    characterShowSourceSheets = event.target.checked;
    renderCharacterAssets();
  };
  $("#characterAssetGrid").onclick = event => {
    const card = event.target.closest(".character-asset-card");
    if (!card) return;
    selectedAssetId = card.dataset.characterAsset;
    renderCharacterAssets();
  };
  $("#assignCharacterAsset").onclick = () => {
    if (!selectedAssetId) return alert("Select an extracted body-part asset first.");
    assignAssetToCharacterPart(selectedAssetId);
  };
  $("#importCharacterAsset").onclick = () => {
    if (!selectedCharacterPart) return alert("Select a body layer first.");
    $("#characterAssetFile").click();
  };
  $("#characterAssetFile").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    const src = await fileToDataUrl(file);
    const asset = { id: uid(), name: file.name, src, category: "character", characterPart: selectedCharacterPart };
    project.assets.push(asset);
    const image = new Image();
    image.onload = refreshAssetViews;
    image.src = src;
    images.set(asset.id, image);
    selectedAssetId = asset.id;
    characterAssetQuery = "";
    $("#characterAssetSearch").value = "";
    assignAssetToCharacterPart(asset.id, true);
    event.target.value = "";
  });
  function defaultCharacterTransform(part, assetId) {
    return characterDefaultPose(part, assetId);
  }
  function assignAssetToCharacterPart(assetId, resetPlacement = false) {
    const assignedAsset = project.assets.find(asset => asset.id === assetId);
    if (assignedAsset) assignedAsset.category = "character";
    const applyAll = $("#assignAllCharacterFrames").checked || characterState === "standing";
    const frames = applyAll ? currentCharacterAnimation() : [currentCharacterFrame()];
    frames.forEach(frame => {
      if (resetPlacement) frame.parts[selectedCharacterPart] = defaultCharacterTransform(selectedCharacterPart, assetId);
      else frame.parts[selectedCharacterPart].assetId = assetId;
    });
    project.rig[selectedCharacterPart] = assetId;
    if (characterState === "standing") propagateMainAssetToAnimations(selectedCharacterPart, assetId);
    else inheritMissingAssetsFromStanding(characterState);
    renderCharacterAnimator(); renderRig(); markDirty();
  }
  $("#clearCharacterPart").onclick = () => {
    const frames = $("#assignAllCharacterFrames").checked ? currentCharacterAnimation() : [currentCharacterFrame()];
    frames.forEach(frame => { frame.parts[selectedCharacterPart].assetId = null; });
    project.rig[selectedCharacterPart] = null;
    renderCharacterAnimator(); renderRig(); markDirty();
  };
  $("#resetCharacterPose").onclick = () => {
    const frames = $("#assignAllCharacterFrames").checked ? currentCharacterAnimation() : [currentCharacterFrame()];
    frames.forEach(resetFramePoseLayout);
    bodyParts.forEach(part => {
      if (isLikelySourceSheetAsset(project.rig[part])) project.rig[part] = null;
    });
    renderCharacterAnimator(); renderRig(); markDirty();
  };
  $("#characterTimeline").onclick = event => {
    const frame = event.target.closest(".character-frame");
    if (!frame) return;
    characterFrameIndex = +frame.dataset.characterFrame;
    characterPlaying = false;
    const inherited = inheritMissingAssetsFromStanding(characterState, true);
    renderCharacterAnimator();
    if (inherited) markDirty();
  };
  $("#previousCharacterFrame").onclick = () => {
    const count = currentCharacterAnimation().length;
    characterFrameIndex = (characterFrameIndex - 1 + count) % count;
    renderCharacterAnimator();
  };
  $("#nextCharacterFrame").onclick = () => {
    characterFrameIndex = (characterFrameIndex + 1) % currentCharacterAnimation().length;
    renderCharacterAnimator();
  };
  $("#undoCharacterEdit").onclick = undoCharacterEdit;
  $("#playCharacterAnimation").onclick = () => {
    characterPlaying = !characterPlaying;
    characterLastStep = performance.now();
    renderCharacterTimeline();
  };
  $("#addCharacterFrame").onclick = () => {
    pushCharacterUndo("Add frame");
    const frame = baseCharacterFrame(project.rig);
    bodyParts.forEach(part => { frame.parts[part].assetId = currentCharacterFrame().parts[part].assetId; });
    currentCharacterAnimation().splice(characterFrameIndex + 1, 0, frame);
    characterFrameIndex++;
    renderCharacterAnimator(); markDirty();
  };
  $("#duplicateCharacterFrame").onclick = () => {
    pushCharacterUndo("Duplicate frame");
    currentCharacterAnimation().splice(characterFrameIndex + 1, 0, cloneCharacterFrame(currentCharacterFrame()));
    characterFrameIndex++;
    renderCharacterAnimator(); markDirty();
  };
  $("#moveCharacterFrameBack").onclick = () => moveCharacterFrame(-1);
  $("#moveCharacterFrameForward").onclick = () => moveCharacterFrame(1);
  function moveCharacterFrame(direction) {
    const frames = currentCharacterAnimation();
    const nextIndex = characterFrameIndex + direction;
    if (nextIndex < 0 || nextIndex >= frames.length) return;
    pushCharacterUndo("Move frame");
    const [frame] = frames.splice(characterFrameIndex, 1);
    frames.splice(nextIndex, 0, frame);
    characterFrameIndex = nextIndex;
    renderCharacterAnimator(); markDirty();
  }
  $("#deleteCharacterFrame").onclick = () => {
    const frames = currentCharacterAnimation();
    if (frames.length === 1) return alert("An animation needs at least one frame.");
    pushCharacterUndo("Delete frame");
    frames.splice(characterFrameIndex, 1);
    characterFrameIndex = clamp(characterFrameIndex, 0, frames.length - 1);
    renderCharacterAnimator(); markDirty();
  };

  const characterTransformFields = {
    partX: ["x", Number],
    partY: ["y", Number],
    partRotation: ["rotation", Number],
    partRotationNumber: ["rotation", Number],
    partScale: ["scale", value => Number(value) / 100],
    partScaleNumber: ["scale", value => Number(value) / 100]
  };
  Object.entries(characterTransformFields).forEach(([id, [key, cast]]) => {
    $(`#${id}`).onfocus = () => pushCharacterUndo(`${prettyPart[selectedCharacterPart]} ${key}`);
    $(`#${id}`).onpointerdown = () => pushCharacterUndo(`${prettyPart[selectedCharacterPart]} ${key}`);
    $(`#${id}`).oninput = event => {
      const transform = currentCharacterTransform();
      if (!transform) return;
      const nextValue = cast(event.target.value);
      if (key === "x" || key === "y") {
        const delta = nextValue - (transform[key] || 0);
        moveLockedCharacterParts(selectedCharacterPart, key === "x" ? delta : 0, key === "y" ? delta : 0);
      } else {
        transform[key] = nextValue;
        if (key === "scale") propagatePartScaleFromStanding(selectedCharacterPart);
      }
      renderCharacterTransforms(); drawCharacterPreview(); markDirty();
    };
  });
  if ($("#partBendEnabled")) $("#partBendEnabled").onchange = event => {
    pushCharacterUndo(`${prettyPart[selectedCharacterPart]} bend toggle`);
    const transform = currentCharacterTransform();
    if (!transform) return;
    transform.bendEnabled = event.target.checked;
    renderCharacterTransforms(); drawCharacterPreview(); markDirty();
  };
  if ($("#partBendAxis")) $("#partBendAxis").onchange = event => {
    pushCharacterUndo(`${prettyPart[selectedCharacterPart]} bend cut direction`);
    const transform = currentCharacterTransform();
      if (!transform) return;
    transform.bendAxis = ["bottom", "left", "right"].includes(event.target.value) ? event.target.value : "bottom";
    renderCharacterTransforms(); drawCharacterPreview(); markDirty();
  };
  if ($("#partBend")) {
    $("#partBend").onfocus = () => pushCharacterUndo(`${prettyPart[selectedCharacterPart]} bend`);
    $("#partBend").onpointerdown = () => pushCharacterUndo(`${prettyPart[selectedCharacterPart]} bend`);
    $("#partBend").oninput = event => {
      const transform = currentCharacterTransform();
      if (!transform) return;
      transform.bend = clamp(+event.target.value || 0, -55, 55);
      transform.bendEnabled = Math.abs(transform.bend) > .1;
      renderCharacterTransforms(); drawCharacterPreview(); markDirty();
    };
  }
  if ($("#partBendZone")) {
    $("#partBendZone").onfocus = () => pushCharacterUndo(`${prettyPart[selectedCharacterPart]} bend zone`);
    $("#partBendZone").onpointerdown = () => pushCharacterUndo(`${prettyPart[selectedCharacterPart]} bend zone`);
    $("#partBendZone").oninput = event => {
      const transform = currentCharacterTransform();
      if (!transform) return;
      transform.bendZone = clamp(+event.target.value || 25, 5, 70);
      renderCharacterTransforms(); drawCharacterPreview(); markDirty();
    };
  }
  if ($("#partToeBendEnabled")) $("#partToeBendEnabled").onchange = event => {
    pushCharacterUndo(`${prettyPart[selectedCharacterPart]} toe bend toggle`);
    const transform = currentCharacterTransform();
    if (!transform) return;
    transform.toeBendEnabled = event.target.checked;
    renderCharacterTransforms(); drawCharacterPreview(); markDirty();
  };
  if ($("#partToeCutAxis")) $("#partToeCutAxis").onchange = event => {
    pushCharacterUndo(`${prettyPart[selectedCharacterPart]} toe cut direction`);
    const transform = currentCharacterTransform();
      if (!transform) return;
    transform.toeCutAxis = ["same", "bottom", "left", "right"].includes(event.target.value) ? event.target.value : "same";
    renderCharacterTransforms(); drawCharacterPreview(); markDirty();
  };
  if ($("#partToeBend")) {
    $("#partToeBend").onfocus = () => pushCharacterUndo(`${prettyPart[selectedCharacterPart]} toe bend`);
    $("#partToeBend").onpointerdown = () => pushCharacterUndo(`${prettyPart[selectedCharacterPart]} toe bend`);
    $("#partToeBend").oninput = event => {
      const transform = currentCharacterTransform();
      if (!transform) return;
      transform.toeBend = clamp(+event.target.value || 0, -90, 90);
      transform.toeBendEnabled = Math.abs(transform.toeBend) > .1;
      renderCharacterTransforms(); drawCharacterPreview(); markDirty();
    };
  }
  if ($("#partToeBendZone")) {
    $("#partToeBendZone").onfocus = () => pushCharacterUndo(`${prettyPart[selectedCharacterPart]} toe bend zone`);
    $("#partToeBendZone").onpointerdown = () => pushCharacterUndo(`${prettyPart[selectedCharacterPart]} toe bend zone`);
    $("#partToeBendZone").oninput = event => {
      const transform = currentCharacterTransform();
      if (!transform) return;
      transform.toeBendZone = clamp(+event.target.value || 12, 1, transform.toeCutAxis === "same" ? Math.min(40, Math.max(1, Math.round((Number(transform.bendZone) || 25) - 1))) : 100);
      renderCharacterTransforms(); drawCharacterPreview(); markDirty();
    };
  }
  [["partShoeMoveX", "shoeMoveX", "shoe move X"], ["partShoeMoveY", "shoeMoveY", "shoe move Y"], ["partToeMoveX", "toeMoveX", "toe move X"], ["partToeMoveY", "toeMoveY", "toe move Y"]].forEach(([id, key, label]) => {
    if (!$(`#${id}`)) return;
    $(`#${id}`).onfocus = () => pushCharacterUndo(`${prettyPart[selectedCharacterPart]} ${label}`);
    $(`#${id}`).onpointerdown = () => pushCharacterUndo(`${prettyPart[selectedCharacterPart]} ${label}`);
    $(`#${id}`).oninput = event => {
      const transform = currentCharacterTransform();
      if (!transform) return;
      transform[key] = clamp(+event.target.value || 0, -120, 120);
      renderCharacterTransforms(); drawCharacterPreview(); markDirty();
    };
  });
  if ($("#partShowBendGuides")) $("#partShowBendGuides").onchange = event => {
    characterShowBendGuides = event.target.checked;
    renderCharacterTransforms();
    drawCharacterPreview();
  };
  function nudgeCharacterSplitPiece(piece, dx, dy) {
    const transform = currentCharacterTransform();
    if (!transform) return;
    const xKey = piece === "shoe" ? "shoeMoveX" : "toeMoveX";
    const yKey = piece === "shoe" ? "shoeMoveY" : "toeMoveY";
    transform[xKey] = clamp((Number(transform[xKey]) || 0) + dx, -120, 120);
    transform[yKey] = clamp((Number(transform[yKey]) || 0) + dy, -120, 120);
    renderCharacterTransforms(); drawCharacterPreview(); markDirty();
  }
  $$("[data-part-nudge]").forEach(button => {
    button.onclick = event => {
      pushCharacterUndo(`${prettyPart[selectedCharacterPart]} ${button.dataset.partNudge} nudge`);
      const step = event.shiftKey ? 5 : 1;
      nudgeCharacterSplitPiece(button.dataset.partNudge, (+button.dataset.dx || 0) * step, (+button.dataset.dy || 0) * step);
    };
  });
  if ($("#characterZoom")) $("#characterZoom").oninput = event => setCharacterZoom((+event.target.value || 100) / 100);
  if ($("#characterZoomOut")) $("#characterZoomOut").onclick = () => setCharacterZoom(characterZoom - .25);
  if ($("#characterZoomIn")) $("#characterZoomIn").onclick = () => setCharacterZoom(characterZoom + .25);
  if ($("#characterZoomReset")) $("#characterZoomReset").onclick = () => setCharacterZoom(1);
  if ($("#showCharacterGuides")) $("#showCharacterGuides").onchange = event => { characterShowGuides = event.target.checked; drawCharacterPreview(); };
  if ($("#addVerticalGuide")) $("#addVerticalGuide").onclick = () => addCharacterGuide("x");
  if ($("#addHorizontalGuide")) $("#addHorizontalGuide").onclick = () => addCharacterGuide("y");
  if ($("#deleteNearestGuide")) $("#deleteNearestGuide").onclick = () => deleteLastCharacterGuide();
  if ($("#clearCharacterGuides")) $("#clearCharacterGuides").onclick = () => {
    if (!characterGuides().length) return;
    pushCharacterUndo("Clear guide lines");
    project.character.guides = [];
    selectedCharacterGuideId = null;
    renderCharacterGuides();
    drawCharacterPreview();
    markDirty();
  };
  if ($("#characterGuideList")) $("#characterGuideList").onclick = event => {
    const row = event.target.closest("[data-guide-id]");
    if (row) { selectedCharacterGuideId = row.dataset.guideId; renderCharacterGuides(); drawCharacterPreview(); }
  };
  if ($("#characterGuideList")) $("#characterGuideList").oninput = event => {
    const input = event.target.closest("[data-guide-value]");
    if (!input) return;
    const guide = characterGuides().find(item => item.id === input.dataset.guideValue);
    if (!guide) return;
    guide.value = clamp(+input.value || 0, 0, guide.axis === "x" ? project.character.width : project.character.height);
    selectedCharacterGuideId = guide.id;
    drawCharacterPreview(); markDirty();
  };
  $("#partFlip").onchange = event => {
    pushCharacterUndo(`${prettyPart[selectedCharacterPart]} flip`);
    const transform = currentCharacterTransform();
    if (!transform) return;
    transform.flip = event.target.checked;
    drawCharacterPreview(); markDirty();
  };
  $("#copyPartTransform").onclick = () => {
    const transform = currentCharacterTransform();
    if (!transform) return alert("Select a body layer first.");
    characterTransformClipboard = {
      part: selectedCharacterPart,
      x: Number(transform.x) || 0,
      y: Number(transform.y) || 0,
      rotation: Number(transform.rotation) || 0,
      scale: Number(transform.scale) || 1,
      flip: !!transform.flip,
      bendEnabled: !!transform.bendEnabled,
      bend: Number(transform.bend) || 0,
      bendZone: Number(transform.bendZone) || 25,
      toeBendEnabled: !!transform.toeBendEnabled,
      toeBend: Number(transform.toeBend) || 0,
      toeBendZone: Number(transform.toeBendZone) || 12,
      toeSlide: Number(transform.toeSlide) || 0,
      toeMoveX: Number(transform.toeMoveX ?? transform.toeSlide) || 0,
      toeMoveY: Number(transform.toeMoveY) || 0,
      shoeMoveX: Number(transform.shoeMoveX) || 0,
      shoeMoveY: Number(transform.shoeMoveY) || 0,
      toeCutAxis: ["same", "bottom", "left", "right"].includes(transform.toeCutAxis) ? transform.toeCutAxis : "same",
      bendAxis: ["bottom", "left", "right"].includes(transform.bendAxis) ? transform.bendAxis : "bottom"
    };
    updatePartTransformClipboardStatus();
  };
  $("#pastePartTransform").onclick = () => {
    if (!characterTransformClipboard) return alert("Copy a body-layer transform first.");
    pushCharacterUndo(`${prettyPart[selectedCharacterPart]} paste transform`);
    const transform = currentCharacterTransform();
    if (!transform) return alert("Select a body layer first.");
    Object.assign(transform, {
      x: characterTransformClipboard.x,
      y: characterTransformClipboard.y,
      rotation: characterTransformClipboard.rotation,
      scale: characterTransformClipboard.scale,
      flip: characterTransformClipboard.flip,
      bendEnabled: !!characterTransformClipboard.bendEnabled,
      bend: Number(characterTransformClipboard.bend) || 0,
      bendZone: Number(characterTransformClipboard.bendZone) || 25,
      toeBendEnabled: !!characterTransformClipboard.toeBendEnabled,
      toeBend: Number(characterTransformClipboard.toeBend) || 0,
      toeBendZone: Number(characterTransformClipboard.toeBendZone) || 12,
      toeSlide: Number(characterTransformClipboard.toeSlide) || 0,
      toeMoveX: Number(characterTransformClipboard.toeMoveX ?? characterTransformClipboard.toeSlide) || 0,
      toeMoveY: Number(characterTransformClipboard.toeMoveY) || 0,
      shoeMoveX: Number(characterTransformClipboard.shoeMoveX) || 0,
      shoeMoveY: Number(characterTransformClipboard.shoeMoveY) || 0,
      toeCutAxis: ["same", "bottom", "left", "right"].includes(characterTransformClipboard.toeCutAxis) ? characterTransformClipboard.toeCutAxis : "same",
      bendAxis: ["bottom", "left", "right"].includes(characterTransformClipboard.bendAxis) ? characterTransformClipboard.bendAxis : "bottom"
    });
    if (characterState === "standing") propagatePartScaleFromStanding(selectedCharacterPart);
    renderCharacterTransforms();
    drawCharacterPreview();
    markDirty();
  };
  $("#partLayerOrder").onclick = event => {
    const row = event.target.closest("[data-layer-order-part]");
    if (!row) return;
    selectedCharacterPart = row.dataset.layerOrderPart;
    renderCharacterParts(); renderCharacterTransforms(); drawCharacterPreview();
  };
  $("#partLayerBack").onclick = () => moveCharacterPartLayer(selectedCharacterPart, -1);
  $("#partLayerForward").onclick = () => moveCharacterPartLayer(selectedCharacterPart, 1);
  $("#partLayerBottom").onclick = () => moveCharacterPartLayer(selectedCharacterPart, "bottom");
  $("#partLayerTop").onclick = () => moveCharacterPartLayer(selectedCharacterPart, "top");
  $("#partLockList").onchange = event => {
    const checkbox = event.target.closest("[data-lock-character-part]");
    if (!checkbox) return;
    pushCharacterUndo("Lock movement");
    const part = checkbox.dataset.lockCharacterPart;
    const locked = new Set(project.character.lockedParts || []);
    if (checkbox.checked) locked.add(part); else locked.delete(part);
    project.character.lockedParts = bodyParts.filter(item => locked.has(item));
    renderCharacterTransforms(); drawCharacterPreview(); markDirty();
  };
  $("#partRotateLeft").onclick = () => {
    pushCharacterUndo(`${prettyPart[selectedCharacterPart]} rotate`);
    const transform = currentCharacterTransform();
    if (!transform) return alert("Select a body layer first.");
    transform.rotation = (transform.rotation || 0) - 15;
    renderCharacterTransforms(); drawCharacterPreview(); markDirty();
  };
  $("#partRotateRight").onclick = () => {
    pushCharacterUndo(`${prettyPart[selectedCharacterPart]} rotate`);
    const transform = currentCharacterTransform();
    if (!transform) return alert("Select a body layer first.");
    transform.rotation = (transform.rotation || 0) + 15;
    renderCharacterTransforms(); drawCharacterPreview(); markDirty();
  };
  $("#partReset").onclick = () => {
    pushCharacterUndo(`${prettyPart[selectedCharacterPart]} reset`);
    const currentAssetId = currentCharacterTransform().assetId;
    const assetId = isLikelySourceSheetAsset(currentAssetId) ? null : currentAssetId;
    Object.assign(currentCharacterTransform(), characterDefaultPose(selectedCharacterPart, assetId));
    renderCharacterTransforms(); drawCharacterPreview(); markDirty();
  };
  ["characterWidth", "characterHeight"].forEach(id => {
    $(`#${id}`).onchange = event => {
      const key = id === "characterWidth" ? "width" : "height";
      project.character[key] = clamp(+event.target.value || project.character[key], 64, 1024);
      renderCharacterAnimator(); markDirty();
    };
  });
  characterCanvas.onpointerdown = event => {
    const point = characterCanvasPoint(event);
    const guide = characterGuideAt(point);
    if (guide) {
      pushCharacterUndo("Move guide line");
      selectedCharacterGuideId = guide.id;
      characterDrag = { mode: "guide", guideId: guide.id, axis: guide.axis };
      characterCanvas.setPointerCapture(event.pointerId);
      return;
    }
    if (!characterPointInsidePart(selectedCharacterPart, point)) return;
    pushCharacterUndo(`${prettyPart[selectedCharacterPart]} move`);
    const hit = selectedCharacterPart;
    const parts = lockedCharacterPartsFor(hit).map(part => {
      const transform = currentCharacterFrame().parts[part];
      return { part, x: transform.x, y: transform.y };
    });
    characterDrag = { mode: "parts", startX: point.x, startY: point.y, parts };
    characterCanvas.setPointerCapture(event.pointerId);
    renderCharacterParts(); renderCharacterTransforms(); drawCharacterPreview();
  };
  characterCanvas.onpointermove = event => {
    if (!characterDrag) return;
    const point = characterCanvasPoint(event);
    if (characterDrag.mode === "guide") {
      const guide = characterGuides().find(item => item.id === characterDrag.guideId);
      if (guide) guide.value = clamp(characterDrag.axis === "x" ? point.x : point.y, 0, characterDrag.axis === "x" ? project.character.width : project.character.height);
      drawCharacterPreview();
      return;
    }
    const dx = point.x - characterDrag.startX;
    const dy = point.y - characterDrag.startY;
    const frame = currentCharacterFrame();
    characterDrag.parts.forEach(item => {
      const transform = frame.parts[item.part];
      transform.x = clamp(item.x + dx, -project.character.width, project.character.width * 2);
      transform.y = clamp(item.y + dy, -project.character.height, project.character.height * 2);
    });
    renderCharacterTransforms(); drawCharacterPreview();
  };
  characterCanvas.onpointerup = () => {
    if (characterDrag) markDirty();
    characterDrag = null;
  };

  function characterAnimatorLoop(now) {
    if ($("#characterAnimator").classList.contains("active")) {
      if (characterPlaying && now - characterLastStep >= 1000 / animationFps()) {
        characterFrameIndex = playbackFrameIndexAt((playbackFrameIndexes().indexOf(characterFrameIndex) + 1 + playbackFrameIndexes().length) % playbackFrameIndexes().length);
        characterLastStep = now;
        renderCharacterTimeline();
        renderCharacterTransforms();
      }
      drawCharacterPreview();
    }
    requestAnimationFrame(characterAnimatorLoop);
  }

  $("#exportAnimationSheet").onclick = () => {
    const frames = playbackFrames();
    const sheet = document.createElement("canvas");
    sheet.width = project.character.width * frames.length;
    sheet.height = project.character.height;
    const ctx = sheet.getContext("2d");
    frames.forEach((frame, index) => paintCharacterFrame(ctx, frame, index * project.character.width, 0, false));
    sheet.toBlob(blob => {
      if (blob) downloadBlob(blob, `${safeProjectName()}-${characterState}-sheet.png`);
    }, "image/png");
  };

  $("#exportAnimationWebm").onclick = async () => {
    if (!window.MediaRecorder) return alert("This browser cannot export WebM animations.");
    const frames = playbackFrames();
    const canvas = document.createElement("canvas");
    canvas.width = project.character.width;
    canvas.height = project.character.height;
    const ctx = canvas.getContext("2d");
    const fps = animationFps();
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
    const finished = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.start();
    for (const frame of frames) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      paintCharacterFrame(ctx, frame, 0, 0, false);
      await new Promise(resolve => setTimeout(resolve, 1000 / fps));
    }
    recorder.stop();
    await finished;
    stream.getTracks().forEach(track => track.stop());
    if (!chunks.length) return alert("The WebM export did not produce data. Try the PNG sheet export instead.");
    downloadBlob(new Blob(chunks, { type: "video/webm" }), `${safeProjectName()}-${characterState}.webm`);
  };
  $("#exportAnimationGif").onclick = () => {
    const frames = playbackFrames().map(frame => {
      const canvas = document.createElement("canvas");
      canvas.width = project.character.width;
      canvas.height = project.character.height;
      const ctx = canvas.getContext("2d");
      paintCharacterFrame(ctx, frame, 0, 0, false);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    });
    const gif = encodeAnimatedGif(frames, project.character.width, project.character.height, animationFps());
    downloadBlob(gif, `${safeProjectName()}-${characterState}.gif`);
  };
  if ($("#saveCharacterBackup")) $("#saveCharacterBackup").onclick = async () => {
    if (!project.character) return alert("There is no character setup to save yet.");
    const backup = {
      type: "boltworks-character",
      version: 1,
      savedAt: new Date().toISOString(),
      projectName: project.name,
      character: project.character,
      rig: project.rig || {},
      assets: project.assets.filter(asset => assetInCategory(asset, "character") || asset.characterPart || asset.sourceAssetId)
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const savedName = await saveBlobAs(blob, `${safeProjectName("boltworks-character")}-character.boltchar`, ".boltchar", "BoltWorks character backup");
    if (savedName) alert(`Character backup saved: ${savedName}`);
  };

  if ($("#loadCharacterBackup")) $("#loadCharacterBackup").onclick = () => $("#characterBackupFile").click();
  if ($("#characterBackupFile")) $("#characterBackupFile").onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      const character = backup.character || backup;
      if (!character.animations) throw new Error("Missing character animations");
      pushCharacterUndo("Load character backup");
      const incomingAssets = Array.isArray(backup.assets) ? backup.assets : [];
      incomingAssets.forEach(asset => {
        if (!project.assets.some(existing => existing.id === asset.id)) project.assets.push({ ...asset, category: normalizeAssetCategory(asset) });
      });
      project.character = normalizeCharacter(character, backup.rig || project.rig || {});
      project.rig = { ...(project.rig || {}), ...(backup.rig || {}) };
      selectedCharacterPart = selectedCharacterPart || "torso";
      characterState = project.character.animations[characterState] ? characterState : "standing";
      characterFrameIndex = 0;
      rebuildImages();
      renderCharacterAnimator();
      renderRig();
      renderAssets();
      markDirty();
    } catch (error) {
      console.error(error);
      alert("That file is not a valid BoltWorks character backup.");
    }
    event.target.value = "";
  };

  function safeProjectName(fallback = "boltworks-project") {
    return (project.name || fallback).replace(/\W+/g, "-").replace(/^-|-$/g, "").toLowerCase() || fallback;
  }

  function sanitizeFilename(name, fallback, extension = "") {
    const clean = String(name || "").trim().replace(/[<>:"/\\|?*]+/g, "-").replace(/\s+/g, " ").replace(/^\.+|\.+$/g, "");
    let filename = clean || fallback;
    if (extension && !filename.toLowerCase().endsWith(extension.toLowerCase())) filename += extension;
    return filename;
  }

  function promptForFilename(defaultName, extension) {
    const picked = prompt("Save as filename:", defaultName);
    if (picked === null) return null;
    return sanitizeFilename(picked, defaultName, extension);
  }

  async function saveBlobAs(blob, defaultName, extension, description = "BoltWorks file") {
    const filename = sanitizeFilename(defaultName, defaultName, extension);
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description, accept: { [blob.type || "application/octet-stream"]: [extension || ".dat"] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return handle.name || filename;
      } catch (error) {
        if (error?.name === "AbortError") return null;
        console.warn("Save picker failed, falling back to download", error);
      }
    }
    const fallbackName = promptForFilename(filename, extension);
    if (!fallbackName) return null;
    downloadBlob(blob, fallbackName);
    return fallbackName;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function encodeAnimatedGif(frames, width, height, fps) {
    const bytes = [];
    const push = (...values) => bytes.push(...values);
    const word = value => push(value & 255, (value >> 8) & 255);
    const text = value => push(...[...value].map(char => char.charCodeAt(0)));
    text("GIF89a");
    word(width); word(height);
    push(0xf7, 0, 0);
    push(0, 0, 0);
    for (let index = 1; index < 256; index++) {
      const value = index - 1;
      push(
        Math.round(((value >> 5) & 7) * 255 / 7),
        Math.round(((value >> 2) & 7) * 255 / 7),
        Math.round((value & 3) * 255 / 3)
      );
    }
    push(0x21, 0xff, 0x0b); text("NETSCAPE2.0"); push(3, 1, 0, 0, 0);
    const delay = clamp(Math.round(100 / fps), 1, 65535);
    frames.forEach(frame => {
      push(0x21, 0xf9, 4, 9);
      word(delay);
      push(0, 0);
      push(0x2c);
      word(0); word(0); word(width); word(height); push(0);
      const indices = rgbaToGifIndices(frame.data);
      const compressed = gifLzw(indices);
      push(8);
      for (let offset = 0; offset < compressed.length; offset += 255) {
        const block = compressed.slice(offset, offset + 255);
        push(block.length, ...block);
      }
      push(0);
    });
    push(0x3b);
    return new Blob([new Uint8Array(bytes)], { type: "image/gif" });
  }

  function rgbaToGifIndices(data) {
    const indices = new Uint8Array(data.length / 4);
    for (let source = 0, target = 0; source < data.length; source += 4, target++) {
      if (data[source + 3] < 48) {
        indices[target] = 0;
      } else {
        let quantized = ((data[source] >> 5) << 5) | ((data[source + 1] >> 5) << 2) | (data[source + 2] >> 6);
        if (quantized > 254) quantized = 254;
        indices[target] = quantized + 1;
      }
    }
    return indices;
  }

  function gifLzw(indices) {
    const clearCode = 256;
    const endCode = 257;
    const output = [];
    let bitBuffer = 0;
    let bitCount = 0;
    const writeCode = code => {
      bitBuffer |= code << bitCount;
      bitCount += 9;
      while (bitCount >= 8) {
        output.push(bitBuffer & 255);
        bitBuffer >>= 8;
        bitCount -= 8;
      }
    };
    writeCode(clearCode);
    for (let index = 0; index < indices.length; index++) {
      writeCode(indices[index]);
      if ((index + 1) % 250 === 0 && index + 1 < indices.length) writeCode(clearCode);
    }
    writeCode(endCode);
    if (bitCount > 0) output.push(bitBuffer & 255);
    return output;
  }

  function selectedObject() {
    return project.objects.find(item => item.id === selectionId) || null;
  }

  function showObjectScriptEditor(editing = false) {
    const object = selectedObject();
    if (!object) return;
    const editor = $("#objectScriptEditor");
    editor.hidden = false;
    $("#scriptEditActions").hidden = false;
    editor.value = objectScriptText(object);
    editor.readOnly = !editing;
    $("#scriptStatus").textContent = editing ? "Editing real JavaScript for the selected object. Click Apply script to save it." : "Showing the selected object JavaScript.";
  }

  function refreshBusInspectorFields(o) {
    if (!o || o.type !== "bus") return;
    $("#busDelay").value = o.busDelay ?? 5;
    $("#busDuration").value = o.busDuration ?? 3;
    $("#busStartScale").value = Math.round((o.busStartScale ?? .59) * 100);
    $("#busEndScale").value = Math.round((o.busEndScale ?? 1) * 100);
    $("#busDriftX").value = o.busDriftX ?? 0;
    $("#busDriftY").value = o.busDriftY ?? 0;
    $("#busAnchor").value = o.busAnchor === "center" ? "center" : "bottom";
    renderBusScriptPreview(o);
  }
  $("#viewObjectScript").onclick = () => showObjectScriptEditor(false);
  $("#editObjectScript").onclick = () => showObjectScriptEditor(true);
  $("#applyObjectScript").onclick = () => {
    const object = selectedObject();
    if (!object) return;
    try {
      applyObjectScript(object, $("#objectScriptEditor").value);
      refreshBusInspectorFields(object);
      $("#objectScriptEditor").hidden = false;
      $("#scriptEditActions").hidden = false;
      $("#objectScriptEditor").readOnly = false;
      renderOutliner();
      markDirty();
      $("#scriptStatus").textContent = "Script applied.";
    } catch (error) {
      $("#scriptStatus").textContent = error.message || String(error);
    }
  };
  $("#copyObjectScript").onclick = async () => {
    const text = $("#objectScriptEditor").value || objectScriptText(selectedObject());
    try {
      await navigator.clipboard.writeText(text);
      $("#scriptStatus").textContent = "Copied script to clipboard.";
    } catch {
      $("#scriptStatus").textContent = "Could not copy automatically. Select the text and press Ctrl+C.";
    }
  };
  const generalFields = {
    objName: ["name", String], objX: ["x", Number], objY: ["y", Number], objW: ["w", Number], objH: ["h", Number],
    objLayer: ["layer", String], objRotation: ["rotation", Number], triggerAction: ["action", String], triggerPrompt: ["prompt", String],
    triggerDialogue: ["dialogue", String], triggerDuration: ["duration", Number], triggerReward: ["reward", Number], triggerTargetScene: ["targetSceneId", String], triggerTargetX: ["targetX", Number],
    busDelay: ["busDelay", Number], busDuration: ["busDuration", Number], busDriftX: ["busDriftX", Number], busDriftY: ["busDriftY", Number], busAnchor: ["busAnchor", String]
  };
  $("#busStartScale").addEventListener("input", event => {
    const o = project.objects.find(item => item.id === selectionId);
    if (!o) return;
    o.busStartScale = clamp(+event.target.value / 100, .05, 1.5);
    renderBusScriptPreview(o);
    markDirty();
  });
  $("#busEndScale").addEventListener("input", event => {
    const o = project.objects.find(item => item.id === selectionId);
    if (!o) return;
    o.busEndScale = clamp(+event.target.value / 100, .5, 3);
    renderBusScriptPreview(o);
    markDirty();
  });
  Object.entries(generalFields).forEach(([id, [key, cast]]) => {
    $(`#${id}`).addEventListener("input", event => {
      const o = project.objects.find(item => item.id === selectionId);
      if (!o) return;
      o[key] = cast(event.target.value);
      if (key === "layer") renderLayers();
      if (key === "rotation") $("#rotationValue").textContent = `${Math.round(o.rotation)} deg`;
      renderOutliner();
      markDirty();
    });
  });
  if ($("#objAlwaysOnTop")) $("#objAlwaysOnTop").onchange = event => {
    const o = project.objects.find(item => item.id === selectionId);
    if (o) { o.alwaysOnTop = event.target.checked; renderInspector(); renderOutliner(); markDirty(); }
  };
  if ($("#objLocked")) $("#objLocked").onchange = event => {
    const o = project.objects.find(item => item.id === selectionId);
    if (o) { o.locked = event.target.checked; renderInspector(); renderOutliner(); markDirty(); }
  };
  if ($("#objOpacity")) $("#objOpacity").oninput = event => {
    const o = project.objects.find(item => item.id === selectionId);
    if (!o) return;
    o.opacity = clamp(+event.target.value / 100, 0, 1);
    $("#objOpacityValue").textContent = `${Math.round(o.opacity * 100)}%`;
    markDirty();
  };
  if ($("#objBlendMode")) $("#objBlendMode").onchange = event => {
    const o = project.objects.find(item => item.id === selectionId);
    if (o) { o.blendMode = objectBlendMode({ blendMode: event.target.value }); renderInspector(); markDirty(); }
  };
  $("#objFlip").onchange = event => {
    const o = project.objects.find(item => item.id === selectionId); if (o) { o.flip = event.target.checked; markDirty(); }
  };
  function rotateSelected(delta) {
    const object = project.objects.find(item => item.id === selectionId);
    if (!object || object.type === "trigger") return;
    object.rotation = ((((object.rotation || 0) + delta) + 180) % 360 + 360) % 360 - 180;
    renderInspector(); markDirty();
  }
  $("#rotateLeft").onclick = () => rotateSelected(-90);
  $("#rotateRight").onclick = () => rotateSelected(90);
  $("#flipObject").onclick = () => {
    const object = project.objects.find(item => item.id === selectionId);
    if (!object || object.type === "trigger") return;
    object.flip = !object.flip;
    renderInspector(); markDirty();
  };
  $("#triggerBreak").oninput = event => {
    const o = project.objects.find(item => item.id === selectionId); if (o) { o.breakChance = +event.target.value; $("#breakValue").textContent = `${o.breakChance}%`; markDirty(); }
  };
  function objectStackGroupMatch(a, b) {
    if (!a || !b) return false;
    return (a.sceneId || project.activeSceneId) === (b.sceneId || project.activeSceneId)
      && a.layer === b.layer
      && !!a.alwaysOnTop === !!b.alwaysOnTop;
  }

  function moveSelectedObjectInStack(action) {
    const object = project.objects.find(item => item.id === selectionId);
    if (!object) return;
    const currentIndex = project.objects.findIndex(item => item.id === object.id);
    const groupIndices = project.objects
      .map((item, index) => ({ item, index }))
      .filter(entry => objectStackGroupMatch(entry.item, object))
      .map(entry => entry.index);
    const position = groupIndices.indexOf(currentIndex);
    if (position < 0) return;

    if (action === "back" || action === "forward") {
      const nextPosition = action === "back" ? Math.max(0, position - 1) : Math.min(groupIndices.length - 1, position + 1);
      const targetIndex = groupIndices[nextPosition];
      if (targetIndex === currentIndex || targetIndex == null) return;
      [project.objects[currentIndex], project.objects[targetIndex]] = [project.objects[targetIndex], project.objects[currentIndex]];
    } else {
      const withoutObject = project.objects.filter(item => item.id !== object.id);
      const matchingIndices = withoutObject
        .map((item, index) => objectStackGroupMatch(item, object) ? index : -1)
        .filter(index => index >= 0);
      if (action === "bottom") {
        withoutObject.splice(matchingIndices[0] ?? withoutObject.length, 0, object);
      } else if (action === "top") {
        const lastMatch = matchingIndices[matchingIndices.length - 1];
        withoutObject.splice(lastMatch == null ? withoutObject.length : lastMatch + 1, 0, object);
      }
      project.objects = withoutObject;
    }
    renderInspector();
    renderOutliner();
    markDirty();
  }

  if ($("#sendObjectBackward")) $("#sendObjectBackward").onclick = () => moveSelectedObjectInStack("back");
  if ($("#bringObjectForward")) $("#bringObjectForward").onclick = () => moveSelectedObjectInStack("forward");
  if ($("#sendObjectToBack")) $("#sendObjectToBack").onclick = () => moveSelectedObjectInStack("bottom");
  if ($("#bringObjectToFront")) $("#bringObjectToFront").onclick = () => moveSelectedObjectInStack("top");
  $("#deleteObject").onclick = () => {
    project.objects = project.objects.filter(o => o.id !== selectionId); selectionId = null; renderInspector(); renderOutliner(); markDirty();
  };
  $("#duplicateObject").onclick = () => {
    const o = project.objects.find(item => item.id === selectionId); if (!o) return;
    const copy = { ...o, id: uid(), name: `${o.name} copy`, x: o.x + 30, y: o.y + 20 };
    project.objects.push(copy); selectionId = copy.id; renderInspector(); renderOutliner(); markDirty();
  };


  if ($("#openCarBuilder")) $("#openCarBuilder").onclick = () => {
    if (!project.carModels.length) createCarModel();
    $("#carBuilder").classList.add("active");
    $("#carBuilder").setAttribute("aria-hidden", "false");
    renderCarBuilder();
  };
  if ($("#closeCarBuilder")) $("#closeCarBuilder").onclick = () => {
    $("#carBuilder").classList.remove("active");
    $("#carBuilder").setAttribute("aria-hidden", "true");
  };
  if ($("#newCarModel")) $("#newCarModel").onclick = createCarModel;
  if ($("#newCarModelFromTab")) $("#newCarModelFromTab").onclick = () => { createCarModel(); $("#openCarBuilder").click(); };
  if ($("#saveCarModel")) $("#saveCarModel").onclick = () => { project.carModels = normalizeCarModels(project.carModels || []); renderCarBuilder(); markDirty(); alert("Car model saved into this project."); };
  if ($("#placeCarModel")) $("#placeCarModel").onclick = () => {
    const model = selectedCarModel();
    if (!model) return alert("Create or select a car model first.");
    placingCarModelId = model.id;
    setTool("select");
    alert("Now click once in the scene where you want to place this car model.");
  };
  if ($("#carModelList")) $("#carModelList").onclick = event => {
    const row = event.target.closest("[data-car-model]");
    if (!row) return;
    selectedCarModelId = row.dataset.carModel;
    selectedCarPartId = null;
    renderCarModels();
    renderCarBuilder();
  };
  if ($("#carAssetSearch")) $("#carAssetSearch").oninput = event => { carAssetQuery = event.target.value || ""; renderCarAssetGrid(); };
  if ($("#carAssetGrid")) $("#carAssetGrid").onclick = event => {
    const card = event.target.closest("[data-asset]");
    if (!card) return;
    selectedAssetId = card.dataset.asset;
    renderAssets(); renderCarAssetGrid();
  };
  if ($("#addCarPart")) $("#addCarPart").onclick = addSelectedAssetAsCarPart;
  if ($("#assignCarPartAsset")) $("#assignCarPartAsset").onclick = () => {
    const part = selectedCarPart();
    if (!part) return alert("Select a car part first.");
    if (!selectedAssetId) return alert("Select an asset first.");
    part.assetId = selectedAssetId;
    const image = images.get(selectedAssetId);
    if (image?.naturalWidth && (!part.w || !part.h)) { part.w = image.naturalWidth; part.h = image.naturalHeight; }
    renderCarBuilder(); markDirty();
  };
  if ($("#duplicateCarPart")) $("#duplicateCarPart").onclick = () => {
    const model = selectedCarModel(); const part = selectedCarPart();
    if (!model || !part) return;
    const copy = normalizeCarPart({ ...part, id: uid(), name: `${part.name} copy`, x: part.x + 16, y: part.y + 16 }, model.parts.length);
    model.parts.push(copy); selectedCarPartId = copy.id; renderCarBuilder(); markDirty();
  };
  if ($("#deleteCarPart")) $("#deleteCarPart").onclick = () => {
    const model = selectedCarModel(); const part = selectedCarPart();
    if (!model || !part) return;
    model.parts = model.parts.filter(item => item.id !== part.id);
    selectedCarPartId = model.parts.at(-1)?.id || null;
    renderCarBuilder(); markDirty();
  };
  if ($("#carPartList")) $("#carPartList").onclick = event => {
    const row = event.target.closest("[data-car-part]");
    if (!row) return;
    selectedCarPartId = row.dataset.carPart;
    renderCarBuilder();
  };
  ["carModelName", "carModelWidth", "carModelHeight"].forEach(id => {
    const el = $(`#${id}`); if (!el) return;
    el.oninput = event => {
      const model = selectedCarModel(); if (!model) return;
      if (id === "carModelName") model.name = event.target.value || "Car model";
      if (id === "carModelWidth") model.width = clamp(+event.target.value || model.width, 64, 4000);
      if (id === "carModelHeight") model.height = clamp(+event.target.value || model.height, 64, 2400);
      renderCarModels(); drawCarBuilderPreview(); markDirty();
    };
  });
  const carPartFields = { carPartName: ["name", String], carPartX: ["x", Number], carPartY: ["y", Number], carPartW: ["w", Number], carPartH: ["h", Number], carPartTime: ["removalTime", Number], carPartBreakChance: ["breakChance", Number], carPartReward: ["reward", Number] };
  Object.entries(carPartFields).forEach(([id, [key, cast]]) => {
    const el = $(`#${id}`); if (!el) return;
    el.oninput = event => { const part = selectedCarPart(); if (!part) return; part[key] = key === "name" ? event.target.value : cast(event.target.value) || 0; renderCarPartList(); renderCarPartInspector(); drawCarBuilderPreview(); markDirty(); };
  });
  if ($("#carPartRotation")) $("#carPartRotation").oninput = event => { const part = selectedCarPart(); if (!part) return; part.rotation = +event.target.value || 0; renderCarPartInspector(); drawCarBuilderPreview(); markDirty(); };
  if ($("#carPartScale")) $("#carPartScale").oninput = event => { const part = selectedCarPart(); if (!part) return; part.scale = clamp((+event.target.value || 100) / 100, .05, 3); renderCarPartInspector(); drawCarBuilderPreview(); markDirty(); };
  if ($("#carPartFlip")) $("#carPartFlip").onchange = event => { const part = selectedCarPart(); if (!part) return; part.flip = event.target.checked; drawCarBuilderPreview(); markDirty(); };
  if ($("#carPartRemovable")) $("#carPartRemovable").onchange = event => { const part = selectedCarPart(); if (!part) return; part.removable = event.target.checked; renderCarPartList(); markDirty(); };
  if ($("#carPartTool")) $("#carPartTool").onchange = event => { const part = selectedCarPart(); if (!part) return; part.requiredTool = event.target.value; renderCarPartList(); markDirty(); };
  if ($("#carPartTimePreset")) $("#carPartTimePreset").onchange = event => { const part = selectedCarPart(); if (!part) return; part.removalTime = +event.target.value || 0; renderCarPartList(); renderCarPartInspector(); markDirty(); };
  function moveCarPart(delta) {
    const model = selectedCarModel(); const part = selectedCarPart(); if (!model || !part) return;
    const index = model.parts.findIndex(item => item.id === part.id);
    const next = clamp(index + delta, 0, model.parts.length - 1);
    if (next === index) return;
    model.parts.splice(index, 1); model.parts.splice(next, 0, part); renderCarBuilder(); markDirty();
  }
  if ($("#carPartBack")) $("#carPartBack").onclick = () => moveCarPart(-1);
  if ($("#carPartForward")) $("#carPartForward").onclick = () => moveCarPart(1);
  if ($("#carPartBottom")) $("#carPartBottom").onclick = () => { const model = selectedCarModel(); const part = selectedCarPart(); if (!model || !part) return; model.parts = [part, ...model.parts.filter(item => item.id !== part.id)]; renderCarBuilder(); markDirty(); };
  if ($("#carPartTop")) $("#carPartTop").onclick = () => { const model = selectedCarModel(); const part = selectedCarPart(); if (!model || !part) return; model.parts = [...model.parts.filter(item => item.id !== part.id), part]; renderCarBuilder(); markDirty(); };
  if ($("#carBuilderZoom")) $("#carBuilderZoom").oninput = event => setCarBuilderZoom((+event.target.value || 100) / 100);
  if ($("#carBuilderZoomOut")) $("#carBuilderZoomOut").onclick = () => setCarBuilderZoom(carBuilderZoom - .25);
  if ($("#carBuilderZoomIn")) $("#carBuilderZoomIn").onclick = () => setCarBuilderZoom(carBuilderZoom + .25);
  if ($("#carBuilderZoomReset")) $("#carBuilderZoomReset").onclick = () => setCarBuilderZoom(1);
  if (carBuilderCanvas) {
    carBuilderCanvas.onwheel = event => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setCarBuilderZoom(carBuilderZoom * (event.deltaY > 0 ? .9 : 1.1));
    };
    carBuilderCanvas.onpointerdown = event => {
      const model = selectedCarModel(); if (!model) return;
      const point = carBuilderCanvasPoint(event);
      const hit = model.parts.slice().reverse().find(part => carPointInsidePart(part, point));
      if (!hit) return;
      selectedCarPartId = hit.id;
      carPartDrag = { part: hit, dx: point.x - hit.x, dy: point.y - hit.y };
      carBuilderCanvas.setPointerCapture(event.pointerId);
      renderCarBuilder();
    };
    carBuilderCanvas.onpointermove = event => {
      if (!carPartDrag) return;
      const model = selectedCarModel(); const point = carBuilderCanvasPoint(event);
      carPartDrag.part.x = clamp(point.x - carPartDrag.dx, -model.width, model.width * 2);
      carPartDrag.part.y = clamp(point.y - carPartDrag.dy, -model.height, model.height * 2);
      renderCarPartInspector(); drawCarBuilderPreview();
    };
    carBuilderCanvas.onpointerup = () => { if (carPartDrag) markDirty(); carPartDrag = null; };
    carBuilderCanvas.onpointercancel = () => { carPartDrag = null; };
  }
  $("#newProject").onclick = () => {
    if (!confirm("Start a new project? Use Save Project first if you want to keep this version.")) return;
    project = normalizeProject(starterProject()); selectionId = null; cameraX = 0; rebuildAll(); markDirty();
  };
  function buildStandaloneGameHtml(projectData) {
    const gameData = JSON.stringify(projectData).replace(/<\/script/gi, "<\\/script");
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(projectData.name || "BoltWorks Game")}</title>
  <style>
    html, body { margin:0; height:100%; background:#070908; color:#f4e8c4; font-family:system-ui,Segoe UI,sans-serif; overflow:hidden; }
    #game { width:100vw; height:100vh; display:block; background:#10150f; image-rendering:auto; }
    .hud { position:fixed; left:14px; top:12px; display:flex; gap:14px; align-items:center; background:rgba(4,6,4,.65); border:1px solid rgba(255,209,90,.22); border-radius:10px; padding:8px 12px; backdrop-filter:blur(4px); }
    .hint { position:fixed; left:50%; bottom:18px; transform:translateX(-50%); background:rgba(4,6,4,.74); border:1px solid rgba(255,209,90,.24); border-radius:12px; padding:10px 14px; color:#e8d49b; }
    .dialogue { position:fixed; left:50%; bottom:76px; transform:translateX(-50%); max-width:min(760px, calc(100vw - 40px)); background:rgba(12,15,12,.92); border:1px solid #d9aa45; border-radius:14px; padding:16px 20px; color:#fff4cf; font-size:18px; box-shadow:0 12px 40px rgba(0,0,0,.45); display:none; }
    .mobile { position:fixed; inset:auto 0 0 0; display:none; justify-content:space-between; padding:22px; pointer-events:none; }
    .mobile button { pointer-events:auto; width:66px; height:66px; border-radius:50%; border:1px solid rgba(255,209,90,.38); background:rgba(17,22,16,.82); color:#ffd15a; font-size:26px; }
    @media (pointer:coarse) { .mobile { display:flex; } .hint { bottom:100px; } }
  </style>
</head>
<body>
  <canvas id="game"></canvas>
  <div class="hud"><strong>${escapeHtml(projectData.name || "BoltWorks Game")}</strong><span id="sceneName"></span><span id="clock">07:00</span></div>
  <div id="dialogue" class="dialogue"></div>
  <div class="hint">Move: A/D or arrows · Interact: E / Space / Enter · Crawl: C / Down</div>
  <div class="mobile"><div><button data-key="ArrowLeft">?</button><button data-key="ArrowRight">?</button></div><div><button data-key="KeyE">E</button></div></div>
  <script id="boltworks-data" type="application/json">${gameData}</script>
  <script>
(() => {
  const project = JSON.parse(document.getElementById("boltworks-data").textContent);
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const keys = new Set();
  const images = new Map();
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const bodyParts = ["backArm", "backLeg", "head", "torso", "frontLeg", "frontArm"];
  let activeSceneId = project.activeSceneId || project.scenes?.[0]?.id || "main";
  let cameraX = 0, last = performance.now(), elapsed = 0, dialogueUntil = 0, cash = 0;
  let player = { x: project.player?.spawnX || 120, y: 0, facing: 1, walking:false, crawling:false, knocked:false, hidden:false, fallAt:0 };
  const busState = new Map();
  const removedCarParts = new Map();
  let near = null, blockedBusId = null, blockStartedAt = 0, lastHornAt = -999, honkBusId = null, honkFlashUntil = 0;
  let particles = [];
  const loopingSounds = new Map();
  let audioUnlocked = false;
  const queuedSounds = [];

  function scene() { return project.scenes?.find(s => s.id === activeSceneId) || project.scenes?.[0] || { id:"main", name:"Scene" }; }
  function sceneObjects() { return (project.objects || []).filter(o => (o.sceneId || project.activeSceneId || activeSceneId) === activeSceneId && o.visible !== false); }
  function visibleLayers() { return (project.layers || []).filter(l => l.visible !== false); }
  function groundY() { return (project.world?.height || 720) - (project.world?.groundHeight || 150); }
  function assetImage(id) { return id ? images.get(id) : null; }
  function sceneArt(slot) { return project.sceneArt?.[slot] || {}; }
  function sceneArtImage(slot) { return assetImage(sceneArt(slot).assetId); }
  function objectBlendMode(o) { return ["source-over","multiply","screen","overlay","soft-light"].includes(o?.blendMode) ? o.blendMode : "source-over"; }
  function resize() { const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(innerWidth*dpr); canvas.height = Math.round(innerHeight*dpr); }
  addEventListener("resize", resize); resize();

  (project.assets || []).forEach(asset => { const img = new Image(); img.src = asset.src; images.set(asset.id, img); });
  function resolveAssetReference(nameOrId) {
    if (!nameOrId) return null;
    const wanted = String(nameOrId).toLowerCase();
    return (project.assets || []).find(a => a.id === nameOrId || String(a.name || "").toLowerCase() === wanted || String(a.name || "").toLowerCase().endsWith("/" + wanted))?.id || null;
  }
  const honkTextureId = resolveAssetReference("bus_driver_honk.png");
  (project.objects || []).forEach(o => { if (o.type === "bus" && honkTextureId) o.honkAssetId = honkTextureId; });

  addEventListener("keydown", e => { unlockAudio(); keys.add(e.code); if (["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault(); if (["Space","Enter","KeyE"].includes(e.code)) interact(); });
  addEventListener("keyup", e => keys.delete(e.code));
  addEventListener("pointerdown", unlockAudio, { once:false });
  document.querySelectorAll("[data-key]").forEach(btn => { btn.onpointerdown = () => { unlockAudio(); keys.add(btn.dataset.key); }; btn.onpointerup = btn.onpointercancel = () => keys.delete(btn.dataset.key); });

  function spawnPlayer() {
    const start = sceneObjects().find(o => o.type === "player_start_here" || o.type === "spawn");
    player.x = start ? start.x + start.w / 2 : project.player?.spawnX || 120;
    player.y = groundY();
    player.hidden = false; player.knocked = false; player.fallAt = 0;
  }
  spawnPlayer();
  sceneObjects().filter(o => o.type === "bus" && o.visible !== false).forEach(bus => playLoopingSound("bus-engine-" + bus.id, bus.engineSound || "soundAssets/bus_idle.mp3"));

  function playSound(path) {
    if (!path) return;
    const source = project.exportedSounds?.[path] || path;
    if (!audioUnlocked) { queuedSounds.push({ source, loop:false }); return; }
    try { const audio = new Audio(source); audio.volume = .65; audio.play().catch(() => {}); } catch {}
  }
  function playLoopingSound(key, path, volume = .45) {
    if (!path) return;
    const source = project.exportedSounds?.[path] || path;
    if (!audioUnlocked) { queuedSounds.push({ source, loop:true, key, volume }); return; }
    try {
      let audio = loopingSounds.get(key);
      if (!audio || audio.src !== source) {
        audio = new Audio(source);
        audio.loop = true;
        audio.volume = volume;
        loopingSounds.set(key, audio);
      }
      audio.play().catch(() => {});
    } catch {}
  }
  function unlockAudio() {
    audioUnlocked = true;
    while (queuedSounds.length) {
      const item = queuedSounds.shift();
      const source = typeof item === "string" ? item : item.source;
      try { const audio = new Audio(source); audio.loop = !!item.loop; audio.volume = item.volume || .65; if (item.key) loopingSounds.set(item.key, audio); audio.play().catch(() => {}); } catch {}
    }
  }
  function stateForBus(bus) { if (!busState.has(bus.id)) busState.set(bus.id, {}); return busState.get(bus.id); }
  function rawBusProgress(bus) { const st = stateForBus(bus); if (Number.isFinite(st.startedAt)) return (elapsed - st.startedAt) / Math.max(.1, Number(bus.busDuration) || 4); return (elapsed - (Number(bus.busDelay) || 5)) / Math.max(.1, Number(bus.busDuration) || 4); }
  function busProgress(bus) { const st = stateForBus(bus); return clamp(blockedBusId === bus.id && !st.runningOver ? 0 : rawBusProgress(bus), 0, 1); }
  function busVisualScale(bus) { const start = clamp(Number(bus.busStartScale) || .59, .05, 1.5); const end = clamp(Number(bus.busEndScale) || 1, .5, 3); return start + (end - start) * busProgress(bus); }
  function playerBlocksBus(bus) { const scale = busVisualScale(bus); const cx = bus.x + bus.w / 2 + (Number(bus.busDriftX) || 0) * busProgress(bus); const half = Math.max(55, bus.w * scale * .55); return player.x >= cx - half - 35 && player.x <= cx + half + 35; }
  function busBlocksPlayerAt(bus, x) { const st = stateForBus(bus); const moving = st.departed || Number.isFinite(st.startedAt) || rawBusProgress(bus) >= 0; if (!moving || busProgress(bus) >= 1) return false; return player.y >= bus.y - 20 && player.y <= bus.y + bus.h + 30 && x + 24 >= bus.x && x - 24 <= bus.x + bus.w; }
  function blockedByMovingBus(nextX, currentX) { return sceneObjects().some(o => { if (o.visible === false || o.type !== "bus") return false; if (!busBlocksPlayerAt(o, nextX)) return false; if (!busBlocksPlayerAt(o, currentX)) return true; const center = o.x + o.w / 2; return Math.abs(nextX - center) <= Math.abs(currentX - center); }); }
  function startBus(bus) { const st = stateForBus(bus); if (!st.departed) { st.departed = true; st.startedAt = elapsed; playLoopingSound("bus-engine-" + bus.id, bus.engineSound || "soundAssets/bus_idle.mp3"); spawnBusGust(bus, true); } }
  function forceBusRunOver(bus) { const st = stateForBus(bus); st.departed = true; st.runningOver = true; st.startedAt = elapsed; player.knocked = true; player.fallAt = elapsed; setTimeout(() => { player.hidden = true; }, 420); playLoopingSound("bus-engine-" + bus.id, bus.engineSound || "soundAssets/bus_idle.mp3"); spawnBusGust(bus, true); }
  function honk(bus) { honkBusId = bus.id; if (elapsed - lastHornAt >= 1.15) { if (honkTextureId) bus.honkAssetId = honkTextureId; honkFlashUntil = elapsed + .38; playSound(bus.honkSound || "soundAssets/bus_horn.mp3"); lastHornAt = elapsed; } }
  function updateBusHazards() {
    for (const bus of sceneObjects().filter(o => o.type === "bus" && o.visible !== false)) {
      const st = stateForBus(bus), progress = rawBusProgress(bus);
      if (st.departed || Number.isFinite(st.startedAt)) { startBus(bus); if (blockedBusId === bus.id) { blockedBusId = null; blockStartedAt = 0; honkBusId = null; } continue; }
      if (progress < 0) continue;
      if (!playerBlocksBus(bus)) { if (blockedBusId === bus.id) { blockedBusId = null; blockStartedAt = 0; honkBusId = null; } startBus(bus); continue; }
      if (progress >= 1 && blockedBusId !== bus.id) continue;
      if (blockedBusId !== bus.id) { blockedBusId = bus.id; blockStartedAt = elapsed; lastHornAt = -999; }
      honk(bus);
      if (elapsed - blockStartedAt >= (Number(bus.busRunOverAfter) || 7)) { blockedBusId = null; forceBusRunOver(bus); blockStartedAt = 0; honkBusId = null; setTimeout(() => goToScene("hospital", "You wake up at the hospital."), 900); }
      break;
    }
  }
  function spawnBusGust(bus, burst=false) { const scale = busVisualScale(bus), cx = bus.x + bus.w/2, bottom = bus.y + bus.h; for (const side of [-1, 1]) for (let i=0; i<(burst ? 14 : 3); i++) particles.push({ x: cx + side * bus.w * scale * .34 + side * 10, y: bottom - 12, vx: side * (35 + Math.random()*75), vy: -18 - Math.random()*45, age:0, life: burst ? .9 : .55, size: burst ? 16 + Math.random()*18 : 8 + Math.random()*12 }); if (particles.length > 180) particles.splice(0, particles.length - 180); }
  function updateParticles(dt) { sceneObjects().filter(o => o.type === "bus").forEach(bus => { const st = stateForBus(bus); if ((st.departed || Number.isFinite(st.startedAt)) && busProgress(bus) < 1 && Math.random() < dt * 12) spawnBusGust(bus); }); particles.forEach(p => { p.age += dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= Math.pow(.82, dt*8); p.vy += 38*dt; p.size += 10*dt; }); particles = particles.filter(p => p.age < p.life); }

  function drawSceneArtLayer(slot, layer, viewX, viewportW, fallback) {
    const art = sceneArt(slot), img = sceneArtImage(slot), gy = groundY();
    if (!img?.complete || !img.naturalWidth) { if (fallback) fallback(); return; }
    const drawHeight = art.height || (slot === "ground" ? (project.world?.groundHeight || 150) : img.naturalHeight);
    const scale = drawHeight / img.naturalHeight;
    const drawWidth = img.naturalWidth * scale;
    const y = slot === "ground" ? gy + (art.yOffset || 0) : slot === "background" ? (art.yOffset || 0) : gy - drawHeight + (art.yOffset || 0);
    if (art.mode === "tile") { const step = Math.max(1, drawWidth + (art.spacing || 0)); const start = Math.floor((viewX * (layer?.parallax || 0) - step) / step) * step; for (let x=start; x<start+viewportW+step*2; x+=step) ctx.drawImage(img, x, y, drawWidth, drawHeight); }
    else ctx.drawImage(img, slot === "background" ? viewX * (layer?.parallax || 0) : 0, y, slot === "background" ? viewportW : (project.world?.width || 5000), slot === "background" ? (project.world?.height || 720) : drawHeight);
  }
  function drawLayerBackdrop(layer, viewX, viewportW) {
    const gy = groundY();
    if (layer.id === "background") drawSceneArtLayer("background", layer, viewX, viewportW);
    if (layer.id === "far") drawSceneArtLayer("far", layer, viewX, viewportW, () => { ctx.fillStyle = layer.color || "#697463"; const start = Math.floor((viewX*layer.parallax-500)/600)*600; for (let x=start; x<start+viewportW+1400; x+=600) { ctx.beginPath(); ctx.moveTo(x,gy+10); ctx.lineTo(x+140,330); ctx.lineTo(x+310,gy+10); ctx.fill(); ctx.fillRect(x+380,360,80,gy-360); ctx.fillRect(x+455,430,100,gy-430); } });
    if (layer.id === "ground") { ctx.fillStyle = layer.color || "#696a52"; ctx.fillRect(0, gy, project.world.width, project.world.groundHeight || 150); drawSceneArtLayer("ground", layer, viewX, viewportW); }
    if (layer.id === "front") drawSceneArtLayer("front", layer, viewX, viewportW, () => { ctx.fillStyle="#252b21"; for(let x=Math.floor((viewX*layer.parallax-200)/430)*430; x<viewX+viewportW+900; x+=430){ctx.beginPath();ctx.moveTo(x,project.world.height);ctx.lineTo(x+24,635);ctx.lineTo(x+50,project.world.height);ctx.fill();} });
  }

  function carModelById(id) { return (project.carModels || []).find(m => m.id === id) || null; }
  function drawCarModel(model, x, y, w, h, removed) { if (!model) return; ctx.save(); ctx.translate(x,y); ctx.scale(w / Math.max(1, model.width || 1), h / Math.max(1, model.height || 1)); (model.parts || []).forEach(part => { if (removed?.has(part.id)) return; const img = assetImage(part.assetId); ctx.save(); ctx.translate(part.x + part.w/2, part.y + part.h/2); ctx.rotate((part.rotation||0)*Math.PI/180); const sc=Number(part.scale)||1; ctx.scale((part.flip?-1:1)*sc, sc); if (img?.complete && img.naturalWidth) ctx.drawImage(img, -part.w/2, -part.h/2, part.w, part.h); else { ctx.fillStyle = part.removable ? "rgba(184,138,50,.55)" : "rgba(80,92,84,.65)"; ctx.fillRect(-part.w/2,-part.h/2,part.w,part.h); } ctx.restore(); }); ctx.restore(); }
  function drawObject(o) {
    if (o.type === "trigger" || o.type === "player_start_here" || o.type === "spawn") return;
    ctx.save(); ctx.globalAlpha = clamp(Number(o.opacity ?? 1),0,1); ctx.globalCompositeOperation = objectBlendMode(o); ctx.translate(o.x + o.w/2, o.y + o.h/2); ctx.rotate((o.rotation||0)*Math.PI/180); ctx.scale(o.flip?-1:1,1); ctx.translate(-o.w/2,-o.h/2);
    if (o.type === "car_model") { drawCarModel(carModelById(o.carModelId), 0, 0, o.w, o.h, removedCarParts.get(o.id)); ctx.restore(); return; }
    if (o.type === "bus") { const p = busProgress(o), sc = busVisualScale(o), anchorY = o.busAnchor === "center" ? o.h/2 : o.h; if (p >= 1) { ctx.restore(); return; } ctx.translate(o.w/2 + (Number(o.busDriftX)||0)*p, anchorY + (Number(o.busDriftY)||0)*p); ctx.scale(sc, sc); ctx.translate(-o.w/2, -anchorY); }
    const honkImg = o.type === "bus" && honkBusId === o.id && elapsed <= honkFlashUntil && o.honkAssetId ? assetImage(o.honkAssetId) : null;
    const img = honkImg || assetImage(o.assetId) || (o.type === "bus" ? sceneArtImage("bus") : o.type === "bus-stop" ? sceneArtImage("busStop") : null);
    if (img?.complete && img.naturalWidth) ctx.drawImage(img,0,0,o.w,o.h);
    else { ctx.fillStyle = o.type === "bus" ? "#b88a32" : o.type === "npc" ? "#59634e" : o.type === "gate" ? "#464c43" : "#697463"; ctx.fillRect(0,0,o.w,o.h); if (o.type === "npc") { ctx.fillStyle="#a88c70"; ctx.beginPath(); ctx.arc(o.w*.5,o.h*.16,o.w*.2,0,Math.PI*2); ctx.fill(); } }
    ctx.restore();
  }

  function partSize(part, t) { const img = assetImage(t?.assetId); return img?.naturalWidth ? { w: img.naturalWidth*(t.scale||1), h: img.naturalHeight*(t.scale||1) } : { w: part === "head" ? 54 : part.includes("Leg") ? 22 : 42, h: part === "head" ? 54 : part.includes("Leg") ? 90 : 80 }; }
  function partAnchor(part, s) { return part === "head" || part === "torso" ? { x:-s.w/2, y:-s.h/2 } : { x:-s.w/2, y:0 }; }
  function drawPlayer() {
    if (player.hidden) return;
    const character = project.character; if (!character) return;
    const anim = player.crawling ? "crawling" : player.walking ? "walking" : "standing";
    const frames = character.animations?.[anim] || character.animations?.standing || [];
    const frame = frames[Math.floor(elapsed * (character.animationFps?.[anim] || character.fps || 8)) % Math.max(1, frames.length)]; if (!frame) return;
    ctx.save(); ctx.translate(player.x, player.y); if (player.knocked) { const fall = clamp((elapsed - player.fallAt) / .45, 0, 1); ctx.rotate(-Math.PI/2*fall); ctx.translate(-character.height*.18*fall, -character.height*.22*fall); } const characterScale = .62; ctx.scale(characterScale * (player.facing < 0 ? -1 : 1), characterScale); ctx.translate(-character.width/2, -character.height + 22);
    (character.partOrder || bodyParts).forEach(part => { const t = frame.parts?.[part]; if (!t) return; const img = assetImage(t.assetId); const s = partSize(part,t); const a = partAnchor(part,s); ctx.save(); ctx.translate(t.x||0,t.y||0); ctx.rotate((t.rotation||0)*Math.PI/180); ctx.scale(t.flip?-1:1,1); if (img?.complete && img.naturalWidth) ctx.drawImage(img,a.x,a.y,s.w,s.h); else { ctx.fillStyle = part === "head" ? "#bd9272" : "#365f56"; ctx.fillRect(a.x,a.y,s.w,s.h); } ctx.restore(); });
    ctx.restore();
  }

  function showDialogue(text) { const box=document.getElementById("dialogue"); box.textContent=text; box.style.display="block"; dialogueUntil=elapsed+4; }
  function goToScene(sceneNameOrId, text) { loopingSounds.forEach(audio => { audio.pause(); audio.currentTime = 0; }); const wanted = String(sceneNameOrId || "").toLowerCase(); const target = (project.scenes || []).find(s => s.id === sceneNameOrId || String(s.name || "").toLowerCase() === wanted) || scene(); activeSceneId = target.id; blockedBusId = null; honkBusId = null; blockStartedAt = 0; spawnPlayer(); sceneObjects().filter(o => o.type === "bus" && o.visible !== false).forEach(bus => playLoopingSound("bus-engine-" + bus.id, bus.engineSound || "soundAssets/bus_idle.mp3")); if (text) showDialogue(text); }
  function nextRemovableCarPart(o) { const model = carModelById(o.carModelId); if (!model) return null; const removed = removedCarParts.get(o.id) || new Set(); return (model.parts || []).find(p => p.removable && !removed.has(p.id)) || null; }
  function findNear() { const trigger = sceneObjects().filter(o => o.type === "trigger").find(o => player.x >= o.x - 45 && player.x <= o.x + o.w + 45); const car = sceneObjects().filter(o => o.type === "car_model").find(o => player.x >= o.x - 55 && player.x <= o.x + o.w + 55 && nextRemovableCarPart(o)); near = trigger || car || null; }
  function interact() {
    findNear();
    if (!near) { const hit = sceneObjects().find(o => Math.abs((o.x+o.w/2)-player.x) < Math.max(80,o.w/2+30) && Math.abs((o.y+o.h/2)-player.y) < Math.max(120,o.h)); if (hit?.dialogue) showDialogue(hit.dialogue); return; }
    if (near.type === "car_model") { const part = nextRemovableCarPart(near); if (!part) return; const removed = removedCarParts.get(near.id) || new Set(); removed.add(part.id); removedCarParts.set(near.id, removed); const broken = Math.random()*100 < (part.breakChance || 0); if (!broken) cash += part.reward || part.pay || 0; showDialogue("You remove " + (part.name || "part") + ". " + (broken ? "It broke while coming loose." : "It came out clean.")); return; }
    if (near.action === "travel" && near.targetSceneId) goToScene(near.targetSceneId, near.dialogue || "You enter " + scene().name + ".");
    else showDialogue(near.dialogue || near.prompt || "Interaction complete.");
  }

  function update(dt) {
    const left = keys.has("ArrowLeft") || keys.has("KeyA"), right = keys.has("ArrowRight") || keys.has("KeyD");
    const dir = player.knocked ? 0 : right - left; player.walking = !!dir; if (dir) player.facing = dir;
    player.crawling = keys.has("ArrowDown") || keys.has("KeyC") || keys.has("ControlLeft");
    const nextX = clamp(player.x + dir * (player.crawling ? project.player.crawlSpeed || 95 : project.player.walkSpeed || 165) * dt, 0, project.world.width || 5000);
    if (!blockedByMovingBus(nextX, player.x)) player.x = nextX; else player.walking = false;
    updateBusHazards(); updateParticles(dt); findNear();
    cameraX = clamp(player.x - innerWidth*.45, 0, Math.max(0, (project.world.width || 5000) - innerWidth));
    if (dialogueUntil && elapsed > dialogueUntil) document.getElementById("dialogue").style.display="none";
  }
  function draw() {
    const scale = canvas.height / (project.world.height || 720); const viewportW = canvas.width / scale;
    ctx.clearRect(0,0,canvas.width,canvas.height); ctx.save(); ctx.scale(scale,scale);
    const sky = ctx.createLinearGradient(0,0,0,project.world.height||720); sky.addColorStop(0,"#7d918e"); sky.addColorStop(.7,"#b3aa8b"); sky.addColorStop(1,"#76705a"); ctx.fillStyle=sky; ctx.fillRect(0,0,viewportW,project.world.height||720);
    for (const layer of visibleLayers()) { ctx.save(); const off = cameraX*(layer.parallax||1); ctx.translate(-off,0); drawLayerBackdrop(layer,cameraX,viewportW); sceneObjects().filter(o => o.layer === layer.id && !o.alwaysOnTop).forEach(drawObject); ctx.restore(); }
    for (const layer of visibleLayers()) { ctx.save(); const off = cameraX*(layer.parallax||1); ctx.translate(-off,0); sceneObjects().filter(o => o.layer === layer.id && o.alwaysOnTop).forEach(drawObject); ctx.restore(); }
    ctx.save(); ctx.translate(-cameraX,0); particles.forEach(p => { const t=clamp(p.age/p.life,0,1); ctx.globalAlpha=(1-t)*.42; ctx.fillStyle="#d8c99e"; ctx.beginPath(); ctx.ellipse(p.x,p.y,p.size*(1+t),p.size*.45,0,0,Math.PI*2); ctx.fill(); }); drawPlayer(); ctx.restore(); ctx.restore();
    document.getElementById("sceneName").textContent = (scene().name || "Scene") + (near ? " · E: " + (near.prompt || near.name || "Interact") : "");
    const minutes = Math.floor(7*60 + elapsed*8); document.getElementById("clock").textContent = String(Math.floor(minutes/60)%24).padStart(2,"0") + ":" + String(minutes%60).padStart(2,"0") + "  $" + cash;
  }
  function loop(now){ const dt=Math.min(.04,(now-last)/1000||0); last=now; elapsed+=dt; update(dt); draw(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
})();
  <\/script>
</body>
</html>`;
  }



  const builtinStandaloneSounds = {
    "soundAssets/bus_horn.mp3": "data:audio/mpeg;base64,//vQRAAIpNZkMRGJRsKj7JYRMwyW2iWg8tWMAAtWMl2WsYAAAEuD0+UqzwzJAnmw7kgplYxJw6i4MAwDMiFEiD+OhPMDArnRqrPF7ELL0StYvgreGNY3AlKxNGYfggRpKtOnUovYRqXWZ8modLEo+ToLnUUZRwoLomXue42fPH2Eai9f//3Sr22JwmgLljwkC5whJjxskR7FpzcJwv//////mJZWNPdHiRggg2BgCALxR0urHGHpMbwo48DgrFwEs7HE+xu2eitCdHp8ah+IZAMS0aqjEdnMZo48OU9TPlqik0jikbfRu7Gk5UYhY6PjO4Ylcolcxd5sELTr6yF151515SjNEA3UPuRxRqET7l6XzZ23f16bZ9iGCFMVRKGwMBHMG6X74oo0Ubj7kbixu3f398cT7i9IhnSAofpszMz30uxCmMSiP5MX0v38++5el6QtRKF9NzZmZnr02BajLZ43TAAhAlywi7C1CkHgbUAtAW0dTONj1KMEOBlkmN4K+pmIBGQRqYGEWEdF3nUVsTEUEeF12Rlny+citWF4JWNbZg/rjwAy+X08rvrzLTsOQAPnK2VqbxfPVI8ZeBakYsfn3////W7klgp333hcUduSQS4SARi0JXfF88MJROpeMEpLH7/////99wwzcN37ffmGULEU3cefiEU3AbrwxJH8lmH///////////////////9yWZf///8fd1MOf//AbE5bWnIbn8+15h+6mPfm4frP5A8OAISn4bJHbh+YgWg0GMBpQNhfJZskgfqGiByQMnCDtJXkjhVWm5zLBUJrOhaweN2/qPozhTBEdCYjhDjoJiPknOrMJHtLkeF1i9hgAW0AABI7AIRh/7jc1DSgDXGIR2XytPcxhSAmIixONMMhEbkiEta8bt/r/////+YkFPdjdvv/nAaK7QKmFVh795xOXsDYmlWj/R597////+EQdyAHEw5//uG4phhz912lrriLX5/P/wmFMEF2JyP8/qNIXRGrH//7zibOGuTmv//////+IRFx6KV21VA4XBWWxCKwZGiEQAALrvyseDBc+b1ikdAosACwI86UiaMjVtRREYEGlyI2F9RCcNSEQAVwFo4oMf/70kQcgAZ/ZkZuamAAyywovc1EABlg9ym57QADKCJkaz2gAGQQM2cZsLPhs4gGRhMB0hEyMGmPgrilAcMoEEFv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sJROuiodpwnONr//glDuPf/onAPAnFJs0AMNV/nnTIcRUNI0jwSzxW5G7a29vXdXJYVi9QtKE5iekyM430MVbI5rJpEpJici//vSZN2Ix9lqMSn4fVKQjQZQJSuuXeWofkY/NMmEsdHIFJcsrWbRlabxgnyhiraHKK+YW5qY2Rbb1gyQpeYYFIA0bFjuJF480lPZDiOBpkNblS9QgIzjzRsML0U3MqA0xRJgmHUJak+VvPmX5WZVDLxQVE4xP3u1pmaoKexb53mVXOzWu4X+Zb7Yn5A9zTUigYGISB1IEilvEz1PPnJqOxhny/Zlz+sqXiwlwH7k1Hh25dr2LdFIn5Z0nKjsrMudxIvOV49BsEQVH5ivUqzUdgqDInGIvJn6Zyrcoao2ziXzl9VUKUR+RkZl/////EEkl2HstISxUqovDanCf95sZKrJLw/isqklOGuaQkRU6gbz1aSdwnn/yVX/sZKlkl2HstK1aaU4bkorVOD2URCIgdCw4LjnZ/9FRFb////2cpho0EzOLUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=",
    "soundAssets/bus_idle.mp3": "data:audio/mpeg;base64,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AAgAAA0g4AABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
  };
  async function blobToDataUrl(blob) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function collectStandaloneSounds(exportProject) {
    const sounds = { ...builtinStandaloneSounds };
    const soundPaths = new Set(["soundAssets/bus_horn.mp3", "soundAssets/bus_idle.mp3"]);
    (exportProject.objects || []).forEach(object => {
      if (object.honkSound) soundPaths.add(object.honkSound);
      if (object.engineSound) soundPaths.add(object.engineSound);
    });
    for (const soundPath of soundPaths) {
      if (!String(soundPath).startsWith("soundAssets/")) continue;
      try {
        const response = await fetch(soundPath);
        if (!response.ok) continue;
        sounds[soundPath] = await blobToDataUrl(await response.blob());
      } catch (error) {
        console.warn("Could not embed standalone sound", soundPath, error);
      }
    }
    return sounds;
  }

  async function exportStandaloneGame() {
    project.updatedAt = Date.now();
    const exportProject = normalizeProject(JSON.parse(JSON.stringify(project)));
    exportProject.exportedSounds = await collectStandaloneSounds(exportProject);
    const html = buildStandaloneGameHtml(exportProject);
    const filename = "index.html";
    if (window.showDirectoryPicker) {
      try {
        const dir = await window.showDirectoryPicker({ mode: "readwrite" });
        const file = await dir.getFileHandle(filename, { create: true });
        const writable = await file.createWritable();
        await writable.write(new Blob([html], { type: "text/html" }));
        await writable.close();
        const soundPaths = new Set(["soundAssets/bus_horn.mp3", "soundAssets/bus_idle.mp3"]);
        (exportProject.objects || []).forEach(object => {
          if (object.honkSound) soundPaths.add(object.honkSound);
          if (object.engineSound) soundPaths.add(object.engineSound);
        });
        for (const soundPath of soundPaths) {
          if (!String(soundPath).startsWith("soundAssets/")) continue;
          try {
            const response = await fetch(soundPath);
            if (!response.ok) continue;
            const soundDir = await dir.getDirectoryHandle("soundAssets", { create: true });
            const soundFile = await soundDir.getFileHandle(String(soundPath).split("/").pop(), { create: true });
            const soundWritable = await soundFile.createWritable();
            await soundWritable.write(await response.blob());
            await soundWritable.close();
          } catch (error) {
            console.warn("Could not copy sound into exported game", soundPath, error);
          }
        }
        $("#saveState").textContent = `Standalone game exported to folder as ${filename}`;
        alert("Standalone game exported. Open index.html inside the folder to test it.");
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.warn("Folder export failed, falling back to single-file download", error);
      }
    }
    const blob = new Blob([html], { type: "text/html" });
    const savedName = await saveBlobAs(blob, `${safeProjectName("boltworks-game")}-game.html`, ".html", "Standalone HTML game");
    if (savedName) $("#saveState").textContent = `Standalone game exported: ${savedName}`;
  }
  $("#exportProject").onclick = async () => {
    project.updatedAt = Date.now();
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const savedName = await saveBlobAs(blob, `${safeProjectName("boltworks-project")}.boltworks`, ".boltworks", "BoltWorks Studio project");
    if (savedName) $("#saveState").textContent = `Project file saved: ${savedName}`;
  };
  if ($("#exportGame")) $("#exportGame").onclick = exportStandaloneGame;
  $("#importProject").onclick = () => $("#projectFile").click();
  $("#projectFile").onchange = async event => {
    try {
      project = normalizeProject(JSON.parse(await event.target.files[0].text()));
      selectionId = null; cameraX = 0; characterFrameIndex = 0; characterState = "standing";
      rebuildAll(); markDirty();
    }
    catch { alert("That file is not a valid BoltWorks Studio project."); }
    event.target.value = "";
  };


  function createCarModel() {
    const model = normalizeCarModel({ name: `Car model ${project.carModels.length + 1}`, width: 640, height: 360, parts: [] }, project.carModels.length);
    project.carModels.push(model);
    selectedCarModelId = model.id;
    selectedCarPartId = null;
    renderCarModels();
    renderCarBuilder();
    markDirty();
    return model;
  }

  function renderCarModels() {
    if (!$("#carModelList")) return;
    project.carModels = normalizeCarModels(project.carModels || []);
    if (!selectedCarModelId && project.carModels.length) selectedCarModelId = project.carModels[0].id;
    $("#carModelList").innerHTML = project.carModels.length ? project.carModels.map(model => {
      const removable = model.parts.filter(part => part.removable).length;
      return `<div class="outliner-item ${model.id === selectedCarModelId ? "selected" : ""}" data-car-model="${model.id}">
        <button class="outliner-visibility" title="Select model">car</button>
        <div><strong>${escapeHtml(model.name)}</strong><span>${model.parts.length} layers - ${removable} removable</span></div>
      </div>`;
    }).join("") : `<p class="hint">No car models yet. Open the builder and create one.</p>`;
  }

  function renderCarAssetGrid() {
    if (!$("#carAssetGrid")) return;
    const query = carAssetQuery.toLowerCase();
    const assets = project.assets.filter(asset => assetInCategory(asset, "part") && asset.name.toLowerCase().includes(query));
    $("#carAssetGrid").innerHTML = assets.length ? assets.map(asset => `
      <div class="character-asset ${asset.id === selectedAssetId ? "selected" : ""}" data-asset="${asset.id}">
        <img src="${asset.src}" alt=""><span>${escapeHtml(asset.name)}</span>
      </div>`).join("") : `<p class="hint">No matching assets.</p>`;
  }

  function renderCarPartList() {
    if (!$("#carPartList")) return;
    const model = selectedCarModel();
    if (!model) { $("#carPartList").innerHTML = `<p class="hint">Create a model first.</p>`; return; }
    $("#carPartList").innerHTML = model.parts.length ? model.parts.map((part, index) => {
      const asset = project.assets.find(a => a.id === part.assetId);
      const tool = part.requiredTool === "none" ? "no tool" : part.requiredTool.replace("_", " ");
      return `<div class="animator-part ${part.id === selectedCarPartId ? "selected" : ""}" data-car-part="${part.id}">
        <span>${index + 1}</span>
        <div><strong>${escapeHtml(part.name)}</strong><small>${asset ? escapeHtml(asset.name) : "placeholder"} - ${part.removable ? `${tool}, ${part.removalTime}s` : "fixed"}</small></div>
      </div>`;
    }).join("") : `<p class="hint">No parts yet. Select an asset, then add it as a part.</p>`;
  }

  function setCarBuilderZoom(value) {
    carBuilderZoom = clamp(Number(value) || 1, .5, 8);
    if ($("#carBuilderZoom")) $("#carBuilderZoom").value = Math.round(carBuilderZoom * 100);
    if ($("#carBuilderZoomValue")) $("#carBuilderZoomValue").textContent = `${Math.round(carBuilderZoom * 100)}%`;
    if (carBuilderCanvas) {
      carBuilderCanvas.style.width = `${Math.round(carBuilderCanvas.width * carBuilderZoom)}px`;
      carBuilderCanvas.style.height = `${Math.round(carBuilderCanvas.height * carBuilderZoom)}px`;
    }
  }

  function drawCarBuilderPreview() {
    if (!carBuilderCtx || !carBuilderCanvas) return;
    setCarBuilderZoom(carBuilderZoom);
    const model = selectedCarModel();
    const ctx = carBuilderCtx;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, carBuilderCanvas.width, carBuilderCanvas.height);
    ctx.fillStyle = "#172019";
    ctx.fillRect(0, 0, carBuilderCanvas.width, carBuilderCanvas.height);
    const cell = 16;
    for (let y = 0; y < carBuilderCanvas.height; y += cell) for (let x = 0; x < carBuilderCanvas.width; x += cell) {
      ctx.fillStyle = ((x / cell + y / cell) % 2) ? "#202a22" : "#263127";
      ctx.fillRect(x, y, cell, cell);
    }
    if (!model) {
      ctx.fillStyle = "#c7d0bc"; ctx.font = "18px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Create a car model to start", carBuilderCanvas.width / 2, carBuilderCanvas.height / 2);
      return;
    }
    const scale = Math.min(carBuilderCanvas.width / model.width, carBuilderCanvas.height / model.height) * .92;
    const drawW = model.width * scale, drawH = model.height * scale;
    const x = (carBuilderCanvas.width - drawW) / 2;
    const y = (carBuilderCanvas.height - drawH) / 2;
    ctx.strokeStyle = "rgba(245,217,149,.35)";
    ctx.strokeRect(x, y, drawW, drawH);
    drawCarModel(ctx, model, x, y, drawW, drawH, { showSelection: true });
  }

  function renderCarPartInspector() {
    const model = selectedCarModel();
    const part = selectedCarPart();
    if ($("#carModelName")) {
      $("#carModelName").value = model?.name || "";
      $("#carModelWidth").value = model?.width || 640;
      $("#carModelHeight").value = model?.height || 360;
    }
    const disabled = !part;
    ["carPartName", "carPartX", "carPartY", "carPartW", "carPartH", "carPartRotation", "carPartScale", "carPartFlip", "carPartRemovable", "carPartTool", "carPartTimePreset", "carPartTime", "carPartBreakChance", "carPartReward"].forEach(id => { const el = $(`#${id}`); if (el) el.disabled = disabled; });
    $("#selectedCarPartName").textContent = part ? part.name : "No part selected";
    if (!part) return;
    $("#carPartName").value = part.name;
    $("#carPartX").value = Math.round(part.x);
    $("#carPartY").value = Math.round(part.y);
    $("#carPartW").value = Math.round(part.w);
    $("#carPartH").value = Math.round(part.h);
    $("#carPartRotation").value = part.rotation || 0;
    $("#carPartRotationValue").textContent = `${Math.round(part.rotation || 0)} deg`;
    $("#carPartScale").value = Math.round((part.scale || 1) * 100);
    $("#carPartScaleValue").textContent = `${Math.round((part.scale || 1) * 100)}%`;
    $("#carPartFlip").checked = !!part.flip;
    $("#carPartRemovable").checked = !!part.removable;
    $("#carPartTool").value = part.requiredTool || "none";
    $("#carPartTimePreset").value = ["10", "30", "60", "120", "300"].includes(String(part.removalTime)) ? String(part.removalTime) : "30";
    $("#carPartTime").value = part.removalTime || 0;
    $("#carPartBreakChance").value = part.breakChance || 0;
    $("#carPartReward").value = part.reward || 0;
  }

  function renderCarBuilder() {
    renderCarModels();
    renderCarAssetGrid();
    renderCarPartList();
    renderCarPartInspector();
    drawCarBuilderPreview();
  }

  function carBuilderCanvasPoint(event) {
    const rect = carBuilderCanvas.getBoundingClientRect();
    const model = selectedCarModel();
    if (!model) return { x: 0, y: 0 };
    const scale = Math.min(carBuilderCanvas.width / model.width, carBuilderCanvas.height / model.height) * .92;
    const drawW = model.width * scale, drawH = model.height * scale;
    const ox = (carBuilderCanvas.width - drawW) / 2;
    const oy = (carBuilderCanvas.height - drawH) / 2;
    return { x: (event.clientX - rect.left - ox) / scale, y: (event.clientY - rect.top - oy) / scale };
  }

  function carPointInsidePart(part, point) {
    const scale = Number(part.scale) || 1;
    const cx = part.x + part.w / 2, cy = part.y + part.h / 2;
    const angle = (part.rotation || 0) * Math.PI / 180;
    const dx = point.x - cx, dy = point.y - cy;
    const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
    const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
    return Math.abs(localX) <= part.w * scale / 2 && Math.abs(localY) <= part.h * scale / 2;
  }

  function addSelectedAssetAsCarPart() {
    const model = selectedCarModel() || createCarModel();
    if (!selectedAssetId) return alert("Select an asset first in the car builder asset picker or Asset library.");
    const asset = project.assets.find(a => a.id === selectedAssetId);
    const image = images.get(selectedAssetId);
    const naturalW = image?.naturalWidth || 140;
    const naturalH = image?.naturalHeight || 90;
    const maxW = Math.min(naturalW, model.width * .75);
    const ratio = naturalW / Math.max(1, naturalH);
    const part = normalizeCarPart({
      name: asset?.name?.replace(/\.[^.]+$/, "") || `Part ${model.parts.length + 1}`,
      assetId: selectedAssetId,
      x: model.width / 2 - maxW / 2,
      y: model.height / 2 - maxW / ratio / 2,
      w: maxW,
      h: maxW / ratio,
      removable: true,
      requiredTool: "wrench",
      removalTime: 30
    }, model.parts.length);
    model.parts.push(part);
    selectedCarPartId = part.id;
    renderCarBuilder();
    markDirty();
  }

  function placeSelectedCarModelAt(point) {
    const model = carModelById(placingCarModelId || selectedCarModelId);
    if (!model) return;
    const defaultW = Math.min(model.width, 420);
    const defaultH = defaultW * model.height / Math.max(1, model.width);
    const object = { id: uid(), type: "car_model", name: model.name, carModelId: model.id, sceneId: project.activeSceneId, x: clamp(point.x - defaultW / 2, 0, project.world.width - defaultW), y: point.y - defaultH / 2, w: defaultW, h: defaultH, layer: project.activeLayer, flip: false, rotation: 0 };
    project.objects.push(object);
    selectionId = object.id;
    placingCarModelId = null;
    renderInspector(); renderOutliner(); renderCarModels(); markDirty();
  }
  function rebuildAll() {
    project.character = normalizeCharacter(project.character, project.rig);
    rebuildImages(); renderScenes(); renderLayers(); renderAssets(); renderSceneArtControls(); renderRig(); renderInspector(); renderOutliner(); renderCarModels();
    $("#worldWidth").value = project.world.width; $("#groundHeight").value = project.world.groundHeight;
    $("#walkSpeed").value = project.player.walkSpeed; $("#crawlSpeed").value = project.player.crawlSpeed; updateLabels();
    if ($("#characterAnimator").classList.contains("active")) renderCharacterAnimator();
    if ($("#carBuilder")?.classList.contains("active")) renderCarBuilder();
  }

  window.addEventListener("keydown", event => {
    keys[event.code] = true;
    if (!playing && (event.ctrlKey || event.metaKey) && event.code === "KeyZ" && $("#characterAnimator").classList.contains("active")) {
      event.preventDefault();
      undoCharacterEdit();
      return;
    }
    if (!playing && !event.target.matches("input,textarea,select")) {
      if (event.code === "Delete" && selectionId) $("#deleteObject").click();
      if (event.code === "KeyV") setTool("select");
      if (event.code === "KeyH") setTool("pan");
      if (event.code === "KeyT") setTool("trigger");
    }
    if (playing && ["KeyE", "Space", "Enter"].includes(event.code)) interact();
    if (playing && event.code === "Escape") stopPlay();
    else if ($("#assetStudio").classList.contains("active") && event.code === "Escape") closeAssetStudio();
    else if ($("#characterAnimator").classList.contains("active") && event.code === "Escape") closeCharacterAnimator();
  });
  window.addEventListener("keyup", event => { keys[event.code] = false; });
  function setTool(tool) {
    activeTool = tool; $$(".tool").forEach(b => b.classList.toggle("active", b.dataset.tool === tool));
  }

  $("#playButton").onclick = startPlay;
  $("#exitPlay").onclick = stopPlay;
  $("#dialogueContinue").onclick = () => { $("#dialogueBox").hidden = true; game.dialogue = false; };

  function ensureBusHornAudio(source = "soundAssets/bus_horn.mp3") {
    const src = new URL(source || "soundAssets/bus_horn.mp3", window.location.href).href;
    if (!busHornAudio) {
      busHornAudio = new Audio(src);
      busHornAudio.preload = "auto";
      busHornAudio.volume = .85;
    } else if (busHornAudio.src !== src) {
      busHornAudio.pause();
      busHornAudio.src = src;
      busHornAudio.load();
    }
    return busHornAudio;
  }

  function unlockBusHornAudio() {
    ensureBusHornAudio().load();
    try {
      hornAudioContext = hornAudioContext || new (window.AudioContext || window.webkitAudioContext)();
      hornAudioContext.resume?.();
    } catch {}
  }

  function playFallbackHorn() {
    try {
      const context = hornAudioContext || new (window.AudioContext || window.webkitAudioContext)();
      hornAudioContext = context;
      context.resume?.();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(210, context.currentTime);
      oscillator.frequency.setValueAtTime(170, context.currentTime + .18);
      gain.gain.setValueAtTime(.001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.18, context.currentTime + .03);
      gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .42);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + .45);
    } catch {}
  }

  function playBusHorn(source = "soundAssets/bus_horn.mp3") {
    const audio = ensureBusHornAudio(source);
    try {
      audio.pause();
      audio.currentTime = 0;
      const attempt = audio.play();
      if (attempt?.catch) attempt.catch(() => playFallbackHorn());
    } catch { playFallbackHorn(); }
  }

  function ensureBusEngineAudio(source = "soundAssets/bus_idle.mp3") {
    const src = new URL(source || "soundAssets/bus_idle.mp3", window.location.href).href;
    if (!busEngineAudio) {
      busEngineAudio = new Audio(src);
      busEngineAudio.preload = "auto";
      busEngineAudio.volume = .45;
      busEngineAudio.loop = true;
    } else if (busEngineAudio.src !== src) {
      busEngineAudio.pause();
      busEngineAudio.src = src;
      busEngineAudio.load();
    }
    return busEngineAudio;
  }

  function playBusEngine(source = "soundAssets/bus_idle.mp3") {
    const audio = ensureBusEngineAudio(source);
    try {
      if (audio.paused) {
        audio.currentTime = 0;
        const attempt = audio.play();
        if (attempt?.catch) attempt.catch(() => {});
      }
    } catch {}
  }

  function stopBusEngine() {
    if (busEngineAudio) { busEngineAudio.pause(); busEngineAudio.currentTime = 0; }
  }

  function spawnBusWheelGust(bus, burst = false) {
    if (!game) return;
    const bounds = objectVisualBounds(bus);
    const wheelY = bounds.cy + bounds.h / 2 - 12;
    const gustOffset = 10;
    const leftX = bounds.cx - bounds.w * .34 - gustOffset;
    const rightX = bounds.cx + bounds.w * .34 + gustOffset;
    const count = burst ? 14 : 3;
    for (const wheelX of [leftX, rightX]) {
      for (let i = 0; i < count; i++) {
        const side = wheelX < bounds.cx ? -1 : 1;
        busParticles.push({
          x: wheelX + (Math.random() - .5) * 18,
          y: wheelY + (Math.random() - .5) * 12,
          vx: side * (35 + Math.random() * 75) + (Math.random() - .5) * 25,
          vy: -18 - Math.random() * 45,
          age: 0,
          life: burst ? .75 + Math.random() * .45 : .45 + Math.random() * .35,
          size: burst ? 14 + Math.random() * 18 : 8 + Math.random() * 12
        });
      }
    }
    if (busParticles.length > 220) busParticles.splice(0, busParticles.length - 220);
  }

  function updateBusParticles(dt) {
    busParticles.forEach(p => {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(.82, dt * 8);
      p.vy += 38 * dt;
      p.size += 10 * dt;
    });
    busParticles = busParticles.filter(p => p.age < p.life);
  }

  function drawBusParticles(ctx, viewX) {
    if (!busParticles.length) return;
    ctx.save();
    ctx.translate(-viewX, 0);
    for (const p of busParticles) {
      const t = clamp(p.age / p.life, 0, 1);
      ctx.globalAlpha = (1 - t) * .42;
      ctx.fillStyle = "#d8c99e";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size * (1 + t), p.size * .45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function startBusDepart(bus, state) {
    state.departed = true;
    if (!Number.isFinite(state.drivePastStartedAt)) state.drivePastStartedAt = game.elapsed;
    if (!state.engineStarted) {
      state.engineStarted = true;
      playBusEngine(bus.engineSound || "soundAssets/bus_idle.mp3");
      spawnBusWheelGust(bus, true);
    }
  }

  function startPlay() {
    project.objects = project.objects.map(normalizeObjectScript);
    const honkAssetId = resolveAssetReference("bus_driver_honk.png");
    project.objects.forEach(o => {
      if (o.type === "bus") {
        delete o.scriptCode;
        o.visible = true;
        if (honkAssetId) o.honkAssetId = honkAssetId;
        // Keep edited buses snappy: old saved buses may still have 10-12 second drive times.
        if (!Number.isFinite(Number(o.busDuration)) || Number(o.busDuration) > 5) o.busDuration = 4;
      }
    });
    playing = true;
    const spawn = playerStartForScene();
    game = { x: spawn ? spawn.x + spawn.w / 2 : project.player.spawnX, y: project.world.height - project.world.groundHeight, cameraX: 0, facing: 1, crawling: false, near: null, dialogue: false, cash: 0, elapsed: 0, completed: new Set(), honkBusId: null, honkUntil: 0, honkFlashUntil: 0, blockedBusId: null, blockStartedAt: 0, lastHornAt: -999, hospitalized: false, playerKnockedDown: false, playerHidden: false, playerFallStartedAt: 0, hiddenObject: null, scriptState: {}, scriptErrors: {}, removedCarParts: new Map() };
    unlockBusHornAudio();
    sceneObjects().filter(o => o.visible !== false && o.type === "bus").forEach(bus => playBusEngine(bus.engineSound || "soundAssets/bus_idle.mp3"));
    $("#playOverlay").classList.add("active");
    $("#playOverlay").setAttribute("aria-hidden", "false");
    lastTime = performance.now();
    gameFrame = requestAnimationFrame(gameLoop);
  }
  function stopPlay() {
    playing = false; cancelAnimationFrame(gameFrame); $("#playOverlay").classList.remove("active"); $("#playOverlay").setAttribute("aria-hidden", "true");
    if (busHornAudio) { busHornAudio.pause(); busHornAudio.currentTime = 0; }
    stopBusEngine();
    busParticles = [];
  }

  function rawBusApproachProgress(bus) {
    const stateStart = game?.scriptState?.[bus.id]?.drivePastStartedAt;
    if (Number.isFinite(stateStart)) return (game.elapsed - stateStart) / Math.max(.1, bus.busDuration ?? 3);
    return (game.elapsed - (bus.busDelay ?? 5)) / Math.max(.1, bus.busDuration ?? 3);
  }

  function busApproachProgress(bus) {
    const state = game?.scriptState?.[bus.id];
    if (game?.blockedBusId === bus.id && !state?.runningOverPlayer) return 0;
    return rawBusApproachProgress(bus);
  }

  function sendPlayerToScene(sceneNameOrId = "hospital", message = "") {
    const requestedScene = sceneNameOrId || "hospital";
    let target = project.scenes.find(scene => scene.id === requestedScene || scene.name.toLowerCase() === String(requestedScene).toLowerCase());
    if (!target) target = ensureScene(requestedScene === "hospital" ? "hospital" : requestedScene, requestedScene === "hospital" ? "Hospital" : requestedScene);
    project.activeSceneId = target.id;
    const spawn = playerStartForScene(target.id);
    game.x = spawn ? spawn.x + spawn.w / 2 : project.player.spawnX;
    game.cameraX = 0;
    game.honkBusId = null; game.honkUntil = 0; game.honkFlashUntil = 0; game.blockedBusId = null; game.blockStartedAt = 0; game.lastHornAt = -999; game.playerKnockedDown = false; game.playerHidden = false; game.playerFallStartedAt = 0; game.hiddenObject = null;
    game.dialogue = !!message;
    game.hospitalized = target.id === "hospital" || target.name.toLowerCase().includes("hospital");
    renderScenes(); renderOutliner(); renderInspector();
    if (message) {
      $("#dialogueName").textContent = target.name || "Scene";
      $("#dialogueText").textContent = message;
      $("#dialogueBox").hidden = false;
    }
  }

  function sendPlayerToHospital(bus = null) {
    // Temporarily disabled for stability: the old bus/hospital path could freeze the clock and hide the player.
    // The bus may honk, but it cannot hide, teleport, or hospitalize the player until this sequence is rebuilt safely.
    game.playerKnockedDown = false;
    game.playerHidden = false;
    game.hospitalized = false;
    game.dialogue = false;
  }

  function busVisualProgress(bus) {
    return clamp(game?.blockedBusId === bus.id ? 0 : rawBusApproachProgress(bus), 0, 1);
  }

  function busVisualScale(bus) {
    const progress = busVisualProgress(bus);
    const startScale = clamp(Number(bus.busStartScale) || .59, .05, 1.5);
    const endScale = clamp(Number(bus.busEndScale) || 1, .5, 3);
    return startScale + (endScale - startScale) * progress;
  }

  function busBlocksPlayerAt(bus, playerX) {
    if (!game || game.hiddenObject === bus.id) return false;
    const state = game.scriptState?.[bus.id];
    const moving = !!state?.departed || !!state?.runningOverPlayer || Number.isFinite(state?.drivePastStartedAt) || rawBusApproachProgress(bus) >= 0;
    if (!moving) return false;
    const progress = busVisualProgress(bus);
    if (progress < 0 || progress >= 1) return false;
    const playerHalfWidth = 24;
    const playerFootY = game.y || (project.world.height - project.world.groundHeight);
    // Use the placed bus marker rectangle as the wall, not only the scaled bus artwork.
    const verticalOverlap = playerFootY >= bus.y - 20 && playerFootY <= bus.y + bus.h + 30;
    return verticalOverlap && playerX + playerHalfWidth >= bus.x && playerX - playerHalfWidth <= bus.x + bus.w;
  }

  function playerBlockedByMovingBus(candidateX, currentX = game.x) {
    return sceneObjects().some(object => {
      if (object.visible === false || object.type !== "bus") return false;
      const candidateInside = busBlocksPlayerAt(object, candidateX);
      if (!candidateInside) return false;
      const currentInside = busBlocksPlayerAt(object, currentX);
      if (!currentInside) return true;
      // If the player was already inside the bus marker when it became a wall,
      // allow movement that gets them farther from the bus center so they can escape.
      const center = object.x + object.w / 2;
      return Math.abs(candidateX - center) <= Math.abs(currentX - center);
    });
  }
  function playerBlocksBus(bus) {
    const scale = busVisualScale(bus);
    const centerX = bus.x + bus.w / 2 + (Number(bus.busDriftX) || 0) * busVisualProgress(bus);
    const halfWidth = Math.max(55, bus.w * scale * .55);
    return game.x >= centerX - halfWidth - 35 && game.x <= centerX + halfWidth + 35;
  }
  function objectScriptState(object) {
    if (!game.scriptState[object.id]) game.scriptState[object.id] = {};
    return game.scriptState[object.id];
  }

  function makeObjectApi(object) {
    const state = objectScriptState(object);
    return {
      state,
      assetId(nameOrId) { return resolveAssetReference(nameOrId); },
      setImage(nameOrId) { object.assetId = resolveAssetReference(nameOrId); },
      setHonkTexture(nameOrId) { object.honkAssetId = resolveAssetReference(nameOrId); },
      hide() { object.visible = false; },
      show() { object.visible = true; },
      hideObject() { game.hiddenObject = object.id; },
      busProgress(wait = object.busDelay ?? 5, driveTime = object.busDuration ?? 3) {
        return (game.elapsed - wait) / Math.max(.1, driveTime);
      },
      busProgressFrom(startedAt = game.elapsed, driveTime = object.busDuration ?? 3) {
        return (game.elapsed - startedAt) / Math.max(.1, driveTime);
      },
      playerBlocksBus() { return state.departed || state.runningOverPlayer || Number.isFinite(state.drivePastStartedAt) ? false : (object.type === "bus" ? playerBlocksBus(object) : pointInsideObject(game.x, game.y, object)); },
      blockedFor() {
        if (game.blockedBusId !== object.id) return 0;
        return game.elapsed - (game.blockStartedAt || game.elapsed);
      },
      clearBlock() {
        if (game.blockedBusId === object.id) { game.blockedBusId = null; game.blockStartedAt = 0; game.honkBusId = null; game.honkUntil = 0; game.honkFlashUntil = 0; }
      },
      knockPlayerDown() { console.warn("knockPlayerDown is disabled while playtest stability is being restored."); },
      hidePlayer() { console.warn("hidePlayer is disabled while playtest stability is being restored."); },
      startBusPassNow() {
        state.drivePastStartedAt = game.elapsed;
        if (game.blockedBusId === object.id) { game.blockedBusId = null; game.blockStartedAt = 0; }
        game.honkBusId = null;
        game.honkUntil = 0;
        game.honkFlashUntil = 0;
      },
      honk(sound = object.honkSound || "soundAssets/bus_horn.mp3", texture = "bus_driver_honk.png") {
        if (game.blockedBusId !== object.id) { game.blockedBusId = object.id; game.blockStartedAt = game.elapsed; game.lastHornAt = -999; }
        game.honkBusId = object.id;
        game.honkUntil = game.elapsed + .35;
        if (game.elapsed - (game.lastHornAt || -999) >= 1.15) {
          const resolvedTexture = texture ? resolveAssetReference(texture) : null;
          if (resolvedTexture) object.honkAssetId = resolvedTexture;
          game.honkFlashUntil = game.elapsed + .38;
          playBusHorn(sound);
          game.lastHornAt = game.elapsed;
        }
      },
      goToScene(sceneNameOrId = "hospital", message = "") {
        const targetName = String(sceneNameOrId || "").toLowerCase();
        if ((targetName === "hospital" || targetName.includes("hospital")) && !game.playerKnockedDown) return;
        sendPlayerToScene(sceneNameOrId, message);
      },
      hospital(message = "") { console.warn("hospital is disabled while playtest stability is being restored."); },
      log(...args) { console.log(`[${object.name || object.id}]`, ...args); }
    };
  }

  function scriptGameView() {
    const protectedWrites = new Set(["dialogue", "hospitalized", "playerHidden", "playerKnockedDown", "hiddenObject", "honkBusId", "honkUntil", "honkFlashUntil", "blockedBusId", "blockStartedAt"]);
    return new Proxy(game, {
      set(target, property, value) {
        if (protectedWrites.has(property)) return true;
        target[property] = value;
        return true;
      },
      deleteProperty(target, property) {
        if (protectedWrites.has(property)) return true;
        delete target[property];
        return true;
      }
    });
  }
  function runObjectScripts(dt) {
    if (!playing || !game || game.dialogue || game.hospitalized) return;
    sceneObjects().filter(o => o.visible !== false && o.type !== "bus").forEach(object => {
      const code = object.scriptCode || (object.type === "bus" ? defaultObjectScript(object) : "");
      if (!code.trim()) return;
      try {
        const fn = new Function("object", "game", "dt", "api", code);
        fn(object, scriptGameView(), dt, makeObjectApi(object));
        object.scriptError = "";
      } catch (error) {
        object.scriptError = error.message || String(error);
        game.scriptErrors[object.id] = object.scriptError;
      }
    });
  }
  function updateBusHazards() {
    if (!playing || !game || game.dialogue || game.hospitalized) return;
    const buses = sceneObjects().filter(o => o.visible !== false && o.type === "bus");
    for (const bus of buses) {
      const state = objectScriptState(bus);
      const progress = rawBusApproachProgress(bus);

      // Once the bus has begun driving away, it is a one-way state.
      // It must never return to the honk/block state just because the player touches the wall later.
      if (state.departed || Number.isFinite(state.drivePastStartedAt)) {
        startBusDepart(bus, state);
        if (game.blockedBusId === bus.id) { game.blockedBusId = null; game.blockStartedAt = 0; }
        if (game.honkBusId === bus.id) { game.honkBusId = null; game.honkUntil = 0; game.honkFlashUntil = 0; }
        continue;
      }

      if (progress < 0) continue;
      const inLane = playerBlocksBus(bus);
      if (!inLane) {
        startBusDepart(bus, state);
        if (game.blockedBusId === bus.id) { game.blockedBusId = null; game.blockStartedAt = 0; }
        if (game.honkBusId === bus.id) { game.honkBusId = null; game.honkUntil = 0; game.honkFlashUntil = 0; }
        continue;
      }
      if (progress >= 1 && game.blockedBusId !== bus.id) continue;

      if (game.blockedBusId !== bus.id) {
        game.blockedBusId = bus.id;
        game.blockStartedAt = game.elapsed;
        game.honkBusId = bus.id;
        game.lastHornAt = -999;
      }
      game.honkUntil = game.elapsed + .35;
      if (game.elapsed - (game.lastHornAt || -999) >= 1.15) {
        const honkTexture = resolveAssetReference("bus_driver_honk.png");
        if (honkTexture) bus.honkAssetId = honkTexture;
        game.honkFlashUntil = game.elapsed + .38;
        playBusHorn(bus.honkSound || "soundAssets/bus_horn.mp3");
        game.lastHornAt = game.elapsed;
      }
      if (game.elapsed - game.blockStartedAt >= (Number(bus.busRunOverAfter) || 7)) {
        game.playerKnockedDown = true;
        game.playerFallStartedAt = game.elapsed;
        state.runningOverPlayer = true;
        state.drivePastStartedAt = game.elapsed;
        state.departed = true;
        setTimeout(() => { if (game?.playerKnockedDown) game.playerHidden = true; }, 420);
        startBusDepart(bus, state);
        setTimeout(() => sendPlayerToScene(bus.busRunOverSceneId || "hospital", "You wake up at the hospital."), 950);
        game.blockedBusId = null;
        game.blockStartedAt = 0;
        game.honkBusId = null;
        game.honkUntil = 0;
        game.honkFlashUntil = 0;
      }
      break;
    }
  }
  function updateBusEffects(dt) {
    const buses = sceneObjects().filter(o => o.visible !== false && o.type === "bus");
    let engineActive = false;
    for (const bus of buses) {
      const state = game?.scriptState?.[bus.id];
      const departed = !!state?.departed || Number.isFinite(state?.drivePastStartedAt);
      const progress = rawBusApproachProgress(bus);
      if (!departed || (progress >= 0 && progress < 1)) {
        engineActive = true;
        if (departed && Math.random() < dt * 14) spawnBusWheelGust(bus, false);
        if (busEngineAudio?.paused) playBusEngine(bus.engineSound || "soundAssets/bus_idle.mp3");
      }
    }
    updateBusParticles(dt);
    if (!engineActive) stopBusEngine();
  }

  function gameLoop(now) {
    if (!playing) return;
    const dt = Math.min(.04, (now - lastTime) / 1000 || 0); lastTime = now;
    if (!game.dialogue) {
      const left = keys.ArrowLeft || keys.KeyA || keys.mobileLeft;
      const right = keys.ArrowRight || keys.KeyD || keys.mobileRight;
      game.crawling = !!(keys.ControlLeft || keys.KeyC || keys.ArrowDown || keys.mobileCrawl);
      const direction = game.playerKnockedDown ? 0 : (right ? 1 : 0) - (left ? 1 : 0);
      if (direction) game.facing = direction;
      const speed = game.crawling ? project.player.crawlSpeed : project.player.walkSpeed;
      const nextX = clamp(game.x + direction * speed * dt, 0, project.world.width);
      const blockedByBus = direction && playerBlockedByMovingBus(nextX, game.x);
      if (!blockedByBus) game.x = nextX;
      game.walking = !!direction && !blockedByBus;
      game.elapsed += dt;
      runObjectScripts(dt);
      updateBusHazards();
      updateBusEffects(dt);
    }
    const { width } = resizeCanvas(gameCanvas);
    const viewport = width;
    game.cameraX = clamp(game.x - viewport * .38, 0, Math.max(0, project.world.width - viewport));
    drawWorld(gctx, gameCanvas, game.cameraX, 1, true, game.elapsed * 1000);
    drawPlayer(gctx, game.x - game.cameraX, game.y, now);
    findInteraction();
    const minutes = 6 * 60 + 52 + Math.floor(game.elapsed * 2);
    $("#gameTime").textContent = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    $("#gameCash").textContent = game.cash;
    gameFrame = requestAnimationFrame(gameLoop);
  }

  function drawHonkWarning(ctx) {
    if (!game || game.elapsed > (game.honkUntil || 0)) return;
    const x = gameCanvas.width / 2;
    ctx.save();
    ctx.fillStyle = "rgba(20,18,10,.78)";
    ctx.strokeStyle = "#e0b65c";
    ctx.lineWidth = 2;
    rounded(ctx, x - 115, 42, 230, 42, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#f5d995";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("HONK! MOVE!", x, 69);
    ctx.restore();
  }
  function drawPlayer(ctx, x, groundY, now) {
    if (game.playerHidden) return;
    const scaleY = gameCanvas.height / project.world.height;
    ctx.save();
    try {
      ctx.scale(1, scaleY);
      ctx.translate(x, groundY);
      if (game.playerKnockedDown) {
        const fall = clamp((game.elapsed - (game.playerFallStartedAt ?? game.elapsed)) / .45, 0, 1);
        ctx.rotate(-Math.PI / 2 * fall);
        ctx.translate(-project.character.height * .18 * fall, -project.character.height * .22 * fall);
      }
      const crawl = game.crawling;
      const moving = game.walking;
      const state = crawl ? "crawling" : moving ? "walking" : "standing";
      if (state !== "standing") inheritMissingAssetsFromStanding(state, true);
      const sourceFrames = project.character?.animations?.[state]?.length ? project.character.animations[state] : [baseCharacterFrame(project.rig)];
      const frames = project.character?.animations?.[state]?.length ? playbackFrames(state) : sourceFrames;
      const safeFrames = frames.length ? frames : [baseCharacterFrame(project.rig)];
      const frameIndex = moving || crawl ? Math.floor(game.elapsed * animationFps(state)) % safeFrames.length : 0;
      const characterScale = .62;
      ctx.scale(characterScale * (game.facing < 0 ? -1 : 1), characterScale);
      paintCharacterFrame(ctx, safeFrames[frameIndex], -project.character.width / 2, -project.character.height + 22, false);
    } catch (error) {
      console.warn("Player draw failed; using placeholder", error);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(1, scaleY);
      ctx.translate(x, groundY - 110);
      drawPlaceholderPart(ctx, "backLeg");
      ctx.translate(16, 0); drawPlaceholderPart(ctx, "frontLeg");
      ctx.translate(-8, -70); drawPlaceholderPart(ctx, "torso");
      ctx.translate(0, -38); drawPlaceholderPart(ctx, "head");
    } finally {
      ctx.restore();
    }
  }

  function drawPlaceholderPart(ctx, part) {
    if (part === "head") { ctx.fillStyle = "#b58f70"; ctx.beginPath(); ctx.ellipse(0, 18, 17, 22, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (part === "torso") { ctx.fillStyle = "#3c5b52"; rounded(ctx, -20, 0, 40, 66, 8); ctx.fill(); }
    else { ctx.strokeStyle = part.includes("Arm") ? "#876d57" : "#343b37"; ctx.lineWidth = part.includes("Arm") ? 14 : 16; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, 53); ctx.stroke(); }
  }


  function nextRemovableCarPart(object) {
    const model = object?.type === "car_model" ? carModelById(object.carModelId) : null;
    if (!model) return null;
    const removed = game.removedCarParts.get(object.id) || new Set();
    return model.parts.find(part => part.removable && !removed.has(part.id)) || null;
  }

  function removeCarPartInPlay(object, part) {
    const removed = game.removedCarParts.get(object.id) || new Set();
    removed.add(part.id);
    game.removedCarParts.set(object.id, removed);
    const broken = Math.random() * 100 < (part.breakChance || 0);
    if (!broken) game.cash += part.reward || 0;
    return broken;
  }
  function findInteraction() {
    const triggers = sceneObjects().filter(o => o.visible !== false && o.type === "trigger" && !game.completed.has(o.id));
    const triggerNear = triggers.find(o => game.x >= o.x - 45 && game.x <= o.x + o.w + 45) || null;
    const carNear = sceneObjects().filter(o => o.visible !== false && o.type === "car_model").find(o => game.x >= o.x - 55 && game.x <= o.x + o.w + 55 && nextRemovableCarPart(o));
    game.near = triggerNear || carNear || null;
    const prompt = $("#interactionPrompt");
    prompt.style.display = game.near && !game.dialogue ? "block" : "none";
    if (game.near?.type === "car_model") {
      const part = nextRemovableCarPart(game.near);
      const tool = part.requiredTool === "none" ? "no tool" : part.requiredTool.replace("_", " ");
      prompt.textContent = `Remove ${part.name} (${tool}, ${part.removalTime}s)  [E]`;
    } else {
      prompt.textContent = game.near ? `${game.near.prompt || "Interact"}  [E]` : "";
    }
  }

  function interact() {
    if (!playing || game.dialogue || !game.near) return;
    const trigger = game.near;
    game.dialogue = true;
    if (trigger.type === "car_model") {
      const part = nextRemovableCarPart(trigger);
      if (!part) { game.dialogue = false; return; }
      const broken = removeCarPartInPlay(trigger, part);
      const tool = part.requiredTool === "none" ? "no tool" : part.requiredTool.replace("_", " ");
      $("#dialogueName").textContent = "Dismantling";
      $("#dialogueText").textContent = `You spend ${part.removalTime}s removing ${part.name} with ${tool}. ${broken ? "It broke while coming loose." : `It came out clean. You earned ${part.reward || 0}.`}`;
      $("#dialogueBox").hidden = false;
      return;
    }
    $("#dialogueName").textContent = trigger.action === "salvage" ? "Work" : "Foreman";
    let text = trigger.dialogue || "Interaction complete.";
    if (trigger.action === "salvage") {
      const broken = Math.random() * 100 < (trigger.breakChance || 0);
      text += broken ? " Unfortunately, the part broke while you removed it." : ` It came out in good condition. You earned $${trigger.reward || 0}.`;
      if (!broken) game.cash += trigger.reward || 0;
      game.completed.add(trigger.id);
    }
    if (trigger.action === "travel") {
      const targetScene = project.scenes.find(scene => scene.id === trigger.targetSceneId) || activeScene();
      project.activeSceneId = targetScene.id;
      const targetStart = playerStartForScene(targetScene.id);
      const explicitTargetX = Number(trigger.targetX);
      game.x = clamp(Number.isFinite(explicitTargetX) && trigger.targetX !== "" ? explicitTargetX : (targetStart ? targetStart.x + targetStart.w / 2 : project.player.spawnX), 0, project.world.width);
      game.cameraX = 0;
    game.honkBusId = null; game.honkUntil = 0; game.honkFlashUntil = 0; game.blockedBusId = null; game.blockStartedAt = 0; game.lastHornAt = -999; game.playerKnockedDown = false; game.playerHidden = false; game.playerFallStartedAt = 0; game.hiddenObject = null;
      text = trigger.dialogue || `You enter ${targetScene.name}.`;
      renderScenes(); renderOutliner(); renderInspector();
    }
    $("#dialogueText").textContent = text;
    $("#dialogueBox").hidden = false;
  }

  $$(".mobile-controls button").forEach(button => {
    const key = { left: "mobileLeft", right: "mobileRight", crawl: "mobileCrawl" }[button.dataset.control];
    if (button.dataset.control === "interact") {
      button.addEventListener("pointerdown", event => { event.preventDefault(); interact(); });
    } else {
      button.addEventListener("pointerdown", event => { event.preventDefault(); keys[key] = true; });
      ["pointerup", "pointercancel", "pointerleave"].forEach(name => button.addEventListener(name, () => { keys[key] = false; }));
    }
  });

  rebuildAll();
  $("#emptyTip").hidden = project.objects.length > 0;
  editorLoop();
  requestAnimationFrame(characterAnimatorLoop);
  loadProjectDatabase().then(stored => {
    if (stored && (stored.updatedAt || 0) > (project.updatedAt || 0)) {
      project = normalizeProject(stored);
      selectionId = null;
      rebuildAll();
    } else {
      saveProjectDatabase(project).catch(() => {});
    }
  }).catch(() => {});
})();
































































































