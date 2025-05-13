class GameSocket {
    constructor() {
        this.stompClient = null;
        this.playerName = localStorage.getItem('playerName') || '';
        this.gameCode = localStorage.getItem('gameCode') || '';
        this.callbacks = {};
        this.isConnected = false;
        this.connectionPromise = null;
    }

    async connect() {
        if (this.isConnected) return true;
        if (this.connectionPromise) return this.connectionPromise;

        this.connectionPromise = new Promise((resolve, reject) => {
            const socket = new SockJS('/ws'); // URL corregida
            this.stompClient = Stomp.over(socket);
            this.stompClient.debug = () => {};

            this.stompClient.connect({}, (frame) => {
                console.log('Connected: ' + frame);
                this.isConnected = true;
                this.setupGeneralSubscriptions();
                this.setupScreenSpecificSubscriptions();
                resolve(true);
            }, (error) => {
                console.error('Connection error:', error);
                this.isConnected = false;
                this.connectionPromise = null;
                reject(error);
            });
        });

        return this.connectionPromise;
    }

    setupGeneralSubscriptions() {
        this.stompClient.subscribe('/user/queue/errors', (message) => {
            const error = JSON.parse(message.body);
            this.trigger('error', error);
        });
    }

    setupScreenSpecificSubscriptions() {
        const path = window.location.pathname;
        if (path.includes('lobby')) {
            this.setupLobbySubscriptions();
        } else if (path.includes('game')) {
            this.setupGameSubscriptions();
        } else if (path.includes('results')) {
            this.setupResultsSubscriptions();
        }
    }

    setupLobbySubscriptions() {
        this.stompClient.subscribe(`/topic/lobby/${this.gameCode}`, (message) => {
            const update = JSON.parse(message.body);
            this.trigger('lobby_update', update);
        });
    }

    async sendJoin() {
        await this.ensureConnection();
        this.stompClient.send("/app/join", {},
            JSON.stringify({
                playerName: this.playerName,
                gameCode: this.gameCode
            })
        );
    }
}

const gameSocket = new GameSocket();