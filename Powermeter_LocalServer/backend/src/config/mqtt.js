export const mqttOptions = (config) => ({
    clientId: config.mqttClientId,
    username: config.mqttUsername,
    password: config.mqttPassword,
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 10000,
    keepalive: 30,
    queueQoSZero: false,
    resubscribe: false,
});
