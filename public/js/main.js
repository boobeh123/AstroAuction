document.addEventListener('DOMContentLoaded', () => {

  // Auto-dismiss flash
  const flashes = document.querySelectorAll('.flash');  
  flashes.forEach(flash => {
      const isError = flash.classList.contains('flash-error');
      const timeout = isError ? 7000 : 5000;
      const dismissTimer = setTimeout(() => {
        dismissFlash(flash);
      }, timeout);
      
      // Manual dismiss flash
      const closeBtn = flash.querySelector('.flash-close');
      if (closeBtn) {
          closeBtn.addEventListener('click', () => {
              clearTimeout(dismissTimer);
              dismissFlash(flash);
          });
      }
  });

  // Confirmation to delete - profileController.deleteProfile
  const deleteForm = document.querySelector('#deleteForm');
  if (deleteForm) {
      deleteForm.addEventListener('submit', (event) => {
          const confirmed = confirm('Are you sure you want to permanently DELETE your account?\n' + 'This action cannot be UNDONE.');

          if (!confirmed) {
              event.preventDefault();
          }

      });
  }

});

function dismissFlash(flash) {
  setTimeout(() => {
    flash.remove();
  }, 300);
}