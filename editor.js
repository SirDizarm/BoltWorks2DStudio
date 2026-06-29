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
  let assetPreviewCache = null;
  let assetStatusMessage = "";
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

  function removeBackgroundPixels(imageData) {
    const pixels = imageData.data;
    const feather = 12;
    for (let i = 0; i < pixels.length; i += 4) {
      const dr = pixels[i] - backgroundRgb.r;
      const dg = pixels[i + 1] - backgroundRgb.g;
      const db = pixels[i + 2] - backgroundRgb.b;
      const distance = Math.sqrt(dr * dr + dg * dg + db * db);
      if (distance <= colorTolerance) pixels[i + 3] = 0;
      else if (distance < colorTolerance + feather) pixels[i + 3] = Math.round(pixels[i + 3] * (distance - colorTolerance) / feather);
    }
    return imageData;
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
    return { color: rgbToHex(backgroundRgb), tolerance: colorTolerance, appliedAt: Date.now() };
  }

  function processedAssetCanvas(asset, image) {
    const key = `${asset.id}:${transparencyPreview}:${backgroundRgb.r},${backgroundRgb.g},${backgroundRgb.b}:${colorTolerance}:${image.naturalWidth}x${image.naturalHeight}`;
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

  function drawPaintCursorPreview(point) {
    const settings = paintSettings();
    const size = Math.max(1, Math.round(settings.size));
    const radius = size / 2;
    const isPen = settings.tool === "pen";
    const isErase = settings.tool === "erase";
    const previewRgb = hexToRgb(settings.color || "#ffd05f");
    const color = isErase ? "rgba(255, 107, 95, .38)" : `rgba(${previewRgb.r}, ${previewRgb.g}, ${previewRgb.b}, .42)`;
    const centerColor = isErase ? "#ff6b5f" : settings.color || "#ffd05f";
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
    if (isErase) {
      const slash = Math.max(size * .22, 1);
      assetCtx.strokeStyle = "rgba(255, 255, 255, .85)";
      assetCtx.lineWidth = Math.max(1 / assetZoom, .15);
      assetCtx.beginPath();
      assetCtx.moveTo(point.x - slash, point.y + slash);
      assetCtx.lineTo(point.x + slash, point.y - slash);
      assetCtx.stroke();
    }
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
  function clampAssetSelection(selection, image = images.get(selectedAssetId)) {
    if (!selection || !image?.naturalWidth) return null;
    const x = clamp(Math.round(selection.x), 0, image.naturalWidth - 1);
    const y = clamp(Math.round(selection.y), 0, image.naturalHeight - 1);
    const w = clamp(Math.round(selection.w), 1, image.naturalWidth - x);
    const h = clamp(Math.round(selection.h), 1, image.naturalHeight - y);
    return { x, y, w, h };
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
      updateSelectionDetails("Painting... release to save into this asset.");
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
  $("#extractAsset").onclick = extractSelectedAsset;
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

  function playSound(path) {
    if (!path) return;
    const source = project.exportedSounds?.[path] || path;
    if (!audioUnlocked) { queuedSounds.push(source); return; }
    try { const audio = new Audio(source); audio.volume = .65; audio.play().catch(() => {}); } catch {}
  }
  function unlockAudio() {
    audioUnlocked = true;
    while (queuedSounds.length) {
      const source = queuedSounds.shift();
      try { const audio = new Audio(source); audio.volume = .65; audio.play().catch(() => {}); } catch {}
    }
  }
  function stateForBus(bus) { if (!busState.has(bus.id)) busState.set(bus.id, {}); return busState.get(bus.id); }
  function rawBusProgress(bus) { const st = stateForBus(bus); if (Number.isFinite(st.startedAt)) return (elapsed - st.startedAt) / Math.max(.1, Number(bus.busDuration) || 4); return (elapsed - (Number(bus.busDelay) || 5)) / Math.max(.1, Number(bus.busDuration) || 4); }
  function busProgress(bus) { return clamp(blockedBusId === bus.id ? 0 : rawBusProgress(bus), 0, 1); }
  function busVisualScale(bus) { const start = clamp(Number(bus.busStartScale) || .59, .05, 1.5); const end = clamp(Number(bus.busEndScale) || 1, .5, 3); return start + (end - start) * busProgress(bus); }
  function playerBlocksBus(bus) { const scale = busVisualScale(bus); const cx = bus.x + bus.w / 2 + (Number(bus.busDriftX) || 0) * busProgress(bus); const half = Math.max(55, bus.w * scale * .55); return player.x >= cx - half - 35 && player.x <= cx + half + 35; }
  function busBlocksPlayerAt(bus, x) { const st = stateForBus(bus); const moving = st.departed || Number.isFinite(st.startedAt) || rawBusProgress(bus) >= 0; if (!moving || busProgress(bus) >= 1) return false; return player.y >= bus.y - 20 && player.y <= bus.y + bus.h + 30 && x + 24 >= bus.x && x - 24 <= bus.x + bus.w; }
  function blockedByMovingBus(nextX, currentX) { return sceneObjects().some(o => { if (o.visible === false || o.type !== "bus") return false; if (!busBlocksPlayerAt(o, nextX)) return false; if (!busBlocksPlayerAt(o, currentX)) return true; const center = o.x + o.w / 2; return Math.abs(nextX - center) <= Math.abs(currentX - center); }); }
  function startBus(bus) { const st = stateForBus(bus); if (!st.departed) { st.departed = true; st.startedAt = elapsed; playSound(bus.engineSound || "soundAssets/bus_idle.mp3"); spawnBusGust(bus, true); } }
  function honk(bus) { honkBusId = bus.id; if (elapsed - lastHornAt >= 1.15) { if (honkTextureId) bus.honkAssetId = honkTextureId; honkFlashUntil = elapsed + .38; playSound(bus.honkSound || "soundAssets/bus_horn.mp3"); lastHornAt = elapsed; } }
  function updateBusHazards() {
    for (const bus of sceneObjects().filter(o => o.type === "bus" && o.visible !== false)) {
      const st = stateForBus(bus), progress = rawBusProgress(bus);
      if (st.departed || Number.isFinite(st.startedAt)) { startBus(bus); if (blockedBusId === bus.id) { blockedBusId = null; blockStartedAt = 0; honkBusId = null; } continue; }
      if (progress < 0 || progress >= 1) continue;
      if (!playerBlocksBus(bus)) { if (blockedBusId === bus.id) { blockedBusId = null; blockStartedAt = 0; honkBusId = null; } startBus(bus); continue; }
      if (blockedBusId !== bus.id) { blockedBusId = bus.id; blockStartedAt = elapsed; lastHornAt = -999; }
      honk(bus);
      if (elapsed - blockStartedAt >= (Number(bus.busRunOverAfter) || 7)) { player.knocked = true; player.fallAt = elapsed; startBus(bus); blockedBusId = null; blockStartedAt = 0; honkBusId = null; setTimeout(() => goToScene("hospital", "You wake up at the hospital."), 900); }
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
  function goToScene(sceneNameOrId, text) { const wanted = String(sceneNameOrId || "").toLowerCase(); const target = (project.scenes || []).find(s => s.id === sceneNameOrId || String(s.name || "").toLowerCase() === wanted) || scene(); activeSceneId = target.id; blockedBusId = null; honkBusId = null; blockStartedAt = 0; spawnPlayer(); if (text) showDialogue(text); }
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


  async function blobToDataUrl(blob) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function collectStandaloneSounds(exportProject) {
    const sounds = {};
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
    if (game?.blockedBusId === bus.id) return 0;
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
    if (!game.playerKnockedDown) { game.playerHidden = false; game.hospitalized = false; }
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

      if (progress < 0 || progress >= 1) continue;
      const inLane = playerBlocksBus(bus);
      if (!inLane) {
        startBusDepart(bus, state);
        if (game.blockedBusId === bus.id) { game.blockedBusId = null; game.blockStartedAt = 0; }
        if (game.honkBusId === bus.id) { game.honkBusId = null; game.honkUntil = 0; game.honkFlashUntil = 0; }
        continue;
      }

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
        startBusDepart(bus, state);
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
      if (!state?.departed && !Number.isFinite(state?.drivePastStartedAt)) continue;
      const progress = rawBusApproachProgress(bus);
      if (progress >= 0 && progress < 1) {
        engineActive = true;
        if (Math.random() < dt * 14) spawnBusWheelGust(bus, false);
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
    if (!game.playerKnockedDown) { game.playerHidden = false; game.hospitalized = false; }
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
    if (game.playerHidden && !game.playerKnockedDown) game.playerHidden = false;
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




























































































