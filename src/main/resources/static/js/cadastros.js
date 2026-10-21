/* =====================================================================
   PEI — Tela de Gerenciamento do Banco de Dados (Cadastros)
   CRUD completo de Crianças e Itens do Catálogo (Programas, Recursos,
   Atividades, Preferências e Observações) via API REST.
   ===================================================================== */
(function () {
    'use strict';

    const { api, toast, esc, debounce, formatarData } = window.PEI;
    const $ = id => document.getElementById(id);

    const els = {
        tabs: $('tabs'),
        secCrianca: $('secCrianca'),
        secCatalogo: $('secCatalogo'),
        // crianças
        tituloFormCrianca: $('tituloFormCrianca'),
        formCrianca: $('formCrianca'),
        criancaId: $('criancaId'),
        criancaNome: $('criancaNome'),
        criancaNasc: $('criancaNasc'),
        criancaPref: $('criancaPref'),
        criancaObs: $('criancaObs'),
        btnCancelarCrianca: $('btnCancelarCrianca'),
        buscaCrianca: $('buscaCrianca'),
        tbodyCriancas: $('tbodyCriancas'),
        // catálogo
        tituloFormItem: $('tituloFormItem'),
        formItem: $('formItem'),
        itemId: $('itemId'),
        itemTitulo: $('itemTitulo'),
        itemDescricao: $('itemDescricao'),
        wrapVinculo: $('wrapVinculoPrograma'),
        itemPrograma: $('itemPrograma'),
        btnCancelarItem: $('btnCancelarItem'),
        buscaCatalogo: $('buscaCatalogo'),
        filtroPrograma: $('filtroPrograma'),
        btnRestaurarOcultos: $('btnRestaurarOcultos'),
        thPrograma: $('thPrograma'),
        tbodyItens: $('tbodyItens')
    };

    const state = {
        aba: 'PROGRAMA',
        aceitaVinculo: false,
        nomePlural: 'Programas',
        criancas: [],
        todosItens: [],
        programas: []
    };

    // =================================================================== carregamento geral

    async function recarregarTudo() {
        try {
            const [criancas, itens] = await Promise.all([
                api.get('/api/criancas'),
                api.get('/api/catalogo')
            ]);
            state.criancas = criancas;
            state.todosItens = itens;
            state.programas = itens.filter(i => i.categoria === 'PROGRAMA');
            atualizarContadores();
            popularSelectsPrograma();
            renderAtual();
        } catch (e) {
            toast(e.message, 'erro');
        }
    }

    function atualizarContadores() {
        setCount('CRIANCA', state.criancas.length);
        const porCat = {};
        state.todosItens.forEach(i => { porCat[i.categoria] = (porCat[i.categoria] || 0) + 1; });
        ['PROGRAMA', 'RECURSO', 'ATIVIDADE', 'PREFERENCIA', 'OBSERVACAO']
            .forEach(c => setCount(c, porCat[c] || 0));
        if (els.btnRestaurarOcultos && window.PEI.obterItensOcultosSessao) {
            const qtdOcultos = window.PEI.obterItensOcultosSessao().size;
            els.btnRestaurarOcultos.hidden = qtdOcultos === 0;
            if (qtdOcultos > 0) {
                els.btnRestaurarOcultos.textContent = `Restaurar opções excluídas (${qtdOcultos})`;
            }
        }
    }

    function setCount(chave, valor) {
        const el = document.querySelector(`[data-count="${chave}"]`);
        if (el) el.textContent = String(valor);
    }

    function popularSelectsPrograma() {
        const opcoes = state.programas.map(p => `<option value="${p.id}">${esc(p.titulo)}</option>`).join('');
        const valForm = els.itemPrograma.value;
        const valFiltro = els.filtroPrograma.value;
        els.itemPrograma.innerHTML = '<option value="">— Nenhum (item geral) —</option>' + opcoes;
        els.filtroPrograma.innerHTML = '<option value="">Todos os programas</option><option value="__GERAL__">Sem vínculo (gerais)</option>' + opcoes;
        els.itemPrograma.value = valForm;
        els.filtroPrograma.value = valFiltro;
    }

    function trocarAba(btn) {
        els.tabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('ativo', t === btn));
        state.aba = btn.dataset.tab;
        state.aceitaVinculo = btn.dataset.vinculo === 'true';
        state.nomePlural = btn.dataset.nome || 'Itens';

        const ehCrianca = state.aba === 'CRIANCA';
        els.secCrianca.hidden = !ehCrianca;
        els.secCatalogo.hidden = ehCrianca;

        if (!ehCrianca) {
            limparFormItem();
            els.wrapVinculo.hidden = !state.aceitaVinculo;
            els.filtroPrograma.hidden = !state.aceitaVinculo;
            els.thPrograma.hidden = !state.aceitaVinculo;
        }
        renderAtual();
    }

    function renderAtual() {
        state.aba === 'CRIANCA' ? renderCriancas() : renderItens();
    }

    // =================================================================== CRUD de crianças

    function renderCriancas() {
        const termo = els.buscaCrianca.value.trim().toLowerCase();
        const lista = state.criancas.filter(c => !termo || c.nome.toLowerCase().includes(termo));
        if (!lista.length) {
            els.tbodyCriancas.innerHTML = `<tr><td colspan="3" class="list-empty">Nenhuma criança encontrada.</td></tr>`;
            return;
        }
        els.tbodyCriancas.innerHTML = lista.map(c => `
            <tr>
                <td>
                    <strong>${esc(c.nome)}</strong>
                    <div class="sub">Nascimento: ${formatarData(c.dataNascimento)}</div>
                </td>
                <td>
                    ${c.preferenciasPadrao ? `<div><strong>Preferências:</strong> ${esc(c.preferenciasPadrao)}</div>` : ''}
                    ${c.observacoesGerais ? `<div class="sub">${esc(c.observacoesGerais)}</div>` : ''}
                    ${!c.preferenciasPadrao && !c.observacoesGerais ? '<span class="muted">—</span>' : ''}
                </td>
                <td class="acoes">
                    <a class="btn btn-ghost btn-sm" href="/?criancaId=${c.id}">Abrir PEI</a>
                    <button type="button" class="btn btn-outline btn-sm" data-editar-crianca="${c.id}">Editar</button>
                    <button type="button" class="btn btn-danger btn-sm" data-excluir-crianca="${c.id}">Excluir</button>
                </td>
            </tr>`).join('');
    }

    function editarCrianca(id) {
        const c = state.criancas.find(x => x.id === id);
        if (!c) return;
        els.criancaId.value = c.id;
        els.criancaNome.value = c.nome || '';
        els.criancaNasc.value = c.dataNascimento || '';
        els.criancaPref.value = c.preferenciasPadrao || '';
        els.criancaObs.value = c.observacoesGerais || '';
        els.tituloFormCrianca.textContent = 'Editar Criança / Paciente';
        els.btnCancelarCrianca.hidden = false;
        els.criancaNome.focus();
    }

    function limparFormCrianca() {
        els.formCrianca.reset();
        els.criancaId.value = '';
        els.tituloFormCrianca.textContent = 'Cadastrar Criança / Paciente';
        els.btnCancelarCrianca.hidden = true;
    }

    async function salvarCrianca(ev) {
        ev.preventDefault();
        const nome = els.criancaNome.value.trim();
        if (!nome) { els.criancaNome.focus(); toast('Informe o nome da criança.', 'erro'); return; }
        const body = {
            nome,
            dataNascimento: els.criancaNasc.value || null,
            preferenciasPadrao: els.criancaPref.value.trim() || null,
            observacoesGerais: els.criancaObs.value.trim() || null
        };
        const id = els.criancaId.value;
        try {
            if (id) {
                await api.put(`/api/criancas/${id}`, body);
                toast('Criança atualizada.', 'sucesso');
            } else {
                await api.post('/api/criancas', body);
                toast('Criança cadastrada.', 'sucesso');
            }
            limparFormCrianca();
            await recarregarTudo();
        } catch (e) {
            toast(e.message, 'erro');
        }
    }

    async function excluirCrianca(id) {
        const c = state.criancas.find(x => x.id === id);
        if (!c || !confirm(`Excluir “${c.nome}” e todos os seus quadros PEI?`)) return;
        try {
            await api.del(`/api/criancas/${id}`);
            if (els.criancaId.value === String(id)) limparFormCrianca();
            toast('Criança excluída.', 'sucesso');
            await recarregarTudo();
        } catch (e) {
            toast(e.message, 'erro');
        }
    }

    // =================================================================== CRUD do catálogo

    function renderItens() {
        const termo = els.buscaCatalogo.value.trim().toLowerCase();
        const progFiltro = state.aceitaVinculo ? els.filtroPrograma.value : '';
        const lista = state.todosItens.filter(i => {
            if (i.categoria !== state.aba) return false;
            if (termo && !i.titulo.toLowerCase().includes(termo)
                && !(i.descricao || '').toLowerCase().includes(termo)) return false;
            if (progFiltro === '__GERAL__') return !i.programaVinculadoId;
            if (progFiltro) return String(i.programaVinculadoId) === progFiltro;
            return true;
        });

        const cols = state.aceitaVinculo ? 3 : 2;
        if (!lista.length) {
            els.tbodyItens.innerHTML = `<tr><td colspan="${cols}" class="list-empty">Nenhum item encontrado nesta categoria.</td></tr>`;
            return;
        }
        els.tbodyItens.innerHTML = lista.map(i => `
            <tr>
                <td>
                    <strong>${esc(i.titulo)}</strong>
                    ${i.descricao ? `<div class="sub">${esc(i.descricao)}</div>` : ''}
                </td>
                ${state.aceitaVinculo ? `<td>${i.programaVinculadoTitulo
                    ? `<span class="tag">${esc(i.programaVinculadoTitulo)}</span>`
                    : '<span class="muted">Geral</span>'}</td>` : ''}
                <td class="acoes">
                    <button type="button" class="btn btn-outline btn-sm" data-editar-item="${i.id}">Editar</button>
                    <button type="button" class="btn btn-danger btn-sm" data-excluir-item="${i.id}">Excluir</button>
                </td>
            </tr>`).join('');
    }

    function editarItem(id) {
        const i = state.todosItens.find(x => x.id === id);
        if (!i) return;
        els.itemId.value = i.id;
        els.itemTitulo.value = i.titulo || '';
        els.itemDescricao.value = i.descricao || '';
        els.itemPrograma.value = i.programaVinculadoId || '';
        els.tituloFormItem.textContent = `Editar · ${state.nomePlural}`;
        els.btnCancelarItem.hidden = false;
        els.itemTitulo.focus();
    }

    function limparFormItem() {
        els.formItem.reset();
        els.itemId.value = '';
        els.tituloFormItem.textContent = `Novo item · ${state.nomePlural}`;
        els.btnCancelarItem.hidden = true;
    }

    async function salvarItem(ev) {
        ev.preventDefault();
        const titulo = els.itemTitulo.value.trim();
        if (!titulo) { els.itemTitulo.focus(); toast('Informe o título do item.', 'erro'); return; }
        const body = {
            categoria: state.aba,
            titulo,
            descricao: els.itemDescricao.value.trim() || null,
            programaVinculadoId: state.aceitaVinculo && els.itemPrograma.value ? Number(els.itemPrograma.value) : null
        };
        const id = els.itemId.value;
        try {
            if (id) {
                await api.put(`/api/catalogo/${id}`, body);
                toast('Item atualizado.', 'sucesso');
            } else {
                await api.post('/api/catalogo', body);
                toast('Item cadastrado no banco.', 'sucesso');
            }
            limparFormItem();
            await recarregarTudo();
        } catch (e) {
            toast(e.message, 'erro');
        }
    }

    async function excluirItem(id) {
        const i = state.todosItens.find(x => x.id === id);
        if (!i || !confirm(`Remover “${i.titulo}” apenas para você neste planejamento?\n\n(Ele não será apagado do banco de dados principal e voltará a aparecer ao criar um novo planejamento ou sair do site.)`)) return;
        try {
            await api.del(`/api/catalogo/${id}`);
            if (els.itemId.value === String(id)) limparFormItem();
            toast('Opção removida apenas para o seu planejamento atual.', 'sucesso');
            await recarregarTudo();
        } catch (e) {
            toast(e.message, 'erro');
        }
    }

    // =================================================================== eventos

    els.tabs.addEventListener('click', ev => {
        const btn = ev.target.closest('.tab');
        if (btn) trocarAba(btn);
    });

    els.formCrianca.addEventListener('submit', salvarCrianca);
    els.btnCancelarCrianca.addEventListener('click', limparFormCrianca);
    els.buscaCrianca.addEventListener('input', debounce(renderCriancas, 150));
    els.tbodyCriancas.addEventListener('click', ev => {
        const ed = ev.target.closest('[data-editar-crianca]');
        if (ed) editarCrianca(Number(ed.dataset.editarCrianca));
        const ex = ev.target.closest('[data-excluir-crianca]');
        if (ex) excluirCrianca(Number(ex.dataset.excluirCrianca));
    });

    els.formItem.addEventListener('submit', salvarItem);
    els.btnCancelarItem.addEventListener('click', limparFormItem);
    els.buscaCatalogo.addEventListener('input', debounce(renderItens, 150));
    els.filtroPrograma.addEventListener('change', renderItens);
    if (els.btnRestaurarOcultos) {
        els.btnRestaurarOcultos.addEventListener('click', async () => {
            if (window.PEI.restaurarItensSessao) window.PEI.restaurarItensSessao();
            toast('Todas as opções do banco voltaram ao normal!', 'sucesso');
            await recarregarTudo();
        });
    }
    els.tbodyItens.addEventListener('click', ev => {
        const ed = ev.target.closest('[data-editar-item]');
        if (ed) editarItem(Number(ed.dataset.editarItem));
        const ex = ev.target.closest('[data-excluir-item]');
        if (ex) excluirItem(Number(ex.dataset.excluirItem));
    });

    recarregarTudo();
})();

