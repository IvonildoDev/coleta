# Coleta — Guia do projeto e integração com backend

Aplicação web (PWA) para coletar **unidade, cidade, data, localização GPS, parecer e fotos**, com funcionamento offline. Hoje é só frontend: os dados ficam no navegador (IndexedDB) e o login é simulado. Este documento explica cada arquivo e o que falta para ligar um backend.

## 1. Estrutura de arquivos

```
Beno/
├── index.html        Tela de login
├── principal.html    Tela de nova coleta
├── relatorio.html    Tela de relatório (lista, filtros, detalhe, PDF)
├── manifest.json     Metadados de instalação do PWA
├── sw.js             Service worker (cache e uso offline)
├── css/
│   └── style.css     Estilos de todas as telas (claro/escuro, mobile)
└── js/
    ├── common.js     Banco local, sessão, sincronização e utilitários de UI
    ├── login.js      Lógica do login
    ├── principal.js  Formulário de coleta (GPS, fotos, salvar)
    └── relatorio.js  Relatório (filtros, detalhe, PDF, compartilhar)
```

### Arquivos principais

| Arquivo | O que faz |
|---|---|
| [index.html](index.html) | Formulário de e-mail e senha. Se já houver sessão, redireciona para `principal.html`. |
| [principal.html](principal.html) | Campos: unidade, cidade, data, localização, parecer (obrigatório) e fotos (opcional). Mostra quantos registros estão pendentes de envio. |
| [relatorio.html](relatorio.html) | Contadores, filtros, tabela (cartões no celular), janela de detalhe com imprimir e WhatsApp, e exportação em PDF. |
| [css/style.css](css/style.css) | Cores definidas como variáveis em `:root`. Modo escuro automático, layout responsivo, barra de navegação inferior no celular e estilos de impressão. |

### js/

| Arquivo | O que faz |
|---|---|
| [js/common.js](js/common.js) | `Registros` (CRUD no IndexedDB), `Sessao` (login mock em `localStorage`), `sincronizar()` (envio dos pendentes), `toast`, `montarTopbar`/`montarRodape` e `registrarServiceWorker`. **É o principal ponto de integração com a API.** |
| [js/login.js](js/login.js) | Valida os campos e cria a sessão. Hoje aceita qualquer e-mail e senha. |
| [js/principal.js](js/principal.js) | Captura o GPS, comprime as fotos (JPEG, máx. 1280 px, qualidade 0,7), valida e grava o registro com status `pendente`. Dispara a sincronização se houver internet. |
| [js/relatorio.js](js/relatorio.js) | Carrega os registros locais, aplica filtros, abre o detalhe, gera o PDF (jsPDF + AutoTable, via CDN) e compartilha no WhatsApp. |

### sw.js — Service Worker

Script que o navegador executa em segundo plano para o app funcionar **sem internet**.

- **install:** guarda no cache as páginas, o CSS e os scripts (`ARQUIVOS`) e as bibliotecas de PDF (`LIBS`). Se as bibliotecas falharem por falta de rede, a instalação continua.
- **activate:** apaga caches de versões antigas e assume o controle das abas abertas.
- **fetch:** estratégia "rede primeiro". Tenta o servidor (revalidando sempre, para não servir JS/CSS antigo) e grava uma cópia no cache. Sem internet, responde com o que está no cache. Só intercepta requisições `GET`, então envios `POST` para a API não passam por ele.
- **`CACHE = 'coleta-vN'`:** aumente o número a cada publicação para forçar a atualização nos aparelhos.
- Ao criar arquivos novos que o app precisa offline, inclua-os em `ARQUIVOS`.
- **Chamadas à API:** se um dia quiser cachear respostas da API, trate isso separadamente. Hoje requisições para outra origem apenas passam, sem cache.

### manifest.json — Manifesto do PWA

Descreve o app para o navegador poder **instalá-lo** na tela inicial do celular.

- `name` / `short_name`: nome completo e nome curto sob o ícone.
- `start_url`: página aberta ao tocar no ícone (`index.html`).
- `display: standalone`: abre sem a barra do navegador, como app.
- `background_color` / `theme_color`: cor da tela de abertura e da barra de status.
- **Pendências:** ainda não há campo `icons`. Para a instalação funcionar bem (principalmente no Android), adicione ícones PNG de 192×192 e 512×512 px.

## 2. Modelo de dados

Registro de coleta, como é salvo hoje no IndexedDB (`ColetaDB` → store `registros`) e como deve ser enviado à API:

```json
{
  "uuid": "3f1c9d9e-...",
  "unidade": "Unidade Centro",
  "cidade": "Fortaleza",
  "data": "2026-10-26",
  "parecer": "Texto do parecer",
  "latitude": -9.5914,
  "longitude": -35.9638,
  "precisao": 12,
  "fotos": [
    { "nome": "foto.jpg", "tipo": "image/jpeg", "base64": "data:image/jpeg;base64,..." }
  ],
  "coletor": "Nome do usuário logado",
  "status": "pendente",
  "criadoEm": "2026-10-26T14:32:10.000Z"
}
```

| Campo | Observação |
|---|---|
| `id` | Chave local do IndexedDB (autoincremento). **Não** enviar nem confiar nele no servidor. |
| `uuid` | Gerado no aparelho. Use como chave de **idempotência**: se o mesmo `uuid` chegar duas vezes, o servidor deve ignorar ou atualizar, sem duplicar. |
| `data` | Data da coleta (`YYYY-MM-DD`, escolhida pelo usuário). |
| `criadoEm` | Momento do registro no aparelho (ISO 8601, UTC). |
| `precisao` | Precisão do GPS em metros. |
| `status` | `pendente` ou `enviado`. É estado **local**; o servidor não precisa guardar. |
| `fotos[].base64` | Data URL em JPEG. No servidor, decodifique e salve como arquivo (ver seção 5). |

## 3. Endpoints sugeridos

| Método | Rota | Uso |
|---|---|---|
| `POST` | `/api/login` | Autentica e devolve token e dados do usuário. |
| `POST` | `/api/registros` | Recebe uma coleta (corpo = JSON acima, sem `id` e sem `status`). |
| `GET` | `/api/registros` | (Opcional) Lista as coletas de todos os aparelhos, para o relatório. |
| `DELETE` | `/api/registros/{uuid}` | (Opcional) Exclui uma coleta. |

Respostas esperadas pelo frontend:
- `POST /api/login` → `200` com `{ "token": "...", "nome": "...", "email": "..." }`, ou `401` se as credenciais forem inválidas.
- `POST /api/registros` → `201` (criado) ou `200` (já existia). Qualquer `2xx` marca o registro como enviado. Erros `4xx`/`5xx` mantêm como pendente.

## 4. Onde alterar no frontend

### 4.1 Login — [js/login.js](js/login.js)

Troque o trecho que simula o login:

```js
const res = await fetch(`${API_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha })
});
if (!res.ok) throw new Error('Credenciais inválidas');
const { token, nome } = await res.json();
Sessao.entrar({ email, nome, token });
```

Mostre a mensagem de "e-mail ou senha incorretos" quando for `401`. Hoje o `catch` exibe uma mensagem genérica.

### 4.2 Sessão — [js/common.js](js/common.js)

`Sessao` guarda os dados em `localStorage`. Com backend:
- Guarde o `token` junto (ver 4.1) e envie `Authorization: Bearer <token>` em toda chamada.
- `Sessao.exigir()` só confere se existe sessão local. Trate também respostas `401` da API, chamando `Sessao.sair()`.
- Para mais segurança, prefira cookie `HttpOnly` emitido pelo servidor em vez de token no `localStorage`.

### 4.3 Envio dos registros — `sincronizar()` em [js/common.js](js/common.js)

Substitua o trecho marcado com `BACKEND:`:

```js
const { id, status, ...payload } = item;   // não envia id local nem status
const res = await fetch(`${API_URL}/api/registros`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Sessao.obter().token}`
    },
    body: JSON.stringify(payload)
});
if (!res.ok) throw new Error('Falha no envio');
await Registros.marcarEnviado(item.id);
```

O comportamento atual já é correto para offline:
- Só envia os registros `pendente`.
- Se um envio falhar, segue para o próximo e mantém o que falhou como pendente. Será tentado de novo no próximo `online` ou no botão **Sincronizar**.
- Define `API_URL` em um único lugar (por exemplo no topo de `common.js`).

### 4.4 Relatório

O relatório lê apenas o IndexedDB, ou seja, mostra o que foi coletado **naquele aparelho**. Para ver as coletas de todos os usuários:
1. Em `carregar()` ([js/relatorio.js](js/relatorio.js)), busque `GET /api/registros` quando houver internet e use o IndexedDB como fallback.
2. Ajuste o filtro de cidade e o PDF para usarem a lista vinda do servidor.
3. A exclusão hoje é só local (`Registros.remover`). Se o servidor for a fonte da verdade, faça o botão chamar `DELETE` primeiro.

## 5. Recomendações para o backend

- **Fotos:** as fotos chegam em base64 dentro do JSON, o que deixa o corpo grande (cada foto costuma ter algumas centenas de KB). Aumente o limite de tamanho do corpo da requisição. Alternativa melhor: um endpoint separado `POST /api/registros/{uuid}/fotos` com `multipart/form-data`, e o JSON só com os dados. Isso exige ajustar `sincronizar()` para enviar em duas etapas.
- **Idempotência:** use `uuid` como chave única no banco. O envio pode ser repetido (queda de conexão no meio da resposta), e não pode gerar registro duplicado.
- **Validação no servidor:** exija `unidade`, `cidade`, `data`, `parecer`, `latitude` e `longitude`. Valide intervalo de latitude (−90 a 90) e longitude (−180 a 180) e formato da data.
- **Autorização:** associe cada coleta ao usuário do token, sem confiar no campo `coletor` enviado pelo cliente.
- **CORS:** se o frontend e a API estiverem em origens diferentes, libere a origem do frontend e os cabeçalhos `Authorization` e `Content-Type`.
- **HTTPS:** obrigatório para GPS, câmera e service worker fora do `localhost`.
- **Tabela sugerida:** `registros(uuid PK, usuario_id, unidade, cidade, data, parecer, latitude, longitude, precisao, criado_em)` e `fotos(id, registro_uuid FK, arquivo, tipo)`.

## 6. Pontos de atenção

- O login atual é **simulado**: qualquer credencial entra. Não publique assim.
- O IndexedDB guarda as fotos em base64. Muitos registros pendentes podem ocupar bastante espaço do aparelho.
- O PDF depende das bibliotecas jsPDF e AutoTable carregadas do CDN `cdnjs.cloudflare.com`. Offline, só funcionam se já estiverem no cache do service worker.
- Ao publicar uma nova versão, aumente `CACHE` em [sw.js](sw.js) para os aparelhos receberem os arquivos novos.
- Para testar localmente, use um servidor (por exemplo `npx serve`). GPS e service worker não funcionam abrindo o HTML direto pelo arquivo.
