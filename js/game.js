let stompClient;
let gameState;
let playerId;
let gameTimeInterval;
let staminaTimer;

document.addEventListener('DOMContentLoaded', () => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'index.html';
            return;
        }

        gameState = JSON.parse(localStorage.getItem('gameState'));
        playerId = localStorage.getItem('playerId') || 'unknown';

        if (!gameState?.state || gameState.state.toLowerCase() !== "in_progress") {
            redirectToLobby();
            return;
        }

        setupInitialUI();
        setupWebSocket(token);
        setupEventListeners();
    } catch (error) {
        console.error("Error al iniciar el juego:", error);
        redirectToLobby();
    }
});

function setupInitialUI() {
    document.getElementById('playerName').textContent = localStorage.getItem('playerName') || 'Player';
    document.getElementById('playerCount').textContent = gameState?.players?.length ?? 0;

    const currentPlayer = gameState.players?.find(p => p.id === playerId);
    if (currentPlayer) updatePlayerInfo(currentPlayer);

    startGameTimer();
    renderGame(gameState);
}

function setupWebSocket(token) {
    const socket = new SockJS('http://backend-app-lb-954081308.us-east-2.elb.amazonaws.com/ws');
    stompClient = Stomp.over(socket);
    stompClient.debug = () => {};

    stompClient.connect(
        { 'Authorization': `Bearer ${token}` },
        () => {
            console.log("Conectado al juego");

            stompClient.subscribe(`/topic/game/${gameState.gameCode}/update`, (message) => {
                const update = JSON.parse(message.body);
                gameState = update;

                renderGame(update);
                startGameTimer();

                const currentPlayer = update.players?.find(p => p.id === playerId);
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
        },
        (error) => {
            console.error("Error de conexión:", error);
            setTimeout(() => setupWebSocket(token), 5000);
        }
    );
}

function renderGame(state) {
    const mapElement = document.getElementById('map');
    mapElement.innerHTML = '';

    state.board.forEach((row, y) => {
        row.forEach((cellValue, x) => {
            const cellElement = createCellElement(x, y, cellValue, state);
            mapElement.appendChild(cellElement);
        });
    });
}

function createCellElement(x, y, cellValue, state) {
    const cellElement = document.createElement('div');
    cellElement.className = 'cell';
    cellElement.dataset.x = x;
    cellElement.dataset.y = y;

    addCellClasses(cellElement, cellValue);
    addPlayerEffects(cellElement, x, y, state);

    return cellElement;
}

function addCellClasses(cellElement, cellValue) {
    if (cellValue === '#') {
        cellElement.classList.add('wall');
    } else if (cellValue === 'P') {
        cellElement.classList.add('powerup');
    }
}

function addPlayerEffects(cellElement, x, y, state) {
    const player = state.players.find(p => p.x === x && p.y === y);
    if (!player) return;

    cellElement.classList.add('player', player.type.toLowerCase());

    if (player.id === state.playerId) {
        cellElement.style.boxShadow = '0 0 10px 3px var(--info-color)';
        if (player.type === 'SURVIVOR' && player.staminaActive) {
            cellElement.style.border = '2px solid orange';
        }
    }
}

function updatePlayerInfo(player) {
    const playerTypeEl = document.getElementById('playerType');
    if (!playerTypeEl) return;

    playerTypeEl.textContent = player.type === 'INFECTED' ? 'Infectado' : 'Superviviente';

    if (player.type === 'SURVIVOR') {
        document.getElementById('powerUpCount').textContent = player.powerUpCount ?? 0;

        const staminaCountEl = document.getElementById('staminaCount');
        if (player.staminaActive) {
            const remainingTime = Math.max(0, Math.ceil((player.staminaEndTime - Date.now()) / 1000));
            staminaCountEl.textContent = `${remainingTime}s`;
            staminaCountEl.style.color = 'var(--warning-color)';
        } else {
            staminaCountEl.textContent = 'Inactivo';
            staminaCountEl.style.color = 'var(--muted-text)';
        }
    } else {
        document.querySelector('.player-stats').innerHTML = `
            <p>Tipo: <span id="playerType">Infectado</span></p>
            <p>Infectados: <span id="infectedCount">0</span></p>
        `;
    }
}

function startGameTimer() {
    clearInterval(gameTimeInterval);

    gameTimeInterval = setInterval(() => {
        const remainingMillis = gameState?.remainingTimeMillis ?? 0;
        const minutes = Math.floor(remainingMillis / 60000).toString().padStart(2, '0');
        const seconds = Math.floor((remainingMillis % 60000) / 1000).toString().padStart(2, '0');

        const gameTimerEl = document.getElementById('gameTimer');
        if (gameTimerEl) gameTimerEl.textContent = `${minutes}:${seconds}`;

        if (gameState?.state === 'finished') {
            clearInterval(gameTimeInterval);
            window.location.href = '/results';
        }
    }, 1000);
}

function startStaminaTimer(endTime) {
    clearInterval(staminaTimer);
    staminaTimer = setInterval(() => {
        const now = Date.now();
        const staminaCountEl = document.getElementById('staminaCount');

        if (now >= endTime) {
            clearInterval(staminaTimer);
            staminaCountEl.textContent = 'Inactivo';
            staminaCountEl.style.color = 'var(--muted-text)';
        } else {
            const remaining = Math.ceil((endTime - now) / 1000);
            staminaCountEl.textContent = `${remaining}s`;
        }
    }, 500);
}

function setupEventListeners() {
    document.addEventListener('keydown', (e) => {
        if (!stompClient?.connected) return;

        const currentPlayer = gameState.players?.find(p => p.id === playerId);
        if (!currentPlayer) return;

        let action = null;
        switch (e.key.toLowerCase()) {
            case 'w': case 'arrowup':    action = 'MOVE_UP'; break;
            case 's': case 'arrowdown':  action = 'MOVE_DOWN'; break;
            case 'a': case 'arrowleft':  action = 'MOVE_LEFT'; break;
            case 'd': case 'arrowright': action = 'MOVE_RIGHT'; break;
            case 'e':
                if (currentPlayer.type === 'SURVIVOR' && gameState.board?.[currentPlayer.y]?.[currentPlayer.x] === 'P') {
                    stompClient.send(
                        `/app/game/${gameState.gameCode}/collect`,
                        { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                        JSON.stringify({ playerId, x: currentPlayer.x, y: currentPlayer.y })
                    );
                }
                e.preventDefault();
                return;
            case 'q':
                if (currentPlayer.type === 'SURVIVOR' && currentPlayer.powerUpCount > 0) {
                    stompClient.send(
                        `/app/game/${gameState.gameCode}/action`,
                        { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                        JSON.stringify({ playerId, action: 'USE_POWERUP' })
                    );
                }
                e.preventDefault();
                return;
        }

        if (action) {
            stompClient.send(
                `/app/game/${gameState.gameCode}/action`,
                { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                JSON.stringify({ playerId, action })
            );
            e.preventDefault();
        }
    });

    document.getElementById('quitBtn')?.addEventListener('click', () => {
        if (confirm('¿Estás seguro de abandonar la partida?')) {
            if (stompClient?.connected) {
                stompClient.send(
                    `/app/game/${gameState.gameCode}/quit`,
                    { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    JSON.stringify({ playerId })
                );
            }
            redirectToLobby();
        }
    });
}

function redirectToLobby() {
    clearInterval(gameTimeInterval);
    clearInterval(staminaTimer);
    window.location.href = 'lobby.html';
}

window.addEventListener('beforeunload', () => {
    stompClient?.disconnect();
    clearInterval(staminaTimer);
});