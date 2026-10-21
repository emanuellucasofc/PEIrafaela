// =====================================================================
// PEI — API Serverless para Vercel + Supabase (PostgreSQL)
// Mantém 100% de paridade de rotas, payloads JSON e schema de tabelas
// com os @RestController do Spring Boot (com.pei.controller.*).
// =====================================================================

const { Pool } = require('pg');

const TOTAL_COLUNAS = 11;
const PALETA_COLUNAS = [
    '#FFB5A7', // 1 Coral/Pêssego Pastel
    '#A8DADC', // 2 Azul Céu Pastel
    '#CDB4DB', // 3 Lavanda/Lilás Pastel
    '#FFC8DD', // 4 Rosa Algodão-Doce Pastel
    '#B7E4C7', // 5 Verde Menta Pastel
    '#BDE0FE', // 6 Azul Bebê Pastel
    '#FFE5B4', // 7 Amarelo Baunilha Pastel
    '#D8BBFF', // 8 Malva/Violeta Pastel
    '#BCEAD5', // 9 Verde Água Pastel
    '#FFD6A5', // 10 Damasco/Salmão Pastel
    '#E2C2FF'  // 11 Lilás Suave Pastel
];

const CATEGORIAS = [
    { valor: 'PROGRAMA',    rotuloLinha: 'PROGRAMAS:',                    nome: 'Programas',    aceitaVinculoPrograma: false, ordem: 0 },
    { valor: 'RECURSO',     rotuloLinha: 'RECURSOS A SEREM UTILIZADOS:',  nome: 'Recursos',     aceitaVinculoPrograma: true,  ordem: 1 },
    { valor: 'ATIVIDADE',   rotuloLinha: 'ATIVIDADES PLANEJADAS:',        nome: 'Atividades',   aceitaVinculoPrograma: true,  ordem: 2 },
    { valor: 'PREFERENCIA', rotuloLinha: 'PREFERÊNCIAS DA CRIANÇA',       nome: 'Preferências', aceitaVinculoPrograma: false, ordem: 3 },
    { valor: 'OBSERVACAO',  rotuloLinha: 'OBSERVAÇÕES:',                  nome: 'Observações',  aceitaVinculoPrograma: false, ordem: 4 }
];
const CATEGORIA_ORDEM = Object.fromEntries(CATEGORIAS.map(c => [c.valor, c.ordem]));
const CATEGORIA_SET = new Set(CATEGORIAS.map(c => c.valor));
const ACEITA_VINCULO = new Set(['RECURSO', 'ATIVIDADE']);

let pool = null;
let initPromise = null;

function getConnectionString() {
    return (
        process.env.DATABASE_URL ||
        process.env.POSTGRES_URL ||
        process.env.POSTGRES_URL_NON_POOLING ||
        process.env.POSTGRES_PRISMA_URL ||
        process.env.SUPABASE_DB_URL ||
        ''
    ).trim();
}

function parseDbConfig(rawInput) {
    let raw = (rawInput || '').trim();
    if (!raw) {
        throw httpError(
            500,
            'Banco de dados não configurado. Defina a variável DATABASE_URL nas configurações da Vercel com a URI do Supabase.'
        );
    }

    // Remove eventual prefixo "DATABASE_URL=", aspas externas ou prefixo "jdbc:"
    raw = raw.replace(/^[A-Z0-9_]+\s*=\s*/i, '').trim();
    raw = raw.replace(/^['"]+|['"]+$/g, '').trim();
    raw = raw.replace(/^jdbc:/i, '');

    if (/^https?:\/\//i.test(raw)) {
        throw httpError(
            500,
            'A variável DATABASE_URL contém uma URL https:// (URL da API do projeto) em vez da URI PostgreSQL. No Supabase, clique em Connect -> URI e copie a string que começa com postgresql://postgres...'
        );
    }

    // Extrai user, password (mesmo com @, colchetes ou caracteres especiais), host, port e database
    const m = /^postgres(?:ql)?:\/\/([^:\/]+):(.+)@([^@\/:?#]+)(?::(\d+))?\/([^?#]*)/i.exec(raw);
    if (!m) {
        throw httpError(
            500,
            'Formato de DATABASE_URL inválido. Use a URI do Supabase no formato: postgresql://postgres.[PROJETO]:SUA_SENHA@aws-0-....pooler.supabase.com:6543/postgres'
        );
    }

    const user = decodeURIComponent(m[1]);
    let password = m[2];
    // Caso o usuário tenha mantido os colchetes do template do Supabase: [SUA-SENHA]
    if (password.startsWith('[') && password.endsWith(']')) {
        password = password.slice(1, -1);
    }
    try {
        password = decodeURIComponent(password);
    } catch (_) {
        // mantém literal se contiver % não escapado
    }

    if (/^(YOUR-PASSWORD|SUA-SENHA)$/i.test(password)) {
        throw httpError(
            500,
            'Substitua [YOUR-PASSWORD] pela senha real do banco de dados do Supabase na variável DATABASE_URL da Vercel.'
        );
    }

    const host = m[3];
    const port = m[4] ? Number(m[4]) : 5432;
    const database = (m[5] || 'postgres').trim() || 'postgres';
    const isLocal = /^(localhost|127\.0\.0\.1)$/i.test(host);

    return {
        user,
        password,
        host,
        port,
        database,
        max: 5,
        ssl: isLocal ? false : { rejectUnauthorized: false }
    };
}

function getPool() {
    if (pool) return pool;
    const cfg = parseDbConfig(getConnectionString());
    pool = new Pool(cfg);
    return pool;
}

// --------------------------------------------------------------------- Schema + Seed inicial (idempotente)

async function ensureInitialized() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
        const db = getPool();
        await db.query(`
            CREATE TABLE IF NOT EXISTS criancas (
                id BIGSERIAL PRIMARY KEY,
                nome VARCHAR(150) NOT NULL,
                data_nascimento DATE,
                preferencias_padrao VARCHAR(2000),
                observacoes_gerais VARCHAR(4000)
            );
            CREATE TABLE IF NOT EXISTS itens_catalogo (
                id BIGSERIAL PRIMARY KEY,
                categoria VARCHAR(20) NOT NULL,
                titulo VARCHAR(200) NOT NULL,
                descricao VARCHAR(1000),
                programa_vinculado_id BIGINT REFERENCES itens_catalogo(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS idx_item_categoria ON itens_catalogo(categoria);
            CREATE TABLE IF NOT EXISTS quadros_pei (
                id BIGSERIAL PRIMARY KEY,
                titulo VARCHAR(200) NOT NULL,
                crianca_id BIGINT NOT NULL REFERENCES criancas(id) ON DELETE CASCADE,
                data_criacao DATE,
                data_inicio DATE,
                data_fim DATE
            );
            ALTER TABLE quadros_pei ADD COLUMN IF NOT EXISTS data_inicio DATE;
            ALTER TABLE quadros_pei ADD COLUMN IF NOT EXISTS data_fim DATE;
            CREATE TABLE IF NOT EXISTS celulas_pei (
                id BIGSERIAL PRIMARY KEY,
                quadro_id BIGINT NOT NULL REFERENCES quadros_pei(id) ON DELETE CASCADE,
                indice_coluna INTEGER NOT NULL,
                tipo_linha VARCHAR(20) NOT NULL,
                cor_cabecalho VARCHAR(9),
                texto_livre VARCHAR(4000),
                CONSTRAINT uk_celula_posicao UNIQUE (quadro_id, indice_coluna, tipo_linha)
            );
            CREATE TABLE IF NOT EXISTS celula_itens (
                celula_id BIGINT NOT NULL REFERENCES celulas_pei(id) ON DELETE CASCADE,
                item_id BIGINT NOT NULL REFERENCES itens_catalogo(id) ON DELETE CASCADE,
                ordem INTEGER NOT NULL,
                PRIMARY KEY (celula_id, ordem)
            );
        `);

        const { rows } = await db.query('SELECT COUNT(*)::int AS total FROM criancas');
        if (rows[0].total === 0) {
            await seedDatabase(db);
        }
        await ensureProgramasAdicionais(db);
    })().catch(err => {
        initPromise = null;
        throw err;
    });
    return initPromise;
}

const PROGRAMAS_PADRAO_EXTRAS = [
    'Atenção conjunta prolongada',
    'Imitar vocalizações e sons onomatopaicos',
    'Atendimento a ordens simples de 1 passo',
    'Contato visual sob solicitação verbal',
    'Expansão de vocabulário na pasta PECS (ações e sentimentos)',
    'Indicação de necessidades básicas (água, banheiro, pausa)',
    'Brincadeira de faz de conta funcional (cuidar de boneco, boneca ou atender telefone)',
    'Imitação social e de expressões faciais no espelho',
    'Compartilhamento espontâneo de atenção (apontar para mostrar algo)',
    'Tolerância à frustração e respeito ao turno (esperar a vez)',
    'Reconhecimento de emoções básicas em figuras ou rostos',
    'Enfiamento de contas grossas em cordão',
    'Rasgar e amassar papéis de texturas variadas',
    'Uso seguro de tesoura adaptada (cortes retos)',
    'Traçado de linhas retas e labirintos grossos',
    'Equilíbrio dinâmico (caminhar sobre linha no chão)',
    'Pareamento de cores e formas geométricas',
    'Classificação de objetos por tamanho (grande e pequeno)',
    'Quebra-cabeças de encaixe simples (2 a 4 peças)',
    'Brinquedos de causa e efeito (apertar botão para acionar luz/som)'
];

async function ensureProgramasAdicionais(db) {
    const { rows } = await db.query(
        `SELECT LOWER(titulo) AS t FROM itens_catalogo WHERE categoria = 'PROGRAMA'`
    );
    const existentes = new Set(rows.map(r => r.t));
    for (const titulo of PROGRAMAS_PADRAO_EXTRAS) {
        if (!existentes.has(titulo.toLowerCase())) {
            await db.query(
                `INSERT INTO itens_catalogo (categoria, titulo, descricao, programa_vinculado_id)
                 VALUES ('PROGRAMA', $1, NULL, NULL)`,
                [titulo]
            );
            existentes.add(titulo.toLowerCase());
        }
    }
}

async function seedDatabase(db) {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const check = await client.query('SELECT COUNT(*)::int AS total FROM criancas');
        if (check.rows[0].total > 0) {
            await client.query('COMMIT');
            return;
        }

        const anaRes = await client.query(
            `INSERT INTO criancas (nome, data_nascimento, preferencias_padrao, observacoes_gerais)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [
                'Ana Clara Souza',
                '2020-03-14',
                'Bolhas de sabão, músicas infantis, massinha colorida',
                'Responde bem a reforço social. Evitar ambientes muito ruidosos.'
            ]
        );
        const anaId = Number(anaRes.rows[0].id);

        await client.query(
            `INSERT INTO criancas (nome, data_nascimento, preferencias_padrao, observacoes_gerais)
             VALUES ($1, $2, $3, $4)`,
            [
                'Pedro Henrique Lima',
                '2019-09-02',
                'Carrinhos, dinossauros, brinquedos luminosos',
                'Utiliza prancha de comunicação alternativa. Necessita de rotina visual.'
            ]
        );

        const porTitulo = new Map();
        const addItem = async (categoria, titulo, descricao, programaTitulo) => {
            const progId = programaTitulo ? porTitulo.get(programaTitulo) || null : null;
            const res = await client.query(
                `INSERT INTO itens_catalogo (categoria, titulo, descricao, programa_vinculado_id)
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [categoria, titulo, descricao, progId]
            );
            const id = Number(res.rows[0].id);
            porTitulo.set(titulo, id);
            return id;
        };

        // Programas
        await addItem('PROGRAMA', 'Imitação Motora', 'Imitar ações motoras amplas e finas a partir de um modelo.', null);
        await addItem('PROGRAMA', 'Pareamento Visual', 'Associar itens idênticos ou semelhantes (cores, formas, figuras).', null);
        await addItem('PROGRAMA', 'Comunicação Funcional (PECS)', 'Sistema de comunicação por troca de figuras.', null);
        await addItem('PROGRAMA', 'Atenção Compartilhada', 'Compartilhar o foco de atenção com o terapeuta sobre um objeto/evento.', null);
        await addItem('PROGRAMA', 'Coordenação Motora Fina', 'Desenvolver preensão, pinça e manipulação de pequenos objetos.', null);
        await addItem('PROGRAMA', 'Habilidades Sociais e Brincar', 'Troca de turnos, brincar funcional e simbólico.', null);

        // Recursos
        await addItem('RECURSO', 'Espelho grande', 'Para imitação de expressões e gestos.', 'Imitação Motora');
        await addItem('RECURSO', 'Fantoches', null, 'Imitação Motora');
        await addItem('RECURSO', 'Instrumentos musicais (chocalho, tambor)', null, 'Imitação Motora');
        await addItem('RECURSO', 'Cartões plastificados', 'Figuras plastificadas de cores, objetos e animais.', 'Pareamento Visual');
        await addItem('RECURSO', 'Quebra-cabeça 6 peças', null, 'Pareamento Visual');
        await addItem('RECURSO', 'Formas geométricas de encaixe', null, 'Pareamento Visual');
        await addItem('RECURSO', 'Pasta de comunicação PECS', null, 'Comunicação Funcional (PECS)');
        await addItem('RECURSO', 'Figuras de reforçadores', 'Fotos dos itens preferidos da criança.', 'Comunicação Funcional (PECS)');
        await addItem('RECURSO', 'Tablet com prancha de CAA', 'Comunicação Aumentativa e Alternativa.', 'Comunicação Funcional (PECS)');
        await addItem('RECURSO', 'Pião luminoso', null, 'Atenção Compartilhada');
        await addItem('RECURSO', 'Livro sensorial', null, 'Atenção Compartilhada');
        await addItem('RECURSO', 'Massinha de modelar', null, 'Coordenação Motora Fina');
        await addItem('RECURSO', 'Blocos de montar', null, 'Coordenação Motora Fina');
        await addItem('RECURSO', 'Pinça e pompons', null, 'Coordenação Motora Fina');
        await addItem('RECURSO', 'Bola macia', null, 'Habilidades Sociais e Brincar');
        await addItem('RECURSO', 'Kit de comidinha (brinquedo)', null, 'Habilidades Sociais e Brincar');
        await addItem('RECURSO', 'Cronômetro visual', 'Apoio para tempo de espera e transições.', null);
        await addItem('RECURSO', 'Quadro de rotina visual', null, null);

        // Atividades
        await addItem('ATIVIDADE', 'Imitar movimentos amplos (bater palmas, levantar braços)', null, 'Imitação Motora');
        await addItem('ATIVIDADE', 'Imitação com objetos', null, 'Imitação Motora');
        await addItem('ATIVIDADE', 'Cantar músicas com gestos', null, 'Imitação Motora');
        await addItem('ATIVIDADE', 'Parear cores primárias', null, 'Pareamento Visual');
        await addItem('ATIVIDADE', 'Parear figura com figura idêntica', null, 'Pareamento Visual');
        await addItem('ATIVIDADE', 'Montar quebra-cabeça com apoio', null, 'Pareamento Visual');
        await addItem('ATIVIDADE', 'Troca de figura por item desejado (Fase I)', null, 'Comunicação Funcional (PECS)');
        await addItem('ATIVIDADE', 'Nomeação de figuras', null, 'Comunicação Funcional (PECS)');
        await addItem('ATIVIDADE', 'Construir frase "Eu quero ..."', null, 'Comunicação Funcional (PECS)');
        await addItem('ATIVIDADE', 'Seguir o apontar do terapeuta', null, 'Atenção Compartilhada');
        await addItem('ATIVIDADE', 'Brincadeira "cadê? achou!"', null, 'Atenção Compartilhada');
        await addItem('ATIVIDADE', 'Modelar formas com massinha', null, 'Coordenação Motora Fina');
        await addItem('ATIVIDADE', 'Empilhar blocos (torre de 6)', null, 'Coordenação Motora Fina');
        await addItem('ATIVIDADE', 'Transferir pompons com pinça', null, 'Coordenação Motora Fina');
        await addItem('ATIVIDADE', 'Troca de turno com bola', null, 'Habilidades Sociais e Brincar');
        await addItem('ATIVIDADE', 'Jogo simbólico de comidinha', null, 'Habilidades Sociais e Brincar');

        // Preferências
        for (const t of [
            'Bolhas de sabão', 'Músicas infantis', 'Carrinhos', 'Desenhos no tablet',
            'Massinha colorida', 'Balanço / movimento', 'Brinquedos luminosos', 'Dinossauros'
        ]) {
            await addItem('PREFERENCIA', t, null, null);
        }

        // Observações
        for (const t of [
            'Boa regulação emocional', 'Necessitou de dica física parcial',
            'Necessitou de dica física total', 'Respondeu bem à dica verbal',
            'Realizou de forma independente', 'Baixa tolerância à espera',
            'Engajamento elevado na atividade', 'Sinais de cansaço ao final da sessão'
        ]) {
            await addItem('OBSERVACAO', t, null, null);
        }

        // Quadro de exemplo para Ana Clara
        const hoje = new Date().toISOString().slice(0, 10);
        const qRes = await client.query(
            `INSERT INTO quadros_pei (titulo, crianca_id, data_criacao) VALUES ($1, $2, $3) RETURNING id`,
            ['Planejamento dos Atendimentos - Exemplo', anaId, hoje]
        );
        const quadroId = Number(qRes.rows[0].id);

        const celulaMap = new Map();
        for (const cat of CATEGORIAS) {
            for (let col = 0; col < TOTAL_COLUNAS; col++) {
                const cRes = await client.query(
                    `INSERT INTO celulas_pei (quadro_id, indice_coluna, tipo_linha, cor_cabecalho)
                     VALUES ($1, $2, $3, $4) RETURNING id`,
                    [quadroId, col, cat.valor, PALETA_COLUNAS[col]]
                );
                celulaMap.set(`${cat.valor}:${col}`, Number(cRes.rows[0].id));
            }
        }

        const preencher = async (col, linha, textoLivre, titulos) => {
            const celId = celulaMap.get(`${linha}:${col}`);
            if (textoLivre) {
                await client.query(`UPDATE celulas_pei SET texto_livre = $1 WHERE id = $2`, [textoLivre, celId]);
            }
            for (let idx = 0; idx < titulos.length; idx++) {
                const itemId = porTitulo.get(titulos[idx]);
                if (itemId) {
                    await client.query(
                        `INSERT INTO celula_itens (celula_id, item_id, ordem) VALUES ($1, $2, $3)`,
                        [celId, itemId, idx]
                    );
                }
            }
        };

        await preencher(0, 'PROGRAMA', null, ['Imitação Motora']);
        await preencher(0, 'RECURSO', null, ['Espelho grande', 'Fantoches']);
        await preencher(0, 'ATIVIDADE', 'Iniciar com 3 tentativas por bloco.', [
            'Imitar movimentos amplos (bater palmas, levantar braços)',
            'Cantar músicas com gestos'
        ]);
        await preencher(0, 'PREFERENCIA', null, ['Músicas infantis']);
        await preencher(0, 'OBSERVACAO', null, ['Boa regulação emocional']);

        await preencher(1, 'PROGRAMA', null, ['Pareamento Visual']);
        await preencher(1, 'RECURSO', null, ['Cartões plastificados', 'Quebra-cabeça 6 peças']);
        await preencher(1, 'ATIVIDADE', null, ['Parear cores primárias']);
        await preencher(1, 'PREFERENCIA', null, ['Bolhas de sabão']);
        await preencher(1, 'OBSERVACAO', null, ['Necessitou de dica física parcial']);

        await preencher(2, 'PROGRAMA', null, ['Comunicação Funcional (PECS)']);
        await preencher(2, 'RECURSO', null, ['Pasta de comunicação PECS', 'Figuras de reforçadores']);
        await preencher(2, 'ATIVIDADE', null, ['Troca de figura por item desejado (Fase I)', 'Nomeação de figuras']);
        await preencher(2, 'PREFERENCIA', null, ['Massinha colorida']);

        await preencher(3, 'PROGRAMA', null, ['Atenção Compartilhada']);
        await preencher(3, 'RECURSO', null, ['Pião luminoso']);
        await preencher(3, 'ATIVIDADE', null, ['Seguir o apontar do terapeuta']);

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

// --------------------------------------------------------------------- Helpers HTTP / DTO

function isoDate(val) {
    if (!val) return null;
    if (typeof val === 'string') return val.slice(0, 10);
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    return String(val).slice(0, 10);
}

function mapCrianca(row) {
    return {
        id: Number(row.id),
        nome: row.nome,
        dataNascimento: isoDate(row.data_nascimento),
        preferenciasPadrao: row.preferencias_padrao || null,
        observacoesGerais: row.observacoes_gerais || null
    };
}

function mapItem(row, sugerido = false) {
    return {
        id: Number(row.id),
        categoria: row.categoria,
        titulo: row.titulo,
        descricao: row.descricao || null,
        programaVinculadoId: row.programa_vinculado_id ? Number(row.programa_vinculado_id) : null,
        programaVinculadoTitulo: row.programa_vinculado_titulo || null,
        sugerido: Boolean(sugerido)
    };
}

function httpError(status, detail) {
    const err = new Error(detail);
    err.status = status;
    return err;
}

function sendJson(res, status, data) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
}

async function readBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string' && req.body.trim()) return JSON.parse(req.body);
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', () => {
            if (!raw.trim()) return resolve({});
            try { resolve(JSON.parse(raw)); } catch (e) { reject(httpError(400, 'Corpo da requisição inválido')); }
        });
        req.on('error', reject);
    });
}

// --------------------------------------------------------------------- Operações de Quadro

async function carregarQuadroCompleto(db, quadroId) {
    const qRes = await db.query(
        `SELECT q.id, q.titulo, q.crianca_id, q.data_criacao, q.data_inicio, q.data_fim, c.nome AS crianca_nome
         FROM quadros_pei q
         JOIN criancas c ON c.id = q.crianca_id
         WHERE q.id = $1`,
        [quadroId]
    );
    if (!qRes.rows.length) throw httpError(404, `Quadro PEI não encontrado: ${quadroId}`);
    const q = qRes.rows[0];

    const celRes = await db.query(
        `SELECT id, indice_coluna, tipo_linha, cor_cabecalho, texto_livre
         FROM celulas_pei
         WHERE quadro_id = $1`,
        [quadroId]
    );

    const itensRes = await db.query(
        `SELECT ci.celula_id, ci.ordem,
                i.id, i.categoria, i.titulo, i.descricao, i.programa_vinculado_id,
                p.titulo AS programa_vinculado_titulo
         FROM celula_itens ci
         JOIN celulas_pei cp ON cp.id = ci.celula_id
         JOIN itens_catalogo i ON i.id = ci.item_id
         LEFT JOIN itens_catalogo p ON p.id = i.programa_vinculado_id
         WHERE cp.quadro_id = $1
         ORDER BY ci.celula_id, ci.ordem ASC`,
        [quadroId]
    );

    const itensPorCelula = new Map();
    for (const r of itensRes.rows) {
        const cid = Number(r.celula_id);
        if (!itensPorCelula.has(cid)) itensPorCelula.set(cid, []);
        itensPorCelula.get(cid).push(mapItem(r, false));
    }

    const celulas = celRes.rows
        .map(c => ({
            id: Number(c.id),
            indiceColuna: Number(c.indice_coluna),
            tipoLinha: c.tipo_linha,
            corCabecalho: c.cor_cabecalho,
            itensSelecionados: itensPorCelula.get(Number(c.id)) || [],
            textoLivre: c.texto_livre || null
        }))
        .sort((a, b) =>
            (CATEGORIA_ORDEM[a.tipoLinha] - CATEGORIA_ORDEM[b.tipoLinha]) || (a.indiceColuna - b.indiceColuna)
        );

    return {
        id: Number(q.id),
        titulo: q.titulo,
        criancaId: Number(q.crianca_id),
        criancaNome: q.crianca_nome,
        dataCriacao: isoDate(q.data_criacao),
        dataInicio: isoDate(q.data_inicio),
        dataFim: isoDate(q.data_fim),
        totalColunas: TOTAL_COLUNAS,
        celulas
    };
}

async function criarQuadroEmBranco(db, criancaId, titulo) {
    const cRes = await db.query(`SELECT id, nome FROM criancas WHERE id = $1`, [criancaId]);
    if (!cRes.rows.length) throw httpError(404, `Criança não encontrada: ${criancaId}`);

    const hoje = new Date().toISOString().slice(0, 10);
    const tituloFinal = (titulo && titulo.trim()) ? titulo.trim() : 'Planejamento dos Atendimentos';

    const qRes = await db.query(
        `INSERT INTO quadros_pei (titulo, crianca_id, data_criacao, data_inicio) VALUES ($1, $2, $3, $4) RETURNING id`,
        [tituloFinal, criancaId, hoje, hoje]
    );
    const quadroId = Number(qRes.rows[0].id);

    for (const cat of CATEGORIAS) {
        for (let col = 0; col < TOTAL_COLUNAS; col++) {
            await db.query(
                `INSERT INTO celulas_pei (quadro_id, indice_coluna, tipo_linha, cor_cabecalho)
                 VALUES ($1, $2, $3, $4)`,
                [quadroId, col, cat.valor, PALETA_COLUNAS[col]]
            );
        }
    }
    return carregarQuadroCompleto(db, quadroId);
}

async function atualizarCelula(db, quadroId, req) {
    const col = Number(req.indiceColuna);
    const linha = req.tipoLinha;
    if (!Number.isInteger(col) || col < 0 || col >= TOTAL_COLUNAS) {
        throw httpError(400, 'indiceColuna inválido (0 a 10)');
    }
    if (!CATEGORIA_SET.has(linha)) {
        throw httpError(400, 'tipoLinha inválido');
    }

    const qRes = await db.query(`SELECT id FROM quadros_pei WHERE id = $1`, [quadroId]);
    if (!qRes.rows.length) throw httpError(404, `Quadro PEI não encontrado: ${quadroId}`);

    let celRes = await db.query(
        `SELECT id, cor_cabecalho FROM celulas_pei WHERE quadro_id = $1 AND indice_coluna = $2 AND tipo_linha = $3`,
        [quadroId, col, linha]
    );
    let celulaId;
    let corCabecalho;
    if (!celRes.rows.length) {
        const ins = await db.query(
            `INSERT INTO celulas_pei (quadro_id, indice_coluna, tipo_linha, cor_cabecalho)
             VALUES ($1, $2, $3, $4) RETURNING id, cor_cabecalho`,
            [quadroId, col, linha, PALETA_COLUNAS[col]]
        );
        celulaId = Number(ins.rows[0].id);
        corCabecalho = ins.rows[0].cor_cabecalho;
    } else {
        celulaId = Number(celRes.rows[0].id);
        corCabecalho = celRes.rows[0].cor_cabecalho;
    }

    const ids = Array.isArray(req.itensIds)
        ? [...new Set(req.itensIds.map(Number).filter(Number.isFinite))]
        : [];

    const itensOrdenados = [];
    if (ids.length) {
        const itensRes = await db.query(
            `SELECT i.id, i.categoria, i.titulo, i.descricao, i.programa_vinculado_id,
                    p.titulo AS programa_vinculado_titulo
             FROM itens_catalogo i
             LEFT JOIN itens_catalogo p ON p.id = i.programa_vinculado_id
             WHERE i.id = ANY($1::bigint[])`,
            [ids]
        );
        if (itensRes.rows.length !== ids.length) {
            throw httpError(404, 'Um ou mais itens do catálogo não foram encontrados');
        }
        const porId = new Map(itensRes.rows.map(r => [Number(r.id), r]));
        for (const id of ids) {
            const item = porId.get(id);
            if (item.categoria !== linha) {
                throw httpError(400, `O item "${item.titulo}" pertence à categoria ${item.categoria} e não pode ser usado na linha ${linha}`);
            }
            itensOrdenados.push(mapItem(item, false));
        }
    }

    const textoLivre = req.textoLivre && String(req.textoLivre).trim() ? String(req.textoLivre).trim() : null;
    if (req.corCabecalho && linha === 'PROGRAMA') {
        corCabecalho = String(req.corCabecalho).toUpperCase();
    }

    await db.query(
        `UPDATE celulas_pei SET texto_livre = $1, cor_cabecalho = $2 WHERE id = $3`,
        [textoLivre, corCabecalho, celulaId]
    );
    await db.query(`DELETE FROM celula_itens WHERE celula_id = $1`, [celulaId]);
    for (let idx = 0; idx < ids.length; idx++) {
        await db.query(
            `INSERT INTO celula_itens (celula_id, item_id, ordem) VALUES ($1, $2, $3)`,
            [celulaId, ids[idx], idx]
        );
    }

    return {
        id: celulaId,
        indiceColuna: col,
        tipoLinha: linha,
        corCabecalho,
        itensSelecionados: itensOrdenados,
        textoLivre
    };
}

// --------------------------------------------------------------------- Router Principal

module.exports = async function handler(req, res) {
    try {
        await ensureInitialized();
        const db = getPool();

        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const path = urlObj.pathname.replace(/\/+$/, '') || '/';
        const method = req.method.toUpperCase();

        // ============================================================= /api/catalogo
        if (path === '/api/catalogo/categorias' && method === 'GET') {
            return sendJson(res, 200, CATEGORIAS.map(({ ordem, ...rest }) => rest));
        }

        if (path === '/api/catalogo' && method === 'GET') {
            const categoria = urlObj.searchParams.get('categoria');
            if (categoria && !CATEGORIA_SET.has(categoria)) {
                throw httpError(400, `Valor inválido para o parâmetro 'categoria'`);
            }
            const buscaRaw = urlObj.searchParams.get('busca');
            const busca = buscaRaw && buscaRaw.trim() ? `%${buscaRaw.trim().toLowerCase()}%` : null;
            const programaIds = new Set(
                urlObj.searchParams.getAll('programaId').map(Number).filter(Number.isFinite)
            );

            const { rows } = await db.query(
                `SELECT i.id, i.categoria, i.titulo, i.descricao, i.programa_vinculado_id,
                        p.titulo AS programa_vinculado_titulo
                 FROM itens_catalogo i
                 LEFT JOIN itens_catalogo p ON p.id = i.programa_vinculado_id
                 WHERE ($1::varchar IS NULL OR i.categoria = $1)
                   AND ($2::varchar IS NULL OR LOWER(i.titulo) LIKE $2 OR LOWER(COALESCE(i.descricao, '')) LIKE $2)
                 ORDER BY i.categoria, LOWER(i.titulo)`,
                [categoria || null, busca]
            );

            const dtos = rows
                .map(r => mapItem(r, r.programa_vinculado_id && programaIds.has(Number(r.programa_vinculado_id))))
                .sort((a, b) => Number(b.sugerido) - Number(a.sugerido));

            return sendJson(res, 200, dtos);
        }

        if (path === '/api/catalogo' && method === 'POST') {
            const body = await readBody(req);
            if (!body.categoria || !CATEGORIA_SET.has(body.categoria)) {
                throw httpError(400, 'A categoria é obrigatória');
            }
            if (!body.titulo || !String(body.titulo).trim()) {
                throw httpError(400, 'O título é obrigatório');
            }
            let progId = null;
            let progTitulo = null;
            if (body.programaVinculadoId && ACEITA_VINCULO.has(body.categoria)) {
                const pRes = await db.query(`SELECT id, categoria, titulo FROM itens_catalogo WHERE id = $1`, [body.programaVinculadoId]);
                if (!pRes.rows.length) throw httpError(404, `Item do catálogo não encontrado: ${body.programaVinculadoId}`);
                if (pRes.rows[0].categoria !== 'PROGRAMA') throw httpError(400, 'O item vinculado deve ser da categoria PROGRAMA');
                progId = Number(pRes.rows[0].id);
                progTitulo = pRes.rows[0].titulo;
            }
            const ins = await db.query(
                `INSERT INTO itens_catalogo (categoria, titulo, descricao, programa_vinculado_id)
                 VALUES ($1, $2, $3, $4) RETURNING id, categoria, titulo, descricao, programa_vinculado_id`,
                [
                    body.categoria,
                    String(body.titulo).trim(),
                    body.descricao && String(body.descricao).trim() ? String(body.descricao).trim() : null,
                    progId
                ]
            );
            return sendJson(res, 201, mapItem({ ...ins.rows[0], programa_vinculado_titulo: progTitulo }, false));
        }

        const matchCatalogoId = /^\/api\/catalogo\/(\d+)$/.exec(path);
        if (matchCatalogoId) {
            const id = Number(matchCatalogoId[1]);
            if (method === 'GET') {
                const { rows } = await db.query(
                    `SELECT i.*, p.titulo AS programa_vinculado_titulo
                     FROM itens_catalogo i
                     LEFT JOIN itens_catalogo p ON p.id = i.programa_vinculado_id
                     WHERE i.id = $1`,
                    [id]
                );
                if (!rows.length) throw httpError(404, `Item do catálogo não encontrado: ${id}`);
                return sendJson(res, 200, mapItem(rows[0], false));
            }
            if (method === 'PUT') {
                const body = await readBody(req);
                const cur = await db.query(`SELECT * FROM itens_catalogo WHERE id = $1`, [id]);
                if (!cur.rows.length) throw httpError(404, `Item do catálogo não encontrado: ${id}`);
                if (!body.categoria || !CATEGORIA_SET.has(body.categoria)) throw httpError(400, 'A categoria é obrigatória');
                if (!body.titulo || !String(body.titulo).trim()) throw httpError(400, 'O título é obrigatório');

                if (cur.rows[0].categoria === 'PROGRAMA' && body.categoria !== 'PROGRAMA') {
                    await db.query(`UPDATE itens_catalogo SET programa_vinculado_id = NULL WHERE programa_vinculado_id = $1`, [id]);
                }
                let progId = null;
                let progTitulo = null;
                if (body.programaVinculadoId && ACEITA_VINCULO.has(body.categoria)) {
                    const pRes = await db.query(`SELECT id, categoria, titulo FROM itens_catalogo WHERE id = $1`, [body.programaVinculadoId]);
                    if (!pRes.rows.length) throw httpError(404, `Item do catálogo não encontrado: ${body.programaVinculadoId}`);
                    if (pRes.rows[0].categoria !== 'PROGRAMA') throw httpError(400, 'O item vinculado deve ser da categoria PROGRAMA');
                    progId = Number(pRes.rows[0].id);
                    progTitulo = pRes.rows[0].titulo;
                }
                const upd = await db.query(
                    `UPDATE itens_catalogo
                     SET categoria = $1, titulo = $2, descricao = $3, programa_vinculado_id = $4
                     WHERE id = $5
                     RETURNING id, categoria, titulo, descricao, programa_vinculado_id`,
                    [
                        body.categoria,
                        String(body.titulo).trim(),
                        body.descricao && String(body.descricao).trim() ? String(body.descricao).trim() : null,
                        progId,
                        id
                    ]
                );
                return sendJson(res, 200, mapItem({ ...upd.rows[0], programa_vinculado_titulo: progTitulo }, false));
            }
            if (method === 'DELETE') {
                // Exclusão não apaga do banco principal compartilhado; apenas confirma (exclusão é por sessão no navegador)
                res.statusCode = 204;
                return res.end();
            }
        }

        // ============================================================= /api/criancas
        if (path === '/api/criancas' && method === 'GET') {
            const { rows } = await db.query(`SELECT * FROM criancas ORDER BY LOWER(nome) ASC`);
            return sendJson(res, 200, rows.map(mapCrianca));
        }

        if (path === '/api/criancas' && method === 'POST') {
            const body = await readBody(req);
            if (!body.nome || !String(body.nome).trim()) throw httpError(400, 'O nome é obrigatório');
            const ins = await db.query(
                `INSERT INTO criancas (nome, data_nascimento, preferencias_padrao, observacoes_gerais)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [
                    String(body.nome).trim(),
                    body.dataNascimento || null,
                    body.preferenciasPadrao && String(body.preferenciasPadrao).trim() ? String(body.preferenciasPadrao).trim() : null,
                    body.observacoesGerais && String(body.observacoesGerais).trim() ? String(body.observacoesGerais).trim() : null
                ]
            );
            return sendJson(res, 201, mapCrianca(ins.rows[0]));
        }

        const matchCriancaQuadro = /^\/api\/criancas\/(\d+)\/quadro$/.exec(path);
        if (matchCriancaQuadro && method === 'GET') {
            const criancaId = Number(matchCriancaQuadro[1]);
            const cRes = await db.query(`SELECT id FROM criancas WHERE id = $1`, [criancaId]);
            if (!cRes.rows.length) throw httpError(404, `Criança não encontrada: ${criancaId}`);
            const qRes = await db.query(`SELECT id FROM quadros_pei WHERE crianca_id = $1 ORDER BY id DESC LIMIT 1`, [criancaId]);
            if (qRes.rows.length) {
                return sendJson(res, 200, await carregarQuadroCompleto(db, Number(qRes.rows[0].id)));
            }
            return sendJson(res, 200, await criarQuadroEmBranco(db, criancaId, null));
        }

        const matchCriancaQuadros = /^\/api\/criancas\/(\d+)\/quadros$/.exec(path);
        if (matchCriancaQuadros && method === 'GET') {
            const criancaId = Number(matchCriancaQuadros[1]);
            const cRes = await db.query(`SELECT id FROM criancas WHERE id = $1`, [criancaId]);
            if (!cRes.rows.length) throw httpError(404, `Criança não encontrada: ${criancaId}`);
            const { rows } = await db.query(
                `SELECT id, titulo, data_criacao, data_inicio, data_fim FROM quadros_pei WHERE crianca_id = $1 ORDER BY id DESC`,
                [criancaId]
            );
            return sendJson(res, 200, rows.map(r => ({
                id: Number(r.id),
                titulo: r.titulo,
                dataCriacao: isoDate(r.data_criacao),
                dataInicio: isoDate(r.data_inicio),
                dataFim: isoDate(r.data_fim)
            })));
        }

        const matchCriancaId = /^\/api\/criancas\/(\d+)$/.exec(path);
        if (matchCriancaId) {
            const id = Number(matchCriancaId[1]);
            if (method === 'GET') {
                const { rows } = await db.query(`SELECT * FROM criancas WHERE id = $1`, [id]);
                if (!rows.length) throw httpError(404, `Criança não encontrada: ${id}`);
                return sendJson(res, 200, mapCrianca(rows[0]));
            }
            if (method === 'PUT') {
                const body = await readBody(req);
                if (!body.nome || !String(body.nome).trim()) throw httpError(400, 'O nome é obrigatório');
                const upd = await db.query(
                    `UPDATE criancas
                     SET nome = $1, data_nascimento = $2, preferencias_padrao = $3, observacoes_gerais = $4
                     WHERE id = $5 RETURNING *`,
                    [
                        String(body.nome).trim(),
                        body.dataNascimento || null,
                        body.preferenciasPadrao && String(body.preferenciasPadrao).trim() ? String(body.preferenciasPadrao).trim() : null,
                        body.observacoesGerais && String(body.observacoesGerais).trim() ? String(body.observacoesGerais).trim() : null,
                        id
                    ]
                );
                if (!upd.rows.length) throw httpError(404, `Criança não encontrada: ${id}`);
                return sendJson(res, 200, mapCrianca(upd.rows[0]));
            }
            if (method === 'DELETE') {
                const del = await db.query(`DELETE FROM criancas WHERE id = $1 RETURNING id`, [id]);
                if (!del.rows.length) throw httpError(404, `Criança não encontrada: ${id}`);
                res.statusCode = 204;
                return res.end();
            }
        }

        // ============================================================= /api/quadros & /api/pei
        if ((path === '/api/quadros' || path === '/api/pei') && method === 'POST') {
            const criancaId = Number(urlObj.searchParams.get('criancaId'));
            const titulo = urlObj.searchParams.get('titulo');
            if (!criancaId) throw httpError(400, 'criancaId é obrigatório');
            return sendJson(res, 201, await criarQuadroEmBranco(db, criancaId, titulo));
        }

        const matchCelula = /^\/api\/(?:quadros|pei)\/(\d+)\/celula$/.exec(path);
        if (matchCelula && method === 'PUT') {
            const quadroId = Number(matchCelula[1]);
            const body = await readBody(req);
            return sendJson(res, 200, await atualizarCelula(db, quadroId, body));
        }

        const matchQuadroId = /^\/api\/(?:quadros|pei)\/(\d+)$/.exec(path);
        if (matchQuadroId) {
            const id = Number(matchQuadroId[1]);
            if (method === 'GET') {
                return sendJson(res, 200, await carregarQuadroCompleto(db, id));
            }
            if (method === 'PUT') {
                const body = await readBody(req);
                const qRes = await db.query(`SELECT id FROM quadros_pei WHERE id = $1`, [id]);
                if (!qRes.rows.length) throw httpError(404, `Quadro PEI não encontrado: ${id}`);
                if (body.titulo && String(body.titulo).trim()) {
                    await db.query(`UPDATE quadros_pei SET titulo = $1 WHERE id = $2`, [String(body.titulo).trim(), id]);
                }
                if ('dataInicio' in body || 'dataFim' in body) {
                    const di = body.dataInicio && String(body.dataInicio).trim() ? String(body.dataInicio).trim() : null;
                    const df = body.dataFim && String(body.dataFim).trim() ? String(body.dataFim).trim() : null;
                    await db.query(`UPDATE quadros_pei SET data_inicio = $1, data_fim = $2 WHERE id = $3`, [di, df, id]);
                }
                if (Array.isArray(body.celulas)) {
                    for (const cel of body.celulas) {
                        await atualizarCelula(db, id, cel);
                    }
                }
                return sendJson(res, 200, await carregarQuadroCompleto(db, id));
            }
            if (method === 'DELETE') {
                const del = await db.query(`DELETE FROM quadros_pei WHERE id = $1 RETURNING id`, [id]);
                if (!del.rows.length) throw httpError(404, `Quadro PEI não encontrado: ${id}`);
                res.statusCode = 204;
                return res.end();
            }
        }

        throw httpError(404, `Endpoint não encontrado: ${method} ${path}`);
    } catch (err) {
        const status = err.status || 500;
        return sendJson(res, status, {
            title: status === 404 ? 'Not Found' : status === 400 ? 'Bad Request' : 'Internal Server Error',
            status,
            detail: err.message || 'Erro interno no servidor'
        });
    }
};

