// ===================== BANCO LOCAL (IndexedDB) =====================
const DB_NAME = 'ColetaDB';
const DB_VERSION = 1;
const STORE = 'registros';

let _db = null;

function abrirBanco() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains(STORE)) {
                const s = d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
                s.createIndex('status', 'status');
                s.createIndex('uuid', 'uuid', { unique: true });
            }
        };
        req.onsuccess = () => { _db = req.result; resolve(_db); };
        req.onerror = () => reject(req.error);
    });
}

async function dbRequest(modo, fn) {
    const d = await abrirBanco();
    return new Promise((resolve, reject) => {
        const store = d.transaction(STORE, modo).objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

const Registros = {
    adicionar: (dados) => dbRequest('readwrite', (s) => s.add(dados)),
    todos: () => dbRequest('readonly', (s) => s.getAll()),
    pendentes: () => dbRequest('readonly', (s) => s.index('status').getAll('pendente')),
    remover: (id) => dbRequest('readwrite', (s) => s.delete(id)),
    async marcarEnviado(id) {
        const r = await dbRequest('readonly', (s) => s.get(id));
        if (!r) return;
        r.status = 'enviado';
        await dbRequest('readwrite', (s) => s.put(r));
    }
};

// ===================== SESSÃO (mock — trocar pelo backend) =====================
const SESSAO_KEY = 'coleta.sessao';

const Sessao = {
    obter() {
        try { return JSON.parse(localStorage.getItem(SESSAO_KEY)); } catch { return null; }
    },
    entrar(usuario) {
        localStorage.setItem(SESSAO_KEY, JSON.stringify(usuario));
    },
    sair() {
        localStorage.removeItem(SESSAO_KEY);
        location.href = 'index.html';
    },
    exigir() {
        const s = this.obter();
        if (!s) { location.replace('index.html'); return null; }
        return s;
    }
};

// ===================== SINCRONIZAÇÃO =====================
async function sincronizar() {
    const pendentes = await Registros.pendentes();
    let enviados = 0;
    for (const item of pendentes) {
        try {
            // BACKEND: substituir pela chamada real, ex.:
            // const res = await fetch('/api/registros', {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify(item)
            // });
            // if (!res.ok) throw new Error('Falha no envio');
            await new Promise((r) => setTimeout(r, 300));
            await Registros.marcarEnviado(item.id);
            enviados++;
        } catch (err) {
            console.error('Erro ao enviar', item.uuid, err);
        }
    }
    return { total: pendentes.length, enviados };
}

// ===================== UI =====================
function $(id) { return document.getElementById(id); }

function gerarUUID() {
    return crypto.randomUUID ? crypto.randomUUID() :
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 3 | 8)).toString(16);
        });
}

function escapeHtml(t) {
    return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatarData(iso) {
    if (!iso) return '—';
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
}

let _toastTimer;
function toast(texto, tipo = '') {
    let el = $('toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        document.body.appendChild(el);
    }
    el.className = `toast ${tipo}`;
    el.textContent = texto;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function atualizarChipConexao() {
    const el = $('conexao');
    if (!el) return;
    const on = navigator.onLine;
    el.textContent = on ? 'Online' : 'Offline';
    el.className = `chip ${on ? 'online' : 'offline'}`;
}

function montarTopbar(ativo) {
    const s = Sessao.obter();
    const el = $('topbar');
    if (!el || !s) return;
    el.innerHTML = `
        <div class="brand">
            <span class="brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.800 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg></span>
            Coleta
        </div>
        <nav class="nav">
            <a href="principal.html" class="${ativo === 'principal' ? 'ativo' : ''}">Coletar</a>
            <a href="relatorio.html" class="${ativo === 'relatorio' ? 'ativo' : ''}">Relatório</a>
            <button type="button" id="btnSair">Sair</button>
        </nav>`;
    $('btnSair').addEventListener('click', () => Sessao.sair());
    montarRodape(ativo);
}

function montarRodape(ativo) {
    if ($('rodape')) return;
    const icone = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    const el = document.createElement('nav');
    el.id = 'rodape';
    el.className = 'bottom-nav';
    el.setAttribute('aria-label', 'Navegação principal');
    el.innerHTML = `
        <a href="principal.html" class="${ativo === 'principal' ? 'ativo' : ''}">
            ${icone('<path d="M12 5v14M5 12h14"/>')}<span>Coletar</span>
        </a>
        <a href="relatorio.html" class="${ativo === 'relatorio' ? 'ativo' : ''}">
            ${icone('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>')}<span>Relatório</span>
        </a>
        <button type="button" id="btnSairRodape">
            ${icone('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>')}<span>Sair</span>
        </button>`;
    document.body.appendChild(el);
    $('btnSairRodape').addEventListener('click', () => Sessao.sair());
}

function registrarServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch((e) => console.log('SW:', e));
    }
}
