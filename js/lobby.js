document.addEventListener('DOMContentLoaded', () => {
    try {
        // Obtener datos del jugador del localStorage
        const playerName = localStorage.getItem('playerName');
        let gameCode = localStorage.getItem('gameCode');

        // Si no hay código de juego, generar uno nuevo
        let isNewGame = false;
        if (!gameCode) {
            gameCode = generateGameCode();
            localStorage.setItem('gameCode', gameCode);
            isNewGame = true;
        }

        // Si es una nueva partida, eliminar hostPlayerId
        if (isNewGame) {
            localStorage.removeItem('hostPlayerId');
        }

        // Mostrar código de sala
        document.getElementById('gameCode').textContent = `Código de sala: ${gameCode}`;

        // Referencias a elementos del DOM
        const playersList = document.getElementById('playersList');
        const readyBtn = document.getElementById('readyBtn');
        const startBtn = document.getElementById('startBtn');

        // Verificación crítica de elementos del DOM
        if (!startBtn || !readyBtn || !playersList) {
            console.error("Elementos del DOM no encontrados:");
            console.error("startBtn:", !!startBtn);
            console.error("readyBtn:", !!readyBtn);
            console.error("playersList:", !!playersList);
            throw new Error("Elementos esenciales del DOM no encontrados");
        }

        // Elemento para mostrar estado de conexión
        const statusMessage = document.createElement('div');
        statusMessage.id = 'connectionStatus';
        document.querySelector('main').prepend(statusMessage);

        // Variables de estado
        let players = [];
        let isHost = false;

        // Generar y guardar ID del jugador
        const playerId = 'player-' + generateId();
        localStorage.setItem('playerId', playerId);
        console.log("ID del jugador generado:", playerId);

        // WebSocket con SockJS y STOMP
        const socket = new SockJS('/ws');
        const stompClient = Stomp.over(socket);

        stompClient.debug = (str) => {
            console.debug("[STOMP] " + str);
        };

        // Manejar inicio del juego
        const handleStartGame = () => {
            console.group("Botón Iniciar Partida");

            if (!isHost) {
                console.warn("Solo el host puede iniciar la partida");
                console.groupEnd();
                return;
            }

            if (players.length < 1) {
                console.warn("Se necesita al menos 1 jugador");
                updateStatus("Se necesita al menos 1 jugador", "error");
                console.groupEnd();
                return;
            }

            const startRequest = {
                hostPlayerId: playerId,
                gameCode: gameCode,
                timestamp: new Date().getTime()
            };

            try {
                stompClient.send(`/app/lobby/${gameCode}/start`, {}, JSON.stringify(startRequest));
                updateStatus("Iniciando partida...", "success");
            } catch (error) {
                console.error("Error al enviar solicitud:", error);
                updateStatus("Error al iniciar partida", "error");
            }

            console.groupEnd();
        };

        startBtn.onclick = handleStartGame;

        // Conexión STOMP
        stompClient.connect({}, function (frame) {
            updateStatus('Conectado al servidor', 'success');
            console.log("Conexión STOMP establecida:", frame);

            // Suscripción al lobby
            stompClient.subscribe(`/topic/lobby/${gameCode}`, function (message) {
                try {
                    console.group("Mensaje de lobby recibido");
                    const update = JSON.parse(message.body);
                    console.log("Datos recibidos:", update);

                    players = (update.players || []).map(player => ({
                        ...player,
                        ready: true
                    }));

                    // Mantener el host original
                    let hostPlayerId = localStorage.getItem('hostPlayerId');
                    if (!hostPlayerId && players.length > 0) {
                        hostPlayerId = players[0].id;
                        localStorage.setItem('hostPlayerId', hostPlayerId);
                        console.log("Se guardó hostPlayerId:", hostPlayerId);
                    }

                    isHost = hostPlayerId === playerId;

                    console.log("Es host:", isHost);
                    console.groupEnd();

                    updateUI();
                } catch (error) {
                    console.error("Error al procesar actualización:", error);
                    updateStatus("Error al actualizar lobby", "error");
                }
            });

            // Suscripción a inicio del juego
            stompClient.subscribe(`/topic/game/${gameCode}/start`, function (message) {
                console.group("Mensaje de inicio recibido");
                try {
                    const gameState = JSON.parse(message.body);

                    if (gameState.state.toLowerCase() === "in_progress") {
                        localStorage.setItem('gameState', JSON.stringify(gameState));
                        updateStatus("Redirigiendo a la partida...", "success");
                        setTimeout(() => {
                            window.location.href = 'game.html';
                        }, 1000);
                    } else {
                        console.warn("Estado no válido para iniciar:", gameState.state);
                    }
                } catch (error) {
                    console.error("Error al procesar mensaje de inicio:", error);
                }
                console.groupEnd();
            });

            // Solicitud de unión al lobby
            const joinRequest = {
                playerId: playerId,
                playerName: playerName,
                gameCode: gameCode,
                timestamp: new Date().getTime()
            };

            stompClient.send(`/app/lobby/${gameCode}/join`, {}, JSON.stringify(joinRequest));

        }, function (error) {
            console.error("Error de conexión STOMP:", error);
            updateStatus("Error de conexión. Intentando reconectar...", "error");
            setTimeout(() => location.reload(), 3000);
        });

        // Actualizar interfaz de usuario
        function updateUI() {
            try {
                console.group("🔄 Actualizando UI");

                const hostPlayerId = localStorage.getItem('hostPlayerId');

                playersList.innerHTML = players.map(player => `
                    <div class="player-card ready">
                        <div class="status ready"></div>
                        <span>${player.name}</span>
                        ${player.id === playerId ? '<em>(Tú)</em>' : ''}
                        ${player.id === hostPlayerId ? '👑' : ''}
                    </div>
                `).join('');

                readyBtn.disabled = false;
                startBtn.style.display = isHost ? 'block' : 'none';
                startBtn.disabled = players.length < 1;

                const playerCount = document.getElementById('playerCount') || document.createElement('div');
                playerCount.id = 'playerCount';
                playerCount.textContent = `Jugadores conectados: ${players.length}`;
                playerCount.style.marginTop = '10px';
                document.querySelector('footer').prepend(playerCount);

                console.groupEnd();
            } catch (error) {
                console.error("Error al actualizar UI:", error);
            }
        }

        readyBtn.onclick = () => {
            updateStatus("Todos los jugadores están listos automáticamente", "info");
        };

        // Funciones auxiliares
        function generateId() {
            return Math.random().toString(36).substr(2, 9);
        }

        function generateGameCode() {
            return Math.random().toString(36).substring(2, 6).toUpperCase();
        }

        function updateStatus(message, type) {
            statusMessage.textContent = message;
            statusMessage.className = `status-${type}`;
            Object.assign(statusMessage.style, {
                padding: '10px',
                borderRadius: '5px',
                marginBottom: '15px',
                textAlign: 'center',
                color: type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#3498db',
                backgroundColor: type === 'success' ? 'rgba(46, 204, 113, 0.1)' :
                    type === 'error' ? 'rgba(231, 76, 60, 0.1)' : 'rgba(52, 152, 219, 0.1)',
                border: `1px solid ${type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#3498db'}`
            });
        }

        console.log("Lobby inicializado correctamente");

    } catch (error) {
        console.error("ERROR CRÍTICO:", error);
        alert('Error al cargar el lobby. La página se recargará.');
        setTimeout(() => location.reload(), 2000);
    }
});
