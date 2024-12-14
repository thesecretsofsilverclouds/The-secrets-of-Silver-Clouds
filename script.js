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
    // Collapsible functionality for the codex
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

    // Load blog entries
    const blogEntries = [
        {
            title: "Behind the Scenes of The Secrets of Silver Clouds",
            date: "December 15, 2024",
            content: "Discover the creative process and inspiration behind 'The Secrets of Silver Clouds.' From childhood dreams to publishing triumphs, join Silent on this incredible journey."
        },
        {
            title: "Exploring the Characters",
            date: "December 10, 2024",
            content: "Meet the unforgettable characters of the Silver Clouds universe. Learn about their motivations, powers, and what makes them stand out in a crowded fantasy genre."
        },
        {
            title: "Upcoming Events",
            date: "November 25, 2024",
            content: "Exciting events are on the horizon! Book signings, live Q&As, and more. Stay tuned for updates on how to connect with Silent and celebrate this epic fantasy series."
        }
    ];

    // Function to load and display blog entries
    function loadBlogEntries() {
        const blogContainer = document.getElementById('blog-posts');
        blogEntries.forEach(entry => {
            const blogPost = document.createElement('article');
            blogPost.classList.add('blog-post');
            blogPost.innerHTML = `
                <h3>${entry.title}</h3>
                <p><em>${entry.date}</em></p>
                <p>${entry.content}</p>
            `;
            blogContainer.appendChild(blogPost);
        });
    }

    // Call to load blogs
    loadBlogEntries();
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
