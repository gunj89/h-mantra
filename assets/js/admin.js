/* =========================================================
   H MANTRA - Site Manager (admin.html)
   Home hero (photo or video) and portfolio editing,
   all stored in Appwrite. No login: access is by knowing the page address.
   Uses the Appwrite Web SDK.
   ========================================================= */
(function () {
    "use strict";

    var C = window.HM_CONFIG || {};
    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

    var CATEGORIES = [
        ["interior", "Interior"], ["living-room", "Living Room"], ["bedroom", "Bedroom"],
        ["kitchen", "Kitchen"], ["furniture", "Furniture"], ["mandir", "Mandir"],
        ["wall-ceiling", "Wall & Ceiling"]
    ];
    var LIMITS = { videoWarnMB: 25, videoMaxMB: 45 };

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    var toastTimer;
    function toast(msg, isErr) {
        var t = $("#toast");
        t.textContent = msg;
        t.classList.toggle("err", !!isErr);
        t.classList.add("on");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.classList.remove("on"); }, isErr ? 6000 : 2600);
    }

    if (!C.projectId || !window.Appwrite) {
        document.body.innerHTML = '<p style="padding:2rem">Appwrite is not configured yet. Run the setup script first (see SETUP.md).</p>';
        return;
    }

    var A = window.Appwrite;
    var client = new A.Client().setEndpoint(C.endpoint).setProject(C.projectId);
    var db = new A.Databases(client);
    var storage = new A.Storage(client);
    var ID = A.ID, Query = A.Query;

    function fileUrl(id) {
        return C.endpoint + "/storage/buckets/" + C.bucketId + "/files/" + id + "/view?project=" + C.projectId;
    }

    /* ---------------------------------------------------------
       helpers: upload + image/video processing
       --------------------------------------------------------- */
    function toBlob(canvas, type, q) {
        return new Promise(function (res) { canvas.toBlob(res, type, q); });
    }

    async function compressImage(file, maxDim, quality) {
        var bmp;
        try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
        catch (e) { throw new Error("Could not read \"" + file.name + "\". Please use a JPG, PNG or WebP photo."); }
        var s = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
        var w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
        var cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
        if (bmp.close) bmp.close();
        var blob = await toBlob(cv, "image/webp", quality);
        if (!blob || blob.type !== "image/webp") blob = await toBlob(cv, "image/jpeg", quality);
        return { blob: blob, width: w, height: h, ext: blob.type === "image/webp" ? "webp" : "jpg" };
    }

    function videoPoster(file) {
        return new Promise(function (resolve) {
            var url = URL.createObjectURL(file);
            var v = document.createElement("video");
            var done = function (b) { URL.revokeObjectURL(url); resolve(b); };
            var timer = setTimeout(function () { done(null); }, 10000);
            v.muted = true; v.playsInline = true; v.preload = "auto";
            v.addEventListener("error", function () { clearTimeout(timer); done(null); });
            v.addEventListener("loadeddata", function () {
                v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
            });
            v.addEventListener("seeked", async function () {
                clearTimeout(timer);
                var s = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight));
                var cv = document.createElement("canvas");
                cv.width = Math.round(v.videoWidth * s); cv.height = Math.round(v.videoHeight * s);
                cv.getContext("2d").drawImage(v, 0, 0, cv.width, cv.height);
                done(await toBlob(cv, "image/jpeg", 0.8));
            });
            v.src = url;
        });
    }

    async function upload(blob, name, onProgress) {
        var f = new File([blob], name, { type: blob.type });
        var r = await storage.createFile(C.bucketId, ID.unique(), f, undefined, function (p) {
            if (onProgress) onProgress(p.progress);
        });
        return r.$id;
    }

    function removeFile(id) {
        if (!id) return Promise.resolve();
        return storage.deleteFile(C.bucketId, id).catch(function () {});
    }

    function msg(e) { return (e && e.message) || "Something went wrong"; }

    /* ---------------------------------------------------------
       TABS
       --------------------------------------------------------- */
    var portfolioLoaded = false;
    function enterApp() {
        loadHero();
    }
    $$(".tabs button").forEach(function (b) {
        b.addEventListener("click", function () {
            $$(".tabs button").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
            $("#tab-hero").hidden = b.dataset.tab !== "hero";
            $("#tab-portfolio").hidden = b.dataset.tab !== "portfolio";
            if (b.dataset.tab === "portfolio" && !portfolioLoaded) loadProjects();
        });
    });

    /* ---------------------------------------------------------
       HERO
       --------------------------------------------------------- */
    var settings = null;
    var heroFile = null, heroPreviewUrl = null;

    function heroType() { return $('input[name="heroType"]:checked').value; }

    function mediaEl(type, id, posterId) {
        var el;
        if (type === "video") {
            el = document.createElement("video");
            el.muted = true; el.loop = true; el.autoplay = true; el.playsInline = true;
            el.setAttribute("muted", ""); el.setAttribute("playsinline", "");
            if (posterId) el.poster = fileUrl(posterId);
            el.src = fileUrl(id);
            var p = el.play(); if (p && p.catch) p.catch(function () {});
        } else {
            el = document.createElement("img");
            el.alt = "Current hero"; el.src = fileUrl(id);
        }
        return el;
    }

    async function loadHero() {
        var box = $("#hero-current");
        try {
            settings = await db.getDocument(C.databaseId, C.settingsCollectionId, "main");
            box.replaceChildren(mediaEl(settings.heroType, settings.heroFileId, settings.heroPosterId));
        } catch (e) {
            settings = null;
            box.innerHTML = '<span class="muted">No hero saved yet. The site is showing its built-in photo.</span>';
        }
    }

    function resetHeroPicker() {
        heroFile = null;
        if (heroPreviewUrl) URL.revokeObjectURL(heroPreviewUrl);
        heroPreviewUrl = null;
        $("#hero-file").value = "";
        $("#hero-new").hidden = true;
        $("#hero-new").replaceChildren();
        $("#hero-save").disabled = true;
    }

    function syncHeroType() {
        var v = heroType() === "video";
        $("#hero-file").accept = v ? "video/mp4,video/webm,video/quicktime" : "image/*";
        $("#hero-drop-title").textContent = v ? "Choose a video" : "Choose a photo";
        $("#hero-drop-hint").textContent = v
            ? "MP4 recommended, ideally under " + LIMITS.videoWarnMB + " MB, 10-20 seconds. It plays muted and loops. A cover image is created automatically."
            : "JPG, PNG or WebP. Tall/portrait photos work best. It is resized automatically.";
        resetHeroPicker();
    }
    $$('input[name="heroType"]').forEach(function (r) { r.addEventListener("change", syncHeroType); });

    $("#hero-file").addEventListener("change", function (e) {
        var f = e.target.files[0];
        if (!f) return;
        var wantVideo = heroType() === "video";
        if (wantVideo !== /^video\//.test(f.type)) {
            toast(wantVideo ? "Please choose a video file." : "Please choose a photo.", true);
            resetHeroPicker(); return;
        }
        if (wantVideo && f.size > LIMITS.videoMaxMB * 1048576) {
            toast("That video is " + Math.round(f.size / 1048576) + " MB. Please compress it below " + LIMITS.videoMaxMB + " MB.", true);
            resetHeroPicker(); return;
        }
        heroFile = f;
        if (heroPreviewUrl) URL.revokeObjectURL(heroPreviewUrl);
        heroPreviewUrl = URL.createObjectURL(f);
        var el = document.createElement(wantVideo ? "video" : "img");
        if (wantVideo) { el.muted = true; el.loop = true; el.autoplay = true; el.playsInline = true; }
        el.src = heroPreviewUrl;
        $("#hero-new").replaceChildren(el);
        $("#hero-new").hidden = false;
        $("#hero-save").disabled = false;
    });

    var drop = $("#hero-drop");
    ["dragenter", "dragover"].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); });
    });
    drop.addEventListener("drop", function (e) {
        if (!e.dataTransfer.files.length) return;
        $("#hero-file").files = e.dataTransfer.files;
        $("#hero-file").dispatchEvent(new Event("change"));
    });

    $("#hero-save").addEventListener("click", async function () {
        if (!heroFile) return;
        var type = heroType();
        if (type === "video" && heroFile.size > LIMITS.videoWarnMB * 1048576 &&
            !confirm("This video is " + Math.round(heroFile.size / 1048576) + " MB and may load slowly on phones. Upload anyway?")) return;

        var btn = $("#hero-save"), bar = $("#hero-progress");
        btn.disabled = true; bar.hidden = false; bar.value = 0;
        var created = [];
        try {
            var fileId, posterId = null;
            if (type === "image") {
                var img = await compressImage(heroFile, 2000, 0.85);
                fileId = await upload(img.blob, "hero." + img.ext, function (p) { bar.value = p; });
                created.push(fileId);
            } else {
                var poster = await videoPoster(heroFile);
                if (poster) { posterId = await upload(poster, "hero-poster.jpg"); created.push(posterId); }
                var ext = (heroFile.name.split(".").pop() || "mp4").toLowerCase();
                fileId = await upload(heroFile, "hero." + ext, function (p) { bar.value = p; });
                created.push(fileId);
            }
            var data = { heroType: type, heroFileId: fileId, heroPosterId: posterId };
            try {
                await db.updateDocument(C.databaseId, C.settingsCollectionId, "main", data);
            } catch (e) {
                if (e.code === 404) await db.createDocument(C.databaseId, C.settingsCollectionId, "main", data);
                else throw e;
            }
            var old = settings;
            if (old) { await removeFile(old.heroFileId); await removeFile(old.heroPosterId); }
            toast("Hero updated. It is live on the home page.");
            resetHeroPicker();
            await loadHero();
        } catch (e) {
            await Promise.all(created.map(removeFile));
            toast(msg(e), true);
            btn.disabled = false;
        } finally { bar.hidden = true; }
    });

    /* ---------------------------------------------------------
       PORTFOLIO
       --------------------------------------------------------- */
    var docs = [];

    function catOptions(sel) {
        return CATEGORIES.map(function (c) {
            return '<option value="' + c[0] + '"' + (c[0] === sel ? " selected" : "") + ">" + esc(c[1]) + "</option>";
        }).join("");
    }

    async function loadProjects() {
        $("#pf-count").textContent = "Loading…";
        try {
            var all = [], off = 0, res;
            do {
                res = await db.listDocuments(C.databaseId, C.projectsCollectionId,
                    [Query.limit(100), Query.offset(off)]);
                all = all.concat(res.documents); off += 100;
            } while (all.length < res.total && res.documents.length);
            docs = all.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
            portfolioLoaded = true;
            renderFilter();
            renderGrid();
        } catch (e) {
            $("#pf-count").textContent = "Could not load: " + msg(e);
        }
    }

    function renderFilter() {
        var sel = $("#pf-filter"), cur = sel.value || "all";
        var counts = {};
        docs.forEach(function (d) { counts[d.category] = (counts[d.category] || 0) + 1; });
        sel.innerHTML = '<option value="all">All categories (' + docs.length + ")</option>" +
            CATEGORIES.map(function (c) {
                return '<option value="' + c[0] + '">' + esc(c[1]) + " (" + (counts[c[0]] || 0) + ")</option>";
            }).join("");
        sel.value = cur;
    }

    function filtered() {
        var f = $("#pf-filter").value;
        return f === "all" ? docs : docs.filter(function (d) { return d.category === f; });
    }

    function renderGrid() {
        var list = filtered(), hiddenN = docs.filter(function (d) { return d.visible === false; }).length;
        $("#pf-count").textContent = docs.length + " photos" + (hiddenN ? " (" + hiddenN + " hidden from the site)" : "");
        $("#pf-grid").innerHTML = list.map(function (d, i) {
            return '<article class="card' + (d.visible === false ? " hidden-item" : "") + '" data-id="' + d.$id + '">' +
                '<div class="thumb"><img loading="lazy" src="' + fileUrl(d.fileId) + '" alt="">' +
                (d.visible === false ? '<span class="badge">Hidden</span>' : "") + "</div>" +
                '<div class="body">' +
                '<input type="text" data-field="title" maxlength="80" value="' + esc(d.title) + '" aria-label="Title">' +
                '<select data-field="category" aria-label="Category">' + catOptions(d.category) + "</select>" +
                '<div class="row"><label class="vis"><input type="checkbox" data-field="visible"' + (d.visible === false ? "" : " checked") + "> Show on site</label>" +
                '<span class="saved">Saved &#10003;</span></div>' +
                '<div class="row"><span>' +
                '<button type="button" class="btn btn-ghost btn-sm" data-action="up" title="Move earlier"' + (i === 0 ? " disabled" : "") + ">&larr;</button> " +
                '<button type="button" class="btn btn-ghost btn-sm" data-action="down" title="Move later"' + (i === list.length - 1 ? " disabled" : "") + ">&rarr;</button> " +
                '<button type="button" class="btn btn-ghost btn-sm" data-action="top"' + (i === 0 ? " disabled" : "") + ">To top</button></span>" +
                '<span><button type="button" class="btn btn-ghost btn-sm" data-action="replace">Replace</button> ' +
                '<button type="button" class="btn btn-danger btn-sm" data-action="delete">Delete</button></span></div>' +
                "</div></article>";
        }).join("") || '<p class="muted">No photos in this category yet.</p>';
    }

    $("#pf-filter").addEventListener("change", renderGrid);

    function findDoc(id) { return docs.filter(function (d) { return d.$id === id; })[0]; }

    async function patch(card, id, data) {
        var d = findDoc(id);
        try {
            var upd = await db.updateDocument(C.databaseId, C.projectsCollectionId, id, data);
            Object.assign(d, data, { $updatedAt: upd.$updatedAt });
            var s = $(".saved", card);
            if (s) { s.classList.add("on"); setTimeout(function () { s.classList.remove("on"); }, 1500); }
            return true;
        } catch (e) { toast(msg(e), true); return false; }
    }

    $("#pf-grid").addEventListener("change", async function (e) {
        var field = e.target.dataset.field;
        if (!field) return;
        var card = e.target.closest(".card"), id = card.dataset.id, d = findDoc(id);
        var val = field === "visible" ? e.target.checked : e.target.value.trim();
        if (field === "title" && !val) { e.target.value = d.title; return; }
        var ok = await patch(card, id, (function (o) { o[field] = val; return o; })({}));
        if (!ok) return;
        if (field === "category") { renderFilter(); if ($("#pf-filter").value !== "all") renderGrid(); }
        if (field === "visible") { renderGrid(); }
    });

    var replaceTarget = null;
    var replaceInput = document.createElement("input");
    replaceInput.type = "file"; replaceInput.accept = "image/*";
    replaceInput.addEventListener("change", async function () {
        var f = replaceInput.files[0]; replaceInput.value = "";
        if (!f || !replaceTarget) return;
        var id = replaceTarget, card = $('.card[data-id="' + id + '"]'), d = findDoc(id);
        var oldFileId = d.fileId, newId = null;
        card.classList.add("busy");
        try {
            var img = await compressImage(f, 1600, 0.82);
            newId = await upload(img.blob, "project." + img.ext);
            var ok = await patch(card, id, { fileId: newId, width: img.width, height: img.height });
            if (!ok) throw new Error("Could not save the new photo.");
        } catch (e) {
            if (newId) await removeFile(newId);
            card.classList.remove("busy");
            return toast(msg(e), true);
        }
        await removeFile(oldFileId);
        toast("Photo replaced.");
        renderGrid();
    });

    $("#pf-grid").addEventListener("click", async function (e) {
        var btn = e.target.closest("button[data-action]");
        if (!btn) return;
        var card = btn.closest(".card"), id = card.dataset.id, d = findDoc(id), act = btn.dataset.action;
        var list = filtered(), i = list.indexOf(d);

        if (act === "replace") {
            replaceTarget = id; replaceInput.click();
        } else if (act === "delete") {
            if (!confirm('Delete "' + d.title + '" from the portfolio? This cannot be undone.')) return;
            card.classList.add("busy");
            try {
                await db.deleteDocument(C.databaseId, C.projectsCollectionId, id);
                await removeFile(d.fileId);
                docs = docs.filter(function (x) { return x !== d; });
                renderFilter(); renderGrid(); toast("Deleted.");
            } catch (err) { card.classList.remove("busy"); toast(msg(err), true); }
        } else if (act === "up" || act === "down") {
            var n = list[i + (act === "up" ? -1 : 1)];
            if (!n) return;
            card.classList.add("busy");
            var da = d.order, nb = n.order;
            var ok1 = await patch(card, d.$id, { order: nb });
            var ok2 = ok1 && await patch(card, n.$id, { order: da });
            if (!(ok1 && ok2)) { await loadProjects(); return; }
            docs.sort(function (x, y) { return (x.order || 0) - (y.order || 0); });
            renderGrid();
        } else if (act === "top") {
            var min = Math.min.apply(null, docs.map(function (x) { return x.order || 0; }));
            card.classList.add("busy");
            if (await patch(card, id, { order: min - 1 })) {
                docs.sort(function (x, y) { return (x.order || 0) - (y.order || 0); });
                renderGrid(); toast("Moved to the top.");
            } else card.classList.remove("busy");
        }
    });

    /* ---- add new photos ---- */
    var staged = [];

    function guessTitle(name) {
        var t = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\(\d+\)/g, "").trim();
        return /^(img|dsc|image|photo|project|whatsapp|pxl)\b/i.test(t) || /^\d+$/.test(t) ? "" : t;
    }

    $("#pf-add").addEventListener("change", function (e) {
        var files = Array.prototype.slice.call(e.target.files).filter(function (f) { return /^image\//.test(f.type); });
        e.target.value = "";
        if (!files.length) return;
        var cat = $("#pf-filter").value !== "all" ? $("#pf-filter").value : "interior";
        staged = files.map(function (f) {
            return { file: f, url: URL.createObjectURL(f), title: guessTitle(f.name), category: cat };
        });
        $("#pf-stage-list").innerHTML = staged.map(function (s, i) {
            return '<div class="stage-item" data-i="' + i + '"><img src="' + s.url + '" alt="">' +
                '<input type="text" maxlength="80" placeholder="Title (e.g. TV Unit Wall)" value="' + esc(s.title) + '" data-s="title">' +
                '<select data-s="category">' + catOptions(s.category) + "</select></div>";
        }).join("");
        $("#pf-stage").hidden = false;
    });

    $("#pf-stage-list").addEventListener("input", function (e) {
        var row = e.target.closest(".stage-item"); if (!row) return;
        staged[+row.dataset.i][e.target.dataset.s] = e.target.value;
    });

    function clearStage() {
        staged.forEach(function (s) { URL.revokeObjectURL(s.url); });
        staged = [];
        $("#pf-stage").hidden = true;
        $("#pf-stage-list").replaceChildren();
    }
    $("#pf-stage-cancel").addEventListener("click", clearStage);

    $("#pf-stage-go").addEventListener("click", async function () {
        var btn = this, bar = $("#pf-progress"), n = staged.length;
        btn.disabled = true; bar.hidden = false; bar.value = 0;
        var min = docs.length ? Math.min.apply(null, docs.map(function (x) { return x.order || 0; })) : 0;
        var done = 0, failed = 0;
        for (var i = 0; i < n; i++) {
            var s = staged[i], fid = null;
            try {
                var img = await compressImage(s.file, 1600, 0.82);
                fid = await upload(img.blob, "project." + img.ext, function (p) { bar.value = ((done + p / 100) / n) * 100; });
                await db.createDocument(C.databaseId, C.projectsCollectionId, ID.unique(), {
                    title: (s.title || "").trim() || "Untitled project",
                    category: s.category, fileId: fid, width: img.width, height: img.height,
                    order: min - n + i, visible: true
                });
            } catch (e) {
                failed++; if (fid) await removeFile(fid);
                toast(msg(e), true);
            }
            done++; bar.value = (done / n) * 100;
        }
        btn.disabled = false; bar.hidden = true;
        clearStage();
        if (done - failed) toast((done - failed) + " photo" + (done - failed > 1 ? "s" : "") + " added" + (failed ? ", " + failed + " failed" : "."));
        await loadProjects();
    });

    syncHeroType();
    enterApp();
})();
