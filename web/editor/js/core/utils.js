window.BoltWorks = window.BoltWorks || {};
BoltWorks.$ = (sel, root = document) => root.querySelector(sel);
BoltWorks.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
BoltWorks.uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
BoltWorks.clamp = (value, min, max) => Math.max(min, Math.min(max, value));
BoltWorks.downloadText = (filename, text, mime = 'application/json') => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
BoltWorks.downloadDataUrl = (filename, dataUrl) => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
};
BoltWorks.escapeHtml = (value = '') => String(value).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
BoltWorks.fileToDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});
BoltWorks.loadImage = src => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});
