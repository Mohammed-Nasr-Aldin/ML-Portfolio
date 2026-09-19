(() => {
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const root = document.documentElement;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Phones like Android Chrome can't show a PDF inside a page: they download it or open another page instead.
    const pdfInline = navigator.pdfViewerEnabled !== false;

    // Canvas state (declared first so the theme code can use it)
    let colors = { accent: '#6C9BFF', muted: '#93A0B8', line: '#24314D' };
    let W = 0, H = 0, scanX = 0, targetX = 0, pointerActive = false;

    /* ---------- Theme ---------- */
    const themeBtn = $('#theme-toggle');
    const themeMeta = $('meta[name="theme-color"]');
    function applyTheme(t) {
        root.setAttribute('data-theme', t);
        themeBtn.setAttribute('aria-checked', String(t === 'dark'));
        themeMeta.setAttribute('content', t === 'dark' ? '#0D1526' : '#F5F7FA');
        readColors();
        if (reduce && W) draw(1);
    }
    applyTheme(root.getAttribute('data-theme') || 'dark');
    themeBtn.addEventListener('click', () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try { localStorage.setItem('theme-v2', next); } catch (e) {}
    });

    /* ---------- Mobile menu ---------- */
    const menuBtn = $('#menu-toggle');
    const navList = $('#nav-list');
    function setMenu(open) {
        navList.classList.toggle('open', open);
        menuBtn.setAttribute('aria-expanded', String(open));
        menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        menuBtn.firstElementChild.className = 'fa-solid ' + (open ? 'fa-xmark' : 'fa-bars');
    }
    menuBtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(!navList.classList.contains('open')); });
    $$('a', navList).forEach(a => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('click', (e) => {
        if (!navList.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    addEventListener('resize', () => { if (innerWidth > 768) setMenu(false); });

    /* ---------- Scroll progress + back to top ---------- */
    const bar = $('#progress');
    const toTop = $('#to-top');
    let ticking = false;
    function onScroll() {
        const h = root.scrollHeight - innerHeight;
        bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(scrollY / h, 1) : 0) + ')';
        toTop.classList.toggle('show', scrollY > 500);
        ticking = false;
    }
    addEventListener('scroll', () => {
        if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();
    toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));

    /* ---------- Active nav link ---------- */
    const links = $$('#nav-list a');
    const linkMap = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            links.forEach(l => l.classList.remove('active'));
            const link = linkMap.get(entry.target.id);
            if (link) link.classList.add('active');
        });
    }, { rootMargin: '-40% 0px -55% 0px' });
    ['top', ...linkMap.keys()].forEach(id => { const s = document.getElementById(id); if (s) spy.observe(s); });

    /* ---------- Accordion ---------- */
    $$('.acc-item').forEach(item => {
        const btn = $('.acc-head', item);
        btn.addEventListener('click', () => {
            const open = !item.classList.contains('open');
            item.classList.toggle('open', open);
            btn.setAttribute('aria-expanded', String(open));
        });
    });

    /* ---------- Dialogs ---------- */
    $$('[data-open]').forEach(btn => btn.addEventListener('click', () => {
        const dlg = document.getElementById(btn.dataset.open);
        const frame = $('iframe[data-src]', dlg);
        if (frame && !pdfInline) { window.open(frame.dataset.src.split('#')[0], '_blank', 'noopener'); return; }
        if (frame && !frame.getAttribute('src')) frame.setAttribute('src', frame.dataset.src);
        dlg.showModal();
        document.body.classList.add('locked');
    }));
    $$('dialog').forEach(dlg => {
        dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
        dlg.addEventListener('close', () => document.body.classList.remove('locked'));
        $$('[data-close]', dlg).forEach(b => b.addEventListener('click', () => dlg.close()));
    });

    /* ---------- Copy to clipboard ---------- */
    const toastEl = $('#toast');
    let toastTimer;
    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
    }
    $$('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
        const value = btn.dataset.copy;
        try {
            await navigator.clipboard.writeText(value);
        } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = value;
            ta.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (_) {}
            ta.remove();
        }
        toast('Copied to clipboard');
    }));

    /* ---------- Slides preview ---------- */
    const viewerBox = $('.viewer');
    const slidesFrame = $('iframe', viewerBox);
    if (pdfInline) {
        new IntersectionObserver((entries, obs) => {
            if (entries[0].isIntersecting) { slidesFrame.src = slidesFrame.dataset.src; obs.disconnect(); }
        }, { rootMargin: '400px' }).observe(slidesFrame);
    } else {
        viewerBox.classList.add('no-inline');
        $('.viewer-fallback', viewerBox).hidden = false;
    }

    /* ---------- Real file downloads (no new tab) ---------- */
    const fileCache = new Map();
    function saveAs(href, name) {
        const tmp = document.createElement('a');
        tmp.href = href;
        tmp.download = name;
        tmp.style.display = 'none';
        document.body.appendChild(tmp);
        tmp.click();
        tmp.remove();
    }
    async function loadFile(url) {
        if (fileCache.has(url)) return fileCache.get(url);
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        // octet-stream so phones save the file instead of previewing it
        const blob = new Blob([await res.blob()], { type: 'application/octet-stream' });
        fileCache.set(url, blob);
        return blob;
    }
    function saveBlob(blob, name) {
        const objectUrl = URL.createObjectURL(blob);
        saveAs(objectUrl, name);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
        toast('Download started');
    }
    const downloadLinks = $$('a[data-download]');
    downloadLinks.forEach(link => link.addEventListener('click', async (e) => {
        e.preventDefault();
        const url = link.getAttribute('href');
        const name = link.dataset.download;
        // already fetched: save right inside the tap, so phones treat it as a user-started download
        if (fileCache.has(url)) return saveBlob(fileCache.get(url), name);
        try {
            saveBlob(await loadFile(url), name);
        } catch (err) {
            // fetch not allowed (for example the page is opened as a local file): use the browser's own download
            saveAs(url, name);
        }
    }));
    // fetch quietly in the background so the tap above can save immediately
    const warm = () => downloadLinks.forEach(l => loadFile(l.getAttribute('href')).catch(() => {}));
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 4000 });
    else setTimeout(warm, 2500);

    /* ---------- Footer year ---------- */
    $('#year').textContent = new Date().getFullYear();

    /* ---------- Hero signal ---------- */
    const canvas = $('#signal');
    const ctx = canvas.getContext('2d');
    const signalWrap = $('#signal-wrap');
    let raf = 0, t0 = performance.now();

    function readColors() {
        const s = getComputedStyle(root);
        colors = {
            accent: s.getPropertyValue('--accent').trim() || colors.accent,
            muted: s.getPropertyValue('--muted').trim() || colors.muted,
            line: s.getPropertyValue('--line').trim() || colors.line
        };
    }

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth;
        H = canvas.clientHeight;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!scanX) scanX = targetX = W * 0.55;
        scanX = Math.min(scanX, W);
        if (reduce) draw(1);
    }

    const noise = (i, k) => {
        const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
        return (x - Math.floor(x)) * 2 - 1;
    };
    const wave = (x, t) => {
        const u = x / W;
        return Math.sin(u * 10 + t * 1.2) * 0.55 + Math.sin(u * 23 - t * 1.9) * 0.22 + Math.sin(u * 4 + t * 0.6) * 0.15;
    };

    function trace(t, amp, mid, noisy, k) {
        ctx.beginPath();
        for (let x = 0, i = 0; x <= W; x += 3, i++) {
            const y = mid - (wave(x, t) + (noisy ? noise(i, k) * 0.28 : 0)) * amp;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    function draw(t) {
        if (!W || !H) return;
        const mid = H / 2, amp = H * 0.36, k = Math.floor(t * 9);
        ctx.clearRect(0, 0, W, H);

        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke();

        // Raw input, right of the line
        ctx.save();
        ctx.beginPath(); ctx.rect(scanX, 0, W - scanX, H); ctx.clip();
        ctx.strokeStyle = colors.muted; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.2;
        trace(t, amp, mid, true, k);
        ctx.restore();

        // Cleaned output, left of the line
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, scanX, H); ctx.clip();
        ctx.strokeStyle = colors.accent; ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
        trace(t, amp, mid, false, k);
        ctx.restore();

        // Scan line + marker
        ctx.strokeStyle = colors.accent; ctx.globalAlpha = 0.9; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(scanX, 6); ctx.lineTo(scanX, H - 6); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.accent;
        ctx.beginPath(); ctx.arc(scanX, mid - wave(scanX, t) * amp, 4, 0, Math.PI * 2); ctx.fill();
    }

    function frame(now) {
        const t = (now - t0) / 1000;
        if (!pointerActive) targetX = W * (0.5 + 0.38 * Math.sin(t * 0.45));
        scanX += (targetX - scanX) * 0.12;
        draw(t);
        raf = requestAnimationFrame(frame);
    }

    function setPointer(e) {
        const rect = canvas.getBoundingClientRect();
        targetX = Math.max(0, Math.min(W, e.clientX - rect.left));
        pointerActive = true;
        if (reduce) { scanX = targetX; draw(1); }
    }
    signalWrap.addEventListener('pointermove', setPointer);
    signalWrap.addEventListener('pointerdown', (e) => { setPointer(e); try { signalWrap.setPointerCapture(e.pointerId); } catch (_) {} });
    signalWrap.addEventListener('pointerleave', () => { pointerActive = false; });
    signalWrap.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') pointerActive = false; });
    signalWrap.addEventListener('pointercancel', () => { pointerActive = false; });

    new ResizeObserver(resize).observe(canvas);
    readColors();
    resize();

    if (!reduce) {
        new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) { if (!raf) raf = requestAnimationFrame(frame); }
            else { cancelAnimationFrame(raf); raf = 0; }
        }).observe(canvas);
    }
})();

// Fix mobile back button history pollution for anchor links
$$('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            e.preventDefault();
            targetElement.scrollIntoView({ 
                behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' 
            });
            history.replaceState(null, '', targetId);
        }
    });
});
