/* =====================================================================
   PEI — Quadro Semanal de Planejamento dos Atendimentos
   - Colunas: Segunda a Sexta-feira
   - Linhas: Programas (20 por dia), Atividades planejadas e Recursos
     utilizados (linha N = programa N) e Observações do dia
   - Seleção via modal a partir do banco de dados (/api/catalogo)
   - Estado livre por pessoa: rascunho salvo apenas no navegador local
   ===================================================================== */
(function () {
    'use strict';

    const { api, toast, esc, debounce, formatarData } = window.PEI;

    const N = 20;
    const STORAGE_KEY = 'pei_rascunho_semana_v2';

    const DIAS = [
        { k: 'SEG', nome: 'Segunda-feira', css: 'dia-seg', cor: '#F7C6D6' },
        { k: 'TER', nome: 'Terça-feira',   css: 'dia-ter', cor: '#DCD2F6' },
        { k: 'QUA', nome: 'Quarta-feira',  css: 'dia-qua', cor: '#C8EEDF' },
        { k: 'QUI', nome: 'Quinta-feira',  css: 'dia-qui', cor: '#FBE7A9' },
        { k: 'SEX', nome: 'Sexta-feira',   css: 'dia-sex', cor: '#CBE2F8' }
    ];
    const DIA_POR_K = Object.fromEntries(DIAS.map(d => [d.k, d]));

    const TIPOS = {
        PROGRAMA:  { nome: 'Programas',             singular: 'programa' },
        ATIVIDADE: { nome: 'Atividades planejadas', singular: 'atividade' },
        RECURSO:   { nome: 'Recursos utilizados',   singular: 'recurso' }
    };
    const CHAVE_LISTA = { ATIVIDADE: 'atividades', RECURSO: 'recursos' };

    const ICONES = {
        DIA: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="3"/><line x1="3" y1="9.5" x2="21" y2="9.5"/><line x1="8" y1="2.5" x2="8" y2="6.5"/><line x1="16" y1="2.5" x2="16" y2="6.5"/><circle cx="8" cy="14" r=".6"/><circle cx="12" cy="14" r=".6"/><circle cx="16" cy="14" r=".6"/><circle cx="8" cy="17.5" r=".6"/><circle cx="12" cy="17.5" r=".6"/></svg>',
        PROGRAMA: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>',
        ATIVIDADE: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5l4 4L8 20H4v-4z"/><line x1="13.5" y1="6.5" x2="17.5" y2="10.5"/></svg>',
        RECURSO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v4.5c0 1.66 3.58 3 8 3s8-1.34 8-3V5.5"/><path d="M4 10v4.5c0 1.66 3.58 3 8 3s8-1.34 8-3V10"/><path d="M4 14.5V19c0 1.66 3.58 3 8 3s8-1.34 8-3v-4.5"/></svg>',
        OBSERVACAO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2.5 14.9 8.6 21.5 9.4 16.6 13.9 17.9 20.5 12 17.2 6.1 20.5 7.4 13.9 2.5 9.4 9.1 8.6"/></svg>'
    };

    const $ = id => document.getElementById(id);
    const els = {
        grid: $('semanaGrid'),
        meta: $('semanaMeta'),
        inputCrianca: $('inputCrianca'),
        inputAt: $('inputAt'),
        inputSupervisao: $('inputSupervisao'),
        inputSemana: $('inputSemana'),
        btnLimparQuadro: $('btnLimparQuadro'),
        btnImprimir: $('btnImprimir'),
        // modal
        modal: $('modal'),
        modalHeader: $('modalHeader'),
        modalKicker: $('modalKicker'),
        modalTitulo: $('modalTitulo'),
        modalStatus: $('modalStatus'),
        contexto: $('contextoPrograma'),
        tituloSelecionados: $('tituloSelecionados'),
        selecionados: $('selecionados'),
        busca: $('buscaItem'),
        lista: $('listaItens'),
        quickAdd: $('quickAdd'),
        qaForm: $('quickAddForm'),
        qaTitulo: $('qaTitulo'),
        qaDescricao: $('qaDescricao'),
        qaVinculoWrap: $('qaVinculoWrap'),
        qaPrograma: $('qaPrograma'),
        textoWrap: $('textoWrap'),
        textoLivre: $('textoLivre'),
        btnLimpar: $('btnLimparCelula')
    };

    if (!els.grid) return;

    // =================================================================== estado

    function novaLinha() { return { itens: [], texto: '' }; }

    function novoDia() {
        return {
            programas: Array(N).fill(null),
            marcados: Array(N).fill(false),
            atividades: Array.from({ length: N }, novaLinha),
            recursos: Array.from({ length: N }, novaLinha),
            observacoes: ''
        };
    }

    const state = { dias: {} };
    function resetarDias() { DIAS.forEach(d => { state.dias[d.k] = novoDia(); }); }
    resetarDias();

    // =================================================================== datas

    function isoParaUTC(iso) {
        if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
        const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d));
    }

    function utcParaIso(dt) { return dt.toISOString().slice(0, 10); }

    /** Datas (ISO) de segunda a sexta da semana que contém a data escolhida. */
    function datasDaSemana() {
        const base = isoParaUTC(els.inputSemana && els.inputSemana.value);
        if (!base) return null;
        const dow = base.getUTCDay(); // 0 = domingo
        const deltaSegunda = dow === 0 ? 1 : (dow === 6 ? 2 : 1 - dow);
        const segunda = new Date(base.getTime() + deltaSegunda * 86400000);
        return DIAS.map((_, i) => utcParaIso(new Date(segunda.getTime() + i * 86400000)));
    }

    // =================================================================== montagem da grade

    function rotulo(icone, titulo, sub, extraClass) {
        return `<div class="sem-label ${extraClass || ''}">
            <span class="sem-label-icone" aria-hidden="true">${ICONES[icone]}</span>
            <span class="sem-label-texto">${titulo}${sub ? `<small>${sub}</small>` : ''}</span>
        </div>`;
    }

    function slotsHtml(tipo, diaK) {
        let html = '';
        for (let i = 0; i < N; i++) {
            if (tipo === 'PROGRAMA') {
                html += `<div class="slot slot-prog" data-slot="${i}">
                    <input type="checkbox" class="slot-check" data-check="${diaK}:${i}" aria-label="Marcar programa ${i + 1} de ${DIA_POR_K[diaK].nome}">
                    <span class="slot-num">${i + 1}.</span>
                    <span class="slot-linha" tabindex="0" role="button" data-abrir="PROGRAMA" data-dia="${diaK}" data-i="${i}"></span>
                </div>`;
            } else {
                html += `<div class="slot slot-traco" data-slot="${i}">
                    <span class="slot-num">${i + 1}.</span>
                    <span class="slot-linha" tabindex="0" role="button" data-abrir="${tipo}" data-dia="${diaK}" data-i="${i}"></span>
                </div>`;
            }
        }
        return html;
    }

    function montarGrade() {
        let html = '';
        // Linha: DIA
        html += `<div class="sem-label sem-label-dia"><span class="sem-label-icone" aria-hidden="true">${ICONES.DIA}</span><span class="sem-label-texto">DIA</span></div>`;
        DIAS.forEach(d => {
            html += `<div class="dia-head ${d.css}"><span class="coracao" aria-hidden="true">♥</span>
                <span class="dia-nome">${d.nome.toUpperCase()}</span>
                <span class="dia-data" data-data="${d.k}"></span></div>`;
        });
        // Linha: PROGRAMAS
        html += rotulo('PROGRAMA', 'PROGRAMAS', '');
        DIAS.forEach(d => {
            html += `<div class="bloco bloco-prog ${d.css}" data-bloco="PROGRAMA:${d.k}">
                <div class="lista-1col">${slotsHtml('PROGRAMA', d.k)}</div>
                <button type="button" class="btn-add-dia no-print" data-add-dia="PROGRAMA:${d.k}">+ Adicionar programa</button>
            </div>`;
        });
        // Linha: ATIVIDADES
        html += rotulo('ATIVIDADE', 'ATIVIDADES PLANEJADAS', '(de cada programa)');
        DIAS.forEach(d => {
            html += `<div class="bloco ${d.css}" data-bloco="ATIVIDADE:${d.k}">
                <div class="lista-1col">${slotsHtml('ATIVIDADE', d.k)}</div>
                <button type="button" class="btn-add-dia no-print" data-add-dia="ATIVIDADE:${d.k}">+ Adicionar atividade</button>
            </div>`;
        });
        // Linha: RECURSOS
        html += rotulo('RECURSO', 'RECURSOS UTILIZADOS', '(de cada programa)');
        DIAS.forEach(d => {
            html += `<div class="bloco ${d.css}" data-bloco="RECURSO:${d.k}">
                <div class="lista-1col">${slotsHtml('RECURSO', d.k)}</div>
                <button type="button" class="btn-add-dia no-print" data-add-dia="RECURSO:${d.k}">+ Adicionar recurso</button>
            </div>`;
        });
        // Linha: OBSERVAÇÕES
        html += rotulo('OBSERVACAO', 'OBSERVAÇÕES DO DIA', '');
        DIAS.forEach(d => {
            html += `<div class="bloco bloco-obs ${d.css}">
                <span class="coracao" aria-hidden="true">♥</span>
                <textarea class="obs-textarea" data-obs="${d.k}" maxlength="1500" rows="4"
                    placeholder="Observações de ${d.nome.toLowerCase()}..." aria-label="Observações de ${d.nome}"></textarea>
            </div>`;
        });
        els.grid.innerHTML = html;
    }

    // =================================================================== renderização

    function textoLinha(linha) {
        const itens = (linha.itens || []).map(i => i.titulo).join(', ');
        return { itens, texto: (linha.texto || '').trim() };
    }

    function linhaTemConteudo(linha) {
        return Boolean((linha.itens && linha.itens.length) || (linha.texto && linha.texto.trim()));
    }

    function slotVisivelNoDia(dia, i) {
        return Boolean(dia.programas[i] || linhaTemConteudo(dia.atividades[i]) || linhaTemConteudo(dia.recursos[i]));
    }

    function renderSlot(tipo, diaK, i) {
        const el = els.grid.querySelector(`.slot-linha[data-abrir="${tipo}"][data-dia="${diaK}"][data-i="${i}"]`);
        if (!el) return;
        const slotWrap = el.closest('.slot');
        const dia = state.dias[diaK];
        const visivel = slotVisivelNoDia(dia, i);
        if (slotWrap) slotWrap.hidden = !visivel;

        if (tipo === 'PROGRAMA') {
            const p = dia.programas[i];
            el.innerHTML = p
                ? `<span class="slot-itens">${esc(p.titulo)}</span><button type="button" class="slot-x no-print" data-remover="PROGRAMA:${diaK}:${i}" title="Remover programa" aria-label="Remover ${esc(p.titulo)}">&times;</button>`
                : `<span class="slot-vazio-hint no-print">+ Escolher programa</span>`;
            el.title = p ? p.titulo : `Adicionar programa ${i + 1}`;
            el.classList.toggle('preenchido', Boolean(p));
            const cb = els.grid.querySelector(`[data-check="${diaK}:${i}"]`);
            if (cb) cb.checked = Boolean(dia.marcados[i]);
            return;
        }

        const linha = dia[CHAVE_LISTA[tipo]][i];
        const { itens, texto } = textoLinha(linha);
        const tem = linhaTemConteudo(linha);
        el.innerHTML = tem
            ? `<span class="slot-itens">${esc(itens)}</span>${texto ? `<span class="texto-livre">${itens ? ' — ' : ''}${esc(texto)}</span>` : ''}<button type="button" class="slot-x no-print" data-remover="${tipo}:${diaK}:${i}" title="Limpar linha" aria-label="Limpar linha ${i + 1}">&times;</button>`
            : `<span class="slot-vazio-hint no-print">+ Escolher ${TIPOS[tipo].singular}</span>`;
        el.title = tem ? [itens, texto].filter(Boolean).join(' — ') : `Adicionar ${TIPOS[tipo].singular} da linha ${i + 1}`;
        el.classList.toggle('preenchido', tem);
    }

    function renderDia(diaK) {
        for (let i = 0; i < N; i++) {
            renderSlot('PROGRAMA', diaK, i);
            renderSlot('ATIVIDADE', diaK, i);
            renderSlot('RECURSO', diaK, i);
        }
        const ta = els.grid.querySelector(`[data-obs="${diaK}"]`);
        if (ta && ta.value !== state.dias[diaK].observacoes) ta.value = state.dias[diaK].observacoes || '';
    }

    function renderTudo() {
        DIAS.forEach(d => renderDia(d.k));
        atualizarCabecalho();
    }

    function atualizarCabecalho() {
        const crianca = els.inputCrianca && els.inputCrianca.value.trim();
        const at = els.inputAt && els.inputAt.value.trim();
        const supervisao = els.inputSupervisao && els.inputSupervisao.value.trim();
        const datas = datasDaSemana();

        DIAS.forEach((d, idx) => {
            const span = els.grid.querySelector(`[data-data="${d.k}"]`);
            if (span) span.textContent = datas ? formatarData(datas[idx]).slice(0, 5) : '';
        });

        const partes = [];
        partes.push(`Paciente: <strong>${crianca ? esc(crianca) : '—'}</strong>`);
        partes.push(`AT: <strong>${at ? esc(at) : '—'}</strong>`);
        partes.push(`Supervisora: <strong>${supervisao ? esc(supervisao) : '—'}</strong>`);
        if (datas) {
            partes.push(`Semana: <strong>${esc(formatarData(datas[0]))} a ${esc(formatarData(datas[4]))}</strong>`);
        }
        if (els.meta) els.meta.innerHTML = partes.join('<span class="meta-sep">·</span>');
        salvarRascunho();
    }

    // =================================================================== rascunho local (sobrevive ao F5)

    function salvarRascunho() {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
                crianca: els.inputCrianca ? els.inputCrianca.value : '',
                at: els.inputAt ? els.inputAt.value : '',
                supervisao: els.inputSupervisao ? els.inputSupervisao.value : '',
                semana: els.inputSemana ? els.inputSemana.value : '',
                dias: state.dias
            }));
        } catch (_) { /* localStorage indisponível */ }
    }

    function normalizarLinha(l) {
        return {
            itens: Array.isArray(l && l.itens) ? l.itens.filter(x => x && x.titulo) : [],
            texto: (l && typeof l.texto === 'string') ? l.texto : ''
        };
    }

    function restaurarRascunho() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            const r = JSON.parse(raw);
            if (!r || typeof r !== 'object' || !r.dias) return false;
            DIAS.forEach(d => {
                const src = r.dias[d.k] || {};
                const dia = novoDia();
                for (let i = 0; i < N; i++) {
                    const p = Array.isArray(src.programas) ? src.programas[i] : null;
                    dia.programas[i] = p && p.titulo ? { id: p.id, titulo: p.titulo } : null;
                    dia.marcados[i] = Boolean(Array.isArray(src.marcados) && src.marcados[i]);
                    dia.atividades[i] = normalizarLinha(Array.isArray(src.atividades) ? src.atividades[i] : null);
                    dia.recursos[i] = normalizarLinha(Array.isArray(src.recursos) ? src.recursos[i] : null);
                }
                dia.observacoes = typeof src.observacoes === 'string' ? src.observacoes : '';
                state.dias[d.k] = dia;
            });
            if (els.inputCrianca) els.inputCrianca.value = r.crianca || '';
            if (els.inputAt) els.inputAt.value = r.at || '';
            if (els.inputSupervisao) els.inputSupervisao.value = r.supervisao || '';
            if (els.inputSemana) els.inputSemana.value = r.semana || '';
            renderTudo();
            return true;
        } catch (_) {
            return false;
        }
    }

    function limparQuadroTodo(silencioso) {
        const temConteudo = DIAS.some(d => {
            const dia = state.dias[d.k];
            return dia.programas.some(Boolean) || dia.atividades.some(linhaTemConteudo)
                || dia.recursos.some(linhaTemConteudo) || (dia.observacoes || '').trim();
        }) || Boolean(els.inputCrianca && els.inputCrianca.value.trim())
          || Boolean(els.inputAt && els.inputAt.value.trim())
          || Boolean(els.inputSupervisao && els.inputSupervisao.value.trim());

        if (!silencioso && temConteudo && !window.confirm('Deseja limpar todo o quadro e começar um novo planejamento?')) {
            return;
        }
        resetarDias();
        if (els.inputCrianca) els.inputCrianca.value = '';
        if (els.inputAt) els.inputAt.value = '';
        if (els.inputSupervisao) els.inputSupervisao.value = '';
        if (els.inputSemana) els.inputSemana.value = '';
        try { window.localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignora */ }
        if (!silencioso && window.PEI.restaurarItensSessao) window.PEI.restaurarItensSessao();
        modal.todosProgramas = null;
        renderTudo();
        if (!silencioso) toast('Novo planejamento iniciado! Todas as opções do banco foram restauradas.', 'sucesso');
    }

    // =================================================================== regras de negócio

    function primeiraLinhaLivre(diaK) {
        return state.dias[diaK].programas.findIndex(p => !p);
    }

    /** Ao adicionar um programa na linha N, preenche atividades/recursos vinculados (se a linha estiver vazia). */
    async function autoPreencherLinha(diaK, i) {
        const p = state.dias[diaK].programas[i];
        if (!p || !p.id) return;
        try {
            const [atividades, recursos] = await Promise.all([
                api.get(`/api/catalogo?categoria=ATIVIDADE&programaId=${encodeURIComponent(p.id)}`),
                api.get(`/api/catalogo?categoria=RECURSO&programaId=${encodeURIComponent(p.id)}`)
            ]);
            const atual = state.dias[diaK].programas[i];
            if (!atual || atual.id !== p.id) return; // mudou enquanto carregava
            const linhaA = state.dias[diaK].atividades[i];
            const linhaR = state.dias[diaK].recursos[i];
            const sugA = atividades.filter(x => x.sugerido);
            const sugR = recursos.filter(x => x.sugerido);
            if (!linhaTemConteudo(linhaA) && sugA.length) {
                linhaA.itens = sugA.map(x => ({ id: x.id, titulo: x.titulo }));
                renderSlot('ATIVIDADE', diaK, i);
            }
            if (!linhaTemConteudo(linhaR) && sugR.length) {
                linhaR.itens = sugR.map(x => ({ id: x.id, titulo: x.titulo }));
                renderSlot('RECURSO', diaK, i);
            }
            salvarRascunho();
        } catch (_) { /* sugestões são opcionais */ }
    }

    function adicionarPrograma(diaK, item, preferencia) {
        const dia = state.dias[diaK];
        if (dia.programas.some(p => p && p.id === item.id)) return true;
        let idx = (preferencia != null && !dia.programas[preferencia]) ? preferencia : primeiraLinhaLivre(diaK);
        if (idx === -1) {
            toast('Limite máximo de programas deste dia atingido.', 'erro');
            return false;
        }
        dia.programas[idx] = { id: item.id, titulo: item.titulo };
        dia.marcados[idx] = false;
        renderDia(diaK);
        flash(diaK, idx);
        salvarRascunho();
        autoPreencherLinha(diaK, idx);
        return true;
    }

    function removerPrograma(diaK, i) {
        const dia = state.dias[diaK];
        if (!slotVisivelNoDia(dia, i)) return;
        dia.programas.splice(i, 1);
        dia.programas.push(null);
        dia.marcados.splice(i, 1);
        dia.marcados.push(false);
        dia.atividades.splice(i, 1);
        dia.atividades.push(novaLinha());
        dia.recursos.splice(i, 1);
        dia.recursos.push(novaLinha());
        renderDia(diaK);
        salvarRascunho();
    }

    function limparLinha(tipo, diaK, i) {
        state.dias[diaK][CHAVE_LISTA[tipo]][i] = novaLinha();
        renderDia(diaK);
        salvarRascunho();
    }

    function flash(diaK, i) {
        const el = els.grid.querySelector(`.slot-linha[data-abrir="PROGRAMA"][data-dia="${diaK}"][data-i="${i}"]`);
        if (!el) return;
        el.classList.remove('flash');
        void el.offsetWidth;
        el.classList.add('flash');
    }

    // =================================================================== modal

    const modal = {
        tipo: null,
        dia: null,
        slot: null,
        itens: [],
        seqBusca: 0,
        origem: null,
        todosProgramas: null
    };

    function linhaModal() {
        return state.dias[modal.dia][CHAVE_LISTA[modal.tipo]][modal.slot];
    }

    async function abrirModal(tipo, diaK, i, origem) {
        modal.tipo = tipo;
        modal.dia = diaK;
        modal.slot = i;
        modal.origem = origem || null;
        modal.itens = [];

        const d = DIA_POR_K[diaK];
        els.modalHeader.style.background = d.cor;
        els.modalStatus.textContent = '';

        if (tipo === 'PROGRAMA') {
            els.modalKicker.textContent = d.nome;
            els.modalTitulo.textContent = 'Programas do dia';
            els.tituloSelecionados.textContent = 'Programas selecionados neste dia (até 20)';
            els.contexto.hidden = true;
            els.textoWrap.hidden = true;
            els.qaVinculoWrap.hidden = true;
        } else {
            const prog = state.dias[diaK].programas[i];
            els.modalKicker.textContent = `${d.nome} · Linha ${i + 1}`;
            els.modalTitulo.textContent = TIPOS[tipo].nome;
            els.tituloSelecionados.textContent = `Selecionados na linha ${i + 1}`;
            if (prog) {
                els.contexto.innerHTML = `<span>Sugestões priorizadas para o programa ${i + 1}:</span><span class="tag">${esc(prog.titulo)}</span>`;
            } else {
                els.contexto.innerHTML = `<span class="muted">Dica: adicione o <strong>programa ${i + 1}</strong> deste dia para ver primeiro as ${tipo === 'RECURSO' ? 'opções de recursos' : 'atividades'} vinculadas a ele.</span>`;
            }
            els.contexto.hidden = false;
            els.textoWrap.hidden = false;
            els.textoLivre.value = linhaModal().texto || '';
            els.qaVinculoWrap.hidden = false;
            prepararVinculoQuickAdd(prog);
        }

        els.busca.value = '';
        els.quickAdd.open = false;
        els.qaForm.reset();
        renderSelecionados();
        els.lista.innerHTML = '<div class="list-empty">Carregando…</div>';
        els.modal.hidden = false;
        document.body.style.overflow = 'hidden';
        setTimeout(() => els.busca.focus(), 30);
        await buscarItens();
    }

    async function prepararVinculoQuickAdd(prog) {
        if (!modal.todosProgramas) {
            try { modal.todosProgramas = await api.get('/api/catalogo?categoria=PROGRAMA'); }
            catch (_) { modal.todosProgramas = []; }
        }
        const padrao = prog ? prog.id : '';
        els.qaPrograma.innerHTML = '<option value="">— Nenhum (item geral) —</option>' +
            modal.todosProgramas.map(p =>
                `<option value="${p.id}" ${p.id === padrao ? 'selected' : ''}>${esc(p.titulo)}</option>`
            ).join('');
    }

    async function buscarItens() {
        const seq = ++modal.seqBusca;
        const params = new URLSearchParams({ categoria: modal.tipo });
        const termo = els.busca.value.trim();
        if (termo) params.set('busca', termo);
        if (modal.tipo !== 'PROGRAMA') {
            const prog = state.dias[modal.dia].programas[modal.slot];
            if (prog && prog.id) params.append('programaId', prog.id);
        }
        try {
            const itens = await api.get('/api/catalogo?' + params.toString());
            if (seq !== modal.seqBusca) return;
            modal.itens = itens;
            renderLista();
        } catch (e) {
            if (seq === modal.seqBusca) {
                els.lista.innerHTML = `<div class="list-empty">Erro ao carregar itens: ${esc(e.message)}</div>`;
            }
        }
    }

    function idsSelecionados() {
        if (modal.tipo === 'PROGRAMA') {
            return new Set(state.dias[modal.dia].programas.filter(Boolean).map(p => p.id));
        }
        return new Set(linhaModal().itens.map(i => i.id));
    }

    function renderLista() {
        const sel = idsSelecionados();
        const sugeridos = modal.itens.filter(i => i.sugerido);
        const outros = modal.itens.filter(i => !i.sugerido);

        const row = i => `
            <label class="item-row">
                <input type="checkbox" data-id="${i.id}" ${sel.has(i.id) ? 'checked' : ''}>
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
            html += `<div class="item-group-title sugeridos">★ Vinculados ao programa desta linha (${sugeridos.length})</div>`;
            html += sugeridos.map(row).join('');
        }
        if (outros.length) {
            html += `<div class="item-group-title">${sugeridos.length ? 'Outros itens do banco' : 'Itens do banco'} (${outros.length})</div>`;
            html += outros.map(row).join('');
        }
        els.lista.innerHTML = html;
    }

    function renderSelecionados() {
        if (modal.tipo === 'PROGRAMA') {
            const progs = state.dias[modal.dia].programas
                .map((p, idx) => p ? { ...p, idx } : null)
                .filter(Boolean);
            els.selecionados.innerHTML = progs.length
                ? progs.map(p => `<span class="tag">${p.idx + 1}. ${esc(p.titulo)}
                    <button type="button" data-remover-sel="${p.id}" aria-label="Remover ${esc(p.titulo)}">&times;</button></span>`).join('')
                : '<span class="vazio">Nenhum programa selecionado. Marque abaixo — cada programa ocupa uma linha numerada (1 a 20).</span>';
            return;
        }
        const itens = linhaModal().itens;
        els.selecionados.innerHTML = itens.length
            ? itens.map(i => `<span class="tag">${esc(i.titulo)}
                <button type="button" data-remover-sel="${i.id}" aria-label="Remover ${esc(i.titulo)}">&times;</button></span>`).join('')
            : '<span class="vazio">Nenhum item selecionado.</span>';
    }

    function alternarItem(id, marcado) {
        const item = modal.itens.find(i => i.id === id);
        if (modal.tipo === 'PROGRAMA') {
            if (marcado) {
                if (!item) return;
                const ok = adicionarPrograma(modal.dia, item, modal.slot);
                modal.slot = null;
                if (!ok) {
                    const cb = els.lista.querySelector(`input[data-id="${id}"]`);
                    if (cb) cb.checked = false;
                }
            } else {
                const idx = state.dias[modal.dia].programas.findIndex(p => p && p.id === id);
                if (idx !== -1) removerPrograma(modal.dia, idx);
            }
            renderSelecionados();
            return;
        }
        const linha = linhaModal();
        if (marcado) {
            if (item && !linha.itens.some(i => i.id === id)) linha.itens.push({ id: item.id, titulo: item.titulo });
        } else {
            linha.itens = linha.itens.filter(i => i.id !== id);
        }
        renderDia(modal.dia);
        renderSelecionados();
        salvarRascunho();
    }

    async function cadastroRapido(ev) {
        ev.preventDefault();
        const titulo = els.qaTitulo.value.trim();
        if (!titulo) { els.qaTitulo.focus(); toast('Informe o título do novo item.', 'erro'); return; }
        const btn = els.qaForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
            const novo = await api.post('/api/catalogo', {
                categoria: modal.tipo,
                titulo,
                descricao: els.qaDescricao.value.trim() || null,
                programaVinculadoId: modal.tipo !== 'PROGRAMA' && els.qaPrograma.value ? Number(els.qaPrograma.value) : null
            });
            if (modal.tipo === 'PROGRAMA') {
                modal.todosProgramas = null;
                adicionarPrograma(modal.dia, novo, modal.slot);
                modal.slot = null;
            } else {
                linhaModal().itens.push({ id: novo.id, titulo: novo.titulo });
                renderDia(modal.dia);
                salvarRascunho();
            }
            renderSelecionados();
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

    function limparNoModal() {
        if (modal.tipo === 'PROGRAMA') {
            const dia = state.dias[modal.dia];
            if (!dia.programas.some(Boolean)) return;
            if (!window.confirm(`Remover todos os programas de ${DIA_POR_K[modal.dia].nome}?`)) return;
            state.dias[modal.dia] = novoDia();
            renderDia(modal.dia);
            salvarRascunho();
            renderSelecionados();
            renderLista();
            return;
        }
        limparLinha(modal.tipo, modal.dia, modal.slot);
        els.textoLivre.value = '';
        renderSelecionados();
        renderLista();
    }

    function fecharModal() {
        if (els.modal.hidden) return;
        els.modal.hidden = true;
        document.body.style.overflow = '';
        salvarRascunho();
        if (modal.origem && document.body.contains(modal.origem)) modal.origem.focus();
    }

    // =================================================================== eventos

    els.grid.addEventListener('click', ev => {
        const btnRem = ev.target.closest('[data-remover]');
        if (btnRem) {
            ev.stopPropagation();
            const [tipo, diaK, i] = btnRem.dataset.remover.split(':');
            if (tipo === 'PROGRAMA') removerPrograma(diaK, Number(i));
            else limparLinha(tipo, diaK, Number(i));
            return;
        }
        const btnAdd = ev.target.closest('[data-add-dia]');
        if (btnAdd) {
            const [tipo, diaK] = btnAdd.dataset.addDia.split(':');
            const dia = state.dias[diaK];
            if (tipo === 'PROGRAMA') {
                const idx = primeiraLinhaLivre(diaK);
                if (idx === -1) { toast('Limite máximo de programas deste dia atingido.', 'erro'); return; }
                abrirModal('PROGRAMA', diaK, idx, btnAdd);
            } else {
                const lista = dia[CHAVE_LISTA[tipo]];
                let idx = lista.findIndex((l, k) => dia.programas[k] && !linhaTemConteudo(l));
                if (idx === -1) idx = lista.findIndex((l, k) => !slotVisivelNoDia(dia, k));
                if (idx === -1) idx = 0;
                abrirModal(tipo, diaK, idx, btnAdd);
            }
            return;
        }
        const alvo = ev.target.closest('[data-abrir]');
        if (alvo) {
            abrirModal(alvo.dataset.abrir, alvo.dataset.dia, Number(alvo.dataset.i), alvo);
        }
    });

    els.grid.addEventListener('keydown', ev => {
        const alvo = ev.target.closest('[data-abrir]');
        if (alvo && (ev.key === 'Enter' || ev.key === ' ')) {
            ev.preventDefault();
            abrirModal(alvo.dataset.abrir, alvo.dataset.dia, Number(alvo.dataset.i), alvo);
        }
    });

    els.grid.addEventListener('change', ev => {
        const cb = ev.target.closest('[data-check]');
        if (cb) {
            const [diaK, i] = cb.dataset.check.split(':');
            state.dias[diaK].marcados[Number(i)] = cb.checked;
            salvarRascunho();
        }
    });

    els.grid.addEventListener('input', ev => {
        const ta = ev.target.closest('[data-obs]');
        if (ta) {
            state.dias[ta.dataset.obs].observacoes = ta.value;
            salvarRascunho();
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
        const btn = ev.target.closest('[data-remover-sel]');
        if (!btn) return;
        const id = Number(btn.dataset.removerSel);
        const cb = els.lista.querySelector(`input[data-id="${id}"]`);
        if (cb) cb.checked = false;
        alternarItem(id, false);
    });

    els.textoLivre.addEventListener('input', () => {
        if (modal.tipo === 'PROGRAMA' || modal.dia == null) return;
        linhaModal().texto = els.textoLivre.value;
        renderDia(modal.dia);
        salvarRascunho();
    });

    els.qaForm.addEventListener('submit', cadastroRapido);
    els.btnLimpar.addEventListener('click', limparNoModal);

    // Política de linguagem: limpa também os complementos livres guardados no quadro
    document.addEventListener('pei:limpar-ofensas', () => {
        if (!window.PEI.removerOfensasTexto) return;
        let mudou = false;
        DIAS.forEach(d => {
            const dia = state.dias[d.k];
            ['atividades', 'recursos'].forEach(chaveLista => {
                dia[chaveLista].forEach(linha => {
                    if (linha.texto) {
                        const limpo = window.PEI.removerOfensasTexto(linha.texto);
                        if (limpo !== linha.texto) { linha.texto = limpo; mudou = true; }
                    }
                });
            });
        });
        if (mudou) {
            renderTudo();
            toast('Palavra(s) imprópria(s) retirada(s) do quadro.', 'sucesso');
        }
    });

    [els.inputCrianca, els.inputAt, els.inputSupervisao, els.inputSemana].forEach(inp => {
        if (!inp) return;
        inp.addEventListener('input', atualizarCabecalho);
        inp.addEventListener('change', atualizarCabecalho);
    });

    if (els.btnLimparQuadro) els.btnLimparQuadro.addEventListener('click', () => limparQuadroTodo(false));

    els.btnImprimir.addEventListener('click', () => {
        if (window.PEI.validarSemOfensasAntesDeAcao && !window.PEI.validarSemOfensasAntesDeAcao()) return;
        atualizarCabecalho();
        window.print();
    });

    // =================================================================== inicialização

    montarGrade();
    if (!restaurarRascunho()) {
        limparQuadroTodo(true);
    }
})();
