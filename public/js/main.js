document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.flash').forEach((element, index) => {
        const close = element.querySelector('.flash__close');
        const remove = () => element.remove();
        let time = setTimeout(remove, 5000 + index * 500);

        ['mouseenter','focusin'].forEach(event => element.addEventListener(event, () => clearTimeout(time)));
        ['mouseleave','focusout'].forEach(event => element.addEventListener(event, () => time = setTimeout(remove, 3000)));
        
        if (close) close.addEventListener('click', remove);
  });

  const createListingBtn = document.querySelector('.rest').addEventListener('click', createListing);
  
  function createListing() {
    console.log('hello world');
    alert('hello world');
  }    

});