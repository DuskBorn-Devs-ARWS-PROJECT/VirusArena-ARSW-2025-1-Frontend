// lobby.js
document.addEventListener('DOMContentLoaded', () => {
    try {
        const playerName = localStorage.getItem('playerName');
        const token = localStorage.getItem('token');
        let gameCode = localStorage.getItem('gameCode');

        if (!playerName || !token) {
            window.location.href = 'index.html';
            return;
        }

        let isNewGame = false;
        if (!gameCode) {
            gameCode = generateGameCode();
            localStorage.setItem('gameCode', gameCode);
            isNewGame = true;
        }

        if (isNewGame) {
            localStorage.removeItem('hostPlayerId');
        }

        document.getElementById('gameCode').textContent = `Código de sala: ${gameCode}`;

        const playersList = document.getElementById('playersList');
        const readyBtn = document.getElementById('readyBtn');
        const startBtn = document.getElementById('startBtn');

        if (!startBtn || !readyBtn || !playersList) {
            throw new Error("Elementos esenciales del DOM no encontrados");
        }

        const statusMessage = document.createElement('div');
        statusMessage.id = 'connectionStatus';
        document.querySelector('main').prepend(statusMessage);

        let players = [];
        let isHost = false;

        const playerId = 'player-' + generateId();
        localStorage.setItem('playerId', playerId);

        const socket = new SockJS('http://backend-app-lb-954081308.us-east-2.elb.amazonaws.com/ws');
        const stompClient = Stomp.over(socket);

        stompClient.debug = (str) => {
            console.debug("[STOMP] " + str);
        };

        const handleStartGame = () => {
            if (!isHost) {
                updateStatus("Solo el host puede iniciar la partida", "error");
                return;
            }

            if (players.length < 1) {
                updateStatus("Se necesita al menos 1 jugador", "error");
                return;
            }

            const startRequest = {
                hostPlayerId: playerId,
                gameCode: gameCode,
                timestamp: new Date().getTime()
            };

            try {
                stompClient.send(
                    `/app/lobby/${gameCode}/start`,
                    { 'Authorization': `Bearer ${token}` },
                    JSON.stringify(startRequest)
                );
                updateStatus("Iniciando partida...", "success");
            } catch (error) {
                console.error("Error al enviar solicitud:", error);
                updateStatus("Error al iniciar partida", "error");
            }
        };

        startBtn.onclick = handleStartGame;

        stompClient.connect(
            { 'Authorization': `Bearer ${token}` },
            function (frame) {
                updateStatus('Conectado al servidor', 'success');

                stompClient.subscribe(`/topic/lobby/${gameCode}`, function (message) {
                    try {
                        const update = JSON.parse(message.body);
                        players = (update.players || []).map(player => ({
                            ...player,
                            ready: true
                        }));

                        let hostPlayerId = localStorage.getItem('hostPlayerId');
                        if (!hostPlayerId && players.length > 0) {
                            hostPlayerId = players[0].id;
                            localStorage.setItem('hostPlayerId', hostPlayerId);

                            // Si este jugador es el host, actualizar su rol en el backend
                            if (hostPlayerId === playerId) {
                                updateUserRole('ROLE_HOST');
                            }
                        }

                        isHost = hostPlayerId === playerId;
                        updateUI();
                    } catch (error) {
                        console.error("Error al procesar actualización:", error);
                    }
                });

                stompClient.subscribe(`/topic/game/${gameCode}/start`, function (message) {
                    try {
                        const gameState = JSON.parse(message.body);
                        if (gameState.state.toLowerCase() === "in_progress") {
                            localStorage.setItem('gameState', JSON.stringify(gameState));
                            updateStatus("Redirigiendo a la partida...", "success");
                            setTimeout(() => {
                                window.location.href = 'game.html';
                            }, 1000);
                        }
                    } catch (error) {
                        console.error("Error al procesar mensaje de inicio:", error);
                    }
                });

                const joinRequest = {
                    playerId: playerId,
                    playerName: playerName,
                    gameCode: gameCode,
                    timestamp: new Date().getTime()
                };

                stompClient.send(
                    `/app/lobby/${gameCode}/join`,
                    { 'Authorization': `Bearer ${token}` },
                    JSON.stringify(joinRequest)
                );

            }, function (error) {
                console.error("Error de conexión STOMP:", error);
                updateStatus("Error de conexión. Intentando reconectar...", "error");
                setTimeout(() => location.reload(), 3000);
            }
        );

        function updateUI() {
            try {
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
            } catch (error) {
                console.error("Error al actualizar UI:", error);
            }
        }

        readyBtn.onclick = () => {
            const readyRequest = {
                playerId: playerId,
                isReady: true
            };

            stompClient.send(
                `/app/lobby/${gameCode}/ready`,
                { 'Authorization': `Bearer ${token}` },
                JSON.stringify(readyRequest)
            );
        };

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

    } catch (error) {
        console.error("ERROR CRÍTICO:", error);
        alert('Error al cargar el lobby. La página se recargará.');
        setTimeout(() => location.reload(), 2000);
    }

    // Añadir esta nueva función
    async function updateUserRole(newRole) {
        try {
            const response = await fetch('http://backend-app-lb-954081308.us-east-2.elb.amazonaws.com/api/auth/update-role', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ role: newRole })
            });

            if (!response.ok) {
                throw new Error('Error al actualizar rol');
            }
        } catch (error) {
            console.error("Error al actualizar rol:", error);
        }
    }
});