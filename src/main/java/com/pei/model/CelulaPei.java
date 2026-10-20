package com.pei.model;

import jakarta.persistence.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "celulas_pei", uniqueConstraints = {
        @UniqueConstraint(name = "uk_celula_posicao", columnNames = {"quadro_id", "indice_coluna", "tipo_linha"})
})
public class CelulaPei {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "quadro_id", nullable = false)
    private QuadroPei quadro;

    /** Coluna do atendimento (0 a 10). */
    @Column(name = "indice_coluna", nullable = false)
    private Integer indiceColuna;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_linha", nullable = false, length = 20)
    private CategoriaItem tipoLinha;

    /** Cor da coluna (relevante para a linha PROGRAMA). */
    @Column(length = 9)
    private String corCabecalho;

    @ManyToMany
    @JoinTable(name = "celula_itens",
            joinColumns = @JoinColumn(name = "celula_id"),
            inverseJoinColumns = @JoinColumn(name = "item_id"))
    @OrderColumn(name = "ordem")
    private List<ItemCatalogo> itensSelecionados = new ArrayList<>();

    @Column(length = 4000)
    private String textoLivre;

    public CelulaPei() {
    }

    public CelulaPei(Long id, QuadroPei quadro, Integer indiceColuna, CategoriaItem tipoLinha,
                     String corCabecalho, List<ItemCatalogo> itensSelecionados, String textoLivre) {
        this.id = id;
        this.quadro = quadro;
        this.indiceColuna = indiceColuna;
        this.tipoLinha = tipoLinha;
        this.corCabecalho = corCabecalho;
        this.itensSelecionados = itensSelecionados != null ? itensSelecionados : new ArrayList<>();
        this.textoLivre = textoLivre;
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

    public QuadroPei getQuadro() {
        return quadro;
    }

    public void setQuadro(QuadroPei quadro) {
        this.quadro = quadro;
    }

    public Integer getIndiceColuna() {
        return indiceColuna;
    }

    public void setIndiceColuna(Integer indiceColuna) {
        this.indiceColuna = indiceColuna;
    }

    public CategoriaItem getTipoLinha() {
        return tipoLinha;
    }

    public void setTipoLinha(CategoriaItem tipoLinha) {
        this.tipoLinha = tipoLinha;
    }

    public String getCorCabecalho() {
        return corCabecalho;
    }

    public void setCorCabecalho(String corCabecalho) {
        this.corCabecalho = corCabecalho;
    }

    public List<ItemCatalogo> getItensSelecionados() {
        return itensSelecionados;
    }

    public void setItensSelecionados(List<ItemCatalogo> itensSelecionados) {
        this.itensSelecionados = itensSelecionados;
    }

    public String getTextoLivre() {
        return textoLivre;
    }

    public void setTextoLivre(String textoLivre) {
        this.textoLivre = textoLivre;
    }

    public static class Builder {
        private Long id;
        private QuadroPei quadro;
        private Integer indiceColuna;
        private CategoriaItem tipoLinha;
        private String corCabecalho;
        private List<ItemCatalogo> itensSelecionados = new ArrayList<>();
        private String textoLivre;

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder quadro(QuadroPei quadro) {
            this.quadro = quadro;
            return this;
        }

        public Builder indiceColuna(Integer indiceColuna) {
            this.indiceColuna = indiceColuna;
            return this;
        }

        public Builder tipoLinha(CategoriaItem tipoLinha) {
            this.tipoLinha = tipoLinha;
            return this;
        }

        public Builder corCabecalho(String corCabecalho) {
            this.corCabecalho = corCabecalho;
            return this;
        }

        public Builder itensSelecionados(List<ItemCatalogo> itensSelecionados) {
            this.itensSelecionados = itensSelecionados;
            return this;
        }

        public Builder textoLivre(String textoLivre) {
            this.textoLivre = textoLivre;
            return this;
        }

        public CelulaPei build() {
            return new CelulaPei(id, quadro, indiceColuna, tipoLinha, corCabecalho, itensSelecionados, textoLivre);
        }
    }
}
