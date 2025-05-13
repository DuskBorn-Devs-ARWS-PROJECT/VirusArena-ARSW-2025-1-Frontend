let stompClient;
let gameState;
let playerId;
let gameTimeInterval;
let staminaTimer;

document.addEventListener('DOMContentLoaded', () => {
    try {
        gameState = JSON.parse(localStorage.getItem('gameState'));
        playerId = localStorage.getItem('playerId') || 'unknown';

        if (!gameState || gameState.state.toLowerCase() !== "in_progress") {
            redirectToLobby();
            return;
        }

        setupInitialUI();
        setupWebSocket();
        setupEventListeners();
    } catch (error) {
        console.error("Error al iniciar el juego:", error);
        redirectToLobby();
    }
});

function setupInitialUI() {
    document.getElementById('playerName').textContent = localStorage.getItem('playerName');
    document.getElementById('playerCount').textContent = gameState.players.length;

    const currentPlayer = gameState.players.find(p => p.id === playerId);
    if (currentPlayer) updatePlayerInfo(currentPlayer);

    startGameTimer();
    renderGame(gameState);
}

function setupWebSocket() {
    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    stompClient.debug = () => {};

    stompClient.connect({}, function() {
        console.log("Conectado al juego");

        stompClient.subscribe(`/topic/game/${gameState.gameCode}/update`, function(message) {
            const update = JSON.parse(message.body);
            gameState = update;

            renderGame(update);
            startGameTimer();

            const currentPlayer = update.players.find(p => p.id === playerId);
            if (currentPlayer) {
                updatePlayerInfo(currentPlayer);
                if (currentPlayer.type === 'SURVIVOR' && currentPlayer.staminaActive) {
                    startStaminaTimer(currentPlayer.staminaEndTime);
                }
            }

            if (update.state === 'finished') {
                clearInterval(gameTimeInterval);
                window.location.href = '/results';
            }
        });
    }, function(error) {
        console.error("Error de conexión:", error);
        setTimeout(setupWebSocket, 5000);
    });
}

function renderGame(state) {
    const mapElement = document.getElementById('map');
    mapElement.innerHTML = '';

    for (let y = 0; y < state.board.length; y++) {
        for (let x = 0; x < state.board[y].length; x++) {
            const cellElement = document.createElement('div');
            cellElement.className = 'cell';
            cellElement.dataset.x = x;
            cellElement.dataset.y = y;

            const cellValue = state.board[y][x];
            if (cellValue === '#') cellElement.classList.add('wall');
            else if (cellValue === 'P') cellElement.classList.add('powerup');

            const player = state.players.find(p => p.x === x && p.y === y);
            if (player) {
                cellElement.classList.add('player', player.type.toLowerCase());
                if (player.id === playerId) {
                    cellElement.style.boxShadow = '0 0 10px 3px var(--info-color)';
                    if (player.type === 'SURVIVOR' && player.staminaActive) {
                        cellElement.style.border = '2px solid orange';
                    }
                }
            }

            mapElement.appendChild(cellElement);
        }
    }
}

function updatePlayerInfo(player) {
    document.getElementById('playerType').textContent = player.type === 'INFECTED' ? 'Infectado' : 'Superviviente';

    if (player.type === 'SURVIVOR') {
        document.getElementById('powerUpCount').textContent = player.powerUpCount || 0;

        if (player.staminaActive) {
            const remainingTime = Math.max(0, Math.ceil((player.staminaEndTime - Date.now()) / 1000));
            document.getElementById('staminaCount').textContent = `${remainingTime}s`;
            document.getElementById('staminaCount').style.color = 'var(--warning-color)';
        } else {
            document.getElementById('staminaCount').textContent = 'Inactivo';
            document.getElementById('staminaCount').style.color = 'var(--muted-text)';
        }
    } else {
        document.querySelector('.player-stats').innerHTML = `
            <p>Tipo: <span id="playerType">Infectado</span></p>
            <p>Infectados: <span id="infectedCount">0</span></p>
        `;
    }
}

function startGameTimer() {
    if (gameTimeInterval) clearInterval(gameTimeInterval);

    gameTimeInterval = setInterval(() => {
        const remainingMillis = gameState.remainingTimeMillis;
        const minutes = Math.floor(remainingMillis / 60000).toString().padStart(2, '0');
        const seconds = Math.floor((remainingMillis % 60000) / 1000).toString().padStart(2, '0');
        document.getElementById('gameTimer').textContent = `${minutes}:${seconds}`;

        if (gameState.state === 'finished') {
            clearInterval(gameTimeInterval);
            window.location.href = '/results';
        }
    }, 1000);
}

function startStaminaTimer(endTime) {
    if (staminaTimer) clearInterval(staminaTimer);
    staminaTimer = setInterval(() => {
        const now = Date.now();
        if (now >= endTime) {
            clearInterval(staminaTimer);
            document.getElementById('staminaCount').textContent = 'Inactivo';
            document.getElementById('staminaCount').style.color = 'var(--muted-text)';
        } else {
            const remaining = Math.ceil((endTime - now) / 1000);
            document.getElementById('staminaCount').textContent = `${remaining}s`;
        }
    }, 500);
}

function setupEventListeners() {
    document.addEventListener('keydown', (e) => {
        if (!stompClient || !stompClient.connected) return;

        const currentPlayer = gameState.players.find(p => p.id === playerId);
        if (!currentPlayer) return;

        let action = null;
        switch (e.key.toLowerCase()) {
            case 'w': case 'arrowup':    action = 'MOVE_UP'; break;
            case 's': case 'arrowdown':  action = 'MOVE_DOWN'; break;
            case 'a': case 'arrowleft':  action = 'MOVE_LEFT'; break;
            case 'd': case 'arrowright': action = 'MOVE_RIGHT'; break;
            case 'e':
                if (currentPlayer.type === 'SURVIVOR' && gameState.board[currentPlayer.y][currentPlayer.x] === 'P') {
                    stompClient.send(`/app/game/${gameState.gameCode}/collect`, {}, JSON.stringify({ playerId, x: currentPlayer.x, y: currentPlayer.y }));
                }
                e.preventDefault(); return;
            case 'q':
                if (currentPlayer.type === 'SURVIVOR' && currentPlayer.powerUpCount > 0) {
                    stompClient.send(`/app/game/${gameState.gameCode}/action`, {}, JSON.stringify({ playerId, action: 'USE_POWERUP' }));
                }
                e.preventDefault(); return;
        }

        if (action) {
            stompClient.send(`/app/game/${gameState.gameCode}/action`, {}, JSON.stringify({ playerId, action }));
            e.preventDefault();
        }
    });

    document.getElementById('quitBtn').addEventListener('click', () => {
        if (confirm('¿Estás seguro de abandonar la partida?')) {
            if (stompClient && stompClient.connected) {
                stompClient.send(`/app/game/${gameState.gameCode}/quit`, {}, JSON.stringify({ playerId }));
            }
            redirectToLobby();
        }
    });
}

function redirectToLobby() {
    clearInterval(gameTimeInterval);
    if (staminaTimer) clearInterval(staminaTimer);
    window.location.href = 'lobby.html';
}

window.addEventListener('beforeunload', () => {
    if (stompClient && stompClient.connected) stompClient.disconnect();
    if (staminaTimer) clearInterval(staminaTimer);
});
