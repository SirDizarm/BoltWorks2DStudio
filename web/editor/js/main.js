window.BoltWorks = window.BoltWorks || {};
(() => {
  BoltWorks.State.loadLocal();
  BoltWorks.Shell.register('scene', BoltWorks.SceneBuilder);
  BoltWorks.Shell.register('assets', BoltWorks.AssetStudio);
  BoltWorks.Shell.register('character', BoltWorks.CharacterAnimator);
  BoltWorks.Shell.register('parts', {
    title: 'Part Builder',
    left: () => '<h2 class="module-title">Part Builder</h2><p class="hint">Object/vehicle part builder will live here as its own module.</p>',
    center: () => '<div class="empty">Part Builder placeholder. Next we can port the car/object part workflow cleanly.</div>',
    right: () => '<div class="inspector-title">Inspector</div><p class="hint">No part selected.</p>'
  });
  BoltWorks.Shell.init();
})();
