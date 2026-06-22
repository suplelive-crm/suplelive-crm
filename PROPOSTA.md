# Proposta de Entrega — Plataforma CRM / Omnichannel

**Cliente:** {{NOME_DO_CLIENTE}}
**Fornecedor:** {{SEU_NOME / SUA_EMPRESA}}
**Data:** {{DATA}}
**Validade da proposta:** {{XX}} dias
**Versão do documento:** 1.0

---

## 1. Visão Geral

Entrega de uma plataforma web de CRM e gestão omnichannel sob medida, voltada para
operações de e-commerce e atendimento via WhatsApp. A solução centraliza atendimento,
base de clientes, pedidos, campanhas, automações de mensagens e acompanhamento logístico
(rastreio de encomendas), com integração ao ERP e ao WhatsApp.

A plataforma é multiusuário e organizada por **workspace** (ambiente isolado por empresa),
permitindo controle de acesso e dados segregados.

> Este documento descreve **o que será entregue** (escopo funcional, integrações e serviços).
> Valores e condições comerciais já foram acordados separadamente (ver seção 5).

---

## 2. Escopo de Funcionalidades

Detalhamento por módulo e funcionalidade.

### 2.1. Acesso, Conta e Multiempresa (Workspace)
- Cadastro e login de usuários (e-mail e senha) com sessão persistente.
- Recuperação de sessão automática ao reabrir a plataforma.
- Estrutura **multi-workspace**: cada empresa/operação opera em um ambiente isolado, com
  dados próprios (clientes, pedidos, conversas, automações etc.).
- Onboarding de criação de workspace (nome, plano) com validação de unicidade.
- Memória do último ambiente e da última tela acessada para retorno rápido.
- Tela de **Configurações** do workspace e gestão de usuários da conta.

### 2.2. Atendimento / Inbox (WhatsApp Omnichannel)
- Conexão de número(s) de WhatsApp via Evolution API (ver 3.1).
- Caixa de entrada de conversas integrada ao atendimento ({{Chatwoot / inbox interno}}).
- Envio e recebimento de mensagens em tempo real (texto e mídia: imagem, vídeo, áudio,
  documento).
- Recebimento de eventos do WhatsApp via webhook (novas mensagens, status de conexão,
  atualização de contatos).
- Organização de conversas por **status** (aberta, pendente, fechada).
- Direcionamento de conversas por **setor/departamento**.
- Painel de informações do contato durante o atendimento.

### 2.3. Clientes (Base / CRM)
- Cadastro, edição e exclusão de clientes.
- Listagem com busca e visualização de dados de contato.
- Conversão de **lead → cliente**.
- Histórico de pedidos por cliente.
- **Análise RFM** (Recência, Frequência, Valor) por cliente, com classificação automática
  em categorias (ex.: Campeões, Clientes Fiéis, Em Risco, Hibernando etc.) para segmentação
  e ações de marketing/recompra.

### 2.4. Pedidos
- Cadastro, edição e exclusão de pedidos.
- Vínculo de pedidos ao cliente.
- Detalhamento do pedido (itens, valores, datas).
- Listagem e consulta de pedidos do workspace.
- Base alimentada também pela integração com o ERP (ver 3.2).

### 2.5. Funil / Kanban
- Quadros (boards) configuráveis por workspace.
- **Etapas/colunas** personalizáveis (nome, cor, ordenação).
- Distribuição de clientes pelas etapas via **arrastar e soltar**.
- Reordenação de clientes dentro da etapa e movimentação entre etapas.
- Adição em lote de clientes ao quadro e remoção do quadro.

### 2.6. Campanhas
- Criação de campanhas de mensagens/marketing.
- Vínculo com a base de clientes e canais de envio.
- Listagem e acompanhamento das campanhas do workspace.

### 2.7. Automação (Construtor de Fluxos)
- **Construtor visual** de automações (workflow builder) com nós conectáveis em tela.
- Tipos de nó suportados:
  - **Gatilho (Trigger)** — inicia o fluxo.
  - **Ação (Action)** — executa uma tarefa (ex.: enviar mensagem).
  - **Condição (Condition)** — ramifica o fluxo conforme regras.
  - **Atraso (Delay)** — agenda/espera entre etapas.
  - **Webhook** — integra com sistemas externos.
  - **Chatbot** — respostas automáticas.
  - **Agente de IA (Agent)** e **Classificador (Classifier)** — uso de IA no fluxo.
- **Editor de mensagens** com pré-visualização e **seletor de variáveis** (personalização
  com dados do cliente/pedido).
- **Galeria de modelos** (templates) para iniciar fluxos prontos.
- **Histórico de execuções** das automações.
- **Teste de automação** antes de publicar.
- Pausar, retomar e versionar fluxos.

### 2.8. Acompanhamento / Logística (Rastreio de Encomendas)
- Gestão de três tipos de movimentação:
  - **Compras** (entrada de produtos) com itens, custo, frete, loja e observações.
  - **Devoluções** (returns).
  - **Transferências** entre estoques (origem/destino).
- **Rastreamento de pacotes** por transportadora e código de rastreio, com atualização de
  status e histórico de eventos.
- Atualização **em lote** dos status de rastreio.
- Transportadoras com link direto de rastreamento: Correios, Jadlog, Total Express,
  Azul Cargo, Braspress, Mercado Envios.
- **Conferência de produtos** recebidos (verificação, vencimento, preços) e entrada em
  estoque.
- Conferência e baixa de transferências entre estoques.
- Visualização em **tabela** ou **Kanban**, com filtro de arquivados.
- Autocompletar de produtos no cadastro.

### 2.9. Dashboard e Analytics
- **Dashboard** inicial com indicadores-chave (cards de estatísticas), atividade recente e
  gráfico de receita.
- **Analytics** com gráficos (receita, pedidos, origem de leads, funil de conversão) e
  visões por período.

> Observação de escopo: relatórios e gráficos serão conectados aos dados reais da operação
> como parte da entrega. {{Ajustar conforme o que estiver acordado.}}

### 2.10. Configurações e Gestão de Usuários
- **Setores/departamentos** configuráveis (nome, cor, descrição, setor padrão) para roteamento
  de atendimento.
- Gestão de usuários do workspace (cadastro de operadores/administradores). {{Confirmar nível
  de gestão de usuários incluído no escopo.}}
- **Perfis de Agentes de IA** configuráveis (modelo, temperatura, prompt do sistema) para uso
  nas automações/chatbot.

---

## 3. Integrações

### 3.1. WhatsApp — Evolution API
- Conexão de instâncias de WhatsApp (geração de QR Code, status de conexão, reconexão,
  reinício e exclusão de instância).
- Envio de mensagens de texto e mídia (imagem, vídeo, áudio, documento).
- Recebimento de eventos via **webhook** (mensagens, conexão, contatos, grupos).

### 3.2. ERP — Tiny *(integração a ser refeita)*
- **Refazer a integração do ERP utilizando o Tiny**, substituindo o conector atual
  (Baselinker).
- Sincronização prevista:
  - **Pedidos** (importação para a plataforma).
  - **Clientes** (sincronização da base).
  - **Estoque / Produtos** (consulta e atualização de quantidades).
- Comunicação intermediada por camada de servidor (proxy seguro) para tratamento de
  autenticação e CORS, no mesmo padrão já adotado na plataforma.

> Detalhe técnico: a arquitetura atual já segue o padrão "frontend → função de servidor →
> API do ERP", o que facilita a substituição do Baselinker pelo Tiny mantendo os fluxos de
> pedidos/clientes/estoque.

### 3.3. OpenAI (IA)
- Integração com OpenAI para **chatbot inteligente** e **classificação de texto** nas
  automações e atendimento.
- Configuração de modelo, temperatura e prompt por agente.

### 3.4. n8n (Automações externas)
- Conexão com n8n para orquestração de automações e fluxos avançados/personalizados.

### 3.5. Rastreio de Transportadoras
- Integração de rastreamento de encomendas (ver 2.8), com proxy de servidor e rotina de
  atualização automática de status.

### 3.6. Marketplaces *(roadmap / não inclusos nesta entrega)*
- Shopee, Mercado Livre e RD Marketplace estão previstos como evolução futura e **não fazem
  parte deste escopo**, salvo acordo adicional.

---

## 4. Serviços Inclusos (Extras)

### 4.1. Suporte Técnico + Alterações Menores (3 meses)
- Período de **3 meses** de suporte técnico a partir da entrega/go-live.
- Correção de erros (bugs) da plataforma entregue.
- **Alterações menores**: pequenos ajustes de layout, textos, campos e regras simples.
- Canal e SLA de atendimento: {{definir — ex.: WhatsApp/e-mail, resposta em até X horas úteis}}.
- *Não incluso:* novos módulos, novas integrações ou mudanças estruturais (tratados como
  escopo adicional).

### 4.2. Documentação e Tutoriais de Uso
- Material de apoio para uso da plataforma: {{guia escrito / vídeos curtos / base de
  conhecimento}}.
- Cobertura dos principais fluxos: atendimento, clientes, pedidos, automações e rastreio.
- Entregue em formato {{PDF / portal / vídeos}}.

### 4.3. Consultoria de Sucesso do Cliente
- Acompanhamento para garantir a adoção e os resultados da plataforma.
- {{X}} sessões/reuniões de orientação durante o período de {{XX}}.
- Apoio na configuração inicial (workspace, setores, agentes de IA, automações) e boas
  práticas de operação.

---

## 5. Condições Comerciais

- **Investimento:** {{R$ XX — já acordado}}
- **Forma de pagamento:** {{definir}}
- **Prazo de entrega:** {{definir}}
- **Início do suporte (3 meses):** a partir de {{go-live / aceite}}

---

## 6. Premissas e Exclusões

- O cliente fornecerá os acessos necessários (conta Tiny/ERP, número de WhatsApp, chaves de
  API, dados para migração).
- Custos de serviços de terceiros (servidor/hospedagem, Evolution API, OpenAI, ERP Tiny,
  n8n e demais APIs) {{são / não são}} parte deste valor.
- Itens marcados como *roadmap* ou *não inclusos* dependem de novo acordo comercial.
- Treinamento presencial, integrações não listadas e relatórios customizados adicionais não
  estão inclusos salvo menção expressa.

---

## 7. Cronograma (Resumo)

| Etapa | Descrição | Prazo |
|------|-----------|-------|
| 1 | {{Setup / ajustes da plataforma}} | {{}} |
| 2 | {{Integração ERP Tiny}} | {{}} |
| 3 | {{Configuração WhatsApp/automações}} | {{}} |
| 4 | {{Testes e go-live}} | {{}} |
| 5 | Suporte + consultoria (3 meses) | {{}} |

---

## 8. Aceite

Ao assinar abaixo, as partes concordam com o escopo descrito neste documento.

**Cliente:** ______________________________  Data: ____/____/____

**Fornecedor:** ___________________________  Data: ____/____/____
