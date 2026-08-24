# Fundos no mobile: encaixe sem cortes

- No mobile (até 760px), fundos personalizados agora usam `contain` e ficam centralizados.
- A arte remota do Supabase é exibida inteira, sem `cover`, sem corte e sem distorção.
- O tamanho responsivo do card/linha continua sendo definido pelo layout do celular.
- Ajustes de escala e posição do desktop continuam válidos no desktop, mas são normalizados no mobile para evitar que o fundo saia da área visível.
- Fundos são reaplicados após resize/orientação para manter o encaixe correto.
- Prévia no mobile segue o mesmo comportamento de `contain`.
