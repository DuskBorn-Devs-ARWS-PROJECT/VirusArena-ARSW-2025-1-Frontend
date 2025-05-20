class GameSocket {
    constructor() {
        this.stompClient = null;
        this.playerName = localStorage.getItem('playerName') || '';
        this.gameCode = localStorage.getItem('gameCode') || '';
        this.token = localStorage.getItem('token') || '';
        this.callbacks = {};
        this.isConnected = false;
        this.connectionPromise = null;
    }

    async connect() {
        if (this.isConnected) return true;
        if (this.connectionPromise) return this.connectionPromise;

        this.connectionPromise = new Promise((resolve, reject) => {
            const socket = new SockJS('http://backend-app-lb-954081308.us-east-2.elb.amazonaws.com/ws');
            this.stompClient = Stomp.over(socket);
            this.stompClient.debug = () => {};

            this.stompClient.connect(
                { 'Authorization': `Bearer ${this.token}` },
                (frame) => {
                    console.log('Connected: ' + frame);
                    this.isConnected = true;
                    this.setupGeneralSubscriptions();
                    this.setupScreenSpecificSubscriptions();
                    resolve(true);
                },
                (error) => {
                    console.error('Connection error:', error);
                    this.isConnected = false;
                    this.connectionPromise = null;
                    reject(error);
                }
            );
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

    setupGameSubscriptions() {
        this.stompClient.subscribe(`/topic/game/${this.gameCode}/update`, (message) => {
            const update = JSON.parse(message.body);
            this.trigger('game_update', update);
        });
    }

    setupResultsSubscriptions() {
        this.stompClient.subscribe(`/topic/game/${this.gameCode}/results`, (message) => {
            const results = JSON.parse(message.body);
            this.trigger('game_results', results);
        });
    }

    async sendJoin() {
        await this.ensureConnection();
        this.stompClient.send(
            "/app/join",
            { 'Authorization': `Bearer ${this.token}` },
            JSON.stringify({
                playerName: this.playerName,
                gameCode: this.gameCode
            })
        );
    }

    async sendAction(action) {
        await this.ensureConnection();
        this.stompClient.send(
            `/app/game/${this.gameCode}/action`,
            { 'Authorization': `Bearer ${this.token}` },
            JSON.stringify({
                playerId: localStorage.getItem('playerId'),
                action: action
            })
        );
    }

    async sendReady(isReady) {
        await this.ensureConnection();
        this.stompClient.send(
            `/app/lobby/${this.gameCode}/ready`,
            { 'Authorization': `Bearer ${this.token}` },
            JSON.stringify({
                playerId: localStorage.getItem('playerId'),
                isReady: isReady
            })
        );
    }

    async ensureConnection() {
        if (!this.isConnected) {
            await this.connect();
        }
    }

    on(event, callback) {
        this.callbacks[event] = callback;
    }

    trigger(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event](data);
        }
    }

    disconnect() {
        if (this.stompClient && this.isConnected) {
            this.stompClient.disconnect();
            this.isConnected = false;
        }
    }
}

const gameSocket = new GameSocket();