
/* Photo Enhancer v4 - in-browser editor with crop, filters, resize, rotate, undo
   Works offline. Keep files together and open index.html */
const canvas = document.getElementById('canvas');
const overlay = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const octx = overlay.getContext('2d');

let img = new Image();
let originalDataURL = null;
let undoStack = [];
const UNDO_LIMIT = 8;

let state = {
  brightness:100, contrast:100, saturation:100, blur:0, filter:'none',
  rotation:0, flipH:false, flipV:false
};

function pushUndo(){
  try{
    if(undoStack.length >= UNDO_LIMIT) undoStack.shift();
    undoStack.push(canvas.toDataURL());
    document.getElementById('undoBtn').disabled = false;
  }catch(e){console.warn('undo push failed',e)}
}

function undo(){
  if(undoStack.length===0) return;
  const data = undoStack.pop();
  const i = new Image();
  i.onload = ()=>{
    canvas.width = i.width; canvas.height = i.height;
    ctx.drawImage(i,0,0);
  };
  i.src = data;
  if(undoStack.length===0) document.getElementById('undoBtn').disabled = true;
}

document.getElementById('undoBtn').addEventListener('click', undo);

document.getElementById('upload').addEventListener('change', e=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ev=>{
    img = new Image();
    img.onload = ()=>{
      // fit to a max width for comfortable editing
      const maxW = Math.min(window.innerWidth*0.9, 900);
      const scale = Math.min(1, maxW / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      overlay.width = canvas.width; overlay.height = canvas.height;
      drawImageToCanvas();
      originalDataURL = canvas.toDataURL();
      undoStack = [];
      document.getElementById('undoBtn').disabled = true;
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

function drawImageToCanvas(){
  // apply transforms and filters from state then draw
  ctx.save();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // prepare transform
  ctx.translate(canvas.width/2, canvas.height/2);
  let angle = state.rotation * Math.PI/180;
  if(state.flipH) ctx.scale(-1,1);
  if(state.flipV) ctx.scale(1,-1);
  ctx.rotate(angle);
  ctx.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%) blur(${state.blur}px) ${state.filter==='none'?'':''}`.trim();
  // draw centered
  const dw = canvas.width;
  const dh = canvas.height;
  ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
  ctx.restore();
}

// sliders
['brightness','contrast','saturation','blur'].forEach(id=>{
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener('input', ()=>{
    state[id] = Number(el.value);
    document.getElementById(id[0]+'Val').innerText = el.value;
    drawImageToCanvas();
  });
});

// filters
document.querySelectorAll('.filter-row button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.filter = btn.getAttribute('data-filter') || 'none';
    drawImageToCanvas();
  });
});

// rotate & flip
document.getElementById('rotateLeft').addEventListener('click', ()=>{ pushUndo(); state.rotation -=90; drawImageToCanvas();});
document.getElementById('rotateRight').addEventListener('click', ()=>{ pushUndo(); state.rotation +=90; drawImageToCanvas();});
document.getElementById('flipH').addEventListener('click', ()=>{ pushUndo(); state.flipH = !state.flipH; drawImageToCanvas();});
document.getElementById('flipV').addEventListener('click', ()=>{ pushUndo(); state.flipV = !state.flipV; drawImageToCanvas();});

// resize
document.getElementById('applyResize').addEventListener('click', ()=>{
  const w = Number(document.getElementById('resizeW').value);
  const h = Number(document.getElementById('resizeH').value);
  if(!w || !h) return alert('Enter width and height in pixels');
  pushUndo();
  // create temp canvas with new size and draw current canvas content into it
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(canvas,0,0,tmp.width,tmp.height);
  canvas.width = tmp.width; canvas.height = tmp.height;
  overlay.width = canvas.width; overlay.height = canvas.height;
  img = new Image(); img.onload = ()=>{ ctx.drawImage(img,0,0); }; img.src = tmp.toDataURL();
});

// crop with overlay canvas (drag)
let cropping = false;
let cropRect = null;
let start = null;

function enableCropMode(){
  cropping = true;
  overlay.style.pointerEvents = 'auto';
  overlay.addEventListener('pointerdown', onPointerDown);
  overlay.addEventListener('pointermove', onPointerMove);
  overlay.addEventListener('pointerup', onPointerUp);
  overlay.addEventListener('pointercancel', onPointerUp);
  overlay.width = canvas.width; overlay.height = canvas.height;
  octx.clearRect(0,0,overlay.width,overlay.height);
  overlay.style.cursor = 'crosshair';
}

function disableCropMode(){
  cropping = false;
  overlay.style.pointerEvents = 'none';
  overlay.removeEventListener('pointerdown', onPointerDown);
  overlay.removeEventListener('pointermove', onPointerMove);
  overlay.removeEventListener('pointerup', onPointerUp);
  overlay.removeEventListener('pointercancel', onPointerUp);
  overlay.style.cursor = 'default';
  octx.clearRect(0,0,overlay.width,overlay.height);
  start = null; cropRect = null;
}

function onPointerDown(e){
  const rect = overlay.getBoundingClientRect();
  start = {x: e.clientX - rect.left, y: e.clientY - rect.top};
  cropRect = {x:start.x,y:start.y,w:0,h:0};
}
function onPointerMove(e){
  if(!start) return;
  const rect = overlay.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  cropRect.w = x - start.x; cropRect.h = y - start.y;
  octx.clearRect(0,0,overlay.width,overlay.height);
  octx.fillStyle = 'rgba(0,0,0,0.35)';
  octx.fillRect(0,0,overlay.width,overlay.height);
  octx.clearRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
  octx.strokeStyle = '#fff'; octx.lineWidth = 2;
  octx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
}
function onPointerUp(e){
  if(!start) return;
  // ensure w,h positive
  if(cropRect.w < 0){ cropRect.x += cropRect.w; cropRect.w = Math.abs(cropRect.w); }
  if(cropRect.h < 0){ cropRect.y += cropRect.h; cropRect.h = Math.abs(cropRect.h); }
  start = null;
}

// apply crop
document.getElementById('applyCrop').addEventListener('click', ()=>{
  if(!cropRect) return alert('First drag to select area for crop');
  pushUndo();
  const tmp = document.createElement('canvas');
  tmp.width = Math.round(cropRect.w); tmp.height = Math.round(cropRect.h);
  const tctx = tmp.getContext('2d');
  // draw current canvas into temp using crop region
  tctx.drawImage(canvas, cropRect.x, cropRect.y, cropRect.w, cropRect.h, 0,0, tmp.width, tmp.height);
  // replace canvas size and image
  canvas.width = tmp.width; canvas.height = tmp.height;
  overlay.width = canvas.width; overlay.height = canvas.height;
  img = new Image(); img.onload = ()=>{ ctx.drawImage(img,0,0); }; img.src = tmp.toDataURL();
  disableCropMode();
});

document.getElementById('cancelCrop').addEventListener('click', ()=>{ disableCropMode(); });

document.getElementById('cropMode').addEventListener('click', ()=>{ enableCropMode(); });

// reset
document.getElementById('resetBtn').addEventListener('click', ()=>{
  if(!originalDataURL) return;
  pushUndo();
  img = new Image();
  img.onload = ()=>{ canvas.width = img.width; canvas.height = img.height; overlay.width = canvas.width; overlay.height = canvas.height; drawImageToCanvas(); };
  img.src = originalDataURL;
  // reset sliders
  state = {brightness:100, contrast:100, saturation:100, blur:0, filter:'none', rotation:0, flipH:false, flipV:false};
  ['brightness','contrast','saturation','blur'].forEach(id=>{
    const el = document.getElementById(id); if(el) el.value = state[id];
    document.getElementById(id[0]+'Val').innerText = state[id];
  });
});

// download
document.getElementById('downloadBtn').addEventListener('click', ()=>{
  const link = document.createElement('a');
  link.download = 'enhanced.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// panel open/close for mobile
document.getElementById('openPanel').addEventListener('click', ()=>{
  document.getElementById('sidePanel').classList.toggle('open');
});
document.getElementById('closePanel').addEventListener('click', ()=>{
  document.getElementById('sidePanel').classList.remove('open');
});

// apply edits continuously (ensure we draw initial image if available)
function safeDraw(){
  if(!img || !img.src) return;
  drawImageToCanvas();
}
window.addEventListener('resize', safeDraw);
