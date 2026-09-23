/*
 * Seekee Browser GrayJay Source v0.2
 *
 * ES5 compatible.
 *
 * Confirmed from Seekee 2.14.0:
 *   API host: https://h5-api.buscari.com
 *   internal API path string:
 *     /quan/app/content/recommend/v2/detailPageQuery
 *   Browser/resource-sniffing UI exists in the APK.
 *
 * Important:
 *   We do not invent a Browser method or a fake media URL.
 *   The HTTP layer is real and can extract playable media URLs when the
 *   returned API/WebView data contains them.
 */

var SEEK_BASE = "https://h5-api.buscari.com";
var DETAIL_ROUTE = "/quan/app/content/recommend/v2/detailPageQuery";
var MAX_SOURCES = 32;
var MAX_DEPTH = 10;
var MAX_JSON = 3000000;

function dbg(s) {
    try {
        if (_settings && _settings.debug === true && _debugLog) {
            _debugLog("[SeekeeBrowser] " + String(s));
        }
    } catch (e) {}
}

function str(v) {
    return v === null || v === undefined ? "" : String(v);
}

function nonempty(v) {
    return str(v) !== "";
}

function jsonTry(s) {
    try { return JSON.parse(s); } catch (e) { return null; }
}

function responseText(r) {
    if (r === null || r === undefined) return "";
    try {
        if (typeof r === "string") return r;
        if (r.body !== undefined) return str(r.body);
        if (r.text !== undefined) return str(r.text);
        if (r.data !== undefined) {
            return typeof r.data === "string" ? r.data : JSON.stringify(r.data);
        }
    } catch (e) {}
    return "";
}

function httpGet(url, headers) {
    try {
        return headers ? http.GET(url, headers) : http.GET(url);
    } catch (e) {
        dbg("GET failed: " + e);
        return null;
    }
}

function httpPost(url, body, headers) {
    try {
        return headers ? http.POST(url, body, headers) : http.POST(url, body);
    } catch (e) {
        dbg("POST failed: " + e);
        return null;
    }
}

function apiHeaders() {
    return {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36"
    };
}

function first(o, keys) {
    var i, k;
    if (!o || typeof o !== "object") return "";
    for (i = 0; i < keys.length; i++) {
        k = keys[i];
        if (o[k] !== undefined && o[k] !== null && str(o[k]) !== "") return o[k];
    }
    return "";
}

function makeThumbs(url) {
    if (!nonempty(url)) return new Thumbnails([]);
    try { return new Thumbnails([new Thumbnail(url, 720)]); } catch (e) {}
    try { return new Thumbnails([new Thumbnail(url)]); } catch (e2) {}
    return new Thumbnails([]);
}

function playableUrl(u) {
    var s = str(u).trim();
    if (!/^https?:\/\//i.test(s)) return false;
    if (/\.m3u8(?:$|[?#])/i.test(s)) return true;
    if (/\.mp4(?:$|[?#])/i.test(s)) return true;
    if (/\.m4v(?:$|[?#])/i.test(s)) return true;
    if (/\.mpd(?:$|[?#])/i.test(s)) return true;
    if (/\/(?:hls|dash|stream|manifest)(?:\/|[?#]|$)/i.test(s)) return true;
    return false;
}

function classify(u) {
    if (/\.m3u8(?:$|[?#])/i.test(u)) return "hls";
    if (/\.mpd(?:$|[?#])/i.test(u)) return "dash";
    return "video";
}

function collectMedia(v, out, seen, depth) {
    var k, i, a, s;
    if (depth > MAX_DEPTH || out.length >= MAX_SOURCES) return;
    if (v === null || v === undefined) return;

    if (typeof v === "string") {
        s = v;
        if (playableUrl(s) && !seen[s]) {
            seen[s] = true;
            out.push(s);
        }
        return;
    }

    if (typeof v !== "object") return;

    if (Array.isArray(v)) {
        for (i = 0; i < v.length && out.length < MAX_SOURCES; i++) {
            collectMedia(v[i], out, seen, depth + 1);
        }
        return;
    }

    for (k in v) {
        if (!v.hasOwnProperty(k)) continue;
        a = v[k];
        if (typeof a === "string") {
            s = a;
            if ((/url|play|stream|source|video|media|m3u8|mp4|manifest/i.test(k)) &&
                playableUrl(s) && !seen[s]) {
                seen[s] = true;
                out.push(s);
            } else if (playableUrl(s) && !seen[s]) {
                seen[s] = true;
                out.push(s);
            }
        } else {
            collectMedia(a, out, seen, depth + 1);
        }
        if (out.length >= MAX_SOURCES) break;
    }
}

function collectSubtitles(v, out, seen, depth) {
    var k, i, a, s;
    if (depth > MAX_DEPTH || out.length >= 32) return;
    if (v === null || v === undefined) return;

    if (typeof v === "string") {
        s = v;
        if (/^https?:\/\//i.test(s) && /\.(?:vtt|srt|ass)(?:$|[?#])/i.test(s) && !seen[s]) {
            seen[s] = true;
            out.push({name: "Subtitles", url: s, format: /\.srt/i.test(s) ? "text/srt" : "text/vtt", language: ""});
        }
        return;
    }

    if (typeof v !== "object") return;

    if (Array.isArray(v)) {
        for (i = 0; i < v.length && out.length < 32; i++) {
            collectSubtitles(v[i], out, seen, depth + 1);
        }
        return;
    }

    for (k in v) {
        if (!v.hasOwnProperty(k)) continue;
        a = v[k];

        if (typeof a === "string") {
            s = a;
            if (/^https?:\/\//i.test(s) && /\.(?:vtt|srt|ass)(?:$|[?#])/i.test(s) && !seen[s]) {
                seen[s] = true;
                out.push({
                    name: str(v.name || v.label || v.language || "Subtitles"),
                    url: s,
                    format: /\.srt/i.test(s) ? "text/srt" : "text/vtt",
                    language: str(v.language || v.languageCode || v.lang)
                });
            }
        } else {
            collectSubtitles(a, out, seen, depth + 1);
        }
        if (out.length >= 32) break;
    }
}

function normalizeItem(x) {
    if (!x || typeof x !== "object") return null;

    var title = first(x, ["title", "name", "contentName", "showName", "originalTitle"]);
    var id = first(x, ["integrationId", "contentId", "id", "videoId"]);
    var cover = first(x, ["cover", "coverUrl", "image", "poster", "thumbnail", "coverImage"]);
    var year = first(x, ["releaseDate", "year", "startYear"]);
    var type = first(x, ["contentType", "type", "languageType"]);

    if (!title && !id) return null;

    return {
        id: str(id),
        title: str(title || id),
        thumbnail: str(cover),
        year: str(year),
        type: str(type),
        raw: x
    };
}

function extractItems(data) {
    var out = [], arr = null, i, x;

    if (!data) return out;

    if (Array.isArray(data)) arr = data;
    else if (data.data && typeof data.data === "object") {
        arr = first(data.data, ["items", "list", "results", "records", "contentList", "searchList"]);
    }
    if (!arr) {
        arr = first(data, ["items", "list", "results", "records", "contentList", "searchList"]);
    }

    if (!Array.isArray(arr)) return out;

    for (i = 0; i < arr.length && out.length < 24; i++) {
        x = normalizeItem(arr[i]);
        if (x) out.push(x);
    }
    return out;
}

/*
 * The only Seekee backend path we can currently substantiate from the APK.
 * It is a detail/recommendation query, not a guessed search route.
 *
 * We send a small set of common parameter shapes because the minified RN
 * bundle does not preserve the TypeScript call signature in readable form.
 */
function detailQuery(id) {
    var url = SEEK_BASE + DETAIL_ROUTE;
    var bodies = [
        {contentId: id},
        {integrationId: id},
        {id: id},
        {contentId: id, integrationId: id},
        {contentId: String(id), page: 1, pageSize: 20}
    ];
    var h = apiHeaders();
    var i, r, t, j;

    for (i = 0; i < bodies.length; i++) {
        r = httpPost(url, JSON.stringify(bodies[i]), h);
        t = responseText(r);
        if (!t || t.length > MAX_JSON) continue;

        j = jsonTry(t);
        if (j) {
            dbg("detailPageQuery accepted parameter shape #" + (i + 1));
            return j;
        }
    }

    return null;
}

function extractTitleFromJson(data, fallback) {
    var title = first(data, ["title", "name", "contentName", "showName"]);
    if (title) return str(title);

    if (data && data.data) {
        title = first(data.data, ["title", "name", "contentName", "showName"]);
        if (title) return str(title);
    }

    return fallback;
}

function buildSources(data) {
    var urls = [], seen = {}, subs = [], subSeen = {};
    collectMedia(data, urls, seen, 0);
    collectSubtitles(data, subs, subSeen, 0);

    var sources = [], i, u;
    for (i = 0; i < urls.length && i < MAX_SOURCES; i++) {
        u = urls[i];
        try {
            if (classify(u) === "hls") {
                sources.push(new HLSSource({name: "Seekee HLS", url: u}));
            } else if (classify(u) === "dash") {
                if (typeof DashSource !== "undefined") {
                    sources.push(new DashSource({name: "Seekee DASH", url: u}));
                }
            } else {
                sources.push(new VideoSource({name: "Seekee MP4", url: u}));
            }
        } catch (e) {
            dbg("source constructor failed: " + e);
        }
    }

    return {sources: sources, subtitles: subs};
}

function idFromVideo(video) {
    var s = "";
    try {
        if (video && video.id && video.id.value) s = str(video.id.value);
        else if (video && video.id) s = str(video.id);
        if (/^seekee:/i.test(s)) s = s.replace(/^seekee:/i, "");
    } catch (e) {}
    return s;
}

function makeVideo(item) {
    try {
        return new PlatformVideo({
            id: new PlatformID("Seekee", item.id, "b7c3e8f1-2a91-4b67-9f44-0d6a8e2c5173"),
            name: item.title,
            thumbnails: makeThumbs(item.thumbnail),
            url: "seekee://" + encodeURIComponent(item.id),
            isLive: false
        });
    } catch (e) {
        var v = new PlatformVideo();
        v.id = "seekee:" + item.id;
        v.name = item.title;
        v.thumbnails = makeThumbs(item.thumbnail);
        v.url = "seekee://" + encodeURIComponent(item.id);
        v.isLive = false;
        return v;
    }
}

function browserInfo() {
    var out = {available: false, methods: []};
    try {
        if (typeof Browser === "undefined" || Browser === null) return out;
        out.available = true;
        var k;
        for (k in Browser) {
            try {
                if (typeof Browser[k] === "function") out.methods.push(k);
            } catch (e) {}
        }
    } catch (e2) {}
    return out;
}

var source = {
    enable: function(config) {
        try {
            _settings = (config && config.settings) ? config.settings : (_settings || {});
        } catch (e) {}
        try {
            if (_settings && _settings.seekeeBase) {
                SEEK_BASE = str(_settings.seekeeBase).replace(/\/+$/, "");
            }
        } catch (e2) {}

        var bi = browserInfo();
        dbg("enabled; Browser=" + bi.available + " methods=" + bi.methods.join(","));
    },

    disable: function() {},

    getHome: function() {
        /*
         * We deliberately don't fabricate a Home API. Seekee's APK contains
         * embedded recommendation datasets, but this source does not pretend
         * those are the live API contract.
         */
        return new PagedList([], false);
    },

    search: function(query) {
        /*
         * Search route is not yet safely recoverable from the minified bundle.
         * Numeric IDs are treated as direct detail lookups.
         */
        var q = str(query).replace(/^\s+|\s+$/g, "");
        if (!q) return new PagedList([], false);

        if (/^\d+$/.test(q)) {
            var detail = detailQuery(q);
            var item = normalizeItem(detail);
            if (item) return new PagedList([makeVideo(item)], false);

            var arr = extractItems(detail);
            var vids = [], i;
            for (i = 0; i < arr.length; i++) vids.push(makeVideo(arr[i]));
            return new PagedList(vids, false);
        }

        dbg("Search text: exact HTTP search route still not exposed by APK; no fake endpoint used.");
        return new PagedList([], false);
    },

    getContentDetails: function(url) {
        var id = idFromVideo({id: url});
        if (/^seekee:\/\//i.test(id)) id = id.replace(/^seekee:\/\//i, "");
        try { id = decodeURIComponent(id); } catch (e) {}

        if (!id) return null;

        var data = detailQuery(id);
        if (!data) {
            dbg("No detail response for " + id);
            return null;
        }

        var title = extractTitleFromJson(data, id);
        var built = buildSources(data);

        var details;
        try {
            details = new PlatformVideoDetails({
                id: new PlatformID("Seekee", id, "b7c3e8f1-2a91-4b67-9f44-0d6a8e2c5173"),
                name: title,
                thumbnails: new Thumbnails([]),
                author: new PlatformAuthorLink(
                    new PlatformID("Seekee", "", "b7c3e8f1-2a91-4b67-9f44-0d6a8e2c5173"),
                    "Seekee", "https://seekee.ai", ""
                ),
                uploadDate: 0,
                url: "seekee://" + encodeURIComponent(id),
                duration: 0,
                viewCount: -1,
                isLive: false,
                description: "",
                video: new VideoSourceDescriptor(built.sources),
                dash: null,
                hls: null,
                live: null,
                subtitles: built.subtitles
            });
        } catch (e) {
            dbg("PlatformVideoDetails constructor failed: " + e);
            return null;
        }

        return details;
    },

    getVideoSources: function(video) {
        var id = idFromVideo(video);
        if (!id) return new VideoSourceDescriptor([]);

        var data = detailQuery(id);
        if (!data) {
            dbg("No API detail data; Browser capability=" + JSON.stringify(browserInfo()));
            return new VideoSourceDescriptor([]);
        }

        var built = buildSources(data);
        dbg("media candidates=" + built.sources.length + " subtitles=" + built.subtitles.length);

        return new VideoSourceDescriptor(built.sources);
    }
};
