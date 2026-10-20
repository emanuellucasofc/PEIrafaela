package com.pei.model;

import jakarta.persistence.*;

@Entity
@Table(name = "itens_catalogo", indexes = {
        @Index(name = "idx_item_categoria", columnList = "categoria")
})
public class ItemCatalogo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CategoriaItem categoria;

    @Column(nullable = false, length = 200)
    private String titulo;

    @Column(length = 1000)
    private String descricao;

    /** Auto-relacionamento opcional: vincula recursos/atividades a um programa. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "programa_vinculado_id")
    private ItemCatalogo programaVinculado;

    public ItemCatalogo() {
    }

    public ItemCatalogo(Long id, CategoriaItem categoria, String titulo, String descricao, ItemCatalogo programaVinculado) {
        this.id = id;
        this.categoria = categoria;
        this.titulo = titulo;
        this.descricao = descricao;
        this.programaVinculado = programaVinculado;
    }

    public static Builder builder() {
        return new Builder();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public CategoriaItem getCategoria() {
        return categoria;
    }

    public void setCategoria(CategoriaItem categoria) {
        this.categoria = categoria;
    }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public ItemCatalogo getProgramaVinculado() {
        return programaVinculado;
    }

    public void setProgramaVinculado(ItemCatalogo programaVinculado) {
        this.programaVinculado = programaVinculado;
    }

    public static class Builder {
        private Long id;
        private CategoriaItem categoria;
        private String titulo;
        private String descricao;
        private ItemCatalogo programaVinculado;

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder categoria(CategoriaItem categoria) {
            this.categoria = categoria;
            return this;
        }

        public Builder titulo(String titulo) {
            this.titulo = titulo;
            return this;
        }

        public Builder descricao(String descricao) {
            this.descricao = descricao;
            return this;
        }

        public Builder programaVinculado(ItemCatalogo programaVinculado) {
            this.programaVinculado = programaVinculado;
            return this;
        }

        public ItemCatalogo build() {
            return new ItemCatalogo(id, categoria, titulo, descricao, programaVinculado);
        }
    }
}
