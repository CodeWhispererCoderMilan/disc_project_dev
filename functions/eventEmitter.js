const EventEmitter = require('events');
const eventEmitter = new EventEmitter();
eventEmitter.setMaxListeners(14);
module.exports = {eventEmitter};
