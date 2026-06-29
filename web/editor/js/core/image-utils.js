window.BoltWorks = window.BoltWorks || {};
BoltWorks.ImageUtils = (() => {
  const canvasToAssetData = async dataUrl => {
    const img = await BoltWorks.loadImage(dataUrl);
    return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
  };
  const removeBackground = async (dataUrl, color, tolerance = 24, trim = true) => {
    const img = await BoltWorks.loadImage(dataUrl);
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    let image = ctx.getImageData(0, 0, c.width, c.height);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      const dr = d[i] - color.r, dg = d[i + 1] - color.g, db = d[i + 2] - color.b;
      if (Math.sqrt(dr * dr + dg * dg + db * db) <= tolerance) d[i + 3] = 0;
    }
    ctx.putImageData(image, 0, 0);
    if (!trim) return c.toDataURL('image/png');
    image = ctx.getImageData(0, 0, c.width, c.height);
    let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (image.data[(y * c.width + x) * 4 + 3] > 0) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    }
    if (maxX < 0) return c.toDataURL('image/png');
    return cropDataUrl(c.toDataURL('image/png'), minX, minY, maxX - minX + 1, maxY - minY + 1);
  };
  const cropDataUrl = async (dataUrl, x, y, w, h) => {
    const img = await BoltWorks.loadImage(dataUrl);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    c.getContext('2d').drawImage(img, Math.round(x), Math.round(y), c.width, c.height, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  };
  const pickPixel = (canvas, x, y) => {
    const p = canvas.getContext('2d', { willReadFrequently: true }).getImageData(x, y, 1, 1).data;
    return { r: p[0], g: p[1], b: p[2], a: p[3] };
  };
  return { canvasToAssetData, removeBackground, cropDataUrl, pickPixel };
})();
