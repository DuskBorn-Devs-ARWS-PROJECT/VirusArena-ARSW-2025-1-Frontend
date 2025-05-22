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

        const gameCodeElement = document.getElementById('gameCode');
        if (gameCodeElement) {
            gameCodeElement.textContent = `Código de sala: ${gameCode}`;
        }

        const playersList = document.getElementById('playersList');
        const readyBtn = document.getElementById('readyBtn');
        const startBtn = document.getElementById('startBtn');

        if (!startBtn || !readyBtn || !playersList) {
            throw new Error("Elementos esenciales del DOM no encontrados");
        }

        const statusMessage = document.createElement('div');
        statusMessage.id = 'connectionStatus';
        const mainElement = document.querySelector('main');
        if (mainElement) {
            mainElement.prepend(statusMessage);
        }

        let players = [];
        let isHost = false;

        const playerId = 'player-' + generateId();
        localStorage.setItem('playerId', playerId);

        const socket = new SockJS('http://backend-app-lb-954081308.us-east-2.elb.amazonaws.com/ws');
        const stompClient = Stomp.over(socket);

        stompClient.debug = () => {}; // Deshabilitar logs debug por defecto

        const handleStartGame = () => {
            if (!stompClient?.connected) {
                updateStatus("Error de conexión", "error");
                return;
            }

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
                timestamp: Date.now()
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

        startBtn.addEventListener('click', handleStartGame);

        stompClient.connect(
            { 'Authorization': `Bearer ${token}` },
            () => {
                updateStatus('Conectado al servidor', 'success');

                stompClient.subscribe(`/topic/lobby/${gameCode}`, (message) => {
                    try {
                        const update = JSON.parse(message.body);
                        players = update.players?.map(player => ({
                            ...player,
                            ready: true
                        })) || [];

                        let hostPlayerId = localStorage.getItem('hostPlayerId');
                        if (!hostPlayerId && players.length > 0) {
                            hostPlayerId = players[0].id;
                            localStorage.setItem('hostPlayerId', hostPlayerId);

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

                stompClient.subscribe(`/topic/game/${gameCode}/start`, (message) => {
                    try {
                        const gameState = JSON.parse(message.body);
                        if (gameState.state?.toLowerCase() === "in_progress") {
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
                    playerId,
                    playerName,
                    gameCode,
                    timestamp: Date.now()
                };

                stompClient.send(
                    `/app/lobby/${gameCode}/join`,
                    { 'Authorization': `Bearer ${token}` },
                    JSON.stringify(joinRequest)
                );
            },
            (error) => {
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

                const footer = document.querySelector('footer');
                if (footer) {
                    footer.prepend(playerCount);
                }
            } catch (error) {
                console.error("Error al actualizar UI:", error);
            }
        }

        readyBtn.addEventListener('click', () => {
            if (!stompClient?.connected) return;

            const readyRequest = {
                playerId,
                isReady: true
            };

            stompClient.send(
                `/app/lobby/${gameCode}/ready`,
                { 'Authorization': `Bearer ${token}` },
                JSON.stringify(readyRequest)
            );
        });

        function generateId() {
            try {
                // Navegadores modernos
                if (typeof window !== 'undefined' && (window.crypto || window.msCrypto)) {
                    const crypto = window.crypto || window.msCrypto;
                    const buffer = new Uint8Array(6); // 48 bits de entropía
                    crypto.getRandomValues(buffer);
                    return Array.from(buffer, byte => byte.toString(36).padStart(2, '0')).join('').slice(0, 9);
                }
                // Node.js
                else if (typeof require !== 'undefined') {
                    const crypto = require('crypto');
                    return crypto.randomBytes(6).toString('base64').replace(/[+/=]/g, '').slice(0, 9);
                }
            } catch (e) {
                console.error('Error usando crypto:', e);
            }


            throw new Error('No se pudo generar un ID seguro: Entorno no compatible');
        }

        function generateGameCode() {
            try {
                const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 caracteres no ambiguos
                let code = '';

                // Navegadores modernos
                if (typeof window !== 'undefined' && (window.crypto || window.msCrypto)) {
                    const crypto = window.crypto || window.msCrypto;
                    const randomValues = new Uint32Array(4);
                    crypto.getRandomValues(randomValues);

                    for (let i = 0; i < 4; i++) {
                        code += charset[randomValues[i] % charset.length];
                    }
                    return code;
                }
                // Node.js
                else if (typeof require !== 'undefined') {
                    const crypto = require('crypto');
                    const randomBytes = crypto.randomBytes(4);
                    for (let i = 0; i < 4; i++) {
                        code += charset[randomBytes[i] % charset.length];
                    }
                    return code;
                }
            } catch (e) {
                console.error('Error usando crypto:', e);
            }


            throw new Error('No se pudo generar un código seguro: Entorno no compatible');
        }

        function getStatusColors(type) {
            const colors = {
                success: {
                    text: '#2ecc71',
                    background: 'rgba(46, 204, 113, 0.1)',
                    border: '#2ecc71'
                },
                error: {
                    text: '#e74c3c',
                    background: 'rgba(231, 76, 60, 0.1)',
                    border: '#e74c3c'
                },
                default: {
                    text: '#3498db',
                    background: 'rgba(52, 152, 219, 0.1)',
                    border: '#3498db'
                }
            };

            return colors[type] || colors.default;
        }

        function updateStatus(message, type) {
            const colors = getStatusColors(type);

            statusMessage.textContent = message;
            statusMessage.className = `status-${type}`;
            Object.assign(statusMessage.style, {
                padding: '10px',
                borderRadius: '5px',
                marginBottom: '15px',
                textAlign: 'center',
                color: colors.text,
                backgroundColor: colors.background,
                border: `1px solid ${colors.border}`
            });
        }

    } catch (error) {
        console.error("ERROR CRÍTICO:", error);
        alert('Error al cargar el lobby. La página se recargará.');
        setTimeout(() => location.reload(), 2000);
    }

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