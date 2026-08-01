const magazine = document.getElementById("magazine");
const leavesContainer = document.getElementById("pages");
const menuContentsButton = document.getElementById("menu-contents");
const menuHomeButton = document.getElementById("menu-home");
const pageCurrentEl = document.getElementById("page-current");
const pageTotalEl = document.getElementById("page-total");
const readingProgressEl = document.getElementById("reading-progress");

let leaves = [];
let progressSegments = [];
let flippedCount = 0;
let isAnimating = false;

const PAGE_STORAGE_KEY = "must-watch-current-page";

// Іконки та кольори категорій — те саме, що й у бічному меню, використовуються як "символ" на смужці прогресу
const CATEGORY_ICONS = {
    movie: "🎬",
    series: "📺",
    cartoon: "🎨",
    anime: "⛩"
};

const CATEGORY_COLORS = {
    movie: "var(--col-movie)",
    series: "var(--col-series)",
    cartoon: "var(--col-cartoon)",
    anime: "var(--col-anime)"
};

function getLeafSymbol(leaf) {
    const category = leaf.dataset.category;
    if (category && CATEGORY_ICONS[category]) return CATEGORY_ICONS[category];
    if (leaf.classList.contains("leaf-cover")) return "🏠";
    if (leaf.classList.contains("leaf-contents")) return "🧭";
    if (leaf.classList.contains("leaf-back")) return "🏁";
    return "•";
}

// Будуємо смужку прогресу — по одному сегменту на кожну сторінку, у стилі Instagram Stories
function buildProgressSegments() {
    if (!readingProgressEl) return;
    readingProgressEl.innerHTML = "";
    progressSegments = leaves.map((leaf) => {
        const segment = document.createElement("div");
        segment.className = "progress-segment";

        const category = leaf.dataset.category;
        if (category && CATEGORY_COLORS[category]) {
            segment.style.setProperty("--seg-color", CATEGORY_COLORS[category]);
        }

        const symbol = document.createElement("span");
        symbol.className = "progress-symbol";
        symbol.textContent = getLeafSymbol(leaf);
        segment.appendChild(symbol);

        readingProgressEl.appendChild(segment);
        return segment;
    });
}

function updateProgressSegments() {
    progressSegments.forEach((segment, i) => {
        segment.classList.toggle("is-read", i < flippedCount);
        segment.classList.toggle("is-current", i === Math.min(flippedCount, leaves.length - 1));
    });
}

function buildLeaves() {
    leaves = Array.from(leavesContainer.children);

    const saved = parseInt(localStorage.getItem(PAGE_STORAGE_KEY), 10);
    flippedCount = Number.isInteger(saved)
        ? Math.min(Math.max(saved, 0), leaves.length)
        : 0;

    buildProgressSegments();
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

let categoryFilter = null;

function jumpToCategory(category) {
    const index = leaves.findIndex((leaf) => leaf.dataset.category === category);
    if (index !== -1) jumpToLeaf(index);
}

function updateCategoryFilterUI() {
    document.querySelectorAll(".side-menu-cat").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.category === categoryFilter);
    });
}

// Клік по категорії вмикає/вимикає фільтр: доки він активний,
// гортання колесом і свайпом пропускає листки інших категорій.
function setCategoryFilter(category) {
    categoryFilter = categoryFilter === category ? null : category;
    updateCategoryFilterUI();

    if (categoryFilter) {
        jumpToCategory(categoryFilter);
    }
}

function clearCategoryFilter() {
    if (!categoryFilter) return;
    categoryFilter = null;
    updateCategoryFilterUI();
}

// Знаходить найближчий у напрямку direction листок, що задовольняє активний фільтр
function findNextMatchingLeaf(fromIndex, direction) {
    if (!categoryFilter) {
        return fromIndex >= 0 && fromIndex < leaves.length ? fromIndex : -1;
    }

    let i = fromIndex;
    while (i >= 0 && i < leaves.length) {
        if (leaves[i].dataset.category === categoryFilter) return i;
        i += direction;
    }
    return -1;
}

function initStatsPanelInteraction() {
    document.querySelectorAll(".stats-panel .stat").forEach((statEl) => {
        const category = getStatCategory(statEl);
        if (!category) return;

        statEl.setAttribute("role", "button");
        statEl.setAttribute("tabindex", "0");

        statEl.addEventListener("click", (e) => {
            e.stopPropagation();
            setCategoryFilter(category);
        });

        statEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setCategoryFilter(category);
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

    localStorage.setItem(PAGE_STORAGE_KEY, flippedCount);

    if (pageCurrentEl) {
        pageCurrentEl.textContent = Math.min(flippedCount + 1, total);
    }

    updateProgressSegments();

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

// Групує всі листки за першою літерою назви (спільна логіка для змісту й лівої абетки)
function getLetterGroups(lang) {
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

    return { alphabet, groups, hashGroup };
}

function renderContents(lang) {
    const container = document.getElementById("contents-grid");
    if (!container || !leaves.length) return;

    const { alphabet, groups, hashGroup } = getLetterGroups(lang);

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

// Ліва панель швидкого переходу за першою літерою назви (перемикається разом з мовою)
const alphaFlyout = document.getElementById("alpha-flyout");
let alphaFlyoutLetter = null;

function closeAlphaFlyout() {
    if (!alphaFlyout) return;
    alphaFlyout.classList.remove("open");
    alphaFlyoutLetter = null;
    document.querySelectorAll(".alpha-nav-btn.active").forEach((btn) => {
        btn.classList.remove("active");
    });
}

function openAlphaFlyout(letter, entries, anchorBtn) {
    if (!alphaFlyout) return;

    alphaFlyout.innerHTML = "";

    entries.forEach(({ title, index }) => {
        const row = document.createElement("div");
        row.className = "alpha-flyout-entry";

        const titleSpan = document.createElement("span");
        titleSpan.textContent = title;

        const page = document.createElement("span");
        page.className = "entry-page";
        page.textContent = String(index).padStart(2, "0");

        row.append(titleSpan, page);
        row.addEventListener("click", (e) => {
            e.stopPropagation();
            clearCategoryFilter();
            jumpToLeaf(index);
            closeAlphaFlyout();
            document.body.classList.remove("mobile-menu-open");
        });

        alphaFlyout.appendChild(row);
    });

    const rect = anchorBtn.getBoundingClientRect();
    const isMobile = window.matchMedia("(max-width: 600px)").matches;

    if (isMobile) {
        alphaFlyout.style.left = Math.min(rect.right + 8, window.innerWidth - 240) + "px";
        alphaFlyout.style.top = rect.top + "px";
    } else {
        alphaFlyout.style.left = rect.right + 12 + "px";
        alphaFlyout.style.top = Math.max(12, Math.min(rect.top, window.innerHeight - 60)) + "px";
    }

    alphaFlyout.classList.add("open");
    alphaFlyoutLetter = letter;
}

function renderAlphaNav(lang) {
    const container = document.getElementById("alpha-nav");
    if (!container || !leaves.length) return;

    const { alphabet, groups, hashGroup } = getLetterGroups(lang);

    container.innerHTML = "";
    closeAlphaFlyout();

    const addLetterButton = (letter, entries) => {
        const btn = document.createElement("button");
        btn.className = "alpha-nav-btn";
        btn.type = "button";
        btn.textContent = letter;
        btn.addEventListener("click", (e) => {
            e.stopPropagation();

            if (alphaFlyoutLetter === letter) {
                closeAlphaFlyout();
                return;
            }

            document.querySelectorAll(".alpha-nav-btn.active").forEach((b) => {
                b.classList.remove("active");
            });
            btn.classList.add("active");
            openAlphaFlyout(letter, entries, btn);
        });
        container.appendChild(btn);
    };

    alphabet.forEach((letter) => {
        if (groups.has(letter)) addLetterButton(letter, groups.get(letter));
    });

    if (hashGroup.length) addLetterButton("#", hashGroup);
}

function buildContentsSection(letter, entries, lang) {
    const section = document.createElement("div");
    section.className = "contents-section";

    const heading = document.createElement("div");
    heading.className = "contents-letter-heading";
    heading.textContent = letter;
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
            clearCategoryFilter();
            jumpToLeaf(index);
        });

        section.appendChild(row);
    });

    return section;
}

function jumpToLeaf(index) {
    if (isAnimating || index < 0 || index >= leaves.length) return;

    closeMovieInfo();
    closeAlphaFlyout();

    flippedCount = index;
    updateLeaves();
}

if (readingProgressEl) {
    readingProgressEl.addEventListener("click", (e) => {
        const segment = e.target.closest(".progress-segment");
        if (!segment) return;
        const index = progressSegments.indexOf(segment);
        if (index !== -1) jumpToLeaf(index);
    });
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

document.addEventListener("click", (e) => {
    if (!alphaFlyoutLetter) return;
    if (e.target.closest(".alpha-nav, .alpha-flyout")) return;
    closeAlphaFlyout();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeMovieInfo();
        closeAlphaFlyout();
    }
});

// Гортання колесом миші на ноут/десктоп версії
const WHEEL_THRESHOLD = 24;
let wheelCooldown = false;

magazine.addEventListener("wheel", (e) => {
    if (e.target.closest(".side-menu, .top-bar, .mobile-menu-toggle, .reading-progress, .contents-grid, .alpha-nav")) return;
    if (Math.abs(e.deltaY) < WHEEL_THRESHOLD || wheelCooldown) return;

    e.preventDefault();

    if (e.deltaY > 0) {
        const next = findNextMatchingLeaf(flippedCount + 1, 1);
        if (next !== -1) jumpToLeaf(next);
    } else {
        const prev = findNextMatchingLeaf(flippedCount - 1, -1);
        if (prev !== -1) jumpToLeaf(prev);
    }

    wheelCooldown = true;
    setTimeout(() => { wheelCooldown = false; }, 350);
}, { passive: false });

// Свайп для гортання сторінок на тф
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
        const next = findNextMatchingLeaf(flippedCount + 1, 1);
        if (next !== -1) jumpToLeaf(next);
    } else {
        const prev = findNextMatchingLeaf(flippedCount - 1, -1);
        if (prev !== -1) jumpToLeaf(prev);
    }
}, { passive: true });

menuHomeButton.addEventListener("click", (e) => {
    e.stopPropagation();

    closeMovieInfo();
    clearCategoryFilter();
    flippedCount = 0;
    updateLeaves();

    document.body.classList.remove("mobile-menu-open");
});

menuContentsButton.addEventListener("click", (e) => {
    e.stopPropagation();

    clearCategoryFilter();

    const contentsIndex = leaves.findIndex((leaf) =>
        leaf.classList.contains("leaf-contents")
    );

    if (contentsIndex !== -1) {
        jumpToLeaf(contentsIndex);
    }

    document.body.classList.remove("mobile-menu-open");
});

document.querySelectorAll(".side-menu-cat").forEach((btn) => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setCategoryFilter(btn.dataset.category);
        document.body.classList.remove("mobile-menu-open");
    });
});

const langOptions = document.querySelectorAll(".lang-option");
const LANG_STORAGE_KEY = "must-watch-current-lang";

const savedLang = localStorage.getItem(LANG_STORAGE_KEY);
let currentLang = savedLang === "en" ? "en" : "ua";

const categoryWords = {
    movie: { ua: "фільм", en: "film" },
    series: { ua: "серіал", en: "series" },
    cartoon: { ua: "мультфільм", en: "animated film" },
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
        renderAlphaNav(lang);
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
        const alphaNav = document.getElementById("alpha-nav");

        const clickedInside =
            mobileMenuToggle.contains(e.target) ||
            (langSwitch && langSwitch.contains(e.target)) ||
            (sideMenu && sideMenu.contains(e.target)) ||
            (alphaNav && alphaNav.contains(e.target));

        if (!clickedInside) {
            document.body.classList.remove("mobile-menu-open");
        }
    });
}

buildLeaves();
applyLanguage(currentLang);