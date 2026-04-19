// =====================image_viewer.js=====================



let modalImages = [];
let modalIndex = 0;
let modalZoom = 1;
let lastRenderedIndex = -1;
let lastRenderSrc = null;

let fitMode = "auto"; // auto | width | height | fill


let imageResizeTimeout = null;
/* =====================
   OPEN IMAGE
===================== */
function autoFitZoom(canvas) {
    if (!canvas || !canvas.width || !canvas.height) return;

    const topBar = 56;
    const bottomBar = 56;
    const previewBar = 80;

    const availableW = window.innerWidth - 40;
    const availableH = window.innerHeight - (topBar + bottomBar + previewBar + 40);

    const w = canvas.width;
    const h = canvas.height;

    const aspect = w / h;
    const screenAspect = availableW / availableH;



    // =========================
    // 🔥 SMART LOGIC
    // =========================

    let scale = Math.min(
        availableW / w,
        availableH / h
    );

    // prevent too small zoom
    const minFit = 0.8;
    const maxFit = 3;

    scale = Math.max(minFit, Math.min(scale, maxFit));

    // =========================
    // 🔥 SMALL IMAGE BOOST
    // =========================
    if (w < 800 && h < 800) {
        scale *= 1.3; // upscale small images slightly
    }

    // =========================
    // 🔥 BIG IMAGE LIMIT (4K safety)
    // =========================
    const minScale = 0.75;   // NEVER go too small
    const maxScale = 3;      // allow upscale for readability

    scale = Math.max(minScale, Math.min(scale, maxScale));

    modalZoom = Math.round(scale * 100) / 100;

    updateZoom();
}



function openImage(imgEl) {
    const modal = document.getElementById("imgModal");
    const slider = imgEl.closest(".slider");
    if (!slider) return;

    modalImages = Array.from(slider.querySelectorAll("img")).map(img => img.src);
    modalIndex = modalImages.indexOf(imgEl.src);

    modal.style.display = "flex";

    document.body.style.overflow = "hidden"; // ✅ lock scroll FIRST

    modalZoom = 1;
    updateModalImage();

    buildPreviewBar();
    enableWheelZoom();
}


/* =====================
   DRAW IMAGE + WATERMARK
===================== */
function renderWatermarkedImage(src) {
    const canvas = document.getElementById("modalCanvas");
    const ctx = canvas.getContext("2d");

    const img = new Image();
    try {
        img.crossOrigin = "anonymous";
    } catch (e) {}

    img.onload = function () {

        /* =====================
           🔥 LIMIT SIZE (ANTI-LAG)
        ===================== */
        const MAX_SIZE = Math.max(window.innerWidth, window.innerHeight) * 2;

        let drawWidth = img.width;
        let drawHeight = img.height;

        if (img.width > MAX_SIZE || img.height > MAX_SIZE) {
            const ratio = Math.min(MAX_SIZE / img.width, MAX_SIZE / img.height);
            drawWidth = img.width * ratio;
            drawHeight = img.height * ratio;
        }

        canvas.width = drawWidth;
        canvas.height = drawHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, drawWidth, drawHeight);

        canvas.style.imageRendering = "auto";

        /* =====================
           🔥 DYNAMIC SCALING
        ===================== */
        const scaleFactor = drawWidth / 1200;
        const centerFont = Math.max(18, 28 * scaleFactor);
        const cornerFont = Math.max(12, 16 * scaleFactor);
        const lineHeight = 40 * scaleFactor;

        /* =====================
           CENTER WATERMARK
        ===================== */
        ctx.font = `bold ${centerFont}px Arial`;
        ctx.fillStyle = "rgba(255,255,255,0.18)"; // slightly improved visibility
        ctx.textAlign = "center";

        const centerText = [
            "ENG. AMBETSA",
            "Structural & Architectural Designer",
            "+254 716 770 021",
            "ambetsafrankline@email.com"
        ];

        const centerX = drawWidth / 2;
        const startY = drawHeight / 2 - (lineHeight * 1.5);

        centerText.forEach((text, i) => {
            ctx.fillText(text, centerX, startY + (i * lineHeight));
        });

        /* =====================
           CORNER WATERMARK
        ===================== */
        ctx.font = `${cornerFont}px Arial`;
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.textAlign = "right";

        const padding = 20;

        ctx.fillText("ENG. AMBETSA", drawWidth - padding, drawHeight - (padding * 3));
        ctx.fillText("+254 716 770 021", drawWidth - padding, drawHeight - (padding * 2));
        ctx.fillText("ambetsafrankline@email.com", drawWidth - padding, drawHeight - padding);

        /* =====================
           AUTO FIT
        ===================== */
       // autoFitZoom(canvas);

        setTimeout(() => {
            autoFitZoom(canvas);
        }, 50);


    };

    img.onerror = function () {
        console.error("Image failed to load:", src);
    };

    /* =====================
       LOAD IMAGE
    ===================== */
    img.src = src; // ⚠️ safer (remove ?w=1200 unless your server supports it)
}


window.addEventListener("resize", () => {
    clearTimeout(imageResizeTimeout);

    imageResizeTimeout = setTimeout(() => {
        const canvas = document.getElementById("modalCanvas");

        if (canvas && canvas.width) {
            autoFitZoom(canvas);
        }
    }, 150);
});



/* =====================
   UPDATE IMAGE (FIXED)
===================== */

function updateModalImage() {
    const src = modalImages[modalIndex];

    if (lastRenderedIndex === modalIndex && lastRenderSrc === src) return;

    modalZoom = 1; // 🔥 ADD THIS RESET

    renderWatermarkedImage(src);

    lastRenderedIndex = modalIndex;
    lastRenderSrc = src;

    document.getElementById("imgCounter").innerText =
        `${modalIndex + 1} / ${modalImages.length}`;

    updateActivePreview();
}


/* =====================
   NAVIGATION
===================== */
function preloadImage(index) {
    if (!modalImages[index]) return;

    const img = new Image();
    img.src = modalImages[index];
}

function modalNext() {
    if (!modalImages.length) return;
    modalIndex = (modalIndex + 1) % modalImages.length;

    preloadImage((modalIndex + 1) % modalImages.length); // 🔥 preload next
    updateModalImage();
}

function modalPrev() {
    if (!modalImages.length) return;
    modalIndex = (modalIndex - 1 + modalImages.length) % modalImages.length;
    preloadImage((modalIndex - 1 + modalImages.length) % modalImages.length);
    updateModalImage();
}



/* =====================
   ZOOM (CANVAS)
===================== */
function updateZoom() {
    const canvas = document.getElementById("modalCanvas");

    canvas.style.transform = `scale(${modalZoom})`;

    // keep zoom centered properly
    canvas.style.transformOrigin = "center center";

    document.getElementById("zoomPercent").innerText =
        Math.round(modalZoom * 100) + "%";
}



const ZOOM_STEP = 0.08; // feels more natural

function zoomIn() {
    modalZoom = Math.min(modalZoom * (1 + ZOOM_STEP), 8);
    updateZoom();
}

function zoomOut() {
    modalZoom = Math.max(modalZoom * (1 - ZOOM_STEP), 0.2);
    updateZoom();
}


function resetZoom() {
    const canvas = document.getElementById("modalCanvas");
    if (canvas && canvas.width) {
        setTimeout(() => {
            autoFitZoom(canvas);
        }, 50);
    }
}

function enableWheelZoom() {
    const canvas = document.getElementById("modalCanvas");
    if (!canvas) return;

    canvas.onwheel = (e) => {
        e.preventDefault();

        if (e.deltaY < 0) {
            zoomIn();
        } else {
            zoomOut();
        }
    };
}

/* =====================
   DOWNLOAD (WITH WATERMARK)
===================== */
function downloadImage() {
    const canvas = document.getElementById("modalCanvas");

    const link = document.createElement("a");
    link.download = `ambetsa-design-${modalIndex + 1}.png`;
    link.href = canvas.toDataURL("image/png");

    link.click();
}




/* =====================
   CLOSE IMAGE MODAL (MERGED + FIXED)
===================== */
function closeImage() {
    const modal = document.getElementById("imgModal");
    if (!modal) return;
    modal.style.display = "none";
    document.body.style.overflow = "";
}



function buildPreviewBar() {
    const bar = document.getElementById("previewBar");
    bar.innerHTML = "";

    modalImages.forEach((src, i) => {
        const thumb = document.createElement("img");
        thumb.src = src;

        if (i === modalIndex) {
            thumb.classList.add("active");
        }

        thumb.onclick = () => {
            modalIndex = i;
            updateModalImage();
        };

        bar.appendChild(thumb);
    });
}

function updateActivePreview() {
    const thumbs = document.querySelectorAll("#previewBar img");

    thumbs.forEach((img, i) => {
        img.classList.toggle("active", i === modalIndex);
    });
}