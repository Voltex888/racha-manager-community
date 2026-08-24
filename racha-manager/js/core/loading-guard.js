
  setTimeout(function(){
    var el = document.getElementById('headerSub');
    if(el && el.textContent === 'Carregando dados...'){
      el.textContent = 'Não consegui concluir o carregamento. Verifique a internet e abra o arquivo novamente.';
      el.style.color = 'var(--coral)';
    }
  }, 8000);
