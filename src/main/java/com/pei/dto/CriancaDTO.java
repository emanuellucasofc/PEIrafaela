package com.pei.dto;

import com.pei.model.Crianca;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/** DTO de criança (usado tanto para leitura quanto para criação/edição). */
public record CriancaDTO(
        Long id,

        @NotBlank(message = "O nome é obrigatório")
        @Size(max = 150, message = "O nome deve ter no máximo 150 caracteres")
        String nome,

        @PastOrPresent(message = "A data de nascimento não pode estar no futuro")
        LocalDate dataNascimento,

        @Size(max = 2000)
        String preferenciasPadrao,

        @Size(max = 4000)
        String observacoesGerais
) {

    public static CriancaDTO of(Crianca c) {
        return new CriancaDTO(c.getId(), c.getNome(), c.getDataNascimento(),
                c.getPreferenciasPadrao(), c.getObservacoesGerais());
    }
}

