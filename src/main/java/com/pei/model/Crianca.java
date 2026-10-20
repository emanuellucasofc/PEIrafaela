package com.pei.model;

import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(name = "criancas")
public class Crianca {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String nome;

    private LocalDate dataNascimento;

    @Column(length = 2000)
    private String preferenciasPadrao;

    @Column(length = 4000)
    private String observacoesGerais;

    public Crianca() {
    }

    public Crianca(Long id, String nome, LocalDate dataNascimento, String preferenciasPadrao, String observacoesGerais) {
        this.id = id;
        this.nome = nome;
        this.dataNascimento = dataNascimento;
        this.preferenciasPadrao = preferenciasPadrao;
        this.observacoesGerais = observacoesGerais;
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

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public LocalDate getDataNascimento() {
        return dataNascimento;
    }

    public void setDataNascimento(LocalDate dataNascimento) {
        this.dataNascimento = dataNascimento;
    }

    public String getPreferenciasPadrao() {
        return preferenciasPadrao;
    }

    public void setPreferenciasPadrao(String preferenciasPadrao) {
        this.preferenciasPadrao = preferenciasPadrao;
    }

    public String getObservacoesGerais() {
        return observacoesGerais;
    }

    public void setObservacoesGerais(String observacoesGerais) {
        this.observacoesGerais = observacoesGerais;
    }

    public static class Builder {
        private Long id;
        private String nome;
        private LocalDate dataNascimento;
        private String preferenciasPadrao;
        private String observacoesGerais;

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder nome(String nome) {
            this.nome = nome;
            return this;
        }

        public Builder dataNascimento(LocalDate dataNascimento) {
            this.dataNascimento = dataNascimento;
            return this;
        }

        public Builder preferenciasPadrao(String preferenciasPadrao) {
            this.preferenciasPadrao = preferenciasPadrao;
            return this;
        }

        public Builder observacoesGerais(String observacoesGerais) {
            this.observacoesGerais = observacoesGerais;
            return this;
        }

        public Crianca build() {
            return new Crianca(id, nome, dataNascimento, preferenciasPadrao, observacoesGerais);
        }
    }
}
