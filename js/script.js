/* ============================================
   DIGITAL ONLINE — Futuristic Engine
   Combined: original site-nou features + te/cyber effects
   ============================================ */

(function () {
    'use strict';

    /* ============================================
       LOADER
       ============================================ */
    const loader = document.getElementById('loader');
    document.body.classList.add('is-loading');
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

        const interactiveSelectors = 'a, button, .service-card, .dash-card, .process-row, .step-card, .testimonial, .cta-btn, .form-input, .feature, .pricing-card, .why-stat, .channel, .btn, .dropdown li a, .nav-link, .menu-toggle, .to-top, input, select, textarea, .logo';
        document.querySelectorAll(interactiveSelectors).forEach(el => {
            el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
            el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
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
       MOBILE MENU
       ============================================ */
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.getElementById('nav');
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('open');
            // On mobile, auto-open all dropdowns when menu opens
            if (nav.classList.contains('open') && window.innerWidth <= 900) {
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
                nav.classList.remove('open');
                // Also close all open dropdowns
                document.querySelectorAll('.has-dropdown.open').forEach(d => d.classList.remove('open'));
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
    const toTop = document.getElementById('toTop');
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    let scrollTicking = false;
    let lastScrolledState = null;
    let lastToTopState = null;
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

        if (toTop) {
            const visible = y > 400;
            if (visible !== lastToTopState) {
                lastToTopState = visible;
                toTop.classList.toggle('visible', visible);
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

    if (toTop) {
        toTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

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
                status.textContent = '⚠️ Te rugăm să completezi toate câmpurile obligatorii.';
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                status.className = 'form-status error';
                status.textContent = '⚠️ Te rugăm să introduci o adresă de email validă.';
                return;
            }
            if (!gdpr) {
                status.className = 'form-status error';
                status.textContent = '⚠️ Te rugăm să accepți politica de confidențialitate.';
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Se trimite...';
            submitBtn.disabled = true;

            setTimeout(() => {
                status.className = 'form-status success';
                status.innerHTML = '✅ Mulțumim, <strong>' + escape(nume) + '</strong>! Am primit solicitarea ta și te vom contacta în maxim 24 de ore la <strong>' + escape(email) + '</strong>.';
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
          .from('.hero-visual', { x: 60, opacity: 0, duration: 1.2, ease: 'power4.out' }, '-=1.0');

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
       CONSOLE SIGNATURE
       ============================================ */
    if (window.console && console.log) {
        console.log('%c⬡ DIGITAL ONLINE ⬡', 'font-size: 32px; font-weight: 900; color: #00f0ff; text-shadow: 0 0 20px #00f0ff;');
        console.log('%cFUTURE OF MARKETING — 2026', 'font-size: 14px; color: #ff073a; letter-spacing: 0.3em;');
        console.log('%ccontact@digital-online.ro', 'font-size: 12px; color: #00ff9d;');
    }

})();
