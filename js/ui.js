class GameUI {
    constructor() {
        this.screens = {
            start: document.getElementById('start-screen'),
            waiting: document.getElementById('waiting-screen'),
            game: document.getElementById('game-screen'),
            end: document.getElementById('end-screen')
        };

        this.initEventListeners();
    }

    initEventListeners() {
        // Pantalla de inicio
        document.getElementById('join-btn').addEventListener('click', () => this.handleJoin());
        document.getElementById('create-btn').addEventListener('click', () => this.handleCreate());

        // Pantalla de espera
        document.getElementById('ready-btn').addEventListener('click', () => this.handleReady());

        // Pantalla de juego
        document.querySelectorAll('.move-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-action');
                gameSocket.sendAction(action);
            });
        });

        document.getElementById('powerup-btn').addEventListener('click', () => {
            gameSocket.sendAction('USE_POWERUP');
        });

        // Pantalla de fin
        document.getElementById('play-again-btn').addEventListener('click', () => {
            this.showScreen('start');
        });

        // Teclado
        document.addEventListener('keydown', (e) => {
            if (!this.screens.game.classList.contains('active')) return;

            switch(e.key) {
                case 'ArrowUp': gameSocket.sendAction('MOVE_UP'); break;
                case 'ArrowDown': gameSocket.sendAction('MOVE_DOWN'); break;
                case 'ArrowLeft': gameSocket.sendAction('MOVE_LEFT'); break;
                case 'ArrowRight': gameSocket.sendAction('MOVE_RIGHT'); break;
                case ' ': gameSocket.sendAction('USE_POWERUP'); break;
            }
        });
    }

    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });
        this.screens[screenName].classList.add('active');
    }

    handleJoin() {
        const playerName = document.getElementById('player-name').value.trim();
        const gameCode = document.getElementById('game-code').value.trim().toUpperCase();

        if (!playerName) {
            alert('Por favor ingresa tu nombre');
            return;
        }

        gameSocket.playerName = playerName;
        gameSocket.gameCode = gameCode || null;

        this.showScreen('waiting');
        document.getElementById('display-game-code').textContent = gameCode || 'Generando...';

        gameSocket.connect((type, data) => {
            if (type === 'join') {
                this.handleGameJoin(data);
            } else if (type === 'update') {
                this.handleGameUpdate(data);
            }
        });
    }

    handleCreate() {
        document.getElementById('game-code').value = '';
        this.handleJoin();
    }

    handleReady() {
        // Aquí puedes implementar lógica adicional para indicar que estás listo
        this.showScreen('game');
    }

    handleGameJoin(gameInfo) {
        document.getElementById('game-code-display').textContent = gameInfo.gameCode;
        document.getElementById('player-name-display').textContent = gameSocket.playerName;

        if (gameInfo.state === 'IN_PROGRESS') {
            this.showScreen('game');
        }
    }

    handleGameUpdate(gameUpdate) {
        // Actualizar interfaz con los nuevos datos del juego
        gameEngine.updateGameState(gameUpdate.state);
        gameEngine.updatePlayers(gameUpdate.players || []);
        gameEngine.updateMap(gameUpdate.map);

        document.getElementById('players-count').textContent = gameUpdate.players?.length || 0;

        if (gameUpdate.state === 'FINISHED') {
            this.showEndScreen(gameUpdate);
        }
    }

    showEndScreen(gameData) {
        this.showScreen('end');
        // Aquí puedes mostrar los resultados del juego
        document.getElementById('end-title').textContent =
            gameData.winner === 'SURVIVORS' ? '¡Supervivientes ganan!' : '¡Infectados ganan!';
    }
}

const gameUI = new GameUI();