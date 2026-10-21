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
        inputCrianca: $('inputCrianca'),
        inputAt: $('inputAt'),
        btnLimparQuadro: $('btnLimparQuadro'),
        btnImprimir: $('btnImprimir'),
        status: $('saveStatus'),
        titulo: $('tituloQuadro'),
        tituloPrint: $('tituloPrint'),
        dataInicio: $('dataInicioQuadro'),
        diaSemana: $('diaSemanaQuadro'),
        metaPeriodoPrint: $('metaPeriodoPrint'),
        metaCrianca: $('metaCrianca'),
        metaAt: $('metaAt'),
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
        btnAutoPreencherModal: $('btnAutoPreencherModal'),
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

    if (!els.grid) return;

    const state = {
        quadro: { id: 0, titulo: 'Planejamento dos Atendimentos' },
        crianca: null,
        celulas: new Map(),
        pendentes: 0,
        temErro: false
    };
    const chave = (linha, col) => `${linha}:${col}`;

    // =================================================================== cabeçalho e estado livre (em memória)

    const DIAS_SEMANA = [
        'domingo',
        'segunda-feira',
        'terça-feira',
        'quarta-feira',
        'quinta-feira',
        'sexta-feira',
        'sábado'
    ];

    function diaDaSemana(iso) {
        if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
        const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        return DIAS_SEMANA[dt.getUTCDay()] || '';
    }

    function formatarDataComDiaSemana(iso) {
        if (!iso) return '—';
        const dataFmt = formatarData(iso);
        const dia = diaDaSemana(iso);
        return dia ? `${dataFmt} - ${dia}` : dataFmt;
    }

    const STORAGE_KEY = 'pei_rascunho_local_v1';

    function salvarRascunhoLocal() {
        try {
            const rascunho = {
                crianca: els.inputCrianca ? els.inputCrianca.value : '',
                at: els.inputAt ? els.inputAt.value : '',
                titulo: els.titulo ? els.titulo.value : 'Planejamento dos Atendimentos',
                dataInicio: els.dataInicio ? els.dataInicio.value : '',
                celulas: Array.from(state.celulas.values()).filter(c =>
                    (c.itensSelecionados && c.itensSelecionados.length > 0) ||
                    (c.textoLivre && c.textoLivre.trim()) ||
                    (c.tipoLinha === 'PROGRAMA' && c.corCabecalho)
                )
            };
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rascunho));
        } catch (_) {
            // ignora caso localStorage esteja indisponível
        }
    }

    function restaurarRascunhoLocal() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            const r = JSON.parse(raw);
            if (!r || typeof r !== 'object') return false;
            state.celulas.clear();
            if (Array.isArray(r.celulas)) {
                r.celulas.forEach(c => {
                    if (c && c.tipoLinha && typeof c.indiceColuna === 'number') {
                        state.celulas.set(chave(c.tipoLinha, c.indiceColuna), {
                            indiceColuna: c.indiceColuna,
                            tipoLinha: c.tipoLinha,
                            corCabecalho: c.corCabecalho || PALETA[c.indiceColuna],
                            itensSelecionados: Array.isArray(c.itensSelecionados) ? c.itensSelecionados : [],
                            textoLivre: c.textoLivre || null
                        });
                    }
                });
            }
            if (els.inputCrianca) els.inputCrianca.value = r.crianca || '';
            if (els.inputAt) els.inputAt.value = r.at || '';
            if (els.dataInicio) els.dataInicio.value = r.dataInicio || '';
            if (els.titulo) els.titulo.value = r.titulo || 'Planejamento dos Atendimentos';
            atualizarTextoPeriodoPrint();
            renderTodas();
            return true;
        } catch (_) {
            return false;
        }
    }

    function atualizarTextoPeriodoPrint() {
        const nome = els.inputCrianca && els.inputCrianca.value.trim() ? els.inputCrianca.value.trim() : '—';
        if (els.metaCrianca) {
            els.metaCrianca.textContent = nome;
        }
        const nomeAt = els.inputAt && els.inputAt.value.trim() ? els.inputAt.value.trim() : '—';
        if (els.metaAt) {
            els.metaAt.textContent = nomeAt;
        }
        const titulo = els.titulo && els.titulo.value.trim() ? els.titulo.value.trim() : 'Planejamento dos Atendimentos';
        if (els.tituloPrint) {
            els.tituloPrint.textContent = titulo;
        }
        const iso = (els.dataInicio && els.dataInicio.value) || '';
        const dia = diaDaSemana(iso);
        if (els.diaSemana) {
            els.diaSemana.textContent = dia ? `- ${dia}` : '';
        }
        if (els.metaData) {
            els.metaData.innerHTML = iso
                ? `Data: <strong>${esc(formatarDataComDiaSemana(iso))}</strong>`
                : 'Data: <strong>—</strong>';
        }
        salvarRascunhoLocal();
    }

    function limparQuadroTodo(silencioso) {
        const tinhaConteudo = Array.from({ length: CFG.totalColunas || 11 }, (_, i) => i).some(colunaTemPrograma)
            || Boolean(els.inputCrianca && els.inputCrianca.value.trim())
            || Boolean(els.inputAt && els.inputAt.value.trim());
        if (!silencioso && tinhaConteudo && !window.confirm('Deseja limpar todo o quadro atual?')) {
            return;
        }
        state.celulas.clear();
        if (els.inputCrianca) els.inputCrianca.value = '';
        if (els.inputAt) els.inputAt.value = '';
        if (els.dataInicio) els.dataInicio.value = '';
        if (els.titulo) els.titulo.value = 'Planejamento dos Atendimentos';
        try { window.localStorage.removeItem(STORAGE_KEY); } catch (_) {}
        atualizarTextoPeriodoPrint();
        renderTodas();
        if (!silencioso) {
            toast('Quadro limpo e livre para novo preenchimento.', 'sucesso');
        }
    }

    function proximaColunaLivre() {
        const total = CFG.totalColunas || 11;
        for (let col = 0; col < total; col++) {
            if (!colunaTemPrograma(col)) return col;
        }
        return -1;
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
        const primeiraVisivel = visiveis.length ? visiveis[0] : -1;
        const ultimaVisivel = visiveis.length ? visiveis[visiveis.length - 1] : -1;

        els.grid.querySelectorAll('.cell').forEach(el => {
            const col = Number(el.dataset.col);
            const visivel = setVisiveis.has(col);
            el.hidden = !visivel;
            if (el.classList.contains('cell-pink')) {
                el.classList.toggle('col-last', col === ultimaVisivel);
            }
            if (el.classList.contains('cell-programa') && visivel) {
                const btnEsq = el.querySelector('[data-mover-dir="-1"]');
                const btnDir = el.querySelector('[data-mover-dir="1"]');
                if (btnEsq) btnEsq.disabled = col === primeiraVisivel;
                if (btnDir) btnDir.disabled = col === ultimaVisivel;
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
            const barraAcoes = `
                <div class="programa-actions no-print">
                    <span class="programa-actions-group">
                        <button type="button" class="programa-btn" data-mover-coluna="${col}" data-mover-dir="-1" title="Mover programa para a esquerda" aria-label="Mover coluna ${col + 1} para a esquerda">&#9664;</button>
                        <button type="button" class="programa-btn" data-mover-coluna="${col}" data-mover-dir="1" title="Mover programa para a direita" aria-label="Mover coluna ${col + 1} para a direita">&#9654;</button>
                    </span>
                    <span class="programa-actions-group">
                        <button type="button" class="programa-btn" data-autopreencher-coluna="${col}" title="Auto-preencher recursos e atividades vinculados a este programa" aria-label="Auto-preencher coluna ${col + 1}">&#9889;</button>
                        <button type="button" class="programa-remove" data-remover-coluna="${col}" title="Excluir este programa do quadro" aria-label="Excluir programa da coluna ${col + 1}">&times;</button>
                    </span>
                </div>`;
            bloco.innerHTML = (itens.length || texto)
                ? barraAcoes + itens.map(i => `<span class="programa-titulo">${esc(i.titulo)}</span>`).join('') + texto
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

    function moverColuna(col, direcao) {
        const total = CFG.totalColunas || 11;
        const visiveis = [];
        for (let i = 0; i < total; i++) {
            if (colunaTemPrograma(i)) visiveis.push(i);
        }
        const pos = visiveis.indexOf(col);
        const alvoPos = pos + direcao;
        if (pos === -1 || alvoPos < 0 || alvoPos >= visiveis.length) return;
        const colAlvo = visiveis[alvoPos];

        const todasLinhas = ['PROGRAMA', 'RECURSO', 'ATIVIDADE', 'PREFERENCIA', 'OBSERVACAO'];
        todasLinhas.forEach(l => {
            const cA = getCelula(l, col);
            const cB = getCelula(l, colAlvo);
            const tmpItens = cA.itensSelecionados;
            const tmpTexto = cA.textoLivre;
            cA.itensSelecionados = cB.itensSelecionados;
            cA.textoLivre = cB.textoLivre;
            cB.itensSelecionados = tmpItens;
            cB.textoLivre = tmpTexto;
            renderCelula(l, col);
            renderCelula(l, colAlvo);
            salvarCelula(l, col);
            salvarCelula(l, colAlvo);
        });
        atualizarColunasVisiveis();
    }

    async function autoPreencherColuna(col, silencioso) {
        const progs = programasDaColuna(col);
        if (!progs || !progs.length) {
            if (!silencioso) toast('Selecione um programa nesta coluna primeiro.', 'erro');
            return 0;
        }
        try {
            const qs = progs.map(p => `programaId=${encodeURIComponent(p.id)}`).join('&');
            const [recursos, atividades] = await Promise.all([
                api.get(`/api/catalogo?categoria=RECURSO&${qs}`),
                api.get(`/api/catalogo?categoria=ATIVIDADE&${qs}`)
            ]);
            const recSugeridos = recursos.filter(i => i.sugerido);
            const atvSugeridas = atividades.filter(i => i.sugerido);

            let adicionados = 0;
            if (recSugeridos.length) {
                const cRec = getCelula('RECURSO', col);
                const ids = new Set((cRec.itensSelecionados || []).map(i => i.id));
                recSugeridos.forEach(item => {
                    if (!ids.has(item.id)) {
                        cRec.itensSelecionados.push(item);
                        adicionados++;
                    }
                });
                renderCelula('RECURSO', col);
                salvarCelula('RECURSO', col);
            }
            if (atvSugeridas.length) {
                const cAtv = getCelula('ATIVIDADE', col);
                const ids = new Set((cAtv.itensSelecionados || []).map(i => i.id));
                atvSugeridas.forEach(item => {
                    if (!ids.has(item.id)) {
                        cAtv.itensSelecionados.push(item);
                        adicionados++;
                    }
                });
                renderCelula('ATIVIDADE', col);
                salvarCelula('ATIVIDADE', col);
            }

            if (!silencioso) {
                if (adicionados > 0) {
                    toast(`${adicionados} item(ns) sugerido(s) preenchido(s) na Coluna ${col + 1}!`, 'sucesso');
                } else {
                    toast('Todos os recursos e atividades sugeridos deste programa já estão na coluna.', 'sucesso');
                }
            }
            return adicionados;
        } catch (e) {
            if (!silencioso) toast('Erro ao auto-preencher: ' + e.message, 'erro');
            return 0;
        }
    }

    async function autoPreencherNoModal() {
        if (modal.linha === 'PROGRAMA') {
            const cols = [...new Set(modal.colunasAlocadas.values())];
            if (!cols.length) {
                toast('Marque ao menos um programa para auto-preencher.', 'erro');
                return;
            }
            let totalAdicionados = 0;
            for (const cIdx of cols) {
                totalAdicionados += await autoPreencherColuna(cIdx, true);
            }
            toast(
                totalAdicionados > 0
                    ? `Recursos e atividades sugeridos preenchidos (${totalAdicionados} item(ns))!`
                    : 'Os recursos e atividades sugeridos já estavam preenchidos.',
                'sucesso'
            );
            return;
        }

        if (ACEITA_VINCULO.has(modal.linha)) {
            const sugeridos = modal.itens.filter(i => i.sugerido);
            if (!sugeridos.length) {
                toast('Nenhum item sugerido vinculado ao programa desta coluna.', 'erro');
                return;
            }
            const c = getCelula(modal.linha, modal.col);
            const ids = new Set(c.itensSelecionados.map(i => i.id));
            let novos = 0;
            sugeridos.forEach(item => {
                if (!ids.has(item.id)) {
                    c.itensSelecionados.push(item);
                    novos++;
                }
            });
            renderLista();
            alterou(true);
            toast(novos > 0 ? `${novos} item(ns) sugerido(s) marcado(s)!` : 'Todos os sugeridos já estão marcados.', 'sucesso');
        }
    }

    function flash(linha, col) {
        const el = cellEl(linha, col);
        if (!el) return;
        el.classList.remove('flash');
        void el.offsetWidth;
        el.classList.add('flash');
    }

    // =================================================================== atualização visual da célula (salva rascunho local no navegador)

    function salvarCelula(linha, col) {
        salvarRascunhoLocal();
        flash(linha, col);
        return Promise.resolve();
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
        if (els.btnAutoPreencherModal) {
            if (modal.linha === 'PROGRAMA') {
                els.btnAutoPreencherModal.hidden = modal.colunasAlocadas.size === 0;
                els.btnAutoPreencherModal.textContent = '⚡ Auto-preencher recursos e atividades sugeridos';
            } else if (ACEITA_VINCULO.has(modal.linha)) {
                const temProg = programasDaColuna(modal.col).length > 0;
                els.btnAutoPreencherModal.hidden = !temProg;
                els.btnAutoPreencherModal.textContent = '⚡ Marcar todos os sugeridos';
            } else {
                els.btnAutoPreencherModal.hidden = true;
            }
        }
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
        const btnMover = ev.target.closest('[data-mover-coluna]');
        if (btnMover) {
            ev.stopPropagation();
            if (!btnMover.disabled) {
                moverColuna(Number(btnMover.dataset.moverColuna), Number(btnMover.dataset.moverDir));
            }
            return;
        }
        const btnAuto = ev.target.closest('[data-autopreencher-coluna]');
        if (btnAuto) {
            ev.stopPropagation();
            autoPreencherColuna(Number(btnAuto.dataset.autopreencherColuna), false);
            return;
        }
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

    if (els.inputCrianca) {
        els.inputCrianca.addEventListener('input', atualizarTextoPeriodoPrint);
        els.inputCrianca.addEventListener('change', atualizarTextoPeriodoPrint);
    }
    if (els.inputAt) {
        els.inputAt.addEventListener('input', atualizarTextoPeriodoPrint);
        els.inputAt.addEventListener('change', atualizarTextoPeriodoPrint);
    }
    if (els.btnLimparQuadro) {
        els.btnLimparQuadro.addEventListener('click', () => limparQuadroTodo(false));
    }
    if (els.btnAutoPreencherModal) els.btnAutoPreencherModal.addEventListener('click', autoPreencherNoModal);
    if (els.btnAddPrograma) els.btnAddPrograma.addEventListener('click', adicionarPrograma);
    if (els.btnPrimeiroPrograma) els.btnPrimeiroPrograma.addEventListener('click', adicionarPrograma);
    els.btnImprimir.addEventListener('click', () => {
        atualizarTextoPeriodoPrint();
        window.print();
    });
    els.titulo.addEventListener('input', atualizarTextoPeriodoPrint);
    els.titulo.addEventListener('change', atualizarTextoPeriodoPrint);
    els.titulo.addEventListener('keydown', ev => { if (ev.key === 'Enter') els.titulo.blur(); });
    if (els.dataInicio) {
        els.dataInicio.addEventListener('input', atualizarTextoPeriodoPrint);
        els.dataInicio.addEventListener('change', atualizarTextoPeriodoPrint);
    }

    // =================================================================== inicialização

    function inicializar() {
        const emptyEl = document.getElementById('emptyState');
        const mainEl = document.getElementById('sheetMain');
        if (emptyEl) emptyEl.hidden = true;
        if (mainEl) mainEl.hidden = false;
        if (!restaurarRascunhoLocal()) {
            limparQuadroTodo(true);
        }
    }

    inicializar();
})();

