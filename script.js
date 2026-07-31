const magazine = document.getElementById("magazine");
const leavesContainer = document.getElementById("pages");
const prevButton = document.getElementById("nav-prev");
const nextButton = document.getElementById("nav-next");
const menuContentsButton = document.getElementById("menu-contents");
const menuHomeButton = document.getElementById("menu-home");
const pageCurrentEl = document.getElementById("page-current");
const pageTotalEl = document.getElementById("page-total");
const readingProgressFill = document.getElementById("reading-progress-fill");

let leaves = [];
let flippedCount = 0;
let isAnimating = false;

const PAGE_STORAGE_KEY = "must-watch-current-page";

function buildLeaves() {
    leaves = Array.from(leavesContainer.children);

    const saved = parseInt(localStorage.getItem(PAGE_STORAGE_KEY), 10);
    flippedCount = Number.isInteger(saved)
        ? Math.min(Math.max(saved, 0), leaves.length)
        : 0;

    updateLeaves();
    updateStatsPanel();
    initStatsPanelInteraction();

    if (pageTotalEl) {
        pageTotalEl.textContent = leaves.length;
    }
}

const TITLE_MIN_SCALE = 0.62;
const TITLE_STEP_PX = 1;

function fitTitleFont(titleEl) {
    if (!titleEl) return;

    if (!titleEl.dataset.baseFontSize) {
        titleEl.dataset.baseFontSize = parseFloat(getComputedStyle(titleEl).fontSize);
    }

    const baseFontSize = parseFloat(titleEl.dataset.baseFontSize);
    const minFontSize = baseFontSize * TITLE_MIN_SCALE;

    let fontSize = baseFontSize;
    titleEl.style.fontSize = fontSize + "px";

    const prevWhiteSpace = titleEl.style.whiteSpace;
    titleEl.style.whiteSpace = "nowrap";

    while (
        titleEl.scrollWidth > titleEl.clientWidth &&
        fontSize > minFontSize
    ) {
        fontSize -= TITLE_STEP_PX;
        titleEl.style.fontSize = fontSize + "px";
    }

    titleEl.style.whiteSpace = prevWhiteSpace || "";
}

// Підганяємо шрифт заголовка лише для конкретного листка (а не для всіх одразу),
// щоб зі зростанням кількості фільмів (100+) сторінка не гальмувала.
function fitTitlesForLeaf(leaf) {
    if (!leaf) return;
    leaf.querySelectorAll(".movie-title").forEach(fitTitleFont);
}

// Той самий діапазон, що й вікно завантаження картинок: поточний листок + сусідні.
function getVisibleLeaves() {
    const current = flippedCount;
    return [current - 1, current, current + 1]
        .filter((i) => i >= 0 && i < leaves.length)
        .map((i) => leaves[i]);
}

function fitVisibleTitles() {
    getVisibleLeaves().forEach(fitTitlesForLeaf);
}

if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => fitVisibleTitles());
}

let titleFitResizeTimeout = null;
window.addEventListener("resize", () => {
    clearTimeout(titleFitResizeTimeout);
    titleFitResizeTimeout = setTimeout(fitVisibleTitles, 150);
});

function computeCategoryCounts() {
    const counts = { movie: 0, series: 0, cartoon: 0, anime: 0 };

    leaves.forEach((leaf) => {
        const category = leaf.dataset.category;
        if (category && Object.prototype.hasOwnProperty.call(counts, category)) {
            counts[category]++;
        }
    });

    return counts;
}

function getStatCategory(statEl) {
    const catClass = Array.from(statEl.classList).find((c) => c.startsWith("cat-"));
    return catClass ? catClass.replace("cat-", "") : null;
}

function updateStatsPanel() {
    const counts = computeCategoryCounts();

    document.querySelectorAll(".stats-panel .stat").forEach((statEl) => {
        const category = getStatCategory(statEl);
        if (!category) return;

        const numberEl = statEl.querySelector(".number");
        if (numberEl && Object.prototype.hasOwnProperty.call(counts, category)) {
            numberEl.textContent = counts[category];
        }
    });
}

function jumpToCategory(category) {
    const index = leaves.findIndex((leaf) => leaf.dataset.category === category);
    if (index !== -1) jumpToLeaf(index);
}

function initStatsPanelInteraction() {
    document.querySelectorAll(".stats-panel .stat").forEach((statEl) => {
        const category = getStatCategory(statEl);
        if (!category) return;

        statEl.setAttribute("role", "button");
        statEl.setAttribute("tabindex", "0");

        statEl.addEventListener("click", (e) => {
            e.stopPropagation();
            jumpToCategory(category);
        });

        statEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                jumpToCategory(category);
            }
        });
    });
}

function updateLeaves() {
    const total = leaves.length;

    leaves.forEach((leaf, i) => {
        const isFlipped = i < flippedCount;

        leaf.classList.toggle("flipped", isFlipped);
        leaf.style.zIndex = isFlipped
            ? i + 1
            : total - i + flippedCount;
    });

    magazine.classList.toggle("closed", flippedCount === 0);
    magazine.classList.toggle(
        "finished",
        flippedCount === total
    );

    prevButton.disabled = flippedCount === 0;
    nextButton.disabled = flippedCount >= total - 1;

    localStorage.setItem(PAGE_STORAGE_KEY, flippedCount);

    if (pageCurrentEl) {
        pageCurrentEl.textContent = Math.min(flippedCount + 1, total);
    }

    if (readingProgressFill) {
        const pct = total > 1 ? (flippedCount / (total - 1)) * 100 : 0;
        readingProgressFill.style.width = pct + "%";
    }

    manageImageWindow();
}

function getLangSrc(img) {
    return currentLang === "ua"
        ? (img.dataset.srcUa || img.dataset.srcEn)
        : (img.dataset.srcEn || img.dataset.srcUa);
}

function loadLeafImages(leaf) {
    if (!leaf) return;

    leaf.querySelectorAll("img[data-src-ua], img[data-src-en]").forEach((img) => {
        const wanted = getLangSrc(img);
        if (wanted && img.getAttribute("src") !== wanted) {
            img.src = wanted;
        }
        img.classList.add("is-loaded");
    });

    // Підганяємо заголовок саме зараз, коли листок став видимим
    // (у т.ч. після зміни мови чи ресайзу, коли текст/ширина могли змінитись).
    fitTitlesForLeaf(leaf);
}

function unloadLeafImages(leaf) {
    if (!leaf) return;

    leaf.querySelectorAll("img[data-src-ua], img[data-src-en]").forEach((img) => {
        if (img.hasAttribute("src")) {
            img.removeAttribute("src");
        }
        img.classList.remove("is-loaded");
    });
}

function manageImageWindow() {
    const current = flippedCount;
    const keep = new Set([current - 1, current, current + 1]);

    leaves.forEach((leaf, i) => {
        if (keep.has(i)) {
            loadLeafImages(leaf);
        } else {
            unloadLeafImages(leaf);
        }
    });
}

function getAlphabet(lang) {
    return lang === "ua"
        ? "АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ".split("")
        : "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
}

function getMovieLeaves() {
    return leaves
        .map((leaf, index) => ({ leaf, index }))
        .filter(({ leaf }) => leaf.classList.contains("leaf-spread"));
}

function renderContents(lang) {
    const container = document.getElementById("contents-grid");
    if (!container || !leaves.length) return;

    const alphabet = getAlphabet(lang);
    const groups = new Map();
    const hashGroup = [];

    getMovieLeaves().forEach(({ leaf, index }) => {
        const titleEl = leaf.querySelector(".movie-title");
        if (!titleEl) return;

        const title = (lang === "ua" ? titleEl.dataset.ua : titleEl.dataset.en) || "";
        const firstChar = title.trim().charAt(0).toUpperCase();
        const category = leaf.dataset.category || "";
        const entry = { title, index, category };

        if (alphabet.includes(firstChar)) {
            if (!groups.has(firstChar)) groups.set(firstChar, []);
            groups.get(firstChar).push(entry);
        } else {
            hashGroup.push(entry);
        }
    });

    container.innerHTML = "";

    alphabet.forEach((letter) => {
        if (groups.has(letter)) {
            container.appendChild(buildContentsSection(letter, groups.get(letter), lang));
        }
    });

    if (hashGroup.length) {
        container.appendChild(buildContentsSection("#", hashGroup, lang));
    }
}

// Категорія -> літера коду, окремо для кожної мови
// EN: F = film, S = series, C = cartoon, A = anime
// UA: К = кіно, С = серіали, М = мультфільми, А = аніме
const CATEGORY_CODE = {
    en: { movie: "F", series: "S", cartoon: "C", anime: "A" },
    ua: { movie: "К", series: "С", cartoon: "М", anime: "А" },
};

function buildLetterCode(entries, lang) {
    const codeMap = CATEGORY_CODE[lang] || CATEGORY_CODE.en;
    const order = ["movie", "series", "cartoon", "anime"];

    const counts = {};
    order.forEach((cat) => { counts[cat] = 0; });

    entries.forEach(({ category }) => {
        if (Object.prototype.hasOwnProperty.call(counts, category)) {
            counts[category] += 1;
        }
    });

    const parts = order.map((cat) => `${codeMap[cat]}${counts[cat]}`);
    return `(${parts.join("; ")})`;
}

function buildContentsSection(letter, entries, lang) {
    const section = document.createElement("div");
    section.className = "contents-section";

    const heading = document.createElement("div");
    heading.className = "contents-letter-heading";
    heading.textContent = `${letter} ${buildLetterCode(entries, lang)}`;
    section.appendChild(heading);

    entries.forEach(({ title, index }) => {
        const row = document.createElement("div");
        row.className = "contents-entry";

        const titleSpan = document.createElement("span");
        titleSpan.className = "entry-title";
        titleSpan.textContent = title;

        const leader = document.createElement("span");
        leader.className = "entry-leader";

        const page = document.createElement("span");
        page.className = "entry-page";
        page.textContent = String(index).padStart(2, "0");

        row.append(titleSpan, leader, page);
        row.addEventListener("click", (e) => {
            e.stopPropagation();
            jumpToLeaf(index);
        });

        section.appendChild(row);
    });

    return section;
}

function jumpToLeaf(index) {
    if (isAnimating || index < 0 || index >= leaves.length) return;

    closeMovieInfo();

    flippedCount = index;
    updateLeaves();
}

// Спливаюче вікно з описом фільму (мобільна версія)
const infoOverlay = document.getElementById("info-overlay");

function openMovieInfo(leafSpread) {
    if (!leafSpread) return;
    closeMovieInfo();
    leafSpread.classList.add("movie-info-open");
    document.body.classList.add("movie-info-open");
}

function closeMovieInfo() {
    document.querySelectorAll(".leaf-spread.movie-info-open").forEach((leaf) => {
        leaf.classList.remove("movie-info-open");
    });
    document.body.classList.remove("movie-info-open");
}

leavesContainer.addEventListener("click", (e) => {
    const infoBtn = e.target.closest(".info-btn");
    if (infoBtn) {
        e.stopPropagation();
        const leafSpread = infoBtn.closest(".leaf-spread");
        if (leafSpread.classList.contains("movie-info-open")) {
            closeMovieInfo();
        } else {
            openMovieInfo(leafSpread);
        }
        return;
    }

    const closeBtn = e.target.closest(".info-close");
    if (closeBtn) {
        e.stopPropagation();
        closeMovieInfo();
    }
});

if (infoOverlay) {
    infoOverlay.addEventListener("click", () => closeMovieInfo());
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMovieInfo();
});

nextButton.addEventListener("click", () => jumpToLeaf(flippedCount + 1));
prevButton.addEventListener("click", () => jumpToLeaf(flippedCount - 1));

// Свайп для гортання сторінок на тф (замінює стрілки, які там приховані)
const SWIPE_MIN_DISTANCE = 45;
const SWIPE_MAX_OFF_AXIS = 60;
let touchStartX = 0;
let touchStartY = 0;

magazine.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: true });

magazine.addEventListener("touchend", (e) => {
    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dy) > SWIPE_MAX_OFF_AXIS) return;

    // Миттєвий перехід (без анімації перегортання), щоб одразу можна було свайпнути далі
    if (dx < 0) {
        jumpToLeaf(flippedCount + 1);
    } else {
        jumpToLeaf(flippedCount - 1);
    }
}, { passive: true });

menuHomeButton.addEventListener("click", (e) => {
    e.stopPropagation();

    closeMovieInfo();
    flippedCount = 0;
    updateLeaves();

    document.body.classList.remove("mobile-menu-open");
});

menuContentsButton.addEventListener("click", (e) => {
    e.stopPropagation();

    const contentsIndex = leaves.findIndex((leaf) =>
        leaf.classList.contains("leaf-contents")
    );

    if (contentsIndex !== -1) {
        jumpToLeaf(contentsIndex);
    }

    document.body.classList.remove("mobile-menu-open");
});

const langOptions = document.querySelectorAll(".lang-option");
const LANG_STORAGE_KEY = "must-watch-current-lang";

const savedLang = localStorage.getItem(LANG_STORAGE_KEY);
let currentLang = savedLang === "en" ? "en" : "ua";

const categoryWords = {
    movie: { ua: "фільм", en: "film" },
    series: { ua: "серіал", en: "series" },
    cartoon: { ua: "мультфільм", en: "cartoon" },
    anime: { ua: "аніме", en: "anime" }
};

function highlightCategoryWord(el, lang) {
    const wrapper = el.closest("[data-category]");
    if (!wrapper) return;

    const words = categoryWords[wrapper.dataset.category];
    if (!words) return;

    const word = words[lang];
    const regex = new RegExp(`(^|[^\\p{L}])(${word}\\p{L}*)`, "iu");

    el.innerHTML = el.textContent.replace(
        regex,
        (match, before, matchedWord) =>
            `${before}<span class="cat-word cat-${wrapper.dataset.category}">${matchedWord}</span>`
    );
}

function applyLanguage(lang) {
    document.querySelectorAll("[data-ua]").forEach((el) => {
        el.textContent = lang === "ua" ? el.dataset.ua : el.dataset.en;
    });

    document.querySelectorAll(".desc-text").forEach((el) => {
        highlightCategoryWord(el, lang);
    });

    langOptions.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.lang === lang);
    });

    localStorage.setItem(LANG_STORAGE_KEY, lang);

    if (leaves.length) {
        manageImageWindow();
        renderContents(lang);
    }
}

langOptions.forEach((btn) => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();

        const lang = btn.dataset.lang;
        if (lang !== currentLang) {
            currentLang = lang;
            applyLanguage(currentLang);
        }

        document.body.classList.remove("mobile-menu-open");
    });
});

const mobileMenuToggle = document.getElementById("mobile-menu-toggle");

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        document.body.classList.toggle("mobile-menu-open");
    });

    document.addEventListener("click", (e) => {
        if (!document.body.classList.contains("mobile-menu-open")) return;

        const langSwitch = document.getElementById("translate-global");
        const sideMenu = document.getElementById("side-menu");

        const clickedInside =
            mobileMenuToggle.contains(e.target) ||
            (langSwitch && langSwitch.contains(e.target)) ||
            (sideMenu && sideMenu.contains(e.target));

        if (!clickedInside) {
            document.body.classList.remove("mobile-menu-open");
        }
    });
}

buildLeaves();
applyLanguage(currentLang);