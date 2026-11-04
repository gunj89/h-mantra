/* =========================================================
   H MANTRA - content loader (public pages)
   Pulls the hero and the portfolio from Appwrite and swaps
   them into the page. If Appwrite is not configured or is
   unreachable, the static HTML already in the page stays.
   Plain JS, talks to Appwrite's REST API (no SDK needed).
   ========================================================= */
(function () {
    "use strict";

    var C = window.HM_CONFIG;
    if (!C || !C.projectId) return;

    /* HERO VIDEO MODE
       true  = the video autoplays muted on load, with a speaker button to turn sound on (default)
       false = the visitor presses PLAY and the video plays WITH SOUND
       (browsers only allow autoplay when muted, so these are the two options) */
    var HERO_VIDEO_AUTOPLAY = true;

    var CACHE_HERO = "hm:hero:v1";
    var CACHE_PROJECTS = "hm:projects:v1";
    var CACHE_RECENT = "hm:recent:v2";

    var store = {
        get: function (k) {
            try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; }
        },
        set: function (k, v) {
            try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode etc. */ }
        }
    };

    function api(path) {
        return fetch(C.endpoint + path, { headers: { "X-Appwrite-Project": C.projectId } })
            .then(function (r) {
                if (!r.ok) { var err = new Error("HTTP " + r.status); err.status = r.status; throw err; }
                return r.json();
            });
    }

    function fileUrl(id) {
        return C.endpoint + "/storage/buckets/" + C.bucketId + "/files/" + id +
            "/view?project=" + C.projectId;
    }

    /* ---------------------------------------------------------
       HERO (index.html)
       --------------------------------------------------------- */
    var heroFig = document.querySelector("#hero > figure");

    /* Sound button for a video hero. Browsers only allow autoplay when muted,
       so the video starts muted and the visitor can turn sound on with this
       button (a click is always allowed to unmute). Styles live here so this
       is the only file that needs changing. */
    function injectSoundCss() {
        if (document.getElementById("hm-hero-sound-css")) return;
        var st = document.createElement("style");
        st.id = "hm-hero-sound-css";
        st.textContent =
            "#hero > figure .hero-sound{position:absolute;right:26px;bottom:26px;z-index:3;" +
            "width:46px;height:46px;border-radius:50%;border:1px solid #d4af37;" +
            "background:rgba(8,8,8,.62);color:#d4af37;cursor:pointer;display:grid;place-items:center;" +
            "padding:0;backdrop-filter:blur(4px);transition:background .2s,color .2s,transform .2s}" +
            "#hero > figure .hero-sound:hover{background:#d4af37;color:#080808;transform:scale(1.06)}" +
            "#hero > figure .hero-sound:focus-visible{outline:2px solid #fff;outline-offset:3px}" +
            "#hero > figure .hero-sound svg{width:22px;height:22px;display:block}" +
            "#hero > figure .hero-sound .on{display:none}" +
            "#hero > figure .hero-sound[aria-pressed=true] .on{display:block}" +
            "#hero > figure .hero-sound[aria-pressed=true] .off{display:none}" +
            "#hero > figure video.is-clickable{cursor:pointer}" +
            "#hero > figure .hero-play{position:absolute;left:50%;top:50%;z-index:3;" +
            "width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;border:1px solid #d4af37;" +
            "background:rgba(8,8,8,.6);color:#d4af37;cursor:pointer;display:grid;place-items:center;" +
            "padding:0;backdrop-filter:blur(4px);transition:background .2s,color .2s,transform .2s,opacity .2s}" +
            "#hero > figure .hero-play:hover{background:#d4af37;color:#080808;transform:scale(1.07)}" +
            "#hero > figure .hero-play:focus-visible{outline:2px solid #fff;outline-offset:3px}" +
            "#hero > figure .hero-play svg{width:34px;height:34px;display:block;margin-left:4px}" +
            "#hero > figure .hero-play.is-hidden{opacity:0;pointer-events:none}";
        document.head.appendChild(st);
    }

    /* Click-to-play mode: poster + big play button, plays with sound. */
    function addPlayButton(video) {
        injectSoundCss();
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "hero-play";
        btn.setAttribute("aria-label", "Play video with sound");
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>';

        var play = function () {
            video.muted = false;
            video.volume = 1;
            var p = video.play();
            if (p && p.catch) p.catch(function () {});
        };
        var toggle = function () { if (video.paused) play(); else video.pause(); };

        btn.addEventListener("click", play);
        video.classList.add("is-clickable");
        video.addEventListener("click", toggle);
        video.tabIndex = 0;
        video.addEventListener("keydown", function (e) {
            if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); }
        });
        video.addEventListener("play", function () { btn.classList.add("is-hidden"); });
        video.addEventListener("pause", function () { btn.classList.remove("is-hidden"); });
        heroFig.appendChild(btn);
    }

    function addSoundButton(video) {
        injectSoundCss();
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "hero-sound";
        btn.setAttribute("aria-pressed", "false");
        btn.setAttribute("aria-label", "Turn sound on");
        var svg = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
            'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
        btn.innerHTML =
            '<svg class="off" ' + svg + '><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>' +
            '<svg class="on" ' + svg + '><path d="M11 5 6 9H3v6h3l5 4z"/>' +
            '<path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
        btn.addEventListener("click", function () {
            var unmute = video.muted;
            video.muted = !unmute;
            if (unmute) { video.volume = 1; if (video.paused) { var p = video.play(); if (p && p.catch) p.catch(function () {}); } }
            btn.setAttribute("aria-pressed", String(unmute));
            btn.setAttribute("aria-label", unmute ? "Turn sound off" : "Turn sound on");
        });
        heroFig.appendChild(btn);
    }

    function applyHero(s) {
        if (!heroFig || !s || !s.heroFileId) return;
        var key = s.heroType + ":" + s.heroFileId;
        if (heroFig.dataset.cms === key) return;
        heroFig.dataset.cms = key;
        Array.prototype.forEach.call(heroFig.querySelectorAll(".hero-sound, .hero-play"), function (b) { b.remove(); });

        var oldMedia = heroFig.querySelector("img, video");
        var alt = (oldMedia && oldMedia.getAttribute("alt")) || "H Mantra project";
        var el;

        if (s.heroType === "video") {
            el = document.createElement("video");
            el.loop = true;
            el.playsInline = true;
            el.setAttribute("loop", ""); el.setAttribute("playsinline", "");
            el.setAttribute("aria-label", alt);
            if (s.heroPosterId) el.poster = fileUrl(s.heroPosterId);

            if (HERO_VIDEO_AUTOPLAY) {
                el.muted = true; el.defaultMuted = true;
                el.setAttribute("muted", "");
                el.preload = "auto";
                el.src = fileUrl(s.heroFileId);
                var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
                if (!reduce) {
                    el.autoplay = true; el.setAttribute("autoplay", "");
                    var p = el.play(); if (p && p.catch) p.catch(function () {});
                }
                swap(el);
                addSoundButton(el);
            } else {
                el.muted = false;
                el.preload = "metadata";
                el.src = fileUrl(s.heroFileId);
                swap(el);
                addPlayButton(el);
            }
        } else {
            el = document.createElement("img");
            el.alt = alt;
            el.decoding = "async";
            el.fetchPriority = "high";
            el.addEventListener("load", function () { swap(el); });
            el.src = fileUrl(s.heroFileId);
        }
    }

    function swap(el) {
        var old = heroFig.querySelector("img, video");
        if (old) old.replaceWith(el); else heroFig.appendChild(el);
    }

    function loadHero() {
        if (!heroFig) return;
        applyHero(store.get(CACHE_HERO));           // instant, from last visit
        api("/databases/" + C.databaseId + "/collections/" + C.settingsCollectionId +
            "/documents/main")
            .then(function (doc) {
                store.set(CACHE_HERO, {
                    heroType: doc.heroType, heroFileId: doc.heroFileId, heroPosterId: doc.heroPosterId
                });
                applyHero(doc);
            })
            .catch(function () { /* keep static hero */ });
    }

    /* ---------------------------------------------------------
       PORTFOLIO (portfolio.html)
       --------------------------------------------------------- */
    var gallery = document.getElementById("portfolio-gallery");
    var lastProjectsJson = "";

    function renderProjects(list) {
        var json = JSON.stringify(list);
        if (json === lastProjectsJson) return;
        lastProjectsJson = json;

        var frag = document.createDocumentFragment();
        list.forEach(function (p) {
            var fig = document.createElement("figure");
            fig.className = "portfolio-item";
            fig.dataset.category = p.category || "interior";

            var a = document.createElement("a");
            a.href = fileUrl(p.fileId);
            a.dataset.caption = p.title || "";

            var img = document.createElement("img");
            img.src = fileUrl(p.fileId);
            img.alt = (p.title || "Project") + " - H Mantra project";
            if (p.width && p.height) { img.width = p.width; img.height = p.height; }
            img.loading = "lazy";
            img.decoding = "async";
            a.appendChild(img);

            var cap = document.createElement("figcaption");
            cap.textContent = p.title || "";

            fig.appendChild(a);
            fig.appendChild(cap);
            frag.appendChild(fig);
        });
        gallery.replaceChildren(frag);
        document.dispatchEvent(new Event("cms:portfolio"));
    }

    function fetchAllProjects() {
        var all = [];
        function page(offset) {
            var q = [
                JSON.stringify({ method: "limit", values: [100] }),
                JSON.stringify({ method: "offset", values: [offset] })
            ].map(function (x) { return "queries[]=" + encodeURIComponent(x); }).join("&");
            return api("/databases/" + C.databaseId + "/collections/" + C.projectsCollectionId +
                "/documents?" + q).then(function (res) {
                all = all.concat(res.documents);
                return all.length < res.total && res.documents.length ? page(offset + 100) : all;
            });
        }
        return page(0);
    }

    function clean(docs) {
        return docs
            .filter(function (d) { return d.visible !== false && d.fileId; })
            .sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
            .map(function (d) {
                return { title: d.title, category: d.category, fileId: d.fileId,
                         width: d.width, height: d.height, order: d.order };
            });
    }

    function loadPortfolio() {
        if (!gallery) return;
        var cached = store.get(CACHE_PROJECTS);
        if (cached && cached.length) renderProjects(cached);
        fetchAllProjects()
            .then(function (docs) {
                if (!docs.length) return;               // empty collection: keep static HTML
                var list = clean(docs);
                store.set(CACHE_PROJECTS, list);
                renderProjects(list);
            })
            .catch(function () { /* keep whatever is on screen */ });
    }

    /* ---------------------------------------------------------
       NEWEST UPLOADS ON THE HOME PAGE (index.html)
       - About section photo      = the newest upload
       - "Selected Projects" (6)  = the newest 6 uploads (newest first)
       Only photos that are visible on the site are counted. Anything
       that cannot be filled (fewer uploads than slots) keeps its
       built-in photo.
       --------------------------------------------------------- */
    var aboutImg = document.querySelector("#about > figure img");
    var featuredImgs = Array.prototype.slice.call(
        document.querySelectorAll("#featured-projects > div > figure img"));

    function setPhoto(img, p, altSuffix) {
        if (!img || !p || !p.fileId || img.dataset.cms === p.fileId) return;
        img.dataset.cms = p.fileId;
        var pre = new Image();
        pre.onload = function () {
            img.src = pre.src;
            img.alt = (p.title || "H Mantra project") + (altSuffix || "");
            if (p.width && p.height) { img.width = p.width; img.height = p.height; }
        };
        pre.src = fileUrl(p.fileId);
    }

    function applyRecent(list) {
        if (!list || !list.length) return;
        setPhoto(aboutImg, list[0], " - completed by H Mantra");
        featuredImgs.forEach(function (img, i) { setPhoto(img, list[i], ""); });
    }

    function loadRecent() {
        if (!aboutImg && !featuredImgs.length) return;
        applyRecent(store.get(CACHE_RECENT));
        fetchAllProjects()
            .then(function (docs) {
                var list = docs
                    .map(function (d, i) { d._i = i; return d; })
                    .filter(function (d) { return d.visible !== false && d.fileId; })
                    .sort(function (a, b) {                       // newest first
                        return a.$createdAt < b.$createdAt ? 1 : a.$createdAt > b.$createdAt ? -1 : b._i - a._i;
                    })
                    .slice(0, 6)
                    .map(function (d) {
                        return { fileId: d.fileId, title: d.title, width: d.width, height: d.height };
                    });
                if (!list.length) return;
                store.set(CACHE_RECENT, list);
                applyRecent(list);
            })
            .catch(function () { /* keep current photos */ });
    }

    loadHero();
    loadPortfolio();
    loadRecent();
})();