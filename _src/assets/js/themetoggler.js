const toggleButton = document.getElementById('theme-toggle');

// Check the system preference
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const savedTheme = localStorage.getItem('theme');
const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

// Apply the initial theme on load
document.documentElement.setAttribute('data-theme', initialTheme);
//toggleButton.textContent = initialTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';

toggleButton.addEventListener('click', () => {
    let currentTheme = document.documentElement.getAttribute('data-theme');
    let newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update button text
    //toggleButton.textContent = newTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
});
