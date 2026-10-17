// Page copy. Replace every [BRACKETED] placeholder with real content.
// `transcript` is what the avatar narrates in the detail view (one entry per sentence/paragraph).

export const profile = {
  name: 'Gifar',
  roles: ['Frontend Developer', 'Creative Technologist'],
  lead: 'I build digital experiences that are simple, useful, and meaningful. Welcome to my 3D portfolio!',
  greeting: 'Hi, I’m Gifar',
  links: [
    { id: 'linkedin', label: 'LinkedIn', href: '#' },   // [YOUR LINKEDIN URL]
    { id: 'github', label: 'GitHub', href: '#' },       // [YOUR GITHUB URL]
    { id: 'email', label: 'Email', href: '#' },         // mailto:[YOUR EMAIL]
  ],
};

export const topics = [
  {
    id: 'about',
    nav: 'About',
    icon: 'user',
    title: 'Who am I?',
    subtitle: 'Get to know me better',
    overline: 'Who am I',
    heading: ['Who ', 'am I?'],
    lead: profile.lead,
    signature: true,
    body: {
      type: 'facts',
      items: [
        { label: 'Based in', value: '[YOUR CITY]' },
        { label: 'Focus', value: '[YOUR FOCUS]' },
        { label: 'Currently', value: '[YOUR ROLE · COMPANY]' },
      ],
    },
    // recorded voice + phoneme timeline, made with: python tts/align.py ... --out web/public/tts/who-am-i
    voice: { audio: '/tts/who-am-i.mp3', lipsync: '/tts/who-am-i.lipsync.json' },
    // must match tts/script/who-am-i.txt line for line (the timeline's sentence timings)
    transcript: [
      'Eh, buset dah, ade yang dateng.',
      'Kenalin, nama gua Gifar Ananda Maulana.',
      'Kepanjangan?',
      'Yaudah, panggil Nanda aja, beres.',
      'Gue tinggal di Tambun, Bekasi nih sekarang.',
      'Kerjaan gue tiap hari mah ngehina pemerintah.',
      'Kaga ade bosennya.',
      'Cita-cita gue pengen jadi orang software engineer.',
      'Bener dah.',
      'Udah, kebanyakan ngomong.',
      'Yuk, kita gas bareng.',
    ],
  },
  {
    id: 'skills',
    nav: 'Skills',
    icon: 'code',
    title: 'Skills & Tools',
    subtitle: 'My tech stack & tools',
    overline: 'Skills & Tools',
    heading: ['What do ', 'I use?'],
    lead: 'I work with modern web technologies and tools that help me build fast, scalable, and maintainable applications.',
    body: {
      type: 'stack',
      groups: [
        { name: 'Frontend', items: [['React', 'react'], ['TypeScript', 'typescript'], ['Tailwind CSS', 'tailwindcss'], ['Vite', 'vite']] },
        { name: 'Backend & Database', items: [['Node.js', 'nodedotjs'], ['Express', 'express'], ['PostgreSQL', 'postgresql'], ['MySQL', 'mysql']] },
        { name: 'Tools & Others', items: [['Git', 'git'], ['Docker', 'docker'], ['VS Code', null], ['Figma', 'figma']] },
      ],
    },
    transcript: [
      'Here are some of the technologies and tools I use in my daily work.',
      'On the frontend, I mainly use React, TypeScript, Tailwind CSS, and Vite. For the backend, I work with Node.js, Express, and PostgreSQL.',
      'I also use tools like Git, Docker, VS Code, and Figma to make my workflow more efficient.',
    ],
  },
  {
    id: 'projects',
    nav: 'Projects',
    icon: 'briefcase',
    title: 'Selected Projects',
    subtitle: 'Things I’ve built',
    overline: 'Selected Projects',
    heading: ['Things I’ve ', 'built'],
    lead: '[1 kalimat pengantar tentang jenis proyek yang Anda kerjakan.]',
    body: {
      type: 'links',
      items: [
        { title: '[PROJECT NAME]', meta: '[Role · Year]', href: '#' },
        { title: '[PROJECT NAME]', meta: '[Role · Year]', href: '#' },
        { title: '[PROJECT NAME]', meta: '[Role · Year]', href: '#' },
      ],
    },
    transcript: ['[Transkrip narasi “Selected Projects”: ceritakan proyek favorit Anda dan peran Anda di dalamnya.]'],
  },
  {
    id: 'journey',
    nav: 'Journey',
    icon: 'map',
    title: 'My Journey',
    subtitle: 'Education & experience',
    overline: 'My Journey',
    heading: ['Education & ', 'experience'],
    lead: '[1 kalimat tentang perjalanan karier Anda.]',
    body: {
      type: 'timeline',
      items: [
        { title: '[ROLE / SCHOOL]', meta: '[YEAR – YEAR]' },
        { title: '[ROLE / SCHOOL]', meta: '[YEAR – YEAR]' },
        { title: '[ROLE / SCHOOL]', meta: '[YEAR – YEAR]' },
      ],
    },
    transcript: ['[Transkrip narasi “My Journey”: pendidikan dan pengalaman kerja Anda secara berurutan.]'],
  },
];

export const topicById = Object.fromEntries(topics.map((t) => [t.id, t]));
