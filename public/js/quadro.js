/* =====================================================================
   PEI — Quadro de Planejamento dos Atendimentos
   - Carrega o quadro da criança via API REST
   - Clique em um quadrado abre o seletor (modal) sem recarregar a página
   - Sugestões relacionais: recursos/atividades vinculados ao programa da coluna
   - Múltipla seleção, texto livre, cadastro rápido e autosave assíncrono
   ===================================================================== */
(function () {
    'use strict';

    const { api, toast, esc, debounce, corClara, formatarData } = window.PEI;
    const CFG = window.PEI_CONFIG || {};
    const PALETA = CFG.paleta || [];

    const LINHAS = {
        PROGRAMA:    { nome: 'Programas',                    singular: 'programa' },
        RECURSO:     { nome: 'Recursos a serem utilizados',  singular: 'recurso' },
        ATIVIDADE:   { nome: 'Atividades planejadas',        singular: 'atividade' },
        PREFERENCIA: { nome: 'Preferências da criança',      singular: 'preferência' },
        OBSERVACAO:  { nome: 'Observações',                  singular: 'observação' }
    };
    const ACEITA_VINCULO = new Set(['RECURSO', 'ATIVIDADE']);

    const $ = id => document.getElementById(id);
    const els = {
        grid: $('peiGrid'),
        selCrianca: $('selCrianca'),
        selQuadro: $('selQuadro'),
        btnNovo: $('btnNovoQuadro'),
        btnExcluir: $('btnExcluirQuadro'),
        btnSalvar: $('btnSalvar'),
        btnImprimir: $('btnImprimir'),
        status: $('saveStatus'),
        titulo: $('tituloQuadro'),
        tituloPrint: $('tituloPrint'),
        dataInicio: $('dataInicioQuadro'),
        dataFim: $('dataFimQuadro'),
        metaPeriodoPrint: $('metaPeriodoPrint'),
        metaCrianca: $('metaCrianca'),
        metaData: $('metaData'),
        btnAddPrograma: $('btnAdicionarPrograma'),
        btnPrimeiroPrograma: $('btnPrimeiroPrograma'),
        semProgramasBox: $('semProgramasBox'),
        // modal
        modal: $('modal'),
        modalHeader: $('modalHeader'),
        modalKicker: $('modalKicker'),
        modalTitulo: $('modalTitulo'),
        modalStatus: $('modalStatus'),
        contexto: $('contextoPrograma'),
        selecionados: $('selecionados'),
        busca: $('buscaItem'),
        lista: $('listaItens'),
        quickAdd: $('quickAdd'),
        qaForm: $('quickAddForm'),
        qaTitulo: $('qaTitulo'),
        qaDescricao: $('qaDescricao'),
        qaVinculoWrap: $('qaVinculoWrap'),
        qaPrograma: $('qaPrograma'),
        textoLivre: $('textoLivre'),
        corWrap: $('corWrap'),
        swatches: $('paletaSwatches'),
        btnLimpar: $('btnLimparCelula')
    };

    if (!els.grid) return; // estado vazio (sem crianças)

    const state = {
        quadro: null,
        crianca: null,
        celulas: new Map(),
        pendentes: 0,
        temErro: false
    };
    const chave = (linha, col) => `${linha}:${col}`;

    // =================================================================== carregamento

    async function carregarCrianca(criancaId, quadroId) {
        try {
            setStatus('Carregando…', 'saving');
            const [crianca, quadro] = await Promise.all([
                api.get(`/api/criancas/${criancaId}`),
                quadroId ? api.get(`/api/quadros/${quadroId}`) : api.get(`/api/criancas/${criancaId}/quadro`)
            ]);
            state.crianca = crianca;
            const quadros = await api.get(`/api/criancas/${criancaId}/quadros`);
            renderSeletorQuadros(quadros, quadro.id);
            aplicarQuadro(quadro);
            history.replaceState(null, '', `?criancaId=${criancaId}`);
            setStatus('', '');
        } catch (e) {
            setStatus('Erro ao carregar', 'error');
            toast(e.message, 'erro');
        }
    }

    function limparTituloPadrao(titulo) {
        if (!titulo) return 'Planejamento dos Atendimentos';
        return titulo
            .replace(/^Planejamento dos Atendimentos\s*-\s*(?:\d{2}\/\d{2}\/\d{4})?\s*$/i, 'Planejamento dos Atendimentos')
            .trim();
    }

    function rotuloOpcaoQuadro(q) {
        const base = limparTituloPadrao(q.titulo);
        const di = q.dataInicio ? formatarData(q.dataInicio) : null;
        const df = q.dataFim ? formatarData(q.dataFim) : null;
        if (di && df) {
            return `${base} (do dia ${di} até o dia ${df})`;
        }
        if (di) {
            return `${base} (a partir do dia ${di})`;
        }
        if (df) {
            return `${base} (até o dia ${df})`;
        }
        return `${base} (${formatarData(q.dataCriacao)})`;
    }

    function renderSeletorQuadros(quadros, selecionadoId) {
        els.selQuadro.innerHTML = quadros.map(q =>
            `<option value="${q.id}" ${q.id === selecionadoId ? 'selected' : ''}>${esc(rotuloOpcaoQuadro(q))}</option>`
        ).join('');
    }

    function aplicarQuadro(q) {
        state.quadro = q;
        state.celulas.clear();
        q.celulas.forEach(c => state.celulas.set(chave(c.tipoLinha, c.indiceColuna), c));
        desmembrarProgramasAgrupados();
        const tituloLimpo = limparTituloPadrao(q.titulo);
        els.titulo.value = tituloLimpo;
        els.tituloPrint.textContent = tituloLimpo;
        if (els.dataInicio) els.dataInicio.value = q.dataInicio || '';
        if (els.dataFim) els.dataFim.value = q.dataFim || '';
        els.metaCrianca.textContent = q.criancaNome;
        atualizarTextoPeriodoPrint();
        atualizarOpcaoQuadro(q);
        document.title = `PEI · ${q.criancaNome}`;
        renderTodas();
    }

    /**
     * Garante que cada programa fique em sua própria coluna individual.
     * Caso alguma coluna possua mais de 1 programa selecionado, distribui os
     * programas excedentes em colunas individuais livres e salva no banco.
     */
    function desmembrarProgramasAgrupados() {
        const total = CFG.totalColunas || 11;
        for (let col = 0; col < total; col++) {
            const c = getCelula('PROGRAMA', col);
            if (c.itensSelecionados && c.itensSelecionados.length > 1) {
                const extras = c.itensSelecionados.slice(1);
                c.itensSelecionados = [c.itensSelecionados[0]];
                salvarCelula('PROGRAMA', col);
                for (const itemExtra of extras) {
                    const livre = proximaColunaLivre();
                    if (livre !== -1) {
                        const celNova = getCelula('PROGRAMA', livre);
                        celNova.itensSelecionados = [itemExtra];
                        salvarCelula('PROGRAMA', livre);
                    }
                }
            }
        }
    }

    function proximaColunaLivre() {
        const total = CFG.totalColunas || 11;
        for (let col = 0; col < total; col++) {
            if (!colunaTemPrograma(col)) return col;
        }
        return -1;
    }

    function atualizarTextoPeriodoPrint() {
        const di = els.dataInicio && els.dataInicio.value ? formatarData(els.dataInicio.value) : null;
        const df = els.dataFim && els.dataFim.value ? formatarData(els.dataFim.value) : null;
        if (els.metaData) {
            if (di && df) {
                els.metaData.innerHTML = `Período: <strong>do dia ${esc(di)} até o dia ${esc(df)}</strong>`;
            } else if (di) {
                els.metaData.innerHTML = `Período: <strong>a partir do dia ${esc(di)}</strong>`;
            } else if (df) {
                els.metaData.innerHTML = `Período: <strong>até o dia ${esc(df)}</strong>`;
            } else if (state.quadro) {
                els.metaData.textContent = `Criado em: ${formatarData(state.quadro.dataCriacao)}`;
            }
        }
    }

    function getCelula(linha, col) {
        const k = chave(linha, col);
        let c = state.celulas.get(k);
        if (!c) {
            c = { indiceColuna: col, tipoLinha: linha, corCabecalho: PALETA[col], itensSelecionados: [], textoLivre: null };
            state.celulas.set(k, c);
        }
        return c;
    }

    const programasDaColuna = col => getCelula('PROGRAMA', col).itensSelecionados;

    // =================================================================== renderização da grade

    function cellEl(linha, col) {
        return els.grid.querySelector(`.cell[data-linha="${linha}"][data-col="${col}"]`);
    }

    function renderTodas() {
        els.grid.querySelectorAll('.cell').forEach(el =>
            renderCelula(el.dataset.linha, Number(el.dataset.col)));
        atualizarColunasVisiveis();
    }

    function colunaTemPrograma(col) {
        const c = getCelula('PROGRAMA', col);
        return Boolean((c.itensSelecionados && c.itensSelecionados.length > 0) || (c.textoLivre && c.textoLivre.trim()));
    }

    function atualizarColunasVisiveis() {
        const total = CFG.totalColunas || 11;
        const visiveis = [];
        for (let col = 0; col < total; col++) {
            const emEdicaoNoModal = !els.modal.hidden && modal.col === col;
            if (colunaTemPrograma(col) || emEdicaoNoModal) {
                visiveis.push(col);
            }
        }
        const setVisiveis = new Set(visiveis);
        const ultimaVisivel = visiveis.length ? visiveis[visiveis.length - 1] : -1;

        els.grid.querySelectorAll('.cell').forEach(el => {
            const col = Number(el.dataset.col);
            const visivel = setVisiveis.has(col);
            el.hidden = !visivel;
            if (el.classList.contains('cell-pink')) {
                el.classList.toggle('col-last', col === ultimaVisivel);
            }
        });

        const semProgramas = visiveis.length === 0;
        els.grid.hidden = semProgramas;
        if (els.semProgramasBox) els.semProgramasBox.hidden = !semProgramas;
        if (!semProgramas) {
            els.grid.style.setProperty('--cols', String(visiveis.length));
        }

        if (els.btnAddPrograma) {
            const ocupadas = Array.from({ length: total }, (_, i) => i).filter(colunaTemPrograma).length;
            els.btnAddPrograma.disabled = ocupadas >= total;
        }
    }

    function adicionarPrograma() {
        if (!state.quadro) return;
        const livre = proximaColunaLivre();
        if (livre === -1) {
            toast('Todas as 11 colunas de programas já foram preenchidas.', 'erro');
            return;
        }
        abrirModal('PROGRAMA', livre, els.btnAddPrograma);
        atualizarColunasVisiveis();
    }

    function renderCelula(linha, col) {
        const el = cellEl(linha, col);
        if (!el) return;
        const c = getCelula(linha, col);
        const itens = c.itensSelecionados || [];
        const texto = c.textoLivre ? `<span class="texto-livre">${esc(c.textoLivre)}</span>` : '';

        if (linha === 'PROGRAMA') {
            const bloco = el.querySelector('.programa-bloco');
            const cor = c.corCabecalho || PALETA[col];
            bloco.style.background = cor;
            bloco.classList.toggle('texto-escuro', corClara(cor));
            const btnRemoverCol = `<button type="button" class="programa-remove no-print" data-remover-coluna="${col}" title="Excluir este programa do quadro" aria-label="Excluir programa da coluna ${col + 1}">&times;</button>`;
            bloco.innerHTML = (itens.length || texto)
                ? btnRemoverCol + itens.map(i => `<span class="programa-titulo">${esc(i.titulo)}</span>`).join('') + texto
                : '';
        } else {
            el.querySelector('.cell-content').innerHTML =
                itens.map(i => `<span class="chip"><span>${esc(i.titulo)}</span><button type="button" class="chip-remove no-print" data-remover-chip="${i.id}" title="Excluir item" aria-label="Remover ${esc(i.titulo)}">&times;</button></span>`).join('') + texto;
            el.querySelector('.cell-hint').hidden = itens.length > 0 || !!c.textoLivre;
        }
    }

    function excluirColuna(col) {
        const progCel = getCelula('PROGRAMA', col);
        const nomeProg = (progCel.itensSelecionados && progCel.itensSelecionados[0])
            ? progCel.itensSelecionados[0].titulo
            : (progCel.textoLivre || `Coluna ${col + 1}`);

        const outrasLinhas = ['RECURSO', 'ATIVIDADE', 'PREFERENCIA', 'OBSERVACAO'];
        const temConteudoAbaixo = outrasLinhas.some(l => {
            const c = getCelula(l, col);
            return (c.itensSelecionados && c.itensSelecionados.length > 0) || (c.textoLivre && c.textoLivre.trim());
        });

        if (temConteudoAbaixo && !window.confirm(`Deseja excluir o programa "${nomeProg}" e limpar os itens desta coluna?`)) {
            return;
        }

        ['PROGRAMA', ...outrasLinhas].forEach(l => {
            const c = getCelula(l, col);
            const tinhaAlgo = (c.itensSelecionados && c.itensSelecionados.length > 0) || Boolean(c.textoLivre);
            c.itensSelecionados = [];
            c.textoLivre = null;
            renderCelula(l, col);
            if (tinhaAlgo) {
                salvarCelula(l, col);
            }
        });
        atualizarColunasVisiveis();
        toast(`Programa "${nomeProg}" removido do quadro.`, 'sucesso');
    }

    function removerChipDireto(linha, col, itemId) {
        const c = getCelula(linha, col);
        if (!c.itensSelecionados || !c.itensSelecionados.length) return;
        c.itensSelecionados = c.itensSelecionados.filter(i => i.id !== itemId);
        renderCelula(linha, col);
        salvarCelula(linha, col);
    }

    function flash(linha, col) {
        const el = cellEl(linha, col);
        if (!el) return;
        el.classList.remove('flash');
        void el.offsetWidth;
        el.classList.add('flash');
    }

    // =================================================================== status / autosave

    function setStatus(texto, tipo) {
        els.status.textContent = texto;
        els.status.className = 'save-status' + (tipo ? ' ' + tipo : '');
        if (!els.modal.hidden) {
            els.modalStatus.textContent = texto;
            els.modalStatus.className = 'save-status' + (tipo ? ' ' + tipo : '');
        }
    }

    function horaAgora() {
        return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    function payloadCelula(c) {
        return {
            indiceColuna: c.indiceColuna,
            tipoLinha: c.tipoLinha,
            itensIds: (c.itensSelecionados || []).map(i => i.id),
            textoLivre: c.textoLivre || null,
            corCabecalho: c.tipoLinha === 'PROGRAMA' ? (c.corCabecalho || null) : null
        };
    }

    /** Fila por quadrado: garante que salvamentos do mesmo quadrado não cheguem fora de ordem. */
    const filas = new Map();

    function salvarCelula(linha, col) {
        const k = chave(linha, col);
        let f = filas.get(k);
        if (!f) { f = { emAndamento: false, repetir: false, promise: null }; filas.set(k, f); }
        if (f.emAndamento) { f.repetir = true; return f.promise; }

        f.emAndamento = true;
        state.pendentes++;
        setStatus('Salvando…', 'saving');
        const quadroId = state.quadro.id;

        f.promise = (async () => {
            try {
                do {
                    f.repetir = false;
                    await api.put(`/api/quadros/${quadroId}/celula`, payloadCelula(getCelula(linha, col)));
                } while (f.repetir);
                state.temErro = false;
                flash(linha, col);
            } catch (e) {
                state.temErro = true;
                toast('Não foi possível salvar o quadrado: ' + e.message, 'erro');
            } finally {
                f.emAndamento = false;
                state.pendentes--;
                if (state.pendentes === 0) {
                    state.temErro
                        ? setStatus('Erro ao salvar', 'error')
                        : setStatus('Alterações salvas · ' + horaAgora(), 'saved');
                }
            }
        })();
        return f.promise;
    }

    async function salvarPlanejamento() {
        if (!state.quadro) return;
        els.btnSalvar.disabled = true;
        setStatus('Salvando…', 'saving');
        try {
            const tituloLimpo = limparTituloPadrao(els.titulo.value.trim() || state.quadro.titulo);
            els.titulo.value = tituloLimpo;
            const payload = {
                titulo: tituloLimpo,
                dataInicio: els.dataInicio && els.dataInicio.value ? els.dataInicio.value : null,
                dataFim: els.dataFim && els.dataFim.value ? els.dataFim.value : null,
                celulas: Array.from(state.celulas.values()).map(payloadCelula)
            };
            const q = await api.put(`/api/quadros/${state.quadro.id}`, payload);
            aplicarQuadro(q);
            atualizarOpcaoQuadro(q);
            state.temErro = false;
            setStatus('Planejamento salvo · ' + horaAgora(), 'saved');
            toast('Planejamento salvo com sucesso!', 'sucesso');
        } catch (e) {
            setStatus('Erro ao salvar', 'error');
            toast(e.message, 'erro');
        } finally {
            els.btnSalvar.disabled = false;
        }
    }

    async function salvarCabecalhoQuadro() {
        if (!state.quadro) return;
        const titulo = limparTituloPadrao(els.titulo.value.trim() || state.quadro.titulo);
        els.titulo.value = titulo;
        const dataInicio = els.dataInicio && els.dataInicio.value ? els.dataInicio.value : null;
        const dataFim = els.dataFim && els.dataFim.value ? els.dataFim.value : null;
        atualizarTextoPeriodoPrint();
        atualizarOpcaoQuadro({
            ...state.quadro,
            titulo,
            dataInicio,
            dataFim
        });

        if (titulo === state.quadro.titulo
            && dataInicio === (state.quadro.dataInicio || null)
            && dataFim === (state.quadro.dataFim || null)) {
            return;
        }
        try {
            setStatus('Salvando…', 'saving');
            const q = await api.put(`/api/quadros/${state.quadro.id}`, {
                titulo,
                dataInicio,
                dataFim,
                celulas: null
            });
            state.quadro.titulo = q.titulo;
            state.quadro.dataInicio = q.dataInicio || null;
            state.quadro.dataFim = q.dataFim || null;
            els.tituloPrint.textContent = limparTituloPadrao(q.titulo);
            atualizarTextoPeriodoPrint();
            atualizarOpcaoQuadro(q);
            setStatus('Alterações salvas · ' + horaAgora(), 'saved');
        } catch (e) {
            setStatus('Erro ao salvar', 'error');
            toast(e.message, 'erro');
        }
    }

    function atualizarOpcaoQuadro(q) {
        const opt = els.selQuadro.querySelector(`option[value="${q.id}"]`);
        if (opt) opt.textContent = rotuloOpcaoQuadro(q);
    }

    async function novoQuadro() {
        const criancaId = els.selCrianca.value;
        if (!criancaId) return;
        try {
            const q = await api.post(`/api/quadros?criancaId=${encodeURIComponent(criancaId)}`);
            await carregarCrianca(criancaId, q.id);
            toast('Novo quadro criado.', 'sucesso');
            els.titulo.focus();
            els.titulo.select();
        } catch (e) {
            toast(e.message, 'erro');
        }
    }

    async function excluirQuadroAtual() {
        if (!state.quadro) return;
        const criancaId = els.selCrianca.value;
        const titulo = state.quadro.titulo || 'este quadro';
        if (!window.confirm(`Deseja realmente excluir o quadro "${titulo}"?`)) {
            return;
        }
        try {
            if (els.btnExcluir) els.btnExcluir.disabled = true;
            setStatus('Excluindo…', 'saving');
            await api.del(`/api/quadros/${state.quadro.id}`);
            await carregarCrianca(criancaId);
            toast(`Quadro "${titulo}" excluído com sucesso.`, 'sucesso');
        } catch (e) {
            setStatus('Erro ao excluir', 'error');
            toast(e.message, 'erro');
        } finally {
            if (els.btnExcluir) els.btnExcluir.disabled = false;
        }
    }

    // =================================================================== modal de seleção

    const modal = {
        linha: null,
        col: null,
        itens: [],
        pendente: false,
        seqBusca: 0,
        origem: null,
        todosProgramas: null,
        colunasAlocadas: new Map() // itemId -> indiceColuna (usado quando linha === 'PROGRAMA')
    };

    const agendarSalvar = debounce(() => {
        modal.pendente = false;
        salvarCelula(modal.linha, modal.col);
    }, 500);

    /** Mudança feita no modal: reflete na grade imediatamente e agenda autosave. */
    function alterou(imediato) {
        modal.pendente = true;
        renderCelula(modal.linha, modal.col);
        renderSelecionados();
        if (imediato) {
            agendarSalvar.cancel();
            modal.pendente = false;
            salvarCelula(modal.linha, modal.col);
        } else {
            agendarSalvar();
        }
    }

    async function abrirModal(linha, col, origem) {
        if (!state.quadro) return;
        modal.linha = linha;
        modal.col = col;
        modal.origem = origem;
        modal.itens = [];
        modal.pendente = false;
        modal.colunasAlocadas = new Map();
        if (linha === 'PROGRAMA') {
            (getCelula('PROGRAMA', col).itensSelecionados || []).forEach(i => modal.colunasAlocadas.set(i.id, col));
        }

        const c = getCelula(linha, col);
        const corColuna = getCelula('PROGRAMA', col).corCabecalho || PALETA[col];
        pintarCabecalhoModal(corColuna);

        const programas = programasDaColuna(col);
        const nomesProg = programas.map(p => p.titulo).join(', ');
        els.modalKicker.textContent = `Coluna ${col + 1}` + (linha !== 'PROGRAMA' && nomesProg ? ` · ${nomesProg}` : '');
        els.modalTitulo.textContent = LINHAS[linha].nome;
        els.modalStatus.textContent = '';
        els.modalStatus.className = 'save-status';

        renderContexto(linha, programas);

        els.busca.value = '';
        els.textoLivre.value = c.textoLivre || '';
        els.quickAdd.open = false;
        els.qaForm.reset();

        els.corWrap.hidden = linha !== 'PROGRAMA';
        if (linha === 'PROGRAMA') renderSwatches(c.corCabecalho || PALETA[col]);

        els.qaVinculoWrap.hidden = !ACEITA_VINCULO.has(linha);
        if (ACEITA_VINCULO.has(linha)) prepararVinculoQuickAdd(programas);

        renderSelecionados();
        els.lista.innerHTML = '<div class="list-empty">Carregando…</div>';
        els.modal.hidden = false;
        document.body.style.overflow = 'hidden';
        setTimeout(() => els.busca.focus(), 30);
        await buscarItens();
    }

    function pintarCabecalhoModal(cor) {
        els.modalHeader.style.background = cor;
        els.modalHeader.classList.toggle('texto-escuro', corClara(cor));
    }

    function renderContexto(linha, programas) {
        let html = '';
        if (linha !== 'PROGRAMA' && programas.length) {
            html = `<span>Sugestões priorizadas para:</span>` +
                programas.map(p => `<span class="tag">${esc(p.titulo)}</span>`).join('');
        } else if (ACEITA_VINCULO.has(linha)) {
            html = `<span class="muted">Dica: selecione um <strong>programa</strong> no topo desta coluna para ver primeiro os ${LINHAS[linha].singular === 'recurso' ? 'recursos' : 'atividades'} vinculados a ele.</span>`;
        }
        if (linha === 'PREFERENCIA' && state.crianca && state.crianca.preferenciasPadrao) {
            html += `${html ? '<br>' : ''}<span>Preferências registradas de <strong>${esc(state.crianca.nome)}</strong>: ${esc(state.crianca.preferenciasPadrao)}</span>`;
        }
        if (linha === 'OBSERVACAO' && state.crianca && state.crianca.observacoesGerais) {
            html += `${html ? '<br>' : ''}<span>Observações gerais: ${esc(state.crianca.observacoesGerais)}</span>`;
        }
        els.contexto.innerHTML = html;
        els.contexto.hidden = !html;
    }

    async function prepararVinculoQuickAdd(programasColuna) {
        if (!modal.todosProgramas) {
            try {
                modal.todosProgramas = await api.get('/api/catalogo?categoria=PROGRAMA');
            } catch (e) {
                modal.todosProgramas = [];
            }
        }
        const idsColuna = new Set(programasColuna.map(p => p.id));
        const padrao = programasColuna[0] ? programasColuna[0].id : '';
        els.qaPrograma.innerHTML = '<option value="">— Nenhum (item geral) —</option>' +
            modal.todosProgramas.map(p =>
                `<option value="${p.id}" ${p.id === padrao ? 'selected' : ''}>${esc(p.titulo)}${idsColuna.has(p.id) ? ' (desta coluna)' : ''}</option>`
            ).join('');
    }

    function renderSwatches(corAtual) {
        const unicas = [...new Set(PALETA.map(c => c.toUpperCase()))];
        const atual = (corAtual || '').toUpperCase();
        els.swatches.innerHTML = unicas.map(c =>
            `<button type="button" class="swatch ${c === atual ? 'ativo' : ''}" data-cor="${c}" style="background:${c}" aria-label="Cor ${c}" title="${c}"></button>`
        ).join('') +
            `<input type="color" id="corCustom" value="${/^#[0-9A-F]{6}$/.test(atual) ? atual.toLowerCase() : '#5a28b6'}" title="Outra cor" aria-label="Escolher outra cor">`;
    }

    function definirCor(cor) {
        const c = getCelula('PROGRAMA', modal.col);
        c.corCabecalho = cor.toUpperCase();
        pintarCabecalhoModal(c.corCabecalho);
        renderSwatches(c.corCabecalho);
        alterou(true);
    }

    async function buscarItens() {
        const seq = ++modal.seqBusca;
        const params = new URLSearchParams({ categoria: modal.linha });
        const termo = els.busca.value.trim();
        if (termo) params.set('busca', termo);
        if (modal.linha !== 'PROGRAMA') {
            programasDaColuna(modal.col).forEach(p => params.append('programaId', p.id));
        }
        try {
            const itens = await api.get('/api/catalogo?' + params.toString());
            if (seq !== modal.seqBusca) return; // resposta antiga
            modal.itens = itens;
            renderLista();
        } catch (e) {
            if (seq === modal.seqBusca) {
                els.lista.innerHTML = `<div class="list-empty">Erro ao carregar itens: ${esc(e.message)}</div>`;
            }
        }
    }

    function renderLista() {
        const selecionadosIds = modal.linha === 'PROGRAMA'
            ? new Set(modal.colunasAlocadas.keys())
            : new Set(getCelula(modal.linha, modal.col).itensSelecionados.map(i => i.id));
        const sugeridos = modal.itens.filter(i => i.sugerido);
        const outros = modal.itens.filter(i => !i.sugerido);

        const row = i => `
            <label class="item-row">
                <input type="checkbox" data-id="${i.id}" ${selecionadosIds.has(i.id) ? 'checked' : ''}>
                <div>
                    <div class="item-titulo">${esc(i.titulo)}${i.sugerido ? '<span class="badge-sugerido">sugerido</span>' : ''}</div>
                    ${i.descricao ? `<div class="item-desc">${esc(i.descricao)}</div>` : ''}
                    ${i.programaVinculadoTitulo && !i.sugerido ? `<div class="item-vinculo">Programa: ${esc(i.programaVinculadoTitulo)}</div>` : ''}
                </div>
            </label>`;

        if (!modal.itens.length) {
            const termo = els.busca.value.trim();
            els.lista.innerHTML = `<div class="list-empty">Nenhum item encontrado${termo ? ` para “${esc(termo)}”` : ''}.
                Use <strong>+ Cadastrar Novo Item no Banco</strong> abaixo.</div>`;
            return;
        }

        let html = '';
        if (sugeridos.length) {
            html += `<div class="item-group-title sugeridos">★ Vinculados ao programa da coluna (${sugeridos.length})</div>`;
            html += sugeridos.map(row).join('');
        }
        if (outros.length) {
            html += `<div class="item-group-title">${sugeridos.length ? 'Outros itens do banco' : 'Itens do banco'} (${outros.length})</div>`;
            html += outros.map(row).join('');
        }
        els.lista.innerHTML = html;
    }

    function renderSelecionados() {
        if (modal.linha === 'PROGRAMA') {
            if (!modal.colunasAlocadas.size) {
                els.selecionados.innerHTML = '<span class="vazio">Nenhum programa selecionado (cada opção marcada abrirá em uma coluna individual).</span>';
                return;
            }
            const chips = [];
            for (const [itemId, colIdx] of modal.colunasAlocadas.entries()) {
                const cel = getCelula('PROGRAMA', colIdx);
                const item = (cel.itensSelecionados || []).find(i => i.id === itemId)
                    || modal.itens.find(i => i.id === itemId);
                if (!item) continue;
                const cor = cel.corCabecalho || PALETA[colIdx];
                const estilo = `style="background:${cor};color:${corClara(cor) ? '#1C1A3A' : '#fff'}"`;
                chips.push(`<span class="tag" ${estilo}>Coluna ${colIdx + 1}: ${esc(item.titulo)}
                    <button type="button" data-remover="${item.id}" aria-label="Remover ${esc(item.titulo)}">&times;</button></span>`);
            }
            els.selecionados.innerHTML = chips.join('');
            return;
        }

        const c = getCelula(modal.linha, modal.col);
        const itens = c.itensSelecionados;
        if (!itens.length) {
            els.selecionados.innerHTML = '<span class="vazio">Nenhum item selecionado.</span>';
            return;
        }
        els.selecionados.innerHTML = itens.map(i => {
            return `<span class="tag">${esc(i.titulo)}
                <button type="button" data-remover="${i.id}" aria-label="Remover ${esc(i.titulo)}">&times;</button></span>`;
        }).join('');
    }

    function alocarProgramaEmColunaIndividual(item) {
        if (!item || modal.colunasAlocadas.has(item.id)) return true;
        let alvoCol = !colunaTemPrograma(modal.col) ? modal.col : proximaColunaLivre();
        if (alvoCol === -1) {
            toast('Todas as 11 colunas de programas já estão preenchidas.', 'erro');
            return false;
        }
        const cel = getCelula('PROGRAMA', alvoCol);
        cel.itensSelecionados = [item];
        modal.colunasAlocadas.set(item.id, alvoCol);
        renderCelula('PROGRAMA', alvoCol);
        atualizarColunasVisiveis();
        renderSelecionados();
        salvarCelula('PROGRAMA', alvoCol);
        return true;
    }

    function alternarItem(id, marcado) {
        if (modal.linha === 'PROGRAMA') {
            if (marcado) {
                const item = modal.itens.find(i => i.id === id);
                if (!alocarProgramaEmColunaIndividual(item)) {
                    const cb = els.lista.querySelector(`input[data-id="${id}"]`);
                    if (cb) cb.checked = false;
                }
            } else {
                const colIdx = modal.colunasAlocadas.get(id);
                if (colIdx !== undefined) {
                    const cel = getCelula('PROGRAMA', colIdx);
                    cel.itensSelecionados = (cel.itensSelecionados || []).filter(i => i.id !== id);
                    modal.colunasAlocadas.delete(id);
                    if (colIdx === modal.col && modal.colunasAlocadas.size > 0) {
                        modal.col = modal.colunasAlocadas.values().next().value;
                    }
                    renderCelula('PROGRAMA', colIdx);
                    atualizarColunasVisiveis();
                    renderSelecionados();
                    salvarCelula('PROGRAMA', colIdx);
                }
            }
            return;
        }

        const c = getCelula(modal.linha, modal.col);
        if (marcado) {
            const item = modal.itens.find(i => i.id === id);
            if (item && !c.itensSelecionados.some(i => i.id === id)) c.itensSelecionados.push(item);
        } else {
            c.itensSelecionados = c.itensSelecionados.filter(i => i.id !== id);
        }
        alterou(false);
    }

    async function cadastroRapido(ev) {
        ev.preventDefault();
        const titulo = els.qaTitulo.value.trim();
        if (!titulo) { els.qaTitulo.focus(); toast('Informe o título do novo item.', 'erro'); return; }
        const btn = els.qaForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
            const novo = await api.post('/api/catalogo', {
                categoria: modal.linha,
                titulo,
                descricao: els.qaDescricao.value.trim() || null,
                programaVinculadoId: ACEITA_VINCULO.has(modal.linha) && els.qaPrograma.value ? Number(els.qaPrograma.value) : null
            });
            if (modal.linha === 'PROGRAMA') {
                modal.todosProgramas = null;
                alocarProgramaEmColunaIndividual(novo);
            } else {
                const c = getCelula(modal.linha, modal.col);
                c.itensSelecionados.push(novo);
                alterou(true);
            }
            els.qaForm.reset();
            els.quickAdd.open = false;
            toast(`“${novo.titulo}” cadastrado no banco e adicionado ao quadro.`, 'sucesso');
            await buscarItens();
        } catch (e) {
            toast(e.message, 'erro');
        } finally {
            btn.disabled = false;
        }
    }

    function limparCelula() {
        if (modal.linha === 'PROGRAMA') {
            const cols = new Set([modal.col, ...modal.colunasAlocadas.values()]);
            cols.forEach(colIdx => {
                const cel = getCelula('PROGRAMA', colIdx);
                if ((cel.itensSelecionados && cel.itensSelecionados.length) || cel.textoLivre) {
                    cel.itensSelecionados = [];
                    cel.textoLivre = null;
                    renderCelula('PROGRAMA', colIdx);
                    salvarCelula('PROGRAMA', colIdx);
                }
            });
            modal.colunasAlocadas.clear();
            els.textoLivre.value = '';
            fecharModal();
            return;
        }
        const c = getCelula(modal.linha, modal.col);
        if (!c.itensSelecionados.length && !c.textoLivre) return;
        c.itensSelecionados = [];
        c.textoLivre = null;
        els.textoLivre.value = '';
        alterou(true);
        renderLista();
    }

    function fecharModal() {
        if (els.modal.hidden) return;
        if (modal.pendente) {
            agendarSalvar.cancel();
            modal.pendente = false;
            salvarCelula(modal.linha, modal.col);
        }
        els.modal.hidden = true;
        document.body.style.overflow = '';
        atualizarColunasVisiveis();
        if (modal.origem && !modal.origem.hidden) modal.origem.focus();
    }

    // =================================================================== eventos

    els.grid.addEventListener('click', ev => {
        const btnCol = ev.target.closest('[data-remover-coluna]');
        if (btnCol) {
            ev.stopPropagation();
            excluirColuna(Number(btnCol.dataset.removerColuna));
            return;
        }
        const btnChip = ev.target.closest('[data-remover-chip]');
        if (btnChip) {
            ev.stopPropagation();
            const cell = btnChip.closest('.cell');
            if (cell) {
                removerChipDireto(cell.dataset.linha, Number(cell.dataset.col), Number(btnChip.dataset.removerChip));
            }
            return;
        }
        const cell = ev.target.closest('.cell');
        if (cell) abrirModal(cell.dataset.linha, Number(cell.dataset.col), cell);
    });
    els.grid.addEventListener('keydown', ev => {
        const cell = ev.target.closest('.cell');
        if (cell && (ev.key === 'Enter' || ev.key === ' ')) {
            ev.preventDefault();
            abrirModal(cell.dataset.linha, Number(cell.dataset.col), cell);
        }
    });

    els.modal.addEventListener('click', ev => {
        if (ev.target === els.modal || ev.target.closest('[data-close]')) fecharModal();
    });
    document.addEventListener('keydown', ev => {
        if (ev.key === 'Escape' && !els.modal.hidden) fecharModal();
    });

    els.busca.addEventListener('input', debounce(buscarItens, 220));
    els.busca.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            const primeiro = els.lista.querySelector('input[type="checkbox"]:not(:checked)');
            if (primeiro) { primeiro.checked = true; alternarItem(Number(primeiro.dataset.id), true); }
        }
    });

    els.lista.addEventListener('change', ev => {
        const cb = ev.target.closest('input[type="checkbox"][data-id]');
        if (cb) alternarItem(Number(cb.dataset.id), cb.checked);
    });

    els.selecionados.addEventListener('click', ev => {
        const btn = ev.target.closest('[data-remover]');
        if (!btn) return;
        const id = Number(btn.dataset.remover);
        const cb = els.lista.querySelector(`input[data-id="${id}"]`);
        if (cb) cb.checked = false;
        alternarItem(id, false);
    });

    els.textoLivre.addEventListener('input', () => {
        getCelula(modal.linha, modal.col).textoLivre = els.textoLivre.value;
        alterou(false);
    });

    els.swatches.addEventListener('click', ev => {
        const sw = ev.target.closest('[data-cor]');
        if (sw) definirCor(sw.dataset.cor);
    });
    els.swatches.addEventListener('change', ev => {
        if (ev.target.id === 'corCustom') definirCor(ev.target.value);
    });

    els.qaForm.addEventListener('submit', cadastroRapido);
    els.btnLimpar.addEventListener('click', limparCelula);

    els.selCrianca.addEventListener('change', () => carregarCrianca(els.selCrianca.value));
    els.selQuadro.addEventListener('change', () => carregarCrianca(els.selCrianca.value, els.selQuadro.value));
    els.btnNovo.addEventListener('click', novoQuadro);
    if (els.btnExcluir) els.btnExcluir.addEventListener('click', excluirQuadroAtual);
    if (els.btnAddPrograma) els.btnAddPrograma.addEventListener('click', adicionarPrograma);
    if (els.btnPrimeiroPrograma) els.btnPrimeiroPrograma.addEventListener('click', adicionarPrograma);
    els.btnSalvar.addEventListener('click', salvarPlanejamento);
    els.btnImprimir.addEventListener('click', () => {
        els.tituloPrint.textContent = els.titulo.value;
        window.print();
    });
    els.titulo.addEventListener('change', salvarCabecalhoQuadro);
    els.titulo.addEventListener('keydown', ev => { if (ev.key === 'Enter') els.titulo.blur(); });
    if (els.dataInicio) els.dataInicio.addEventListener('change', salvarCabecalhoQuadro);
    if (els.dataFim) els.dataFim.addEventListener('change', salvarCabecalhoQuadro);

    window.addEventListener('beforeunload', ev => {
        if (state.pendentes > 0 || modal.pendente) {
            ev.preventDefault();
            ev.returnValue = '';
        }
    });

    // =================================================================== inicialização

    async function inicializar() {
        const params = new URLSearchParams(window.location.search);
        const urlCriancaId = params.get('criancaId') || CFG.criancaSelecionada;
        if (!els.selCrianca.options.length) {
            try {
                const criancas = await api.get('/api/criancas');
                els.selCrianca.innerHTML = criancas.map(c =>
                    `<option value="${c.id}">${esc(c.nome)}</option>`
                ).join('');
                const emptyEl = document.getElementById('emptyState');
                const mainEl = document.getElementById('sheetMain');
                if (emptyEl && mainEl) {
                    emptyEl.hidden = criancas.length > 0;
                    mainEl.hidden = criancas.length === 0;
                }
            } catch (e) {
                toast(e.message, 'erro');
                return;
            }
        }
        const inicial = urlCriancaId || els.selCrianca.value;
        if (inicial) {
            els.selCrianca.value = String(inicial);
            await carregarCrianca(els.selCrianca.value || inicial);
        }
    }

    inicializar();
})();

