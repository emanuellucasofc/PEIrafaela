/* =====================================================================
   PEI — utilitários compartilhados: cliente REST (Fetch API), toasts,
   escape de HTML e debounce.
   ===================================================================== */
(function () {
    'use strict';

    async function request(method, url, body) {
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

    window.PEI = {
        api: {
            get: url => request('GET', url),
            post: (url, body) => request('POST', url, body),
            put: (url, body) => request('PUT', url, body),
            del: url => request('DELETE', url)
        },
        toast, esc, debounce, corClara, formatarData
    };
})();

