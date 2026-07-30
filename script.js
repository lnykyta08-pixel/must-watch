const magazine = document.getElementById("magazine");
const leavesContainer = document.getElementById("pages");
const closeButton = document.getElementById("magazine-close");
const prevButton = document.getElementById("nav-prev");
const nextButton = document.getElementById("nav-next");

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
}

function goNext() {
    if (isAnimating || flippedCount >= leaves.length - 1) return;

    isAnimating = true;

    const leaf = leaves[flippedCount];

    leaf.classList.add("flipping", "anim-forward");

    flippedCount++;
    updateLeaves();

    setTimeout(() => {
        leaf.classList.remove(
            "flipping",
            "anim-forward"
        );

        isAnimating = false;
    }, 1000);
}

function goPrev() {
    if (isAnimating || flippedCount <= 0) return;

    isAnimating = true;

    flippedCount--;

    const leaf = leaves[flippedCount];

    leaf.classList.add(
        "flipping",
        "anim-backward"
    );

    updateLeaves();

    setTimeout(() => {
        leaf.classList.remove(
            "flipping",
            "anim-backward"
        );

        isAnimating = false;
    }, 1000);
}

nextButton.addEventListener("click", goNext);
prevButton.addEventListener("click", goPrev);

leavesContainer.addEventListener("click", goNext);

closeButton.addEventListener("click", (e) => {
    e.stopPropagation();

    flippedCount = 0;
    updateLeaves();
});

// Перемикач мови сайту EN / UA
// Слово "Must-Watch" (клас .brand і логотип .cover-logo) переклад не зачіпає.

const translateButton = document.getElementById("translate-global");
const LANG_STORAGE_KEY = "must-watch-current-lang";

const savedLang = localStorage.getItem(LANG_STORAGE_KEY);
let currentLang = savedLang === "en" ? "en" : "ua"; // мова за замовчуванням — ua

// Слова категорій для автоматичної підсвітки в тексті опису.
// Додаєш data-category="series|cartoon|anime" на .leaf-spread — і слово підсвітиться саме.
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
    const regex = new RegExp(`(^|[^\\p{L}])(${word})(?!\\p{L})`, "iu");

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

    // Кнопка показує мову, на яку можна перемкнутись
    translateButton.textContent = lang === "ua" ? "EN" : "UA";

    localStorage.setItem(LANG_STORAGE_KEY, lang);
}

translateButton.addEventListener("click", (e) => {
    e.stopPropagation();

    currentLang = currentLang === "ua" ? "en" : "ua";
    applyLanguage(currentLang);
});

applyLanguage(currentLang);

buildLeaves();