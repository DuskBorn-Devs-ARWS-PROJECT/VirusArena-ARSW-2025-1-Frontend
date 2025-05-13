document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const createGameBtn = document.getElementById('createGameBtn');
    const joinGameBtn = document.getElementById('joinGameBtn');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        if (username) {
            localStorage.setItem('playerName', username);
            document.querySelector('.login-form').style.display = 'none';
            document.querySelector('.game-options').style.display = 'flex';
        }
    });

    createGameBtn.addEventListener('click', () => {
        localStorage.removeItem('gameCode');
        window.location.href = 'lobby.html';
    });

    joinGameBtn.addEventListener('click', () => {
        const gameCode = prompt('Ingresa el código de la partida:');
        if (gameCode) {
            localStorage.setItem('gameCode', gameCode.toUpperCase());
            window.location.href = 'lobby.html';
        }
    });
});