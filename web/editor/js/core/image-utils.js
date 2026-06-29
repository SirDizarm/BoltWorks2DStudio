window.BoltWorks = window.BoltWorks || {};
BoltWorks.ImageUtils = (() => {
  const canvasToAssetData = async dataUrl => {
    const img = await BoltWorks.loadImage(dataUrl);
    return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
  };

  const colorDistance = (data, index, color) => {
    const dr = data[index] - color.r;
    const dg = data[index + 1] - color.g;
    const db = data[index + 2] - color.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  const trimTransparentCanvas = canvas => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (image.data[(y * canvas.width + x) * 4 + 3] > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < 0) return canvas.toDataURL('image/png');
    return cropDataUrl(canvas.toDataURL('image/png'), minX, minY, maxX - minX + 1, maxY - minY + 1);
  };

  const removeGlobalColor = (image, color, tolerance) => {
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      if (colorDistance(d, i, color) <= tolerance) d[i + 3] = 0;
    }
  };

  const removeOutsideConnectedColor = (image, width, height, color, tolerance) => {
    const d = image.data;
    const visited = new Uint8Array(width * height);
    const queue = [];
    const enqueue = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const pixelIndex = y * width + x;
      if (visited[pixelIndex]) return;
      const dataIndex = pixelIndex * 4;
      if (d[dataIndex + 3] === 0 || colorDistance(d, dataIndex, color) <= tolerance) {
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

    while (queue.length) {
      const pixelIndex = queue.shift();
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      d[pixelIndex * 4 + 3] = 0;
      enqueue(x + 1, y);
      enqueue(x - 1, y);
      enqueue(x, y + 1);
      enqueue(x, y - 1);
    }
  };

  const removeBackground = async (dataUrl, color, tolerance = 24, trim = true, mode = 'global') => {
    const img = await BoltWorks.loadImage(dataUrl);
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const image = ctx.getImageData(0, 0, c.width, c.height);
    if (mode === 'outside') removeOutsideConnectedColor(image, c.width, c.height, color, tolerance);
    else removeGlobalColor(image, color, tolerance);
    ctx.putImageData(image, 0, 0);
    if (!trim) return c.toDataURL('image/png');
    return trimTransparentCanvas(c);
  };

  const cropDataUrl = async (dataUrl, x, y, w, h) => {
    const img = await BoltWorks.loadImage(dataUrl);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    c.getContext('2d').drawImage(img, Math.round(x), Math.round(y), c.width, c.height, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  };

  const pickPixel = (canvas, x, y) => {
    const p = canvas.getContext('2d', { willReadFrequently: true }).getImageData(x, y, 1, 1).data;
    return { r: p[0], g: p[1], b: p[2], a: p[3] };
  };

  return { canvasToAssetData, removeBackground, cropDataUrl, pickPixel };
})();
