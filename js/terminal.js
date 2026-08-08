/* ============================================================
   Digital Online — Hero PowerShell Terminal animation
   Adaptată la serviciile site-ului (Shopify, Import China,
   Integrări AWB, AI, Stripe/Netopia, promovare multi-channel)
   ============================================================ */

(function () {
    'use strict';

    const terminal = document.getElementById('terminal');
    const output   = document.getElementById('output');
    const typing   = document.getElementById('typing');
    const inputLn  = document.getElementById('input-line');
    if (!terminal || !output || !typing || !inputLn) return;

    // Secvență de activitate reală a agenților Digital Online
    const sequence = [
        { type: 'cmd', text: 'cd C:\\Projects\\digital-online.ro\\client-nexa-shop' },
        { type: 'log', text: 'Changed directory to C:\\Projects\\digital-online.ro\\client-nexa-shop', color: 'gray' },

        { type: 'cmd', text: 'git pull origin main' },
        { type: 'log', text: 'remote: Enumerating objects: 248, done.', color: 'gray' },
        { type: 'log', text: 'remote: Counting objects: 100% (216/216), done.', color: 'gray' },
        { type: 'log', text: 'Receiving objects: 100% (248/248), 4.18 MiB | 22.7 MB/s, done.', color: 'gray' },
        { type: 'log', text: 'Fast-forward\n shopify/sections/hero.liquid   | 64 ++++++++++++++------\n shopify/snippets/cart.liquid    | 18 ++--\n assets/theme.css                | 142 +++++++++++++++++++++++------\n 3 files changed, 174 insertions(+), 50 deletions(-)', color: 'success' },

        { type: 'cmd', text: 'shopify theme push --theme=production' },
        { type: 'log', text: '→ Connecting to nexa-shop.myshopify.com ...', color: 'info' },
        { type: 'progress', steps: 10, prefix: '  Upload assets ', suffix: '  (Shopify CDN sync)' },
        { type: 'log', text: '✔ Theme ID: 184229473921 published successfully', color: 'success' },
        { type: 'log', text: '  ↳ 24 products synced  ·  38 images optimized as WebP', color: 'gray' },

        { type: 'cmd', text: 'import-china sync --supplier=yiwu-mart --sku-prefix=NEXA' },
        { type: 'log', text: '→ Authenticating Yiwu Mart supplier API ... OK', color: 'info' },
        { type: 'progress', steps: 8, prefix: '  Fetching catalog ', suffix: '  (2,481 SKUs scanned)' },
        { type: 'log', text: '✔ 47 new products added to staging', color: 'success' },
        { type: 'log', text: '✔ 12 SKUs price updated (CNY → EUR, +VAT)', color: 'success' },
        { type: 'log', text: '  Images downloaded: 47/47  ·  Total time: 1m 18s', color: 'gray' },

        { type: 'cmd', text: 'integrations awb --courier=dhl,fedex,ups' },
        { type: 'log', text: '→ Connecting to XConnector API v3 ...', color: 'info' },
        { type: 'log', text:  '  [DHL]      18 orders pulled   ·  AWB labels generated: 18', color: 'success' },
        { type: 'log', text:  '  [FedEx]    12 orders pulled   ·  AWB labels generated: 12', color: 'success' },
        { type: 'log', text:  '  [UPS]       7 orders pulled   ·  AWB labels generated:  7', color: 'success' },
        { type: 'log', text: '✔ 37 labels printed  ·  PDF saved: C:\\Print\\2026-07-14.pdf', color: 'success' },

        { type: 'cmd', text: 'promotion deploy --channels=google,meta,tiktok' },
        { type: 'log', text: '→ Google Ads API      ·  status: OK', color: 'info' },
        { type: 'log', text: '→ Meta Marketing      ·  status: OK', color: 'info' },
        { type: 'log', text: '→ TikTok Business     ·  status: OK', color: 'info' },
        { type: 'progress', steps: 8, prefix: '  Updating campaigns ', suffix: '  (audiences, pixel, conversions API)' },
        { type: 'log', text: '✔ 6 active campaigns  ·  Daily budget: $250', color: 'success' },
        { type: 'log', text: '  ROAS last 7 days: 4.8x   ·   CPA: $19.20', color: 'magenta' },

        { type: 'cmd', text: 'ai-chatbot train --kb=nexa-shop --model=llm-prod' },
        { type: 'log', text: '→ Indexing knowledge base (products, policies, FAQ) ...', color: 'info' },
        { type: 'progress', steps: 6, prefix:  '  Embedding & index ', suffix: '  (pgvector + hybrid search)' },
        { type: 'log', text: '✔ 1,284 chunks indexed   ·   Avg response: 0.42s', color: 'success' },
        { type: 'log', text: '  Widget live on: nexa-shop.com, Facebook, WhatsApp Business', color: 'gray' },

        { type: 'cmd', text: 'payments health --providers=stripe,paypal' },
        { type: 'log', text: '[Stripe]   API v2024-06  ·  3DS2  ·  Apple Pay  ·  Google Pay   ·  ✔ 142ms', color: 'success' },
        { type: 'log', text: '[PayPal]   v2            ·  Card  ·  Installments (BNPL)         ·  ✔ 188ms', color: 'success' },
        { type: 'log', text: '  Processed today: $2,489.50  ·  Approval rate: 96.4%', color: 'magenta' },

        { type: 'cmd', text: 'analytics snapshot --period=today' },
        { type: 'log', text: '  Sales:        $2,489.50  (+54.8% vs. yesterday)', color: 'success' },
        { type: 'log', text: '  Orders:           24     (+9)', color: 'success' },
        { type: 'log', text: '  Avg basket:    $103.73', color: 'info' },
        { type: 'log', text: '  Organic:      6,214     ·   Paid: 4,182', color: 'gray' },
        { type: 'log', text: '  Avg time on page: 2m 47s   ·   Bounce: 31.2%', color: 'gray' },

        { type: 'cmd', text: 'deploy production --monitor' },
        { type: 'progress', steps: 6, prefix: '  Build & roll-out ', suffix: '  (zero-downtime deploy)' },
        { type: 'log', text: '✔ Container live on cluster-eu-1   ·   Version 2026.07.14-r3', color: 'success' },
        { type: 'log', text: '✔ Health-check 200 OK   ·   SSL A+   ·   CDN cache: warm', color: 'success' },

        { type: 'log', text: '', color: 'gray' },
        { type: 'log', text: '◆ All systems operational. 24/7 support active.', color: 'success' },
        { type: 'log', text: '', color: 'gray' }
    ];

    let stepIndex = 0;

    function appendLog(text, colorClass) {
        const line = document.createElement('div');
        line.className = 'line' + (colorClass ? ' ' + colorClass : '');
        line.innerText = text;
        output.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
        // Curățăm output-ul dacă crește prea mult
        if (output.childNodes.length > 220) {
            output.removeChild(output.firstChild);
        }
    }

    function runNext() {
        if (stepIndex >= sequence.length) {
            // Rescrie secvența de la capăt
            stepIndex = 0;
            output.innerHTML = '';
        }

        const current = sequence[stepIndex];

        if (current.type === 'cmd') {
            inputLn.classList.remove('hidden');
            const txt = current.text;
            let charIdx = 0;
            typing.innerText = '';

            function type() {
                // Viteză de typing ușor variabilă, ca un operator real
                const chunk = (charIdx < txt.length && txt[charIdx] === ' ') ? 1 : 2;
                if (charIdx < txt.length) {
                    typing.innerText += txt.substr(charIdx, chunk);
                    charIdx += chunk;
                    terminal.scrollTop = terminal.scrollHeight;
                    setTimeout(type, 9);
                } else {
                    setTimeout(() => {
                        appendLog('PS C:\\Projects\\digital-online.ro> ' + txt, 'cmd');
                        typing.innerText = '';
                        inputLn.classList.add('hidden');
                        stepIndex++;
                        setTimeout(runNext, 30);
                    }, 70);
                }
            }
            type();
        }
        else if (current.type === 'log') {
            appendLog(current.text, current.color);
            stepIndex++;
            // Pauză proporțională cu lungimea textului
            const delay = Math.max(14, Math.min(80, current.text.length * 1.4));
            setTimeout(runNext, delay);
        }
        else if (current.type === 'progress') {
            inputLn.classList.remove('hidden');
            let currentStep = 0;
            const maxSteps = current.steps;
            typing.innerText = '';

            function updateProgress() {
                if (currentStep <= maxSteps) {
                    const percent = Math.round((currentStep / maxSteps) * 100);
                    const filledLen = Math.floor(currentStep / (maxSteps / 10));
                    const filled = '█'.repeat(filledLen);
                    const empty  = '░'.repeat(10 - filledLen);
                    typing.innerText = current.prefix + '[' + filled + empty + '] ' + percent + '%' + current.suffix;
                    currentStep++;
                    setTimeout(updateProgress, 38);
                } else {
                    // Adaugă linia finală de succes pentru bara de progres
                    const ok = current.prefix.trim() + ' completed';
                    appendLog(ok, 'success');
                    typing.innerText = '';
                    inputLn.classList.add('hidden');
                    stepIndex++;
                    setTimeout(runNext, 12);
                }
            }
            updateProgress();
        }
    }

    // Pornește cu o mică întârziere, după ce layout-ul s-a stabilizat
    setTimeout(runNext, 450);
})();
