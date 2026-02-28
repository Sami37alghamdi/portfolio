// Core Multi-Page App Logic

// --- Supabase Configuration (no SDK needed - using REST API directly) ---
const supabaseUrl = 'https://xeyrsrhkjtduapnbqcxt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhleXJzcmhranRkdWFwbmJxY3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMjY3NjEsImV4cCI6MjA4NzgwMjc2MX0.l6KLc-RDnYVhC6f7UR8t9JhKwnxhG-ClHDMCXNot7Ho';

const supabaseHeaders = {
    'apikey': supabaseKey,
    'Authorization': 'Bearer ' + supabaseKey,
    'Content-Type': 'application/json'
};

// Fetch config from Supabase via REST
async function supabaseGetConfig() {
    const resp = await fetch(
        supabaseUrl + '/rest/v1/site_settings?id=eq.1&select=config',
        { headers: supabaseHeaders }
    );
    if (!resp.ok) throw new Error('Supabase GET failed: ' + resp.status);
    const rows = await resp.json();
    if (!rows || rows.length === 0) throw new Error('No config row found');
    return rows[0].config;
}

// Update config in Supabase via REST
async function supabaseUpdateConfig(configData) {
    const resp = await fetch(
        supabaseUrl + '/rest/v1/site_settings?id=eq.1',
        {
            method: 'PATCH',
            headers: { ...supabaseHeaders, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ config: configData })
        }
    );
    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error('Supabase UPDATE failed: ' + resp.status + ' ' + errText);
    }
}

let appData = null;

// DOM Elements & Globals (Assigned on load)
let pageId;
let pageContent;
let loader;
let themeToggleBtn;
let htmlTag;

// Modals
let modalOverlay;
let contactBtn;
let contactModal;
let closeModals;

function initApp() {
    pageId = document.body.id;
    pageContent = document.getElementById('pageContent');
    loader = document.getElementById('loader');
    themeToggleBtn = document.getElementById('themeToggleBtn');
    htmlTag = document.documentElement;

    modalOverlay = document.getElementById('modalOverlay');
    contactBtn = document.getElementById('contactBtn');
    contactModal = document.getElementById('contactModal');
    closeModals = document.querySelectorAll('.close-modal');

    initTheme();
    fetchData();
    setupModals();

    // Add specific JS for admin page toast if exists
    if (pageId === 'page-admin') {
        setupAdminPanel();
    }
}

// Wait for DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// --- Theme Management ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        htmlTag.classList.add('dark');
    } else {
        htmlTag.classList.remove('dark');
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            htmlTag.classList.toggle('dark');
            const isDark = htmlTag.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }
}

// --- Theme Management ---

// --- Data Fetching ---
async function fetchData() {
    try {
        // Step 1: Always load local data.json first for immediate rendering
        const localResponse = await fetch('data.json?t=' + new Date().getTime());
        if (!localResponse.ok) throw new Error('Failed to fetch local data.json');
        appData = await localResponse.json();
    } catch (e) {
        console.error("Error fetching local data:", e);
        if (pageId !== 'page-admin' && pageContent) {
            pageContent.classList.remove('hidden');
            pageContent.innerHTML = `
                <div class="text-center text-red-500 mt-20">
                    <i class="fa-solid fa-triangle-exclamation text-4xl mb-4"></i>
                    <p>تعذر تحميل البيانات. يرجى التأكد من الاتصال بالإنترنت.</p>
                </div>
            `;
        }
        return;
    }

    // Step 2: Render the page immediately with local data
    if (loader) loader.classList.add('hidden');
    if (pageContent) {
        pageContent.classList.remove('hidden');
        pageContent.classList.add('flex');
    }
    renderCurrentPage();

    // Step 3: Try to refresh from Supabase in background (non-blocking)
    try {
        const freshConfig = await supabaseGetConfig();
        if (freshConfig) {
            appData = freshConfig;
            renderCurrentPage(); // Re-render with fresh Supabase data
        }
    } catch (e) {
        // Supabase failed, page already rendered from local data - no action needed
        console.warn("Supabase refresh failed (using local data):", e.message);
    }
}

function renderCurrentPage() {
    switch (pageId) {
        case 'page-home': renderHome(); break;
        case 'page-evidence': renderEvidence(); break;
        case 'page-math-lab': renderMathLab(); break;
        case 'page-nafes': renderNafes(); break;
        case 'page-honor': renderHonorRoll(); break;
        case 'page-report': renderReport(); break;
        case 'page-contact': renderContact(); break;
        case 'page-admin': {
            const editor = document.getElementById('jsonEditorArea');
            if (editor) editor.value = JSON.stringify(appData, null, 2);
            // Also rebuild the visual editor with fresh data
            if (typeof buildVisualEditor === 'function') buildVisualEditor();
            break;
        }
    }
}


// --- Shared Helper Functions ---
function getLinksArray(item) {
    if (item.links && Array.isArray(item.links) && item.links.length > 0) return item.links;
    if (item.link && item.link.trim() !== '') return [item.link];
    return [];
}

function parseLinks(text) {
    if (!text) return [];
    return text.split('\n').map(l => l.trim()).filter(l => l !== '');
}

function renderLinks(linksArray) {
    if (!linksArray || linksArray.length === 0) return '<div class="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-gray-400 text-sm">لا يوجد ملف مرفق حالياً</div>';

    return linksArray.map(url => {
        if (!url || url.trim() === '') return '';

        if (url.includes('drive.google.com')) {
            let previewUrl = url;
            if (previewUrl.includes('/view')) {
                previewUrl = previewUrl.replace(/\/view.*$/, '/preview');
            } else if (!previewUrl.includes('/preview')) {
                previewUrl += previewUrl.includes('?') ? '&usp=sharing' : '/preview';
            }
            // Wrap in a div with touch scrolling to fix Safari/iOS iframe scroll issues
            return `< div class="w-full h-80 md:h-[500px] mb-4 rounded-2xl overflow-hidden shadow-sm relative" style = "-webkit-overflow-scrolling: touch; overflow-y: scroll;" >
                <iframe src="${previewUrl}" class="absolute top-0 left-0 w-full h-full border-none bg-white dark:bg-dark-main" allow="autoplay" allowfullscreen scrolling="yes"></iframe>
                    </div > `;
        }

        if (url.match(/\.(jpeg|jpg|gif|png)$/i)) {
            return `< img src = "${url}" class="w-full rounded-2xl shadow-sm mb-4" alt = "مرفق" > `;
        }
        return `< a href = "${url}" target = "_blank" class="block p-4 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 mb-4 text-blue-500 underline font-bold" dir = "ltr" > <i class="fa-solid fa-link mr-2"></i>${url}</a > `;
    }).join('');
}

// --- View Renderers (Page Specific) ---

function renderHome() {
    const data = appData.home;

    let heroHtml = `
                < div class="img-placeholder shadow-lg relative overflow-hidden rounded-b-3xl" >
                    <i class="fa-solid fa-image opacity-30 text-6xl"></i>
        </div >
                `;

    if (data.heroImage && data.heroImage.trim() !== '') {
        const driveMatch = data.heroImage.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (driveMatch) {
            const fileId = driveMatch[1];
            // Try multiple Google Drive URL patterns to avoid Safari blocking & black iframe fallback
            const imgClass = "w-full min-h-[250px] md:h-[400px] object-contain bg-light-surface dark:bg-dark-main shadow-lg relative rounded-b-3xl border border-gray-200 dark:border-gray-800";
            const url1 = `https://drive.google.com/uc?export=view&id=${fileId}`;
            const url2 = `https://lh3.googleusercontent.com/d/${fileId}`;
            const url3 = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
            heroHtml = `<img src="${url1}" class="${imgClass}" alt="صورة الغلاف" onerror="this.onerror=function(){this.onerror=function(){this.style.display='none'};this.src='${url3}'};this.src='${url2}'">`;
        } else if (data.heroImage.includes('drive.google.com')) {
            let previewUrl = data.heroImage;
            if (previewUrl.includes('/view')) {
                previewUrl = previewUrl.replace(/\/view.*$/, '/preview');
            } else if (!previewUrl.includes('/preview')) {
                previewUrl += previewUrl.includes('?') ? '&usp=sharing' : '/preview';
            }
            heroHtml = `<iframe src="${previewUrl}" class="w-full min-h-[250px] md:h-[400px] border-none shadow-lg relative overflow-hidden rounded-b-3xl" allow="autoplay" allowfullscreen></iframe>`;
        } else {
            heroHtml = `<img src="${data.heroImage}" class="w-full min-h-[250px] md:h-[400px] object-contain bg-light-surface shadow-lg relative rounded-b-3xl border border-gray-200 dark:border-gray-800" alt="صورة الرئيسية">`;
        }
    }

    const html = `
        <!-- Hero Image -->
        ${heroHtml}
        
        <!-- Vision -->
        <section class="bg-light-surface dark:bg-dark-surface p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden group">
            <div class="absolute -right-4 -top-4 text-brand-lightPrimary/10 dark:text-brand-darkPrimary/10 text-6xl transform -rotate-12 transition-transform group-hover:rotate-0"><i class="fa-solid fa-eye"></i></div>
            <h2 class="text-xl font-bold text-brand-lightPrimary dark:text-brand-darkPrimary mb-3 relative z-10 flex gap-2 items-center">
                <i class="fa-solid fa-eye"></i> الرؤية
            </h2>
            <p class="text-gray-600 dark:text-gray-300 leading-relaxed font-semibold relative z-10">${data.vision}</p>
        </section>

        <!-- Mission -->
        <section class="bg-light-surface dark:bg-dark-surface p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden group">
            <div class="absolute -left-4 -top-4 text-brand-secondary/10 text-6xl transform rotate-12 transition-transform group-hover:rotate-0"><i class="fa-solid fa-bullseye"></i></div>
            <h2 class="text-xl font-bold text-brand-secondary mb-3 relative z-10 flex gap-2 items-center">
                <i class="fa-solid fa-bullseye"></i> الرسالة
            </h2>
            <p class="text-gray-600 dark:text-gray-300 leading-relaxed font-semibold relative z-10">${data.mission}</p>
        </section>

        <!-- Class Schedule -->
        ${(() => {
            if (!data.scheduleUrl || data.scheduleUrl.trim() === '') return '';

            let scheduleInnerHtml = '';
            const url = data.scheduleUrl;

            if (url.includes('drive.google.com')) {
                let previewUrl = url.includes('/view') ? url.replace(/\/view.*$/, '/preview') : url + (url.includes('?') ? '&usp=sharing' : '/preview');
                scheduleInnerHtml = `
                        <div class="w-full h-64 md:h-[400px] relative overflow-hidden rounded-2xl bg-gray-50 dark:bg-dark-main" style="-webkit-overflow-scrolling: touch; overflow-y: scroll;">
                            <iframe src="${previewUrl}" class="absolute top-0 left-0 w-full h-full border-none" allow="autoplay" allowfullscreen scrolling="yes"></iframe>
                        </div>`;
            } else if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                scheduleInnerHtml = `
                    <a href="${url}" target="_blank" class="block relative w-full h-auto overflow-hidden bg-gray-50 dark:bg-dark-main">
                        <img src="${url}" class="w-full h-auto object-contain group-hover:scale-105 transition-transform duration-500" alt="الجدول الدراسي">
                        <div class="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg opacity-80 hover:bg-black/80 transition-opacity">
                            <i class="fa-solid fa-expand"></i>
                        </div>
                    </a>`;
            } else {
                scheduleInnerHtml = `
                    <a href="${url}" target="_blank" class="flex flex-col items-center justify-center p-8 h-48 text-brand-lightPrimary hover:text-brand-secondary transition-colors bg-gray-50 dark:bg-dark-main">
                        <i class="fa-solid fa-arrow-up-right-from-square text-4xl mb-4"></i>
                        <span class="font-bold text-sm text-center">فتح رابط الجدول الخارجي</span>
                        <span class="text-xs text-gray-400 mt-2 break-all px-4 text-center" dir="ltr">${url}</span>
                    </a>`;
            }

            return `
            <section class="mt-4 mb-2 relative">
                <h2 class="text-xl font-black text-gray-800 dark:text-gray-100 mb-4 px-2 flex items-center gap-2">
                    <i class="fa-solid fa-calendar-days text-brand-lightPrimary dark:text-brand-darkPrimary"></i> الجدول الدراسي
                </h2>
                <div class="bg-white dark:bg-dark-surface rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden relative group">
                    ${scheduleInnerHtml}
                </div>
            </section>
            `;
        })()}

        <!-- Objectives -->
        ${data.objectives && data.objectives.length > 0 ? `
        <section class="mt-4 mb-2 relative">
            <h2 class="text-xl font-black text-gray-800 dark:text-gray-100 mb-4 px-2 flex items-center gap-2">
                <i class="fa-solid fa-list-check text-brand-lightPrimary dark:text-brand-darkPrimary"></i> الأهداف المهنية والتربوية
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${data.objectives.map(obj => `
                    <div class="bg-white dark:bg-dark-surface p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow group">
                        <div class="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                            <div class="w-10 h-10 rounded-xl bg-brand-lightPrimary/10 dark:bg-brand-darkPrimary/10 flex items-center justify-center text-brand-lightPrimary dark:text-brand-darkPrimary">
                                <i class="fa-solid ${obj.icon || 'fa-star'}"></i>
                            </div>
                            <h3 class="font-bold text-gray-800 dark:text-gray-100">${obj.title}</h3>
                        </div>
                        <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400 font-semibold px-2">
                            ${obj.items.map(item => `
                                <li class="flex gap-2">
                                    <i class="fa-solid fa-check text-brand-secondary text-xs mt-1 shrink-0"></i>
                                    <span>${item}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `).join('')}
            </div>
        </section>
        ` : ''}

        <!-- Stats Grid -->
        <section class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            ${data.stats.map(stat => `
                <div class="bg-gradient-to-br from-light-surface to-white dark:from-dark-surface dark:to-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 text-center transform hover:-translate-y-1 transition-transform">
                    <div class="text-2xl font-black text-brand-lightPrimary dark:text-brand-darkPrimary mb-1">${stat.value}</div>
                    <div class="text-xs text-gray-500 font-bold">${stat.label}</div>
                </div>
            `).join('')}
        </section>
    `;
    pageContent.innerHTML = html;
}

function renderEvidence() {
    const data = appData.evidenceReports;
    const html = `
        <div class="flex items-center gap-3 mb-2 px-2">
            <div class="w-12 h-12 rounded-2xl bg-brand-lightPrimary/10 dark:bg-brand-darkPrimary/10 flex items-center justify-center text-brand-lightPrimary dark:text-brand-darkPrimary text-xl">
                <i class="fa-regular fa-folder-open"></i>
            </div>
            <div>
                <h2 class="text-2xl font-black">الشواهد والأدلة</h2>
                <p class="text-sm text-gray-500">استعرض التقارير المفصلة لمجالات التقييم</p>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${(() => {
            const cardThemes = [
                'bg-blue-50/70 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/50 shadow-lg shadow-blue-100/50 dark:shadow-none hover:shadow-blue-200/60 hover:border-blue-300 dark:hover:border-blue-600',
                'bg-emerald-50/70 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/50 shadow-lg shadow-emerald-100/50 dark:shadow-none hover:shadow-emerald-200/60 hover:border-emerald-300 dark:hover:border-emerald-600',
                'bg-purple-50/70 dark:bg-purple-900/10 border-purple-100 dark:border-purple-800/50 shadow-lg shadow-purple-100/50 dark:shadow-none hover:shadow-purple-200/60 hover:border-purple-300 dark:hover:border-purple-600',
                'bg-amber-50/70 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/50 shadow-lg shadow-amber-100/50 dark:shadow-none hover:shadow-amber-200/60 hover:border-amber-300 dark:hover:border-amber-600',
                'bg-rose-50/70 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/50 shadow-lg shadow-rose-100/50 dark:shadow-none hover:shadow-rose-200/60 hover:border-rose-300 dark:hover:border-rose-600',
                'bg-teal-50/70 dark:bg-teal-900/10 border-teal-100 dark:border-teal-800/50 shadow-lg shadow-teal-100/50 dark:shadow-none hover:shadow-teal-200/60 hover:border-teal-300 dark:hover:border-teal-600'
            ];
            const iconThemes = [
                'text-blue-600 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300',
                'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300',
                'text-purple-600 bg-purple-100 dark:bg-purple-900/40 dark:text-purple-300',
                'text-amber-600 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300',
                'text-rose-600 bg-rose-100 dark:bg-rose-900/40 dark:text-rose-300',
                'text-teal-600 bg-teal-100 dark:bg-teal-900/40 dark:text-teal-300'
            ];

            return data.map((item, index) => {
                const ct = cardThemes[index % cardThemes.length];
                const it = iconThemes[index % iconThemes.length];
                return `
                        <a href="report.html?id=${item.id}" class="rounded-3xl p-5 border text-right flex justify-between items-center group focus:outline-none transition-all duration-300 transform hover:-translate-y-1 ${ct}">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all duration-300 group-hover:scale-110 ${it}">
                                    <i class="fa-solid ${item.icon}"></i>
                                </div>
                                <div>
                                    <h3 class="font-bold text-sm md:text-base text-gray-800 dark:text-gray-100 transition-colors">${item.mainTitle}</h3>
                                    <p class="text-xs text-gray-500 font-semibold mt-1 truncate max-w-[200px]">${item.subTitle}</p>
                                </div>
                            </div>
                            <i class="fa-solid fa-arrow-left text-gray-300 dark:text-gray-600 group-hover:text-gray-800 dark:group-hover:text-gray-300 transition-transform group-hover:-translate-x-1 text-xl"></i>
                        </a>
                    `;
            }).join('');
        })()}
        </div>
    `;
    pageContent.innerHTML = html;
}

function renderReport() {
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('id');

    if (!reportId || !appData || !appData.evidenceReports) {
        pageContent.innerHTML = '<div class="text-center p-10 font-bold text-red-500 text-xl">التقرير غير موجود</div>';
        return;
    }

    const report = appData.evidenceReports.find(r => r.id === reportId);
    if (!report) {
        pageContent.innerHTML = '<div class="text-center p-10 font-bold text-red-500 text-xl">التقرير غير موجود</div>';
        return;
    }

    const html = `
        <!-- Theme colors as requested: White, Forest Green (#2f7041), Gold accents -->
        <!-- Header Box -->
        <div class="bg-[#2f7041] rounded-3xl p-6 shadow-md text-center text-white relative overflow-hidden group">
            <div class="absolute -right-6 -top-6 text-white/10 text-8xl transform -rotate-12 transition-transform group-hover:rotate-0"><i class="fa-solid ${report.icon}"></i></div>
            <h1 class="text-3xl font-black mb-2 relative z-10">${report.mainTitle}</h1>
            <p class="text-sm font-semibold opacity-90 relative z-10">${report.subTitle}</p>
        </div>

        <!-- Info Grid (3 columns desktop, 1 mobile) -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
            ${report.infoGrid.map(info => `
                <div class="bg-white dark:bg-dark-surface border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md transition-shadow">
                    <i class="fa-solid ${info.icon} text-xl text-[#fbbf24] mb-2 drop-shadow-sm"></i>
                    <span class="text-[10px] text-gray-500 font-bold mb-1">${info.title}</span>
                    <span class="text-xs md:text-sm font-black text-[#2f7041] dark:text-[#4ade80]">${info.value}</span>
                </div>
            `).join('')}
        </div>

        <!-- Two Columns: Goals and Procedures -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            
            <!-- Goals (Right Column effectively due to RTL) -->
            <div class="relative pt-4">
                <div class="absolute top-0 right-6 bg-[#fbbf24] text-[#2f7041] px-4 py-1 rounded-full text-xs font-black shadow-sm transform -translate-y-1/2">
                    ${report.goalsTitle}
                </div>
                <div class="bg-white dark:bg-dark-surface border-2 border-[#fbbf24]/30 rounded-3xl p-6 pt-8 shadow-sm h-full">
                    <ul class="flex flex-col gap-3">
                        ${report.goalsList.map(goal => `
                            <li class="flex items-start gap-3">
                                <div class="w-4 h-4 rounded-full bg-[#fbbf24] flex-shrink-0 mt-1 shadow-inner border border-white dark:border-dark-main"></div>
                                <span class="text-sm font-bold text-gray-700 dark:text-gray-300 leading-relaxed">${goal}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>

            <!-- Procedures -->
            <div class="relative pt-4">
                <div class="absolute top-0 right-6 bg-[#fbbf24] text-[#2f7041] px-4 py-1 rounded-full text-xs font-black shadow-sm transform -translate-y-1/2">
                    ${report.proceduresTitle}
                </div>
                <div class="bg-white dark:bg-dark-surface border-2 border-[#fbbf24]/30 rounded-3xl p-6 pt-8 shadow-sm h-full">
                    <ul class="flex flex-col gap-3">
                        ${report.proceduresList.map(proc => `
                            <li class="flex items-start gap-3">
                                <div class="w-4 h-4 rounded-full bg-[#fbbf24] flex-shrink-0 mt-1 shadow-inner border border-white dark:border-dark-main"></div>
                                <span class="text-sm font-bold text-gray-700 dark:text-gray-300 leading-relaxed">${proc}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>

        </div>

        <!-- Evidence Images Banner & Grid -->
        <div class="mt-6 flex flex-col gap-4">
            <div class="bg-[#2f7041] text-white rounded-2xl py-3 px-6 font-bold text-center shadow-md flex items-center justify-center gap-3">
                <i class="fa-solid fa-camera-retro text-[#fbbf24] text-xl"></i>
                <span>شواهد الرصد</span>
            </div>
            
            ${report.evidenceImages.length === 0 ?
            '<div class="text-center p-6 text-gray-400 font-bold bg-white dark:bg-dark-surface rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">لا توجد شواهد مرفقة لهذا التقرير</div>'
            :
            `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${report.evidenceImages.map(imgUrl => {
                let innerHtml = '';
                if (imgUrl.includes('drive.google.com')) {
                    // Broader regex to extract Google Drive file ID from various URL patterns
                    const match = imgUrl.match(/(?:\/d\/|id=|id%3D)([a-zA-Z0-9_-]{10,})/);
                    if (match && match[1]) {
                        const fileId = match[1];
                        // Use multiple fallback URLs like renderHome does
                        const url1 = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';
                        const url2 = 'https://lh3.googleusercontent.com/d/' + fileId;
                        const url3 = 'https://drive.google.com/uc?export=view&id=' + fileId;
                        innerHtml = '<a href="' + imgUrl + '" target="_blank" class="block w-full h-72 md:h-80 relative group overflow-hidden bg-gray-50 dark:bg-dark-surface">' +
                            '<img src="' + url1 + '" onerror="this.onerror=function(){this.onerror=function(){this.style.display=\'none\'; this.nextElementSibling.classList.remove(\'hidden\')};this.src=\'' + url3 + '\'};this.src=\'' + url2 + '\'" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="شاهد">' +
                            '<div class="hidden absolute inset-0 flex flex-col items-center justify-center p-6 text-[#2f7041] hover:text-[#fbbf24] transition-colors text-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl m-2">' +
                            '<i class="fa-brands fa-google-drive text-5xl mb-4 text-[#fbbf24]"></i>' +
                            '<span class="font-bold text-sm">عرض شواهد جوجل درايف</span>' +
                            '<span class="text-xs text-gray-400 mt-2">انقر للفتح في نافذة جديدة</span>' +
                            '</div>' +
                            '<div class="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg opacity-80 group-hover:opacity-100 transition-opacity">' +
                            '<i class="fa-solid fa-expand"></i>' +
                            '</div>' +
                            '</a>';
                    } else {
                        // Fallback for unrecognized Drive URLs - open as iframe preview
                        let previewUrl = imgUrl;
                        if (previewUrl.includes('/view')) {
                            previewUrl = previewUrl.replace(/\/view.*$/, '/preview');
                        } else if (!previewUrl.includes('/preview')) {
                            previewUrl += previewUrl.includes('?') ? '&usp=sharing' : '/preview';
                        }
                        innerHtml = '<a href="' + imgUrl + '" target="_blank" class="flex flex-col items-center justify-center p-8 h-72 md:h-80 text-[#2f7041] hover:text-[#fbbf24] transition-colors bg-gray-50 dark:bg-dark-surface"><i class="fa-brands fa-google-drive text-5xl mb-4"></i><span class="font-bold text-sm text-center">فتح المرفق في جوجل درايف</span></a>';
                    }
                } else if (imgUrl.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp|tiff)(\?.*)?$/i)) {
                    // Direct image URL with known extension
                    innerHtml = '<img src="' + imgUrl + '" class="w-full h-72 md:h-80 object-cover hover:scale-105 transition-transform duration-500 bg-gray-50 dark:bg-dark-surface" alt="شاهد">' +
                        '<a href="' + imgUrl + '" target="_blank" class="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg opacity-80 hover:bg-black/80 transition-opacity">' +
                        '<i class="fa-solid fa-expand"></i>' +
                        '</a>';
                } else {
                    // Try displaying as image first, with fallback to link
                    innerHtml = '<img src="' + imgUrl + '" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\'" class="w-full h-72 md:h-80 object-cover hover:scale-105 transition-transform duration-500 bg-gray-50 dark:bg-dark-surface" alt="شاهد">' +
                        '<a href="' + imgUrl + '" target="_blank" style="display:none" class="flex-col items-center justify-center p-8 h-72 md:h-80 text-[#2f7041] hover:text-[#fbbf24] transition-colors bg-gray-50 dark:bg-dark-surface"><i class="fa-solid fa-arrow-up-right-from-square text-4xl mb-4"></i><span class="font-bold text-sm text-center">فتح المرفق الخارجي</span><span class="text-xs text-gray-400 mt-2 break-all px-4 text-center" dir="ltr">' + imgUrl + '</span></a>' +
                        '<a href="' + imgUrl + '" target="_blank" class="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg opacity-80 hover:bg-black/80 transition-opacity">' +
                        '<i class="fa-solid fa-expand"></i>' +
                        '</a>';
                }

                return '<div class="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow bg-white dark:bg-dark-main relative">' +
                    innerHtml +
                    '</div>';
            }).join('')}
                </div>`
        }      </div>

        <!-- Footer Signatures -->
        <div class="grid grid-cols-2 gap-4 mt-8 pt-4 border-t border-gray-200 dark:border-gray-800">
            <div class="bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-center">
                <div class="text-xs text-gray-500 font-bold mb-2">المعلم</div>
                <div class="font-black text-[#2f7041] dark:text-[#4ade80]">${appData.teacherName || 'سامي الغامدي'}</div>
            </div>
            <div class="bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-center">
                <div class="text-xs text-gray-500 font-bold mb-2">مدير/ة المدرسة</div>
                <div class="font-black text-[#2f7041] dark:text-[#4ade80]">${appData.managerName || 'مدير المدرسة'}</div>
            </div>
        </div>
    `;

    pageContent.innerHTML = html;
}

function renderMathLab() {
    const data = appData.math_lab;
    const html = `
        <div class="flex items-center gap-3 mb-2 px-2">
            <div class="w-12 h-12 rounded-2xl bg-brand-lightPrimary/10 dark:bg-brand-darkPrimary/10 flex items-center justify-center text-brand-lightPrimary dark:text-brand-darkPrimary text-xl">
                <i class="fa-solid fa-square-root-variable"></i>
            </div>
            <div>
                <h2 class="text-2xl font-black">المعمل والمصادر</h2>
                <p class="text-sm text-gray-500">أدوات تفاعلية ومصادر تعليمية مرئية</p>
            </div>
        </div>

        <section class="bg-light-surface dark:bg-dark-surface p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
            <h3 class="font-bold text-lg mb-4 flex gap-2 items-center">
                <i class="fa-solid fa-toolbox text-brand-secondary"></i> الأدوات التفاعلية
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                ${data.tools.map(tool => `
                    <a href="${tool.link}" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center justify-center p-4 bg-white dark:bg-dark-main rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-brand-lightPrimary dark:hover:border-brand-darkPrimary transition-colors group">
                        <i class="fa-solid ${tool.icon} text-3xl mb-2 text-gray-400 group-hover:text-brand-lightPrimary dark:group-hover:text-brand-darkPrimary transition-colors"></i>
                        <span class="font-bold text-sm truncate w-full text-center">${tool.name}</span>
                    </a>
                `).join('')}
            </div>
        </section>

        <section class="flex flex-col gap-4 mt-2">
            <h3 class="font-bold text-lg px-2 flex gap-2 items-center">
                <i class="fa-solid fa-photo-film text-brand-secondary"></i> المحتوى المرئي للدروس
            </h3>
            ${data.visuals.map(visual => `
                <div class="bg-light-surface dark:bg-dark-surface p-4 md:p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <h4 class="font-bold mb-4">${visual.title}</h4>
                    ${renderLinks(getLinksArray(visual))}
                </div>
            `).join('')}
        </section>
    `;
    pageContent.innerHTML = html;
}

function renderNafes() {
    const data = appData.nafes;

    // Safety check in case legacy data is still there
    if (!data || !data.chartData) {
        pageContent.innerHTML = `<div class="text-center p-8 text-gray-500">جاري تحديث البيانات... الرجاء المحاولة لاحقاً.</div>`;
        return;
    }

    const html = `
        <!-- Title Section -->
        <div class="flex items-center gap-3 mb-2 px-2">
            <div class="w-12 h-12 rounded-2xl bg-brand-lightPrimary/10 dark:bg-brand-darkPrimary/10 flex items-center justify-center text-brand-lightPrimary dark:text-brand-darkPrimary text-xl">
                <i class="fa-solid fa-chart-line"></i>
            </div>
            <div>
                <h2 class="text-2xl font-black">نتائج نافس</h2>
                <p class="text-sm text-gray-500">لوحة المتابعة والقياس الشاملة</p>
            </div>
        </div>

        <!-- Quick Stats Row (Dark Card) -->
        <section class="bg-slate-900 dark:bg-dark-surface p-6 rounded-3xl shadow-lg border border-slate-800 text-white mt-4">
            <div class="grid grid-cols-3 gap-4 text-center divide-x divide-x-reverse divide-slate-700">
                <div class="flex flex-col gap-1">
                    <span class="text-3xl font-black text-brand-darkPrimary" style="direction: ltr">${data.quickStats.modelsCount}</span>
                    <span class="text-xs font-bold text-slate-400">النماذج المحاكية</span>
                </div>
                <div class="flex flex-col gap-1">
                    <span class="text-3xl font-black text-emerald-400" style="direction: ltr">${data.quickStats.improvement}</span>
                    <span class="text-xs font-bold text-slate-400">نسبة التحسن</span>
                </div>
                <div class="flex flex-col gap-1">
                    <span class="text-3xl font-black text-brand-secondary" style="direction: ltr">${data.quickStats.studentsCount}</span>
                    <span class="text-xs font-bold text-slate-400">الطلاب المشاركون</span>
                </div>
            </div>
        </section>

        <!-- Chart Section -->
        <section class="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 mt-2">
            <h3 class="font-bold text-lg mb-4 flex gap-2 items-center text-slate-800 dark:text-gray-200">
                <i class="fa-solid fa-chart-area text-brand-lightPrimary dark:text-brand-darkPrimary"></i> مؤشر الأداء العام
            </h3>
            <div class="w-full h-64 sm:h-80 relative">
                <canvas id="nafesChart"></canvas>
            </div>
        </section>

        <!-- Bottom Grid: Models and Plans -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            
            <!-- Simulation Models Column -->
            <section class="flex flex-col gap-3">
                <h3 class="font-bold text-lg px-2 flex gap-2 items-center text-slate-800 dark:text-gray-200">
                    <i class="fa-solid fa-laptop-code text-indigo-500"></i> النماذج المحاكية
                </h3>
                <div class="flex flex-col gap-3">
                    ${data.simulationModels.map(model => `
                        <div class="bg-white dark:bg-dark-surface p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group flex justify-between items-center">
                            <div class="flex flex-col gap-1 w-2/3">
                                <h4 class="font-bold text-sm text-slate-800 dark:text-gray-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">${model.title}</h4>
                                <span class="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">${model.details}</span>
                            </div>
                            <a href="${model.url}" target="_blank" rel="noopener noreferrer" class="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 dark:hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap">
                                ابدأ الاختبار
                            </a>
                        </div>
                    `).join('')}
                </div>
            </section>

            <!-- Preparation Plans Column -->
            <section class="flex flex-col gap-3">
                <h3 class="font-bold text-lg px-2 flex gap-2 items-center text-slate-800 dark:text-gray-200">
                    <i class="fa-solid fa-file-pdf text-rose-500"></i> خطط التهيئة
                </h3>
                <div class="flex flex-col gap-3">
                    ${data.preparationPlans.map(plan => `
                        <a href="${plan.url}" target="_blank" rel="noopener noreferrer" class="bg-white dark:bg-dark-surface p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 hover:border-rose-300 dark:hover:border-rose-700 transition-colors group flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-500 flex items-center justify-center text-lg shrink-0">
                                <i class="fa-solid fa-file-arrow-down"></i>
                            </div>
                            <div class="flex flex-col gap-1 w-full overflow-hidden">
                                <h4 class="font-bold text-sm text-slate-800 dark:text-gray-200 truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">${plan.title}</h4>
                                <span class="text-xs text-gray-500 dark:text-gray-400 truncate">${plan.lastUpdated}</span>
                            </div>
                        </a>
                    `).join('')}
                </div>
            </section>

        </div>
    `;
    pageContent.innerHTML = html;

    // Initialize Chart.js after DOM is updated
    setTimeout(() => {
        const ctx = document.getElementById('nafesChart');
        if (ctx) {
            const isDark = document.documentElement.classList.contains('dark');
            const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
            const textColor = isDark ? '#94a3b8' : '#64748b'; // Tailwind slate-400 / slate-500

            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.chartData.labels,
                    datasets: [{
                        label: 'متوسط الأداء (%)',
                        data: data.chartData.values,
                        borderColor: '#0f766e', // brand-lightPrimary
                        backgroundColor: 'rgba(15, 118, 110, 0.1)',
                        borderWidth: 3,
                        pointBackgroundColor: '#2dd4bf', // brand-darkPrimary
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4 // Smooth curves
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)', // slate-900
                            titleFont: { family: "'Tajawal', sans-serif", size: 13 },
                            bodyFont: { family: "'Cairo', sans-serif", size: 12 },
                            padding: 10,
                            displayColors: false,
                            callbacks: {
                                label: function (context) {
                                    return context.parsed.y + '%';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            grid: {
                                color: gridColor,
                                borderDash: [5, 5]
                            },
                            ticks: {
                                color: textColor,
                                font: { family: "'Cairo', sans-serif" },
                                stepSize: 20
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: textColor,
                                font: { family: "'Cairo', sans-serif", size: 11 }
                            }
                        }
                    }
                }
            });
        }
    }, 100);
}

function renderHonorRoll() {
    const data = appData.honor_roll;

    // Helper to get badge colors locally here
    const getBadgeStyle = (badgeStr) => {
        if (badgeStr.includes('ذهب')) return 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 border-yellow-200';
        if (badgeStr.includes('فض')) return 'bg-gradient-to-br from-gray-200 to-gray-400 text-gray-800 border-gray-100';
        if (badgeStr.includes('برونز')) return 'bg-gradient-to-br from-orange-300 to-orange-500 text-amber-900 border-orange-200';
        return 'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-800 border-blue-100 dark:from-blue-900 dark:to-blue-800 dark:text-blue-100 dark:border-blue-700';
    };

    const html = `
        <div class="flex items-center gap-3 mb-6 px-2">
            <div class="w-12 h-12 rounded-2xl bg-brand-lightPrimary/10 dark:bg-brand-darkPrimary/10 flex items-center justify-center text-brand-lightPrimary dark:text-brand-darkPrimary text-xl">
                <i class="fa-solid fa-medal"></i>
            </div>
            <div>
                <h2 class="text-2xl font-black">لوحة الشرف</h2>
                <p class="text-sm text-gray-500">نعتز ونفتخر بفرسان الرياضيات المتميزين</p>
            </div>
        </div>

        ${(() => {
            const renderStudentImage = (student, defaultIcon, sizeClass = "w-16 h-16 md:w-20 md:h-20", textClass = "text-3xl") => {
                const imgClass = `${sizeClass} bg-gradient-to-br from-gray-200 to-gray-400 rounded-full flex items-center justify-center ${textClass} text-white shadow-lg border-4 border-white dark:border-dark-main relative z-10 group-hover:-translate-y-2 transition-transform duration-300 overflow-hidden object-cover bg-white`;

                if (student.image && student.image.trim() !== '') {
                    const driveMatch = student.image.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    if (driveMatch) {
                        const fileId = driveMatch[1];
                        return `<img src="https://drive.google.com/thumbnail?id=${fileId}&sz=w400" class="${imgClass}" alt="${student.name}">`;
                    }
                    return `<img src="${student.image}" class="${imgClass}" alt="${student.name}">`;
                }
                return `<div class="${imgClass}"><i class="fa-solid ${defaultIcon}"></i></div>`;
            };

            return ''; // Just to execute the helper definition without returning text
        })()}

        ${data.length >= 3 ? `
        <!-- Top 3 Podium -->
        <div class="flex justify-center items-end gap-2 md:gap-4 mb-10 mt-10 px-0">
            <!-- 2nd Place -->
            <div class="w-1/3 max-w-[140px] flex flex-col items-center group relative z-10">
                <div class="relative mb-2 flex justify-center w-full">
                    <div class="absolute top-0 -right-2 md:right-0 w-7 h-7 bg-gray-300 text-gray-700 rounded-full flex items-center justify-center text-sm font-black border-2 border-white dark:border-dark-main z-20 shadow-md">2</div>
                    ${(() => {
                if (data[1].image && data[1].image.trim() !== '') {
                    const dm = data[1].image.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    if (dm) return `<img src="https://drive.google.com/thumbnail?id=${dm[1]}&sz=w400" class="w-16 h-16 md:w-20 md:h-20 bg-gray-100 rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-dark-main relative z-10 group-hover:-translate-y-2 transition-transform duration-300 object-cover" alt="${data[1].name}">`;
                    return `<img src="${data[1].image}" class="w-16 h-16 md:w-20 md:h-20 bg-gray-100 rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-dark-main relative z-10 group-hover:-translate-y-2 transition-transform duration-300 object-cover" alt="${data[1].name}">`;
                }
                return `<div class="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-gray-200 to-gray-400 rounded-full flex items-center justify-center text-3xl text-white shadow-lg border-4 border-white dark:border-dark-main relative z-10 group-hover:-translate-y-2 transition-transform duration-300"><i class="fa-solid fa-user-graduate"></i></div>`;
            })()}
                </div>
                <div class="bg-gradient-to-t from-gray-200 to-gray-50 dark:from-gray-700 dark:to-gray-800 w-full rounded-t-2xl flex flex-col items-center justify-start pt-3 pb-2 shadow-inner min-h-[100px] border-t-4 border-gray-400 relative overflow-hidden">
                    <h3 class="font-bold text-xs md:text-sm text-center px-1 mb-1 text-gray-800 dark:text-gray-200 relative z-10 line-clamp-2">${data[1].name}</h3>
                    <div class="text-gray-600 dark:text-gray-400 font-bold text-xs relative z-10" dir="ltr">${data[1].score}</div>
                </div>
            </div>

            <!-- 1st Place (Center, Highest) -->
            <div class="w-1/3 max-w-[160px] flex flex-col items-center z-20 group">
                <div class="relative mb-2 flex justify-center w-full">
                    <i class="fa-solid fa-crown absolute -top-8 left-1/2 transform -translate-x-1/2 text-yellow-400 text-4xl z-30 drop-shadow-lg animate-bounce"></i>
                    <div class="absolute top-0 -right-2 md:right-0 w-8 h-8 bg-yellow-400 text-yellow-900 rounded-full flex items-center justify-center text-sm font-black border-2 border-white dark:border-dark-main z-20 shadow-lg">1</div>
                    ${(() => {
                if (data[0].image && data[0].image.trim() !== '') {
                    const dm = data[0].image.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    if (dm) return `<img src="https://drive.google.com/thumbnail?id=${dm[1]}&sz=w400" class="w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-dark-main relative z-10 group-hover:-translate-y-2 transition-transform duration-300 object-cover" alt="${data[0].name}">`;
                    return `<img src="${data[0].image}" class="w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-dark-main relative z-10 group-hover:-translate-y-2 transition-transform duration-300 object-cover" alt="${data[0].name}">`;
                }
                return `<div class="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-full flex items-center justify-center text-4xl text-white shadow-xl border-4 border-white dark:border-dark-main relative z-10 group-hover:-translate-y-2 transition-transform duration-300"><i class="fa-solid fa-user-tie"></i></div>`;
            })()}
                </div>
                <div class="bg-gradient-to-t from-yellow-100 to-white dark:from-yellow-900/40 dark:to-gray-800 w-full rounded-t-2xl flex flex-col items-center justify-start pt-4 pb-2 shadow-inner min-h-[140px] border-t-4 border-yellow-400 relative overflow-hidden">
                    <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjMyLCAyMTEsIDU2LCAwLjE1KSIvPjwvc3ZnPg==')] opacity-50"></div>
                    <h3 class="font-black text-sm md:text-base text-center px-1 mb-1 text-yellow-900 dark:text-yellow-400 relative z-10 line-clamp-2">${data[0].name}</h3>
                    <div class="text-yellow-700 dark:text-yellow-500 font-black text-sm relative z-10" dir="ltr">${data[0].score}</div>
                </div>
            </div>

            <!-- 3rd Place -->
            <div class="w-1/3 max-w-[140px] flex flex-col items-center group relative z-0">
                <div class="relative mb-2 flex justify-center w-full">
                    <div class="absolute top-0 -right-2 md:right-0 w-7 h-7 bg-orange-300 text-orange-900 rounded-full flex items-center justify-center text-sm font-black border-2 border-white dark:border-dark-main z-20 shadow-md">3</div>
                    ${(() => {
                if (data[2].image && data[2].image.trim() !== '') {
                    const dm = data[2].image.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    if (dm) return `<img src="https://drive.google.com/thumbnail?id=${dm[1]}&sz=w400" class="w-16 h-16 md:w-20 md:h-20 bg-gray-100 rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-dark-main relative z-10 group-hover:-translate-y-2 transition-transform duration-300 object-cover" alt="${data[2].name}">`;
                    return `<img src="${data[2].image}" class="w-16 h-16 md:w-20 md:h-20 bg-gray-100 rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-dark-main relative z-10 group-hover:-translate-y-2 transition-transform duration-300 object-cover" alt="${data[2].name}">`;
                }
                return `<div class="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-orange-300 to-orange-500 rounded-full flex items-center justify-center text-3xl text-white shadow-lg border-4 border-white dark:border-dark-main relative z-10 group-hover:-translate-y-2 transition-transform duration-300"><i class="fa-solid fa-user-graduate"></i></div>`;
            })()}
                </div>
                <div class="bg-gradient-to-t from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-gray-800 w-full rounded-t-2xl flex flex-col items-center justify-start pt-3 pb-2 shadow-inner min-h-[85px] border-t-4 border-orange-400 relative overflow-hidden">
                    <h3 class="font-bold text-xs md:text-sm text-center px-1 mb-1 text-orange-900 dark:text-orange-400 relative z-10 line-clamp-2">${data[2].name}</h3>
                    <div class="text-orange-700 dark:text-orange-500 font-bold text-xs relative z-10" dir="ltr">${data[2].score}</div>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- Other Students List -->
        ${data.length > 3 ? `
        <h3 class="font-bold text-lg mb-4 text-gray-700 dark:text-gray-300 px-2 flex items-center gap-2"><i class="fa-solid fa-star text-brand-secondary"></i> قائمة المتميزين</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 px-2 pb-6">
            ${data.slice(3).map((student, index) => `
                <div class="bg-white dark:bg-dark-surface rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-4 hover:border-brand-lightPrimary dark:hover:border-brand-darkPrimary transition-colors group">
                    ${(() => {
                    if (student.image && student.image.trim() !== '') {
                        const dm = student.image.match(/\/d\/([a-zA-Z0-9_-]+)/);
                        if (dm) return `<img src="https://drive.google.com/thumbnail?id=${dm[1]}&sz=w200" class="w-12 h-12 rounded-full flex-shrink-0 object-cover shadow-sm ${getBadgeStyle(student.badge)} group-hover:scale-110 transition-transform border border-gray-100 dark:border-gray-800" alt="${student.name}">`;
                        return `<img src="${student.image}" class="w-12 h-12 rounded-full flex-shrink-0 object-cover shadow-sm ${getBadgeStyle(student.badge)} group-hover:scale-110 transition-transform border border-gray-100 dark:border-gray-800" alt="${student.name}">`;
                    }
                    return `<div class="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-xl shadow-sm ${getBadgeStyle(student.badge)} group-hover:scale-110 transition-transform"><i class="fa-solid fa-medal"></i></div>`;
                })()}
                    <div class="flex-grow">
                        <h3 class="font-bold text-sm mb-1 text-gray-800 dark:text-gray-100">${student.name}</h3>
                        <div class="text-xs text-gray-500">${student.badge}</div>
                    </div>
                    <div class="text-brand-lightPrimary dark:text-brand-darkPrimary font-bold text-lg bg-brand-lightPrimary/5 dark:bg-brand-darkPrimary/5 px-3 py-1 rounded-lg" dir="ltr">
                        ${student.score}
                    </div>
                </div>
            `).join('')}
        </div>
        ` : (data.length === 3 ? '<div class="text-center p-4 text-gray-400 text-sm mt-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">تم عرض جميع الطلاب المتفوقين في المنصة الشرفية.</div>' : `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 px-2 pb-6">
            ${data.map((student, index) => `
                <div class="bg-white dark:bg-dark-surface rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-4 hover:border-brand-lightPrimary dark:hover:border-brand-darkPrimary transition-colors group">
                    ${(() => {
                        if (student.image && student.image.trim() !== '') {
                            const dm = student.image.match(/\/d\/([a-zA-Z0-9_-]+)/);
                            if (dm) return `<img src="https://drive.google.com/thumbnail?id=${dm[1]}&sz=w200" class="w-12 h-12 rounded-full flex-shrink-0 object-cover shadow-sm ${getBadgeStyle(student.badge)} group-hover:scale-110 transition-transform border border-gray-100 dark:border-gray-800" alt="${student.name}">`;
                            return `<img src="${student.image}" class="w-12 h-12 rounded-full flex-shrink-0 object-cover shadow-sm ${getBadgeStyle(student.badge)} group-hover:scale-110 transition-transform border border-gray-100 dark:border-gray-800" alt="${student.name}">`;
                        }
                        return `<div class="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-xl shadow-sm ${getBadgeStyle(student.badge)} group-hover:scale-110 transition-transform"><i class="fa-solid fa-medal"></i></div>`;
                    })()}
                    <div class="flex-grow">
                        <h3 class="font-bold text-sm mb-1 text-gray-800 dark:text-gray-100">${student.name}</h3>
                        <div class="text-xs text-gray-500">${student.badge}</div>
                    </div>
                    <div class="text-brand-lightPrimary dark:text-brand-darkPrimary font-bold text-lg bg-brand-lightPrimary/5 dark:bg-brand-darkPrimary/5 px-3 py-1 rounded-lg" dir="ltr">
                        ${student.score}
                    </div>
                </div>
            `).join('')}
        </div>
        `)}
    `;
    pageContent.innerHTML = html;
}

// --- Modals Logic (Shared) ---
function setupModals() {
    const openModal = (modalId) => {
        if (!modalOverlay || !document.getElementById(modalId)) return;
        modalOverlay.classList.remove('hidden');
        document.getElementById(modalId).classList.remove('hidden');

        setTimeout(() => {
            modalOverlay.classList.remove('opacity-0');
            modalOverlay.classList.add('opacity-100');
            const m = document.getElementById(modalId);
            m.classList.remove('scale-95', 'opacity-0');
            m.classList.add('scale-100', 'opacity-100');
        }, 10);

        if (modalId === 'contactModal' && appData && appData.contact) {
            populateContactLinks();
        }
    };

    const closeAllModals = () => {
        modalOverlay.classList.remove('opacity-100');
        modalOverlay.classList.add('opacity-0');
        document.querySelectorAll('#modalOverlay > div').forEach(m => {
            m.classList.remove('scale-100', 'opacity-100');
            m.classList.add('scale-95', 'opacity-0');
        });
        setTimeout(() => {
            modalOverlay.classList.add('hidden');
            document.querySelectorAll('#modalOverlay > div').forEach(m => {
                m.classList.add('hidden');
                // Cleanup preview container on close
                if (m.id === 'drivePreviewModal') {
                    const prevContainer = document.getElementById('drivePreviewContainer');
                    if (prevContainer) prevContainer.innerHTML = '';
                }
            });
        }, 300);
    };

    if (contactBtn) {
        contactBtn.addEventListener('click', () => openModal('contactModal'));
    }

    closeModals.forEach(btn => btn.addEventListener('click', closeAllModals));

    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeAllModals();
        });
    }
}

function populateContactLinks() {
    const container = document.getElementById('contactLinksContainer');
    if (!container) return;
    const contactInfo = appData.contact;
    container.innerHTML = `
        <a href="https://wa.me/${contactInfo.whatsapp}" target="_blank" rel="noopener noreferrer" class="w-full bg-[#25D366] text-white p-4 rounded-2xl flex items-center justify-center gap-3 font-bold hover:bg-[#128C7E] transition-colors shadow-lg shadow-[#25D366]/30">
            <i class="fa-brands fa-whatsapp text-2xl"></i>
            واتساب (${contactInfo.whatsapp})
        </a>
        <a href="mailto:${contactInfo.email}" class="w-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white p-4 rounded-2xl flex items-center justify-center gap-3 font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <i class="fa-regular fa-envelope text-xl"></i>
            البريد الإلكتروني
        </a>
    `;
}

// --- Simple Admin Logic ---
function setupAdminPanel() {
    const adminAuthSection = document.getElementById('adminAuthSection');
    const adminEditorSection = document.getElementById('adminEditorSection');
    const passwordInp = document.getElementById('adminPassword');
    const loginBtn = document.getElementById('adminLoginBtn');
    const logoutBtn = document.getElementById('adminLogoutBtn');
    const saveBtn = document.getElementById('savePublishBtn');
    const jsonArea = document.getElementById('jsonEditorArea');
    const visualEditorArea = document.getElementById('visualEditorArea');

    const toastBtn = {
        toast: document.getElementById('toast'),
        msg: document.getElementById('toastMsg'),
        icon: document.getElementById('toastIcon')
    };

    function showToast(message, type = 'success') {
        if (!toastBtn.toast) return;
        toastBtn.msg.textContent = message;
        toastBtn.toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 z-[70] transition-all duration-300 px-6 py-3 rounded-2xl shadow-xl font-bold flex items-center gap-3 glassmorphism-bottom border';
        toastBtn.icon.className = 'fa-solid text-xl';

        if (type === 'success') {
            toastBtn.toast.classList.add('text-brand-lightPrimary', 'dark:text-brand-darkPrimary', 'border-brand-lightPrimary', 'bg-white', 'dark:bg-gray-800');
            toastBtn.icon.classList.add('fa-circle-check');
        } else if (type === 'error') {
            toastBtn.toast.classList.add('text-red-500', 'border-red-500', 'bg-white', 'dark:bg-gray-800');
            toastBtn.icon.classList.add('fa-circle-xmark');
        } else if (type === 'loading') {
            toastBtn.toast.classList.add('text-brand-secondary', 'border-brand-secondary', 'bg-white', 'dark:bg-gray-800');
            toastBtn.icon.classList.add('fa-circle-notch', 'fa-spin');
        }

        toastBtn.toast.classList.remove('hidden');
        setTimeout(() => {
            toastBtn.toast.classList.remove('opacity-0');
            toastBtn.toast.classList.add('opacity-100', 'translate-y-2');
        }, 10);

        if (type !== 'loading') {
            setTimeout(() => {
                toastBtn.toast.classList.remove('opacity-100', 'translate-y-2');
                toastBtn.toast.classList.add('opacity-0');
                setTimeout(() => toastBtn.toast.classList.add('hidden'), 300);
            }, 3000);
        }
    }

    // A helper function to build the visual editor form
    function buildVisualEditor() {
        if (!appData || !visualEditorArea) return;

        let html = '';

        // Tab Navigation
        html += `
        <div class="flex gap-2 overflow-x-auto pb-2 mb-4 border-b border-gray-200 dark:border-gray-700">
            <button type="button" class="admin-tab-btn active px-4 py-2 font-bold text-brand-lightPrimary dark:text-brand-darkPrimary border-b-2 border-brand-lightPrimary dark:border-brand-darkPrimary shadow-sm rounded-t-lg bg-gray-50 dark:bg-gray-800" data-target="admin-tab-home">الرئيسية</button>
            <button type="button" class="admin-tab-btn px-4 py-2 font-bold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors" data-target="admin-tab-evidence">الشواهد</button>
            <button type="button" class="admin-tab-btn px-4 py-2 font-bold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors" data-target="admin-tab-math">المعمل</button>
            <button type="button" class="admin-tab-btn px-4 py-2 font-bold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors" data-target="admin-tab-nafes">نافس</button>
            <button type="button" class="admin-tab-btn px-4 py-2 font-bold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors" data-target="admin-tab-honor">لوحة الشرف</button>
        </div>
        `;

        // 0. Home Page
        html += `<div id="admin-tab-home" class="admin-tab-content block p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 mb-4 animate-fadeIn">`;
        html += `<h3 class="font-bold text-lg mb-4 text-brand-lightPrimary dark:text-brand-darkPrimary"><i class="fa-solid fa-house ml-2"></i>الصفحة الرئيسية</h3>`;
        html += `
            <div class="mb-3">
                <label class="block text-sm font-bold mb-1">صورة الغلاف (رابط الصورة أو Google Drive)</label>
                <input type="text" id="home_hero_image" value="${appData.home.heroImage || ''}" class="w-full bg-white dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-lightPrimary" dir="ltr" placeholder="رابط جوجل درايف أو صورة مباشرة...">
            </div>
            <div class="mb-3">
                <label class="block text-sm font-bold mb-1">الرؤية</label>
                <textarea id="home_vision" class="w-full bg-white dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-lightPrimary min-h-[80px]" dir="rtl">${appData.home.vision || ''}</textarea>
            </div>
            <div class="mb-3">
                <label class="block text-sm font-bold mb-1">الرسالة</label>
                <textarea id="home_mission" class="w-full bg-white dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-lightPrimary min-h-[80px]" dir="rtl">${appData.home.mission || ''}</textarea>
            </div>
            <div class="mb-3">
                <label class="block text-sm font-bold mb-1">الجدول الدراسي (رابط جوجل درايف أو صورة)</label>
                <input type="text" id="home_schedule_url" value="${appData.home.scheduleUrl || ''}" class="w-full bg-white dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-lightPrimary" dir="ltr" placeholder="رابط جوجل درايف أو صورة مباشرة...">
            </div>
        `;
        // Objectives
        if (appData.home.objectives) {
            html += `<h4 class="font-bold text-md mt-4 mb-2 text-brand-secondary">الأهداف المهنية والتربوية</h4>`;
            appData.home.objectives.forEach((obj, idx) => {
                html += `
                <div class="mb-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-surface">
                    <label class="block text-xs font-bold mb-1">عنوان الجانب ${idx + 1}</label>
                    <input type="text" id="home_obj_title_${idx}" value="${obj.title}" class="w-full bg-gray-50 dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm mb-2">
                    <label class="block text-xs font-bold mb-1">النقاط (مفصولة بفاصلة أو سطر جديد)</label>
                    <textarea id="home_obj_items_${idx}" class="w-full bg-gray-50 dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm min-h-[80px] leading-relaxed">${obj.items.join('\n')}</textarea>
                </div>
                `;
            });
        }

        // Stats
        if (appData.home.stats) {
            html += `<h4 class="font-bold text-md mt-4 mb-2 text-brand-secondary">الإحصائيات والأرقام (Home Stats)</h4>`;
            html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">`;
            appData.home.stats.forEach((stat, idx) => {
                html += `
                <div class="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-surface">
                    <label class="block text-xs font-bold mb-1 mr-1">عنوان الإحصائية (مثال: سنوات الخبرة)</label>
                    <input type="text" id="home_stat_label_${idx}" value="${stat.label}" class="w-full bg-gray-50 dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm mb-2">
                    
                    <label class="block text-xs font-bold mb-1 mr-1">القيمة (مثال: +15)</label>
                    <input type="text" id="home_stat_value_${idx}" value="${stat.value}" class="w-full bg-gray-50 dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-lightPrimary" dir="ltr">
                </div>
                `;
            });
            html += `</div>`;
        }

        html += `</div>`;

        // 1. Evidence Reports
        html += `<div id="admin-tab-evidence" class="admin-tab-content hidden p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 animate-fadeIn">`;
        html += `<h3 class="font-bold text-lg mb-4 text-brand-lightPrimary dark:text-brand-darkPrimary"><i class="fa-solid fa-file-contract ml-2"></i>تقارير الشواهد والأدلة</h3>`;

        appData.evidenceReports.forEach((report, index) => {
            html += `
                <div class="mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
                    <h4 class="font-bold mb-2 text-[#fbbf24]">${report.mainTitle}</h4>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                            <label class="block text-xs font-bold mb-1">العنوان الرئيسي</label>
                            <input type="text" id="er_maintitle_${index}" value="${report.mainTitle}" class="w-full bg-white dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-[#2f7041]">
                        </div>
                        <div>
                            <label class="block text-xs font-bold mb-1">العنوان الفرعي</label>
                            <input type="text" id="er_subtitle_${index}" value="${report.subTitle}" class="w-full bg-white dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-[#2f7041]">
                        </div>
                    </div>

                    <h5 class="text-xs font-bold mb-2 text-gray-500 mt-4">عناصر شبكة المعلومات:</h5>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                        ${report.infoGrid.map((info, i) => `
                            <div>
                                <label class="block text-[10px] text-gray-400">${info.title} (القيمة)</label>
                                <input type="text" id="er_info_${index}_${i}" value="${info.value}" class="w-full bg-white dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-[#2f7041]">
                            </div>
                        `).join('')}
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                            <label class="block text-xs font-bold mb-1">${report.goalsTitle} (سطر لكل هدف)</label>
                            <textarea id="er_goals_${index}" class="w-full bg-white dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm h-24 focus:ring-1 focus:ring-[#2f7041]" dir="rtl">${report.goalsList.join('\n')}</textarea>
                        </div>
                        <div>
                            <label class="block text-xs font-bold mb-1">${report.proceduresTitle} (سطر لكل إجراء)</label>
                            <textarea id="er_procs_${index}" class="w-full bg-white dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm h-24 focus:ring-1 focus:ring-[#2f7041]" dir="rtl">${report.proceduresList.join('\n')}</textarea>
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold mb-1">روابط الصور أو الشواهد (رابط في كل سطر)</label>
                        <textarea id="er_images_${index}" class="w-full bg-white dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm h-24 focus:ring-1 focus:ring-[#2f7041]" dir="ltr">${report.evidenceImages.join('\n')}</textarea>
                    </div>
                </div>
            `;
        });
        html += `</div>`;

        // 2. Math Lab Links
        html += `<div id="admin-tab-math" class="admin-tab-content hidden p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 mt-4 animate-fadeIn">`;
        html += `<h3 class="font-bold text-lg mb-4 text-brand-lightPrimary dark:text-brand-darkPrimary"><i class="fa-solid fa-square-root-variable ml-2"></i>روابط المعمل والمصادر</h3>`;
        html += `<h4 class="font-bold text-sm mb-2 text-gray-500">الأدوات التفاعلية</h4>`;
        appData.math_lab.tools.forEach((tool, index) => {
            html += `
                <div class="mb-3">
                    <label class="block text-sm font-bold mb-1">${tool.name}</label>
                    <input type="text" id="ml_tool_${index}" value="${tool.link}" class="w-full bg-white dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-lightPrimary" dir="ltr" placeholder="رابط الأداة">
                </div>
            `;
        });
        html += `<h4 class="font-bold text-sm mb-2 mt-4 text-gray-500">المحتوى المرئي</h4>`;
        appData.math_lab.visuals.forEach((visual, index) => {
            html += `
                <div class="mb-3">
                    <label class="block text-sm font-bold mb-1">${visual.title}</label>
                    <input type="text" id="ml_vis_${index}" value="${visual.link}" class="w-full bg-white dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-lightPrimary" dir="ltr" placeholder="رابط الفيديو/الملف">
                </div>
            `;
        });
        html += `</div>`;

        // 3. Nafes Dashboard
        html += `<div id="admin-tab-nafes" class="admin-tab-content hidden p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 mt-4 animate-fadeIn">`;
        html += `<h3 class="font-bold text-lg mb-4 text-brand-lightPrimary dark:text-brand-darkPrimary"><i class="fa-solid fa-chart-line ml-2"></i>لوحة بيانات نافس</h3>`;

        if (appData.nafes) {
            // Quick Stats
            html += `<h4 class="font-bold text-sm mb-2 text-gray-500">الإحصائيات السريعة</h4>`;
            html += `<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">`;
            html += `
                <div>
                    <label class="block text-xs font-bold mb-1">النماذج المحاكية</label>
                    <input type="text" id="nafes_stat_models" value="${appData.nafes.quickStats.modelsCount}" class="w-full bg-white dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-sm focus:ring-1 focus:ring-brand-lightPrimary" dir="ltr">
                </div>
                <div>
                    <label class="block text-xs font-bold mb-1">نسبة التحسن</label>
                    <input type="text" id="nafes_stat_improve" value="${appData.nafes.quickStats.improvement}" class="w-full bg-white dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-sm focus:ring-1 focus:ring-brand-lightPrimary" dir="ltr">
                </div>
                <div>
                    <label class="block text-xs font-bold mb-1">الطلاب المشاركون</label>
                    <input type="text" id="nafes_stat_students" value="${appData.nafes.quickStats.studentsCount}" class="w-full bg-white dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-sm focus:ring-1 focus:ring-brand-lightPrimary" dir="ltr">
                </div>
            `;
            html += `</div>`;

            // Chart Data
            html += `<h4 class="font-bold text-sm mb-2 mt-4 text-gray-500">بيانات الرسم البياني (مفصولة بفاصلة)</h4>`;
            html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">`;
            html += `
                <div>
                    <label class="block text-xs font-bold mb-1">الفترات الزمنية (Labels)</label>
                    <input type="text" id="nafes_chart_labels" value="${appData.nafes.chartData.labels.join('، ')}" class="w-full bg-white dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-sm focus:ring-1 focus:ring-brand-lightPrimary" placeholder="الأسبوع 1، الأسبوع 2...">
                </div>
                <div>
                    <label class="block text-xs font-bold mb-1">النسب المئوية للأداء (Values)</label>
                    <input type="text" id="nafes_chart_values" value="${appData.nafes.chartData.values.join('، ')}" class="w-full bg-white dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-sm focus:ring-1 focus:ring-brand-lightPrimary" dir="ltr" placeholder="45, 55, 68...">
                </div>
            `;
            html += `</div>`;

            // Simulation Models
            html += `<div class="flex justify-between items-center mt-4 mb-2">
                        <h4 class="font-bold text-sm text-gray-500">النماذج المحاكية</h4>
                        <button type="button" onclick="addNafesModel()" class="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 transition-colors shadow-sm"><i class="fa-solid fa-plus ml-1"></i> إضافة نموذج</button>
                    </div>`;
            appData.nafes.simulationModels.forEach((model, index) => {
                html += `
                    <div class="mb-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-surface relative group transition-all hover:border-indigo-300 dark:hover:border-indigo-700">
                        <button type="button" onclick="removeNafesModel(${index})" class="absolute top-3 left-3 w-8 h-8 flex items-center justify-center bg-red-50 dark:bg-red-900/30 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors"><i class="fa-solid fa-trash"></i></button>
                        <label class="block text-xs font-bold mb-1 text-gray-500">نموذج ${index + 1}</label>
                        <input type="text" id="nafes_model_title_${index}" value="${model.title}" class="w-full bg-gray-50 dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm mb-2" placeholder="العنوان ...">
                        <input type="text" id="nafes_model_details_${index}" value="${model.details}" class="w-full bg-gray-50 dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm mb-2" placeholder="التفاصيل (الوحدة المغطاة ...)">
                        <input type="text" id="nafes_model_url_${index}" value="${model.url}" class="w-full bg-gray-50 dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm" dir="ltr" placeholder="رابط الاختبار ...">
                    </div>
                `;
            });

            // Preparation Plans
            html += `<div class="flex justify-between items-center mt-4 mb-2">
                        <h4 class="font-bold text-sm text-gray-500">خطط التهيئة والتدخل</h4>
                        <button type="button" onclick="addNafesPlan()" class="text-xs bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-bold px-3 py-1.5 rounded-lg hover:bg-rose-600 hover:text-white dark:hover:bg-rose-500 transition-colors shadow-sm"><i class="fa-solid fa-plus ml-1"></i> إضافة خطة</button>
                    </div>`;
            appData.nafes.preparationPlans.forEach((plan, index) => {
                html += `
                    <div class="mb-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-surface relative group transition-all hover:border-rose-300 dark:hover:border-rose-700">
                        <button type="button" onclick="removeNafesPlan(${index})" class="absolute top-3 left-3 w-8 h-8 flex items-center justify-center bg-red-50 dark:bg-red-900/30 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors"><i class="fa-solid fa-trash"></i></button>
                        <label class="block text-xs font-bold mb-1 text-gray-500">خطة ${index + 1}</label>
                        <input type="text" id="nafes_plan_title_${index}" value="${plan.title}" class="w-full bg-gray-50 dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm mb-2" placeholder="العنوان ...">
                        <input type="text" id="nafes_plan_update_${index}" value="${plan.lastUpdated}" class="w-full bg-gray-50 dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm mb-2" placeholder="نص التحديث (تحديث: قبل يومين ...)">
                        <input type="text" id="nafes_plan_url_${index}" value="${plan.url}" class="w-full bg-gray-50 dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm" dir="ltr" placeholder="رابط الملف ...">
                    </div>
                `;
            });
        }

        html += `</div>`;

        // 4. Honor Roll
        html += `<div id="admin-tab-honor" class="admin-tab-content hidden p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 mt-4 animate-fadeIn">`;
        html += `<h3 class="font-bold text-lg mb-4 text-brand-lightPrimary dark:text-brand-darkPrimary"><i class="fa-solid fa-medal ml-2"></i>لوحة الشرف (الطلاب المتميزين)</h3>`;
        if (appData.honor_roll && appData.honor_roll.length > 0) {
            appData.honor_roll.forEach((student, index) => {
                html += `
                    <div class="mb-4 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-surface">
                        <label class="block text-xs font-bold mb-1 text-gray-500">الطالب رقم ${index + 1}</label>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                            <div>
                                <label class="block text-xs font-bold mb-1">الاسم</label>
                                <input type="text" id="hr_name_${index}" value="${student.name}" class="w-full bg-gray-50 dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-lightPrimary">
                            </div>
                            <div>
                                <label class="block text-xs font-bold mb-1">صورة الطالب (رابط Google Drive)</label>
                                <input type="text" id="hr_image_${index}" value="${student.image || ''}" class="w-full bg-gray-50 dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-lightPrimary" dir="ltr" placeholder="اختياري...">
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-bold mb-1">الدرجة/النسبة</label>
                                <input type="text" id="hr_score_${index}" value="${student.score}" class="w-full bg-gray-50 dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-lightPrimary" dir="ltr">
                            </div>
                            <div>
                                <label class="block text-xs font-bold mb-1">الوسام (ذهبية، فضية، الخ)</label>
                                <input type="text" id="hr_badge_${index}" value="${student.badge}" class="w-full bg-gray-50 dark:bg-dark-main border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-lightPrimary">
                            </div>
                        </div>
                    </div>
                `;
            });
            html += `<p class="text-xs text-brand-secondary font-bold mt-2"><i class="fa-solid fa-circle-info ml-1"></i> أول 3 طلاب سيظهرون على منصة التتويج، والبقية في القائمة.</p>`;
        }
        html += `</div>`;

        visualEditorArea.innerHTML = html;

        // Attach Tab listeners
        const tabBtns = visualEditorArea.querySelectorAll('.admin-tab-btn');
        const tabContents = visualEditorArea.querySelectorAll('.admin-tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                // Reset all tabs
                tabBtns.forEach(b => {
                    b.classList.remove('active', 'text-brand-lightPrimary', 'dark:text-brand-darkPrimary', 'border-b-2', 'border-brand-lightPrimary', 'dark:border-brand-darkPrimary', 'shadow-sm', 'rounded-t-lg', 'bg-gray-50', 'dark:bg-gray-800');
                    b.classList.add('text-gray-500', 'dark:text-gray-400');
                });

                // Set active tab styling
                btn.classList.add('active', 'text-brand-lightPrimary', 'dark:text-brand-darkPrimary', 'border-b-2', 'border-brand-lightPrimary', 'dark:border-brand-darkPrimary', 'shadow-sm', 'rounded-t-lg', 'bg-gray-50', 'dark:bg-gray-800');
                btn.classList.remove('text-gray-500', 'dark:text-gray-400');

                // Hide all contents
                tabContents.forEach(c => {
                    c.classList.remove('block');
                    c.classList.add('hidden');
                });

                // Show target content
                const targetId = btn.getAttribute('data-target');
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    targetEl.classList.remove('hidden');
                    targetEl.classList.add('block');
                }
            });
        });
    }

    // Read form values back into appData clone
    function saveVisualData() {
        if (!appData) return null;
        const newData = JSON.parse(JSON.stringify(appData)); // Deep clone

        // 0. Home Page
        const homeHeroInp = document.getElementById('home_hero_image');
        const homeVisionInp = document.getElementById('home_vision');
        const homeMissionInp = document.getElementById('home_mission');
        const homeScheduleInp = document.getElementById('home_schedule_url');

        if (!newData.home) newData.home = {};
        if (homeHeroInp) newData.home.heroImage = homeHeroInp.value;
        if (homeVisionInp) newData.home.vision = homeVisionInp.value;
        if (homeMissionInp) newData.home.mission = homeMissionInp.value;
        if (homeScheduleInp) newData.home.scheduleUrl = homeScheduleInp.value;

        if (newData.home.objectives) {
            newData.home.objectives.forEach((obj, idx) => {
                const titleInp = document.getElementById(`home_obj_title_${idx}`);
                const itemsInp = document.getElementById(`home_obj_items_${idx}`);
                if (titleInp) obj.title = titleInp.value;
                if (itemsInp) {
                    obj.items = itemsInp.value.split('\n').map(i => i.trim()).filter(i => i);
                }
            });
        }

        // Stats
        if (newData.home.stats) {
            newData.home.stats.forEach((stat, idx) => {
                const labelInp = document.getElementById(`home_stat_label_${idx}`);
                const valueInp = document.getElementById(`home_stat_value_${idx}`);
                if (labelInp) stat.label = labelInp.value;
                if (valueInp) stat.value = valueInp.value;
            });
        }

        // 1. Evidence Reports
        if (newData.evidenceReports) {
            newData.evidenceReports.forEach((report, index) => {
                const titleInp = document.getElementById(`er_maintitle_${index}`);
                if (titleInp) report.mainTitle = titleInp.value;

                const subInp = document.getElementById(`er_subtitle_${index}`);
                if (subInp) report.subTitle = subInp.value;

                report.infoGrid.forEach((info, i) => {
                    const infoInp = document.getElementById(`er_info_${index}_${i}`);
                    if (infoInp) info.value = infoInp.value;
                });

                const goalsInp = document.getElementById(`er_goals_${index}`);
                if (goalsInp) report.goalsList = parseLinks(goalsInp.value);

                const procsInp = document.getElementById(`er_procs_${index}`);
                if (procsInp) report.proceduresList = parseLinks(procsInp.value);

                const imagesInp = document.getElementById(`er_images_${index}`);
                if (imagesInp) report.evidenceImages = parseLinks(imagesInp.value);
            });
        }

        // 2. Math Lab Tools
        if (newData.math_lab && newData.math_lab.tools) {
            newData.math_lab.tools.forEach((tool, index) => {
                const inp = document.getElementById(`ml_tool_${index}`);
                if (inp) tool.link = inp.value;
            });
        }

        // 2b. Math Lab Visuals
        if (newData.math_lab && newData.math_lab.visuals) {
            newData.math_lab.visuals.forEach((visual, index) => {
                const inp = document.getElementById(`ml_vis_${index}`);
                if (inp) visual.link = inp.value;
            });
        }

        // 3. Nafes Dashboard
        if (newData.nafes) {
            // Stats
            const modelsInp = document.getElementById('nafes_stat_models');
            const improveInp = document.getElementById('nafes_stat_improve');
            const studentsInp = document.getElementById('nafes_stat_students');

            if (modelsInp) newData.nafes.quickStats.modelsCount = modelsInp.value;
            if (improveInp) newData.nafes.quickStats.improvement = improveInp.value;
            if (studentsInp) newData.nafes.quickStats.studentsCount = studentsInp.value;

            // Chart
            const labelsInp = document.getElementById('nafes_chart_labels');
            const valuesInp = document.getElementById('nafes_chart_values');
            if (labelsInp) {
                newData.nafes.chartData.labels = labelsInp.value.split(/[،,]/).map(l => l.trim()).filter(l => l);
            }
            if (valuesInp) {
                newData.nafes.chartData.values = valuesInp.value.split(/[،,]/).map(v => Number(v.trim())).filter(v => !isNaN(v));
            }

            // Models
            if (newData.nafes.simulationModels) {
                newData.nafes.simulationModels.forEach((model, idx) => {
                    const tInp = document.getElementById(`nafes_model_title_${idx}`);
                    const dInp = document.getElementById(`nafes_model_details_${idx}`);
                    const uInp = document.getElementById(`nafes_model_url_${idx}`);
                    if (tInp) model.title = tInp.value;
                    if (dInp) model.details = dInp.value;
                    if (uInp) model.url = uInp.value;
                });
            }

            // Plans
            if (newData.nafes.preparationPlans) {
                newData.nafes.preparationPlans.forEach((plan, idx) => {
                    const tInp = document.getElementById(`nafes_plan_title_${idx}`);
                    const upInp = document.getElementById(`nafes_plan_update_${idx}`);
                    const uInp = document.getElementById(`nafes_plan_url_${idx}`);
                    if (tInp) plan.title = tInp.value;
                    if (upInp) plan.lastUpdated = upInp.value;
                    if (uInp) plan.url = uInp.value;
                });
            }
        }

        // 4. Honor Roll
        if (newData.honor_roll) {
            newData.honor_roll.forEach((student, index) => {
                const nameInp = document.getElementById(`hr_name_${index}`);
                const scoreInp = document.getElementById(`hr_score_${index}`);
                const badgeInp = document.getElementById(`hr_badge_${index}`);
                const imageInp = document.getElementById(`hr_image_${index}`);

                if (nameInp) student.name = nameInp.value;
                if (scoreInp) student.score = scoreInp.value;
                if (badgeInp) student.badge = badgeInp.value;
                if (imageInp) student.image = imageInp.value;
            });
        }

        return newData;
    }

    // Dynamic Lists Management Functions
    window.addNafesModel = function () {
        if (!appData || !appData.nafes) return;
        const currentData = saveVisualData();
        if (currentData) appData = currentData;
        appData.nafes.simulationModels.push({ title: '', details: '', url: '' });
        buildVisualEditor();
        setTimeout(() => { const tab = document.querySelector('.admin-tab-btn[data-target="admin-tab-nafes"]'); if (tab) tab.click(); }, 10);
    };

    window.removeNafesModel = function (index) {
        if (!appData || !appData.nafes) return;
        if (!confirm('هل أنت متأكد من حذف هذا النموذج؟\nيرجى التأكد من الضغط على "حفظ ونشر التعديلات" لاحقاً.')) return;
        const currentData = saveVisualData();
        if (currentData) appData = currentData;
        appData.nafes.simulationModels.splice(index, 1);
        buildVisualEditor();
        setTimeout(() => { const tab = document.querySelector('.admin-tab-btn[data-target="admin-tab-nafes"]'); if (tab) tab.click(); }, 10);
    };

    window.addNafesPlan = function () {
        if (!appData || !appData.nafes) return;
        const currentData = saveVisualData();
        if (currentData) appData = currentData;
        appData.nafes.preparationPlans.push({ title: '', lastUpdated: '', url: '' });
        buildVisualEditor();
        setTimeout(() => { const tab = document.querySelector('.admin-tab-btn[data-target="admin-tab-nafes"]'); if (tab) tab.click(); }, 10);
    };

    window.removeNafesPlan = function (index) {
        if (!appData || !appData.nafes) return;
        if (!confirm('هل أنت متأكد من حذف هذه الخطة؟\nيرجى التأكد من الضغط على "حفظ ونشر التعديلات" لاحقاً.')) return;
        const currentData = saveVisualData();
        if (currentData) appData = currentData;
        appData.nafes.preparationPlans.splice(index, 1);
        buildVisualEditor();
        setTimeout(() => { const tab = document.querySelector('.admin-tab-btn[data-target="admin-tab-nafes"]'); if (tab) tab.click(); }, 10);
    };

    const checkAuth = () => {
        const storedAuth = localStorage.getItem('is_admin');

        if (storedAuth === 'true') {
            if (adminAuthSection) adminAuthSection.classList.add('hidden');
            if (adminEditorSection) adminEditorSection.classList.remove('hidden');
            buildVisualEditor();
        } else {
            if (adminAuthSection) adminAuthSection.classList.remove('hidden');
            if (adminEditorSection) adminEditorSection.classList.add('hidden');
        }
    };

    checkAuth();

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            if (passwordInp.value === '5561') {
                localStorage.setItem('is_admin', 'true');
                checkAuth();
                showToast('تم تسجيل الدخول بنجاح', 'success');
            } else {
                showToast('كلمة المرور خاطئة', 'error');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('is_admin');
            if (passwordInp) passwordInp.value = '';
            checkAuth();
            showToast('تم تسجيل الخروج', 'success');
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin ml-2"></i>جاري الحفظ والرفع...';
            saveBtn.disabled = true;

            try {
                const updatedData = saveVisualData();
                if (!updatedData) throw new Error("Data not ready");

                // Save directly to Supabase via REST API (no SDK needed)
                await supabaseUpdateConfig(updatedData);

                appData = updatedData; // Update active memory

                showToast('تم حفظ التعديلات ونشرها للجميع بنجاح!', 'success');

                // Re-render
                buildVisualEditor();

            } catch (e) {
                showToast('حدث خطأ أثناء الحفظ ونشر التعديلات', 'error');
                console.error(e);
            } finally {
                saveBtn.innerHTML = originalText;
                saveBtn.disabled = false;
            }
        });
    }
}
