const sessao = Sessao.exigir();
let todos = [];

function filtrados() {
    const busca = $('fBusca').value.trim().toLowerCase();
    const cidade = $('fCidade').value;
    const de = $('fDe').value;
    const ate = $('fAte').value;

    return todos.filter((r) =>
        (!busca || `${r.unidade} ${r.cidade} ${r.coletor}`.toLowerCase().includes(busca)) &&
        (!cidade || r.cidade === cidade) &&
        (!de || r.data >= de) &&
        (!ate || r.data <= ate)
    );
}

function renderizar() {
    const lista = filtrados().sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

    $('linhas').innerHTML = lista.map((r) => `
        <tr>
            <td class="c-data">${formatarData(r.data)}<span class="sub">${escapeHtml(r.coletor)}</span></td>
            <td class="c-unidade">${escapeHtml(r.unidade)}</td>
            <td class="c-cidade">${escapeHtml(r.cidade)}</td>
            <td class="c-local"><a href="https://www.google.com/maps?q=${r.latitude},${r.longitude}" target="_blank" rel="noopener">
                ${Number(r.latitude).toFixed(4)}, ${Number(r.longitude).toFixed(4)}</a></td>
            <td class="c-status"><span class="chip ${r.status}">${r.status === 'enviado' ? 'Enviado' : 'Pendente'}</span></td>
            <td class="c-acoes"><div class="acoes-linha"><button class="btn sm" data-det="${r.id}">Detalhe</button><button class="btn sm" data-del="${r.id}">Excluir</button></div></td>
        </tr>`).join('');

    $('vazio').hidden = lista.length > 0;
}

function renderizarResumo() {
    $('stTotal').textContent = todos.length;
    $('stCidades').textContent = new Set(todos.map((r) => r.cidade.toLowerCase())).size;
    $('stUnidades').textContent = new Set(todos.map((r) => r.unidade.toLowerCase())).size;
    $('stPendentes').textContent = todos.filter((r) => r.status === 'pendente').length;

    const atual = $('fCidade').value;
    const cidades = [...new Set(todos.map((r) => r.cidade))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    $('fCidade').innerHTML = '<option value="">Todas as cidades</option>' +
        cidades.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    $('fCidade').value = cidades.includes(atual) ? atual : '';
}

// Uma seção por coleta com fotos, em grade de 4 colunas, abaixo da tabela.
function anexarFotos(doc, lista) {
    const comFotos = lista.filter((r) => r.fotos && r.fotos.length);
    if (!comFotos.length) return;

    const pagW = doc.internal.pageSize.getWidth();
    const pagH = doc.internal.pageSize.getHeight();
    const margem = 40, gap = 10, colunas = 4;
    const celW = (pagW - margem * 2 - gap * (colunas - 1)) / colunas;
    const celH = celW * 0.75;
    const tituloH = 28;

    doc.addPage();
    let y = margem;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(22, 24, 29);
    doc.text('Fotos anexadas', margem, y + 4);
    y += 28;

    for (const r of comFotos) {
        if (y + tituloH + celH > pagH - margem) { doc.addPage(); y = margem; }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(22, 24, 29);
        doc.text(`${r.unidade} · ${r.cidade} · ${formatarData(r.data)}`, margem, y + 10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(110);
        doc.text(`${r.fotos.length} foto(s)`, pagW - margem, y + 10, { align: 'right' });
        y += tituloH;

        r.fotos.forEach((f, i) => {
            const col = i % colunas;
            if (col === 0 && i > 0) y += celH + gap;
            if (col === 0 && y + celH > pagH - margem) { doc.addPage(); y = margem; }

            const props = doc.getImageProperties(f.base64);
            const escala = Math.min(celW / props.width, celH / props.height);
            const w = props.width * escala, h = props.height * escala;
            const x = margem + col * (celW + gap);
            doc.addImage(f.base64, 'JPEG', x + (celW - w) / 2, y + (celH - h) / 2, w, h);
        });
        y += celH + gap * 2;
    }
}

function exportarPdf() {
    const lista = filtrados().sort((x, y) => y.data.localeCompare(x.data));
    if (!lista.length) return toast('Nada para exportar', 'erro');
    if (!window.jspdf) return toast('Biblioteca de PDF indisponível. Conecte-se à internet uma vez.', 'erro');

    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const largura = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Relatório de coletas', 40, 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} por ${sessao.nome} · ${lista.length} registro(s)`, 40, 62);

    doc.autoTable({
        startY: 80,
        margin: { left: 40, right: 40 },
        head: [['Data', 'Unidade', 'Cidade', 'Localização', 'Coletor', 'Status', 'Parecer']],
        body: lista.map((r) => [
            formatarData(r.data), r.unidade, r.cidade,
            `${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}`,
            r.coletor, r.status === 'enviado' ? 'Enviado' : 'Pendente', r.parecer || ''
        ]),
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 6, textColor: [22, 24, 29], lineColor: [230, 230, 225], lineWidth: 0.5 },
        headStyles: { fillColor: [22, 24, 29], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [247, 247, 245] },
        columnStyles: { 0: { cellWidth: 56 }, 3: { cellWidth: 110 }, 5: { cellWidth: 56 }, 6: { cellWidth: 'auto' } },
        didDrawPage: (d) => {
            doc.setFontSize(8);
            doc.setTextColor(140);
            doc.text(`Página ${doc.internal.getNumberOfPages()}`, largura - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
        }
    });

    anexarFotos(doc, lista);

    doc.save(`relatorio-coletas-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function abrirDetalhe(id) {
    const r = todos.find((x) => x.id === id);
    if (!r) return;
    detalheAtual = r;

    $('detTitulo').textContent = r.unidade;
    $('detStatus').className = `chip ${r.status}`;
    $('detStatus').textContent = r.status === 'enviado' ? 'Enviado' : 'Pendente';
    $('detCampos').innerHTML = [
        ['Cidade', escapeHtml(r.cidade)],
        ['Data', formatarData(r.data)],
        ['Coletor', escapeHtml(r.coletor)],
        ['Registrado em', new Date(r.criadoEm).toLocaleString('pt-BR')],
        ['Localização', `<a href="https://www.google.com/maps?q=${r.latitude},${r.longitude}" target="_blank" rel="noopener">
            ${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}</a>${r.precisao ? ` <small>(~${r.precisao} m)</small>` : ''}`]
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('detParecer').textContent = r.parecer || r.observacoes || '—';

    const fotos = r.fotos || [];
    $('detFotosTitulo').textContent = `Fotos (${fotos.length})`;
    $('detFotos').innerHTML = fotos.length
        ? fotos.map((f, i) => `<img src="${f.base64}" alt="Foto ${i + 1}">`).join('')
        : '<p class="sem-fotos">Nenhuma foto anexada.</p>';

    $('modal').hidden = false;
    document.body.style.overflow = 'hidden';
}

let detalheAtual = null;

function textoCompartilhar(r) {
    const linhas = [
        `*Coleta · ${r.unidade}*`,
        `Cidade: ${r.cidade}`,
        `Data: ${formatarData(r.data)}`,
        `Coletor: ${r.coletor}`,
        `Local: https://www.google.com/maps?q=${r.latitude},${r.longitude}`,
        '',
        '*Parecer*',
        r.parecer || r.observacoes || '—'
    ];
    if (r.fotos && r.fotos.length) linhas.push('', `${r.fotos.length} foto(s) anexada(s)`);
    return linhas.join('\n');
}

function base64ParaFile(f, i) {
    const bin = atob(f.base64.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    return new File([bytes], f.nome || `foto-${i + 1}.jpg`, { type: f.tipo || 'image/jpeg' });
}

async function compartilharWhats() {
    const r = detalheAtual;
    if (!r) return;
    const texto = textoCompartilhar(r);

    // Celulares: compartilha texto + fotos pelo menu nativo (inclui WhatsApp)
    const arquivos = (r.fotos || []).map(base64ParaFile);
    if (arquivos.length && navigator.canShare && navigator.canShare({ files: arquivos })) {
        try {
            await navigator.share({ files: arquivos, text: texto, title: `Coleta · ${r.unidade}` });
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
        }
    }
    // Computador / sem suporte: abre o WhatsApp só com o texto
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    if (arquivos.length) toast('Fotos não vão pelo link. Use o PDF ou o celular para enviá-las.');
}

function fecharModal() {
    detalheAtual = null;
    $('modal').hidden = true;
    document.body.style.overflow = '';
}

async function carregar() {
    todos = await Registros.todos();
    renderizarResumo();
    renderizar();
}

async function init() {
    if (!sessao) return;
    montarTopbar('relatorio');
    await carregar();

    ['fBusca', 'fCidade', 'fDe', 'fAte'].forEach((id) => $(id).addEventListener('input', renderizar));
    $('btnPdf').addEventListener('click', exportarPdf);
    $('linhas').addEventListener('click', async (e) => {
        const det = e.target.dataset.det;
        if (det) return abrirDetalhe(Number(det));
        const id = e.target.dataset.del;
        if (!id || !confirm('Excluir esta coleta?')) return;
        await Registros.remover(Number(id));
        await carregar();
    });

    $('modal').addEventListener('click', (e) => {
        if (e.target === $('modal') || e.target.dataset.fechar !== undefined) fecharModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!$('zoom').hidden) $('zoom').hidden = true;
        else fecharModal();
    });
    $('zoom').addEventListener('click', () => { $('zoom').hidden = true; });
    $('btnImprimir').addEventListener('click', () => window.print());
    $('btnWhats').addEventListener('click', compartilharWhats);
    $('detFotos').addEventListener('click', (e) => {
        if (e.target.tagName !== 'IMG') return;
        $('zoomImg').src = e.target.src;
        $('zoom').hidden = false;
    });

    registrarServiceWorker();
}

init();
