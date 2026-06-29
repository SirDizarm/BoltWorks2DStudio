window.BoltWorks = window.BoltWorks || {};
BoltWorks.Shell = (() => {
  const modules = {};
  let active = 'scene';
  const register = (id, module) => { modules[id] = module; };
  const setStatus = text => { BoltWorks.$('#statusText').textContent = text; };
  const render = () => {
    BoltWorks.$$('.rail-button').forEach(btn => btn.classList.toggle('active', btn.dataset.module === active));
    const mod = modules[active];
    if (!mod) return;
    BoltWorks.$('#leftPanel').innerHTML = mod.left?.() || '';
    BoltWorks.$('#centerPanel').innerHTML = mod.center?.() || '';
    BoltWorks.$('#rightPanel').innerHTML = mod.right?.() || '';
    mod.afterRender?.();
    setStatus(`Active module: ${mod.title || active}`);
  };
  const activate = id => { active = id; render(); };
  const init = () => {
    BoltWorks.$$('.rail-button').forEach(btn => btn.onclick = () => activate(btn.dataset.module));
    BoltWorks.$('#newProjectBtn').onclick = () => { if (confirm('Start a new BoltWorks project?')) { BoltWorks.State.setProject(BoltWorks.State.createProject()); render(); } };
    BoltWorks.$('#saveProjectBtn').onclick = () => {
      const p = BoltWorks.State.getProject();
      const name = prompt('Project file name', `${p.name || 'boltworks-project'}.boltworks`);
      if (name) BoltWorks.downloadText(name.endsWith('.boltworks') ? name : `${name}.boltworks`, JSON.stringify(p, null, 2));
    };
    BoltWorks.$('#openProjectBtn').onclick = () => BoltWorks.$('#projectFileInput').click();
    BoltWorks.$('#projectFileInput').onchange = async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      try { BoltWorks.State.setProject(JSON.parse(text)); render(); setStatus(`Loaded ${file.name}`); }
      catch { alert('That file is not a valid BoltWorks project JSON file.'); }
      event.target.value = '';
    };
    BoltWorks.$('#playPreviewBtn').onclick = () => alert('Play Preview will be rebuilt after Scene Builder is ported. First we are getting the editor modules stable.');
    BoltWorks.$('#openLegacyBtn')?.addEventListener('click', () => { window.open('../legacy-working-editor/index.html', '_blank'); });
    render();
  };
  return { register, activate, render, setStatus, init };
})();



