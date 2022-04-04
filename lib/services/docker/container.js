const { chunk } = require('lodash');
const
  streams = require('memory-streams'),
  ExecResult = require('./execResult'),
  { PassThrough } = require('stream');

class Container {
  constructor(instance, info) {
    this.instance = instance;
    this.info = info;
  }

  /**
   * @param {string} cmd
   * @returns {Promise<ExecResult>}
   */
  async exec (cmd, opts = { printStdout: false, printStderr: false }) {
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
        const stdout = new PassThrough();
        const stderr = new PassThrough();

        stdout.on('data', chunk => {
          if (opts.printStdout) {
            process.stdout.write(chunk);
          }
          mStream.write(chunk);
        });

        stderr.on('data', chunk => {
          if (opts.printStderr) {
            process.stderr.write(chunk);
          }
          mStream.write(chunk);
        });

        this.instance.modem.demuxStream(stream, stdout, stderr);

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
