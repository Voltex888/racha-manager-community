# Arquitetura do Racha Manager

## Objetivo

Separar apresentação, regras de negócio, persistência e bibliotecas externas sem reescrever o sistema de uma vez. A prioridade desta versão é organização com compatibilidade.

## Camadas

### `vendor/`
Bibliotecas externas. Não contém código de negócio do Racha Manager.

### `css/`
Folhas de estilo divididas na mesma ordem do CSS original. A ordem dos links em `index.html` é intencional porque várias regras posteriores sobrescrevem regras anteriores.

### `js/services/`
Adaptadores para dependências externas. `firebase-adapter.js` fornece a pequena fachada usada pelo código legado para Auth, Firestore e Storage.

### `js/core/`
Estado compartilhado, configuração e inicialização geral. Essa camada ainda contém variáveis globais herdadas do monólito para preservar compatibilidade.

### `js/features/`
Código agrupado por domínio do produto: jogadores, rodadas, rankings/troféus, recordes, meses/perfil e fundos.

### `js/ui/`
Comportamentos de interface que atravessam features, como navegação e música.

## Padrões aplicados

- Feature-based organization: código agrupado pelo domínio que altera.
- Adapter/Facade: acesso ao Firebase fica atrás de funções auxiliares em `services/firebase-adapter.js`.
- Vendor isolation: SDKs minificados não ficam misturados ao código da aplicação.
- Separation of concerns: HTML, CSS, integrações e regras de domínio não permanecem no mesmo arquivo.
- Progressive refactoring: a ordem original de execução é preservada para evitar regressões.

## Próxima etapa recomendada

Depois de testar esta versão em produção, a evolução mais segura é migrar uma feature de cada vez para ES Modules com dependências explícitas. A ordem sugerida é:

1. `backgrounds.js` e `navigation-music.js`, porque possuem fronteiras mais claras.
2. `players.js` e `rounds.js`.
3. `rankings-trophies.js` e `records.js`.
4. `months-profile.js`.
5. Por último, transformar `core/app-state.js` em um Store real e retirar as variáveis globais.

Não é recomendado fazer essa segunda etapa toda de uma vez sem testes automatizados, porque o sistema possui muitas regras cruzadas de pódios, recordes, sorteio, presença, fotos e fundos.
