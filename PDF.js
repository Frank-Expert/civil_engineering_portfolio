//PDF.js

// ✅ PDF.js worker (MUST be before using pdfjs)
pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


let currentFile = "";
//let renderTask = null;
let totalPages = 0;
let currentPage = 1;
let pdfReady = false;
let isRenderingPDF = false;
let renderGeneration = 0;
let pdfDoc = null;

let pageObserver = null;
let pdfCache = new Map();
//let scrollFreeze = false;
let scrollLock = false;

let zoomMode = "fit"; 
let resizeTimeout = null;
let swalLocked = false;


let currentZoom = 1;
let zoomLock = false;
let isZooming = false;
let lastTouchDistance = null;



const WATERMARK_LINES = [
    "ENG. AMBETSA",
    "Civil Engineer | Structural Engineer",
    "+254 716 770021",
    "ambetsafrankline@gmail.com"
];


/* =====================
   PDF MODAL
===================== */
function setWatermark(text) {
    const wm = document.querySelector(".pdf-watermark");
    if (wm) {
        wm.innerText = text;
    }
}



async function openPDF(file) {
    currentFile = file;

    document.getElementById("pdfModal").style.display = "flex";
    lockScroll();

    pdfReady = false;
    isRenderingPDF = true;

    showRenderLoader();

    try {

        // =========================
        // LOAD OR USE CACHE (SINGLE PATH)
        // =========================
        if (pdfCache.has(file)) {
            pdfDoc = pdfCache.get(file);
        } else {
            const loadingTask = pdfjsLib.getDocument({
                url: file,
                cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
                cMapPacked: true,
                disableAutoFetch: false,
                disableStream: false,
                disableRange: false,
            });

            pdfDoc = await loadingTask.promise;
            pdfCache.set(file, pdfDoc);
        }

        totalPages = pdfDoc.numPages;

        renderPDF(pdfDoc);

    } catch (err) {

        console.error(err);

        Swal.fire({
            icon: "error",
            title: "Failed to open PDF",
            text: "Document could not be loaded."
        });

    } finally {
        isRenderingPDF = false;
        if (!swalLocked) Swal.close();
    }
}



function renderPDF(pdf) {
    const container = document.getElementById("pdfContainer");
    container.innerHTML = "";

    const currentRender = ++renderGeneration;

    pdfDoc = pdf;
    totalPages = pdf.numPages;

    // =========================
    // CREATE PAGE SHELLS
    // =========================
    for (let i = 1; i <= totalPages; i++) {

        const pageDiv = document.createElement("div");
        pageDiv.className = "page";
        pageDiv.dataset.page = i;

        pageDiv.dataset.rendered = "0";
        pageDiv.dataset.rendering = "0";

        container.appendChild(pageDiv);
    }

    // =========================
    // 🔥 SIDEBAR NOW OWNED HERE (OPTION 1)
    // =========================
    buildSidebar(pdf);

    // =========================
    // OBSERVER
    // =========================
    requestAnimationFrame(async () => {
        // render FIRST page immediately (critical fix)
        const first = document.querySelector('.page[data-page="1"]');
        if (first) await renderPage(1, first);

        // then observer
        initPageObserver();
    });

    // =========================
    // UI READY
    // =========================
    updateZoomUI();

    // =========================
    // 🔥 AUTO FIT (CORRECT TIMING)
    // =========================
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            resetZoom();
        });
    });

    swalLocked = false;
    Swal.close();
}


const renderedCache = new Map();

function showRenderLoader() {
    swalLocked = true;

    Swal.fire({
        title: "Rendering PDF",
        html: `
            <div class="loader"></div>
            <div id="progress-text">Starting...</div>
        `,
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading()
    });
}


//Add cache limit + eviction
const MAX_CACHE_SIZE = 20; // tweak (10–30 ideal)

function setCache(key, bitmap) {
    if (renderedCache.size >= MAX_CACHE_SIZE) {
        const firstKey = renderedCache.keys().next().value;
        renderedCache.delete(firstKey);
    }
    renderedCache.set(key, bitmap);
}



let activeRenders = 0;
const MAX_PARALLEL_RENDERS = 3;


function renderPage(pageNum, container) {
    if (!pdfDoc || !container) return;

    const zoom = currentZoom;
    const generation = renderGeneration;
    const cacheKey = `${pageNum}-${zoom}`;

    // =========================
    // 🧠 CANCEL OLD RENDER (SAFE)
    // =========================
    if (container._renderTask) {
        try { container._renderTask.cancel(); } catch (e) {}
    }

    // =========================
    // 🚫 SKIP IF ALREADY DONE
    // =========================
    if (container.dataset.rendering === "1") return;

    container.dataset.rendering = "1";

    // =========================
    // ⚡ CACHE HIT
    // =========================
    if (renderedCache.has(cacheKey)) {
        const bitmap = renderedCache.get(cacheKey);

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = bitmap.width;
        canvas.height = bitmap.height;

        ctx.drawImage(bitmap, 0, 0);

        container.replaceChildren(canvas);

        container.dataset.rendering = "0";
        container.dataset.rendered = "1";

        return;
    }

    // =========================
    // ⛔ LIMIT CONCURRENCY
    // =========================
    if (activeRenders >= MAX_PARALLEL_RENDERS) {
        container.dataset.rendering = "0";
        setTimeout(() => renderPage(pageNum, container), 50);
        return;
    }

    activeRenders++;

    // =========================
    // 📥 GET PAGE
    // =========================
    pdfDoc.getPage(pageNum).then(page => {

        if (generation !== renderGeneration) return;
        if (!document.body.contains(container)) return;

        const viewport = page.getViewport({ scale: zoom });
        const DPR = Math.min(window.devicePixelRatio || 1, 2);

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = viewport.width * DPR;
        canvas.height = viewport.height * DPR;

        canvas.style.width = viewport.width + "px";
        canvas.style.height = viewport.height + "px";

        ctx.scale(DPR, DPR);

        container.replaceChildren(canvas);

        const renderTask = page.render({
            canvasContext: ctx,
            viewport
        });

        container._renderTask = renderTask;

        return renderTask.promise
            .then(async () => {

                if (generation !== renderGeneration) return;

                // =========================
                // 💧 WATERMARK
                // =========================
                drawWatermark(ctx, canvas);

                // =========================
                // 💾 CACHE RESULT
                // =========================
                const bitmap = await createImageBitmap(canvas);
                setCache(cacheKey, bitmap);

                container.dataset.rendered = "1";
                container.dataset.rendering = "0";

            })
            .catch(err => {
                if (err?.name !== "RenderingCancelledException") {
                    console.warn("Render error:", err);
                }
                container.dataset.rendering = "0";
            });

    }).finally(() => {
        activeRenders--;
    });
}



function drawWatermark(ctx, canvas) {
    const lines = WATERMARK_LINES;

    const stepX = 400;
    const stepY = 280;

    ctx.save();
    ctx.font = "18px Arial";

    // 🔥 ONLY CHANGE #1 (make it visible)
    ctx.fillStyle = "rgba(0, 0, 0, 0.14)";

    ctx.textAlign = "center";

    for (let x = -canvas.width; x < canvas.width * 2; x += stepX) {
        for (let y = -canvas.height; y < canvas.height * 2; y += stepY) {

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(-Math.PI / 6);

            lines.forEach((line, i) => {
                ctx.fillText(line, 0, i * 20);
            });

            ctx.restore();
        }
    }

    ctx.restore();
}




function initPageObserver() {

    // 🔥 always reset cleanly (prevents duplicate observers)
    if (pageObserver) {
        pageObserver.disconnect();
    }

    const viewer = document.querySelector(".pdf-viewer");

    pageObserver = new IntersectionObserver((entries) => {

        // =========================
        // GLOBAL SAFETY LOCKS
        // =========================
        
        if (isZooming || isRenderingPDF || scrollLock) return;

        let bestPage = currentPage;
        
        let bestRatio = -1;

        for (const entry of entries) {

            const pageNum = Number(entry.target.dataset.page);
            if (!pageNum) continue;

            // =========================
            // 1. LAZY RENDERING (ONLY ON VISIBILITY)
            // =========================
            if (
                entry.isIntersecting &&
                entry.target.dataset.rendered !== "1" &&
                entry.target.dataset.rendering !== "1"
            ) {
                renderPage(pageNum, entry.target);
            }

            // =========================
            // 2. STABLE ACTIVE PAGE TRACKING
            // =========================
            const ratio = entry.intersectionRatio || 0;

            // 🔥 stability buffer prevents flicker between pages
            if (ratio > bestRatio) {
                bestRatio = ratio;
                bestPage = pageNum;
            }
        }

        // =========================
        // UPDATE ACTIVE PAGE (ONLY IF CHANGED)
        // =========================
        if (bestPage && bestPage !== currentPage) {
            currentPage = bestPage;
            updateActiveSidebar(bestPage);

            // 🔥 ADD THIS
            document.getElementById("pageInfo").innerText =
                `Page ${bestPage} / ${totalPages}`;
        }

    }, {
        root: viewer,
        threshold: [0.1, 0.25, 0.5, 0.75],
        rootMargin: "300px 0px"
    });

    // =========================
    // OBSERVE ALL PAGES
    // =========================
    requestAnimationFrame(() => {
        document.querySelectorAll(".page").forEach(p => {
            pageObserver.observe(p);
        });
    });
}




function getBaseWidth() {
    return document.querySelector(".pdf-viewer").clientWidth;
}



function toggleFullscreen() {
    const modal = document.getElementById("pdfModal");

    if (!document.fullscreenElement) {
        modal.requestFullscreen();

        // 🔥 FORCE FULL IMMERSION
        modal.classList.add("sidebar-hidden");
        modal.classList.add("true-fullscreen");

    } else {
        document.exitFullscreen();

        // 🔥 RESTORE NORMAL MODE
        modal.classList.remove("true-fullscreen");
    }

    // 🔥 re-render to recalc sizes
    setTimeout(() => initPageObserver(), 200);
}







//======================================================
// 🚀 PDF ZOOM SYSTEM (SINGLE SOURCE OF TRUTH)
//======================================================
// 🔥 FORCE STOP ALL ACTIVE RENDERS
activeRenders = 0;

document.querySelectorAll(".page").forEach(p => {
    if (p._renderTask) {
        try { p._renderTask.cancel(); } catch(e){}
    }
});
//======================================================
// 🎯 CORE ZOOM ENGINE (CLEAN + STABLE)
//======================================================
function applyZoom(newZoom, source = "unknown") {

    if (!pdfDoc) return;
    if (isRenderingPDF || zoomLock) return;

    const MIN_ZOOM = 0.15;
    const MAX_ZOOM = 3;

    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));

    if (Math.abs(clamped - currentZoom) < 0.01) return;

    // =========================
    // UPDATE ZOOM STATE FIRST
    // =========================
    currentZoom = clamped;
    updateZoomUI();

    renderGeneration++;

    // =========================
    // RESET RENDER STATE ONLY
    // =========================
    document.querySelectorAll(".page").forEach(p => {
        p.dataset.rendered = "0";
        p.dataset.rendering = "0";

        const canvas = p.querySelector("canvas");
        if (canvas) canvas.remove();
    });

    // =========================
    // RENDER AFTER LAYOUT STABILIZES
    // =========================
    requestAnimationFrame(() => {

        const pages = document.querySelectorAll(".page");

        pages.forEach(p => {
            renderPage(Number(p.dataset.page), p);
        });

        setTimeout(() => {
            initPageObserver();
        }, 50);
    });

    scrollLock = true;

    setTimeout(() => {
        scrollLock = false;
    }, 150);
}




window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);

    resizeTimeout = setTimeout(() => {
        if (zoomMode === "fit") {
            resetZoom();
        }
    }, 200);
});


//======================================================
// 🔘 ZOOM ACTIONS (NO LOGIC, ONLY CALL ENGINE)
//======================================================
const ZOOM_STEP = 0.05; // 5%

function pdfZoomIn() {
    if (!pdfDoc || isRenderingPDF) return;
    zoomMode = "user";
    applyZoom(currentZoom + ZOOM_STEP, "zoomIn");
}

function pdfZoomOut() {
    if (!pdfDoc || isRenderingPDF) return;
    zoomMode = "user";
    applyZoom(currentZoom - ZOOM_STEP, "zoomOut");
}

//======================================================
// 📐 FIT ZOOM (CLEAN + MOBILE SAFE)
//======================================================
function computeFitZoom(page) {

    const viewer = document.querySelector(".pdf-viewer");
    if (!viewer) return 1;

    const viewport = page.getViewport({ scale: 1 });

    const styles = getComputedStyle(viewer);

    const paddingX =
        parseFloat(styles.paddingLeft) +
        parseFloat(styles.paddingRight);

    const paddingY =
        parseFloat(styles.paddingTop) +
        parseFloat(styles.paddingBottom);

    const buffer = window.innerWidth < 600 ? 4 : 12;

    const availableWidth = viewer.clientWidth - paddingX - buffer;
    const availableHeight = viewer.clientHeight - paddingY - buffer;

    const scaleX = availableWidth / viewport.width;
    const scaleY = availableHeight / viewport.height;

    const scale = Math.min(scaleX, scaleY);

    // snap + clamp (stable zoom feel)
    const SNAP = 0.01;
    const snapped = Math.round(scale / SNAP) * SNAP;

    return Math.max(0.15, Math.min(snapped, 3));
}

//======================================================
// ♻️ RESET ZOOM (FIT MODE)
//======================================================
async function resetZoom() {

    if (isRenderingPDF || !pdfDoc) return;

    const viewer = document.querySelector(".pdf-viewer");

    if (!viewer) return;

    // IMPORTANT: wait for layout to settle
    requestAnimationFrame(async () => {

        const page = await pdfDoc.getPage(1);

        const fit = computeFitZoom(page);

        zoomMode = "fit";

        applyZoom(fit, "resetFit");
    });
}

//======================================================
// 🖱️ KEYBOARD CONTROLS
//======================================================
document.addEventListener("keydown", (e) => {

    const modalOpen = document.getElementById("pdfModal")
        ?.style.display.includes("flex");

    if (!modalOpen) return;

    if (e.key === "+") pdfZoomIn();
    if (e.key === "-") pdfZoomOut();

    if (e.key === "ArrowDown") {
        document.querySelector(".pdf-viewer")?.scrollBy(0, 300);
    }

    if (e.key === "ArrowUp") {
        document.querySelector(".pdf-viewer")?.scrollBy(0, -300);
    }
});

//======================================================
// 🔘 BUTTON CONTROLS
//======================================================
function initZoomButtonListeners() {

    console.log("🔧 initZoomButtonListeners CALLED");

    const inBtn = document.getElementById("btnZoomIn");
    const outBtn = document.getElementById("btnZoomOut");
    const fitBtn = document.getElementById("btnFitWidth");

    console.log("BTN CHECK:", {
        inBtn,
        outBtn,
        fitBtn
    });

    inBtn?.addEventListener("click", () => {
        console.log("🔥 ZOOM IN CLICKED");
        pdfZoomIn();
    });

    outBtn?.addEventListener("click", () => {
        console.log("🔥 ZOOM OUT CLICKED");
        pdfZoomOut();
    });

    fitBtn?.addEventListener("click", () => {
        console.log("🔥 FIT CLICKED");
        resetZoom();
    });
}


if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        console.log("📌 DOM READY");
        initZoomButtonListeners();
    });
} else {
    console.log("📌 DOM ALREADY READY");
    initZoomButtonListeners();
}

//======================================================
// 📱 RESPONSIVE ZOOM (AUTO FIT ON RESIZE)
//======================================================

//======================================================
// 🤏 PINCH ZOOM (MOBILE)
//======================================================
document.querySelector(".pdf-viewer")?.addEventListener("touchmove", (e) => {

    if (isZooming) return;
    if (e.touches.length !== 2) return;

    e.preventDefault();

    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (!lastTouchDistance) {
        lastTouchDistance = distance;
        return;
    }

    const delta = distance - lastTouchDistance;

    const ZOOM_SENSITIVITY = 25;

    if (Math.abs(delta) > ZOOM_SENSITIVITY) {
        delta > 0 ? pdfZoomIn() : pdfZoomOut();
        lastTouchDistance = distance;
    }
});

document.querySelector(".pdf-viewer")?.addEventListener("touchend", () => {
    lastTouchDistance = null;
});

//======================================================
// 🚫 CONTEXT MENU PROTECTION
//======================================================
document.addEventListener("contextmenu", (e) => {
    if (e.target.tagName === "IFRAME") e.preventDefault();
});

//======================================================
// 📊 UI UPDATE
//======================================================
function updateZoomUI() {
    document.getElementById("zoomLevel").innerText =
        Math.round(currentZoom * 100) + "%";
}















//BUILD THUMBNAILS
async function buildSidebar(pdf) {
    const sidebar = document.getElementById("pdfSidebar");
    sidebar.innerHTML = "";

    const thumbCache = new Map();

    for (let i = 1; i <= pdf.numPages; i++) {

        const page = await pdf.getPage(i);

        const viewport = page.getViewport({ scale: 0.2 });

        const wrapper = document.createElement("div");
        wrapper.className = "pdf-thumb";
        wrapper.dataset.page = i;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        wrapper.appendChild(canvas);

        const label = document.createElement("span");
        label.innerText = i;
        wrapper.appendChild(label);

        wrapper.onclick = () => {
            const target = document.querySelector(`.page[data-page="${i}"]`);
            target?.scrollIntoView({ behavior: "smooth", block: "center" });
        };

        sidebar.appendChild(wrapper);

        // prevent duplicate rendering
        if (!thumbCache.has(i)) {
            thumbCache.set(i, true);

            const renderTask = page.render({ canvasContext: ctx, viewport });
            renderTask.promise.catch(() => {});
        }
    }
}


//🔥 AUTO HIGHLIGHT CURRENT PAGE + AUTO SCROLL
function updateActiveSidebar(page) {
    const thumbs = document.querySelectorAll(".pdf-thumb");

    thumbs.forEach(t => {
        t.classList.toggle("active", parseInt(t.dataset.page) === page);
    });

    const active = document.querySelector(`.pdf-thumb[data-page="${page}"]`);
    if (active) {
        active.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }
}


//BACKGROUND SCROLL (CRITICAL FIX)
function lockScroll() {
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
}

function unlockScroll() {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
}

function toggleSidebar() {
    const modal = document.getElementById("pdfModal");
    modal.classList.toggle("sidebar-hidden");
}



function getStatus() {
    return document.getElementById("globalStatus");
}




async function downloadRenderedPDF() {

    const modal = document.querySelector(".pdf-modal");

    try {

        if (!pdfDoc) {
            Swal.fire({
                icon: "error",
                title: "No PDF loaded",
                text: "Please open a document first."
            });
            return;
        }

        Swal.fire({
            title: "Generating PDF",
            html: `
                <div class="loader"></div>
                <div id="progress-text">Preparing...</div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
        });

        const exportDoc = await PDFLib.PDFDocument.create();

        const DPR = 2;
        const exportScale = currentZoom; // 🔥 IMPORTANT: match viewer state

        for (let i = 1; i <= pdfDoc.numPages; i++) {

            const container = Swal.getHtmlContainer();
            const text = container?.querySelector("#progress-text");

            if (text) {
                text.innerText = `Rendering page ${i} / ${pdfDoc.numPages}`;
            }

            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: exportScale });

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            canvas.width = viewport.width * DPR;
            canvas.height = viewport.height * DPR;

            ctx.scale(DPR, DPR);

            // 🔥 SAME rendering style as viewer (no duplication logic)
            const renderTask = page.render({
                canvasContext: ctx,
                viewport
            });

            await renderTask.promise;

            // 🔥 reuse SAME watermark function (no duplication)
            drawWatermark(ctx, canvas);

            const imgData = canvas.toDataURL("image/png");
            const img = await exportDoc.embedPng(imgData);

            const pdfPage = exportDoc.addPage([
                viewport.width,
                viewport.height
            ]);

            pdfPage.drawImage(img, {
                x: 0,
                y: 0,
                width: viewport.width,
                height: viewport.height
            });
        }

        const bytes = await exportDoc.save();

        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = (currentFile || "document.pdf").split("/").pop();
        a.click();

        URL.revokeObjectURL(url);

        Swal.fire({
            icon: "success",
            title: "Download Complete",
            timer: 2000,
            showConfirmButton: false
        });

    } catch (err) {
        console.error(err);

        Swal.fire({
            icon: "error",
            title: "Download Failed",
            text: "Something went wrong while generating PDF."
        });

    } finally {
        if (modal) modal.style.filter = "none";
    }
}
//PDF SECURITY

//Disable right-click
document.addEventListener("contextmenu", e => e.preventDefault());

//✅ B. Disable drag download
document.addEventListener("dragstart", e => e.preventDefault());



//MOBILE RESPONSIVENESS (BASIC)
//1. CRITICAL MOBILE FIX: HANDLE ROTATION / RESIZE






//--------------------PDF SEARCH (OPTIMIZED)--------------------

let textCache = new Map();
let firstMatchFound = false;

// ✅ Cache page text (fast repeated searches)
async function getPageText(page, index) {
    if (textCache.has(index)) return textCache.get(index);

    const textContent = await page.getTextContent();
    const text = textContent.items
        .map(i => i.str)
        .join(" ")
        .toLowerCase();

    textCache.set(index, text);
    return text;
}

// ✅ MAIN SEARCH FUNCTION (FIXED)
async function searchPDF() {
    const input = document.getElementById("searchInput");
    const query = input.value.trim().toLowerCase();

    if (!query || !pdfDoc) return;

    firstMatchFound = false;

    const pages = document.querySelectorAll(".page");

    // clear previous highlights
    pages.forEach(p => (p.style.outline = "none"));

    // sequential async loop (stable + cached)
    const BATCH_SIZE = 3;

    for (let i = 0; i < pages.length; i += BATCH_SIZE) {

        const batch = pages.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (pageDiv, j) => {
            const index = i + j;

            const page = await pdfDoc.getPage(index + 1);
            const text = await getPageText(page, index);

            if (text.includes(query)) {
                pageDiv.style.outline = "4px solid yellow";

                if (!firstMatchFound) {
                    firstMatchFound = true;
                    pageDiv.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            }
        }));
    }
}




//🚀 6. MEMORY CLEANUP (IMPORTANT FOR MOBILE)
function closePDF() {

    const modal = document.getElementById("pdfModal");

    modal.style.display = "none";

    // =========================
    // 🛑 CANCEL ALL ACTIVE RENDERS FIRST
    // =========================
    document.querySelectorAll(".page").forEach(p => {
        if (p._renderTask) {
            try { p._renderTask.cancel(); } catch(e){}
        }
    });

    // =========================
    // 🔥 CLEAN UI
    // =========================
    document.getElementById("pdfContainer").innerHTML = "";
    document.getElementById("pdfSidebar").innerHTML = "";

    // =========================
    // 🔥 RESET PDF STATE
    // =========================
    pdfDoc = null;
    currentZoom = 1.0;
    currentPage = 1;
    renderGeneration++;
    totalPages = 0;

    // =========================
    // 🔥 RESET FLAGS
    // =========================
    isZooming = false;
    isRenderingPDF = false;
    zoomLock = false;
    lastTouchDistance = null;

    // =========================
    // 🔥 STOP OBSERVER
    // =========================
    if (pageObserver) {
        pageObserver.disconnect();
        pageObserver = null;
    }

    // =========================
    // 🧹 CLEAR CACHE
    // =========================
    renderedCache.clear();
    pdfCache.clear();
    textCache.clear();

    // =========================
    // 🔓 RESTORE SCROLL
    // =========================
    unlockScroll();
}