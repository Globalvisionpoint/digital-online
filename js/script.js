/* ============================================
   DIGITAL ONLINE — Futuristic Engine
   Combined: original site-nou features + te/cyber effects
   ============================================ */

(function () {
    'use strict';

    /* ============================================
       LOADER
       ============================================ */
    // NOTE: `is-loading` is already on <body> in the HTML so the loader screen
    // shows on first paint with zero flash of header/content. We only remove
    // the class here once loading is complete.
    const loader = document.getElementById('loader');
    // Safety fallback: if 4 seconds pass and the loader is still showing
    // (e.g. JS error or very slow assets), force-reveal the page.
    const safetyTimeout = setTimeout(() => {
        if (document.body.classList.contains('is-loading')) {
            document.body.classList.remove('is-loading');
            if (loader) loader.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
    }, 8000);
    if (loader) {
        const loaderBar = document.getElementById('loader-bar');
        const loaderPercent = document.getElementById('loader-percent');
        const loaderText = document.getElementById('loader-text');
        const loadMessages = [
            'INITIALIZING SYSTEM',
            'LOADING NEURAL NET',
            'CALIBRATING PARTICLES',
            'RENDERING SHADERS',
            'ESTABLISHING UPLINK',
            'SYSTEM READY'
        ];
        let loadProgress = 0;
        const loadInterval = setInterval(() => {
            loadProgress += Math.random() * 12 + 3;
            if (loadProgress >= 100) {
                loadProgress = 100;
                clearInterval(loadInterval);
                clearTimeout(safetyTimeout);
                setTimeout(() => {
                    loader.classList.add('hidden');
                    document.body.classList.remove('is-loading');
                    document.body.style.overflow = 'auto';
                    startHeroAnimation();
                    // Trigger canvas resize after loader hides (viewport may have changed)
                    window.dispatchEvent(new Event('resize'));
                }, 400);
            }
            if (loaderBar) loaderBar.style.width = loadProgress + '%';
            if (loaderPercent) loaderPercent.textContent = Math.floor(loadProgress) + '%';
            if (loaderText) {
                const msgIndex = Math.min(Math.floor(loadProgress / 20), loadMessages.length - 1);
                loaderText.textContent = loadMessages[msgIndex];
            }
        }, 180);
        document.body.style.overflow = 'hidden';
    }

    /* ============================================
       THREE.JS — 3D PARTICLE BACKGROUND
       ============================================ */
    const canvas = document.getElementById('bg-canvas');
    if (canvas && typeof THREE !== 'undefined') {
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 50;

        // Lights
        const ambient = new THREE.AmbientLight(0x00f0ff, 0.4);
        scene.add(ambient);
        const point1 = new THREE.PointLight(0x00f0ff, 2, 100);
        point1.position.set(20, 20, 20);
        scene.add(point1);
        const point2 = new THREE.PointLight(0xff073a, 2, 100);
        point2.position.set(-20, -20, 20);
        scene.add(point2);
        const point3 = new THREE.PointLight(0xff073a, 1.5, 100);
        point3.position.set(0, 20, -20);
        scene.add(point3);

        // Particles
        const particlesCount = 1500;
        const positions = new Float32Array(particlesCount * 3);
        const colors = new Float32Array(particlesCount * 3);
        const colorChoices = [
            new THREE.Color(0x00f0ff),
            new THREE.Color(0xff073a),
            new THREE.Color(0xff073a),
            new THREE.Color(0x00ff9d)
        ];
        for (let i = 0; i < particlesCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 200;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
            const c = colorChoices[Math.floor(Math.random() * colorChoices.length)];
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }
        const particlesGeo = new THREE.BufferGeometry();
        particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particlesGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const particlesMat = new THREE.PointsMaterial({
            size: 0.55,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending
        });
        const particles = new THREE.Points(particlesGeo, particlesMat);
        scene.add(particles);

        // Wireframe geometries (responsive — closer on mobile, wider on desktop)
        const isMobile = window.innerWidth < 768;
        const wireScale = isMobile ? 0.55 : 1;
        const wireOffsetX = isMobile ? 12 : 39;
        // Ico (red sphere): mobile = -14 X / 28 Y; desktop = -55 X / 18 Y
        const icoOffsetX = isMobile ? -14 : -55;
        const icoOffsetY = isMobile ? 28 : 18;

        const torus = new THREE.Mesh(
            new THREE.TorusGeometry(12 * wireScale, 3.5 * wireScale, 16, 60),
            new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: isMobile ? 0.5 : 0.35 })
        );
        torus.position.set(wireOffsetX, -2, -10);
        scene.add(torus);

        const ico = new THREE.Mesh(
            new THREE.IcosahedronGeometry(10 * wireScale, 1),
            new THREE.MeshBasicMaterial({ color: 0xff073a, wireframe: true, transparent: true, opacity: isMobile ? 0.55 : 0.4 })
        );
        ico.position.set(icoOffsetX, icoOffsetY, -12);
        scene.add(ico);

        const octa = new THREE.Mesh(
            new THREE.OctahedronGeometry(7 * wireScale, 0),
            new THREE.MeshBasicMaterial({ color: 0xff073a, wireframe: true, transparent: true, opacity: isMobile ? 0.5 : 0.35 })
        );
        octa.position.set(0, -18, -8);
        scene.add(octa);

        let mouseX = 0, mouseY = 0;
        let targetX = 0, targetY = 0;

        document.addEventListener('mousemove', (e) => {
            mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        function animateScene() {
            requestAnimationFrame(animateScene);
            targetX += (mouseX * 0.5 - targetX) * 0.05;
            targetY += (mouseY * 0.3 - targetY) * 0.05;

            particles.rotation.y += 0.0005;
            particles.rotation.x += 0.0002;

            torus.rotation.x += 0.003;
            torus.rotation.y += 0.005;
            ico.rotation.x += 0.004;
            ico.rotation.y -= 0.003;
            octa.rotation.x -= 0.005;
            octa.rotation.y += 0.004;

            camera.position.x += (targetX * 8 - camera.position.x) * 0.02;
            camera.position.y += (targetY * 5 - camera.position.y) * 0.02;
            camera.lookAt(scene.position);

            point1.position.x = Math.sin(Date.now() * 0.0005) * 25;
            point1.position.y = Math.cos(Date.now() * 0.0007) * 25;
            point2.position.x = Math.cos(Date.now() * 0.0006) * 25;
            point2.position.y = Math.sin(Date.now() * 0.0008) * 25;

            renderer.render(scene, camera);
        }
        animateScene();

        // Performance: pause three.js animation when tab is hidden
        // Browser already throttles rAF in background tabs, but we save the
        // extra render work and any layout/paint triggered by canvas updates.
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                renderer.setAnimationLoop(null);
            } else {
                renderer.setAnimationLoop(animateScene);
            }
        });

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight, false);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        });
        // Visual viewport (mobile address-bar show/hide)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                camera.aspect = window.visualViewport.width / window.visualViewport.height;
                camera.updateProjectionMatrix();
                renderer.setSize(window.visualViewport.width, window.visualViewport.height, false);
            });
        }
    }

    /* ============================================
       CUSTOM CURSOR
       ============================================ */
    const cursor = document.getElementById('cursor');
    const trail = document.getElementById('cursor-trail');
    if (cursor && trail) {
        let cx = 0, cy = 0, tx = 0, ty = 0;

        document.addEventListener('mousemove', (e) => {
            cx = e.clientX;
            cy = e.clientY;
            cursor.style.left = cx - 6 + 'px';
            cursor.style.top = cy - 6 + 'px';
        });

        function animateCursor() {
            requestAnimationFrame(animateCursor);
            tx += (cx - tx) * 0.15;
            ty += (cy - ty) * 0.15;
            trail.style.left = tx - 15 + 'px';
            trail.style.top = ty - 15 + 'px';
        }
        animateCursor();

        // Use event delegation so dynamically-injected elements (cookie banner,
        // cookie modal, etc.) also trigger the hover state on the custom cursor.
        // mouseover/mouseout bubble (unlike mouseenter/mouseleave), so we check
        // relatedTarget to detect true enter/leave transitions and avoid flicker
        // when the cursor crosses child elements inside an interactive control.
        const interactiveSelector = 'a, button, .service-card, .dash-card, .process-row, .step-card, .testimonial, .cta-btn, .form-input, .feature, .pricing-card, .why-stat, .channel, .btn, .dropdown li a, .nav-link, .menu-toggle, input, select, textarea, .logo, .cookie-banner__btn, .cookie-modal__btn';
        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest(interactiveSelector);
            if (target) cursor.classList.add('hover');
        });
        document.addEventListener('mouseout', (e) => {
            const target = e.target.closest(interactiveSelector);
            if (!target) return;
            // Only remove hover when the cursor truly leaves the element
            // (i.e. moving to a node that is not inside the same interactive target).
            const related = e.relatedTarget;
            if (related && target.contains(related)) return;
            cursor.classList.remove('hover');
        });
    }

    /* ============================================
       HERO COUNTER ANIMATION
       ============================================ */
    function animateCounters() {
        const counters = document.querySelectorAll('.count[data-target]');
        if (counters.length === 0) return;

        const duration = 1800;
        const startTime = performance.now();

        function step(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);

            counters.forEach(counter => {
                const target = parseInt(counter.getAttribute('data-target'), 10);
                const current = Math.floor(eased * target);
                counter.textContent = current;
            });

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                counters.forEach(counter => {
                    const target = parseInt(counter.getAttribute('data-target'), 10);
                    counter.textContent = target;
                });
            }
        }
        requestAnimationFrame(step);
    }

    const counters = document.querySelectorAll('.count[data-target]');
    if (counters.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounters();
                    observer.disconnect();
                }
            });
        }, { threshold: 0.3 });
        counters.forEach(c => observer.observe(c.parentElement.parentElement));
    }

    /* ============================================
       ARIA-CURRENT="page" on active nav link
       ============================================ */
    (function setAriaCurrentPage() {
        const currentFile = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
        const currentHash = window.location.hash;
        document.querySelectorAll('.nav-link').forEach(link => {
            link.removeAttribute('aria-current');
            const href = (link.getAttribute('href') || '').toLowerCase();
            if (!href) return;
            // Match same-page anchor if we have one, else match file
            if (href.startsWith('#') && currentHash && href === currentHash) {
                link.setAttribute('aria-current', 'page');
            } else if (!href.startsWith('#') && href.includes(currentFile) && currentFile !== '') {
                link.setAttribute('aria-current', 'page');
            } else if (currentFile === 'index.html' && href === 'index.html') {
                link.setAttribute('aria-current', 'page');
            }
        });
    })();

    /* ============================================
       MOBILE MENU
       ============================================ */
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.getElementById('nav');
    if (menuToggle && nav) {
        const closeMenu = () => {
            nav.classList.remove('open');
            menuToggle.classList.remove('is-open');
            menuToggle.setAttribute('aria-expanded', 'false');
            document.querySelectorAll('.has-dropdown.open').forEach(d => d.classList.remove('open'));
        };
        menuToggle.addEventListener('click', () => {
            const isOpen = nav.classList.toggle('open');
            menuToggle.classList.toggle('is-open', isOpen);
            menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            // Blur after tap so :focus doesn't keep the bold border
            menuToggle.blur();
            // On mobile, auto-open all dropdowns when menu opens
            if (isOpen && window.innerWidth <= 900) {
                document.querySelectorAll('.has-dropdown').forEach(d => d.classList.add('open'));
            } else {
                document.querySelectorAll('.has-dropdown.open').forEach(d => d.classList.remove('open'));
            }
        });
        // Close menu when clicking on a regular link (not dropdown toggles)
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                // If this link is inside a has-dropdown and we're on mobile, don't close menu
                if (link.parentElement.classList.contains('has-dropdown') && window.innerWidth <= 900) {
                    return; // Let the dropdown handler handle it
                }
                closeMenu();
            });
        });
    }

    document.querySelectorAll('.has-dropdown > .nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            if (window.innerWidth <= 900) {
                e.preventDefault();
                e.stopPropagation();
                // Close other open dropdowns
                document.querySelectorAll('.has-dropdown.open').forEach(d => {
                    if (d !== link.parentElement) d.classList.remove('open');
                });
                link.parentElement.classList.toggle('open');
            }
        });
    });

    /* ============================================================
       UNIFIED SCROLL HANDLER (single rAF loop — no jitter)
       ============================================================ */
    const header = document.getElementById('header');
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    let scrollTicking = false;
    let lastScrolledState = null;
    let lastCurrentSection = null;

    const handleScroll = () => {
        const y = window.scrollY;

        if (header) {
            const isScrolled = y > 30;
            if (isScrolled !== lastScrolledState) {
                lastScrolledState = isScrolled;
                header.classList.toggle('scrolled', isScrolled);
            }
        }

        if (sections.length && navLinks.length) {
            let current = '';
            for (const section of sections) {
                if (y >= section.offsetTop - 120) current = section.id;
            }
            if (current !== lastCurrentSection) {
                lastCurrentSection = current;
                navLinks.forEach(link => {
                    const href = link.getAttribute('href');
                    if (href === '#' + current) link.classList.add('active');
                    else if (href && href.startsWith('#')) link.classList.remove('active');
                });
            }
        }

        scrollTicking = false;
    };

    window.addEventListener('scroll', () => {
        if (!scrollTicking) {
            scrollTicking = true;
            window.requestAnimationFrame(handleScroll);
        }
    }, { passive: true });
    handleScroll();

    /* ============================================================
       HEADER PLACEHOLDER (sync height with fixed header)
       ============================================================ */
    const headerPlaceholder = document.querySelector('.header-placeholder');
    if (header && headerPlaceholder) {
        const syncHeaderHeight = () => {
            headerPlaceholder.style.height = header.offsetHeight + 'px';
        };
        syncHeaderHeight();
        window.addEventListener('resize', syncHeaderHeight);
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(syncHeaderHeight).observe(header);
        }
    }


    /* ============================================
       YEAR
       ============================================ */
    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();

    /* ============================================
       COMPANY DATA TOGGLE
       ============================================ */
    const toggleBtn = document.getElementById('toggleCompany');
    const companyCard = document.getElementById('companyCard');
    if (toggleBtn && companyCard) {
        toggleBtn.addEventListener('click', () => {
            const isOpen = !companyCard.hasAttribute('hidden');
            if (isOpen) {
                companyCard.setAttribute('hidden', '');
                toggleBtn.textContent = 'Afișează datele companiei ▾';
            } else {
                companyCard.removeAttribute('hidden');
                toggleBtn.textContent = 'Ascunde datele companiei ▴';
            }
        });
    }

    /* ============================================
       CONTACT FORM
       ============================================ */
    const form = document.getElementById('contactForm');
    const status = document.getElementById('formStatus');
    if (form && status) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const nume = form.nume.value.trim();
            const email = form.email.value.trim();
            const telefon = form.telefon.value.trim();
            const mesaj = form.mesaj.value.trim();
            const gdpr = form.gdpr.checked;

            if (!nume || !email || !telefon || !mesaj) {
                status.className = 'form-status error';
                status.textContent = 'Te rugăm să completezi toate câmpurile obligatorii.';
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                status.className = 'form-status error';
                status.textContent = 'Te rugăm să introduci o adresă de email validă.';
                return;
            }
            if (!gdpr) {
                status.className = 'form-status error';
                status.textContent = 'Te rugăm să accepți politica de confidențialitate.';
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Se trimite...';
            submitBtn.disabled = true;

            setTimeout(() => {
                status.className = 'form-status success';
                status.innerHTML = 'Mulțumim, <strong>' + escape(nume) + '</strong>! Am primit solicitarea ta și te vom contacta în maxim 24 de ore la <strong>' + escape(email) + '</strong>.';
                form.reset();
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                status.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 900);
        });
    }

    function escape(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /* ============================================
       REVEAL ON SCROLL
       ============================================ */
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.service-card, .dash-card, .process-step, .step-card, .why-stat, .why-block, .pricing-card, .feature, .cta-box, .reveal').forEach(el => {
        el.classList.add('reveal');
        revealObserver.observe(el);
    });

    /* ============================================
       HERO ENTRANCE (GSAP)
       ============================================ */
    function startHeroAnimation() {
        if (typeof gsap === 'undefined') return;
        try {
            gsap.registerPlugin(ScrollTrigger);
        } catch (e) {}

        const tl = gsap.timeline();
        tl.from('.hero-badge', { y: 30, opacity: 0, duration: 0.8, ease: 'power3.out' })
          .from('.hero-title', { y: 60, opacity: 0, duration: 1, ease: 'power4.out' }, '-=0.5')
          .from('.hero-sub', { y: 30, opacity: 0, duration: 0.8, ease: 'power3.out' }, '-=0.6')
          .from('.hero-visual', { y: 60, opacity: 0, duration: 1.2, ease: 'power4.out' }, '-=1.0');
        // Note: .hero-orb is animated via CSS @keyframes orbDiagonal (transform: translate)
        // GSAP would override that transform, so we skip animating it here.

        if (typeof ScrollTrigger !== 'undefined') {
            // Parallax disabled — terminal stays fixed in place when scrolling
            // gsap.to('.hero-visual', {
            //     scrollTrigger: {
            //         trigger: '.hero',
            //         start: 'top top',
            //         end: 'bottom top',
            //         scrub: 1,
            //         invalidateOnRefresh: true
            //     },
            //     y: 80,
            //     ease: 'none'
            // });
        }
    }

    /* ============================================
       SMOOTH SCROLL FOR ANCHORS
       ============================================ */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#' || href.length < 2) return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    /* ============================================
       TILT EFFECT ON SERVICE CARDS
       ============================================ */
    document.querySelectorAll('.service-card, .dash-card, .pricing-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            card.style.transform = `translateY(-6px) perspective(1000px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });

    /* ============================================
       EASTER EGG — KONAMI
       ============================================ */
    const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIndex = 0;
    document.addEventListener('keydown', (e) => {
        if (e.key === konami[konamiIndex]) {
            konamiIndex++;
            if (konamiIndex === konami.length) {
                document.body.style.animation = 'rainbow 2s linear infinite';
                setTimeout(() => document.body.style.animation = '', 5000);
                konamiIndex = 0;
            }
        } else {
            konamiIndex = 0;
        }
    });
    if (!document.getElementById('konami-style')) {
        const s = document.createElement('style');
        s.id = 'konami-style';
        s.textContent = '@keyframes rainbow{0%{filter:hue-rotate(0)}100%{filter:hue-rotate(360deg)}}';
        document.head.appendChild(s);
    }

    /* ============================================
       CONSOLE SIGNATURE (dev only - stripped in prod)
       ============================================ */
    if (window.console && console.log && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.search.includes('debug=1'))) {
        console.log('%c⬡ DIGITAL ONLINE ⬡', 'font-size: 32px; font-weight: 900; color: #00f0ff; text-shadow: 0 0 20px #00f0ff;');
        console.log('%cFUTURE OF MARKETING — 2026', 'font-size: 14px; color: #ff073a; letter-spacing: 0.3em;');
        console.log('%ccontact@digital-online.ro', 'font-size: 12px; color: #00ff9d;');
    }


    /* ============================================
       COOKIE CONSENT (GDPR / EU ePrivacy)
       - Necessary: always on
       - Analytics: GA4 (optional)
       - Marketing: Meta Pixel, Google Ads, TikTok (optional)
       - Stored in localStorage, expires after 365 days
       - Respects Global Privacy Control (GPC) and Do Not Track (DNT)
       - Blocks tracking scripts until consent is granted
       ============================================ */
    const COOKIE_CONSENT_KEY = 'do_cookie_consent_v1';
    const COOKIE_CONSENT_MAX_AGE_DAYS = 365;

    const CookieConsent = {
        get() {
            try {
                const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
                if (!raw) return null;
                const data = JSON.parse(raw);
                if (!data || typeof data !== 'object') return null;
                if (data.expires && Date.now() > data.expires) {
                    localStorage.removeItem(COOKIE_CONSENT_KEY);
                    return null;
                }
                return data;
            } catch (e) { return null; }
        },
        set(categories) {
            const data = {
                necessary: true,
                analytics: !!categories.analytics,
                marketing: !!categories.marketing,
                timestamp: Date.now(),
                expires: Date.now() + (COOKIE_CONSENT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000),
                version: 1
            };
            try { localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(data)); } catch (e) {}
            return data;
        },
        clear() { try { localStorage.removeItem(COOKIE_CONSENT_KEY); } catch (e) {} },
        isForcedReject() {
            if (typeof navigator !== 'undefined') {
                if (navigator.globalPrivacyControl === true) return true;
                if (navigator.doNotTrack === '1') return true;
            }
            return false;
        }
    };

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }

    function loadAnalytics() {
        if (window.__ga4_loaded) return;
        window.__ga4_loaded = true;
        const id = window.GA4_MEASUREMENT_ID || '';
        if (!id) return;
        const s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
        document.head.appendChild(s);
        gtag('js', new Date());
        gtag('config', id, { anonymize_ip: true });
    }

    function loadMarketing() {
        if (window.__fb_pixel_loaded) return;
        window.__fb_pixel_loaded = true;
        const id = window.FB_PIXEL_ID || '';
        if (!id) return;
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
        window.fbq('init', id);
        window.fbq('track', 'PageView');
    }

    function applyConsent(consent) {
        if (!consent) return;
        if (consent.analytics) loadAnalytics();
        if (consent.marketing) loadMarketing();
        window.dispatchEvent(new CustomEvent('cookieconsent:applied', { detail: consent }));
    }

    (function bootstrap() {
        if (CookieConsent.isForcedReject()) return;
        const existing = CookieConsent.get();
        if (existing) { applyConsent(existing); return; }
        setTimeout(showBanner, 600);
    })();

    let cookieBanner, cookieModal;

    function ensureBannerElements() {
        if (!document.getElementById('cookieBanner')) {
            const div = document.createElement('div');
            div.id = 'cookieBanner';
            div.className = 'cookie-banner';
            div.setAttribute('role', 'dialog');
            div.setAttribute('aria-live', 'polite');
            div.setAttribute('aria-label', 'Consimțământ cookie-uri');
            div.innerHTML =
                '<h2 class="cookie-banner__title">Confidențialitate & Cookie-uri</h2>' +
                '<p class="cookie-banner__text">Folosim cookie-uri pentru a îmbunătăți experiența ta, a analiza traficul și a personaliza conținutul. Poți accepta toate, le poți refuza sau poți alege ce categorii permiți. Citește <a href="politica-confidentialitate.html" target="_blank" rel="noopener">Politica de Confidențialitate</a> pentru detalii.</p>' +
                '<div class="cookie-banner__actions">' +
                    '<button type="button" class="cookie-banner__btn cookie-banner__btn--accept" data-cookie-action="accept-all">Acceptă toate</button>' +
                    '<button type="button" class="cookie-banner__btn cookie-banner__btn--reject" data-cookie-action="reject-all">Refuză</button>' +
                    '<button type="button" class="cookie-banner__btn cookie-banner__btn--settings" data-cookie-action="settings">Personalizează</button>' +
                '</div>';
            document.body.appendChild(div);
            cookieBanner = div;
        } else {
            cookieBanner = document.getElementById('cookieBanner');
        }

        if (!document.getElementById('cookieModal')) {
            const m = document.createElement('div');
            m.id = 'cookieModal';
            m.className = 'cookie-modal';
            m.setAttribute('role', 'dialog');
            m.setAttribute('aria-modal', 'true');
            m.setAttribute('aria-label', 'Setari cookie-uri');
            m.innerHTML =
                '<div class="cookie-modal__panel">' +
                    '<h2 class="cookie-modal__title">Setari Cookie-uri</h2>' +
                    '<p class="cookie-modal__intro">Alege ce categorii de cookie-uri permiți. Cookie-urile necesare sunt întotdeauna active pentru ca site-ul să funcționeze corect.</p>' +
                    '<div class="cookie-modal__list">' +
                        '<div class="cookie-category">' +
                            '<div class="cookie-category__head">' +
                                '<h3 class="cookie-category__name">Necesare</h3>' +
                                '<label class="cookie-toggle"><input type="checkbox" checked disabled aria-label="Cookie-uri necesare (obligatoriu)"><span class="cookie-toggle__slider"></span></label>' +
                            '</div>' +
                            '<p class="cookie-category__desc">Esentiale pentru functionarea site-ului (securitate, sesiune, consimtamant).</p>' +
                        '</div>' +
                        '<div class="cookie-category">' +
                            '<div class="cookie-category__head">' +
                                '<h3 class="cookie-category__name">Analytics</h3>' +
                                '<label class="cookie-toggle"><input type="checkbox" id="cookieAnalytics" aria-label="Cookie-uri analytics"><span class="cookie-toggle__slider"></span></label>' +
                            '</div>' +
                            '<p class="cookie-category__desc">Ne ajuta sa intelegem cum folosesti site-ul (Google Analytics 4, date anonimizate).</p>' +
                        '</div>' +
                        '<div class="cookie-category">' +
                            '<div class="cookie-category__head">' +
                                '<h3 class="cookie-category__name">Marketing</h3>' +
                                '<label class="cookie-toggle"><input type="checkbox" id="cookieMarketing" aria-label="Cookie-uri marketing"><span class="cookie-toggle__slider"></span></label>' +
                            '</div>' +
                            '<p class="cookie-category__desc">Folosit pentru reclame personalizate (Meta Pixel, Google Ads, TikTok Pixel).</p>' +
                        '</div>' +
                    '</div>' +
                    '<div class="cookie-modal__actions">' +
                        '<button type="button" class="cookie-modal__btn cookie-modal__btn--reject-all" data-cookie-action="reject-all">Refuza toate</button>' +
                        '<button type="button" class="cookie-modal__btn cookie-modal__btn--accept-all" data-cookie-action="accept-all">Accepta toate</button>' +
                        '<button type="button" class="cookie-modal__btn cookie-modal__btn--save" data-cookie-action="save-selection">Salveaza selectia</button>' +
                    '</div>' +
                '</div>';
            document.body.appendChild(m);
            cookieModal = m;
        } else {
            cookieModal = document.getElementById('cookieModal');
        }
    }

    function showBanner() {
        ensureBannerElements();
        requestAnimationFrame(() => cookieBanner.classList.add('is-visible'));
    }
    function hideBanner() { if (cookieBanner) cookieBanner.classList.remove('is-visible'); }

    function openModal() {
        ensureBannerElements();
        const existing = CookieConsent.get();
        if (existing) {
            const a = document.getElementById('cookieAnalytics');
            const m = document.getElementById('cookieMarketing');
            if (a) a.checked = !!existing.analytics;
            if (m) m.checked = !!existing.marketing;
        }
        cookieModal.classList.add('is-visible');
        document.body.style.overflow = 'hidden';
    }
    function closeModal() {
        if (cookieModal) cookieModal.classList.remove('is-visible');
        document.body.style.overflow = '';
    }

    function acceptAll() {
        const data = CookieConsent.set({ analytics: true, marketing: true });
        applyConsent(data); hideBanner(); closeModal();
        window.dispatchEvent(new CustomEvent('cookieconsent:updated', { detail: data }));
    }
    function rejectAll() {
        const data = CookieConsent.set({ analytics: false, marketing: false });
        applyConsent(data); hideBanner(); closeModal();
        window.dispatchEvent(new CustomEvent('cookieconsent:updated', { detail: data }));
    }
    function saveSelection() {
        const a = document.getElementById('cookieAnalytics');
        const m = document.getElementById('cookieMarketing');
        const data = CookieConsent.set({
            analytics: a && a.checked,
            marketing: m && m.checked
        });
        applyConsent(data); hideBanner(); closeModal();
        window.dispatchEvent(new CustomEvent('cookieconsent:updated', { detail: data }));
    }

    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-cookie-action]');
        if (!target) return;
        const action = target.getAttribute('data-cookie-action');
        if (action === 'accept-all') acceptAll();
        else if (action === 'reject-all') rejectAll();
        else if (action === 'settings') openModal();
        else if (action === 'save-selection') saveSelection();
    });
    document.addEventListener('click', (e) => { if (e.target === cookieModal) closeModal(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && cookieModal && cookieModal.classList.contains('is-visible')) closeModal();
    });

    window.CookieConsent = CookieConsent;
    window.openCookieSettings = openModal;


    /* ============================================
       TAB VISIBILITY — keep animations in sync
       ============================================
       Browsers throttle or freeze requestAnimationFrame on hidden tabs.
       When the user returns, animations using elapsed time (CSS keyframes
       based on Date.now(), GSAP timelines with long durations, three.js)
       can "catch up" by jumping to where they would have been had they
       been running the whole time — causing the fast-forward effect.

       Fix: when the tab is hidden, PAUSE all CSS animations in place via
       a class on <html>. When visible again, remove the class so they
       resume exactly where they left off.
    */
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            document.documentElement.classList.add('animations-paused');
            return;
        }
        document.documentElement.classList.remove('animations-paused');

        // GSAP: disable lag smoothing so it doesn't try to "make up" the
        // missed time when the ticker resumes after a pause.
        try {
            if (typeof gsap !== 'undefined') {
                gsap.ticker.lagSmoothing(false);
            }
        } catch (e) {}
    });

    /* On initial load, disable GSAP's lag smoothing so a slow connection
       or hidden-tab scenario doesn't cause animations to fast-forward. */
    try {
        if (typeof gsap !== 'undefined') {
            gsap.ticker.lagSmoothing(false);
        }
    } catch (e) {}


})();
