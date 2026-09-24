# Conexão pessoal via Meu Pluggy

Este guia descreve o caminho usado como referência para **ler os próprios dados**. Ele não configura conectores bancários diretos nem operações de pagamento. Regras de acesso e preços podem mudar; confira o [guia oficial do Meu Pluggy](https://meu.pluggy.ai/api-guide) antes de começar.

## 1. Criar as duas contas

1. Crie uma conta pessoal gratuita em [Meu Pluggy](https://meu.pluggy.ai/).
2. Crie uma conta no [Dashboard da Pluggy](https://dashboard.pluggy.ai/) e uma aplicação de desenvolvimento. O Dashboard fornece `clientId` e `clientSecret` para a aplicação; **não** coloque esses valores no Excel, no navegador ou neste repositório.

O Meu Pluggy é onde ficam os consentimentos bancários. O Dashboard é onde a aplicação de desenvolvimento acessa, via API, os dados que você autorizou. O período de teste exibido no Dashboard não deve ser confundido com a atualização gratuita das conexões pessoais do Meu Pluggy; confirme o escopo atual do serviço antes de depender dele. [Fontes: Meu Pluggy](https://meu.pluggy.ai/api-guide), [Itens Meu Pluggy](https://docs.pluggy.ai/pt/docs/connections/item).

## 2. Conectar cada banco no Meu Pluggy

No Meu Pluggy, selecione uma instituição, conclua o fluxo de consentimento/autenticação e aguarde a conexão ficar ativa. Repita para cada banco desejado. Faça isso somente nas telas oficiais da Pluggy e da instituição; o código deste repositório não recebe senhas bancárias. [Fonte: guia do Meu Pluggy](https://meu.pluggy.ai/api-guide).

## 3. Vincular cada conexão à aplicação

No Dashboard, abra a aplicação de desenvolvimento, escolha o conector **MeuPluggy** e autorize uma das conexões já feitas no Meu Pluggy. Cada instituição exige sua própria autorização no aplicativo. Guarde o `itemId` do Item proxy em armazenamento privado do servidor; não o publique no GitHub. A própria Pluggy descreve esse vínculo pela aplicação demo no [guia de API](https://meu.pluggy.ai/api-guide) e distingue Item original de Item proxy na [documentação de Items](https://docs.pluggy.ai/pt/docs/connections/item).

Na implantação do projeto, o backend também verifica o ID do conector e o proprietário autorizado antes de ler o Item. O exemplo `src/meu-pluggy.ts` ilustra a checagem do conector; ela, sozinha, **não** substitui autenticação e autorização de usuário.

## 4. Autenticar e ler dados no servidor

No backend, troque `clientId` e `clientSecret` por uma API Key usando `POST /auth`. Use essa chave, no servidor, para consultar `GET /accounts?itemId=...` e depois `GET /transactions?accountId=...`. Trate paginação, erros e reprocessamento idempotente antes de gravar os dados no seu banco. Não envie a API Key para o VBA ou frontend. A [autenticação da Pluggy](https://docs.pluggy.ai/en/docs/authentication) diferencia API Key de Connect Token; o [guia oficial](https://meu.pluggy.ai/api-guide) traz a sequência básica de leitura.

Se criar seu próprio fluxo visual de conexão, gere um Connect Token no backend e abra o Connect Widget no frontend. Restrinja os conectores exibidos com `connectorIds` e capture o `itemId` retornado; o token de conexão não é uma credencial duradoura para consultar todo o histórico. Consulte [configurações do Widget](https://v2.docs.pluggy.ai/en/docs/connect-widget/environments) e [criação do token](https://docs.pluggy.ai/en/reference/auth/connect-token-create). Para o fluxo pessoal acima, o vínculo pela aplicação demo dispensa criar um Widget próprio.

## 5. Sincronizar sem forçar atualização bancária

O Item **original** no Meu Pluggy é atualizado automaticamente pelo serviço, em geral a cada 24 horas. O Item **proxy** na sua aplicação reflete essas atualizações, mas não deve receber `PATCH` nem tentativa de atualização manual. Um job próprio pode apenas **ler** periodicamente os dados já disponíveis e fazer upsert no banco. Webhooks podem avisar sobre novos dados. [Fonte: documentação de Items Meu Pluggy](https://docs.pluggy.ai/pt/docs/connections/item).

Depois da ingestão, a interface Excel consulta o snapshot no backend. O usuário revisa sugestões de conciliação e só então confirma a baixa de uma parcela. Compras no cartão e pagamento da fatura permanecem separados para evitar gasto duplicado.

## Checklist antes de usar dados reais

- Confirme que o Item veio do conector MeuPluggy e pertence ao usuário esperado.
- Mantenha segredos e tokens fora do XLSM e do GitHub.
- Restringa acesso às tabelas e rotinas do banco; ative RLS onde aplicável.
- Importe apenas o necessário e preserve IDs estáveis para não duplicar transações.
- Não faça baixa automática por coincidência de valor e data.
- Não implemente Pix, pagamento ou agendamento sem um projeto e autorização separados.
