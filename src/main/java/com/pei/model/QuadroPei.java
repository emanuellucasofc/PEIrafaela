package com.pei.model;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "quadros_pei")
public class QuadroPei {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String titulo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "crianca_id", nullable = false)
    private Crianca crianca;

    private LocalDate dataCriacao;

    @OneToMany(mappedBy = "quadro", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CelulaPei> celulas = new ArrayList<>();

    public QuadroPei() {
    }

    public QuadroPei(Long id, String titulo, Crianca crianca, LocalDate dataCriacao, List<CelulaPei> celulas) {
        this.id = id;
        this.titulo = titulo;
        this.crianca = crianca;
        this.dataCriacao = dataCriacao;
        this.celulas = celulas != null ? celulas : new ArrayList<>();
    }

    public static Builder builder() {
        return new Builder();
    }

    public void adicionarCelula(CelulaPei celula) {
        celula.setQuadro(this);
        celulas.add(celula);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public Crianca getCrianca() {
        return crianca;
    }

    public void setCrianca(Crianca crianca) {
        this.crianca = crianca;
    }

    public LocalDate getDataCriacao() {
        return dataCriacao;
    }

    public void setDataCriacao(LocalDate dataCriacao) {
        this.dataCriacao = dataCriacao;
    }

    public List<CelulaPei> getCelulas() {
        return celulas;
    }

    public void setCelulas(List<CelulaPei> celulas) {
        this.celulas = celulas;
    }

    public static class Builder {
        private Long id;
        private String titulo;
        private Crianca crianca;
        private LocalDate dataCriacao;
        private List<CelulaPei> celulas = new ArrayList<>();

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder titulo(String titulo) {
            this.titulo = titulo;
            return this;
        }

        public Builder crianca(Crianca crianca) {
            this.crianca = crianca;
            return this;
        }

        public Builder dataCriacao(LocalDate dataCriacao) {
            this.dataCriacao = dataCriacao;
            return this;
        }

        public Builder celulas(List<CelulaPei> celulas) {
            this.celulas = celulas;
            return this;
        }

        public QuadroPei build() {
            return new QuadroPei(id, titulo, crianca, dataCriacao, celulas);
        }
    }
}
