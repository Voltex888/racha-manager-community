# Racha Manager Comunidade

Versão multi-racha criada separadamente do Racha Manager privado.

## O que já está pronto

- cadastro e login por e-mail e senha;
- criação de vários rachas por uma mesma conta;
- entrada por código de convite;
- seleção e troca do racha ativo;
- dados isolados em `rachas/{rachaId}/data/main`;
- funções de proprietário, organizador, auxiliar e jogador;
- painel do proprietário para alterar permissões;
- fotos, músicas e fundos separados pelo identificador do racha;
- PWA instalável com cache próprio;
- regras iniciais do Firestore em `firestore.rules`.

## Isolamento do projeto privado

O Racha Manager privado continua na pasta e no repositório originais. Esta aplicação não usa o documento `racha/data`. Cada novo racha começa vazio e recebe um identificador exclusivo.

Antes de publicar, crie um projeto Firebase exclusivo para esta versão e substitua `firebaseConfig` em `js/core/app-state.js`. Não use em produção o projeto Firebase do Racha Manager privado.

Também é recomendado criar um projeto Supabase e um bucket exclusivos, substituindo `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_MEDIA_BUCKET` no mesmo arquivo.

## Firebase

1. Crie um novo projeto no Firebase.
2. Ative Authentication por e-mail e senha.
3. Crie um banco Cloud Firestore.
4. Cadastre um aplicativo Web e copie a configuração para `js/core/app-state.js`.
5. Publique as regras de `firestore.rules`.
6. Adicione o domínio publicado aos domínios autorizados do Authentication.

Com a Firebase CLI instalada, as regras podem ser publicadas com:

```bash
firebase login
firebase use --add
firebase deploy --only firestore:rules
```

## Executar localmente

Sirva a pasta por HTTP:

```bash
python -m http.server 8080
```

Abra `http://localhost:8080`.

## Permissões

- Proprietário: gerencia o racha, pessoas, permissões e todos os dados.
- Organizador: pode editar e organizar o conteúdo do racha.
- Auxiliar: pode editar e organizar o conteúdo do racha.
- Jogador: consulta elenco, listas, rodadas, rankings e o próprio espaço do racha.

As permissões visuais não substituem a segurança do banco. Sempre publique `firestore.rules` junto com a aplicação.
