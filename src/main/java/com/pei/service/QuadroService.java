package com.pei.service;

import com.pei.dto.CelulaDTO;
import com.pei.dto.CelulaUpdateRequest;
import com.pei.dto.QuadroDTO;
import com.pei.dto.QuadroResumoDTO;
import com.pei.dto.QuadroUpdateRequest;
import com.pei.model.CategoriaItem;
import com.pei.model.CelulaPei;
import com.pei.model.Crianca;
import com.pei.model.ItemCatalogo;
import com.pei.model.QuadroPei;
import com.pei.repository.QuadroPeiRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class QuadroService {

    /** Quantidade padrão de colunas de atendimento (índices 0 a 10). */
    public static final int TOTAL_COLUNAS = 11;

    /** Paleta exata das colunas da linha PROGRAMAS, da esquerda para a direita. */
    public static final List<String> PALETA_COLUNAS = List.of(
            "#F2542D", // 1 Laranja Avermelhado
            "#001B71", // 2 Azul Marinho Escuro
            "#5A28B6", // 3 Roxo/Violeta
            "#FF59B3", // 4 Rosa Choque
            "#34B257", // 5 Verde Esmeralda
            "#D8DCFF", // 6 Lavanda Claro (texto escuro)
            "#FFA800", // 7 Amarelo Ouro/Laranja
            "#5A28B6", // 8 Roxo/Violeta
            "#001B71", // 9 Azul Marinho Escuro
            "#F2542D", // 10 Laranja Avermelhado
            "#5A28B6"  // 11 Roxo/Violeta
    );

    private final QuadroPeiRepository quadroRepository;
    private final CriancaService criancaService;
    private final CatalogoService catalogoService;

    public QuadroService(QuadroPeiRepository quadroRepository,
                         CriancaService criancaService,
                         CatalogoService catalogoService) {
        this.quadroRepository = quadroRepository;
        this.criancaService = criancaService;
        this.catalogoService = catalogoService;
    }

    // ------------------------------------------------------------------ leitura

    @Transactional(readOnly = true)
    public QuadroDTO obter(Long quadroId) {
        return QuadroDTO.of(obterEntidade(quadroId), TOTAL_COLUNAS);
    }

    /** Retorna o quadro mais recente da criança, criando um quadro em branco se ainda não existir. */
    @Transactional
    public QuadroDTO obterOuCriarPorCrianca(Long criancaId) {
        Crianca crianca = criancaService.obter(criancaId);
        QuadroPei quadro = quadroRepository.findFirstByCriancaIdOrderByIdDesc(criancaId)
                .orElseGet(() -> quadroRepository.save(novoQuadroEmBranco(crianca, null)));
        return QuadroDTO.of(quadro, TOTAL_COLUNAS);
    }

    @Transactional(readOnly = true)
    public List<QuadroResumoDTO> listarPorCrianca(Long criancaId) {
        criancaService.obter(criancaId);
        return quadroRepository.findByCriancaIdOrderByIdDesc(criancaId).stream()
                .map(QuadroResumoDTO::of)
                .toList();
    }

    // ------------------------------------------------------------------ escrita

    @Transactional
    public QuadroDTO criar(Long criancaId, String titulo) {
        Crianca crianca = criancaService.obter(criancaId);
        QuadroPei quadro = quadroRepository.save(novoQuadroEmBranco(crianca, titulo));
        return QuadroDTO.of(quadro, TOTAL_COLUNAS);
    }

    /** Autosave de um único quadrado (coluna + linha). */
    @Transactional
    public CelulaDTO atualizarCelula(Long quadroId, CelulaUpdateRequest req) {
        QuadroPei quadro = obterEntidade(quadroId);
        CelulaPei celula = aplicarCelula(quadro, req);
        return CelulaDTO.of(celula);
    }

    /** Salvamento completo do planejamento (título, período + todos os quadrados enviados). */
    @Transactional
    public QuadroDTO salvar(Long quadroId, QuadroUpdateRequest req) {
        QuadroPei quadro = obterEntidade(quadroId);
        if (req.titulo() != null && !req.titulo().isBlank()) {
            quadro.setTitulo(req.titulo().trim());
        }
        quadro.setDataInicio(req.dataInicio());
        quadro.setDataFim(req.dataFim());
        if (req.celulas() != null) {
            req.celulas().forEach(c -> aplicarCelula(quadro, c));
        }
        return QuadroDTO.of(quadro, TOTAL_COLUNAS);
    }

    @Transactional
    public void excluir(Long quadroId) {
        quadroRepository.delete(obterEntidade(quadroId));
    }

    // ------------------------------------------------------------------ internos

    private CelulaPei aplicarCelula(QuadroPei quadro, CelulaUpdateRequest req) {
        CelulaPei celula = quadro.getCelulas().stream()
                .filter(c -> c.getIndiceColuna().equals(req.indiceColuna()) && c.getTipoLinha() == req.tipoLinha())
                .findFirst()
                .orElseGet(() -> {
                    CelulaPei nova = novaCelula(req.indiceColuna(), req.tipoLinha());
                    quadro.adicionarCelula(nova);
                    return nova;
                });

        // Mantém a ordem escolhida pelo usuário e ignora IDs duplicados
        List<Long> ids = req.itensIds() == null ? List.of() : new ArrayList<>(new LinkedHashSet<>(req.itensIds()));
        Map<Long, ItemCatalogo> porId = catalogoService.obterTodos(ids).stream()
                .collect(Collectors.toMap(ItemCatalogo::getId, Function.identity()));
        List<ItemCatalogo> itens = ids.stream().map(porId::get).toList();

        itens.stream()
                .filter(i -> i.getCategoria() != req.tipoLinha())
                .findAny()
                .ifPresent(i -> {
                    throw new IllegalArgumentException("O item \"" + i.getTitulo() + "\" pertence à categoria "
                            + i.getCategoria() + " e não pode ser usado na linha " + req.tipoLinha());
                });

        celula.getItensSelecionados().clear();
        celula.getItensSelecionados().addAll(itens);
        celula.setTextoLivre(req.textoLivre() == null || req.textoLivre().isBlank() ? null : req.textoLivre().trim());
        if (req.corCabecalho() != null && req.tipoLinha() == CategoriaItem.PROGRAMA) {
            celula.setCorCabecalho(req.corCabecalho().toUpperCase());
        }
        return celula;
    }

    private QuadroPei novoQuadroEmBranco(Crianca crianca, String titulo) {
        LocalDate hoje = LocalDate.now();
        QuadroPei quadro = QuadroPei.builder()
                .crianca(crianca)
                .dataCriacao(hoje)
                .titulo(titulo == null || titulo.isBlank()
                        ? "Planejamento dos Atendimentos"
                        : titulo.trim())
                .build();
        for (CategoriaItem linha : CategoriaItem.values()) {
            for (int col = 0; col < TOTAL_COLUNAS; col++) {
                quadro.adicionarCelula(novaCelula(col, linha));
            }
        }
        return quadro;
    }

    private static CelulaPei novaCelula(int coluna, CategoriaItem linha) {
        return CelulaPei.builder()
                .indiceColuna(coluna)
                .tipoLinha(linha)
                .corCabecalho(PALETA_COLUNAS.get(coluna % PALETA_COLUNAS.size()))
                .build();
    }

    private QuadroPei obterEntidade(Long id) {
        return quadroRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Quadro PEI não encontrado: " + id));
    }
}

