// Carregado no <head> (sem defer) para aplicar o tema antes da página aparecer.
const Tema = (() => {
    const KEY = 'coleta.tema';
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    const salvo = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

    function aplicar(tema) {
        document.documentElement.setAttribute('data-theme', tema);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = tema === 'dark' ? '#0e0f12' : '#f7f7f5';
    }

    function atual() {
        return document.documentElement.getAttribute('data-theme') || (mq.matches ? 'dark' : 'light');
    }

    function alternar() {
        const novo = atual() === 'dark' ? 'light' : 'dark';
        aplicar(novo);
        try { localStorage.setItem(KEY, novo); } catch { /* sem armazenamento: vale só nesta visita */ }
    }

    // sem escolha do usuário, acompanha o sistema
    aplicar(salvo() || (mq.matches ? 'dark' : 'light'));
    mq.addEventListener('change', (e) => { if (!salvo()) aplicar(e.matches ? 'dark' : 'light'); });

    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-tema-toggle]')) alternar();
    });

    const icones = `
        <svg class="i-lua" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
        <svg class="i-sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;

    return { alternar, atual, botao: (extra = '') =>
        `<button type="button" class="btn-tema ${extra}" data-tema-toggle aria-label="Alternar tema claro/escuro" title="Alternar tema">${icones}</button>` };
})();
