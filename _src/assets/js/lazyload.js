document.querySelectorAll('a[href]').forEach(link => {
    link.setAttribute('data-href', link.getAttribute('href'));
    link.removeAttribute('href');
    link.classList.add('lazyload');
});

document.addEventListener('lazybeforeunveil', function(e){
    var link = e.target;
    if (link.getAttribute('data-href')) {
        link.setAttribute('href', link.getAttribute('data-href'));
    }
});