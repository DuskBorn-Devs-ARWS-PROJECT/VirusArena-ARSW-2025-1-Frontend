document.addEventListener('DOMContentLoaded', () => {
    const results = JSON.parse(localStorage.getItem('gameResults'));
    const resultMessage = document.getElementById('resultMessage');
    const playersResults = document.getElementById('playersResults');

    if (!results) {
        window.location.href = 'index.html';
        return;
    }

    resultMessage.textContent = results.winner === 'SURVIVORS'
        ? '¡Los supervivientes han ganado!'
        : '¡Los infectados han ganado!';

    playersResults.innerHTML = results.players.map(player => `
        <div class="player-result ${player.winner ? 'winner' : ''}">
            <div class="player-info">
                <span class="player-name">${player.name}</span>
                <span class="player-type">${player.type}</span>
            </div>
            <div class="player-stats">
                <span>Puntos: ${player.score}</span>
                ${player.type === 'SURVIVOR' ? `<span>Power-ups: ${player.powerUpsUsed || 0}</span>` : ''}
                ${player.type === 'INFECTED' ? `<span>Infecciones: ${player.infections || 0}</span>` : ''}
            </div>
        </div>
    `).join('');

    document.getElementById('mainMenuBtn').addEventListener('click', () => {
        localStorage.removeItem('gameResults');
        window.location.href = 'index.html';
    });

    document.getElementById('playAgainBtn').addEventListener('click', () => {
        localStorage.removeItem('gameResults');
        window.location.href = 'lobby.html';
    });
});
