/* Copies of the photos that used to load from the old Squarespace site. Squarespace
   deletes a site's files some time after the plan is cancelled, so any content that
   still points there is swapped to these local copies (keyed by the Squarespace
   image id). The portal saves the swap permanently on the next save. */
(function () {
    var MAP = {
        "3b9a8747": "/media/legacy/3b9a8747-thumb.jpg",
        "490c06c5": "/media/legacy/490c06c5-masimo.jpg",
        "4f343d97": "/media/legacy/4f343d97-travel-reel-edit-v10-white-00-00-16-18-still001.jpg",
        "51d2e274": "/media/legacy/51d2e274-thumb-2.jpg",
        "572345b8": "/media/legacy/572345b8-thumb.png",
        "58aa37e8": "/media/legacy/58aa37e8-rabbit-high-country-ridgeline-productions.jpg",
        "91728399": "/media/legacy/91728399-hoka-transport-gtx-thumbnail-webpage.jpg",
        "9282ce5b": "/media/legacy/9282ce5b-60-sec-rabbit-cadence-kit-edit-v9-final-16x9-prores-422-00-0.jpg",
        "95384b8c": "/media/legacy/95384b8c-maxwell-frank-20210910-10224.jpg",
        "b3c85e73": "/media/legacy/b3c85e73-thumbnail-01.jpg",
        "cb4ee12b": "/media/legacy/cb4ee12b-ridgeline-productions-taillight-image-1.jpg",
        "cf427124": "/media/legacy/cf427124-thumb-1.jpg",
        "cffa3cfa": "/media/legacy/cffa3cfa-wtb-czr-video-tile.jpg",
        "fa0a82ef": "/media/legacy/fa0a82ef-thumb.jpg"
    };
    var RE = /https?:\/\/images\.squarespace-cdn\.com\/content\/v1\/[0-9a-f]+\/([0-9a-f]{8})-[0-9a-f-]+\/[^"'\s?)]+(\?[^"'\s)]*)?/g;
    function swap(str) {
        return str.replace(RE, function (whole, key) { return MAP[key] || whole; });
    }
    // Walks any content object and swaps image URLs in place. Returns the count.
    window.rdglLocalizeImages = function (obj) {
        var n = 0;
        (function walk(o) {
            if (!o || typeof o !== 'object') return;
            Object.keys(o).forEach(function (k) {
                var v = o[k];
                if (typeof v === 'string') {
                    if (v.indexOf('squarespace-cdn.com') !== -1) {
                        var s = swap(v);
                        if (s !== v) { o[k] = s; n++; }
                    }
                } else walk(v);
            });
        })(obj);
        return n;
    };
})();
