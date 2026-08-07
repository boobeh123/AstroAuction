// DOM selectors
const flashes = document.querySelectorAll('.flash');
const deleteForms = document.querySelectorAll('.deleteForm');

// Helper functions
function dismissFlash(flash) {
  setTimeout(() => {
    flash.remove();
  }, 300);
}

// Handler functions
function handleFlashDismiss(flash) {
  const isError = flash.classList.contains('flash-error');
  const timeout = isError ? 7000 : 5000;

  const dismissTimer = setTimeout(() => {
    dismissFlash(flash);
  }, timeout);

  // Manual dismiss
  const closeBtn = flash.querySelector('.flash-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      clearTimeout(dismissTimer);
      dismissFlash(flash);
    });
  }
}

// Confirmation before delete - profileController.deleteProfile & auctionController.deleteAuction
function handleDeleteConfirm(event) {
  const confirmed = confirm('Are you sure you want to permanently DELETE this?\n' + 'This action cannot be UNDONE.');

  if (!confirmed) {
    event.preventDefault();
  }
}

// Event listeners
flashes.forEach(handleFlashDismiss);

deleteForms.forEach((deleteForm) => {
  deleteForm.addEventListener('submit', handleDeleteConfirm);
});
