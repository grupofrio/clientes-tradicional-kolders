const fs = require('fs');
const { createCanvas } = require('canvas');

function createIcon(size, text = 'K') {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Fondo B2B (blanco)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  // KOLD Blue 
  ctx.fillStyle = '#0066FF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Texto K
  ctx.font = `bold ${size * 0.5}px "Inter", Arial, sans-serif`;
  ctx.fillText(text, size / 2, size / 2 + size * 0.05);

  return canvas.toBuffer('image/png');
}

fs.writeFileSync('public/icon-192.png', createIcon(192));
fs.writeFileSync('public/icon-512.png', createIcon(512));
console.log('✅ Iconos PWA B2B generados (blanco y azul).');
