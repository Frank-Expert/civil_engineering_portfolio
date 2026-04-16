// =====================script.js=====================

function toggleMenu(e) {
    e.stopPropagation(); // 🛑 prevents instant close
    document.querySelector(".navbar").classList.toggle("active");
}

// ✅ AUTO-CLOSE WHEN A LINK IS CLICKED
document.querySelectorAll(".navbar ul a").forEach(link => {
    link.addEventListener("click", () => {
        document.querySelector(".navbar").classList.remove("active");
    });
});

// ✅ CLOSE WHEN CLICKING OUTSIDE
document.addEventListener("click", (e) => {
    const nav = document.querySelector(".navbar");

    // if click is NOT inside navbar
    if (!nav.contains(e.target)) {
        nav.classList.remove("active");
    }
});


// Smooth scroll effect
/* =====================
   SMOOTH SCROLL
===================== */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function (e) {
        e.preventDefault();

        const target = document.querySelector(this.getAttribute("href"));
        if (target) {
            target.scrollIntoView({
                behavior: "smooth"
            });
        }
    });
});


/* =====================
   TAB SWITCHING
===================== */
function showTab(tabName) {
    const tabs = document.querySelectorAll(".tab");

    tabs.forEach(tab => tab.classList.remove("active"));

    const activeTab = document.getElementById(tabName);
    if (activeTab) {
        activeTab.classList.add("active");
    }
}



function animateSkills() {
    const skills = document.querySelectorAll(".skill");

    skills.forEach(skill => {
        const bar = skill.querySelector(".bar");
        const fill = skill.querySelector(".fill");
        const percent = skill.querySelector(".percent");

        if (!bar || !fill || !percent) return;

        const value = parseInt(bar.dataset.value);
        const position = bar.getBoundingClientRect().top;

        if (position < window.innerHeight - 80 && !bar.classList.contains("done")) {

            bar.classList.add("done");

            // 🔥 CSS handles animation width
            bar.style.setProperty("--value", value + "%");
            bar.classList.add("active");

            // 🔥 counter animation only
            let count = 0;

            const timer = setInterval(() => {
                count++;
                percent.textContent = count + "%";

                if (count >= value) {
                    clearInterval(timer);
                }
            }, 20);
        }
    });
}

window.addEventListener("scroll", animateSkills);
window.addEventListener("load", animateSkills);




const FILES = {
    resume: "portfolio/frankline_civil_engineering_resume.pdf",

    portfolio: {
        "Architectural": "portfolio/architectural_portfolio.pdf",
        "Structural": "portfolio/structural_portfolio.pdf",
        "Quantity Survey": "portfolio/quantity_survey_portfolio.pdf"
    }
};

const portfolioFiles = FILES.portfolio;


let requestedDoc = "";
/* OPEN MODAL */


function requestDocument(type) {
    requestedDoc = type;

    const actions = document.querySelector(".modal-actions");
    const options = document.getElementById("portfolioOptions");
    const label = document.getElementById("portfolioLabel");

    const viewBtn = document.getElementById("viewBtn");
    const downloadBtn = document.getElementById("downloadBtn");

    const inputs = document.querySelectorAll("#portfolioOptions input");
    const requestText = document.getElementById("requestText");

    // =====================
    // RESET (IMPORTANT)
    // =====================
    inputs.forEach(input => {
        input.checked = false;
        input.type = "checkbox";
        input.name = "";
    });

    // ALWAYS hide both buttons first
    viewBtn.style.display = "none";
    downloadBtn.style.display = "none";
    actions.style.display = "flex";

    options.classList.remove("show");
    options.style.display = "none";

    // =====================
    // PORTFOLIO VIEW
    // =====================
    if (type === "Portfolio View") {

        requestText.innerText = "Select a portfolio";

        options.classList.add("show");
        options.style.display = "block";

        label.innerText = ""; // or hide it completely

        inputs.forEach(input => {
            input.type = "radio";
            input.name = "portfolioView";
        });

        viewBtn.style.display = "inline-block";
        actions.style.display = "none";
    }

    // =====================
    // PORTFOLIO DOWNLOAD
    // =====================
    else if (type === "Portfolio") {

        requestText.innerText = "Select portfolio(s) to download";

        options.classList.add("show");
        options.style.display = "block";

        label.innerText = "Select Portfolio Type(s):";

        // ✅ ONLY HERE download button appears
        downloadBtn.style.display = "inline-block";
    }

    // =====================
    // RESUME (IMPORTANT FIX)
    // =====================
    else if (type === "Resume") {

        requestText.innerText = "Download Resume";

        options.style.display = "none";

        viewBtn.style.display = "none";
        downloadBtn.style.display = "none"; // IMPORTANT

        actions.style.display = "flex";
    }

    // =====================
    // OTHER
    // =====================
    else {

        requestText.innerText = "Request " + type;

        options.classList.remove("show");
        options.style.display = "none";

        downloadBtn.style.display = "none";
        viewBtn.style.display = "none";
    }

    // =====================
    // OPEN MODAL
    // =====================
    document.getElementById("requestModal").classList.add("show");
}



function openResume() {
    openPDF(FILES.resume);
}

function viewSelectedPortfolio() {
    const selected = document.querySelector(
        "#portfolioOptions input[type='radio']:checked"
    );

    if (!selected) {
        alert("Please select a portfolio to view.");
        return;
    }

    const file = portfolioFiles[selected.value];

    closeRequest();
    openPDF(file);
}


function getSelectedPortfolios() {
    const checked = document.querySelectorAll(
        "#portfolioOptions input[type='checkbox']:checked"
    );

    return Array.from(checked).map(cb => cb.value);
}


/* CLOSE MODAL */
function closeRequest() {
    document.getElementById("requestModal").classList.remove("show");
}


// =====================
// OPEN PROJECT MODAL (ISOLATED)
// =====================
function openProjectModal() {

    // ONLY TOUCH PROJECT MODAL
    const projectModal = document.getElementById("projectModal");

    if (!projectModal) return;

    // open ONLY this modal
    projectModal.classList.add("show");

    // optional: prevent background scroll ONLY for this modal
    document.body.dataset.activeModal = "project";
}


const cta = document.querySelector(".hero-project-cta");
const hero = document.querySelector(".hero");

window.addEventListener("scroll", () => {
    if (!cta || !hero) return;

    const heroBottom = hero.getBoundingClientRect().bottom;

    if (heroBottom < 0) {
        cta.classList.add("sticky");
    } else {
        cta.classList.remove("sticky");
    }
});

document.addEventListener("keydown", function (e) {
    // Ctrl + P (print)
    if (e.ctrlKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        alert("Printing is disabled");
    }

    // Ctrl + S (save)
    if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        alert("Saving is disabled");
    }

    // Ctrl + U (view source)
    if (e.ctrlKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
    }

    // F12 (DevTools)
    if (e.key === "F12") {
        e.preventDefault();
    }
});





//ARCHITECTURAL, structural and civil SECTION
let expanded = false;

function toggleSection(id, btn) {
    const allSections = document.querySelectorAll(".gallery-hidden");
    const allButtons = document.querySelectorAll(".gallery-toggle button");

    const target = document.getElementById(id);
    const isOpening = !target.classList.contains("show");

    // 🔥 CLOSE ALL FIRST
    allSections.forEach(sec => sec.classList.remove("show"));
    allButtons.forEach(b => b.innerText = "Show More");

    // 🔥 OPEN ONLY IF IT WAS CLOSED
    if (isOpening) {
        target.classList.add("show");
        btn.innerText = "Show Less";
    }
}




/* =====================
   AUTO PROJECT SLIDER
===================== */

function initAutoSliders() {
    const sliders = document.querySelectorAll(".slider");

    sliders.forEach((slider) => {
        const slides = slider.querySelector(".slides");
        const images = slider.querySelectorAll("img");

        let index = 0;
        const total = images.length;

        if (total <= 1) return;

        function goToSlide(i) {
            index = (i + total) % total;
            slider.dataset.index = index;
            slides.style.transform = `translateX(-${index * 100}%)`;
        }

        function nextSlide() {
            goToSlide(index + 1);
        }

        let interval = setInterval(nextSlide, 3500);

        // pause on hover
        slider.addEventListener("mouseenter", () => {
            clearInterval(interval);
        });

        slider.addEventListener("mouseleave", () => {
            interval = setInterval(nextSlide, 3500);
        });

        // store index globally for consistency
        slider.dataset.index = 0;
    });
}
/* RUN ON LOAD */
window.addEventListener("load", initAutoSliders);















//=====================NEW PROJECT FORM=========================
// =====================
// PROJECT INTAKE FORM
// =====================

// OPEN / CLOSE MODAL
function openProjectForm() {
    document.getElementById("projectModal").classList.add("show");
}

function toggleOtherProjectType() {
    const type = document.getElementById("projectType").value;
    const other = document.getElementById("otherProjectType");

    other.style.display = (type === "Other") ? "block" : "none";
}

function toggleServiceCheckbox(row, event) {

    // prevent input clicks from toggling
    if (event && event.target.closest(".budget-input")) return;

    const checkbox = row.querySelector("input[type='checkbox']");
    if (!checkbox) return;

    checkbox.checked = !checkbox.checked;
}


//Prevent clicking budget inputs from toggling checkbox:
document.querySelectorAll("#projectModal .budget-input").forEach(input => {
    input.addEventListener("click", function (e) {
        e.stopPropagation();
    });
});

function closeProjectForm() {
    const projectModal = document.getElementById("projectModal");

    if (!projectModal) return;

    projectModal.classList.remove("show");

    document.body.removeAttribute("data-active-modal");
}

// GET SELECTED SERVICES (checkboxes inside modal)
function getSelectedServices() {
    const rows = document.querySelectorAll("#projectModal .service-row");

    const services = [];

    rows.forEach(row => {
        const checkbox = row.querySelector("input[type='checkbox']");
        if (!checkbox || !checkbox.checked) return;

        const name = checkbox.value;

        const min = row.querySelector(".budget-input:nth-of-type(1)")?.value || "";
        const max = row.querySelector(".budget-input:nth-of-type(2)")?.value || "";

        services.push({
            name,
            min,
            max
        });
    });

    return services;
}


// =====================
// SUBMIT PROJECT (WHATSAPP / EMAIL)
// =====================
// =====================
// SUBMIT PROJECT (WHATSAPP / EMAIL)
// =====================
function submitProject(method) {

    // =====================
    // COLLECT FORM DATA
    // =====================
    const name = document.getElementById("clientName").value.trim();
    const phone = document.getElementById("clientPhone").value.trim();
    const email = document.getElementById("clientEmail").value.trim();
    const type = document.getElementById("projectType").value;
    const currency = document.getElementById("projectCurrency").value;
    const desc = document.getElementById("projectDescription").value.trim();

    const services = getSelectedServices();

    // =====================
    // FORMAT SERVICES TEXT
    // =====================
    let servicesText = "None selected";

    if (services.length) {
        servicesText = services.map(s =>
            `${s.name} (Min: ${s.min || "-"} ${currency}, Max: ${s.max || "-"} ${currency})`
        ).join("\n");
    }

    // =====================
    // FORMAT MESSAGE
    // =====================
    const message = `NEW PROJECT INQUIRY

Name: ${name || "Not provided"}
Phone: ${phone || "Not provided"}
Email: ${email || "Not provided"}

Project Type: ${type || "Not selected"}
Currency: ${currency || "Not selected"}

Services Needed:
${servicesText}

Description:
${desc || "No description provided"}
`;

    // =====================
    // SEND VIA WHATSAPP
    // =====================
    if (method === "whatsapp") {
        const phoneNumber = "254716770021";

        const url =
            "https://wa.me/" +
            phoneNumber +
            "?text=" +
            encodeURIComponent(message);

        window.open(url, "_blank");
    }

    // =====================
    // SEND VIA EMAIL
    // =====================
    if (method === "email") {
        const emailAddress = "ambetsafrankline@gmail.com";

        const mailto =
            "mailto:" +
            emailAddress +
            "?subject=" +
            encodeURIComponent("New Project Inquiry") +
            "&body=" +
            encodeURIComponent(message);

        window.open(mailto, "_blank");
    }

    // =====================
    // CLOSE MODAL AFTER SEND
    // =====================
    closeProjectForm();
}