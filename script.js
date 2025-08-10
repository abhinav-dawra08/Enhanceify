const canvas = document.getElementById('canvas');
const overlay = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const octx = overlay.getContext('2d');

const undoBtn = document.getElementById('undoBtn');
const uploadInput = document.getElementById('upload');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');
const cropModeBtn = document.getElementById('cropMode');
const applyCropBtn = document.getElementById('applyCrop');
const cancelCropBtn = document.getElementById('cancelCrop');

const sliders = {
  brightness: document.getElementById('brightness'),
  contrast: document.getElementById('contrast'),
  saturation: document.getElementById('saturation'),
  blur: document.getElementById('blur')
};

const sliderVals = {
  bVal: document.getElementById('bVal'),
  cVal: document.getElementById('cVal'),
  sVal: document.getElementById('sVal'),
  blVal: document.getElementById('blVal')
};

const filterButtons = document.querySelectorAll('.filter-row button');

const rotateLeftBtn = document.getElementById('rotateLeft');
const rotateRightBtn = document.getElementById('rotateRight');
const flipHBtn = document.getElementById('flipH');
const flipVBtn = document.getElementById('flipV');

const resizeWInput = document.getElementById('resizeW');
const resizeHInput = document.getElementById('resizeH');
const applyResizeBtn = document.getElementById('applyResize');

const openPanelBtn = document.getElementById('openPanel');
const sidePanel = document.getElementById('sidePanel');

let img = new Image();
let originalDataURL = null;
let undoStack = [];
const UNDO_LIMIT = 8;

let cropEnabled = false;
let cropRect = null;
let cropStart = null;

let state = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  filter: 'none',
  rotation: 0,
  flipH: false,
  flipV: false
};

// Undo stack management
function pushUndo() {
  try {
    if (undoStack.length >= UNDO_LIMIT) undoStack.shift();
    undoStack.push(canvas.toDataURL());
    undoBtn.disabled = false;
  } catch (e) {
    console.warn('undo push failed', e);
  }
}

function undo() {
  if (undoStack.length === 0) return;
  const data = undoStack.pop();
  const i = new Image();
  i.onload = () => {
    canvas.width = i.width;
    canvas.height = i.height;
    overlay.width = canvas.width;
    overlay.height = canvas.height;
    ctx.drawImage(i, 0, 0);
    safeDraw();
  };
  i.src = data;
  if (undoStack.length === 0) undoBtn.disabled = true;
}

// Upload image and initialize canvas
uploadInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    img = new Image();
    img.onload = () => {
      const maxW = Math.min(window.innerWidth * 0.9, 900);
      const scale = Math.min(1, maxW / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      overlay.width = canvas.width;
      overlay.height = canvas.height;
      resetState();
      drawImageToCanvas();
      originalDataURL = canvas.toDataURL();
      undoStack = [];
      undoBtn.disabled = true;
      applyCropBtn.disabled = true;
      cancelCropBtn.disabled = true;
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// Draw image with applied transformations and filters
function drawImageToCanvas() {
  if (!img || !img.src) return;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.translate(canvas.width / 2, canvas.height / 2);
  if (state.flipH) ctx.scale(-1, 1);
  if (state.flipV) ctx.scale(1, -1);
  ctx.rotate((state.rotation * Math.PI) / 180);

  const filters = [
    `brightness(${state.brightness}%)`,
    `contrast(${state.contrast}%)`,
    `saturate(${state.saturation}%)`,
    `blur(${state.blur}px)`
  ];
  if (state.filter && state.filter !== 'none') filters.push(state.filter);
  ctx.filter = filters.join(' ');

  ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
  ctx.restore();
}

// Slider event handlers
Object.keys(sliders).forEach(id => {
  const slider = sliders[id];
  const display = sliderVals[id + 'Val' || id + 'Val']; // e.g., bVal, cVal, sVal, blVal

  slider.addEventListener('input', () => {
    state[id] = Number(slider.value);
    if (id === 'blur') {
      sliderVals.blVal.textContent = slider.value;
    } else if (id === 'brightness') {
      sliderVals.bVal.textContent = slider.value;
    } else if (id === 'contrast') {
      sliderVals.cVal.textContent = slider.value;
    } else if (id === 'saturation') {
      sliderVals.sVal.textContent = slider.value;
    }

    drawImageToCanvas();
  });
});

// Filters buttons
filterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    filterButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.filter = btn.getAttribute('data-filter') || 'none';
    drawImageToCanvas();
  });
});

// Rotation and flipping
rotateLeftBtn.addEventListener('click', () => {
  pushUndo();
  state.rotation = (state.rotation - 90) % 360;
  drawImageToCanvas();
});

rotateRightBtn.addEventListener('click', () => {
  pushUndo();
  state.rotation = (state.rotation + 90) % 360;
  drawImageToCanvas();
});

flipHBtn.addEventListener('click', () => {
  pushUndo();
  state.flipH = !state.flipH;
  drawImageToCanvas();
});

flipVBtn.addEventListener('click', () => {
  pushUndo();
  state.flipV = !state.flipV;
  drawImageToCanvas();
});

// Resize functionality
applyResizeBtn.addEventListener('click', () => {
  const w = Number(resizeWInput.value);
  const h = Number(resizeHInput.value);
  if (!w || !h) {
    alert('Enter valid width and height in pixels');
    return;
  }
  pushUndo();
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(canvas, 0, 0, w, h);
  canvas.width = w;
  canvas.height = h;
  overlay.width = w;
  overlay.height = h;
  img = new Image();
  img.onload = () => {
    drawImageToCanvas();
  };
  img.src = tmp.toDataURL();
});

// Crop mode implementation
function enableCropMode() {
  cropEnabled = true;
  overlay.style.pointerEvents = 'auto';
  overlay.style.cursor = 'crosshair';
  applyCropBtn.disabled = false;
  cancelCropBtn.disabled = false;

  overlay.addEventListener('pointerdown', onPointerDown);
  overlay.addEventListener('pointermove', onPointerMove);
  overlay.addEventListener('pointerup', onPointerUp);
  overlay.addEventListener('pointercancel', onPointerUp);
}

function disableCropMode() {
  cropEnabled = false;
  overlay.style.pointerEvents = 'none';
  overlay.style.cursor = 'default';
  applyCropBtn.disabled = true;
  cancelCropBtn.disabled = true;

  overlay.removeEventListener('pointerdown', onPointerDown);
  overlay.removeEventListener('pointermove', onPointerMove);
  overlay.removeEventListener('pointerup', onPointerUp);
  overlay.removeEventListener('pointercancel', onPointerUp);

  cropRect = null;
  cropStart = null;
  octx.clearRect(0, 0, overlay.width, overlay.height);
}

function onPointerDown(e) {
  if (!cropEnabled) return;
  const rect = overlay.getBoundingClientRect();
  cropStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  cropRect = { x: cropStart.x, y: cropStart.y, w: 0, h: 0 };
}

function onPointerMove(e) {
  if (!cropEnabled || !cropStart) return;
  const rect = overlay.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  cropRect.w = x - cropStart.x;
  cropRect.h = y - cropStart.y;

  octx.clearRect(0, 0, overlay.width, overlay.height);
  octx.fillStyle = 'rgba(0,0,0,0.35)';
  octx.fillRect(0, 0, overlay.width, overlay.height);
  octx.clearRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
  octx.strokeStyle = '#fff';
  octx.lineWidth = 2;
  octx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
}

function onPointerUp() {
  if (!cropEnabled) return;
  if (cropRect.w < 0) {
    cropRect.x += cropRect.w;
    cropRect.w = Math.abs(cropRect.w);
  }
  if (cropRect.h < 0) {
    cropRect.y += cropRect.h;
    cropRect.h = Math.abs(cropRect.h);
  }
  cropStart = null;
}

// Apply crop to the canvas
applyCropBtn.addEventListener('click', () => {
  if (!cropRect || cropRect.w === 0 || cropRect.h === 0) {
    alert('Please drag to select an area for cropping.');
    return;
  }
  pushUndo();

  const tmp = document.createElement('canvas');
  tmp.width = Math.round(cropRect.w);
  tmp.height = Math.round(cropRect.h);
  const tctx = tmp.getContext('2d');

  tctx.drawImage(
    canvas,
    cropRect.x,
    cropRect.y,
    cropRect.w,
    cropRect.h,
    0,
    0,
    tmp.width,
    tmp.height
  );

  canvas.width = tmp.width;
  canvas.height = tmp.height;
  overlay.width = tmp.width;
  overlay.height = tmp.height;

  img = new Image();
  img.onload = () => {
    drawImageToCanvas();
  };
  img.src = tmp.toDataURL();

  disableCropMode();
});

// Cancel crop mode
cancelCropBtn.addEventListener('click', () => {
  disableCropMode();
});

// Toggle crop mode
cropModeBtn.addEventListener('click', () => {
  if (!cropEnabled) {
    enableCropMode();
  } else {
    disableCropMode();
  }
});

// Reset to original image and default settings
resetBtn.addEventListener('click', () => {
  if (!originalDataURL) return;
  pushUndo();

  img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    overlay.width = canvas.width;
    overlay.height = canvas.height;
    drawImageToCanvas();
  };
  img.src = originalDataURL;

  resetState();
});

// Download edited image as PNG
downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'enhanced.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// Toggle side panel (mobile)
openPanelBtn.addEventListener('click', () => {
  sidePanel.classList.toggle('open');
});

// Reset sliders and state values
function resetState() {
  state = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    filter: 'none',
    rotation: 0,
    flipH: false,
    flipV: false
  };
  sliders.brightness.value = state.brightness;
  sliders.contrast.value = state.contrast;
  sliders.saturation.value = state.saturation;
  sliders.blur.value = state.blur;

  sliderVals.bVal.textContent = state.brightness;
  sliderVals.cVal.textContent = state.contrast;
  sliderVals.sVal.textContent = state.saturation;
  sliderVals.blVal.textContent = state.blur;

  filterButtons.forEach(b => b.classList.remove('active'));
  filterButtons[0].classList.add('active'); // 'None' filter active
}

// Redraw image safely on window resize
function safeDraw() {
  if (!img || !img.src) return;
  drawImageToCanvas();
}

window.addEventListener('resize', safeDraw);
undoBtn.addEventListener('click', undo);
