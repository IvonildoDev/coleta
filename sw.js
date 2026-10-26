const CACHE = 'coleta-v3';
const LIBS = [
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];
const ARQUIVOS = [
    './', 'index.html', 'principal.html', 'relatorio.html',
    'css/style.css', 'js/common.js', 'js/login.js', 'js/principal.js', 'js/relatorio.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then(async (c) => {
        await c.addAll(ARQUIVOS);
        // bibliotecas de PDF: falha de rede aqui não deve impedir a instalação
        await Promise.allSettled(LIBS.map((u) => c.add(u)));
    }));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    );
    self.clients.claim();
});

// rede primeiro (pega atualizações), cache como fallback offline
self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    const mesmaOrigem = new URL(e.request.url).origin === self.location.origin;
    // no-cache força revalidar com o servidor, evitando JS/CSS antigo do cache HTTP
    e.respondWith(
        fetch(e.request, mesmaOrigem ? { cache: 'no-cache' } : undefined)
            .then((res) => {
                if (res.ok && mesmaOrigem) {
                    const copia = res.clone();
                    caches.open(CACHE).then((c) => c.put(e.request, copia));
                }
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});
