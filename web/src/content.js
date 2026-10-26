// Page copy. Replace every [BRACKETED] placeholder with real content.
// `transcript` is what the avatar narrates in the detail view (one entry per sentence/paragraph).
// English is the base; `translations` override it per language (anything left out stays English).

export const LANGS = ['en', 'id'];

// Interface text outside the topics: page meta, loader, button labels.
const ui = {
  title: 'Giffar · 3D Portfolio',
  description: 'Giffar, a software engineer specializing in frontend, based in Bekasi. This portfolio is a talking 3D avatar built with Three.js and GSAP. Click a topic to hear about my skills, certificates and journey.',
  home: 'Home',
  homeLink: 'GIFFAR, home',
  connect: 'Let’s connect',
  stage: 'Giffar’s 3D avatar. Click the avatar to make it wave.',
  loadingAvatar: 'Loading avatar…',
  loadingAnimations: 'Loading animations…',
  loadFailed: 'Couldn’t load the avatar. Reload the page to try again.',
  openMenu: 'Open menu',
  mute: 'Mute narration',
  unmute: 'Unmute narration',
  play: 'Play narration',
  pause: 'Pause narration',
  subtitles: 'Subtitles',
  language: 'Language',
  viewCertificate: 'View certificate',
  closeCertificate: 'Close certificate',
  chooseCertificate: 'Choose a certificate',
  journeyStops: 'Stops on the road',
};

const profile = {
  name: 'Giffar',
  fullName: 'Giffar Ananda Maulana',   // on the About card
  roles: ['Software Engineer'],
  lead: 'I work as a frontend developer and study Information Systems at the same time, so I’m always learning from both sides.',
  links: [
    { id: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/giffarananda' },
    { id: 'github', label: 'GitHub', href: '#' },       // [YOUR GITHUB URL]
    { id: 'email', label: 'Email', href: '#' },         // mailto:[YOUR EMAIL]
  ],
};

const topics = [
  {
    id: 'about',
    nav: 'About',
    icon: 'user',
    title: 'About Giffar',
    subtitle: 'A 22-second intro, told by the avatar',
    overline: 'Profile',
    lead: profile.lead,
    // an ID badge hanging on a lanyard (ui.js renderIdCard, lanyard.js): the photo, the name and
    // role (profile), then these rows. `lines` are the transcript lines about a row, which light it
    // up while they're spoken; on the `swing` lines (the hello, the welcome) the card swings
    // (same line numbers in every language)
    body: {
      type: 'idcard',
      photo: '/images/avatar-card.webp',
      photoAlt: 'Giffar’s avatar',
      swing: [0, 7],
      items: [
        { icon: 'briefcase', title: 'Dattabot', meta: 'Frontend Developer', lines: [2] },
        { icon: 'graduationCap', title: 'Universitas BSI', meta: 'Active student', lines: [4, 5] },
        { icon: 'mapPin', title: 'Bekasi', meta: 'Indonesia', lines: [3] },
      ],
    },
    // recorded voice + phoneme timeline, made with:
    // python tts/align.py tts/input/about-tts.mp3 --script tts/script/about.txt --out web/public/tts/about --lang en
    // (the older Indonesian sample stays in web/public/tts/who-am-i.*)
    voice: { audio: '/tts/about.mp3', lipsync: '/tts/about.lipsync.json' },
    // must match tts/script/about.txt line for line (the timeline's sentence timings)
    transcript: [
      'Hi, I’m Giffar.',
      'I started out in computer and network engineering.',
      'And now, I build interfaces as a frontend developer at Dattabot.',
      'I’m based in Bekasi, working mostly with React and TypeScript,',
      'while also studying at Universitas BSI,',
      'learning on the job and in class.',
      'One step at a time.',
      'Welcome to my space.',
    ],
  },
  {
    id: 'skills',
    nav: 'Skills',
    icon: 'code',
    title: 'Skills & Tools',
    subtitle: 'React, Express, TypeScript and more',
    overline: 'Skills & Tools',
    heading: ['The daily ', 'stack'],
    lead: 'Learned on the job and in class: React and TypeScript at the core, with Node.js and Express for the server side.',
    // paper memos (ui.js renderStack). `lines` are the transcript lines about a group, which lift its
    // memo while they're spoken (same line numbers in every language); each skill's logo pops as
    // its name is spoken, matched by word (so a skill is named the same way in the transcript)
    body: {
      type: 'stack',
      groups: [
        { name: 'Frontend', lines: [2, 4], items: [['React', 'react'], ['TypeScript', 'typescript'], ['Tailwind CSS', 'tailwindcss'], ['Vite', 'vite']] },
        { name: 'Backend & Database', lines: [3, 5], items: [['Node.js', 'nodedotjs'], ['Express', 'express'], ['PostgreSQL', 'postgresql'], ['MySQL', 'mysql']] },
        { name: 'Tools & Others', lines: [6, 7], items: [['Git', 'git'], ['Docker', 'docker'], ['Linux', 'linux'], ['IDE', null, 'code'], ['AI Agent', null, 'bot']] },
      ],
    },
    // python tts/align.py tts/input/skills-tts.mp3 --script tts/script/skills.txt --out web/public/tts/skills --lang en
    voice: { audio: '/tts/skills.mp3', lipsync: '/tts/skills.lipsync.json' },
    // must match tts/script/skills.txt line for line
    transcript: [
      'So here’s my daily stack.',
      'Everything here, I’ve picked up on the job and in class.',
      'At the core, React and TypeScript.',
      'And for the server side, I work with Node.js and Express.',
      'On the frontend, I use React, TypeScript, Tailwind CSS and Vite.',
      'For backend and databases, it’s Node.js, Express, Postgres and MySQL.',
      'And for everyday tools, there’s Git, Docker, Linux, my trusty IDE,',
      'and of course, AI agents to help me work a little smarter.',
      'That’s it, my everyday toolkit.',
    ],
  },
  {
    // id stays 'projects': the home card positions in style.css and the #/projects link key off it
    id: 'projects',
    nav: 'Certificates',
    icon: 'award',
    title: 'Licenses & Certifications',
    subtitle: 'BNSP, VSGA and Harisenin, each one linked',
    overline: 'Licenses & Certifications',
    heading: ['Still ', 'curious'],
    lead: 'On the job, in class, and through programs like these.',
    // a fanned card deck (ui.js renderCerts), in the order earned.
    // `width`/`height` are the scan's pixels (/certs); `lines` are the transcript lines about it,
    // which bring its card to the front while they're spoken (same line numbers in every language)
    body: {
      type: 'certs',
      items: [
        { short: 'VSGA', title: 'Junior Web Developer Training', meta: 'VSGA · Kominfo Digital Talent · 2022 · 90 hours', src: '/certs/vsga-junior-web-developer.webp', width: 1600, height: 1131, lines: [3], alt: 'VSGA Junior Web Developer training certificate from Politeknik Negeri Media Kreatif, Digital Talent Scholarship 2022' },
        { short: 'BNSP', title: 'Junior Web Developer Competency', meta: 'BNSP · LSP Teknologi Digital · Valid 2022–2025', src: '/certs/bnsp-junior-web-developer.webp', width: 1132, height: 1600, lines: [2], alt: 'BNSP certificate of competence for Junior Web Developer, issued 31 October 2022' },
        { short: 'Harisenin', title: 'Full Stack Developer Program', meta: 'Harisenin.com · Feb–May 2023', src: '/certs/harisenin-full-stack-developer.webp', width: 689, height: 495, lines: [4], alt: 'Harisenin.com certificate of completion for the Full Stack Developer program, February to May 2023' },
      ],
    },
    // python tts/align.py tts/input/certs-tts.mp3 --script tts/script/certs.txt --out web/public/tts/certs --lang en
    voice: { audio: '/tts/certs.mp3', lipsync: '/tts/certs.lipsync.json' },
    // must match tts/script/certs.txt line for line; the narration names BNSP first, then VSGA and Harisenin
    transcript: [
      'Still curious? Me too.',
      'I keep learning, on the job, in class, and through programs like these.',
      'One of them is my Junior Web Developer competency, certified by BNSP through LSP Digital Technology.',
      'Before that, I also joined VSGA, a Digital Talent training program,',
      'and completed an intensive bootcamp with Harisenin.',
      'Each certificate here is a small milestone,',
      'proof that I’m still growing, one step at a time.',
      'Feel free to take a closer look.',
    ],
  },
  {
    id: 'journey',
    nav: 'Journey',
    icon: 'map',
    title: 'My Journey',
    subtitle: 'Education & experience',
    overline: 'My Journey',
    heading: ['The road ', 'so far'],
    lead: 'From SMK Binakarya Mandiri in 2018 to Dattabot and Universitas BSI today.',
    // a trail on a paper map (ui.js renderTrail), oldest first. `lines` are the transcript lines
    // about a stop, which light it up while they're spoken (same line numbers in every language);
    // `now` marks what is still going on; `traveler` is the face that walks the trail (traveler.js)
    body: {
      type: 'trail',
      traveler: '/images/avatar-card.webp',
      items: [
        { icon: 'bookOpen', title: 'SMK Binakarya Mandiri', meta: 'Computer & Network Engineering', years: '2018 – 2021', lines: [1] },
        { icon: 'landmark', title: 'Politeknik Negeri Jakarta', meta: 'Computer & Network Engineering', years: '2021 – 2022', lines: [2] },
        { icon: 'laptop', title: 'Harisenin', meta: 'Full Stack Developer bootcamp', years: '2023', lines: [3] },
        { icon: 'briefcase', title: 'Dattabot', meta: 'Frontend Developer', years: '2023 – now', now: true, lines: [4] },
        { icon: 'graduationCap', title: 'Universitas BSI', meta: 'Information Systems', years: '2026 – now', now: true, lines: [5] },
      ],
    },
    // python tts/align.py tts/input/journey-tts.mp3 --script tts/script/journey.txt --out web/public/tts/journey --lang en
    voice: { audio: '/tts/journey.mp3', lipsync: '/tts/journey.lipsync.json' },
    // must match tts/script/journey.txt line for line (the years are spelled out so the mouth moves)
    transcript: [
      'So, how did I get here?',
      'It started at SMK Binakarya Mandiri in twenty eighteen,',
      'then Politeknik Negeri Jakarta.',
      'In twenty twenty-three, a bootcamp at Harisenin,',
      'and my first role at Dattabot.',
      'Now, I’m also studying at Universitas BSI.',
      'The road so far, and it’s just getting started.',
      'Say hi!',
    ],
  },
];

const translations = {
  id: {
    ui: {
      title: 'Giffar · Portofolio 3D',
      description: 'Giffar, software engineer dengan fokus frontend, berbasis di Bekasi. Portofolio ini berupa avatar 3D yang bisa berbicara, dibangun dengan Three.js dan GSAP. Klik sebuah topik untuk mendengar tentang keahlian, sertifikat, dan perjalanan kariernya.',
      home: 'Beranda',
      homeLink: 'GIFFAR, beranda',
      connect: 'Mari terhubung',
      stage: 'Avatar 3D Giffar. Klik avatarnya untuk membuatnya melambai.',
      loadingAvatar: 'Memuat avatar…',
      loadingAnimations: 'Memuat animasi…',
      loadFailed: 'Avatar gagal dimuat. Muat ulang halaman untuk mencoba lagi.',
      openMenu: 'Buka menu',
      mute: 'Matikan suara narasi',
      unmute: 'Nyalakan suara narasi',
      play: 'Putar narasi',
      pause: 'Jeda narasi',
      subtitles: 'Subtitle',
      language: 'Bahasa',
      viewCertificate: 'Lihat sertifikat',
      closeCertificate: 'Tutup sertifikat',
      chooseCertificate: 'Pilih sertifikat',
      journeyStops: 'Titik perjalanan',
    },
    profile: {
      lead: 'Aku bekerja sebagai frontend developer sambil kuliah Sistem Informasi, jadi aku terus belajar dari dua sisi.',
    },
    topics: {
      about: {
        nav: 'Tentang',
        title: 'Tentang Giffar',
        subtitle: 'Perkenalan 28 detik, langsung dari avatar',
        overline: 'Profil',
        body: {
          type: 'idcard',
          photo: '/images/avatar-card.webp',
          photoAlt: 'Avatar Giffar',
          swing: [0, 7],
          items: [
            { icon: 'briefcase', title: 'Dattabot', meta: 'Frontend Developer', lines: [2] },
            { icon: 'graduationCap', title: 'Universitas BSI', meta: 'Mahasiswa aktif', lines: [4, 5] },
            { icon: 'mapPin', title: 'Bekasi', meta: 'Indonesia', lines: [3] },
          ],
        },
        // python tts/align.py tts/input/about-tts-id.mp3 --script tts/script/about-id.txt --out web/public/tts/about-id --lang id
        voice: { audio: '/tts/about-id.mp3', lipsync: '/tts/about-id.lipsync.json' },
        // must match tts/script/about-id.txt line for line
        transcript: [
          'Halo, aku Giffar.',
          'Aku memulai perjalanan dari teknik komputer dan jaringan.',
          'Dan sekarang, aku membangun tampilan antarmuka sebagai frontend developer di Dattabot.',
          'Aku tinggal di Bekasi, sehari-hari aku banyak bekerja dengan React dan TypeScript.',
          'Sambil tetap kuliah di Universitas BSI,',
          'belajar sambil bekerja dan juga di kelas.',
          'Selangkah demi selangkah.',
          'Selamat datang di ruang kecilku.',
        ],
      },
      skills: {
        nav: 'Keahlian',
        title: 'Keahlian & Tools',
        subtitle: 'React, Express, TypeScript, dan lainnya',
        overline: 'Keahlian & Tools',
        heading: ['Stack ', 'harian'],
        lead: 'Dipelajari di tempat kerja dan di kelas: React dan TypeScript sebagai inti, dengan Node.js dan Express untuk sisi server.',
        // python tts/align.py tts/input/skills-tts-id.mp3 --script tts/script/skills-id.txt --out web/public/tts/skills-id --lang id
        voice: { audio: '/tts/skills-id.mp3', lipsync: '/tts/skills-id.lipsync.json' },
        // must match tts/script/skills-id.txt line for line
        transcript: [
          'Nah, ini dia, stack harianku.',
          'Semuanya aku pelajari sambil kerja dan juga di kelas.',
          'Intinya, React dan TypeScript.',
          'Terus buat sisi server, aku pakai Node.js dan Express.',
          'Di bagian frontend, ada React, TypeScript, Tailwind CSS, dan Vite.',
          'Untuk backend dan database, aku pakai Node.js, Express, Postgres, sama MySQL.',
          'Terus buat tools lainnya, ada Git, Docker, Linux, IDE kesayangan,',
          'dan tentu saja, AI agent yang bantu kerjaanku jadi lebih cepat.',
          'Itu dia, teman-teman setiaku tiap hari.',
        ],
      },
      projects: {
        nav: 'Sertifikat',
        title: 'Lisensi & Sertifikasi',
        subtitle: 'BNSP, VSGA, dan Harisenin, lengkap dengan tautan',
        overline: 'Lisensi & Sertifikasi',
        heading: ['Yang sudah ', 'kuraih'],
        lead: 'Di tempat kerja, di kelas, dan lewat program seperti ini.',
        body: {
          type: 'certs',
          items: [
            { short: 'VSGA', title: 'Pelatihan Junior Web Developer', meta: 'VSGA · Kominfo Digital Talent · 2022 · 90 jam', src: '/certs/vsga-junior-web-developer.webp', width: 1600, height: 1131, lines: [3], alt: 'Sertifikat pelatihan VSGA Junior Web Developer dari Politeknik Negeri Media Kreatif, Digital Talent Scholarship 2022' },
            { short: 'BNSP', title: 'Sertifikat Kompetensi Junior Web Developer', meta: 'BNSP · LSP Teknologi Digital · Berlaku 2022–2025', src: '/certs/bnsp-junior-web-developer.webp', width: 1132, height: 1600, lines: [2], alt: 'Sertifikat kompetensi BNSP Junior Web Developer, terbit 31 Oktober 2022' },
            { short: 'Harisenin', title: 'Program Full Stack Developer', meta: 'Harisenin.com · Feb–Mei 2023', src: '/certs/harisenin-full-stack-developer.webp', width: 689, height: 495, lines: [4], alt: 'Sertifikat kelulusan program Full Stack Developer dari Harisenin.com, Februari sampai Mei 2023' },
          ],
        },
        // python tts/align.py tts/input/certs-tts-id.mp3 --script tts/script/certs-id.txt --out web/public/tts/certs-id --lang id
        voice: { audio: '/tts/certs-id.mp3', lipsync: '/tts/certs-id.lipsync.json' },
        // must match tts/script/certs-id.txt line for line
        transcript: [
          'Masih penasaran? Aku juga kok.',
          'Aku terus belajar dari tempat kerja, dari kelas, dan juga lewat program-program seperti ini.',
          'Salah satunya, Sertifikasi Kompetensi Junior Web Developer dari BNSP lewat LSP Teknologi Digital.',
          'Selain itu, aku juga ikut pelatihan VSGA',
          'dan menyelesaikan bootcamp intensif di Harisenin.',
          'Buat aku, setiap sertifikat ini adalah langkah kecil.',
          'Bukti kalau aku masih terus berkembang, pelan-pelan, tapi pasti.',
          'Silakan, lihat-lihat dulu.',
        ],
      },
      journey: {
        nav: 'Perjalanan',
        title: 'Perjalanan Saya',
        subtitle: 'Pendidikan & pengalaman',
        overline: 'Perjalanan Saya',
        heading: ['Sejauh ', 'ini'],
        lead: 'Dari SMK Binakarya Mandiri di 2018 sampai Dattabot dan Universitas BSI hari ini.',
        body: {
          type: 'trail',
          traveler: '/images/avatar-card.webp',
          items: [
            { icon: 'bookOpen', title: 'SMK Binakarya Mandiri', meta: 'Teknik Komputer dan Jaringan', years: '2018 – 2021', lines: [1] },
            { icon: 'landmark', title: 'Politeknik Negeri Jakarta', meta: 'Teknik Komputer dan Jaringan', years: '2021 – 2022', lines: [2] },
            { icon: 'laptop', title: 'Harisenin', meta: 'Bootcamp Full Stack Developer', years: '2023', lines: [3] },
            { icon: 'briefcase', title: 'Dattabot', meta: 'Frontend Developer', years: '2023 – sekarang', now: true, lines: [4] },
            { icon: 'graduationCap', title: 'Universitas BSI', meta: 'Sistem Informasi', years: '2026 – sekarang', now: true, lines: [5] },
          ],
        },
        // python tts/align.py tts/input/journey-tts-id.mp3 --script tts/script/journey-id.txt --out web/public/tts/journey-id --lang id
        voice: { audio: '/tts/journey-id.mp3', lipsync: '/tts/journey-id.lipsync.json' },
        // must match tts/script/journey-id.txt line for line
        transcript: [
          'Terus, gimana aku bisa sampai sini?',
          'Mulai dari SMK Binakarya Mandiri tahun dua ribu delapan belas.',
          'Lalu lanjut ke Politeknik Negeri Jakarta.',
          'Tahun dua ribu dua puluh tiga, ikut bootcamp di Harisenin',
          'dan mulai kerja di Dattabot.',
          'Sekarang, aku juga kuliah di Universitas BSI.',
          'Perjalananku sejauh ini, dan ini baru permulaan.',
          'Sapa aku, ya!',
        ],
      },
    },
  },
};

// The page copy in one language: { lang, ui, profile, topics, topicById }.
export function contentFor(lang) {
  const tr = translations[lang] ?? {};
  const p = { ...profile, ...tr.profile };
  const list = topics.map((t) => {
    const merged = { ...t, ...tr.topics?.[t.id] };
    if (t.id === 'about' && !tr.topics?.about?.lead) merged.lead = p.lead;
    return merged;
  });
  return { lang, ui: { ...ui, ...tr.ui }, profile: p, topics: list, topicById: Object.fromEntries(list.map((t) => [t.id, t])) };
}
