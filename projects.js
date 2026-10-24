/* Shared project data — fallback used if data-loader.js hasn't hydrated window.projects yet.
   data-loader.js fetches /data/content.json (or /api/content?draft=1) and overwrites window.projects. */

const _legacyProjects = {
    'rabbit-cadence': {
        client: 'rabbit',
        title: 'Cadence Kit',
        type: 'Commercial / Product',
        year: '2024',
        vimeo: '1165842696',
        thumb: `/media/legacy/9282ce5b-60-sec-rabbit-cadence-kit-edit-v9-final-16x9-prores-422-00-0.jpg`,
        description: 'A high-energy product launch film for rabbit\'s Cadence Kit, blending cinematic storytelling with sleek product visuals to capture the spirit of movement and rhythm.',
        credits: [
            { role: 'Production Company', name: 'Ridgeline Productions' },
            { role: 'Director', name: 'Tye French' },
            { role: 'DP', name: 'Maxwell Frank' },
            { role: '1st AC', name: 'Mark Romanov' },
            { role: 'Gaffer', name: 'Brady Berryhill' },
            { role: 'Editor', name: 'Tye French' },
            { role: 'Color', name: 'Ian Matthews' },
            { role: 'Sound Design & Mix', name: 'Polaire Audio' },
            { role: 'VFX + Compositing', name: 'James Prola' },
            { role: 'Talent', name: 'Sam Box & Isabela Zawistowska' },
        ],
        bts: [
            { label: 'On set with talent', img: `/media/legacy/9282ce5b-60-sec-rabbit-cadence-kit-edit-v9-final-16x9-prores-422-00-0.jpg` },
            { label: 'Lighting setup', img: `/media/legacy/4f343d97-travel-reel-edit-v10-white-00-00-16-18-still001.jpg` },
            { label: 'Product detail shot', img: `/media/legacy/58aa37e8-rabbit-high-country-ridgeline-productions.jpg` },
        ],
        gallery: [
            `/media/legacy/9282ce5b-60-sec-rabbit-cadence-kit-edit-v9-final-16x9-prores-422-00-0.jpg`,
            `/media/legacy/58aa37e8-rabbit-high-country-ridgeline-productions.jpg`,
        ]
    },
    'hoka-transport': {
        client: 'Hoka',
        title: 'Transport GTX',
        type: 'Commercial / Lifestyle',
        year: '2024',
        vimeo: '1145515475',
        vimeoHash: '5a6661faac',
        thumb: `/media/legacy/91728399-hoka-transport-gtx-thumbnail-webpage.jpg`,
        description: 'An authentic lifestyle campaign for Hoka\'s Transport GTX, shot across urban and natural landscapes to showcase the shoe\'s versatility from city streets to mountain trails.',
        credits: [
            { role: 'Production Company', name: 'BaM Productions & Ridgeline' },
            { role: 'Director', name: 'Tye French' },
            { role: 'DP', name: 'Maxwell Frank' },
            { role: '1st AC', name: 'Kirk Nakamura' },
            { role: 'Talent', name: 'Boo Johnson, Karli Lar Durden, Andrew Garner, Kat Lam' },
            { role: 'Colorist', name: 'Ian Matthews Color' },
        ],
        bts: [
            { label: 'Location scout', img: `/media/legacy/91728399-hoka-transport-gtx-thumbnail-webpage.jpg` },
            { label: 'Steadicam prep', img: `/media/legacy/b3c85e73-thumbnail-01.jpg` },
        ],
        gallery: [
            `/media/legacy/91728399-hoka-transport-gtx-thumbnail-webpage.jpg`,
            `/media/legacy/b3c85e73-thumbnail-01.jpg`,
        ]
    },
    'giant-recon': {
        client: 'Giant Bicycles',
        title: 'Recon+ Taillight',
        type: 'Product / Commercial',
        year: '2024',
        vimeo: '1100710110',
        thumb: `/media/legacy/cb4ee12b-ridgeline-productions-taillight-image-1.jpg`,
        description: 'A sleek product film for Giant\'s Recon+ Taillight, combining dramatic night cinematography with precision product shots to highlight safety innovation.',
        credits: [
            { role: 'Production Company', name: 'Ridgeline Productions' },
            { role: 'Producer', name: 'Philip Jankoski' },
            { role: 'Director', name: 'Tye French' },
            { role: 'DP', name: 'Tate Larick' },
            { role: '1st AC', name: 'Kirk Nakamura' },
            { role: 'Editor', name: 'James Prola' },
            { role: 'Photographer', name: 'Maxwell Frank' },
            { role: 'Talent', name: 'Huy Doan' },
        ],
        bts: [
            { label: 'Night shoot setup', img: `/media/legacy/cb4ee12b-ridgeline-productions-taillight-image-1.jpg` },
            { label: 'Product rigging', img: `/media/legacy/95384b8c-maxwell-frank-20210910-10224.jpg` },
        ],
        gallery: [
            `/media/legacy/cb4ee12b-ridgeline-productions-taillight-image-1.jpg`,
            `/media/legacy/95384b8c-maxwell-frank-20210910-10224.jpg`,
        ]
    },
    'rabbit-highcountry': {
        client: 'rabbit',
        title: 'High Country',
        type: 'Adventure / Brand Film',
        year: '2024',
        vimeo: '1096761450',
        thumb: `/media/legacy/58aa37e8-rabbit-high-country-ridgeline-productions.jpg`,
        description: 'An immersive brand film following runners into the mountains, capturing the raw beauty and endurance of high-altitude trail running for rabbit.',
        credits: [
            { role: 'Production Company', name: 'Ridgeline Productions' },
            { role: 'Director', name: 'Tye French' },
            { role: 'DP', name: 'Maxwell Frank' },
            { role: 'Colorist', name: 'Ian Matthews Color' },
        ],
        bts: [
            { label: 'Mountain trail', img: `/media/legacy/58aa37e8-rabbit-high-country-ridgeline-productions.jpg` },
            { label: 'Golden hour', img: `/media/legacy/95384b8c-maxwell-frank-20210910-10224.jpg` },
            { label: 'Running shots', img: `/media/legacy/4f343d97-travel-reel-edit-v10-white-00-00-16-18-still001.jpg` },
        ],
        gallery: [
            `/media/legacy/58aa37e8-rabbit-high-country-ridgeline-productions.jpg`,
            `/media/legacy/95384b8c-maxwell-frank-20210910-10224.jpg`,
            `/media/legacy/4f343d97-travel-reel-edit-v10-white-00-00-16-18-still001.jpg`,
        ]
    },
    'lexus-gx': {
        client: 'Lexus',
        title: 'GX 550',
        type: 'Automotive / Commercial',
        year: '2024',
        vimeo: '1001449124',
        vimeoHash: 'b530c58300',
        thumb: `/media/legacy/cf427124-thumb-1.jpg`,
        description: 'A cinematic automotive spot for the Lexus GX 550, featuring sweeping desert landscapes and dynamic driving sequences with Frieda Pinto.',
        credits: [
            { role: 'Production Company', name: 'Outside Interactive, Inc.' },
            { role: 'Director', name: 'Brian Syzmanski' },
            { role: 'DP', name: 'Tory Power & Colin Witherill' },
            { role: 'Camera Car', name: 'Ridgeline Productions' },
            { role: 'Sound', name: 'Dave Girtsman' },
            { role: 'Talent', name: 'Frieda Pinto & Cory Tran' },
        ],
        bts: [
            { label: 'Camera car rig', img: `/media/legacy/cf427124-thumb-1.jpg` },
            { label: 'Desert location', img: `/media/legacy/572345b8-thumb.png` },
        ],
        gallery: [
            `/media/legacy/cf427124-thumb-1.jpg`,
            `/media/legacy/572345b8-thumb.png`,
        ]
    },
    'seek-thermal': {
        client: 'Seek Thermal',
        title: 'Reveal Fire Pro',
        type: 'Product / Tech',
        year: '2023',
        vimeo: '1064896236',
        vimeoHash: 'c797bec601',
        thumb: `/media/legacy/fa0a82ef-thumb.jpg`,
        description: 'A technical product film showcasing Seek Thermal\'s Reveal Fire Pro, combining dramatic fire scenarios with precise product demonstrations.',
        credits: [
            { role: 'Production Company', name: 'Venture Visuals' },
            { role: 'DP', name: 'Maxwell Frank' },
            { role: 'AC', name: 'Sam Hall' },
        ],
        bts: [
            { label: 'Fire scene', img: `/media/legacy/fa0a82ef-thumb.jpg` },
        ],
        gallery: [
            `/media/legacy/fa0a82ef-thumb.jpg`,
        ]
    },
    'masimo-mightysat': {
        client: 'Masimo',
        title: 'MightySat',
        type: 'Commercial / Health Tech',
        year: '2023',
        vimeo: '814794438',
        thumb: `/media/legacy/490c06c5-masimo.jpg`,
        description: 'A commercial spot for Masimo\'s MightySat pulse oximeter, featuring athletes Tommy Hass and Taylor Fritz to demonstrate peak performance monitoring.',
        credits: [
            { role: 'Agency', name: 'Veracity Colab' },
            { role: 'Production Company', name: 'Venture Visuals' },
            { role: 'Producer', name: 'Jake Wasserman' },
            { role: 'Director', name: 'Thomas Kranzle' },
            { role: 'DP', name: 'Tye French' },
            { role: 'Talent', name: 'Tommy Hass & Taylor Fritz' },
        ],
        bts: [
            { label: 'Studio setup', img: `/media/legacy/490c06c5-masimo.jpg` },
            { label: 'Athlete on set', img: `/media/legacy/b3c85e73-thumbnail-01.jpg` },
        ],
        gallery: [
            `/media/legacy/490c06c5-masimo.jpg`,
            `/media/legacy/b3c85e73-thumbnail-01.jpg`,
        ]
    },
    'hoka-carbon': {
        client: 'Hoka',
        title: 'Carbon X2',
        type: 'Sport / Product',
        year: '2023',
        vimeo: '1064900400',
        vimeoHash: 'b897e45d4b',
        thumb: `/media/legacy/b3c85e73-thumbnail-01.jpg`,
        description: 'A dynamic product film for Hoka\'s Carbon X2 racing shoe, capturing speed and precision on the track.',
        credits: [
            { role: 'Director / DP', name: 'Maxwell Frank' },
        ],
        bts: [
            { label: 'Track shoot', img: `/media/legacy/b3c85e73-thumbnail-01.jpg` },
        ],
        gallery: [
            `/media/legacy/b3c85e73-thumbnail-01.jpg`,
        ]
    },
    'wtb-tread': {
        client: 'WTB & Kona Bicycles',
        title: 'Leaving a Tread',
        type: 'Documentary / Cycling',
        year: '2023',
        vimeo: '1067859697',
        vimeoHash: 'c7fe926db5',
        thumb: `/media/legacy/51d2e274-thumb-2.jpg`,
        description: 'A documentary following rider Israel Carrillo on a personal journey through trail and terrain, produced in partnership with WTB and Kona Bicycles.',
        credits: [
            { role: 'Production Company', name: 'Ridgeline Productions' },
            { role: 'Producer', name: 'Becky Gardner' },
            { role: 'Director / DP', name: 'Maxwell Frank' },
            { role: 'Talent', name: 'Israel Carrillo' },
        ],
        bts: [
            { label: 'Trail riding', img: `/media/legacy/51d2e274-thumb-2.jpg` },
            { label: 'Interview setup', img: `/media/legacy/95384b8c-maxwell-frank-20210910-10224.jpg` },
            { label: 'Drone shot prep', img: `/media/legacy/cffa3cfa-wtb-czr-video-tile.jpg` },
        ],
        gallery: [
            `/media/legacy/51d2e274-thumb-2.jpg`,
            `/media/legacy/95384b8c-maxwell-frank-20210910-10224.jpg`,
            `/media/legacy/cffa3cfa-wtb-czr-video-tile.jpg`,
        ]
    },
    'liv-avow': {
        client: 'Liv Cycling',
        title: 'Avow',
        type: 'Sport / Commercial',
        year: '2023',
        vimeo: '1065668595',
        vimeoHash: '5d68b75758',
        thumb: `/media/legacy/3b9a8747-thumb.jpg`,
        description: 'A high-performance commercial for Liv Cycling\'s Avow triathlon bike, filmed in the velodrome with precision camera work.',
        credits: [
            { role: 'Production Company', name: 'Ridgeline Productions' },
            { role: 'Director', name: 'Tye French' },
            { role: 'DP', name: 'Maxwell Frank' },
            { role: 'Gaffer', name: 'Brady Berryhill' },
            { role: 'Colorist', name: 'Ian Matthews Color' },
        ],
        bts: [
            { label: 'Velodrome', img: `/media/legacy/3b9a8747-thumb.jpg` },
            { label: 'Bike prep', img: `/media/legacy/cb4ee12b-ridgeline-productions-taillight-image-1.jpg` },
        ],
        gallery: [
            `/media/legacy/3b9a8747-thumb.jpg`,
            `/media/legacy/cb4ee12b-ridgeline-productions-taillight-image-1.jpg`,
        ]
    },
    'wtb-czr': {
        client: 'WTB',
        title: 'CZR Wheels',
        type: 'Product / Cycling',
        year: '2023',
        vimeo: '1064899375',
        thumb: `/media/legacy/cffa3cfa-wtb-czr-video-tile.jpg`,
        description: 'A product showcase for WTB\'s CZR wheel line, highlighting engineering and performance through dynamic riding footage.',
        credits: [
            { role: 'Producer', name: 'Becky Gardner' },
            { role: 'Director / DP', name: 'Maxwell Frank' },
            { role: 'Editor', name: 'Ridgeline Productions' },
        ],
        bts: [
            { label: 'Wheel detail', img: `/media/legacy/cffa3cfa-wtb-czr-video-tile.jpg` },
        ],
        gallery: [
            `/media/legacy/cffa3cfa-wtb-czr-video-tile.jpg`,
        ]
    },
};

// Expose as window-scoped fallback. data-loader.js may replace this with fetched content.
if (!window.projects || Object.keys(window.projects).length === 0) {
    window.projects = _legacyProjects;
}
// Back-compat aliases for legacy consumers that read these top-level identifiers.
const projects = window.projects;
const projectKeys = Object.keys(projects);
