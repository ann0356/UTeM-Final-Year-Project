// Search function
const searchButton =
    document.querySelector('.search-icon');

const searchPanel =
    document.querySelector('.search-panel');

searchButton.addEventListener('click', (event) => {

    event.stopPropagation();

    searchPanel.style.display =
        searchPanel.style.display === 'block'
        ? 'none'
        : 'block';

});

document.addEventListener('click', (event) => {

    const searchContainer =
        document.querySelector('.search-container');

    if (!searchContainer.contains(event.target)) {
        searchPanel.style.display = 'none';
    }

});

// login and register status checking

