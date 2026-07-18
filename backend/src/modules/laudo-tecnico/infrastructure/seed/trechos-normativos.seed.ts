/**
 * Biblioteca inicial de trechos/clausulas-modelo para montagem de laudos
 * tecnicos. IMPORTANTE:
 *
 * 1. Sao redacoes proprias que REFERENCIAM as normas — nao reproduzem o texto
 *    oficial da ABNT (que e protegido por direitos autorais).
 * 2. `itemVerificar: true` marca os trechos cujo NUMERO do item ainda deve ser
 *    confirmado contra a edicao vigente da norma antes de usar em um laudo
 *    assinado (a numeracao muda entre edicoes). O tema e a norma estao
 *    corretos; o numero exato do item e responsabilidade do engenheiro
 *    conferir.
 * 3. Esta e uma base inicial: o admin cadastra/edita mais trechos pela aba de
 *    laudos no portal.
 */

export interface TrechoNormativoSeed {
  norma: string;
  item: string | null;
  categoria: string;
  assunto: string;
  texto: string;
  itemVerificar: boolean;
}

export const CATEGORIAS_TRECHO = {
  baixa_tensao: 'Instalacao de baixa tensao (NBR 5410)',
  spda: 'SPDA / para-raios (NBR 5419)',
  fotovoltaico: 'Solar fotovoltaico (NBR 16690 / 16274)',
  recarga_veicular: 'Recarga de veiculo eletrico (NBR 17019)',
  incendio: 'Prevencao de incendio (IT Corpo de Bombeiros)',
  seguranca: 'Seguranca em eletricidade (NR-10)',
} as const;

export const TRECHOS_NORMATIVOS_SEED: TrechoNormativoSeed[] = [
  // ===================== NBR 5410 — Baixa tensao =====================
  {
    norma: 'NBR 5410',
    item: '5.1.3.2.2',
    categoria: 'baixa_tensao',
    assunto: 'Protecao adicional por DR em areas molhadas',
    texto:
      'Constatou-se ausencia de dispositivo a corrente diferencial-residual (DR) de alta sensibilidade (30 mA) nos circuitos que servem areas molhadas (banheiros, area de servico e cozinha), em desacordo com a ABNT NBR 5410, que exige essa protecao adicional contra choques eletricos nesses locais.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 5410',
    item: '6.3.5',
    categoria: 'baixa_tensao',
    assunto: 'Dispositivo de protecao contra surtos (DPS)',
    texto:
      'Verificou-se a ausencia de dispositivo de protecao contra surtos (DPS) no quadro de distribuicao geral, contrariando a ABNT NBR 5410, que preve a protecao contra sobretensoes transitorias de origem atmosferica e de manobra na entrada da instalacao.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 5410',
    item: '6.4',
    categoria: 'baixa_tensao',
    assunto: 'Aterramento e equipotencializacao',
    texto:
      'A instalacao deve dispor de barramento de equipotencializacao principal (BEP) interligando o condutor de protecao, o aterramento e os elementos condutores da edificacao, conforme a ABNT NBR 5410. Constatou-se [conforme/ausencia/deficiencia] nesse sistema.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 5410',
    item: '6.1.5.3.1',
    categoria: 'baixa_tensao',
    assunto: 'Cores dos condutores (PE e neutro)',
    texto:
      'Parte dos condutores de protecao (PE) e de neutro nao apresenta a identificacao por cor padronizada (verde-amarela para o PE e azul-claro para o neutro), em desacordo com a ABNT NBR 5410, o que compromete a seguranca na manutencao.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 5410',
    item: '6.5.4.5',
    categoria: 'baixa_tensao',
    assunto: 'Identificacao dos circuitos no quadro',
    texto:
      'Constatou-se ausencia de identificacao dos circuitos no quadro de distribuicao, dificultando o seccionamento seguro e a manutencao, em desacordo com a ABNT NBR 5410.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 5410',
    item: '6.2.5',
    categoria: 'baixa_tensao',
    assunto: 'Protecao contra sobrecorrentes',
    texto:
      'Os dispositivos de protecao contra sobrecorrente devem ser coordenados com a capacidade de conducao dos condutores, garantindo a protecao contra sobrecarga e curto-circuito conforme a ABNT NBR 5410. Verificou-se [adequacao/subdimensionamento] na coordenacao entre disjuntores e condutores.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 5410',
    item: '5.1.2',
    categoria: 'baixa_tensao',
    assunto: 'Protecao contra choques (seccionamento)',
    texto:
      'A instalacao deve permitir o seccionamento e o comando funcional de forma segura, conforme a ABNT NBR 5410. Verificou-se [conformidade/deficiencia] nos dispositivos de seccionamento e comando dos circuitos.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 5410',
    item: '7',
    categoria: 'baixa_tensao',
    assunto: 'Verificacao final da instalacao',
    texto:
      'A instalacao foi submetida a verificacao final por inspecao visual e ensaios, conforme preconiza a ABNT NBR 5410, capitulo de verificacao, incluindo continuidade dos condutores de protecao, resistencia de isolamento e funcionamento dos dispositivos DR.',
    itemVerificar: true,
  },

  // ===================== NBR 5419 — SPDA =====================
  {
    norma: 'NBR 5419',
    item: '2',
    categoria: 'spda',
    assunto: 'Gerenciamento de risco',
    texto:
      'A necessidade e o nivel de protecao do SPDA foram avaliados a partir do gerenciamento de risco previsto na ABNT NBR 5419-2, considerando a probabilidade de descargas atmosfericas e as consequencias para a edificacao e seus ocupantes.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 5419',
    item: '3',
    categoria: 'spda',
    assunto: 'Subsistema de captacao',
    texto:
      'O subsistema de captacao foi verificado quanto ao posicionamento e a integridade dos captores, conforme a ABNT NBR 5419-3. Constatou-se [conformidade/deficiencia] na cobertura de protecao dos volumes a proteger.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 5419',
    item: '3',
    categoria: 'spda',
    assunto: 'Subsistema de descida',
    texto:
      'As descidas do SPDA foram inspecionadas quanto a continuidade, fixacao e distribuicao ao longo do perimetro, conforme a ABNT NBR 5419-3. Constatou-se que as caixas de inspecao/equalizacao [nao] apresentam registro de manutencao periodica.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 5419',
    item: '3',
    categoria: 'spda',
    assunto: 'Aterramento do SPDA',
    texto:
      'O subsistema de aterramento do SPDA foi verificado quanto a configuracao e a interligacao com a equipotencializacao da edificacao, conforme a ABNT NBR 5419-3. O valor de resistencia de aterramento medido consta na secao de medicoes.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 5419',
    item: '4',
    categoria: 'spda',
    assunto: 'Equipotencializacao e protecao de sistemas internos',
    texto:
      'A protecao dos sistemas internos contra os efeitos das descargas atmosfericas deve incluir a equipotencializacao para raios e a instalacao de DPS coordenados, conforme a ABNT NBR 5419-4. Verificou-se [conformidade/ausencia] dessas medidas.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 5419',
    item: null,
    categoria: 'spda',
    assunto: 'Inspecao e manutencao periodica',
    texto:
      'O SPDA deve ser submetido a inspecoes periodicas para verificacao da integridade dos captores, descidas e aterramento, conforme a periodicidade preconizada pela ABNT NBR 5419. Recomenda-se a implantacao de registro documentado das inspecoes.',
    itemVerificar: true,
  },

  // ===================== NBR 16690 / 16274 — Fotovoltaico =====================
  {
    norma: 'NBR 16690',
    item: null,
    categoria: 'fotovoltaico',
    assunto: 'Cabeamento e seccionamento do lado CC',
    texto:
      'O arranjo fotovoltaico deve dispor de dispositivo de seccionamento do lado da corrente continua (CC), que permita a desconexao segura dos modulos para manutencao, conforme a ABNT NBR 16690. Verificou-se [conformidade/ausencia] do seccionamento CC.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 16690',
    item: null,
    categoria: 'fotovoltaico',
    assunto: 'Protecao contra surtos no lado CC',
    texto:
      'Recomenda-se a instalacao de dispositivos de protecao contra surtos (DPS) adequados a tensao do arranjo no lado CC, conforme a ABNT NBR 16690, para protecao dos modulos e do inversor contra sobretensoes.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 16690',
    item: null,
    categoria: 'fotovoltaico',
    assunto: 'Aterramento das estruturas e molduras',
    texto:
      'As estruturas de suporte e as molduras metalicas dos modulos fotovoltaicos devem ser aterradas e equipotencializadas, conforme a ABNT NBR 16690 e a ABNT NBR 5410, para protecao contra choques e para o correto funcionamento das protecoes.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 16690',
    item: null,
    categoria: 'fotovoltaico',
    assunto: 'Sinalizacao de advertencia',
    texto:
      'A instalacao fotovoltaica deve possuir sinalizacao de advertencia indicando a presenca de fonte de energia em corrente continua e a existencia de duas fontes de alimentacao, conforme a ABNT NBR 16690, alertando para o risco durante a manutencao.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 16274',
    item: null,
    categoria: 'fotovoltaico',
    assunto: 'Documentacao e comissionamento',
    texto:
      'O sistema fotovoltaico conectado a rede deve ser entregue com a documentacao de projeto, os dados dos equipamentos e os resultados dos ensaios de comissionamento, conforme a ABNT NBR 16274, incluindo verificacao de polaridade, tensao de circuito aberto e corrente de curto-circuito das strings.',
    itemVerificar: true,
  },

  // ===================== NBR 17019 — Recarga de veiculo eletrico =====================
  {
    norma: 'NBR 17019',
    item: null,
    categoria: 'recarga_veicular',
    assunto: 'Circuito dedicado e exclusivo',
    texto:
      'O ponto de recarga de veiculo eletrico deve ser alimentado por circuito dedicado e exclusivo, dimensionado para operacao continua na corrente nominal do equipamento, conforme a ABNT NBR 17019 e a ABNT NBR 5410. Verificou-se [conformidade/deficiencia] no circuito de alimentacao.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 17019',
    item: null,
    categoria: 'recarga_veicular',
    assunto: 'Protecao diferencial (DR) com deteccao de CC',
    texto:
      'O circuito de recarga deve dispor de protecao diferencial-residual adequada, com dispositivo DR do tipo A associado a deteccao de corrente continua residual (6 mA) ou DR do tipo B, conforme a ABNT NBR 17019, para protecao contra choques considerando as correntes CC do carregador.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 17019',
    item: null,
    categoria: 'recarga_veicular',
    assunto: 'Protecao contra sobrecorrente',
    texto:
      'O circuito de recarga deve possuir protecao contra sobrecarga e curto-circuito coordenada com a secao dos condutores e com a corrente nominal do ponto de recarga, conforme a ABNT NBR 17019 e a ABNT NBR 5410.',
    itemVerificar: true,
  },
  {
    norma: 'NBR 17019',
    item: null,
    categoria: 'recarga_veicular',
    assunto: 'Aterramento do ponto de recarga',
    texto:
      'O ponto de recarga deve ser aterrado e equipotencializado conforme a ABNT NBR 17019 e a ABNT NBR 5410, garantindo a atuacao das protecoes e a seguranca do usuario durante a conexao do veiculo.',
    itemVerificar: true,
  },

  // ===================== IT Corpo de Bombeiros (SP) — Incendio =====================
  {
    norma: 'IT CBPMESP',
    item: null,
    categoria: 'incendio',
    assunto: 'Iluminacao de emergencia',
    texto:
      'A edificacao deve dispor de sistema de iluminacao de emergencia que garanta a sinalizacao e a iluminacao das rotas de fuga em caso de falta de energia, conforme a Instrucao Tecnica do Corpo de Bombeiros do Estado de Sao Paulo aplicavel e a ABNT NBR 10898. Verificou-se [conformidade/deficiencia] na autonomia e no posicionamento das luminarias.',
    itemVerificar: true,
  },
  {
    norma: 'IT CBPMESP',
    item: null,
    categoria: 'incendio',
    assunto: 'SPDA para fins de AVCB',
    texto:
      'Para fins de obtencao do Auto de Vistoria do Corpo de Bombeiros (AVCB), o SPDA deve atender a Instrucao Tecnica aplicavel do Corpo de Bombeiros do Estado de Sao Paulo, com laudo tecnico e ART do responsavel, alem do atendimento a ABNT NBR 5419.',
    itemVerificar: true,
  },
  {
    norma: 'IT CBPMESP',
    item: null,
    categoria: 'incendio',
    assunto: 'Sinalizacao de emergencia',
    texto:
      'A sinalizacao de emergencia, incluindo indicacao de rotas de fuga e de equipamentos de combate a incendio, deve atender a Instrucao Tecnica aplicavel do Corpo de Bombeiros do Estado de Sao Paulo. Verificou-se [conformidade/deficiencia] na sinalizacao existente.',
    itemVerificar: true,
  },

  // ===================== NR-10 — Seguranca =====================
  {
    norma: 'NR-10',
    item: '10.2.4',
    categoria: 'seguranca',
    assunto: 'Prontuario de instalacoes eletricas (PIE)',
    texto:
      'O estabelecimento deve manter o Prontuario de Instalacoes Eletricas (PIE) atualizado, com os documentos, laudos e o conjunto de procedimentos exigidos pela NR-10 para instalacoes com carga instalada superior a 75 kW. Constatou-se [existencia/ausencia] do prontuario atualizado.',
    itemVerificar: true,
  },
  {
    norma: 'NR-10',
    item: '10.2.8',
    categoria: 'seguranca',
    assunto: 'Medidas de protecao coletiva',
    texto:
      'As medidas de protecao coletiva, com prioridade para a desenergizacao e a equipotencializacao, devem ser adotadas conforme a NR-10 nos servicos e instalacoes eletricas. Verificou-se [adequacao/deficiencia] das medidas de controle existentes.',
    itemVerificar: true,
  },
];
