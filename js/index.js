// index.js
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const createGameBtn = document.getElementById('createGameBtn');
    const joinGameBtn = document.getElementById('joinGameBtn');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');

    // Toggle between login and register forms
    showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.login-form').style.display = 'none';
        document.querySelector('.register-form').style.display = 'block';
    });

    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.register-form').style.display = 'none';
        document.querySelector('.login-form').style.display = 'block';
    });

    // Handle login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        try {
            const response = await fetch('http://3.129.95.241:8080/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                throw new Error('Credenciales incorrectas');
            }

            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('playerName', username);

            document.querySelector('.login-form').style.display = 'none';
            document.querySelector('.game-options').style.display = 'flex';
        } catch (error) {
            alert(error.message);
        }
    });

    // Handle registration
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value.trim();

        try {
            const response = await fetch('http://3.129.95.241:8080/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error en el registro');
            }

            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('playerName', username);

            document.querySelector('.register-form').style.display = 'none';
            document.querySelector('.game-options').style.display = 'flex';
        } catch (error) {
            alert(error.message);
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