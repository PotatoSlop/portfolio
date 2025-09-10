document.addEventListener('DOMContentLoaded', function() {
    let overlay = document.querySelector('.sidebar-overlay');
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const closeSidebar = document.getElementById('close-sidebar');
    const sidebar = document.querySelector('.sidebar');

    if (hamburgerMenu) {
        hamburgerMenu.addEventListener('click', function(e) {
            e.preventDefault();
            showSidebar();
        });
    }
    
    if (closeSidebar) {
        closeSidebar.addEventListener('click', function(e) {
            e.preventDefault();
            hideSidebar();
        });
    }
    
    // Hide sidebar
    overlay.addEventListener('click', hideSidebar);
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
            hideSidebar();
        }
    });
    window.addEventListener('resize', function() {
        const isDesktop = window.innerWidth > 768;
        if (isDesktop && sidebar.classList.contains('active')) {
            hideSidebar();
        }
    });
});

function showSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar && overlay) {
        sidebar.style.display = 'flex';
        overlay.classList.add('active');
        setTimeout(() => {
            sidebar.classList.add('active');
        }, 10);

        document.body.style.overflow = 'hidden';
    }
}

function hideSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        
        document.body.style.overflow = '';
        
        // Hide sidebar after animation completes
        setTimeout(() => {
            sidebar.style.display = 'none';
        }, 300);
    }
}