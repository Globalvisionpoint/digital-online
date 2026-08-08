/**
 * Cookie Consent Manager — Digital Online
 * Conform: GDPR (Reg. UE 2016/679) + ePrivacy Directive 2002/58/CE
 *
 * Categorii de cookie-uri:
 *   - necessary:  esențiale (sesiune, securitate, preferințe) — nu necesită consimțământ
 *   - functional: funcționale (preferințe utilizator)
 *   - analytics:  analitice (Google Analytics 4 etc.)
 *   - marketing:  marketing (Meta Pixel, Google Ads, TikTok Pixel)
 *
 * Stocare: localStorage["cookie-consent-v1"] = JSON { version, timestamp, categories }
 * Versiune: 1.0
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'cookie-consent-v1';
    const CONSENT_VERSION = '1.0';
    const PRIVACY_POLICY_URL = 'politica-confidentialitate.html';

    const CATEGORIES = {
        necessary: {
            name: 'Necesare',
            required: true,
            description: 'Cookie-uri esențiale pentru funcționarea site-ului: sesiune, securitate, preferințe de confidențialitate. Nu pot fi dezactivate.',
            cookies: ['cookie-consent-v1', 'session-id']
        },
        functional: {
            name: 'Funcționale',
            required: false,
            description: 'Cookie-uri care rețin preferințele tale (limbă, temă, setări formular) pentru a-ți oferi o experiență personalizată.',
            cookies: ['pref-locale', 'pref-theme']
        },
        analytics: {
            name: 'Analitice',
            required: false,
            description: 'Cookie-uri care ne ajută să înțelegem cum folosești site-ul (pagini vizitate, timp petrecut). Datele sunt agregate și anonime.',
            cookies: ['_ga', '_ga_*', '_gid', '_gat']
        },
        marketing: {
            name: 'Marketing',
            required: false,
            description: 'Cookie-uri utilizate pentru a-ți afișa reclame relevante și a măsura eficiența campaniilor publicitare (Meta Pixel, Google Ads, TikTok Pixel).',
            cookies: ['_fbp', '_fbc', '_gcl_au', '_ttp', 'fr']
        }
    };

    // ============================================
    // STATE
    // ============================================

    function getConsent() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (data.version !== CONSENT_VERSION) return null;
            return data;
        } catch (e) {
            return null;
        }
    }

    function setConsent(categories) {
        const data = {
            version: CONSENT_VERSION,
            timestamp: new Date().toISOString(),
            categories: Object.assign({}, { necessary: true }, categories),
            method: 'cookie-banner'
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return data;
        } catch (e) {
            console.warn('Cookie consent: nu s-a putut salva în localStorage', e);
            return null;
        }
    }

    function hasConsent(category) {
        const c = getConsent();
        if (!c) return false;
        if (category === 'necessary') return true; // always allowed
        return c.categories[category] === true;
    }

    // ============================================
    // DOM
    // ============================================

    function buildBanner() {
        if (document.getElementById('cookie-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'cookie-banner';
        banner.className = 'cookie-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-modal', 'false');
        banner.setAttribute('aria-labelledby', 'cookie-banner-title');
        banner.setAttribute('aria-describedby', 'cookie-banner-desc');

        banner.innerHTML = `
            <div class="cookie-banner-header">
                <svg class="cookie-banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 2a10 10 0 1 0 10 10c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
                    <circle cx="8.5" cy="8.5" r=".5" fill="currentColor"/>
                    <circle cx="15" cy="13" r=".5" fill="currentColor"/>
                    <circle cx="10" cy="14" r=".5" fill="currentColor"/>
                </svg>
                <h2 id="cookie-banner-title" class="cookie-banner-title">Confidențialitate & Cookie-uri</h2>
            </div>
            <p id="cookie-banner-desc" class="cookie-banner-text">
                Folosim cookie-uri pentru a-ți oferi o experiență sigură, personalizată și pentru a analiza traficul.
                Poți accepta toate, le poți refuza sau le poți gestiona individual.
                Citește <a href="${PRIVACY_POLICY_URL}">Politica de Confidențialitate</a>.
            </p>
            <div class="cookie-banner-actions">
                <button type="button" class="cookie-btn cookie-btn-accept" data-cookie-action="accept-all">Acceptă toate</button>
                <button type="button" class="cookie-btn cookie-btn-reject" data-cookie-action="reject-all">Refuză toate</button>
                <button type="button" class="cookie-btn cookie-btn-settings" data-cookie-action="settings">Personalizează</button>
            </div>
        `;
        document.body.appendChild(banner);
    }

    function buildModal() {
        if (document.getElementById('cookie-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'cookie-modal';
        modal.className = 'cookie-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'cookie-modal-title');

        const existing = getConsent();
        const defaults = existing ? existing.categories : { necessary: true, functional: false, analytics: false, marketing: false };

        let catsHtml = '';
        for (const key of Object.keys(CATEGORIES)) {
            const cat = CATEGORIES[key];
            const checked = defaults[key] === true;
            const disabled = cat.required ? 'disabled' : '';
            catsHtml += `
                <li class="cookie-cat">
                    <div class="cookie-cat-row">
                        <div class="cookie-cat-info">
                            <h3 class="cookie-cat-name">
                                ${cat.name}
                                ${cat.required ? '<span class="cookie-cat-required">Întotdeauna activ</span>' : ''}
                            </h3>
                        </div>
                        <label class="cookie-toggle">
                            <input type="checkbox" name="cookie-cat-${key}" data-cookie-category="${key}" ${checked ? 'checked' : ''} ${disabled}>
                            <span class="cookie-toggle-slider"></span>
                        </label>
                    </div>
                    <p class="cookie-cat-desc">${cat.description}</p>
                    <p class="cookie-cat-cookies">Cookie-uri: ${cat.cookies.join(', ')}</p>
                </li>
            `;
        }

        modal.innerHTML = `
            <div class="cookie-modal-backdrop" data-cookie-action="modal-close"></div>
            <div class="cookie-modal-content">
                <div class="cookie-modal-header">
                    <h2 id="cookie-modal-title" class="cookie-modal-title">Setări Cookie-uri</h2>
                    <button type="button" class="cookie-modal-close" data-cookie-action="modal-close" aria-label="Închide">×</button>
                </div>
                <p class="cookie-modal-subtitle">
                    Alege ce categorii de cookie-uri permiți. Cookie-urile necesare sunt întotdeauna active pentru funcționarea site-ului.
                    Poți modifica oricând alegerea prin butonul „Cookie-uri" din colțul stânga-jos.
                    Detalii în <a href="${PRIVACY_POLICY_URL}">Politica de Confidențialitate</a>.
                </p>
                <ul class="cookie-cat-list">${catsHtml}</ul>
                <div class="cookie-modal-footer">
                    <p class="cookie-modal-footer-text">
                        Consimțământul tău e înregistrat local. Poți reveni oricând la această setare.
                    </p>
                    <div class="cookie-modal-footer-actions">
                        <button type="button" class="cookie-btn cookie-btn-reject" data-cookie-action="reject-all">Respinge opționale</button>
                        <button type="button" class="cookie-btn cookie-btn-settings" data-cookie-action="save-selection">Salvează selecția</button>
                        <button type="button" class="cookie-btn cookie-btn-accept" data-cookie-action="accept-all">Acceptă toate</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    function buildRevokeButton() {
        if (document.getElementById('cookie-revoke')) return;
        const btn = document.createElement('button');
        btn.id = 'cookie-revoke';
        btn.type = 'button';
        btn.className = 'cookie-revoke-btn';
        btn.setAttribute('aria-label', 'Gestionează setările cookie-uri');
        btn.title = 'Setări Cookie-uri';
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 2a10 10 0 1 0 10 10c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
                <circle cx="8.5" cy="8.5" r=".5" fill="currentColor"/>
                <circle cx="15" cy="13" r=".5" fill="currentColor"/>
                <circle cx="10" cy="14" r=".5" fill="currentColor"/>
            </svg>
        `;
        btn.addEventListener('click', () => openModal());
        document.body.appendChild(btn);
    }

    // ============================================
    // ACTIONS
    // ============================================

    function openModal() {
        buildModal();
        const m = document.getElementById('cookie-modal');
        document.body.style.overflow = 'hidden';
        document.body.classList.add('cookie-modal-open');
        requestAnimationFrame(() => m.classList.add('visible'));
        // focus trap minimal: focus first focusable
        const first = m.querySelector('button, input');
        if (first) first.focus();
    }

    function closeModal() {
        const m = document.getElementById('cookie-modal');
        if (m) m.classList.remove('visible');
        document.body.style.overflow = '';
        document.body.classList.remove('cookie-modal-open');
    }

    function showBanner() {
        buildBanner();
        document.body.classList.add('cookie-modal-open');
        requestAnimationFrame(() => {
            document.getElementById('cookie-banner').classList.add('visible');
        });
    }

    function hideBanner() {
        const b = document.getElementById('cookie-banner');
        if (b) b.classList.remove('visible');
        // păstrăm cookie-modal-open dacă modal-ul e deschis
        const m = document.getElementById('cookie-modal');
        if (!m || !m.classList.contains('visible')) {
            document.body.classList.remove('cookie-modal-open');
        }
    }

    function showRevokeButton() {
        buildRevokeButton();
        document.getElementById('cookie-revoke').classList.add('visible');
    }

    function hideRevokeButton() {
        const b = document.getElementById('cookie-revoke');
        if (b) b.classList.remove('visible');
    }

    function acceptAll() {
        const all = {};
        for (const k of Object.keys(CATEGORIES)) all[k] = true;
        saveConsent(all, 'accept-all');
    }

    function rejectAll() {
        const only = { necessary: true };
        for (const k of Object.keys(CATEGORIES)) {
            if (k !== 'necessary') only[k] = false;
        }
        saveConsent(only, 'reject-all');
    }

    function saveSelection() {
        const sel = { necessary: true };
        for (const k of Object.keys(CATEGORIES)) {
            const input = document.querySelector(`input[data-cookie-category="${k}"]`);
            sel[k] = input ? input.checked : false;
        }
        saveConsent(sel, 'custom');
    }

    function saveConsent(categories, method) {
        setConsent(categories);
        hideBanner();
        closeModal();
        showRevokeButton();
        applyConsent(categories);
        // Dispatch event for analytics/scripts that listen
        window.dispatchEvent(new CustomEvent('cookie-consent-updated', {
            detail: { categories: categories, method: method }
        }));
    }

    function applyConsent(categories) {
        // Functional scripts can listen to this event to enable/disable themselves.
        // Exemplu: Google Analytics ar trebui să pornească doar dacă analytics === true
        if (window.gtag) {
            if (categories.analytics) {
                window.gtag('consent', 'update', {
                    'analytics_storage': 'granted'
                });
            } else {
                window.gtag('consent', 'update', {
                    'analytics_storage': 'denied'
                });
            }
            if (categories.marketing) {
                window.gtag('consent', 'update', {
                    'ad_storage': 'granted',
                    'ad_user_data': 'granted',
                    'ad_personalization': 'granted'
                });
            } else {
                window.gtag('consent', 'update', {
                    'ad_storage': 'denied',
                    'ad_user_data': 'denied',
                    'ad_personalization': 'denied'
                });
            }
        }
    }

    // ============================================
    // EVENTS
    // ============================================

    document.addEventListener('click', function (e) {
        const target = e.target.closest('[data-cookie-action]');
        if (!target) return;
        const action = target.getAttribute('data-cookie-action');
        switch (action) {
            case 'accept-all': acceptAll(); break;
            case 'reject-all': rejectAll(); break;
            case 'settings': openModal(); break;
            case 'save-selection': saveSelection(); break;
            case 'modal-close': closeModal(); break;
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            const m = document.getElementById('cookie-modal');
            if (m && m.classList.contains('visible')) closeModal();
        }
    });

    // ============================================
    // INIT
    // ============================================

    function init() {
        const consent = getConsent();
        if (consent) {
            // Already decided — show revoke button + apply
            showRevokeButton();
            applyConsent(consent.categories);
        } else {
            // First visit — show banner after small delay
            setTimeout(showBanner, 600);
        }
    }

    // Wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    window.DigitalOnlineCookies = {
        get: getConsent,
        has: hasConsent,
        reset: function () {
            localStorage.removeItem(STORAGE_KEY);
            hideBanner();
            hideRevokeButton();
            setTimeout(showBanner, 200);
        },
        openSettings: openModal
    };
})();
