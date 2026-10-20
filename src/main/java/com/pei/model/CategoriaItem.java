package com.pei.model;

/**
 * Categorias de itens do catálogo. Cada categoria corresponde a uma linha do quadro PEI.
 */
public enum CategoriaItem {

    PROGRAMA("PROGRAMAS:", "Programas"),
    RECURSO("RECURSOS A SEREM UTILIZADOS:", "Recursos"),
    ATIVIDADE("ATIVIDADES PLANEJADAS:", "Atividades"),
    PREFERENCIA("PREFERÊNCIAS DA CRIANÇA", "Preferências"),
    OBSERVACAO("OBSERVAÇÕES:", "Observações");

    /** Rótulo exibido na coluna fixa à esquerda do quadro. */
    private final String rotuloLinha;
    /** Nome curto usado em telas de cadastro. */
    private final String nomePlural;

    CategoriaItem(String rotuloLinha, String nomePlural) {
        this.rotuloLinha = rotuloLinha;
        this.nomePlural = nomePlural;
    }

    public String getRotuloLinha() {
        return rotuloLinha;
    }

    public String getNomePlural() {
        return nomePlural;
    }

    /** Recursos e atividades podem ser vinculados a um programa específico. */
    public boolean aceitaVinculoPrograma() {
        return this == RECURSO || this == ATIVIDADE;
    }
}

