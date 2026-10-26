const sessao = Sessao.exigir();
let fotos = []; // { nome, tipo, base64 }
let coords = null; // { latitude, longitude, precisao }

// ---------- fotos ----------
function comprimirImagem(file, qualidade = 0.7, maxSize = 1280) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                const escala = Math.min(1, maxSize / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * escala);
                canvas.height = Math.round(img.height * escala);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', qualidade));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function renderizarPreview() {
    const el = $('preview');
    el.innerHTML = '';
    fotos.forEach((f, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'thumb';
        wrap.innerHTML = `<img src="${f.base64}" alt="Foto ${i + 1}"><button type="button" aria-label="Remover foto">×</button>`;
        wrap.querySelector('button').addEventListener('click', () => {
            fotos.splice(i, 1);
            renderizarPreview();
        });
        el.appendChild(wrap);
    });
}

async function aoSelecionarFotos(e) {
    for (const file of e.target.files) {
        try {
            fotos.push({ nome: file.name, tipo: 'image/jpeg', base64: await comprimirImagem(file) });
        } catch {
            toast('Não foi possível ler uma das fotos', 'erro');
        }
    }
    e.target.value = '';
    renderizarPreview();
}

// ---------- localização ----------
function resetarLocalizacao() {
    coords = null;
    $('geo').classList.remove('ok');
    $('geoTexto').textContent = 'Nenhuma localização capturada';
    $('geoPrec').textContent = '';
    $('btnLocalizacao').textContent = 'Capturar';
    $('btnLocalizacao').disabled = false;
}

function capturarLocalizacao() {
    if (!navigator.geolocation) return toast('Geolocalização não suportada', 'erro');

    const btn = $('btnLocalizacao');
    btn.disabled = true;
    btn.textContent = 'Buscando...';

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            coords = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                precisao: Math.round(pos.coords.accuracy)
            };
            $('geo').classList.add('ok');
            $('geoTexto').textContent = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
            $('geoPrec').textContent = `Precisão de ~${coords.precisao} m`;
            btn.textContent = 'Atualizar';
            btn.disabled = false;
        },
        (err) => {
            btn.textContent = 'Capturar';
            btn.disabled = false;
            toast(err.code === 1 ? 'Permissão de localização negada' : 'Não foi possível obter a localização', 'erro');
        },
        { enableHighAccuracy: true, timeout: 15000 }
    );
}

// ---------- salvar ----------
async function atualizarPendentes() {
    $('qtdPendentes').textContent = (await Registros.pendentes()).length;
}

async function salvar(e) {
    e.preventDefault();

    const unidade = $('unidade').value.trim();
    const cidade = $('cidade').value.trim();
    const data = $('data').value;
    const parecer = $('parecer').value.trim();
    if (!unidade || !cidade || !data || !parecer) return toast('Preencha unidade, cidade, data e parecer', 'erro');
    if (!coords) return toast('Capture a localização antes de salvar', 'erro');

    const btn = $('btnSalvar');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        await Registros.adicionar({
            uuid: gerarUUID(),
            unidade, cidade, data,
            parecer,
            latitude: coords.latitude,
            longitude: coords.longitude,
            precisao: coords.precisao,
            fotos,
            coletor: sessao.nome,
            status: 'pendente',
            criadoEm: new Date().toISOString()
        });

        $('formulario').reset();
        $('data').value = hoje();
        fotos = [];
        renderizarPreview();
        resetarLocalizacao();
        await atualizarPendentes();
        toast('Coleta salva');

        if (navigator.onLine) await sincronizarTudo();
    } catch (err) {
        console.error(err);
        toast('Erro ao salvar a coleta', 'erro');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar coleta';
    }
}

async function sincronizarTudo() {
    const btn = $('btnSincronizar');
    btn.disabled = true;
    const { total, enviados } = await sincronizar();
    btn.disabled = false;
    await atualizarPendentes();
    if (total === 0) toast('Nada para sincronizar');
    else toast(`${enviados} de ${total} enviado(s)`, enviados < total ? 'erro' : '');
}

function hoje() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
}

// ---------- init ----------
async function init() {
    if (!sessao) return;
    montarTopbar('principal');
    $('usuario').textContent = sessao.nome;
    $('data').value = hoje();
    atualizarChipConexao();
    await atualizarPendentes();

    $('formulario').addEventListener('submit', salvar);
    $('btnLocalizacao').addEventListener('click', capturarLocalizacao);
    $('fotos').addEventListener('change', aoSelecionarFotos);
    $('btnSincronizar').addEventListener('click', sincronizarTudo);

    window.addEventListener('online', () => { atualizarChipConexao(); sincronizarTudo(); });
    window.addEventListener('offline', atualizarChipConexao);

    registrarServiceWorker();
}

init();
