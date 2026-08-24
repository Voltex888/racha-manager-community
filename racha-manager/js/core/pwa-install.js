let deferredInstallPrompt=null;
const installAppButton=document.getElementById('btnInstallApp');
const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
const isIos=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
function updateInstallAppButton(){
  if(!installAppButton)return;
  installAppButton.style.display=isStandalone()?'none':'';
}
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  updateInstallAppButton();
});
window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  updateInstallAppButton();
  if(typeof showToast==='function')showToast('Racha Manager instalado no celular.');
});
installAppButton?.addEventListener('click',async()=>{
  if(isStandalone())return;
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt=null;
    updateInstallAppButton();
    return;
  }
  const message=isIos()?'No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.':'Abra o menu do navegador e escolha Instalar aplicativo ou Adicionar à tela inicial.';
  if(typeof showToast==='function')showToast(message);else alert(message);
});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
updateInstallAppButton();
