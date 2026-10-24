package com.pei.config;

import com.pei.model.CategoriaItem;
import com.pei.model.CelulaPei;
import com.pei.model.Crianca;
import com.pei.model.ItemCatalogo;
import com.pei.model.QuadroPei;
import com.pei.repository.CriancaRepository;
import com.pei.repository.ItemCatalogoRepository;
import com.pei.repository.QuadroPeiRepository;
import com.pei.service.QuadroService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.pei.model.CategoriaItem.*;

/**
 * Popula o banco de dados na primeira execução (somente se ainda não houver dados):
 * 2 crianças, um catálogo com programas / recursos / atividades / preferências / observações
 * e um quadro de exemplo parcialmente preenchido.
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final CriancaRepository criancaRepository;
    private final ItemCatalogoRepository itemRepository;
    private final QuadroPeiRepository quadroRepository;

    public DataInitializer(CriancaRepository criancaRepository,
                           ItemCatalogoRepository itemRepository,
                           QuadroPeiRepository quadroRepository) {
        this.criancaRepository = criancaRepository;
        this.itemRepository = itemRepository;
        this.quadroRepository = quadroRepository;
    }

    @Value("${pei.seed.enabled:false}")
    private boolean seedHabilitado;

    /** Índice local por título para montar os vínculos e o quadro de exemplo. */
    private final Map<String, ItemCatalogo> porTitulo = new HashMap<>();

    @Override
    @Transactional
    public void run(String... args) {
        if (!seedHabilitado) {
            log.info("[PEI] Seed desabilitado.");
            return;
        }
        if (itemRepository.count() > 0 || criancaRepository.count() > 0) {
            garantirProgramasAdicionais();
            log.info("[PEI] Seed inicial ignorado (banco já populado); programas adicionais verificados.");
            return;
        }

        // ------------------------------------------------------------ crianças
        Crianca ana = criancaRepository.save(Crianca.builder()
                .nome("Ana Clara Souza")
                .dataNascimento(LocalDate.of(2020, 3, 14))
                .preferenciasPadrao("Bolhas de sabão, músicas infantis, massinha colorida")
                .observacoesGerais("Responde bem a reforço social. Evitar ambientes muito ruidosos.")
                .build());

        criancaRepository.save(Crianca.builder()
                .nome("Pedro Henrique Lima")
                .dataNascimento(LocalDate.of(2019, 9, 2))
                .preferenciasPadrao("Carrinhos, dinossauros, brinquedos luminosos")
                .observacoesGerais("Utiliza prancha de comunicação alternativa. Necessita de rotina visual.")
                .build());

        // ------------------------------------------------------------ programas
        programa("Imitação Motora", "Imitar ações motoras amplas e finas a partir de um modelo.");
        programa("Pareamento Visual", "Associar itens idênticos ou semelhantes (cores, formas, figuras).");
        programa("Comunicação Funcional (PECS)", "Sistema de comunicação por troca de figuras.");
        programa("Atenção Compartilhada", "Compartilhar o foco de atenção com o terapeuta sobre um objeto/evento.");
        programa("Coordenação Motora Fina", "Desenvolver preensão, pinça e manipulação de pequenos objetos.");
        programa("Habilidades Sociais e Brincar", "Troca de turnos, brincar funcional e simbólico.");
        garantirProgramasAdicionais();

        // ------------------------------------------------------------ recursos (vinculados)
        item(RECURSO, "Espelho grande", "Para imitação de expressões e gestos.", "Imitação Motora");
        item(RECURSO, "Fantoches", null, "Imitação Motora");
        item(RECURSO, "Instrumentos musicais (chocalho, tambor)", null, "Imitação Motora");
        item(RECURSO, "Cartões plastificados", "Figuras plastificadas de cores, objetos e animais.", "Pareamento Visual");
        item(RECURSO, "Quebra-cabeça 6 peças", null, "Pareamento Visual");
        item(RECURSO, "Formas geométricas de encaixe", null, "Pareamento Visual");
        item(RECURSO, "Pasta de comunicação PECS", null, "Comunicação Funcional (PECS)");
        item(RECURSO, "Figuras de reforçadores", "Fotos dos itens preferidos da criança.", "Comunicação Funcional (PECS)");
        item(RECURSO, "Tablet com prancha de CAA", "Comunicação Aumentativa e Alternativa.", "Comunicação Funcional (PECS)");
        item(RECURSO, "Pião luminoso", null, "Atenção Compartilhada");
        item(RECURSO, "Livro sensorial", null, "Atenção Compartilhada");
        item(RECURSO, "Massinha de modelar", null, "Coordenação Motora Fina");
        item(RECURSO, "Blocos de montar", null, "Coordenação Motora Fina");
        item(RECURSO, "Pinça e pompons", null, "Coordenação Motora Fina");
        item(RECURSO, "Bola macia", null, "Habilidades Sociais e Brincar");
        item(RECURSO, "Kit de comidinha (brinquedo)", null, "Habilidades Sociais e Brincar");
        // recursos gerais
        item(RECURSO, "Cronômetro visual", "Apoio para tempo de espera e transições.", null);
        item(RECURSO, "Quadro de rotina visual", null, null);

        // ------------------------------------------------------------ atividades (vinculadas)
        item(ATIVIDADE, "Imitar movimentos amplos (bater palmas, levantar braços)", null, "Imitação Motora");
        item(ATIVIDADE, "Imitação com objetos", null, "Imitação Motora");
        item(ATIVIDADE, "Cantar músicas com gestos", null, "Imitação Motora");
        item(ATIVIDADE, "Parear cores primárias", null, "Pareamento Visual");
        item(ATIVIDADE, "Parear figura com figura idêntica", null, "Pareamento Visual");
        item(ATIVIDADE, "Montar quebra-cabeça com apoio", null, "Pareamento Visual");
        item(ATIVIDADE, "Troca de figura por item desejado (Fase I)", null, "Comunicação Funcional (PECS)");
        item(ATIVIDADE, "Nomeação de figuras", null, "Comunicação Funcional (PECS)");
        item(ATIVIDADE, "Construir frase \"Eu quero ...\"", null, "Comunicação Funcional (PECS)");
        item(ATIVIDADE, "Seguir o apontar do terapeuta", null, "Atenção Compartilhada");
        item(ATIVIDADE, "Brincadeira \"cadê? achou!\"", null, "Atenção Compartilhada");
        item(ATIVIDADE, "Modelar formas com massinha", null, "Coordenação Motora Fina");
        item(ATIVIDADE, "Empilhar blocos (torre de 6)", null, "Coordenação Motora Fina");
        item(ATIVIDADE, "Transferir pompons com pinça", null, "Coordenação Motora Fina");
        item(ATIVIDADE, "Troca de turno com bola", null, "Habilidades Sociais e Brincar");
        item(ATIVIDADE, "Jogo simbólico de comidinha", null, "Habilidades Sociais e Brincar");

        // ------------------------------------------------------------ preferências
        Arrays.asList("Bolhas de sabão", "Músicas infantis", "Carrinhos", "Desenhos no tablet",
                        "Massinha colorida", "Balanço / movimento", "Brinquedos luminosos", "Dinossauros")
                .forEach(t -> item(PREFERENCIA, t, null, null));

        // ------------------------------------------------------------ observações
        Arrays.asList("Boa regulação emocional", "Necessitou de dica física parcial",
                        "Necessitou de dica física total", "Respondeu bem à dica verbal",
                        "Realizou de forma independente", "Baixa tolerância à espera",
                        "Engajamento elevado na atividade", "Sinais de cansaço ao final da sessão")
                .forEach(t -> item(OBSERVACAO, t, null, null));

        // ------------------------------------------------------------ quadro de exemplo
        criarQuadroExemplo(ana);

        log.info("[PEI] Banco populado: {} crianças, {} itens de catálogo, {} quadro(s).",
                criancaRepository.count(), itemRepository.count(), quadroRepository.count());
    }

    private void criarQuadroExemplo(Crianca crianca) {
        QuadroPei quadro = QuadroPei.builder()
                .titulo("Planejamento dos Atendimentos - Exemplo")
                .crianca(crianca)
                .dataCriacao(LocalDate.now())
                .build();

        for (CategoriaItem linha : CategoriaItem.values()) {
            for (int col = 0; col < QuadroService.TOTAL_COLUNAS; col++) {
                quadro.adicionarCelula(CelulaPei.builder()
                        .indiceColuna(col)
                        .tipoLinha(linha)
                        .corCabecalho(QuadroService.PALETA_COLUNAS.get(col))
                        .build());
            }
        }

        preencher(quadro, 0, PROGRAMA, null, "Imitação Motora");
        preencher(quadro, 0, RECURSO, null, "Espelho grande", "Fantoches");
        preencher(quadro, 0, ATIVIDADE, "Iniciar com 3 tentativas por bloco.",
                "Imitar movimentos amplos (bater palmas, levantar braços)", "Cantar músicas com gestos");
        preencher(quadro, 0, PREFERENCIA, null, "Músicas infantis");
        preencher(quadro, 0, OBSERVACAO, null, "Boa regulação emocional");

        preencher(quadro, 1, PROGRAMA, null, "Pareamento Visual");
        preencher(quadro, 1, RECURSO, null, "Cartões plastificados", "Quebra-cabeça 6 peças");
        preencher(quadro, 1, ATIVIDADE, null, "Parear cores primárias");
        preencher(quadro, 1, PREFERENCIA, null, "Bolhas de sabão");
        preencher(quadro, 1, OBSERVACAO, null, "Necessitou de dica física parcial");

        preencher(quadro, 2, PROGRAMA, null, "Comunicação Funcional (PECS)");
        preencher(quadro, 2, RECURSO, null, "Pasta de comunicação PECS", "Figuras de reforçadores");
        preencher(quadro, 2, ATIVIDADE, null, "Troca de figura por item desejado (Fase I)", "Nomeação de figuras");
        preencher(quadro, 2, PREFERENCIA, null, "Massinha colorida");

        preencher(quadro, 3, PROGRAMA, null, "Atenção Compartilhada");
        preencher(quadro, 3, RECURSO, null, "Pião luminoso");
        preencher(quadro, 3, ATIVIDADE, null, "Seguir o apontar do terapeuta");

        quadroRepository.save(quadro);
    }

    private void preencher(QuadroPei quadro, int coluna, CategoriaItem linha, String textoLivre, String... titulos) {
        CelulaPei celula = quadro.getCelulas().stream()
                .filter(c -> c.getIndiceColuna() == coluna && c.getTipoLinha() == linha)
                .findFirst()
                .orElseThrow();
        List<ItemCatalogo> itens = Arrays.stream(titulos).map(porTitulo::get).toList();
        celula.getItensSelecionados().addAll(itens);
        celula.setTextoLivre(textoLivre);
    }

    private void programa(String titulo, String descricao) {
        item(PROGRAMA, titulo, descricao, null);
    }

    private void garantirProgramasAdicionais() {
        List<String> extras = Arrays.asList(
                "Atenção conjunta prolongada",
                "Imitar vocalizações e sons onomatopaicos",
                "Atendimento a ordens simples de 1 passo",
                "Contato visual sob solicitação verbal",
                "Expansão de vocabulário na pasta PECS (ações e sentimentos)",
                "Indicação de necessidades básicas (água, banheiro, pausa)",
                "Brincadeira de faz de conta funcional (cuidar de boneco, boneca ou atender telefone)",
                "Imitação social e de expressões faciais no espelho",
                "Compartilhamento espontâneo de atenção (apontar para mostrar algo)",
                "Tolerância à frustração e respeito ao turno (esperar a vez)",
                "Reconhecimento de emoções básicas em figuras ou rostos",
                "Enfiamento de contas grossas em cordão",
                "Rasgar e amassar papéis de texturas variadas",
                "Uso seguro de tesoura adaptada (cortes retos)",
                "Traçado de linhas retas e labirintos grossos",
                "Equilíbrio dinâmico (caminhar sobre linha no chão)",
                "Pareamento de cores e formas geométricas",
                "Classificação de objetos por tamanho (grande e pequeno)",
                "Quebra-cabeças de encaixe simples (2 a 4 peças)",
                "Brinquedos de causa e efeito (apertar botão para acionar luz/som)"
        );
        for (String t : extras) {
            if (itemRepository.findFirstByCategoriaAndTituloIgnoreCase(PROGRAMA, t).isEmpty()) {
                programa(t, null);
            }
        }
    }

    private void item(CategoriaItem categoria, String titulo, String descricao, String programa) {
        ItemCatalogo item = itemRepository.save(ItemCatalogo.builder()
                .categoria(categoria)
                .titulo(titulo)
                .descricao(descricao)
                .programaVinculado(programa != null ? porTitulo.get(programa) : null)
                .build());
        porTitulo.put(titulo, item);
    }
}

