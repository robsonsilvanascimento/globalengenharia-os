/**
 * Esqueleto padrao de um laudo tecnico de inspecao, no mesmo espirito dos
 * relatorios profissionais de engenharia. Serve de ponto de partida: o tecnico
 * preenche os campos entre colchetes e insere os trechos normativos da
 * biblioteca ao lado.
 *
 * Convencoes de formatacao lidas pelo gerador de PDF:
 * - "1. Titulo" / "6.1 Subtitulo": secoes numeradas (as principais entram no
 *   sumario automaticamente).
 * - "- item": lista.
 * - "[NC] ...": caixa de nao conformidade em destaque.
 * - "[!] ...": caixa de atencao.
 */
export const ESQUELETO_LAUDO = `1. DADOS DE IDENTIFICAÇÃO
Contratante / Razão social: [nome]
CNPJ / CPF: [documento]
Endereço da instalação: [rua, número, bairro]
Cidade / UF: [cidade / UF]
Classificação da edificação: [ex.: comercial, residencial, industrial]
Responsável pela unidade: [nome]
Data da vistoria: [dd/mm/aaaa]

2. OBJETO
O presente laudo técnico refere-se à inspeção e à avaliação de [descrever o sistema ou instalação], localizado em [local], quanto à conformidade com as normas técnicas vigentes.
As inspeções e medições realizadas visam assegurar que:
- A instalação está executada conforme o projeto e as normas aplicáveis;
- Os componentes encontram-se em bom estado, com conexões firmes e livres de corrosão;
- As condições de segurança de pessoas e do patrimônio estão atendidas.

3. NORMAS E DOCUMENTOS DE REFERÊNCIA
Insira aqui, pela biblioteca ao lado, os trechos das normas aplicáveis ao caso.

4. METODOLOGIA E INSTRUMENTOS
A avaliação foi realizada por meio de inspeção visual e de medições em campo, na data indicada. Instrumentos utilizados: [ex.: terrômetro, micro-ohmímetro, alicate-amperímetro], devidamente aferidos.

5. ANÁLISE DO SISTEMA
[Descreva o estado atual dos componentes inspecionados, as medições realizadas e as observações relevantes.]

6. NÃO CONFORMIDADES E RECOMENDAÇÕES
[NC] [Descreva cada não conformidade encontrada e a recomendação correspondente.]

7. RECOMENDAÇÕES GERAIS
[Liste as recomendações de adequação e de manutenção necessárias.]

8. CONSIDERAÇÕES FINAIS
8.1 [Considerações sobre o resultado da inspeção e as limitações do laudo.]

9. CONCLUSÃO
Com base nas inspeções e medições realizadas e nas normas vigentes, conclui-se que a instalação encontra-se [conforme / conforme com ressalvas / não conforme], observadas as recomendações apontadas neste laudo.
`;
