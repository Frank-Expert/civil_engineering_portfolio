// image_load.js

/* =====================
   GLOBAL IMAGE FALLBACK (early attach)
===================== */
document.addEventListener("error", (e) => {
    if (e.target && e.target.tagName === "IMG") {
        e.target.src = "assets/placeholder.jpg";
    }
}, true);


/* =====================
   AUTO PROJECT SLIDER (OPTIMIZED)
===================== */
function initAutoSliders() {
    const sliders = document.querySelectorAll(".slider");

    sliders.forEach((slider) => {
        const slides = slider.querySelector(".slides");
        const images = slider.querySelectorAll("img");

        const total = images.length;
        if (total <= 1) return;

        let index = 0;
        let interval = null;
        let isHovered = false;

        // Apply hardware acceleration for smoother animation
        slides.style.willChange = "transform";
        slides.style.transform = "translate3d(0,0,0)";

        function goToSlide(i) {
            index = (i + total) % total;
            slider.dataset.index = index;

            slides.style.transform = `translate3d(-${index * 100}%, 0, 0)`;
        }

        function startAutoSlide() {
            if (interval || isHovered) return;

            interval = setInterval(() => {
                goToSlide(index + 1);
            }, 3500);
        }

        function stopAutoSlide() {
            clearInterval(interval);
            interval = null;
        }

        function pause() {
            isHovered = true;
            stopAutoSlide();
        }

        function resume() {
            isHovered = false;
            startAutoSlide();
        }

        // Start slider
        startAutoSlide();

        // Events (passive improves scroll performance)
        slider.addEventListener("mouseenter", pause);
        slider.addEventListener("mouseleave", resume);

        // Touch support (important for mobile users)
        slider.addEventListener("touchstart", pause, { passive: true });
        slider.addEventListener("touchend", resume);

        // init index
        slider.dataset.index = "0";
    });
}


/* =====================
   SMART PRELOAD (first visible images only)
===================== */
function preloadFirstImages() {
    document.querySelectorAll(".slider").forEach(slider => {
        const imgs = slider.querySelectorAll("img");

        const count = Math.min(3, imgs.length);

        for (let i = 0; i < count; i++) {
            const img = imgs[i];

            // only preload if not already loaded
            if (!img.dataset.preloaded) {
                const preload = new Image();
                preload.src = img.src;
                img.dataset.preloaded = "true";
            }
        }
    });
}


function setupImageFallback() {
    document.querySelectorAll("img").forEach(img => {
        img.onerror = () => {
            img.src = "assets/placeholder.jpg";
        };
    });
}

/* =====================
   LAZY LOAD OPTIMIZER (optional boost)
   Forces first image to load early in viewport sliders
===================== */
function boostFirstImages() {
    document.querySelectorAll(".slider img:first-child").forEach(img => {
        img.loading = "eager";
        img.fetchPriority = "high";
    });
}


/* =====================
   INIT ON LOAD (SAFE ORDER)
===================== */
window.addEventListener("load", () => {
    boostFirstImages();
    setupImageFallback(); // optional legacy safety (can be removed if using global error handler)
    initAutoSliders();
    preloadFirstImages();
});