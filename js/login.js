if (Sessao.obter()) location.replace('principal.html');

$('verSenha').addEventListener('click', () => {
    const campo = $('senha');
    const mostrar = campo.type === 'password';
    campo.type = mostrar ? 'text' : 'password';
    $('verSenha').textContent = mostrar ? 'Ocultar' : 'Mostrar';
});

$('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('email').value.trim();
    const senha = $('senha').value;
    const erro = $('erro');
    erro.hidden = true;

    if (!email || !senha) {
        erro.textContent = 'Informe e-mail e senha.';
        erro.hidden = false;
        return;
    }

    const btn = $('btnEntrar');
    btn.disabled = true;
    btn.textContent = 'Entrando...';

    try {
        // BACKEND: substituir por POST /api/login e guardar o token retornado.
        // Por enquanto qualquer credencial é aceita (apenas para o frontend).
        await new Promise((r) => setTimeout(r, 400));
        const nome = email.split('@')[0].replace(/[._-]+/g, ' ');
        Sessao.entrar({ email, nome: nome.charAt(0).toUpperCase() + nome.slice(1) });
        location.href = 'principal.html';
    } catch (err) {
        erro.textContent = 'Não foi possível entrar. Tente novamente.';
        erro.hidden = false;
        btn.disabled = false;
        btn.textContent = 'Entrar';
    }
});
