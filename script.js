window.onload = function () {
    const cloudLeft = document.getElementById('cloud-left');
    const cloudRight = document.getElementById('cloud-right');

    if (cloudLeft && cloudRight) {
        cloudLeft.style.animation = 'cloudLeft 3s forwards';
        cloudRight.style.animation = 'cloudRight 3s forwards';

        setTimeout(() => {
            document.getElementById('cloud-container').classList.add('hidden');
            document.body.style.overflow = 'auto'; // Enable scrolling after animation
        }, 3000); // Match animation duration
    }
};

document.addEventListener("DOMContentLoaded", function () {
    const collapsibles = document.querySelectorAll(".collapsible");

    collapsibles.forEach(collapsible => {
        collapsible.addEventListener("click", function () {
            this.classList.toggle("active");
            const content = this.nextElementSibling;

            if (content.style.maxHeight) {
                content.style.maxHeight = null;
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
            }
        });
    });
});

// Fullscreen functionality for the game iframe
function openGameFullscreen() {
    const iframe = document.querySelector('#game iframe'); // Select the iframe for the game
    if (iframe.requestFullscreen) {
        iframe.requestFullscreen();
    } else if (iframe.mozRequestFullScreen) { // Firefox
        iframe.mozRequestFullScreen();
    } else if (iframe.webkitRequestFullscreen) { // Chrome, Safari, and Opera
        iframe.webkitRequestFullscreen();
    } else if (iframe.msRequestFullscreen) { // IE/Edge
        iframe.msRequestFullscreen();
    } else {
        alert('Fullscreen mode is not supported on this browser.');
    }
}

// Function to open the game in a new tab
function openGameNewTab() {
    const gameUrl = "https://thesecretsofsilverclouds.github.io/Lintelgotchi/";
    window.open(gameUrl, '_blank');
}
