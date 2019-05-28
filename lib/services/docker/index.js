const
  os = require('os'),
  Container = require('./container'),
  DockerOde = require('dockerode');

class Docker {
  constructor (suite, config) {
    this.suite = suite;

    this.docker = new DockerOde(config);

    this._network = null;
    this._containers = {};
  }

  async init () {
    const network = await this._getNetwork();

    for (const containerId of Object.keys(network.info.Containers)) {
      const instance = await this.docker.getContainer(containerId);
      const info = await instance.inspect();
      this._containers[info.Config.Labels['com.docker.compose.service']] = new Container(instance, info);
    }
  }

  getContainer (serviceName) {
    return this._containers[serviceName];
  }

  async _getNetwork () {
    if (this._network) {
      return Promise.resolve(this._network);
    }

    // this container
    const container = await this.docker.getContainer(os.hostname());
    const inspect = await container.inspect();
    const networkId = Object.keys(inspect.NetworkSettings.Networks)[0];
    this._network = {
      instance: await this.docker.getNetwork(networkId),
      info: null
    };
    this._network.info = await this._network.instance.inspect();

    return this._network;
  }

}

module.exports = Docker;
