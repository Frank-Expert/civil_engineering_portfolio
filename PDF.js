//PDF.js

// ✅ PDF.js worker (MUST be before using pdfjs)
pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


let currentZoom = 1.0; // 100% default
let currentFile = "";
let renderTask = null;
let renderId = 0;

let totalPages = 0;
let currentPage = 1;
let isFitMode = false;
let pdfReady = false;
let isRenderingPDF = false;
let isZooming = false;
let renderGeneration = 0;
let pdfDoc = null;
let lastTouchDistance = null;
let scrollTick = false;
let firstMatchFound = false;

let pageObserver = null;


(() => {

let resizeTimeout = null;
// all PDF code here...

})();


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

/* =====================
   PDF MODAL
===================== */
function openPDF(file) {
    currentFile = file;
    pdfReady = false; // reset state
    document.getElementById("pdfModal").style.display = "flex";
    lockScroll();
    renderPDF(file);
}

function getAvailableViewport() {
    const viewer = document.querySelector(".pdf-viewer");

    const sidebar = document.querySelector(".pdf-sidebar");
    const sidebarHidden = document
        .querySelector(".pdf-modal")
        .classList.contains("sidebar-hidden");

    const sidebarWidth = (!sidebarHidden && sidebar) ? sidebar.offsetWidth : 0;

    return {
        width: viewer.clientWidth - sidebarWidth,
        height: viewer.clientHeight
    };
}


function detectPaperZoom(page) {
    const viewport = page.getViewport({ scale: 1 });

    const { width: vw, height: vh } = getAvailableViewport();

    const scaleX = vw / viewport.width;
    const scaleY = vh / viewport.height;

    const ratio = viewport.height / viewport.width;

    let scale;

    // 🔥 DETECT PAGE TYPE USING SHAPE

    if (ratio > 1.2) {
        // ✅ TALL PAGES (A4, Letter, A3 portrait)
        // → fit height like Adobe
        scale = scaleY;

    } else if (ratio < 0.8) {
        // ✅ WIDE / SHORT (PPT slides, landscape)
        // → fit width to avoid huge vertical gaps
        scale = scaleX;

    } else {
        // ✅ NORMAL / BALANCED (square-ish, mixed docs)
        // → safe fallback
        scale = Math.min(scaleX, scaleY);
    }

    // 🔒 SAFETY CLAMP (important)
    scale = Math.min(scale, 1.2);
    scale = Math.max(scale, 0.6);

    return scale;
}



const renderedCache = new Map();

function showRenderLoader() {
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

function renderPDF(file) {
    const container = document.getElementById("pdfContainer");
    container.innerHTML = "";

    const currentRender = ++renderId;

    isRenderingPDF = true;
    showRenderLoader();

    pdfjsLib.getDocument(file).promise
        .then(pdf => {

            if (currentRender !== renderId) return;

            pdfDoc = pdf;
            totalPages = pdf.numPages;

            setTimeout(() => buildSidebar(pdf), 0);

            for (let i = 1; i <= totalPages; i++) {
                const text = document.getElementById("progress-text");
                if (text) text.innerText = `Loading ${i} / ${totalPages}`;

                const pageDiv = document.createElement("div");
                pageDiv.className = "page";
                pageDiv.dataset.page = i;

                pageDiv.style.display = "flex";
                pageDiv.style.justifyContent = "center";
                pageDiv.style.alignItems = "center";

                container.appendChild(pageDiv);
            }

            setTimeout(() => initPageObserver(), 0);

            return pdf.getPage(1);
        })
        .then(page => {

            if (!page) return;

            currentZoom = detectPaperZoom(page);
            updateZoomUI();

            rerenderVisiblePages(true);

            isRenderingPDF = false;

            Swal.close(); // ✅ CLOSE ALWAYS HERE
        })
        .catch(err => {
            console.error(err);

            Swal.fire({
                icon: "error",
                title: "Failed to open PDF",
                text: "Something went wrong."
            });
        });
        //document.querySelectorAll(".page").forEach(p => pageObserver.observe(p));
}



function observePages() {
    const pages = document.querySelectorAll(".page");

    const observer = new IntersectionObserver(entries => {

        if (isZooming) return; // good

        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            const pageNum = parseInt(entry.target.dataset.page);
            renderPage(pageNum, entry.target);
        });

    }, {
        root: document.querySelector(".pdf-viewer"),
        threshold: 0.1
    });

    pages.forEach(p => observer.observe(p));
}






function renderPage(pageNum, container) {

    // 🔥 ignore outdated renders
    const myGeneration = renderGeneration;
    container.dataset.rendering = "1";

    const cacheKey = `${pageNum}-${currentZoom}`;

    // ⚡ CACHE HIT
    if (renderedCache.has(cacheKey)) {
        const cached = renderedCache.get(cacheKey);

        container.innerHTML = "";
        container.appendChild(cached.cloneNode(true));

        container.dataset.rendering = "0";
        return;
    }

    pdfDoc.getPage(pageNum).then(page => {

        // 🔥 if zoom changed mid-render → cancel
        if (myGeneration !== renderGeneration) return;

        const viewport = page.getViewport({ scale: currentZoom });

        const DPR = window.devicePixelRatio || 2;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = viewport.width * DPR;
        canvas.height = viewport.height * DPR;

        canvas.style.width = viewport.width + "px";
        canvas.style.height = viewport.height + "px";

        canvas.style.display = "block";
        canvas.style.opacity = "0";

        ctx.scale(DPR, DPR);

        container.innerHTML = "";
        container.appendChild(canvas);

        page.render({
            canvasContext: ctx,
            viewport
        }).promise.then(() => {

            // 🔥 still valid render?
            if (myGeneration !== renderGeneration) return;

            if (typeof drawWatermark === "function") {
                drawWatermark(ctx, canvas);
            }

            canvas.style.opacity = "1";

            const img = document.createElement("img");
            img.src = canvas.toDataURL("image/png");
            img.style.width = "100%";

            renderedCache.set(cacheKey, img);

            container.dataset.rendering = "0";

        }).catch(err => {
            container.dataset.rendering = "0";
        });
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


function searchPDF() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    if (!query) return;

    firstMatchFound = false;

    const pages = document.querySelectorAll(".page");

    pages.forEach((pageDiv, index) => {

        pdfDoc.getPage(index + 1).then(page => {
            page.getTextContent().then(textContent => {

                const text = textContent.items.map(i => i.str).join(" ").toLowerCase();

                if (text.includes(query)) {
                    pageDiv.style.outline = "4px solid yellow";

                    if (!firstMatchFound) {
                        pageDiv.scrollIntoView({ behavior: "smooth" });
                        firstMatchFound = true;
                    }

                } else {
                    pageDiv.style.outline = "none";
                }
            });
        });

    });
}





function initPageObserver() {

    if (pageObserver) pageObserver.disconnect();

    const viewer = document.querySelector(".pdf-viewer");

    pageObserver = new IntersectionObserver((entries) => {

        if (isZooming) return; // 🔥 freeze observer during zoom

        for (const entry of entries) {

            if (!entry.isIntersecting) continue;

            const pageNum = Number(entry.target.dataset.page);
            if (!pageNum) continue;

            renderPage(pageNum, entry.target);
        }

    }, {
        root: viewer,
        threshold: 0.15
    });

    document.querySelectorAll(".page").forEach(p => {
        pageObserver.observe(p);
    });
}


function getBaseWidth() {
    return document.querySelector(".pdf-viewer").clientWidth;
}

function resetZoom() {
    console.log("♻️ Resetting zoom to default");

    currentZoom = detectPaperZoom(pdfDoc.getPage(1));

    isFitMode = false;

    updateZoomUI();
    rerenderVisiblePages(true);
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
    setTimeout(() => rerenderVisiblePages(true), 200);
}



document.addEventListener("keydown", (e) => {
    if (!document.getElementById("pdfModal").style.display.includes("flex")) return;

    if (e.key === "+") zoomIn();
    if (e.key === "-") zoomOut();

    if (e.key === "ArrowDown") {
        document.querySelector(".pdf-viewer").scrollBy(0, 300);
    }

    if (e.key === "ArrowUp") {
        document.querySelector(".pdf-viewer").scrollBy(0, -300);
    }
});

function logZoom(action, oldZoom, newZoom) {
    console.log(
        `%cZOOM ${action}`,
        "color:#00aaff;font-weight:bold",
        `${oldZoom.toFixed(3)} → ${newZoom.toFixed(3)}`
    );
}



function initZoomButtonListeners() {
    const zoomInBtn = document.getElementById("btnZoomIn");
    const zoomOutBtn = document.getElementById("btnZoomOut");
    const fitBtn = document.getElementById("btnFitWidth");

    if (zoomInBtn) {
        zoomInBtn.onclick = () => {
            const prev = currentZoom;

            console.log("🔍 Zoom IN clicked");
            console.log(`📊 Zoom: ${prev.toFixed(3)} → ${(prev + 0.1).toFixed(3)}`);

            setZoom(currentZoom + 0.1, "ZOOM IN");
        };
    }

    if (zoomOutBtn) {
        zoomOutBtn.onclick = () => {
            const prev = currentZoom;

            console.log("🔍 Zoom OUT clicked");
            console.log(`📊 Zoom: ${prev.toFixed(3)} → ${(prev - 0.1).toFixed(3)}`);

            setZoom(currentZoom - 0.1, "ZOOM OUT");
        };
    }

    if (fitBtn) {
        fitBtn.onclick = () => {
            const prev = currentZoom;

            console.log("📐 Fit Width clicked (RESET MODE)");
            console.log(`📊 Zoom: ${prev.toFixed(3)} → RESET`);

            resetZoom();
        };
    }
}



document.addEventListener("DOMContentLoaded", initZoomButtonListeners);

//🚀 4. MOBILE ZOOM FIX (PINCH ZOOM READY)


document.querySelector(".pdf-viewer").addEventListener("touchmove", (e) => {
    if (e.touches.length !== 2) return;

    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (!lastTouchDistance) {
        lastTouchDistance = distance;
        return;
    }

    const delta = distance - lastTouchDistance;

    if (Math.abs(delta) > 10) {
        if (delta > 0) zoomIn();
        else zoomOut();
    }

    lastTouchDistance = distance;
});

document.querySelector(".pdf-viewer").addEventListener("touchend", () => {
    lastTouchDistance = null;
});


function setZoom(newZoom, source = "unknown") {
    const oldZoom = currentZoom;

    currentZoom = Math.max(0.5, Math.min(newZoom, 3));

    console.log(`🔍 ${source} | ${oldZoom.toFixed(3)} → ${currentZoom.toFixed(3)}`);

    // 🔥 invalidate ALL previous renders
    renderGeneration++;

    isZooming = true;

    renderedCache.clear();

    rerenderAllPages();

    updateZoomUI();

    setTimeout(() => {
        isZooming = false;
    }, 150);
}


function zoomIn() {
    setZoom(currentZoom + 0.1, "IN");
}

function zoomOut() {
    setZoom(currentZoom - 0.1, "OUT");
}



document.addEventListener("contextmenu", function (e) {
    if (e.target.tagName === "IFRAME") {
        e.preventDefault();
    }
});



function rerenderAllPages() {
    const pages = document.querySelectorAll(".page");

    renderedCache.clear();

    pages.forEach(pageDiv => {
        const pageNum = Number(pageDiv.dataset.page);
        renderPage(pageNum, pageDiv);
    });

    updateZoomUI();
}


function rerenderVisiblePages(force = false) {
    const viewer = document.querySelector(".pdf-viewer");
    const viewerRect = viewer.getBoundingClientRect();

    const pages = document.querySelectorAll(".page");

    pages.forEach(pageDiv => {
        const rect = pageDiv.getBoundingClientRect();

        const isVisible =
            rect.top < viewerRect.bottom &&
            rect.bottom > viewerRect.top;

        const pageNum = Number(pageDiv.dataset.page);
        if (!pageNum) return;

        if (isVisible || force) {
            renderPage(pageNum, pageDiv);
        }
    });

    updateZoomUI();
}


function updateZoomUI() {
    document.getElementById("zoomLevel").innerText =
        Math.round(currentZoom * 100) + "%";
}



function closePDF() {
    document.getElementById("pdfModal").style.display = "none";
    document.getElementById("pdfContainer").innerHTML = "";

    unlockScroll(); // 🔥 IMPORTANT FIX
}

/* =====================
   IMAGE MODAL
===================== */
function openImage(src) {
    const modal = document.getElementById("imgModal");
    const img = document.getElementById("modalImg");

    if (modal && img) {
        modal.style.display = "block";
        img.src = src;
    }
}

function closeImage() {
    const modal = document.getElementById("imgModal");

    if (modal) {
        modal.style.display = "none";
    }
}



//BUILD THUMBNAILS
function buildSidebar(pdf) {
    const sidebar = document.getElementById("pdfSidebar");
    sidebar.innerHTML = "";

    const renderThumb = async (i) => {
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
            target?.scrollIntoView({ behavior: "smooth" });
        };

        sidebar.appendChild(wrapper);

        page.render({ canvasContext: ctx, viewport });
    };

    // 🔥 IMPORTANT: schedule async batches (NON BLOCKING UI)
    let i = 1;

    function loop() {
        const end = Math.min(i + 2, pdf.numPages); // 2 at a time

        for (; i <= end; i++) {
            renderThumb(i);
        }

        if (i <= pdf.numPages) {
            requestAnimationFrame(loop); // smooth progressive loading
        }
    }

    loop();
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

        // =====================
        // UI LOADER
        // =====================
        Swal.fire({
            title: "Generating PDF",
            html: `
                <div class="loader"></div>
                <div id="progress-text" style="margin-top:10px;font-size:13px;">
                    Preparing...
                </div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
                if (modal) modal.style.filter = "blur(2px)";
            }
        });

        const exportDoc = await PDFLib.PDFDocument.create();

        const DPR = 2;            // 🔥 export sharpness multiplier (2–3 ideal)
        const exportScale = 2.5;  // base PDF rendering scale

        for (let i = 1; i <= pdfDoc.numPages; i++) {

            // =====================
            // PROGRESS UPDATE
            // =====================
            const container = Swal.getHtmlContainer();
            const text = container?.querySelector("#progress-text");

            if (text) {
                text.innerText = `Rendering page ${i} / ${pdfDoc.numPages}`;
            }

            const page = await pdfDoc.getPage(i);

            // =====================
            // HIGH QUALITY VIEWPORT
            // =====================
            const viewport = page.getViewport({ scale: exportScale });

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            // 🔥 HIGH DPI CANVAS (crisp output)
            canvas.width = viewport.width * DPR;
            canvas.height = viewport.height * DPR;

            canvas.style.width = viewport.width + "px";
            canvas.style.height = viewport.height + "px";

            ctx.scale(DPR, DPR);

            // =====================
            // RENDER PAGE
            // =====================
            await page.render({
                canvasContext: ctx,
                viewport
            }).promise;

            // =====================
            // WATERMARK
            // =====================
            if (typeof drawWatermark === "function") {
                drawWatermark(ctx, canvas);
            }

            // =====================
            // EXPORT IMAGE (KEEP PNG ONLY)
            // =====================
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

        // =====================
        // FINALIZING
        // =====================
        const container = Swal.getHtmlContainer();
        const text = container?.querySelector("#progress-text");

        if (text) text.innerText = "Finalizing PDF...";

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
            text: "Your PDF is ready!",
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

window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);

    resizeTimeout = setTimeout(async () => {
        if (!pdfDoc) return;

        console.log("📱 viewport changed → rerender");

        try {
            const page = await pdfDoc.getPage(1);

            currentZoom = detectPaperZoom(page);

            rerenderVisiblePages(true);
            updateZoomUI();

        } catch (err) {
            console.error("Resize render error:", err);
        }

    }, 250);
});

//🚀 6. MEMORY CLEANUP (IMPORTANT FOR MOBILE)
function closePDF() {
    document.getElementById("pdfModal").style.display = "none";
    document.getElementById("pdfContainer").innerHTML = "";

    pdfDoc = null;
    renderedCache.clear();

    unlockScroll();
}

