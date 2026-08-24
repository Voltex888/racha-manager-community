# Correção dos fundos no mobile

- Corrigido o salvamento compacto que apagava `rarityBackgrounds` do documento do Firestore.
- O Firestore agora é a fonte principal dos metadados de fundo em qualquer dispositivo.
- O cache IndexedDB ficou apenas como fallback legado e não sobrescreve dados remotos.
- A inicialização aguarda os dados principais antes de hidratar os fundos no mobile.
- Os fundos são reaplicados após renderizações de Elenco, Mês, Rankings, Perfil e Recordes.
- Adicionada recuperação automática dos metadados antigos: se o Firestore estiver sem `rarityBackgrounds`, mas o desktop do administrador ainda tiver o cache com URLs do Supabase, esses metadados são republicados no Firestore.

## Importante para recuperar os fundos já existentes

Depois de publicar esta versão, abra o site uma vez no computador onde os fundos ainda aparecem e entre como organizador. Aguarde alguns segundos. Isso recupera os metadados locais antigos para o Firestore. Depois, ao abrir no celular, os fundos serão carregados pela nuvem.
