document.getElementById('lang-select').addEventListener('change', (e) => {
    const lang = e.target.value;
    document.querySelectorAll('[data-en]').forEach(el => {
        el.textContent = el.getAttribute(`data-${lang}`);
    });
});
