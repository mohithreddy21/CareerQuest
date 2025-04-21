document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    const userActions = document.querySelector('.user-actions');
    
    if (mobileMenuToggle) {
      mobileMenuToggle.addEventListener('click', function() {
        mainNav.style.display = mainNav.style.display === 'block' ? 'none' : 'block';
        userActions.style.display = userActions.style.display === 'flex' ? 'none' : 'flex';
      });
    }
    
    // Dropdown menus
    const dropdowns = document.querySelectorAll('.dropdown');
    
    dropdowns.forEach(dropdown => {
      const link = dropdown.querySelector('a');
      
      link.addEventListener('click', function(e) {
        // In a real app, this would toggle a dropdown menu
        // For this simple clone, we'll just prevent the default action
        e.preventDefault();
      });
    });
  });