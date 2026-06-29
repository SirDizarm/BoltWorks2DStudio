window.BoltWorks = window.BoltWorks || {};
BoltWorks.State = (() => {
  const STORAGE_KEY = 'boltworks.web.project.v1';
  const shelves = ['Working', 'Character', 'World', 'Objects', 'Parts', 'Scenes', 'Inventory'];
  const createProject = () => ({
    schema: 'boltworks-project',
    version: 1,
    name: 'Untitled BoltWorks Project',
    shelves,
    selectedAssetId: null,
    selectedObjectId: null,
    scenes: [{ id: BoltWorks.uid('scene'), name: 'New scene', width: 5200, height: 720, groundHeight: 150, objects: [], layers: [
      { id: 'sky', name: 'Sky / fixed background', parallax: 0 },
      { id: 'far', name: 'Far scenery', parallax: .18 },
      { id: 'gameplay', name: 'Ground & gameplay', parallax: 1 },
      { id: 'front', name: 'Front scenery', parallax: .72 }
    ] }],
    activeSceneId: null,
    assets: [],
    character: {
      activeAnimation: 'Standing',
      animations: {
        Standing: { fps: 8, loop: 'normal', facing: 'right', frames: [BoltWorks.State?.defaultFrame?.() || null].filter(Boolean) }
      }
    }
  });
  const defaultLayer = (id, label, x, y) => ({ id, label, assetId: null, x, y, rotation: 0, scale: 1, hidden: false, light: 1, flip: false });
  const defaultFrame = () => ({
    layers: [
      defaultLayer('backArm', 'Back arm', 118, 146),
      defaultLayer('backLeg', 'Back leg', 120, 214),
      defaultLayer('head', 'Head', 128, 86),
      defaultLayer('torso', 'Torso', 128, 150),
      defaultLayer('frontLeg', 'Front leg', 138, 214),
      defaultLayer('frontArm', 'Front arm', 154, 148)
    ]
  });
  let project = createProject();
  project.activeSceneId = project.scenes[0].id;
  project.character.animations.Standing.frames = [defaultFrame()];

  const normalizeProject = incoming => {
    const p = incoming && incoming.schema === 'boltworks-project' ? incoming : createProject();
    p.shelves = p.shelves?.length ? p.shelves : shelves;
    p.assets = p.assets || [];
    p.scenes = p.scenes?.length ? p.scenes : createProject().scenes;
    p.activeSceneId = p.activeSceneId || p.scenes[0].id;
    p.character = p.character || createProject().character;
    if (!p.character.animations || !Object.keys(p.character.animations).length) p.character.animations = { Standing: { fps: 8, loop: 'normal', facing: 'right', frames: [defaultFrame()] } };
    p.character.activeAnimation = p.character.activeAnimation || Object.keys(p.character.animations)[0];
    return p;
  };
  const saveLocal = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  const loadLocal = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) project = normalizeProject(JSON.parse(raw));
    return project;
  };
  const setProject = next => { project = normalizeProject(next); saveLocal(); };
  const getProject = () => project;
  const currentScene = () => project.scenes.find(s => s.id === project.activeSceneId) || project.scenes[0];
  const assetById = id => project.assets.find(a => a.id === id);
  const activeAnimation = () => project.character.animations[project.character.activeAnimation];
  const addAsset = asset => { project.assets.unshift(asset); project.selectedAssetId = asset.id; saveLocal(); };
  const updateAsset = (id, patch) => { const asset = assetById(id); if (asset) Object.assign(asset, patch); saveLocal(); };
  const deleteAsset = id => { project.assets = project.assets.filter(a => a.id !== id); if (project.selectedAssetId === id) project.selectedAssetId = project.assets[0]?.id || null; saveLocal(); };
  return { shelves, defaultFrame, loadLocal, saveLocal, setProject, getProject, currentScene, assetById, activeAnimation, addAsset, updateAsset, deleteAsset, createProject };
})();
