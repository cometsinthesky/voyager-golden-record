/* Voyager Golden Record - modernized decoder UI
   - Keeps original decoding logic
   - Adds contrast/gamma/smoothing controls
   - Rotated rendering (-90°) with right-to-left scan direction
*/

let debug = false;

/* Approx. number of samples between falling edges of trigger pulse. */
let AVG_SAMPLES_PER_LINE = 734;

const leftChannel = {
  name: "left",
  go: true,
  offset: 3000000,
  samples: null,
  haltOnError: false,
  canvasName: "imgCanvasLeft",
  plotName: "plotLeft",
  // image settings
  contrast: 1.30,
  gamma: 1.00,
  smooth: 0,
  rtl: false
};

const rightChannel = {
  name: "right",
  go: true,
  offset: 3000000,
  samples: null,
  haltOnError: false,
  canvasName: "imgCanvasRight",
  plotName: "plotRight",
  contrast: 1.30,
  gamma: 1.00,
  smooth: 0,
  rtl: false
};

function clamp(v, lo, hi){ return v < lo ? lo : (v > hi ? hi : v); }

function updateOscilloscope(channel, scanlineLength){
  const c = document.getElementById(channel.plotName);
  const buffer = channel.samples;
  const offset = channel.offset;

  const ctx = c.getContext("2d", { alpha: true });
  const zoom = 200;
  const W = c.width;
  const H = c.height;
  const center = H / 2;
  const dx = W / scanlineLength;

  ctx.clearRect(0,0,W,H);
  ctx.beginPath();
  ctx.moveTo(0, center);

  const plotStart = -140;
  let x = 0;

  for(let i=0;i<scanlineLength;i++){
    x += dx;
    ctx.lineTo(x, center - buffer[i + offset + plotStart] * zoom);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

/* Faster vertical scroll: drawImage() to shift bitmap up by 1 row */
function scrollCanvasUp1(ctx, canvas){
  ctx.drawImage(canvas, 0, -1);
}

function scrollCanvasLeft1(ctx, canvas){
  ctx.drawImage(canvas, -1, 0);
  // clear the new rightmost column area (avoid smear)
  ctx.clearRect(canvas.width - 1, 0, 1, canvas.height);
}

function scrollCanvasRight1(ctx, canvas){
  ctx.drawImage(canvas, 1, 0);
  // clear the new leftmost column area
  ctx.clearRect(0, 0, 1, canvas.height);
}

/* Map audio sample -> grayscale (0..255), with smoothing + contrast + gamma */
function sampleToGray(sample, contrast, gamma){
  // The original code inverted and scaled aggressively.
  // Here we use a tunable curve:
  // 1) Shift + scale to roughly match typical signal levels
  // 2) Apply contrast (linear), then gamma (nonlinear)
  // 3) Clamp to [0..255]
  //
  // This mapping is intentionally conservative; users can tune contrast/gamma.
  const base = 0.55;        // midpoint
  const gain = 7.5;         // pre-gain (empirical)
  let x = base - sample * gain; // invert: stronger sample -> darker
  x = (x - 0.5) * contrast + 0.5;
  x = clamp(x, 0.0, 1.0);
  x = Math.pow(x, gamma);
  return Math.round(x * 255);
}

/* Draws the newest scanline at the bottom.
   Assumes channel.offset is just after a sync pulse. */
function displayLatestScanline(channel){
  const canvas = document.getElementById(channel.canvasName);
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  const W = canvas.width, H = canvas.height;

  // After rotating the rendering by -90° (conceptually),
  // we draw each new scanline as a vertical column.
  // To make the image "arrive" from right to left, we shift left by 1px
  // and draw the new column on the right edge.
  if(channel.rtl){
    // optional: left-to-right (for comparison) when checkbox is ON
    scrollCanvasRight1(ctx, canvas);
  } else {
    scrollCanvasLeft1(ctx, canvas);
  }

  const col = ctx.createImageData(1, H);
  const data = col.data;

  const smoothN = channel.smooth | 0; // 0..6
  const half = Math.max(0, Math.min(6, smoothN));

  for(let y=0;y<H;y++){
    // With the rotated mapping, pixel y corresponds to sample offset + y
    const idx0 = channel.offset + y;

    // Simple 1D box blur along the sample axis
    let acc = 0;
    let n = 0;
    for(let k=-half;k<=half;k++){
      const s = channel.samples[idx0 + k];
      if(s === undefined) continue;
      acc += s;
      n++;
    }
    const sAvg = (n > 0) ? (acc / n) : channel.samples[idx0];

    const g = sampleToGray(sAvg, channel.contrast, channel.gamma);

    const p = y * 4;
    data[p+0] = g;
    data[p+1] = g;
    data[p+2] = g;
    data[p+3] = 255;
  }

  if(channel.rtl){
    // draw new column at left
    ctx.putImageData(col, 0, 0);
  } else {
    // draw new column at right
    ctx.putImageData(col, W - 1, 0);
  }
}

/* Finds the offset at the next sync pulse */
function nextLine(channel){
  let pulseCount = 0;
  const triggerCount = 2;
  let lowLevel = 0;
  let highLevelReachedCounter = 0;

  channel.offset += 300;
  const maxInterimageSamples = 10000;
  let max = 0;
  const lookahead = 850;

  for(let i=0;i<lookahead;i++){
    const sample = channel.samples[channel.offset + i];
    if(sample > max) max = sample;
  }
  lowLevel = max * 0.1;

  for(let i=-100;i<maxInterimageSamples;i++){
    if(channel.samples[channel.offset] === max){
      highLevelReachedCounter = 60;
    }
    highLevelReachedCounter -= 1;

    if(channel.samples[channel.offset] > lowLevel){
      pulseCount++;
    }else{
      const pulseIsLongEnough = pulseCount > triggerCount;
      const maxWasRecent = highLevelReachedCounter > 0;

      if(pulseIsLongEnough && maxWasRecent){
        if(debug){
          channel.samples[channel.offset] = 1;
          channel.samples[channel.offset+1] = -1;
          channel.samples[channel.offset+2] = 1;
        }
        return channel;
      }
      pulseCount = 0;
      highLevelReachedCounter = 0;
    }
    channel.offset += 1;
  }

  if(channel.haltOnError) channel.go = false;
  return channel;
}

function startDisplayingChannel(channel){
  // ~33 fps; keep original cadence
  setInterval(() => {
    if(!channel.go || !channel.samples) return;

    const oldOffset = channel.offset;

    channel = nextLine(channel);
    displayLatestScanline(channel);
    updateOscilloscope(channel, 3000);

    if(debug){
      const scanned = channel.offset - oldOffset;
      if((scanned > AVG_SAMPLES_PER_LINE + 80) || (scanned < AVG_SAMPLES_PER_LINE - 89)){
        console.log("Missed trigger pulse! Scanned", scanned, "samples instead");
        if(channel.haltOnError) channel.go = false;
      }
    }
  }, 30);
}

/* -------- UI wiring -------- */

function bindButtonActions(){
  document.body.addEventListener("click", (ev) => {
    const t = ev.target;
    if(!(t instanceof HTMLElement)) return;
    const action = t.getAttribute("data-action");
    const ch = t.getAttribute("data-channel");
    if(!action) return;

    const channel = (ch === "right") ? rightChannel : leftChannel;

    if(action === "toggle"){
      channel.go = !channel.go;
    }
    if(action === "jumpBack"){
      channel.offset -= 256 * 328;
      channel.offset = Math.max(0, channel.offset);
    }
    if(action === "jumpForward"){
      channel.offset += 256 * 328;
    }
    if(action === "bookmark"){
      const off = Number(t.getAttribute("data-offset") || "0");
      if(Number.isFinite(off) && off > 0) channel.offset = off;
    }
  });

  document.getElementById("btnPauseAll")?.addEventListener("click", () => {
    leftChannel.go = false; rightChannel.go = false;
  });
  document.getElementById("btnPlayAll")?.addEventListener("click", () => {
    leftChannel.go = true; rightChannel.go = true;
  });
}

function bindSliders(){
  function bind(channel, prefix){
    const contrast = document.getElementById(prefix + "Contrast");
    const gamma = document.getElementById(prefix + "Gamma");
    const smooth = document.getElementById(prefix + "Smooth");

    const contrastVal = document.getElementById(prefix + "ContrastVal");
    const gammaVal = document.getElementById(prefix + "GammaVal");
    const smoothVal = document.getElementById(prefix + "SmoothVal");

    contrast?.addEventListener("input", () => {
      channel.contrast = Number(contrast.value);
      if(contrastVal) contrastVal.textContent = channel.contrast.toFixed(2);
    });
    gamma?.addEventListener("input", () => {
      channel.gamma = Number(gamma.value);
      if(gammaVal) gammaVal.textContent = channel.gamma.toFixed(2);
    });
    smooth?.addEventListener("input", () => {
      channel.smooth = Number(smooth.value);
      if(smoothVal) smoothVal.textContent = String(channel.smooth|0);
    });

    // Direção (checkbox)
    const rtl = document.getElementById(prefix + "RTL");
    if(rtl){
      channel.rtl = Boolean(rtl.checked);
      rtl.addEventListener("change", () => {
        channel.rtl = Boolean(rtl.checked);
      });
    }
  }
  bind(leftChannel, "left");
  bind(rightChannel, "right");
}

function onloadCallback(buffer){
  // Hide loader smoothly
  setTimeout(() => {
    const loading = document.getElementById("loading_div");
    if(loading) loading.style.display = "none";

    leftChannel.samples = buffer.getChannelData(0);
    rightChannel.samples = buffer.getChannelData(1);

    startDisplayingChannel(leftChannel);
    startDisplayingChannel(rightChannel);
  }, 350);
}

function loadingProgress(progress){
  const bar = document.getElementById("load_progress");
  if(bar) bar.style.width = progress + "%";
}

bindButtonActions();
bindSliders();
bindIntroOverlay();

// Provided by audio_loader.js (unchanged)
loadSound("voyager.mp3", onloadCallback, loadingProgress);


/* -------- Intro overlay -------- */
function bindIntroOverlay(){
  const overlay = document.getElementById("introOverlay");
  const closeBtn = document.getElementById("introClose");
  if(!overlay || !closeBtn) return;

  function close(){
    overlay.style.display = "none";
  }
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if(e.target === overlay) close();
  });
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") close();
  });
}
