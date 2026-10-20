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

    private LocalDate dataInicio;

    private LocalDate dataFim;

    @OneToMany(mappedBy = "quadro", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CelulaPei> celulas = new ArrayList<>();

    public QuadroPei() {
    }

    public QuadroPei(Long id, String titulo, Crianca crianca, LocalDate dataCriacao,
                     LocalDate dataInicio, LocalDate dataFim, List<CelulaPei> celulas) {
        this.id = id;
        this.titulo = titulo;
        this.crianca = crianca;
        this.dataCriacao = dataCriacao;
        this.dataInicio = dataInicio;
        this.dataFim = dataFim;
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

    public LocalDate getDataInicio() {
        return dataInicio;
    }

    public void setDataInicio(LocalDate dataInicio) {
        this.dataInicio = dataInicio;
    }

    public LocalDate getDataFim() {
        return dataFim;
    }

    public void setDataFim(LocalDate dataFim) {
        this.dataFim = dataFim;
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
        private LocalDate dataInicio;
        private LocalDate dataFim;
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

        public Builder dataInicio(LocalDate dataInicio) {
            this.dataInicio = dataInicio;
            return this;
        }

        public Builder dataFim(LocalDate dataFim) {
            this.dataFim = dataFim;
            return this;
        }

        public Builder celulas(List<CelulaPei> celulas) {
            this.celulas = celulas;
            return this;
        }

        public QuadroPei build() {
            return new QuadroPei(id, titulo, crianca, dataCriacao, dataInicio, dataFim, celulas);
        }
    }
}
