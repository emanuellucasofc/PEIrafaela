package com.pei;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pei.dto.CelulaUpdateRequest;
import com.pei.dto.ItemCatalogoRequest;
import com.pei.model.CategoriaItem;
import com.pei.repository.CriancaRepository;
import com.pei.repository.ItemCatalogoRepository;
import com.pei.repository.QuadroPeiRepository;
import com.pei.service.QuadroService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PeiApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CriancaRepository criancaRepository;

    @Autowired
    private ItemCatalogoRepository itemCatalogoRepository;

    @Autowired
    private QuadroPeiRepository quadroPeiRepository;

    @Test
    void dataInitializerDevePopularCriancasECatalogoComPeloMenos25Itens() {
        assertThat(criancaRepository.count()).isGreaterThanOrEqualTo(2);
        assertThat(itemCatalogoRepository.count()).isGreaterThanOrEqualTo(25);
        assertThat(quadroPeiRepository.count()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void deveRenderizarTelasPrincipais() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("PLANEJAMENTO DOS ATENDIMENTOS")))
                .andExpect(content().string(containsString("#F2542D")))
                .andExpect(content().string(containsString("#D8DCFF")));

        mockMvc.perform(get("/cadastros"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("GERENCIAR BANCO DE DADOS (CADASTROS)")));
    }

    @Test
    void deveFiltrarCatalogoComSugestaoPorProgramaECriarNovoItem() throws Exception {
        var programa = itemCatalogoRepository
                .findFirstByCategoriaAndTituloIgnoreCase(CategoriaItem.PROGRAMA, "Pareamento Visual")
                .orElseThrow();

        mockMvc.perform(get("/api/catalogo")
                        .param("categoria", "RECURSO")
                        .param("programaId", String.valueOf(programa.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].sugerido").value(true))
                .andExpect(jsonPath("$[0].programaVinculadoId").value(programa.getId()));

        var novoReq = new ItemCatalogoRequest(
                CategoriaItem.RECURSO,
                "Prancha imantada de letras",
                "Apoio tátil e visual",
                programa.getId()
        );

        mockMvc.perform(post("/api/catalogo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(novoReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.titulo").value("Prancha imantada de letras"))
                .andExpect(jsonPath("$.programaVinculadoId").value(programa.getId()));
    }

    @Test
    void deveCarregarQuadroEAtualizarCelulaViaAutosave() throws Exception {
        var quadro = quadroPeiRepository.findAll().get(0);
        var atividade = itemCatalogoRepository
                .findFirstByCategoriaAndTituloIgnoreCase(CategoriaItem.ATIVIDADE, "Parear cores primárias")
                .orElseThrow();

        mockMvc.perform(get("/api/quadros/" + quadro.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalColunas").value(QuadroService.TOTAL_COLUNAS))
                .andExpect(jsonPath("$.celulas", hasSize(QuadroService.TOTAL_COLUNAS * CategoriaItem.values().length)));

        var update = new CelulaUpdateRequest(
                5,
                CategoriaItem.ATIVIDADE,
                List.of(atividade.getId()),
                "Executar com dica gestual leve",
                null
        );

        mockMvc.perform(put("/api/pei/" + quadro.getId() + "/celula")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.indiceColuna").value(5))
                .andExpect(jsonPath("$.tipoLinha").value("ATIVIDADE"))
                .andExpect(jsonPath("$.textoLivre").value("Executar com dica gestual leve"))
                .andExpect(jsonPath("$.itensSelecionados[0].titulo").value("Parear cores primárias"));
    }
}

