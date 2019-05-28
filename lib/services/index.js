const
  Docker = require('./docker'),
  Logger = require('./logger');

class ServiceContainer {
  constructor (suite) {
    this.suite = suite;

    this.docker = new Docker(suite, suite.config.docker);
    this.logger = new Logger(suite);
  }

  async init () {
    return Promise.all([
      this.docker
    ].map(service => service.init()));
  }

}

module.exports = ServiceContainer;
