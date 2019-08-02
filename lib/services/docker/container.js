const
  streams = require('memory-streams'),
  ExecResult = require('./execResult');

class Container {
  constructor(instance, info) {
    this.instance = instance;
    this.info = info;
  }

  /**
   * @param {string} cmd
   * @returns {Promise<ExecResult>}
   */
  async exec (cmd) {
    const exec = await this.instance.exec({
      Cmd: ['sh' , '-c', cmd],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false
    });

    return new Promise((resolve, reject) => {
      exec.start((err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        const mStream = new streams.WritableStream();
        this.instance.modem.demuxStream(stream, mStream, mStream);

        stream.on('end', () => {
          exec.inspect((e, out) => {
            if (e) {
              reject(e);
              return;
            }

            const result = new ExecResult(out.ExitCode, mStream.toString());
            resolve(result);
          });
        });

      });
    });
  }
}

module.exports = Container;
