-- =====================================================================
-- PEI (Plano Educacional Individualizado) — Schema PostgreSQL / Supabase
-- Compatível com Hibernate/Spring Data JPA e com a API Serverless da Vercel.
-- Nota: a API na Vercel também cria as tabelas e popula o seed automaticamente
-- na primeira requisição caso o banco esteja vazio.
-- =====================================================================

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
    data_criacao DATE
);

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
