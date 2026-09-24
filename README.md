# Controle financeiro com Open Finance

Projeto pessoal de leitura e conciliação financeira com Excel Desktop, Supabase e Pluggy. Este repositório é uma **versão pública de portfólio**: contém algoritmos reaproveitáveis e testes fictícios, não a planilha operacional nem o backend configurado para uma pessoa real.

## O problema

Uma planilha de contas a pagar mostra o planejamento, mas não comprova que uma conta foi paga. O extrato bancário mostra o movimento real, mas não sabe a qual parcela planejada ele se refere. Pagamentos de fatura também podem inflar o total de gastos se forem somados novamente às compras do cartão.

O fluxo separa essas três coisas:

```text
Contas planejadas no Excel ─┐
                           ├─> sugestões de conciliação ─> confirmação humana
Movimentos do Open Finance ─┘               │
                                            └─> baixa da parcela correspondente

Compras/serviços ─> gasto realizado
Pagamento de fatura ─> saída de caixa, não novo gasto
```

Nenhuma rotina inicia Pix, pagamento ou agendamento. Uma sugestão não dá baixa sozinha.

## Arquitetura da implantação privada

- **Excel Desktop (VBA):** cadastro, edição, exclusão, visualização e revisão de correspondências. O arquivo pode residir no Google Drive Desktop.
- **Supabase:** banco de dados privado, funções de API, tarefas agendadas e trilha de auditoria. A implantação utiliza autenticação por credencial de dispositivo; segredos da Pluggy ficam apenas no servidor.
- **Meu Pluggy:** conecta as contas do próprio usuário. A aplicação de desenvolvimento lê os dados por um Item proxy; a planilha nunca recebe credenciais bancárias.
- **Motor de conciliação:** filtra movimentos não elegíveis, compara valor/data/descrição e pontua candidatos. Casos incertos aguardam revisão humana.

Os módulos em `src/` demonstram a normalização de dados, a pontuação de conciliação e a priorização de obrigações. Eles **não** são um aplicativo pronto para conectar contas reais: os endpoints privados, o XLSM, os esquemas de dados e a configuração de produção foram omitidos intencionalmente.

## Testes

Requer Node.js 22 ou superior. Os casos de teste usam somente dados inventados.

```bash
npm test
```

## Como conectar a Pluggy

Veja o [guia passo a passo](docs/pluggy.md). Ele explica o caminho pessoal via Meu Pluggy, a diferença entre a conexão original e o Item proxy, a leitura pela API, os cuidados com credenciais e a cadência de sincronização. Confirme sempre as condições atuais do serviço antes de reutilizar esse fluxo.

## Segurança e limites

- Não versione planilhas reais, extratos, backups, chaves de API, tokens, IDs de Items reais ou credenciais de dispositivo.
- Guarde `clientId` e `clientSecret` da Pluggy no servidor; Connect Token, quando usado, é temporário e restrito.
- Verifique titularidade e conector no backend antes de associar um Item proxy a um usuário.
- Conciliação por pontuação é apoio à decisão, não prova de pagamento. Pagamentos parciais, negociações e transferências ambíguas exigem revisão.
- Uma estimativa de fatura futura baseada em compras ainda não equivale à fatura oficial.

Este repositório não é afiliado à Pluggy, à Supabase ou a instituições financeiras. Não contém dados financeiros reais e não executa operações bancárias.
