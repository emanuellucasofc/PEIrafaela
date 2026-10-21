/* =====================================================================
   PEI — utilitários compartilhados: cliente REST (Fetch API), toasts,
   escape de HTML e debounce.
   ===================================================================== */
(function () {
    'use strict';

    const OCULTOS_SESSAO_KEY = 'pei_itens_ocultos_sessao_v1';

    function obterItensOcultosSessao() {
        try {
            const raw = window.sessionStorage.getItem(OCULTOS_SESSAO_KEY);
            if (!raw) return new Set();
            const arr = JSON.parse(raw);
            return new Set(Array.isArray(arr) ? arr.map(Number) : []);
        } catch (_) {
            return new Set();
        }
    }

    function ocultarItemSessao(id) {
        try {
            const conj = obterItensOcultosSessao();
            conj.add(Number(id));
            window.sessionStorage.setItem(OCULTOS_SESSAO_KEY, JSON.stringify([...conj]));
        } catch (_) {}
    }

    function restaurarItensSessao() {
        try {
            window.sessionStorage.removeItem(OCULTOS_SESSAO_KEY);
        } catch (_) {}
    }

    async function request(method, url, body) {
        if (method === 'DELETE') {
            const mCat = /^\/api\/catalogo\/(\d+)$/.exec(url);
            if (mCat) {
                ocultarItemSessao(Number(mCat[1]));
                return null;
            }
        }
        if ((method === 'POST' || method === 'PUT') && body !== undefined) {
            const textos = [];
            const extrairStrings = obj => {
                if (typeof obj === 'string') textos.push(obj);
                else if (Array.isArray(obj)) obj.forEach(extrairStrings);
                else if (obj && typeof obj === 'object') Object.values(obj).forEach(extrairStrings);
            };
            extrairStrings(body);
            const achados = verificarOfensas(textos.join(' '), { finalizado: true });
            if (achados.length > 0) {
                exibirAlertaOfensa(achados, null);
                const lista = achados.map(a => `“${a.termo}”`).join(', ');
                throw new Error(`Política de Linguagem: retire a(s) palavra(s) em alerta (${lista}). ${achados[0].motivo}`);
            }
        }
        const opts = { method, headers: { 'Accept': 'application/json' } };
        if (body !== undefined) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        let resp;
        try {
            resp = await fetch(url, opts);
        } catch (e) {
            throw new Error('Falha de conexão com o servidor');
        }
        if (resp.status === 204) return null;
        const text = await resp.text();
        const data = text ? safeJson(text) : null;
        if (!resp.ok) {
            const msg = (data && (data.detail || data.message || data.title)) || ('Erro ' + resp.status);
            const err = new Error(msg);
            err.status = resp.status;
            throw err;
        }
        if (method === 'GET' && url.startsWith('/api/catalogo') && Array.isArray(data)) {
            const ocultos = obterItensOcultosSessao();
            if (ocultos.size > 0) {
                return data.filter(item => !ocultos.has(Number(item.id)));
            }
        }
        return data;
    }

    function safeJson(text) {
        try { return JSON.parse(text); } catch (e) { return null; }
    }

    function toast(msg, tipo) {
        const box = document.getElementById('toasts');
        if (!box) { console.log(msg); return; }
        const el = document.createElement('div');
        el.className = 'toast' + (tipo ? ' ' + tipo : '');
        el.textContent = msg;
        box.appendChild(el);
        setTimeout(() => {
            el.style.transition = 'opacity .3s';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 300);
        }, tipo === 'erro' ? 5000 : 2600);
    }

    function esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function debounce(fn, ms) {
        let t;
        const wrapped = function (...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), ms);
        };
        wrapped.cancel = () => clearTimeout(t);
        return wrapped;
    }

    /** Retorna true se a cor (#RRGGBB) for clara o suficiente para exigir texto escuro. */
    function corClara(hex) {
        const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
        if (!m) return false;
        const n = parseInt(m[1], 16);
        const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
        return L > 0.42;
    }

    function formatarData(iso) {
        if (!iso) return '—';
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    }

    // =====================================================================
    // Política de Linguagem Respeitosa e Ética Clínica (Filtro de Palavrões e Ofensas)
    // =====================================================================

    const MOTIVOS_OFENSA = {
        PALAVRAO: 'Palavrão ou termo de baixo calão. O documento PEI é um registro clínico, pedagógico e familiar, devendo manter linguagem profissional e respeitosa.',
        CAPACITISMO: 'Termo capacitista, estigmatizante ou pejorativo. Na atuação clínica e educacional (PEI), rótulos depreciativos sobre a criança são proibidos; descreva apenas comportamentos observáveis de forma técnica e acolhedora.',
        DISCRIMINACAO: 'Termo discriminatório, preconceituoso ou discurso de ódio, incompatível com a dignidade humana e a ética profissional.',
        AGRESSAO: 'Linguagem hostil, humilhante ou agressiva, incompatível com o ambiente terapêutico e de proteção à criança.'
    };

    const REGRAS_OFENSA = [
        {
            categoria: 'PALAVRAO',
            termos: [
                'merda', 'merdinha', 'bosta', 'bostinha', 'porra', 'caralho', 'cacete',
                'puta', 'puto', 'putinha', 'putaria', 'foda', 'foder', 'fode', 'fodido', 'fodida',
                'fuder', 'fudeu', 'fudido', 'fudida', 'foda-se', 'fodase',
                'cuzao', 'cuzona', 'buceta', 'boceta', 'xoxota', 'piroca', 'punheta', 'siririca',
                'arrombado', 'arrombada', 'corno', 'corna', 'babaca', 'otario', 'otaria',
                'trouxa', 'escroto', 'escrota', 'safado', 'safada', 'vagabundo', 'vagabunda',
                'canalha', 'cretino', 'cretina', 'pilantra', 'desgracado', 'desgracada',
                'pqp', 'vsf', 'vtnc', 'fdp', 'filho da puta', 'filha da puta',
                'vai tomar no cu', 'tomar no cu', 'vai se foder', 'vai se fuder'
            ]
        },
        {
            categoria: 'CAPACITISMO',
            termos: [
                'retardado', 'retardada', 'mongoloide', 'mongol', 'debil mental', 'demente',
                'aleijado', 'aleijada', 'defeituoso', 'defeituosa', 'anormal',
                'maluco', 'maluca', 'doido', 'doida', 'louco', 'louca',
                'burro', 'burra', 'idiota', 'imbecil', 'estupido', 'estupida',
                'jumento', 'anta', 'asno', 'inutil', 'imprestavel',
                'preguicoso', 'preguicosa', 'birrento', 'birrenta', 'mimado', 'mimada',
                'insuportavel', 'praga', 'peste', 'monstro', 'aberracao', 'doente mental'
            ]
        },
        {
            categoria: 'DISCRIMINACAO',
            termos: [
                'viado', 'veado', 'viadinho', 'bicha', 'sapatao', 'traveco', 'boiola',
                'crioulo', 'favelado', 'favelada', 'nazista', 'racista'
            ]
        },
        {
            categoria: 'AGRESSAO',
            termos: [
                'espancar', 'surrar', 'bater na crianca', 'nojento', 'nojenta',
                'verme', 'miseravel', 'lixo humano'
            ]
        }
    ];

    function normalizarSemAcento(str) {
        return String(str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    function escaparRegex(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Analisa um texto e retorna a lista de palavras/expressões ofensivas encontradas
     * junto com a justificativa da política.
     */
    function verificarOfensas(texto, opcoes) {
        if (!texto || !String(texto).trim()) return [];
        const original = String(texto);
        const norm = normalizarSemAcento(original);
        const encontradas = [];
        const jaVistas = new Set();

        for (const grupo of REGRAS_OFENSA) {
            for (const termo of grupo.termos) {
                const padrao = `(?:^|[^a-z0-9])(${escaparRegex(termo)})(?=$|[^a-z0-9])`;
                const rx = new RegExp(padrao, 'gi');
                let m;
                while ((m = rx.exec(norm)) !== null) {
                    const inicio = m.index + m[0].length - m[1].length;
                    const trechoOriginal = original.slice(inicio, inicio + m[1].length);
                    const chaveTermo = m[1].toLowerCase();
                    if (!jaVistas.has(chaveTermo)) {
                        jaVistas.add(chaveTermo);
                        encontradas.push({
                            termo: trechoOriginal,
                            termoNorm: chaveTermo,
                            categoria: grupo.categoria,
                            motivo: MOTIVOS_OFENSA[grupo.categoria]
                        });
                    }
                }
            }
        }

        // Caso especial da palavra curta "cu": evita falso positivo enquanto a pessoa está digitando "cuidar"/"cubo"
        const rxCu = /(?:^|[^a-z0-9])(cu)(?=$|[^a-z0-9])/gi;
        let mCu;
        while ((mCu = rxCu.exec(norm)) !== null) {
            const inicio = mCu.index + mCu[0].length - mCu[1].length;
            const noFinalDigitando = (inicio + 2 === norm.length) && !(opcoes && opcoes.finalizado);
            if (!noFinalDigitando && !jaVistas.has('cu')) {
                jaVistas.add('cu');
                encontradas.push({
                    termo: original.slice(inicio, inicio + 2),
                    termoNorm: 'cu',
                    categoria: 'PALAVRAO',
                    motivo: MOTIVOS_OFENSA.PALAVRAO
                });
            }
        }

        return encontradas;
    }

    /** Remove do texto todas as palavras ofensivas detectadas. */
    function removerOfensasTexto(texto) {
        if (!texto) return '';
        let resultado = String(texto);
        const achados = verificarOfensas(resultado, { finalizado: true });
        if (!achados.length) return resultado;

        // Reconstrói substituindo os trechos correspondentes no texto normalizado
        for (const item of achados) {
            const termoNorm = item.termoNorm;
            let norm = normalizarSemAcento(resultado);
            const rx = new RegExp(`(^|[^a-z0-9])(${escaparRegex(termoNorm)})(?=$|[^a-z0-9])`, 'i');
            let match;
            let seguranca = 0;
            while ((match = rx.exec(norm)) !== null && seguranca++ < 30) {
                const start = match.index + match[1].length;
                const len = match[2].length;
                resultado = (resultado.slice(0, start) + resultado.slice(start + len))
                    .replace(/\s{2,}/g, ' ');
                norm = normalizarSemAcento(resultado);
            }
        }
        return resultado.trim();
    }

    let ultimoInputComOfensa = null;

    function obterOuCriarBannerOfensa() {
        let banner = document.getElementById('alertaOfensaBanner');
        if (banner) return banner;
        banner = document.createElement('div');
        banner.id = 'alertaOfensaBanner';
        banner.className = 'alerta-ofensa-banner no-print';
        banner.setAttribute('role', 'alert');
        banner.setAttribute('aria-live', 'assertive');
        banner.hidden = true;
        document.body.appendChild(banner);
        banner.addEventListener('click', ev => {
            if (ev.target.closest('[data-retirar-ofensa]')) {
                limparOfensasDeTodosCampos();
            } else if (ev.target.closest('[data-fechar-alerta-ofensa]')) {
                banner.hidden = true;
            }
        });
        return banner;
    }

    function exibirAlertaOfensa(achados, inputAlvo) {
        const banner = obterOuCriarBannerOfensa();
        if (!achados || !achados.length) {
            banner.hidden = true;
            return;
        }
        if (inputAlvo) ultimoInputComOfensa = inputAlvo;

        const tagsHtml = achados.map(a =>
            `<span class="ofensa-tag">“${esc(a.termo)}”</span>`
        ).join(' ');

        const motivosUnicos = [...new Set(achados.map(a => a.motivo))];
        const motivosHtml = motivosUnicos.map(m => `<li>${esc(m)}</li>`).join('');

        banner.innerHTML = `
            <div class="alerta-ofensa-conteudo">
                <div class="alerta-ofensa-topo">
                    <span class="alerta-ofensa-icone" aria-hidden="true">⚠️</span>
                    <div>
                        <strong class="alerta-ofensa-titulo">Política de Linguagem do PEI — Palavra em alerta detectada!</strong>
                        <p class="alerta-ofensa-sub">
                            Solicitamos que retire a(s) palavra(s): ${tagsHtml}
                        </p>
                    </div>
                </div>
                <div class="alerta-ofensa-motivo">
                    <strong>Por que esta palavra deve ser retirada:</strong>
                    <ul>${motivosHtml}</ul>
                </div>
                <div class="alerta-ofensa-acoes">
                    <button type="button" class="btn btn-sm alerta-ofensa-btn-retirar" data-retirar-ofensa>
                        Retirar palavra(s) ofensiva(s) agora
                    </button>
                </div>
            </div>
        `;
        banner.hidden = false;
    }

    function inspecionarCampo(el, finalizado) {
        if (!el || !('value' in el)) return [];
        const tipo = (el.type || '').toLowerCase();
        if (tipo === 'date' || tipo === 'color' || tipo === 'checkbox' || tipo === 'hidden') return [];

        const achados = verificarOfensas(el.value, { finalizado });
        el.classList.toggle('input-ofensa-alerta', achados.length > 0);

        if (achados.length > 0) {
            exibirAlertaOfensa(achados, el);
        } else {
            atualizarEstadoGlobalOfensas();
        }
        return achados;
    }

    function coletarTodasOfensasNaPagina() {
        const campos = document.querySelectorAll('input[type="text"], input[type="search"], textarea');
        const todas = [];
        let primeiroCampo = null;
        campos.forEach(c => {
            const achados = verificarOfensas(c.value, { finalizado: true });
            c.classList.toggle('input-ofensa-alerta', achados.length > 0);
            if (achados.length > 0) {
                if (!primeiroCampo) primeiroCampo = c;
                achados.forEach(a => {
                    if (!todas.some(x => x.termoNorm === a.termoNorm)) {
                        todas.push(a);
                    }
                });
            }
        });
        document.querySelectorAll('.texto-livre').forEach(span => {
            const achados = verificarOfensas(span.textContent, { finalizado: true });
            span.classList.toggle('texto-ofensa-alerta', achados.length > 0);
            if (achados.length > 0) {
                achados.forEach(a => {
                    if (!todas.some(x => x.termoNorm === a.termoNorm)) {
                        todas.push(a);
                    }
                });
            }
        });
        return { todas, primeiroCampo };
    }

    function atualizarEstadoGlobalOfensas() {
        const { todas, primeiroCampo } = coletarTodasOfensasNaPagina();
        if (todas.length > 0) {
            exibirAlertaOfensa(todas, primeiroCampo);
        } else {
            const banner = document.getElementById('alertaOfensaBanner');
            if (banner) banner.hidden = true;
        }
    }

    function limparOfensasDeTodosCampos() {
        const campos = document.querySelectorAll('input[type="text"], input[type="search"], textarea');
        let algumLimpo = false;
        campos.forEach(c => {
            const achados = verificarOfensas(c.value, { finalizado: true });
            if (achados.length > 0) {
                c.value = removerOfensasTexto(c.value);
                c.classList.remove('input-ofensa-alerta');
                c.dispatchEvent(new Event('input', { bubbles: true }));
                c.dispatchEvent(new Event('change', { bubbles: true }));
                algumLimpo = true;
            }
        });
        document.dispatchEvent(new CustomEvent('pei:limpar-ofensas'));
        atualizarEstadoGlobalOfensas();
        if (algumLimpo) {
            toast('Palavra(s) imprópria(s) retirada(s) conforme a política do site.', 'sucesso');
            if (ultimoInputComOfensa) ultimoInputComOfensa.focus();
        }
    }

    // Monitoramento automático em tempo real em todos os campos de texto do site
    document.addEventListener('input', ev => {
        const el = ev.target;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
            inspecionarCampo(el, false);
        }
    }, true);

    document.addEventListener('change', ev => {
        const el = ev.target;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
            inspecionarCampo(el, true);
        }
    }, true);

    document.addEventListener('blur', ev => {
        const el = ev.target;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
            inspecionarCampo(el, true);
        }
    }, true);

    function validarSemOfensasAntesDeAcao() {
        const { todas, primeiroCampo } = coletarTodasOfensasNaPagina();
        if (todas.length > 0) {
            exibirAlertaOfensa(todas, primeiroCampo);
            if (primeiroCampo) primeiroCampo.focus();
            const lista = todas.map(a => `“${a.termo}”`).join(', ');
            toast(`Retire a(s) palavra(s) em alerta (${lista}) antes de continuar.`, 'erro');
            return false;
        }
        return true;
    }

    window.PEI = {
        api: {
            get: url => request('GET', url),
            post: (url, body) => request('POST', url, body),
            put: (url, body) => request('PUT', url, body),
            del: url => request('DELETE', url)
        },
        toast, esc, debounce, corClara, formatarData,
        verificarOfensas, removerOfensasTexto, validarSemOfensasAntesDeAcao,
        obterItensOcultosSessao, ocultarItemSessao, restaurarItensSessao
    };
})();

